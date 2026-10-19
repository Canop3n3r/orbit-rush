// Orbit Rush flight logic: one flight from the pad to the end screen, with no DOM or rendering, so the
// browser game (main.js) and the headless tests (tests/*.mjs) run exactly the same rules on the
// full-scale 6-DOF physics (physics.js). main.js passes hooks for sounds, toasts and visuals.
import * as P from './physics.js?v=hf1';
import { TEMPLATES, PARTS, buildVehicle, designStats, validate, cloneDesign, recoveryInfo, ORBIT_DV } from './parts.js?v=hf1';
const { R, ATM, V } = P;
export const SIM_SPEED = 2;                 // game time runs 2x real time; warp multiplies on top
export const WARPS = [1, 2, 4, 10, 25, 50, 100, 1000];
export const STAGE_CONFIRM_S = 2;           // second SPACE within this many real seconds confirms staging
export const QALPHA_MAX = 12000;            // Pa·rad: structural limit on dynamic pressure × angle of attack
export const QMAX = 80000;                  // Pa: over-pressure limit
export const PHYS_DT = 0.02;                // s: fixed physics step (RK4) at low warp
export const PRESETS = TEMPLATES;
export const DEORBIT_PE = 45000;            // m: AUTO deorbit burn lowers periapsis to this (deep enough to be captured)
export const SAFE_TOUCHDOWN = 12;           // m/s: capsule touchdown speed the crew (and the pod) survive
export const CHUTE_AUTO = { drogueAlt: 11000, mainAlt: 4000 };
export const SAFE_LANDING = { speed: 8, tilt: 15 }; // m/s, degrees: a powered vertical landing the legs survive // m: AUTO deploys drogues / mains below these
// Can a parachute stage be deployed now? Returns { ok, why } against the canopy's real limits (speed, Mach, q).
export function chuteLimits(spec, tel, stage) {
  const lim = stage === 'drogue' ? spec.drogue : spec.main;
  if (stage === 'drogue') {
    if (tel.machShown === null || tel.rho < 1e-5) return { ok: false, why: 'no air to inflate it', hard: true };
    if (tel.mach > lim.machMax) return { ok: false, why: `Mach ${tel.mach.toFixed(1)} > ${lim.machMax}` };
    if (tel.q > lim.qMax) return { ok: false, why: `q ${(tel.q / 1000).toFixed(1)} kPa > ${lim.qMax / 1000}` };
  } else {
    if (tel.vAir > lim.vMax) return { ok: false, why: `${tel.vAir.toFixed(0)} m/s > ${lim.vMax}` };
    if (tel.q > lim.qMax) return { ok: false, why: `q ${(tel.q / 1000).toFixed(1)} kPa > ${lim.qMax / 1000}` };
  }
  return { ok: true, why: '' };
}
const DECK = 3, PAD_EF = [1, 0, 0];         // launch site on the equator (Earth-fixed unit vector)
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
const fmtKm = m => (m / 1000).toFixed(0) + ' km';
// Droneship position (ECI) at clock t: an Earth-fixed point that turns with the planet.
export const shipPos = (ship, t, rot = true) => V.rotZ(V.scale(ship.ef, R + DECK), rot ? P.OMEGA_E * t : 0);
const surfDist = (a, b) => R * Math.acos(Math.max(-1, Math.min(1, V.dot(V.norm(a), V.norm(b)))));

// Would a booster released in this state land on its own (auto-land) with the fuel it has?
export function landingCheck(b0) {
  const b = { ...b0, r: [...b0.r], v: [...b0.v], stages: b0.stages.map(s => ({ ...s })), manual: false, landing: false, entryDone: false, state: 'flying' };
  if (b.stages[0].fuel <= 0.3 || P.V.len(b.r) - R <= 2000) return { lands: false, fuelLeft: 0, speed: Infinity };
  for (let t = 0; t < 1500;) {
    const h = V.len(b.r) - R, dt = h > 15000 ? 1 / 10 : 1 / 50;
    P.boosterAutopilot(b); const e = P.stepPoint(b, dt); t += dt;
    const va = P.airVel(b, b.r, b.v), sp = V.len(va);
    if (burnedUp(b, h, sp)) return { lands: false, fuelLeft: b.stages[0].fuel, speed: sp, burned: true };
    if (e) return { lands: sp < 10, fuelLeft: b.stages[0].fuel, speed: sp, r: b.r, clock: b.clock };
  }
  return { lands: false, fuelLeft: 0, speed: Infinity };
}
const burnedUp = (b, h, sp) => h < 30000 && sp > 1700 && V.dot(b.r, b.v) < 0;
export function landsWith(v, fuel) { const b = P.makeBooster(v); b.stages[0].fuel = fuel; return landingCheck(b).lands; }
// Hangar planning: fly AUTO headlessly, find the smallest booster reserve (t) that still auto-lands, and
// whether the upper stages still reach orbit when staged with that reserve.
export function planBuild(design, opts = {}) {
  if (!validate(design).ok) return { minReserve: null, orbit: false, reason: 'invalid' };
  const s = designStats(design); if (s.twr < 1) return { minReserve: null, orbit: false, reason: 'twr' };
  if (s.stages.length < 2) return { minReserve: null, orbit: false, reason: 'single' };
  const F = new Flight(design, {}, { earthRot: opts.earthRot }); F.stagePress(); F.setAuto(true, true);
  const snaps = [], fuelMax = F.v.stages[0].fuelMax, step = Math.max(1, Math.round(fuelMax / 40));
  let nextLvl = Math.floor(fuelMax * 0.5 / step) * step;
  for (let i = 0; i < 25 * 400 && F.v.cur === 0 && !F.flags.dead; i++) {
    F.step(1 / 25); const f = F.v.stages[0].fuel;
    while (f <= nextLvl && nextLvl > 0) { if (F.alt > 2000) snaps.push({ lvl: nextLvl, b: P.makeBooster(F.v) }); nextLvl -= step; }
  }
  let minReserve = null;
  for (let i = snaps.length - 1; i >= 0; i--) { const b = snaps[i].b; b.stages[0].fuel = snaps[i].lvl; if (landingCheck(b).lands) { minReserve = snaps[i].lvl; break; } }
  if (minReserve === null) return { minReserve: null, orbit: false, reason: 'noland' };
  const r = simulateAuto(design, { reserve: minReserve + step, dt: 1 / 25, earthRot: opts.earthRot });
  return { minReserve: minReserve + step, orbit: r.orbit, landed: r.boosterLanded };
}
// Headless AUTO flight. opts.reserve: stage with this much booster fuel left; opts.flyBooster: hand the
// booster to a scripted "player" after staging; opts.earthRot: Earth rotation on/off.
export function simulateAuto(design, opts = {}) {
  const dt = opts.dt || PHYS_DT, F = new Flight(design, opts.hooks || {}, { earthRot: opts.earthRot });
  F.stagePress(); F.setAuto(true, true);
  for (let t = 0; t < (opts.tMax || 2400); t += dt) {
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
    boosterLanded: !!(F.booster && F.booster.state === 'landed'), s2left: F.v.stages[F.lastPow].fuel, cause: F.flags.cause, dvUsed: F.dvUsed };
}
// Full round trip on AUTO: fly to orbit, coast `coast` seconds, deorbit (O) and ride the capsule home.
export function simulateMission(design, opts = {}) {
  const r = simulateAuto(design, opts), F = r.F;
  if (!r.orbit) return { ...r, recovered: false };
  const dt = opts.dt || PHYS_DT, t1 = opts.coast || 60;
  for (let t = 0; t < t1; t += dt) F.step(dt);
  F.deorbit();
  for (let t = 0; t < (opts.tReturn || 9000) && !F.flags.dead && !F.flags.recovered; t += dt) { if (opts.each) opts.each(F, t); F.step(F.alt > 130000 && F.ret && F.ret.phase === 'coast' ? Math.min(1, dt * 25) : dt); }
  return { ...r, recovered: !!F.flags.recovered, dead: F.flags.dead, cause: F.flags.cause, touchdown: F.flags.touchdown, maxHeat: F.maxHeat, maxG: F.maxG, maxGret: F.maxGret, maxTskin: F.maxTskin };
}
// Hangar verdict: fly the design on AUTO headlessly and explain the outcome in plain words.
export function assessDesign(design, opts = {}) {
  const val = validate(design);
  if (!val.ok) return { orbit: false, text: val.errors[0], level: 'bad' };
  const st = designStats(design);
  if (st.twr < 1) return { orbit: false, text: `AUTO can't fly this: liftoff TWR ${st.twr.toFixed(2)} < 1, so it never leaves the pad. Add Thumpers or remove weight.`, level: 'bad' };
  const r = simulateAuto(design, { dt: 1 / 20, earthRot: opts.earthRot });
  if (r.orbit) {
    const top = r.F.v.stages[r.F.lastPow];
    return { orbit: true, level: 'good', text: `✔ AUTO reaches orbit (Ap ${(r.ap / 1000).toFixed(0)} km / Pe ${(r.pe / 1000).toFixed(0)} km) using ${(r.dvUsed / 1000).toFixed(2)} km/s, with ${r.s2left.toFixed(1)} t of ${top.fuelMax.toFixed(0)} t left in the top stage.` };
  }
  const F = r.F, cause = F.flags.cause;
  const why = {
    breakup: 'it broke up: aerodynamic load (dynamic pressure × angle of attack) was too high. Check the aero balance: the centre of pressure must be behind the centre of mass (add Tail Fins at the bottom).',
    tumble: 'it tumbled: the rocket is aerodynamically unstable and the controls could not hold it. Add Tail Fins at the bottom or more gimbal (Thumper/Mule).',
    overq: 'it went too fast too low (over-pressure). Use fewer first-stage engines or more fuel weight.',
    ground: 'it fell back to the ground: a stage was too weak to hold altitude. Give upper stages more thrust.',
    burnup: `it overheated: ${r.F.flags.dead}. Add a fairing over the payload, or fly a shallower climb.`,
    fellback: 'the upper stage was too weak to keep climbing and fell back into the air. Give it more thrust (vacuum TWR ≥ 0.5: a second Lark or a Mule) or less fuel.',
    twr: "it can't lift off the pad.",
  }[cause];
  if (why) return { orbit: false, level: 'bad', text: `✘ AUTO fails: ${why}` };
  if (F.flags.stranded) return { orbit: false, level: 'bad', text: '✘ AUTO runs out of fuel: ' + F.advice().replace(/^Ran out of fuel before orbit \(Pe [^)]*\)\. /, '') };
  return { orbit: false, level: 'warn', text: '✘ AUTO did not reach orbit in time. Try more thrust on the upper stages.' };
}
export { cloneDesign };

export class Flight {
  constructor(design, hooks = {}, opts = {}) {
    if (typeof opts === 'number') opts = { padZ: opts };
    this.design = cloneDesign(design); this.h = hooks; this.stats = designStats(design);
    const v = buildVehicle(design); v.earthRot = opts.earthRot !== false;
    v.site = { ef: PAD_EF, lift: (opts.padZ ?? 0.4) + P.massProps(v).ycom, q0: P.padAttitude(PAD_EF) }; // r is the centre of mass
    const s0 = P.siteAt(v, 0); v.r = s0.r; v.v = s0.v; v.q = s0.q; v.clock = 0; v.ut = 0; v.auto = false; v.sas = 'stab';
    this.v = v; this.booster = null; this.ship = null; this.dvUsed = 0;
    this.met = 0; this.ignited = false; this.maxQ = 0; this.maxQEntry = 0; this.maxG = 0; this.autoThrottle = true; this.ascent = true; this.autoOn = false; this.warpI = 0; this.autoWarp = false;
    this.ended = false; this.finalScore = null; this.stageArm = -1; this.realT = 0; this.rails = false;
    P.stepVehicle(v, 0); // fill telemetry
    this.flags = { liftoff: 0, maxq: 0, space: 0, orbit: 0, booster: '', boosterBonus: 0, dead: '', fairing: 0, maxAlt: 0, mach1: 0,
      stranded: 0, cutoff: 0, highQ: 0, padTime: 0, flatLow: 0, steep: 0, stagedFuel: null, stagedAlt: 0, apAtOut: 0, cause: '',
      recovered: 0, touchdown: null, reentry: 0, plasma: 0, landed: 0 };
    // last stage with an engine (a recovery capsule on top has none) and the round-trip capability
    this.lastPow = 0; v.stages.forEach((s, i) => { if (s.eng && s.eng.tv > 0) this.lastPow = i; });
    this.rec = recoveryInfo(design); this.ret = null; this.orbitSnap = null; this.maxHeat = 0; this.maxTskin = 0; this.maxGret = 0; this.parked = null;
    v.chute = { state: 'stowed', t: 0 }; v.chuteCdA = 0;
  }
  call(name, ...a) { const f = this.h[name]; return f ? f(...a) : undefined; }
  toast(msg, color) { this.call('toast', msg, color); }
  get alt() { return P.altOf(this.v); }
  get last() { return this.v.stages.length - 1; }
  get tel() { return this.v.tel; }
  canStage() { return this.ignited && this.v.cur < this.last && !this.v.clamped && this.met > 3 && this.alt > 150; }
  stagePress() {
    const v = this.v, f = this.flags;
    if (f.dead) return 'dead';
    if (this.v.auto) this.takeOverUpper();
    if (!this.ignited) { this.ignited = true; v.ut = 1; this.call('sound', 'ignite'); this.toast('IGNITION', '#ffb35c'); return 'ignite'; }
    const next = v.cur < this.last ? 'stage' : v.fairing > 0 && this.alt > 60000 ? 'fairing' : null;
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
    const v = this.v; if (v.cur !== 0) return '';
    if (this.alt <= 2000) return ' (too low to recover the booster)';
    return this.boosterCanLand() ? '' : ` — booster has only ${v.stages[0].fuel.toFixed(1)} t: not enough to land`;
  }
  boosterCanLand() {
    const v = this.v; if (v.cur !== 0) return false;
    const key = Math.floor(this.met / 2);
    if (this._landKey !== key) { this._landKey = key; this._landOk = this.alt > 2000 && landsWith(v, v.stages[0].fuel); }
    return this._landOk;
  }
  stage() {
    const v = this.v, bh = this.alt;
    if (v.cur >= this.last) return;
    if (v.cur > 0) {
      const d = P.makeBooster(v); d.stageIndex = v.cur; this.shiftCom(() => { v.cur++; });
      this.call('drop', d);
      if (v.cur > this.lastPow) { v.throttle = v.ut = 0; this.toast('CAPSULE SEPARATION — heat shield first: SAS retrograde (3)', '#fff'); if (this.ret) this.ret.sepAt = this.met; }
      else this.toast(`STAGE ${v.cur} SEP — stage ${v.cur + 1} ignition`, '#fff');
      return;
    }
    const b = P.makeBooster(v); b.ut = 0; b.manual = false; b.maxH = bh; b.stagedAlt = bh; this.booster = b;
    this.shiftCom(() => { v.cur = 1; }); this.flags.stagedFuel = b.stages[0].fuel; this.flags.stagedAlt = bh;
    this.call('stage', b);
    const fuel = b.stages[0].fuel;
    if (fuel > 0.3 && bh > 2000) {
      // the droneship waits where the auto-land profile (entry burn + landing burn) touches down
      const lc = landingCheck(b), ok = lc.lands; b.canLand = ok;
      const pi = lc.r ? null : P.predictImpact(b), imp = lc.r ? { r: lc.r, t: lc.clock - b.clock } : pi && { r: pi.r, t: pi.t - b.clock };
      if (imp) { this.ship = { ef: V.norm(V.rotZ(imp.r, v.earthRot ? -P.OMEGA_E * (b.clock + imp.t) : 0)), moved: false }; this.call('ship', this.ship); }
      this.toast(ok ? `STAGE SEP — booster has ${fuel.toFixed(1)} t. Press Y to fly it!` : `STAGE SEP — only ${fuel.toFixed(1)} t left: not enough for auto-landing (Y to try by hand)`, ok ? '#fff' : '#ffb35c');
    } else this.toast(bh <= 2000 ? 'STAGE SEP — too low for booster recovery' : 'STAGE SEP — booster is dry', '#fff');
  }
  // Drop the bottom stage (fn) and move r to the new, higher centre of mass so nothing jumps on screen.
  shiftCom(fn) {
    const v = this.v, L0 = P.stackGeom(v).L, y0 = P.massProps(v).ycom; fn();
    const L1 = P.stackGeom(v).L, y1 = P.massProps(v).ycom, nose = P.noseOf(v);
    v.r = V.add(v.r, V.scale(nose, (L0 - L1) + y1 - y0)); P.stepVehicle(v, 0);
  }
  jettison() { const v = this.v; if (v.fairing <= 0) return; v.fairing = 0; this.flags.fairing = 1; this.call('jettison'); this.toast('Fairing separation', '#9cc3ff'); }
  setAuto(on, quiet) {
    if (on && this.ret) { this.ret.auto = true; if (!quiet) this.toast('AUTO is flying the return (deorbit, reentry, parachutes)', '#9cc3ff'); return; }
    if (!on && this.ret) { if (this.ret.auto && !quiet) this.toast('You have the capsule — parachutes stay armed (F hands it back)', '#9cc3ff'); this.ret.auto = false; this.v.steerDir = null; this.autoOn = false; if (this.v.auto) this.v.auto = false; return; }
    if (this.v.auto && !on) this.v.auto = false;
    this.autoOn = on; if (!on) this.v.steerDir = null;
    if (on) { this.v.guid = null; if (this.v.ut <= 0 && !this.flags.orbit) this.v.ut = 1; }
    if (!quiet) this.toast(on ? 'AUTO on: gravity turn, Max-Q throttling, coast, circularize' : 'Manual flight (SAS ' + P.SAS_LABEL[this.v.sas] + ')', '#9cc3ff');
  }
  setSAS(mode) { const v = this.v; v.sas = mode; v.sasHold = null; if (this.autoOn && mode !== 'stab') this.setAuto(false, true); if (this.ret && this.ret.auto) this.setAuto(false); this.toast('SAS: ' + P.SAS_LABEL[mode], '#9cc3ff'); }
  toggleRCS() { const v = this.v; v.rcsOn = !v.rcsOn; const has = v.stages.slice(v.cur).some(s => s.parts.some(p => p.kind === 'rcs')); this.toast(v.rcsOn ? (has ? `RCS on (${(v.rcsFuel * 1000).toFixed(0)} kg monoprop)` : 'RCS on — but this rocket has no RCS ring') : 'RCS off', '#9cc3ff'); }
  takeOverUpper() { const v = this.v; if (v.auto) { v.auto = false; this.autoOn = false; v.steerDir = null; v.ut = v.throttle; this.toast('You have the upper stage', '#9cc3ff'); } }
  flyingBooster() { const b = this.booster; return !!(b && b.state === 'flying' && b.manual); }
  toggleBooster() {
    const b = this.booster;
    if (!b || b.state !== 'flying') { this.toast('No booster in flight', '#ffb35c'); return false; }
    if (!this.ship || b.stages[0].fuel <= 0) { this.toast('This booster can\'t be recovered', '#ffb35c'); return false; }
    b.manual = !b.manual;
    if (b.manual) {
      b.ut = 0; b.retro = true; this.autoWarp = false;
      if (!this.flags.dead) { this.v.auto = true; this.autoOn = true; if (this.v.ut <= 0 && !this.flags.orbit) this.v.ut = 1; }
      this.toast('YOU HAVE THE BOOSTER — upper stage on autopilot', '#ffd23a');
    } else this.toast('Booster on auto-land (smaller bonus). Upper stage stays on AUTO', '#9cc3ff');
    this.call('boosterControl', b.manual);
    return true;
  }
  // ---------- coming home: deorbit burn, capsule separation, reentry, parachutes ----------
  canDeorbit() { const f = this.flags; return this.ignited && !f.dead && !f.recovered && !this.ret && this.alt > 60000 && !this.flyingBooster(); }
  deorbit() {
    if (!this.canDeorbit()) { this.toast(this.ret ? 'Already on the way home' : 'Deorbit: get above 60 km first', '#ffb35c'); return false; }
    const v = this.v; this.autoOn = false; v.auto = false; v.guid = null; this.autoWarp = false; this.setWarp(0, true);
    const o = P.orbitOf(v), needBurn = o.pe > DEORBIT_PE + 5000 && v.cur <= this.lastPow;
    if (this.flags.orbit && !this.orbitSnap) { const st = v.stages[Math.min(this.lastPow, v.stages.length - 1)]; this.orbitSnap = { o: { ap: o.ap, pe: o.pe, T: o.T }, fuel: st.fuelMax > 0 ? st.fuel / st.fuelMax : 0 }; }
    this.ret = { phase: needBurn ? 'align' : 'sep', auto: true, armed: true, t: 0, sepAt: null, burnFuel0: v.stages[v.cur].fuel };
    v.sas = 'retrograde'; v.sasHold = null; v.ut = 0;
    this.toast(needBurn ? 'DEORBIT: turning retrograde for the deorbit burn' : 'Coming home: separating for reentry', '#ffd23a');
    return true;
  }
  cancelReturn() { if (!this.ret) return; this.ret = null; this.v.steerDir = null; this.v.ut = 0; this.toast('Return cancelled — you have control', '#9cc3ff'); }
  updateReturn(dt) {
    const R0 = this.ret, v = this.v, f = this.flags; if (!R0 || f.dead || f.recovered) return;
    R0.t += dt; const h = this.alt, o = P.orbitOf(v);
    const retro = V.scale(P.progradeOf(v), -1);
    if (R0.auto) v.steerDir = retro;
    if (R0.phase === 'align') {
      v.throttle = 0; v.ut = 0;
      const ang = Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), retro))));
      if (ang < 0.06 && V.len(v.w) < 0.02 || R0.t > 90) { R0.phase = 'burn'; this.toast('DEORBIT BURN', '#ffd23a'); }
    } else if (R0.phase === 'burn') {
      const s = v.stages[v.cur];
      if (R0.auto) v.ut = 1;
      if (o.pe <= DEORBIT_PE || !s || s.fuel <= 0 || v.cur > this.lastPow) {
        v.ut = 0; v.throttle = 0; R0.phase = 'sep'; R0.t = 0;
        this.toast(o.pe <= DEORBIT_PE + 20000 ? `Deorbit burn complete — Pe ${(o.pe / 1000).toFixed(0)} km` : `Out of fuel: Pe still ${(o.pe / 1000).toFixed(0)} km`, o.pe <= DEORBIT_PE + 20000 ? '#7dffa6' : '#ffb35c');
      }
    } else if (R0.phase === 'sep') {
      v.ut = 0;
      if (R0.t > 3) {
        if (this.rec.capsule && v.cur < this.last) { this.stage(); }
        R0.phase = 'coast'; R0.t = 0;
      }
    } else if (R0.phase === 'coast') {
      v.ut = 0;
      if (h < 125000) { R0.phase = 'entry'; this.setWarp(0, true); this.toast('ENTRY INTERFACE — 120 km. Heat shield first!', '#ffb35c'); this.call('sound', 'beep', 700); }
      else if (R0.auto) {
        // warp toward entry interface, but never jump the rails past 140 km in one frame
        const vr = -V.dot(v.v, V.norm(v.r)), tLeft = vr > 1 ? (h - 140000) / vr : 3000;
        this.setWarp(tLeft > 900 ? 7 : tLeft > 300 ? 6 : tLeft > 60 ? 5 : 3, true);
      }
    } else if (R0.phase === 'entry') {
      if (R0.armed && f.reentry && v.chute.state === 'stowed' && this.hasChute() && h < CHUTE_AUTO.drogueAlt && chuteLimits(this.chuteSpec(), v.tel, 'drogue').ok) this.deployChute();
      if (R0.armed && v.chute.state === 'drogue' && h < CHUTE_AUTO.mainAlt && chuteLimits(this.chuteSpec(), v.tel, 'main').ok) this.deployChute();
    }
  }
  hasChute() { const g = P.stackGeom(this.v); return !!g.chute && this.v.chute.state !== 'failed'; }
  chuteSpec() { const g = P.stackGeom(this.v); return g.chute ? g.chute.p : null; }
  // P: deploy the next parachute stage now. Outside its limits the canopy shreds (real consequence).
  deployChute() {
    const v = this.v, c = v.chute, spec = this.chuteSpec();
    if (!spec || c.state === 'failed') { this.toast(c.state === 'failed' ? 'Parachutes are gone' : 'No parachutes on this craft', '#ffb35c'); return 'none'; }
    if (c.state === 'main' || c.state === 'cut') return 'none';
    const stage = c.state === 'stowed' ? 'drogue' : 'main', lim = chuteLimits(spec, v.tel, stage);
    if (!lim.ok) {
      if (lim.hard) { this.toast(`Too high to deploy parachutes (${lim.why})`, '#ffb35c'); return 'blocked'; }
      c.state = 'failed'; v.chuteCdA = 0; this.toast(`💥 ${stage === 'drogue' ? 'Drogues' : 'Mains'} shredded: ${lim.why}`, '#ff6262'); this.call('chute', 'failed'); return 'shredded';
    }
    c.state = stage; c.t = 0; this.toast(stage === 'drogue' ? '🪂 Drogue chutes out' : '🪂 MAIN CHUTES', '#7dffa6'); this.call('chute', stage); this.call('sound', 'beep', 900);
    return stage;
  }
  updateChute(dt) {
    const v = this.v, c = v.chute, spec = this.chuteSpec(); if (!spec) { v.chuteCdA = 0; return; }
    if (c.state === 'drogue' || c.state === 'main') {
      c.t += dt; const S = spec[c.state], x = Math.min(1, c.t / S.open);
      // reefed opening: the main inflates slowly (x^2) so the opening shock stays survivable
      v.chuteCdA = (c.state === 'main' ? spec.drogue.cda * (1 - x) + S.cda * x * x : S.cda * x);
      if (v.tel.q > S.qMax * 1.6 && c.t > 0.5) { c.state = 'failed'; v.chuteCdA = 0; this.toast('💥 Parachute torn away (too much dynamic pressure)', '#ff6262'); this.call('chute', 'failed'); }
    } else v.chuteCdA = 0;
  }
  // Heat: parts past their limit fail. Fins and the parachute pack burn off; anything else destroys the craft.
  checkHeat() {
    const v = this.v, th = v.therm, tel = v.tel; if (!th) return;
    if (tel.heat > this.maxHeat) this.maxHeat = tel.heat;
    for (let j = v.cur; j < v.stages.length; j++) for (const p of v.stages[j].parts) if (p.Ts > this.maxTskin) this.maxTskin = p.Ts;
    if (!this.flags.plasma && tel.heat > 150000) { this.flags.plasma = 1; this.toast('🔥 Plasma! The shock layer is glowing', '#ffb35c'); }
    if (!th.fail) return;
    const e = th.fail, p = e.p, name = (PARTS[p.id] && PARTS[p.id].name) || p.id;
    if (p.kind === 'fins' || p.kind === 'chute') {
      for (const s of v.stages) { const i = s.parts.indexOf(p); if (i >= 0) s.parts.splice(i, 1); }
      v._g = null; if (p.kind === 'chute') { v.chute.state = 'failed'; v.chuteCdA = 0; }
      this.toast(`🔥 ${name} burned off (${p.Ts.toFixed(0)} K)`, '#ff6262'); return;
    }
    const where = V.dot(v.v, V.norm(v.r)) < 0 && this.flags.orbit || this.ret ? 'burned up on reentry' : 'overheated';
    this.fail(th.failIn ? `${where} — ${name} interior overheated (${p.Ti.toFixed(0)} K)` : `${where} — ${name} reached ${p.Ts.toFixed(0)} K (limit ${e.th.Tmax} K)`, 'burnup');
  }
  touchdown(sp) {
    const v = this.v, f = this.flags; f.touchdown = sp;
    v.throttle = v.ut = 0;
    if (sp <= SAFE_TOUCHDOWN) {
      f.recovered = 1; this.toast(`🌊 TOUCHDOWN at ${sp.toFixed(1)} m/s — ${this.v.stages.some(s => s.parts.some(p => p.id === 'crew')) ? 'crew' : 'capsule'} recovered! +${4000 * (v.mult || 1)}`, '#7dffa6');
      this.call('sound', 'landed'); this.call('recovered');
      this.parked = { ef: V.norm(V.rotZ(v.r, v.earthRot ? -P.OMEGA_E * v.clock : 0)), lift: v.tel.ycom };
      this.endQueued = true; this.call('end', 3000, () => !this.ended);
    } else this.fail(`hit the ground at ${sp.toFixed(0)} m/s${v.chute.state === 'stowed' ? ' (no parachutes deployed)' : v.chute.state === 'failed' ? ' (parachutes failed)' : ''}`, 'impact');
  }
  // Powered vertical landing on the ground (Academy lesson 10 and any hop): gentle and upright = landed.
  landing(sp) {
    const v = this.v, f = this.flags, tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.norm(v.r))))) * 180 / Math.PI;
    f.touchdown = sp; v.throttle = v.ut = 0;
    if (sp <= SAFE_LANDING.speed && tilt <= SAFE_LANDING.tilt) {
      f.landed = 1; this.toast(`🎯 LANDED at ${sp.toFixed(1)} m/s, ${tilt.toFixed(0)}° tilt`, '#7dffa6'); this.call('sound', 'landed');
      this.parked = { ef: V.norm(V.rotZ(v.r, v.earthRot ? -P.OMEGA_E * v.clock : 0)), lift: v.tel.ycom };
      this.endQueued = true; this.call('end', 3000, () => !this.ended);
    } else this.fail(`hit the ground at ${sp.toFixed(0)} m/s${tilt > SAFE_LANDING.tilt ? `, ${tilt.toFixed(0)}° from upright` : ''}`, 'ground');
  }
  // Start the flight from a given state (Academy lessons): altitude h, vertical/horizontal speed relative to the air,
  // attitude 'up' | 'prograde' | 'retrograde', which stage is active, optional fuel (t) for that stage.
  placeState({ h, vUp = 0, vEast = 0, stage = this.v.cur, att = 'up', fuel = null, sas = 'stab' }) {
    const v = this.v; this.ignited = true; this.flags.liftoff = 1; this.flags.fairing = 1; this.ascent = false;
    while (v.cur < stage) v.cur++;
    v.fairing = 0; v._g = null; v.clamped = false; this.met = 600; v.ut = 0; v.throttle = 0;
    if (fuel !== null) v.stages[v.cur].fuel = Math.min(fuel, v.stages[v.cur].fuelMax);
    const r = R + h, th = 0.3, up = [Math.cos(th), Math.sin(th), 0], east = [-Math.sin(th), Math.cos(th), 0], w = v.earthRot ? P.OMEGA_E : 0;
    v.r = V.scale(up, r); v.v = V.add(V.scale(up, vUp), V.scale(east, vEast + w * r));
    const air = V.norm(V.add(V.scale(up, vUp), V.scale(east, vEast)));
    v.q = att === 'up' ? P.padAttitude(up) : P.V.qFromTo([0, 1, 0], att === 'prograde' ? air : V.scale(air, -1));
    v.w = [0, 0, 0]; v.clock = v.clock || 600; v.sas = sas; v.sasHold = null;
    P.stepVehicle(v, 0); return this;
  }
  // Start in an orbit with periapsis pe and apoapsis ap (m), at periapsis, nose prograde (Academy lessons 6-8).
  placeOrbit(pe, ap, stage = this.lastPow) {
    this.placeInOrbit(pe, stage); const v = this.v, r = R + pe, a = R + (pe + ap) / 2, vp = Math.sqrt(P.MU * (2 / r - 1 / a));
    v.v = V.scale(V.norm(v.v), vp); P.stepVehicle(v, 0); this.flags.orbit = P.orbitOf(v).pe > P.ORBIT_PE ? 1 : 0; this.ascent = false; return this;
  }
  // Put the vehicle straight into a circular-ish orbit at altitude h (tests and the ?scenario=orbit start).
  placeInOrbit(h = 170000, stage = this.lastPow) {
    const v = this.v; this.ignited = true; this.flags.liftoff = 1; this.flags.space = 1; this.flags.orbit = 1; this.flags.cutoff = 1; this.flags.fairing = 1;
    while (v.cur < stage) { const d = P.makeBooster(v); v.cur++; }
    v.fairing = 0; v._g = null; v.clamped = false; this.met = 600; v.ut = 0; v.throttle = 0; this.endQueued = true;
    const r = R + h, vc = Math.sqrt(P.MU / r), th = 0.3; v.r = [r * Math.cos(th), r * Math.sin(th), 0]; v.v = [-vc * Math.sin(th), vc * Math.cos(th), 0];
    v.q = P.V.qFromTo([0, 1, 0], V.norm(v.v)); v.w = [0, 0, 0]; v.clock = v.clock || 600; v.sas = 'prograde'; this.ascent = false;
    P.stepVehicle(v, 0); return this;
  }
  // ---------- warp ----------
  canWarpToAp() {
    const v = this.v, h = this.alt, vr = V.dot(v.v, V.norm(v.r));
    if (this.flags.dead || this.flyingBooster() || this.flags.orbit || !this.ignited) return false;
    if (this.autoOn) return h > 3000 && vr > 0 && (v.guid === 'coast' || v.guid === 'ascent');
    return v.thrust <= 0 && vr > 20 && h > 20000;
  }
  startAutoWarp() {
    if (this.flyingBooster()) { this.toast('Land the booster first!', '#ffb35c'); return false; }
    if (!this.canWarpToAp()) { this.toast(this.autoOn ? 'Warp to Ap: wait until AUTO is climbing toward apoapsis' : 'Warp to Ap: cut engines and coast upward first (above 20 km)', '#ffb35c'); return false; }
    this.autoWarp = true; this.toast(this.autoOn ? 'Warping to apoapsis — AUTO will circularize' : 'Warping to apoapsis…', '#9cc3ff'); return true;
  }
  setWarp(i, quiet) { this.warpI = Math.max(0, Math.min(WARPS.length - 1, i)); if (!quiet) this.toast('Time warp ×' + WARPS[this.warpI], '#9cc3ff'); }
  // Coasting outside the air with nothing commanding the craft: exact Kepler "rails", any warp.
  railsOK() {
    const v = this.v, b = this.booster, inp = v.input || {};
    if (!this.ignited || this.flags.dead || v.clamped || this.alt < P.RAILS_ALT) return false;
    if (b && b.state === 'flying') return false;
    if (this.autoOn && v.guid !== 'done' && v.guid !== 'coast') return false;
    if (this.ret && this.ret.phase !== 'coast') return false;
    if (this.parked) return false;
    if (v.ut > 0 && v.stages[v.cur].fuel > 0 && !(this.autoOn && (v.guid === 'done' || v.guid === 'coast'))) return false;
    if (inp.pitch || inp.yaw || inp.roll || (v.trans || []).some(Boolean)) return false;
    return true;
  }
  warpLimit() {
    const v = this.v, h = this.alt;
    if (!this.ignited || this.flags.dead) return [1, ''];
    if (this.flyingBooster()) return [1, 'flying booster'];
    if (this.parked) return [1, ''];
    if (this.ret && this.ret.phase === 'entry' && h < 60000) return [v.chute.state === 'main' ? 10 : 4, 'reentry'];
    if (h < ATM && v.thrust > 0) return [4, 'engines on in the air'];
    if (v.thrust > 0 && this.autoWarp) return [4, 'burning'];
    if (this.railsOK()) return [WARPS[WARPS.length - 1], ''];
    if (h < P.RAILS_ALT) return [50, 'below 140 km'];
    return [50, v.thrust > 0 ? 'burning' : 'controls active'];
  }
  effWarp() { return Math.min(WARPS[this.warpI], this.warpLimit()[0]); }
  updateAutoWarp() {
    if (!this.autoWarp) return;
    const v = this.v;
    if (this.flags.dead || this.flyingBooster() || this.flags.orbit) { this.autoWarp = false; this.setWarp(0, true); return; }
    if (!this.autoOn && v.thrust > 0) { this.autoWarp = false; this.setWarp(0, true); return; }
    const tAp = P.timeToApV(v), lead = (this.autoOn ? P.burnTimeFor(v, P.circBurn(v).dv) * 0.5 : 0) + 20;
    const vr = V.dot(v.v, V.norm(v.r));
    if (v.guid === 'circ' || vr <= 0 || tAp <= lead) {
      this.autoWarp = false; this.setWarp(0, true);
      if (this.autoOn) this.toast('At apoapsis — AUTO circularizing', '#ffd23a'); else this.toast('At apoapsis — BURN prograde! (SAS prograde + Z)', '#ffd23a');
      this.call('sound', 'beep', 1000);
    } else { const left = (tAp - lead) / SIM_SPEED; this.setWarp(left > 200 ? 6 : left > 60 ? 5 : left > 25 ? 4 : left > 8 ? 3 : 2, true); }
  }
  advance(rdt) {
    this.realT += rdt; this.updateAutoWarp();
    const W = this.effWarp(), simDt = rdt * SIM_SPEED * W;
    this.rails = W > 1 && this.railsOK();
    if (this.rails) {
      // never let one rails jump carry the craft deep below the rails altitude (deorbit coast)
      const pr = P.propagate(this.v.r, this.v.v, simDt);
      if (V.len(pr.r) - R > P.RAILS_ALT - 3000) { P.railsStep(this.v, simDt); this.met += simDt; this.postStep(); this.updateReturn(simDt); return simDt; }
      this.rails = false; this.setWarp(Math.min(this.warpI, 5), true);
    }
    const W2 = this.rails ? W : Math.min(W, 50), simDt2 = rdt * SIM_SPEED * W2;
    const step = W2 > 4 ? PHYS_DT * 2 : PHYS_DT, N = Math.ceil(simDt2 / step - 1e-9);
    for (let i = 0; i < N; i++) this.step(simDt2 / N);
    return simDt2;
  }
  // ---------- one physics step ----------
  step(dt) {
    const v = this.v, f = this.flags;
    if (this.parked) { // recovered capsule: rides the turning Earth
      v.clock += dt; const th = v.earthRot ? P.OMEGA_E * v.clock : 0; v.r = V.rotZ(V.scale(this.parked.ef, R + this.parked.lift), th); v.v = [-(v.earthRot ? P.OMEGA_E : 0) * v.r[1], (v.earthRot ? P.OMEGA_E : 0) * v.r[0], 0]; v.w = [0, 0, 0];
      if (v.tel) { v.tel.q = 0; v.tel.heat = 0; v.tel.vAir = 0; v.tel.gload = 1; }
      return;
    }
    if (this.ret) this.updateReturn(dt);
    if (!f.dead) {
      if (!this.ignited) { v.throttle = 0; v.steerDir = null; }
      else if (this.ret) { v.throttle = v.cur <= this.lastPow ? v.ut : 0; if (!this.ret.auto) v.steerDir = null; }
      else if (this.autoOn && !v.clamped) {
        const gd = P.autoGuide(v); v.steerDir = gd.dir;
        if (gd.phase === 'done' && v.ut > 0) { v.ut = 0; if (!f.cutoff) { f.cutoff = 1; this.toast('AUTO cutoff — orbit reached', '#7dffa6'); } }
        v.throttle = v.auto ? gd.throttle : this.autoThrottle ? Math.min(v.ut, gd.throttle) : v.ut;
        if (v.cur < this.lastPow && v.stages[v.cur].fuel <= 0 && this.canStage()) { this.toast(v.cur === 0 ? 'AUTO: booster empty, staging' : `AUTO: stage ${v.cur + 1} empty, staging`, '#9cc3ff'); this.stage(); }
      } else { v.throttle = this.autoOn ? Math.min(v.ut, P.qCap(v.tel ? v.tel.q : 0)) : v.ut; if (!this.autoOn) v.steerDir = null; }
      if (v.clamped) v.steerDir = null;
      this.updateChute(dt);
      P.updateControl(v);
      const st = v.stages[v.cur], m0 = P.massOf(v);
      const e = P.stepVehicle(v, dt), h = this.alt, tel = v.tel;
      if (this.ret && tel.gload > this.maxGret) this.maxGret = tel.gload;
      if (this.ret && !f.reentry && h < 100000 && tel.heat > 1000) f.reentry = 1;
      if (v.thrust > 0 && !v.clamped) this.dvUsed += v.thrust / m0 * dt;
      // Max-Q is an ascent figure: reentry and falling back are tracked separately (maxQEntry)
      if (this.ascent && (this.ret || (f.space && V.dot(v.v, V.norm(v.r)) < 0) || f.orbit)) this.ascent = false;
      if (this.ascent) { if (tel.q > this.maxQ) this.maxQ = tel.q; } else if (tel.q > this.maxQEntry) this.maxQEntry = tel.q;
      if (!v.clamped && tel.gload > this.maxG) this.maxG = tel.gload;
      if (!v.clamped && !f.liftoff) { f.liftoff = 1; this.met = 0; this.toast('LIFTOFF!', '#fff'); }
      if (f.liftoff) this.met += dt;
      const capsule = v.cur > this.lastPow || !(v.stages[v.cur].eng && v.stages[v.cur].eng.tv > 0);
      if (capsule && !v.clamped && (h - tel.ycom <= 0 || e === 'ground')) this.touchdown(tel.vAir);
      else if (!v.clamped && f.liftoff && this.met > 8 && (h - tel.ycom <= 0 || e === 'ground')) this.landing(tel.vAir);
      else if (e === 'ground') this.fail(this.met < 8 ? 'never cleared the tower' : 'hit the ground', 'ground');
      else {
        this.checkHeat();
        if (tel.q > QMAX * (capsule ? 2 : 1)) this.fail('over-pressure (Max-Q too high)', 'overq');
        else if (tel.q * Math.min(tel.aoa, Math.PI - tel.aoa) > QALPHA_MAX) { // off-axis angle: flying base-first (a capsule) is axial load
          if (v.cur > 0 && V.dot(v.v, V.norm(v.r)) < 0) this.fail('upper stage fell back into the atmosphere and broke up', 'fellback');
          else this.fail(tel.aoa > 1.2 ? 'tumbled and broke up (aerodynamically unstable)' : 'aerodynamic breakup — too much angle of attack at high Q', tel.aoa > 1.2 ? 'tumble' : 'breakup');
        }
        if (v.clamped && this.ignited && v.throttle > 0.95) { f.padTime += dt; if (f.padTime > 6 || (st && st.fuel <= 0)) this.fail('too heavy to lift off (TWR < 1)', 'twr'); }
        if (!f.mach1 && tel.mach > 1 && h < 30000) { f.mach1 = 1; this.toast('Mach 1 — supersonic', '#9cc3ff'); }
        if (!f.highQ && tel.q > 30000 && v.thrust > 0) { f.highQ = 1; this.toast(this.autoOn ? 'HIGH Q — AUTO is throttling down' : 'HIGH Q — throttle down (S)!', '#ffb35c'); }
        if (!f.maxq && this.maxQ > 8000 && tel.q < this.maxQ * 0.8) { f.maxq = 1; if (!this.ret) this.toast(`Max-Q passed (${(this.maxQ / 1000).toFixed(1)} kPa)`, '#9cc3ff'); }
        if (!f.fairing && h > P.FAIRING_ALT && (tel.heat < P.FAIRING_QDOT || h > P.FAIRING_ALT_MAX)) this.jettison();
        if (v.thrust > 0 && !v.clamped) {
          const pitch = Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.norm(v.r)))));
          if (h < 40000 && pitch > 1.2 && !f.orbit) f.flatLow += dt;
          if (h > 15000 && h < ATM && pitch < 0.35 && !f.orbit) f.steep += dt;
        }
        this.postStep();
      }
    }
    const b = this.booster;
    if (b && b.state === 'flying') {
      const n = Math.max(1, Math.ceil(dt / (1 / 50) - 1e-9));
      for (let i = 0; i < n && b.state === 'flying'; i++) this.stepBooster(b, dt / n);
    }
    if (!this.ended && !f.dead && f.orbit && v.thrust <= 0 && (!b || b.state !== 'flying') && !this.endQueued && !this.ret) {
      // a craft that can come home keeps flying: the mission ends at touchdown (or press R)
      if (this.rec.capsule && this.rec.shield && this.rec.chute) { if (!this.homeHint) { this.homeHint = 1; this.toast('Orbit! Press O to deorbit and bring the capsule home', '#ffd23a'); } }
      else { this.endQueued = true; this.call('end', 2500, () => !f.dead); }
    }
  }
  postStep() {
    const v = this.v, f = this.flags, h = this.alt;
    f.maxAlt = Math.max(f.maxAlt, h);
    if (!f.space && h > P.KARMAN) { f.space = 1; this.toast('🌌 SPACE! Kármán line (100 km) +1000', '#b98cff'); this.call('sound', 'beep', 1200); }
    const o = P.orbitOf(v);
    if (h > ATM && !f.orbit && o.pe > P.ORBIT_PE) { f.orbit = 1; this.toast('🛰️ ORBIT ACHIEVED! +3000', '#7dffa6'); this.call('sound', 'orbit'); }
    if (!f.orbit && !f.stranded && v.cur >= this.lastPow && (v.cur > this.lastPow || v.stages[v.cur].fuel <= 0) && !this.ret) {
      f.stranded = 1; f.apAtOut = o.ap; f.peAtOut = o.pe; f.cause = this.diagnose();
      if (this.rec.capsule && this.rec.chute) this.toast('Out of fuel — suborbital. Press O to separate the capsule and ride it home', '#ffb35c');
      else { this.toast('Out of fuel — suborbital', '#ffb35c'); this.call('end', 2500, () => !f.orbit); }
    }
  }
  stepBooster(b, dt) {
    const bh0 = V.len(b.r) - R;
    if (b.manual) {
      const va = P.airVel(b, b.r, b.v);
      if (b.retro && V.len(va) > 3) { const tgt = V.norm(V.scale(va, -1)), ax = V.cross(b.dir, tgt), s = V.len(ax), ang = Math.atan2(s, V.dot(b.dir, tgt)), rate = 1.2 * dt; if (s > 1e-9) b.dir = V.norm(V.qrot(V.qAxisAngle(ax, Math.min(ang, rate)), b.dir)); }
      const inp = b.input || {}, up = V.norm(b.r), east = P.eastOf(b.r), north = V.cross(up, east);
      if (inp.pitch) b.dir = V.norm(V.qrot(V.qAxisAngle(north, -inp.pitch * 0.7 * dt), b.dir));
      if (inp.yaw) b.dir = V.norm(V.qrot(V.qAxisAngle(up, -inp.yaw * 0.7 * dt), b.dir));
      b.throttle = b.stages[0].fuel > 0 ? b.ut : 0; b.n = bh0 > 12000 ? Math.min(3, b.nMax) : 1;
      b.phase = b.throttle > 0 ? 'burning' : 'falling';
    } else P.boosterAutopilot(b);
    const e = P.stepPoint(b, dt);
    const bh = V.len(b.r) - R, sp = V.len(P.airVel(b, b.r, b.v)); b.maxH = Math.max(b.maxH, bh);
    if (burnedUp(b, bh, sp)) { b.state = 'lost'; this.flags.booster = 'burned up on reentry (do an entry burn)'; this.call('boosterLost', b, true); this.toast('Booster burned up', '#ff6262'); return; }
    const ship = this.ship;
    if (ship && !b.manual && bh < 9000 && !ship.moved) { // the droneship repositions under the falling booster
      ship.ef = V.norm(V.rotZ(b.r, b.earthRot === false ? 0 : -P.OMEGA_E * b.clock)); ship.moved = true; this.call('shipMoved', ship);
    }
    if (b.state === 'flying') {
      const nearShip = ship && surfDist(b.r, shipPos(ship, b.clock, b.earthRot !== false)) < 40;
      if (e === 'ground' || (nearShip && bh < DECK)) this.landBooster(b, sp);
    }
  }
  landBooster(b, sp) {
    const f = this.flags, ship = this.ship, up = V.norm(b.r), tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(b.dir, up))));
    const dist = ship ? surfDist(b.r, shipPos(ship, b.clock, b.earthRot !== false)) : 1e9;
    b.throttle = 0; b.thrust = 0;
    let ok = false;
    if (b.maxH < 2000) { b.state = 'lost'; f.booster = 'lost (staged too low)'; }
    else if (b.manual) {
      if (sp < 8 && tilt < 0.25 && dist < 35) {
        ok = true; f.boosterBonus = 2500 + Math.round((35 - dist) * 25) + Math.round((8 - sp) * 80);
        f.booster = `landed by hand — ${dist.toFixed(1)} m off center at ${sp.toFixed(1)} m/s`; this.toast(`🎯 YOU LANDED IT! +${f.boosterBonus}`, '#7dffa6');
      } else { f.booster = sp < 8 && dist >= 35 ? `missed the droneship by ${(dist - 35).toFixed(0)} m` : sp < 8 ? 'tipped over (too tilted)' : `crashed at ${sp.toFixed(0)} m/s`; this.toast('Booster lost — ' + f.booster, '#ff6262'); }
    } else if (sp < 10) { ok = true; f.boosterBonus = 1000; f.booster = 'auto-landed on the droneship'; this.toast('🎯 BOOSTER AUTO-LANDED +1000', '#7dffa6'); }
    else { f.booster = `crashed at ${sp.toFixed(0)} m/s (needed more fuel: stage earlier)`; this.toast('Booster lost', '#ff6262'); }
    if (ok) { b.state = 'landed'; b.dir = up; this.call('boosterLanded', b); this.call('sound', 'landed'); }
    else { b.state = 'lost'; this.call('boosterLost', b, false); }
    // ride along with the rotating Earth from now on
    b.ef = V.norm(V.rotZ(b.r, b.earthRot === false ? 0 : -P.OMEGA_E * b.clock)); b.lift = ok && dist < 40 ? DECK : 0;
  }
  fail(reason, cause) {
    const f = this.flags; if (f.dead) return;
    f.dead = reason; f.cause = cause; this.v.throttle = this.v.ut = 0; this.autoWarp = false; this.warpI = 0;
    this.call('fail', reason); this.toast('RUD — ' + reason, '#ff6262'); this.call('end', 2800, () => true);
  }
  diagnose() {
    const f = this.flags, s = this.stats, o = P.orbitOf(this.v);
    if (s.total < ORBIT_DV + 200) return 'dv';
    if (f.stagedFuel !== null && f.stagedFuel > 0.35 * this.v.stages[0].fuelMax) return 'staged-early';
    if (f.flatLow > 25 && f.flatLow >= f.steep) return 'flat';
    if (f.steep > 40) return 'steep';
    if (isFinite(o.ap) && o.ap > ATM) return 'circ';
    return 'dv-margin';
  }
  advice() {
    const f = this.flags, pe = isFinite(f.peAtOut) ? (f.peAtOut / 1000).toFixed(0) : '?';
    const ADV = {
      dv: `This rocket only has ${this.stats.total.toFixed(0)} m/s of Δv; reaching orbit costs ~${ORBIT_DV.toLocaleString()} m/s (7.8 km/s orbital speed plus gravity and drag losses). Add fuel, use a Lark on the upper stage, or a lighter payload.`,
      'staged-early': `You staged with ${(f.stagedFuel || 0).toFixed(1)} t still in the booster — that fuel was needed to reach orbit. Stage later or add booster fuel.`,
      flat: `The climb was too flat: ${f.flatLow.toFixed(0)} s burning nearly sideways below 40 km, fighting drag. Turn more gently (or use AUTO, F).`,
      steep: `The climb was too steep: ${f.steep.toFixed(0)} s burning nearly straight up above 15 km wastes fuel on gravity. Lean east sooner (or use AUTO, F).`,
      circ: 'Apoapsis was high enough, but the circularization ran dry. Coast to apoapsis first (G), then burn prograde — or let AUTO do it.',
      'dv-margin': 'Just short of orbit. Try AUTO (F), a little more upper-stage fuel, or the Recommended build.',
    };
    return `Ran out of fuel before orbit (Pe ${pe} km). ${ADV[f.cause] || ADV['dv-margin']}`;
  }
  score() {
    if (this.finalScore !== null) return this.finalScore;
    const f = this.flags, v = this.v; let s = 0, mult = v.mult || 1; const snap = this.orbitSnap, o = snap ? snap.o : P.orbitOf(v), top = v.stages[Math.min(this.lastPow, v.stages.length - 1)];
    const fuelLeft = snap ? snap.fuel : top.fuelMax > 0 ? top.fuel / top.fuelMax : 0;
    s += Math.min(f.maxAlt || 0, ATM) / 100;
    if (f.space) s += 1000;
    if (f.orbit) { s += 3000; if (isFinite(o.ap)) s += Math.max(0, 1500 - Math.abs(o.ap - o.pe) / 100); s += fuelLeft * 800; }
    if (f.recovered) s += 4000;
    s *= mult; s += f.boosterBonus; if (f.dead) s *= 0.5;
    return Math.round(s);
  }
  finish() { if (!this.ended) { this.finalScore = this.score(); this.ended = true; this.autoWarp = false; this.warpI = 0; } return this.finalScore; }
  unfinish() { this.ended = false; this.finalScore = null; this.endQueued = false; }
  hint() {
    const v = this.v, f = this.flags, b = this.booster, h = this.alt, sp = V.len(v.v), vr = V.dot(v.v, V.norm(v.r)), tel = v.tel || {};
    const o = P.orbitOf(v), engineOn = v.thrust > 0, s1 = v.stages[0], cs = v.stages[v.cur], fuelLeft = v.stages.slice(v.cur).reduce((t, x) => t + x.fuel, 0);
    if (f.dead) return 'Press R to go back to the hangar';
    if (f.recovered) return 'Welcome home! Press R for the hangar';
    if (this.ret) {
      const R0 = this.ret, c = v.chute;
      if (R0.phase === 'align') return 'Turning retrograde for the deorbit burn…';
      if (R0.phase === 'burn') return `DEORBIT BURN — Pe ${(o.pe / 1000).toFixed(0)} km → ${DEORBIT_PE / 1000} km`;
      if (R0.phase === 'sep') return this.rec.capsule ? 'Separating the capsule from the service stage…' : 'Coasting down';
      if (R0.phase === 'coast') return `Coasting to entry interface (120 km) — ${fmtKm(h)}${R0.auto ? ' · warping' : ''}`;
      if (c.state === 'failed') return 'Parachutes gone — brace for impact';
      if (h > 40000) return tel.heat > 20000 ? `REENTRY: shield first (SAS retrograde) — ${(tel.heat / 1000).toFixed(0)} kW/m², shell ${tel.Tskin.toFixed(0)} K` : 'Entering the atmosphere — keep the heat shield facing the airflow (SAS 3)';
      if (c.state === 'stowed') return this.hasChute() ? (R0.armed ? `Parachutes armed: drogues below ${CHUTE_AUTO.drogueAlt / 1000} km under Mach ${this.chuteSpec().drogue.machMax} (P to deploy now)` : 'P: deploy drogues (below Mach 1.2 and 15 kPa)') : 'No parachutes on this craft!';
      if (c.state === 'drogue') return R0.armed ? `Drogues out — mains below ${CHUTE_AUTO.mainAlt / 1000} km under ${this.chuteSpec().main.vMax} m/s` : `Drogues out — P for mains under ${this.chuteSpec().main.vMax} m/s`;
      return `Under main chutes — ${tel.vAir.toFixed(1)} m/s, touchdown ≤ ${SAFE_TOUCHDOWN} m/s is safe`;
    }
    if (this.flyingBooster()) {
      const bh = V.len(b.r) - R, bsp = V.len(P.airVel(b, b.r, b.v)), bd = b.miss ?? 0;
      if (b.stages[0].fuel <= 0) return 'Out of fuel… brace!';
      if (bh > 30000 && bsp > 1100) return 'ENTRY BURN: F = hold retrograde, Z = full throttle until under 1,000 m/s';
      if (bh > 4000) return Math.abs(bd) > 300 ? `Predicted miss ${(Math.abs(bd) / 1000).toFixed(1)} km: tilt with W/S/A/D + small throttle` : 'On target! Coast (X), hold retrograde (F), landing burn low down';
      return 'LANDING BURN: Shift/Ctrl throttle to ~5 m/s at touchdown. Keep it upright (F)';
    }
    if (!this.ignited) return '';
    if (v.clamped) return 'Not enough thrust… lighten the rocket';
    if (tel.q > 30000 && engineOn) return this.autoOn ? 'HIGH Q — AUTO is throttling down' : 'HIGH Q — throttle down (Ctrl)';
    if (!this.autoOn && h < 8000 && sp < 900) return 'Press F for AUTO (flies all the way to orbit), or pitch east yourself with W (SAS holds your heading)';
    if (v.cur < this.last && cs.fuel <= 0) return v.cur === 0 ? 'Booster empty — SPACE twice to stage!' : `Stage ${v.cur + 1} empty — SPACE twice to stage!`;
    if (v.cur === 0 && this.last > 0 && h > 20000) return this.boosterCanLand() ? `SPACE twice to stage — booster has ${s1.fuel.toFixed(1)} t, enough to land` : `⚠ Booster ${s1.fuel.toFixed(1)} t: no longer enough to land it — stage soon (SPACE twice)`;
    if (fuelLeft <= 0 && !f.orbit) return 'Out of fuel — suborbital';
    if (f.orbit && !engineOn && this.rec.capsule && this.rec.chute && (!b || b.state !== 'flying')) return 'In orbit 🛰️ — press O to deorbit and bring the capsule home';
    if (f.orbit) return engineOn ? 'In orbit! Cut throttle (X)' : b && b.state === 'flying' ? 'Orbit! Watch the booster: B · fly it: Y' : 'Orbit achieved 🛰️';
    if (v.auto) return 'Upper stage on AUTO (flying to orbit) — press Z/X/F or steer to take over';
    if (this.autoOn) {
      const tAp = P.timeToApV(v);
      if (v.guid === 'circ') return 'AUTO circularizing at apoapsis — burning until Pe > 150 km';
      if (v.guid === 'coast') return `AUTO coasting to apoapsis (${Math.round(tAp / SIM_SPEED)} s) — press G to warp there`;
      return 'AUTO flying the gravity turn' + (v.cur === 0 ? ' — stage (SPACE twice) while the booster still has landing fuel (see hangar)' : '');
    }
    if (engineOn && isFinite(o.ap) && o.ap > 170000 && h < ATM - 10000) return 'Ap is high enough — cut throttle (X) and coast';
    if (!engineOn && h < ATM && vr > 0) return h > 20000 ? 'Coasting — press "Warp to Ap" (G)' : 'Coasting…';
    if (h > ATM - 5000 || (!engineOn && vr <= 20)) return vr > 60 && !engineOn ? 'Warp to Ap (G), then burn prograde (SAS 2)' : engineOn ? 'Burn until Pe > 130 km' : 'Burn now! F (AUTO) or Z (full throttle)';
    return '';
  }
}
