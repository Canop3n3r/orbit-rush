// Orbit Rush flight logic: one flight from the pad to the end screen, with no DOM or rendering, so the
// browser game (main.js) and the headless tests (tests/*.mjs) run exactly the same rules.
// main.js passes hooks for sounds, toasts and visuals; every hook is optional.
import * as P from './physics.js?v=fp2';
const { R, MU, ATM } = P;
export const SIM_SPEED = 2;                 // game time runs 2x real time; warp multiplies on top
export const WARPS = [1, 2, 4, 10, 25, 50];
export const STAGE_CONFIRM_S = 2;           // second SPACE within this many real seconds confirms staging
export const PRESETS = [
  { name: 'Recommended', cfg: { engines: 3, s1fuel: 25, s2fuel: 6, payload: 1 }, note: 'AUTO reaches orbit, and the booster can land if you stage with a few tonnes left' },
  { name: 'Light & fast', cfg: { engines: 5, s1fuel: 25, s2fuel: 6, payload: 0 }, note: 'lots of spare Δv for booster landings' },
  { name: 'Heavy lift', cfg: { engines: 5, s1fuel: 35, s2fuel: 9, payload: 2 }, note: 'crew capsule, ×2 score' },
];
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
const DECK = 3;

// Would a booster released in this state land on its own (auto-land) with the fuel it has?
// Simulates a copy with the real booster autopilot. Returns { lands, fuelLeft, speed }.
export function landingCheck(b0) {
  const b = { ...b0, stages: b0.stages.map(s => ({ ...s })), manual: false, landing: false, state: 'flying' };
  if (b.stages[0].fuel <= 0.3 || P.altOf(b) <= 2000) return { lands: false, fuelLeft: 0, speed: Infinity };
  for (let t = 0; t < 1200;) {
    const h = P.altOf(b), dt = h > 15000 ? 1 / 20 : 1 / 120;
    P.boosterAutopilot(b); const e = P.stepVehicle(b, dt); t += dt;
    const sp = Math.hypot(b.vx, b.vy);
    if (h < 25000 && sp > 1400 && b.x * b.vx + b.y * b.vy < 0) return { lands: false, fuelLeft: b.stages[0].fuel, speed: sp, burned: true };
    if (e === 'ground') return { lands: sp < 10, fuelLeft: b.stages[0].fuel, speed: sp };
  }
  return { lands: false, fuelLeft: 0, speed: Infinity };
}
// Booster released from rocket state v with `fuel` tonnes left: does it land?
export function landsWith(v, fuel) {
  const b = P.makeBooster(v); b.stages[0].fuel = fuel; return landingCheck(b).lands;
}
// Hangar planning: fly the build on AUTO headlessly, find the smallest booster reserve (t) that still auto-lands,
// and whether the upper stage still reaches orbit when staged with that reserve.
export function planBuild(cfg) {
  const s = P.rocketStats(cfg); if (s.twr < 1) return { minReserve: null, orbit: false, reason: 'twr' };
  const F = new Flight(cfg); F.stagePress(); F.setAuto(true, true);
  const snaps = [], fuelMax = F.v.stages[0].fuelMax;
  let nextLvl = Math.floor(fuelMax * 0.6 * 2) / 2;
  for (let i = 0; i < 30 * 400 && F.v.cur === 0 && !F.flags.dead; i++) {
    F.step(1 / 30); const f = F.v.stages[0].fuel;
    while (f <= nextLvl && nextLvl > 0) { if (F.alt > 2000) snaps.push({ lvl: nextLvl, b: P.makeBooster(F.v) }); nextLvl -= 0.5; }
  }
  let minReserve = null;
  for (let i = snaps.length - 1; i >= 0; i--) { // smallest reserve first
    const b = snaps[i].b; b.stages[0].fuel = snaps[i].lvl;
    if (landingCheck(b).lands) { minReserve = snaps[i].lvl; break; }
  }
  if (minReserve === null) return { minReserve: null, orbit: false, reason: 'noland' };
  const r = simulateAuto(cfg, { reserve: minReserve + 0.5, dt: 1 / 30 });
  return { minReserve: minReserve + 0.5, orbit: r.orbit, landed: r.boosterLanded };
}
// Headless AUTO flight (used by the hangar planner and the tests). opts.reserve: stage with this much
// booster fuel left; opts.flyBooster: hand the booster to a scripted "player" right after staging (L).
export function simulateAuto(cfg, opts = {}) {
  const dt = opts.dt || 1 / 120, F = new Flight(cfg, opts.hooks || {});
  F.stagePress(); F.setAuto(true, true);
  for (let t = 0; t < (opts.tMax || 1500); t += dt) {
    F.realT += dt;
    if (opts.reserve !== undefined && F.v.cur === 0 && F.v.stages[0].fuel <= opts.reserve && F.canStage() && F.alt > 2000) {
      F.stage(); if (opts.flyBooster) F.toggleBooster();
      if (opts.handBack !== undefined) F._handBackAt = t + opts.handBack;
    }
    if (F._handBackAt !== undefined && t >= F._handBackAt && F.flyingBooster()) { F.toggleBooster(); F._handBackAt = undefined; }
    if (opts.each) opts.each(F, t);
    F.step(dt);
    const bDone = !F.booster || F.booster.state !== 'flying';
    if (F.flags.dead || F.flags.stranded) break;
    if (F.flags.orbit && F.v.guid === 'done' && bDone) break;
  }
  const o = P.orbitOf(F.v);
  return { F, orbit: !!F.flags.orbit && !F.flags.dead, ap: o.ap, pe: o.pe, dead: F.flags.dead, stranded: !!F.flags.stranded,
    boosterLanded: !!(F.booster && F.booster.state === 'landed'), s2left: F.v.stages[1].fuel };
}

export class Flight {
  constructor(cfg, hooks = {}, padZ = 0.4) {
    this.cfg = { ...cfg }; this.h = hooks;
    const v = P.buildRocket(cfg); v.y = R + padZ; v.ut = 0; v.auto = false; this.v = v;
    this.booster = null; this.ship = null;
    this.met = 0;               // mission clock: starts at liftoff, not on the pad
    this.ignited = false; this.maxQ = 0; this.autoOn = false; this.warpI = 0; this.autoWarp = false;
    this.ended = false; this.finalScore = null; this.stageArm = -1; this.realT = 0;
    this.flags = { liftoff: 0, maxq: 0, space: 0, orbit: 0, booster: '', boosterBonus: 0, dead: '', fairing: 0, maxAlt: 0,
      stranded: 0, cutoff: 0, highQ: 0, padTime: 0, flatLow: 0, steep: 0, stagedFuel: null, stagedAlt: 0, apAtOut: 0, cause: '' };
  }
  call(name, ...a) { const f = this.h[name]; return f ? f(...a) : undefined; }
  toast(msg, color) { this.call('toast', msg, color); }
  get alt() { return P.altOf(this.v); }
  canStage() { return this.ignited && !this.v.clamped && this.met > 3 && this.alt > 150; }
  // SPACE / STAGE: ignite on the pad; afterwards staging needs a second press within STAGE_CONFIRM_S.
  stagePress() {
    const v = this.v, f = this.flags;
    if (f.dead) return 'dead';
    if (this.v.auto) this.takeOverUpper();
    if (!this.ignited) { this.ignited = true; v.ut = 1; this.call('sound', 'ignite'); this.toast('IGNITION', '#ffb35c'); return 'ignite'; }
    const next = v.cur === 0 ? 'stage' : v.fairing > 0 && this.alt > 30000 ? 'fairing' : null;
    if (!next) return 'none';
    if (next === 'stage' && !this.canStage()) { this.toast('Clear the tower first!', '#ffb35c'); return 'blocked'; }
    if (this.stageArm < 0 || this.realT - this.stageArm > STAGE_CONFIRM_S) {
      this.stageArm = this.realT;
      this.toast(next === 'stage' ? 'Press SPACE again to STAGE' + this.stageWarning() : 'Press SPACE again to drop the fairing', '#ffd23a');
      return 'armed';
    }
    this.stageArm = -1;
    if (next === 'stage') this.stage(); else this.jettison();
    return next;
  }
  stageWarning() {
    const v = this.v, s = v.stages[0];
    if (this.alt <= 2000) return ' (too low to recover the booster)';
    return this.boosterCanLand() ? '' : ` — booster has only ${s.fuel.toFixed(1)} t: not enough to land`;
  }
  // Cached (once per sim second) prediction: if staged right now, would the booster land?
  boosterCanLand() {
    const v = this.v; if (v.cur !== 0) return false;
    const key = Math.floor(this.met);
    if (this._landKey !== key) { this._landKey = key; this._landOk = this.alt > 2000 && landsWith(v, v.stages[0].fuel); }
    return this._landOk;
  }
  stage() {
    const v = this.v, bh = this.alt;
    const b = P.makeBooster(v); b.ut = 0; b.manual = false; b.maxH = bh; b.stagedAlt = bh; this.booster = b;
    v.cur = 1; this.flags.stagedFuel = b.stages[0].fuel; this.flags.stagedAlt = bh;
    this.call('stage', b);
    const fuel = b.stages[0].fuel;
    if (fuel > 0.3 && bh > 2000) {
      const a = P.predictImpact(b), ok = landingCheck(b).lands; b.canLand = ok;
      if (a !== null) { this.ship = { ang: a, moved: false }; this.call('ship', this.ship); }
      this.toast(ok ? `STAGE SEP — booster has ${fuel.toFixed(1)} t. Press L to fly it!` : `STAGE SEP — only ${fuel.toFixed(1)} t left: not enough for auto-landing (L to try by hand)`, ok ? '#fff' : '#ffb35c');
    } else this.toast(bh <= 2000 ? 'STAGE SEP — too low for booster recovery' : 'STAGE SEP — booster is dry', '#fff');
  }
  jettison() { const v = this.v; if (v.fairing <= 0) return; v.fairing = 0; this.flags.fairing = 1; this.call('jettison'); this.toast('Fairing separation', '#9cc3ff'); }
  setAuto(on, quiet) {
    if (this.v.auto && !on) this.v.auto = false;
    this.autoOn = on;
    if (on) { this.v.guid = null; if (this.v.ut <= 0 && !this.flags.orbit) this.v.ut = 1; }
    if (!quiet) this.toast(on ? 'AUTO on: flies to orbit (gravity turn, Max-Q, coast, circularize)' : 'Manual steering', '#9cc3ff');
  }
  takeOverUpper() { const v = this.v; if (v.auto) { v.auto = false; this.autoOn = false; v.ut = v.throttle; this.toast('You have the upper stage', '#9cc3ff'); } }
  flyingBooster() { const b = this.booster; return !!(b && b.state === 'flying' && b.manual); }
  toggleBooster() {
    const b = this.booster;
    if (!b || b.state !== 'flying') { this.toast('No booster in flight', '#ffb35c'); return false; }
    if (!this.ship || b.stages[0].fuel <= 0) { this.toast('This booster can\'t be recovered', '#ffb35c'); return false; }
    b.manual = !b.manual;
    if (b.manual) {
      b.ut = 0; b.retro = true; this.autoWarp = false;
      // the upper stage keeps flying the full AUTO ascent (same guidance as F) while you land the booster
      if (!this.flags.dead) { this.v.auto = true; this.autoOn = true; if (this.v.ut <= 0 && !this.flags.orbit) this.v.ut = 1; }
      this.toast('YOU HAVE THE BOOSTER — upper stage on autopilot', '#ffd23a');
    } else this.toast('Booster on auto-land (smaller bonus). Upper stage stays on AUTO', '#9cc3ff');
    this.call('boosterControl', b.manual);
    return true;
  }
  // ---------- warp ----------
  canWarpToAp() {
    const v = this.v, h = this.alt, vr = (v.x * v.vx + v.y * v.vy) / (h + R);
    if (this.flags.dead || this.flyingBooster() || this.flags.orbit || !this.ignited) return false;
    if (this.autoOn) return h > 3000 && vr > 0 && (v.guid === 'coast' || v.guid === 'ascent');
    return v.thrust <= 0 && vr > 20 && h > 15000;
  }
  startAutoWarp() {
    if (this.flyingBooster()) { this.toast('Land the booster first!', '#ffb35c'); return false; }
    if (!this.canWarpToAp()) { this.toast(this.autoOn ? 'Warp to Ap: wait until AUTO is climbing toward apoapsis' : 'Warp to Ap: cut engines and coast upward first (above 15 km)', '#ffb35c'); return false; }
    this.autoWarp = true; this.toast(this.autoOn ? 'Warping to apoapsis — AUTO will circularize' : 'Warping to apoapsis…', '#9cc3ff'); return true;
  }
  setWarp(i, quiet) { this.warpI = Math.max(0, Math.min(WARPS.length - 1, i)); if (!quiet) this.toast('Time warp ×' + WARPS[this.warpI], '#9cc3ff'); }
  warpLimit() { // [max warp, reason]
    const v = this.v, h = this.alt, b = this.booster;
    if (!this.ignited || this.flags.dead) return [1, ''];
    if (this.flyingBooster()) return [1, 'flying booster'];
    if (h < ATM && v.thrust > 0) return [4, 'engines on in the air'];
    if (v.thrust > 0 && this.autoWarp) return [4, 'burning'];
    void b; return [WARPS[WARPS.length - 1], ''];
  }
  effWarp() { return Math.min(WARPS[this.warpI], this.warpLimit()[0]); }
  updateAutoWarp() {
    if (!this.autoWarp) return;
    const v = this.v;
    if (this.flags.dead || this.flyingBooster() || this.flags.orbit) { this.autoWarp = false; this.setWarp(0, true); return; }
    if (!this.autoOn && v.thrust > 0) { this.autoWarp = false; this.setWarp(0, true); return; }
    const tAp = P.timeToAp(v), lead = (this.autoOn ? P.circBurn(v).tb * 0.5 : 0) + 15;
    const vr = (v.x * v.vx + v.y * v.vy) / Math.hypot(v.x, v.y);
    if (v.guid === 'circ' || vr <= 0 || tAp <= lead) {
      this.autoWarp = false; this.setWarp(0, true);
      if (this.autoOn) this.toast('At apoapsis — AUTO circularizing', '#ffd23a'); else this.toast('At apoapsis — BURN prograde! (F + Z)', '#ffd23a');
      this.call('sound', 'beep', 1000);
    } else { const left = (tAp - lead) / SIM_SPEED; this.setWarp(left > 60 ? 5 : left > 25 ? 4 : left > 8 ? 3 : 2, true); }
  }
  // Advance by real seconds (applies sim speed + warp). Returns the sim seconds advanced.
  advance(rdt) {
    this.realT += rdt; this.updateAutoWarp();
    const W = this.effWarp(), simDt = rdt * SIM_SPEED * W, step = W > 4 ? 1 / 30 : 1 / 120, N = Math.ceil(simDt / step - 1e-9);
    for (let i = 0; i < N; i++) this.step(simDt / N);
    return simDt;
  }
  // ---------- one physics step ----------
  step(dt) {
    const v = this.v, f = this.flags;
    if (!f.dead) {
      const h0 = this.alt;
      if (!this.ignited) v.throttle = 0;
      else if (this.autoOn && !v.clamped) {
        const gd = P.autoGuide(v), d = wrap(gd.ang - v.ang), rate = 0.8 * dt;
        v.ang += Math.max(-rate, Math.min(rate, d));
        if (gd.phase === 'done' && v.ut > 0) { v.ut = 0; if (!f.cutoff) { f.cutoff = 1; this.toast('AUTO cutoff — orbit reached', '#7dffa6'); } }
        v.throttle = v.auto ? gd.throttle : Math.min(v.ut, gd.throttle);
        // AUTO stages a dry booster by itself (stage earlier yourself to keep landing fuel)
        if (v.cur === 0 && v.stages[0].fuel <= 0 && this.canStage()) { this.toast('AUTO: booster empty, staging', '#9cc3ff'); this.stage(); }
      } else v.throttle = this.autoOn ? Math.min(v.ut, P.qCap(v)) : v.ut;
      const st = v.stages[v.cur];
      const e = P.stepVehicle(v, dt), h = this.alt;
      if (v.q > this.maxQ) this.maxQ = v.q;
      if (!v.clamped && !f.liftoff) { f.liftoff = 1; this.met = 0; this.toast('LIFTOFF!', '#fff'); }
      if (f.liftoff) this.met += dt;
      if (e === 'ground') this.fail(this.met < 8 ? 'never cleared the tower' : 'hit the ground', 'ground');
      else {
        if (v.q > 80) this.fail('over-pressure (Max-Q too high)', 'overq');
        else if (v.q > 15 && v.aoa > 0.26) this.fail('aerodynamic breakup — turned too hard', 'aoa');
        if (v.clamped && this.ignited && v.throttle > 0.95) { f.padTime += dt; if (f.padTime > 6 || (st && st.fuel <= 0)) this.fail('too heavy to lift off (TWR < 1)', 'twr'); }
        f.maxAlt = Math.max(f.maxAlt, h);
        if (!f.highQ && v.q > 25 && v.thrust > 0) { f.highQ = 1; this.toast(this.autoOn ? 'HIGH Q — AUTO is throttling down' : 'HIGH Q — throttle down (S)!', '#ffb35c'); }
        if (!f.maxq && this.maxQ > 8 && v.q < this.maxQ * 0.8) { f.maxq = 1; this.toast('Max-Q passed', '#9cc3ff'); }
        if (!f.space && h > ATM) { f.space = 1; this.toast('🌌 SPACE! +1000', '#b98cff'); this.call('sound', 'beep', 1200); }
        if (!f.fairing && h > P.FAIRING_ALT) this.jettison();
        // flight-quality bookkeeping for the end-screen advice
        if (v.thrust > 0 && !v.clamped) {
          const pitch = Math.abs(wrap(Math.atan2(v.y, v.x) - v.ang));
          if (h < 40000 && pitch > 1.2 && !f.orbit) f.flatLow += dt;
          if (h > 12000 && h < ATM && pitch < 0.45 && !f.orbit) f.steep += dt;
        }
        const o = P.orbitOf(v);
        if (h > ATM && !f.orbit && o.pe > ATM) { f.orbit = 1; this.toast('🛰️ ORBIT ACHIEVED! +3000', '#7dffa6'); this.call('sound', 'orbit'); }
        if (!f.orbit && !f.stranded && v.cur === 1 && v.stages[1].fuel <= 0) {
          f.stranded = 1; f.apAtOut = o.ap; f.peAtOut = o.pe; f.cause = this.diagnose();
          this.toast('Out of fuel — suborbital', '#ffb35c'); this.call('end', 2500, () => !f.orbit);
        }
      }
    }
    const b = this.booster;
    if (b && b.state === 'flying') {
      const n = Math.max(1, Math.ceil(dt / (1 / 120) - 1e-9));   // booster always integrates finely (landing precision)
      for (let i = 0; i < n && b.state === 'flying'; i++) this.stepBooster(b, dt / n);
    }
    if (!this.ended && !f.dead && f.orbit && v.thrust <= 0 && (!b || b.state !== 'flying') && !this.endQueued) { this.endQueued = true; this.call('end', 2500, () => !f.dead); }
  }
  stepBooster(b, dt) {
    const bh0 = P.altOf(b);
    if (b.manual) {
      if (b.retro && Math.hypot(b.vx, b.vy) > 3) { const d = wrap(Math.atan2(-b.vy, -b.vx) - b.ang), rate = 1.2 * dt; b.ang += Math.max(-rate, Math.min(rate, d)); }
      b.throttle = b.stages[0].fuel > 0 ? b.ut : 0; b.n = bh0 > 12000 ? Math.min(3, b.nMax) : 1;
      b.phase = b.throttle > 0 ? 'burning' : 'falling';
    } else P.boosterAutopilot(b);
    const e = P.stepVehicle(b, dt);
    const bh = P.altOf(b), sp = Math.hypot(b.vx, b.vy); b.maxH = Math.max(b.maxH, bh);
    if (bh < 25000 && sp > 1400 && b.x * b.vx + b.y * b.vy < 0) { b.state = 'lost'; this.flags.booster = 'burned up on reentry (do an entry burn)'; this.call('boosterLost', b, true); this.toast('Booster burned up', '#ff6262'); return; }
    const ship = this.ship;
    if (ship && !b.manual && bh < 9000 && !ship.moved) { ship.ang = Math.atan2(b.y, b.x) - 0.0005; ship.moved = true; this.call('shipMoved', ship); }
    if (b.state === 'flying') {
      const nearShip = ship && R * Math.abs(wrap(Math.atan2(b.y, b.x) - ship.ang)) < 40;
      if (e === 'ground' || (nearShip && bh < DECK)) this.landBooster(b, sp);
    }
  }
  landBooster(b, sp) {
    const f = this.flags, ship = this.ship, r = Math.hypot(b.x, b.y), up = Math.atan2(b.y, b.x), tilt = Math.abs(wrap(b.ang - up));
    const dist = ship ? R * Math.abs(wrap(up - ship.ang)) : 1e9;
    b.vx = b.vy = 0; b.throttle = 0; b.thrust = 0;
    let ok = false;
    if (b.maxH < 2000) { b.state = 'lost'; f.booster = 'lost (staged too low)'; }
    else if (b.manual) {
      if (sp < 8 && tilt < 0.25 && dist < 35) {
        ok = true; f.boosterBonus = 2500 + Math.round((35 - dist) * 25) + Math.round((8 - sp) * 80);
        f.booster = `landed by hand — ${dist.toFixed(1)} m off center at ${sp.toFixed(1)} m/s`; this.toast(`🎯 YOU LANDED IT! +${f.boosterBonus}`, '#7dffa6');
      } else { f.booster = sp < 8 && dist >= 35 ? `missed the droneship by ${(dist - 35).toFixed(0)} m` : sp < 8 ? 'tipped over (too tilted)' : `crashed at ${sp.toFixed(0)} m/s`; this.toast('Booster lost — ' + f.booster, '#ff6262'); }
    } else if (sp < 10) { ok = true; f.boosterBonus = 1000; f.booster = 'auto-landed on the droneship'; this.toast('🎯 BOOSTER AUTO-LANDED +1000', '#7dffa6'); }
    else { f.booster = `crashed at ${sp.toFixed(0)} m/s (needed more fuel: stage earlier)`; this.toast('Booster lost', '#ff6262'); }
    if (ok) { b.state = 'landed'; const k = (R + (dist < 40 ? DECK : 0)) / r; b.x *= k; b.y *= k; b.ang = up; this.call('boosterLanded', b); this.call('sound', 'landed'); }
    else { b.state = 'lost'; this.call('boosterLost', b, false); }
  }
  fail(reason, cause) {
    const f = this.flags; if (f.dead) return;
    f.dead = reason; f.cause = cause; this.v.throttle = this.v.ut = 0; this.autoWarp = false; this.warpI = 0;
    this.call('fail', reason); this.toast('RUD — ' + reason, '#ff6262'); this.call('end', 2800, () => true);
  }
  // What went wrong when the upper stage ran dry short of orbit.
  diagnose() {
    const f = this.flags, s = P.rocketStats(this.cfg), o = P.orbitOf(this.v);
    if (s.total < 3700) return 'dv';
    if (f.stagedFuel !== null && f.stagedFuel > 0.35 * this.v.stages[0].fuelMax) return 'staged-early';
    if (f.flatLow > 25 && f.flatLow >= f.steep) return 'flat';
    if (f.steep > 40) return 'steep';
    if (isFinite(o.ap) && o.ap > ATM) return 'circ';
    return 'dv-margin';
  }
  advice() {
    const f = this.flags, pe = isFinite(f.peAtOut) ? (f.peAtOut / 1000).toFixed(0) : '?';
    const ADV = {
      dv: `This rocket only has ${P.rocketStats(this.cfg).total.toFixed(0)} m/s of Δv; orbit needs ~3,700. Add fuel or pick a lighter payload.`,
      'staged-early': `You staged with ${(f.stagedFuel || 0).toFixed(1)} t still in the booster — that fuel was needed to reach orbit. Stage later (~4 t left) or add booster fuel.`,
      flat: `The climb was too flat: you spent ${f.flatLow.toFixed(0)} s burning nearly sideways below 40 km, fighting drag. Turn more gently (or use AUTO, F).`,
      steep: `The climb was too steep: ${f.steep.toFixed(0)} s burning nearly straight up above 12 km wastes fuel on gravity. Lean east sooner (or use AUTO, F).`,
      circ: `Apoapsis was high enough, but the circularization ran dry. Coast to apoapsis first (G), then burn prograde — or let AUTO do it.`,
      'dv-margin': `Just short of orbit. Try AUTO (F), a little more upper-stage fuel, or the Recommended build.`,
    };
    return `Ran out of fuel before orbit (Pe ${pe} km). ${ADV[f.cause] || ADV['dv-margin']}`;
  }
  score() {
    if (this.finalScore !== null) return this.finalScore;
    const f = this.flags, v = this.v; let s = 0; const o = P.orbitOf(v), mult = P.OPTS.payload[this.cfg.payload].mult;
    s += Math.min(f.maxAlt || 0, ATM) / 100;
    if (f.space) s += 1000;
    if (f.orbit) { s += 3000; if (isFinite(o.ap)) s += Math.max(0, 1500 - Math.abs(o.ap - o.pe) / 40); s += (v.stages[1].fuel / v.stages[1].fuelMax) * 800; }
    s *= mult; s += f.boosterBonus; if (f.dead) s *= 0.5;
    return Math.round(s);
  }
  // Freeze the result: the end dialog and the corner score always show the same number.
  finish() { if (!this.ended) { this.finalScore = this.score(); this.ended = true; this.autoWarp = false; this.warpI = 0; } return this.finalScore; }
  unfinish() { this.ended = false; this.finalScore = null; this.endQueued = false; } // "Keep flying" from the orbit screen
  // HUD hint text (pure, so tests can check it).
  hint() {
    const v = this.v, f = this.flags, b = this.booster, h = this.alt, r = h + R, sp = Math.hypot(v.vx, v.vy), vr = (v.x * v.vx + v.y * v.vy) / r;
    const o = P.orbitOf(v), engineOn = v.thrust > 0, s1 = v.stages[0], s2 = v.stages[1], fuelLeft = v.cur === 0 ? s1.fuel + s2.fuel : s2.fuel;
    if (f.dead) return 'Press R to go back to the hangar';
    if (this.flyingBooster()) {
      const bh = P.altOf(b), bsp = Math.hypot(b.vx, b.vy), bd = b.miss ?? 0;
      if (b.stages[0].fuel <= 0) return 'Out of fuel… brace!';
      if (bh > 25000 && bsp > 1150) return 'ENTRY BURN: F = hold retrograde, Z = full throttle until under 1,100 m/s';
      if (bh > 4000) return Math.abs(bd) > 150 ? `Predicted miss ${(Math.abs(bd) / 1000).toFixed(1)} km: tilt ${bd < 0 ? 'D (east)' : 'A (west)'} + small throttle` : 'On target! Coast (X), hold retrograde (F), landing burn at ~3 km';
      return 'LANDING BURN: W/S throttle to ~5 m/s at touchdown. Keep it upright (F)';
    }
    if (!this.ignited) return '';
    if (v.clamped) return 'Not enough thrust… lighten the rocket';
    if (v.q > 25 && engineOn) return this.autoOn ? 'HIGH Q — AUTO is throttling down' : 'HIGH Q — throttle down (S)';
    if (!this.autoOn && h < 8000 && sp < 400) return 'Press F for AUTO (flies all the way to orbit), or steer east yourself with D';
    if (v.cur === 0 && s1.fuel <= 0) return 'Booster empty — SPACE twice to stage!';
    if (v.cur === 0 && h > 15000) {
      return this.boosterCanLand() ? `SPACE twice to stage — booster has ${s1.fuel.toFixed(1)} t, enough to land` : `⚠ Booster ${s1.fuel.toFixed(1)} t: no longer enough to land it — stage soon (SPACE twice)`;
    }
    if (fuelLeft <= 0 && !f.orbit) return 'Out of fuel — suborbital';
    if (f.orbit) return engineOn ? 'In orbit! Cut throttle (X)' : b && b.state === 'flying' ? 'Orbit! Watch the booster: B · fly it: L' : 'Orbit achieved 🛰️';
    if (v.auto) return 'Upper stage on AUTO (flying to orbit) — press Z/X/F or steer to take over';
    if (this.autoOn) {
      const tAp = P.timeToAp(v);
      if (v.guid === 'circ') return 'AUTO circularizing at apoapsis — burning until Pe > 75 km';
      if (v.guid === 'coast') return `AUTO coasting to apoapsis (${Math.round(tAp / SIM_SPEED)} s) — press G to warp there`;
      return 'AUTO flying the gravity turn' + (v.cur === 0 ? ' — stage (SPACE twice) while the booster still has landing fuel (see hangar)' : '');
    }
    if (engineOn && isFinite(o.ap) && o.ap > 80000 && h < ATM - 5000) return 'Ap is high enough — cut throttle (X) and coast';
    if (!engineOn && h < ATM && vr > 0) return h > 15000 ? 'Coasting — press "Warp to Ap" (G)' : 'Coasting…';
    if (h > ATM - 3000 || (!engineOn && vr <= 20)) return vr > 60 && !engineOn ? 'Warp to Ap (G), then burn prograde' : engineOn ? 'Burn until Pe > 70 km' : 'Burn now! F (AUTO) or Z (full throttle)';
    return '';
  }
}
