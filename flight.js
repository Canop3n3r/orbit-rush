// Orbit Rush flight logic: one flight from the pad to the end screen, with no DOM or rendering, so the
// browser game (main.js) and the headless tests (tests/*.mjs) run exactly the same rules on the
// full-scale 6-DOF physics (physics.js). main.js passes hooks for sounds, toasts and visuals.
import * as P from './physics.js?v=f5';
import * as C from './physics/patched.js?v=f5';
import { TEMPLATES, PARTS, buildVehicle, designStats, validate, cloneDesign, recoveryInfo, ORBIT_DV } from './parts.js?v=f5';
const { R, ATM, V } = P;
export const BOOSTER_WARP = 10;              // f1: max warp while a booster is flying back
export const SIM_SPEED = 2;                 // game time runs 2x real time; warp multiplies on top
export const WARPS = [1, 2, 4, 10, 25, 50, 100, 1000, 1e4, 1e5, 1e6, 1e7];
export const STAGE_CONFIRM_S = 2;           // second SPACE within this many real seconds confirms staging
export const QALPHA_MAX = 12000;            // Pa·rad: structural limit on dynamic pressure × angle of attack
export const QMAX = 80000;                  // Pa: over-pressure limit
export const PHYS_DT = 0.02;                // s: fixed physics step (RK4) at low warp
export const PRESETS = TEMPLATES;
export const DEORBIT_PE = 45000;            // m: AUTO deorbit burn lowers periapsis to this (deep enough to be captured)
export const SAFE_TOUCHDOWN = 12;           // m/s: capsule touchdown speed the crew (and the pod) survive
export const CHUTE_AUTO = { drogueAlt: 11000, mainAlt: 4000 };
// Per-body goals (Milestone A): first flyby (entering the SOI), first orbit, first landing — points × tier.
export const GOAL_TIER = { moon: 1, mars: 2.5, venus: 2.5, mercury: 3, phobos: 3, deimos: 3, jupiter: 4, io: 5, europa: 5, ganymede: 5, callisto: 5, saturn: 5, titan: 6, enceladus: 6, uranus: 7, neptune: 8, triton: 9, pluto: 10, charon: 10, sun: 2 };
export const GOAL_PTS = { flyby: 1500, orbit: 3000, landed: 6000 };
export const NODE_LEAD = 90; // s: time warp stops this long before a node's burn starts (half the burn before the node)
// Game clock epoch: ?epoch=YYYY-MM-DD or now. The Earth frame's x axis is set so the pad (on frame +x at clock 0)
// sees the Sun 45° east of the zenith: a mid-morning launch.
export function epochPhase(t0) { P.setEarthPhase(0); const s = P.sunDir('earth', t0); P.setEarthPhase(Math.atan2(s[1], s[0]) - Math.PI / 4); return P.earthPhase(); }
// Launch azimuth (rad from north, measured in the rotating frame) for a target inclination i (deg) from latitude lat.
export function launchAzimuth(incDeg, lat = 0, vEq = P.OMEGA_E * P.R, vOrb = 7800) {
  const i = incDeg * Math.PI / 180, sA = Math.max(-1, Math.min(1, Math.cos(i) / Math.max(1e-6, Math.cos(lat)))), A = Math.asin(sA);
  return Math.atan2(vOrb * Math.sin(A) - vEq, vOrb * Math.cos(A));
}
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
const LZ2_EF = (() => { const a = 1600 / 6371000, b = 420 / 6371000, n = Math.hypot(1, a, b); return [1 / n, b / n, a / n]; })(); // f4.2: LZ-2, 420 m east of LZ-1
const DECK = 3, PAD_EF = [1, 0, 0], LZ_EF = (() => { const a = 1600 / 6371000; return [Math.cos(a), 0, Math.sin(a)]; })(); // f4.1: landing zone 1.6 km north of the pad, clear of the tower and slab         // launch site on the equator (Earth-fixed unit vector)
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
    P.boosterAutopilot(b, dt); const e = P.stepPoint(b, dt); t += dt;
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
  if (s.analysis.stages[0].radial) return { minReserve: null, orbit: false, reason: 'radial' };
  const F = new Flight(design, {}, { earthRot: opts.earthRot }); F.autoStage = false; F.stagePress(); F.setAuto(true, true);
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
  F.stagePress(); F.setAuto(true, true); if (opts.reserve !== undefined || opts.autoStage === false) F.autoStage = false;
  // f1 ghost trajectory: downrange/altitude samples (km) + events, drawn by the hangar's "Will it fly?" panel
  const track = [], r0 = F.v.r.slice(), R0 = Math.hypot(...r0); let tNext = 0, lastCur = F.v.cur;
  const sample = (t, ev) => { const r = F.v.r, c = (r[0] * r0[0] + r[1] * r0[1] + r[2] * r0[2]) / (Math.hypot(...r) * R0); track.push([+(Math.acos(Math.max(-1, Math.min(1, c))) * R0 / 1000).toFixed(2), +(F.alt / 1000).toFixed(2), +t.toFixed(1), ev || 0]); };
  for (let t = 0; t < (opts.tMax || 2400); t += dt) {
    F.realT += dt;
    if (t >= tNext || F.v.cur !== lastCur) { sample(t, F.v.cur !== lastCur ? 'stage' : 0); lastCur = F.v.cur; tNext = t + (F.alt < 20000 ? 2 : 6); }
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
  sample(Math.min(opts.tMax || 2400, F.met || 0), F.flags.dead ? 'boom' : F.flags.orbit ? 'orbit' : 'end');
  const o = P.orbitOf(F.v);
  return { F, track, orbit: !!F.flags.orbit && !F.flags.dead, ap: o.ap, pe: o.pe, dead: F.flags.dead, stranded: !!F.flags.stranded,
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
  const r = simulateAuto(design, { dt: 1 / 20, earthRot: opts.earthRot }), track = r.track;
  const res = assessOutcome(r); res.track = track; res.cause = r.cause || null; return res;
}
function assessOutcome(r) {
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
export const fmtDur = s => { s = Math.max(0, s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${String(ss).padStart(2, '0')}s`; };

export class Flight {
  constructor(design, hooks = {}, opts = {}) {
    this.recovery = opts.recovery || design.recovery || 'ship'; // f4: 'rtls' = boostback to the landing zone at the launch site
    if (typeof opts === 'number') opts = { padZ: opts };
    this.design = cloneDesign(design); this.h = hooks; this.stats = designStats(design);
    const v = buildVehicle(design); v.earthRot = opts.earthRot !== false;
    v.site = { ef: PAD_EF, lift: (opts.padZ ?? 0.4) + P.massProps(v).ycom, q0: P.padAttitude(PAD_EF) }; // r is the centre of mass
    const s0 = P.siteAt(v, 0); v.r = s0.r; v.v = s0.v; v.q = s0.q; v.clock = 0; v.ut = 0; v.auto = false; v.sas = 'stab';
    this.v = v; this.booster = null; this.boosters = []; this.ship = null; this.dvUsed = 0;
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
    // solar system: game clock epoch, SOI body, nodes, alarms, target, per-body goals
    this.t0 = opts.t0 ?? P.tFromDate(opts.epoch ?? Date.now()); epochPhase(this.t0); v.body = 'earth';
    this.nodes = []; this.alarms = []; this.target = opts.target || null; this.goals = {}; this.warpTarget = null; this.exec = false; this.deep = !!(design.goal || opts.deep);
    if (opts.incl) v.incl = +opts.incl;
  }
  get tAbs() { return this.t0 + (this.v.clock || 0); }
  get body() { return this.v.body || 'earth'; }
  goal(id, kind) {
    const g = this.goals[id] || (this.goals[id] = {}); if (g[kind]) return false; g[kind] = this.tAbs;
    const pts = Math.round(GOAL_PTS[kind] * (GOAL_TIER[id] || 1)), nm = P.BODIES[id].name;
    this.toast(kind === 'flyby' ? `🌑 ${nm.toUpperCase()} FLYBY — entering its sphere of influence +${pts}` : kind === 'orbit' ? `🛰️ ORBIT AROUND ${nm.toUpperCase()} +${pts}` : `🎯 LANDED ON ${nm.toUpperCase()} +${pts}`, '#7dffa6');
    this.call('sound', kind === 'flyby' ? 'beep' : 'orbit', 1300); return true;
  }
  goalScore() { let s = 0; for (const [id, g] of Object.entries(this.goals)) for (const k of Object.keys(g)) s += GOAL_PTS[k] * (GOAL_TIER[id] || 1); return Math.round(s); }
  // Patched conics: move the craft into body `to`'s frame (position, velocity and attitude), drop the warp.
  switchBody(to) {
    const v = this.v, from = this.body; if (to === from) return false;
    const t = this.tAbs, tr = P.transfer(from, to, v.r, v.v, t), Fa = P.frameOf(from), Fb = P.frameOf(to);
    const rot = x => { const e = [Fa[0] * x[0] + Fa[1] * x[1] + Fa[2] * x[2], Fa[3] * x[0] + Fa[4] * x[1] + Fa[5] * x[2], Fa[6] * x[0] + Fa[7] * x[1] + Fa[8] * x[2]];
      return [Fb[0] * e[0] + Fb[3] * e[1] + Fb[6] * e[2], Fb[1] * e[0] + Fb[4] * e[1] + Fb[7] * e[2], Fb[2] * e[0] + Fb[5] * e[1] + Fb[8] * e[2]]; };
    const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(e => rot(V.qrot(v.q, e)));
    v.q = V.qFromBasis(ax[0], ax[1], ax[2]); if (v.sasHold) v.sasHold = rot(v.sasHold);
    for (const n of this.nodes) if (n.dvVec) n.dvVec = rot(n.dvVec);
    v.r = tr.r; v.v = tr.v; v.body = to; v._g = null; this.autoWarp = false;
    const down = P.BODIES[from].parent === to;
    this.toast(down ? `Leaving ${P.BODIES[from].name}'s sphere of influence — now orbiting ${P.BODIES[to].name}` : `Entering ${P.BODIES[to].name}'s sphere of influence`, '#9cc3ff');
    if (!down) this.goal(to, 'flyby');
    // warping to a later node / alarm / time keeps going through the SOI change; plain warp stops here
    if (!this.warpTarget || this.warpTarget.kind === 'soi') { this.warpTarget = null; this.setWarp(Math.min(this.warpI, 0), true); }
    this._soiC = null; this.call('soi', from, to);
    P.stepVehicle(v, 0); return true;
  }
  checkSOI() { const nb = P.soiOf(this.body, this.v.r, this.tAbs); if (nb !== this.body) { this.switchBody(nb); return true; } return false; }
  // ---------- maneuver nodes: { t (game clock, absolute), pro, nrm, rad (m/s) } ----------
  addNode(n) { const node = { t: n.t, pro: n.pro || 0, nrm: n.nrm || 0, rad: n.rad || 0 }; this.nodes.push(node); this.nodes.sort((a, b) => a.t - b.t); return node; }
  removeNode(n) { const i = this.nodes.indexOf(n); if (i >= 0) this.nodes.splice(i, 1); if (!this.nodes.length) { this.exec = false; if (this.v.sas === 'node') this.v.sas = 'stab'; } }
  nodeBurnTime(n) { return P.burnTimeFor(this.v, C.nodeDv(n)); }
  // Δv still to do on the next node (vector, current body frame). Before the burn starts it tracks the predicted
  // state at the node time; once thrust is applied in the burn window it is the planned vector minus what was done.
  // Δv still to do on the next node (vector, current body frame). Before the burn it is the planned vector at the
  // predicted node state; during the burn the remaining prograde / normal / radial parts are re-expressed in the
  // current local frame (the burn follows the turning prograde direction, like the planner's impulsive model).
  // A node can sit on a later patch (after an SOI change, e.g. a capture burn at the Moon): until the craft is
  // in that patch its Δv direction is not defined in the current frame (null).
  nodeOnLaterPatch(n) {
    const v = this.v, c = this._soiC;
    if (!c || c.body !== this.body || Math.abs(c.t - this.tAbs) > 30 || c.nt !== n.t) {
      let ev = null; try { ev = C.nextEvent(this.body, v.r, v.v, this.tAbs, Math.max(1, n.t - this.tAbs + 1), { stopAlt: 0 }); } catch (e) { ev = null; }
      this._soiC = { body: this.body, t: this.tAbs, nt: n.t, soiT: ev && (ev.type === 'soi-exit' || ev.type === 'soi-enter') ? this.tAbs + ev.dt : Infinity };
    }
    return n.t > this._soiC.soiT + 1;
  }
  nodeRemaining(n = this.nodes[0]) {
    if (!n) return null; const v = this.v;
    if (!n.started && this.nodeOnLaterPatch(n)) { n.later = true; return null; }
    n.later = false;
    if (!n.started) { const s = P.propagate(v.r, v.v, n.t - this.tAbs, P.muOf(v)); n.dvVec = C.nodeVector(s.r, s.v, n); return n.dvVec; }
    const d = n.done || { pro: 0, nrm: 0, rad: 0 };
    return C.nodeVector(v.r, v.v, { pro: n.pro - d.pro, nrm: n.nrm - d.nrm, rad: n.rad - d.rad });
  }
  nodeLeft(n) { const d = n.done || { pro: 0, nrm: 0, rad: 0 }; return { pro: n.pro - d.pro, nrm: n.nrm - d.nrm, rad: n.rad - d.rad }; }
  updateNode(dt, m0) {
    const n = this.nodes[0], v = this.v; if (!n) { v.nodeDir = null; return; }
    if (n.t < this.tAbs - 3 * 86400 && !n.started) { this.removeNode(n); return; } // stale
    const bt = this.nodeBurnTime(n), inWin = this.tAbs >= n.t - bt / 2 - 60;
    if (v.thrust > 0 && !v.clamped && inWin && dt > 0) {
      if (!n.started) { n.started = true; n.done = { pro: 0, nrm: 0, rad: 0 }; }
      const f = C.nodeFrame(v.r, v.v), a = V.scale(P.noseOf(v), v.thrust / m0 * dt);
      n.done.pro += V.dot(a, f.pro); n.done.nrm += V.dot(a, f.nrm); n.done.rad += V.dot(a, f.rad);
    }
    const rem = this.nodeRemaining(n); v.nodeDir = rem && V.len(rem) > 1e-6 ? V.norm(rem) : null; if (!rem) return;
    const L = this.nodeLeft(n), left = Math.hypot(L.pro, L.nrm, L.rad), along = L.pro * n.pro + L.nrm * n.nrm + L.rad * n.rad;
    if (n.started && (left < 0.3 || along <= 0)) {
      this.toast(`Maneuver complete (${left.toFixed(1)} m/s left)`, '#7dffa6'); if (this.exec) { v.ut = 0; v.throttle = 0; }
      this.exec = false; this.removeNode(n); if (v.sas === 'node') v.sas = 'stab'; v.sasHold = null;
    }
  }
  // AUTO-execute the next node: point (SAS maneuver), warp to the burn start, burn with throttle-down at the end.
  setExec(on) {
    if (on && !this.nodes.length) { this.toast('No maneuver node — add one on the map', '#ffb35c'); return false; }
    this.exec = !!on; if (on) { this.v.sas = 'node'; this.v.sasHold = null; this.autoOn = false; this.v.auto = false; this.warpToNode(true); this.toast('Executing the maneuver: SAS MANEUVER, warp to the burn, burn', '#9cc3ff'); }
    else this.v.ut = 0; return true;
  }
  updateExec() {
    const n = this.nodes[0], v = this.v; if (!this.exec || !n) return;
    const L = this.nodeLeft(n), dv = Math.hypot(L.pro, L.nrm, L.rad), bt = 0, a = P.thrustAccel(v);
    const ang = v.nodeDir ? Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), v.nodeDir)))) : 1;
    const go = this.tAbs >= n.t - (n.started ? 1e9 : this.nodeBurnTime(n) / 2);
    if (!go) { v.ut = 0; if (!this.warpTarget && this.tAbs < n.t - this.nodeBurnTime(n) / 2 - NODE_LEAD - 5 && ang < 0.1) this.warpToNode(true); return; }
    if (this.warpTarget) this.warpTarget = null;
    v.ut = ang < 0.05 || (n.started && ang < 0.3) ? (a > 0 ? Math.max(0.05, Math.min(1, dv / (a * 2))) : 1) : 0;
    if (a <= 0 && v.stages[v.cur].fuel <= 0) { if (v.cur < this.lastPow && this.canStage()) this.stage(); else { this.toast('Out of fuel during the burn', '#ff6262'); this.exec = false; v.ut = 0; } }
    void bt;
  }
  // ---------- warp to a time (node, SOI change, Ap, Pe, alarm). The warp stops there; rails bound every jump. ----------
  warpTo(t, label, kind = 'time', quiet) {
    if (!(t > this.tAbs + 1)) { if (!quiet) this.toast('Nothing to warp to', '#ffb35c'); return false; }
    if (!this.railsOK()) { if (!quiet) this.toast('Warp: coast outside the atmosphere with engines off first', '#ffb35c'); return false; }
    this.warpTarget = { t, label, kind }; this.autoWarp = false; this.setWarp(WARPS.length - 1, true);
    if (!quiet) this.toast(`Warping to ${label} (${fmtDur(t - this.tAbs)})`, '#9cc3ff'); return true;
  }
  warpToNode(quiet) { const n = this.nodes[0]; if (!n) { this.toast('No maneuver node', '#ffb35c'); return false; } return this.warpTo(n.t - this.nodeBurnTime(n) / 2 - NODE_LEAD, 'the maneuver', 'node', quiet); }
  warpToSOI() {
    const v = this.v, ev = C.nextEvent(this.body, v.r, v.v, this.tAbs, 3e9, { stopAlt: 0 });
    if (!ev || (ev.type !== 'soi-exit' && ev.type !== 'soi-enter')) { this.toast('No SOI change ahead on this orbit', '#ffb35c'); return false; }
    return this.warpTo(this.tAbs + ev.dt + 1, ev.type === 'soi-enter' ? P.BODIES[ev.to].name + ' encounter' : 'the SOI exit', 'soi');
  }
  warpToApsis(which) {
    const v = this.v, mu = P.muOf(v), o = P.orbitOf(v);
    if (which === 'ap' && !isFinite(o.ap)) { this.toast('Escape trajectory: no apoapsis', '#ffb35c'); return false; }
    const dt = which === 'ap' ? P.timeToAp(v.r, v.v, mu) : C.timeToPe(v.r, v.v, mu);
    if (!isFinite(dt)) { this.toast('Orbit is circular', '#ffb35c'); return false; }
    return this.warpTo(this.tAbs + dt - 20, which === 'ap' ? 'apoapsis' : 'periapsis', which);
  }
  // The current stage as a burn model for the planner ({ T N, m0 kg, isp s }) — null without an engine.
  burnModel() { const v = this.v, s = v.stages[v.cur]; if (!s || !s.eng || !(s.eng.tv > 0) || !(s.fuel > 0)) return null; return { T: s.eng.tv * 1000 * s.n, m0: P.massOf(v) * 1000, isp: s.eng.ispVac }; }
  // Coast on rails to game time tEnd through every SOI change (scenarios, lessons and tests).
  coastTo(tEnd) {
    const v = this.v; for (let k = 0; k < 200 && this.tAbs < tEnd - 1e-6; k++) {
      const ev = C.nextEvent(this.body, v.r, v.v, this.tAbs, tEnd - this.tAbs, { stopAlt: 0 }), dt = ev ? ev.dt : tEnd - this.tAbs;
      P.railsStep(v, dt); this.met += dt; if (ev && (ev.type === 'soi-enter' || ev.type === 'soi-exit')) this.switchBody(ev.to); else if (ev) break;
    }
    P.stepVehicle(v, 0); this.postStep(); return this;
  }
  // Apply node n impulsively (coast to it, add its Δv) — for scenario starts, not for normal flight.
  applyNodeNow(n) { this.coastTo(n.t); const v = this.v; v.v = V.add(v.v, C.nodeVector(v.r, v.v, n)); this.dvUsed += C.nodeDv(n); this.removeNode(n); P.stepVehicle(v, 0); return this; }
  addAlarm(t, label) { const a = { t, label }; this.alarms.push(a); this.alarms.sort((a, b) => a.t - b.t); return a; }
  removeAlarm(a) { const i = this.alarms.indexOf(a); if (i >= 0) this.alarms.splice(i, 1); }
  fireAlarms() { for (const a of [...this.alarms]) if (a.t <= this.tAbs + 0.5) { this.removeAlarm(a); this.toast('⏰ Alarm: ' + a.label, '#ffd23a'); this.call('sound', 'beep', 880); if (this.warpI > 0) this.setWarp(0, true); this.warpTarget = null; } }
  // ---------- quicksave / quickload: the whole flight state as plain JSON (a flying booster is not kept) ----------
  snapshot() {
    const strip = (k, x) => (k === '_g' || k === '_rel' || k === '_scr' ? undefined : x);
    const keep = ['met', 'ignited', 'maxQ', 'maxQEntry', 'maxG', 'autoThrottle', 'ascent', 'dvUsed', 'flags', 'lastPow', 'orbitSnap', 'maxHeat', 'maxTskin', 'maxGret', 'parked', 't0', 'nodes', 'alarms', 'target', 'goals', 'deep', 'ship'];
    const f = {}; for (const k of keep) f[k] = this[k];
    return JSON.parse(JSON.stringify({ v: 1, design: this.design, at: Date.now(), body: this.body, tAbs: this.tAbs, veh: this.v, f }, strip));
  }
  loadSnapshot(s) {
    const v = JSON.parse(JSON.stringify(s.veh)); v._g = null; v.auto = false;
    this.v = v; Object.assign(this, JSON.parse(JSON.stringify(s.f)));
    this.booster = null; this.boosters = []; this.ret = null; this.autoOn = false; this.exec = false; this.warpTarget = null; this.warpI = 0; this.autoWarp = false; this.rails = false; this.ended = false; this.finalScore = null; this._soiC = null;
    for (const n of this.nodes) { n.started = false; delete n.done; }
    epochPhase(this.t0); P.stepVehicle(v, 0); return this;
  }
  // Ballistic impact prediction with drag (no thrust): { t (game time), r (body frame), speed, lat, lon } or null.
  // Coasts on rails to the top of the atmosphere, then integrates a point mass with this craft's drag.
  predictImpact() {
    const v = this.v, b = P.BODIES[this.body], o = P.orbitOf(v), top = P.atmTop(this.body), mu = P.muOf(v);
    if (!(o.rp < b.R + top) || v.clamped || this.parked) return null;
    let r = [...v.r], vel = [...v.v], t = 0;
    if (V.len(r) > b.R + top) { const dt = C.timeToRadius(r, vel, mu, b.R + top, -1); if (!isFinite(dt) || dt > 30 * 86400) return null; const st = P.propagate(r, vel, dt, mu); r = st.r; vel = st.v; t = dt; }
    const m = P.massOf(v), c = { body: this.body, r, v: vel, clock: (v.clock || 0) + t, earthRot: v.earthRot, stages: [{ dry: m, fuel: 0, eng: null }], throttle: 0, cdA: (v.cdA || 3) + (v.chuteCdA || 0), dir: P.noseOf(v), n: 0 };
    for (let i = 0; i < 40000; i++) { const h = V.len(c.r) - b.R, dt = h > 60000 ? 2 : h > 20000 ? 0.5 : 0.25; if (P.stepPoint(c, dt)) break; if (i === 39999) return null; }
    const tImp = c.clock - (v.clock || 0), w = this.body === 'earth' ? P.omegaOf(v) * c.clock : 0, ef = V.norm(V.rotZ(c.r, -w));
    return { t: this.tAbs + tImp, dt: tImp, r: c.r, speed: V.len(c.v), lat: Math.asin(Math.max(-1, Math.min(1, ef[2]))) * 180 / Math.PI, lon: Math.atan2(ef[1], ef[0]) * 180 / Math.PI };
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
    const v = this.v; if (v.cur !== 0 || v.stages[0].radial) return '';
    if (this.alt <= 2000) return ' (too low to recover the booster)';
    return this.boosterCanLand() ? '' : ` — booster has only ${v.stages[0].fuel.toFixed(1)} t: not enough to land`;
  }
  boosterCanLand() {
    const v = this.v; if (v.cur !== 0) return false;
    const key = Math.floor(this.met / 2);
    if (this._landKey !== key) { this._landKey = key; this._landOk = this.alt > 2000 && landsWith(v, v.stages[0].fuel); }
    return this._landOk;
  }
  // f4.2: a heavy's side pair flies home as two independent boosters (half the stage each), A to LZ-1 and B to LZ-2.
  // Each starts at its own side of the core (±lateral, the axis the side boosters sit on) with the core's velocity.
  splitBoosters(d) {
    const k = 1 / d.radial, st = d.stages[0], half = { ...st, parts: st.parts };
    for (const key of ['fuel', 'fuelMax', 'dry']) half[key] *= k;
    half.eng = { ...st.eng, tv: st.eng.tv * k }; // same engine-count steps as the pair (guidance lights 1 or 3 'engines'), half the thrust each: every booster keeps the pair's TWR at each step
    const nose = d.dir, ref = Math.abs(nose[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], side = V.norm(V.cross(nose, ref)), off = (d.sideOff || 3.2);
    const mk = (sgn, lz, ef) => { const b = { ...d, stages: [{ ...half }], r: V.addS(d.r, side, sgn * off), v: d.v.slice(), dir: d.dir.slice(), nMax: d.nMax, cdA: d.cdA * k, side: sgn, lzName: lz };
      b.ship = lz === 'LZ-1' ? this.ship : { ef: ef.slice(), moved: true, lz: true, name: lz }; return b; };
    const A = mk(-1, 'LZ-1', LZ_EF), B = mk(1, 'LZ-2', LZ2_EF); A.id = 'A'; B.id = 'B'; A.sideAxis = B.sideAxis = side; this.booster = A; return [A, B];
  }
  stage() {
    const v = this.v, bh = this.alt;
    if (v.cur >= this.last) return;
    if (v.cur > 0 || v.stages[0].radial) {
      const d = P.makeBooster(v); d.stageIndex = v.cur; d.radial = v.stages[v.cur].radial || 0; this.shiftCom(() => { v.cur++; });
      if (d.radial && this.recovery === 'rtls' && !this.booster && d.stages[0].fuel > 0.3 && bh > 2000) { // f4: side boosters fly back to the landing zone
        d.ut = 0; d.manual = false; d.maxH = bh; d.stagedAlt = bh; d.rtls = true; d.canLand = true; this.booster = d; this.ship = { ef: LZ_EF.slice(), moved: true, lz: true, name: 'LZ-1' }; d.ship = this.ship; d.lzName = 'LZ-1';
        const parts = d.radial >= 2 ? this.splitBoosters(d) : [d]; this.boosters = parts;
        this.call('ship', this.ship); if (parts[1]) this.call('ship', parts[1].ship); this.call('stage', parts[0], parts);
        this.flags.stagedFuel = d.stages[0].fuel * parts.length; this.flags.stagedAlt = bh; this.toast(parts.length > 1 ? `BOOSTER SEP — side boosters A and B boosting back to LZ-1 and LZ-2` : `BOOSTER SEP — ${d.radial} side boosters boosting back to the landing zone`, '#fff'); return;
      }
      this.call('drop', d);
      if (d.radial) { this.flags.stagedFuel = d.stages[0].fuel; this.flags.stagedAlt = bh; this.toast(`BOOSTER SEP — ${d.radial} radial boosters away, core ignition`, '#fff'); return; }
      if (v.cur > this.lastPow) { v.throttle = v.ut = 0; this.toast('CAPSULE SEPARATION — heat shield first: SAS retrograde (3)', '#fff'); if (this.ret) this.ret.sepAt = this.met; }
      else this.toast(`STAGE ${v.cur} SEP — stage ${v.cur + 1} ignition`, '#fff');
      return;
    }
    const b = P.makeBooster(v); b.ut = 0; b.manual = false; b.maxH = bh; b.stagedAlt = bh; this.booster = b;
    this.shiftCom(() => { v.cur = 1; }); this.flags.stagedFuel = b.stages[0].fuel; this.flags.stagedAlt = bh;
    this.call('stage', b);
    const fuel = b.stages[0].fuel;
    if (fuel > 0.3 && bh > 2000 && this.recovery === 'rtls') { b.rtls = true; b.canLand = true; this.ship = { ef: LZ_EF.slice(), moved: true, lz: true }; this.call('ship', this.ship); this.toast(`STAGE SEP — booster boosting back to the landing zone (${fuel.toFixed(1)} t)`, '#fff'); }
    else if (fuel > 0.3 && bh > 2000) {
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
  canDeorbit() { const f = this.flags; return this.body === 'earth' && this.ignited && !f.dead && !f.recovered && !this.ret && this.alt > 60000 && !this.flyingBooster(); }
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
    if (sp <= SAFE_TOUCHDOWN && this.body !== 'earth') { // under chutes on Mars / Titan / Venus: a landing
      f.landed = 1; this.goal(this.body, 'landed'); this.parked = { ef: V.norm(V.rotZ(v.r, -P.omegaOf(v) * v.clock)), lift: v.tel.ycom };
      this.endQueued = true; this.call('end', 3000, () => !this.ended); return;
    }
    if (sp <= SAFE_TOUCHDOWN) {
      f.recovered = 1; this.toast(`🌊 TOUCHDOWN at ${sp.toFixed(1)} m/s — ${this.v.stages.some(s => s.parts.some(p => p.id === 'crew')) ? 'crew' : 'capsule'} recovered! +${4000 * (v.mult || 1)}`, '#7dffa6');
      this.call('sound', 'landed'); this.call('recovered');
      this.parked = { ef: V.norm(V.rotZ(v.r, -P.omegaOf(v) * v.clock)), lift: v.tel.ycom };
      this.endQueued = true; this.call('end', 3000, () => !this.ended);
    } else this.fail(`hit the ground at ${sp.toFixed(0)} m/s${v.chute.state === 'stowed' ? ' (no parachutes deployed)' : v.chute.state === 'failed' ? ' (parachutes failed)' : ''}`, 'impact');
  }
  // Powered vertical landing on the ground (Academy lesson 10 and any hop): gentle and upright = landed.
  landing(sp) {
    const v = this.v, f = this.flags, tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.norm(v.r))))) * 180 / Math.PI;
    f.touchdown = sp; v.throttle = v.ut = 0;
    if (sp <= SAFE_LANDING.speed && tilt <= SAFE_LANDING.tilt) {
      f.landed = 1; if (this.body !== 'earth') this.goal(this.body, 'landed'); else this.toast(`🎯 LANDED at ${sp.toFixed(1)} m/s, ${tilt.toFixed(0)}° tilt`, '#7dffa6'); this.call('sound', 'landed');
      this.parked = { ef: V.norm(V.rotZ(v.r, -P.omegaOf(v) * v.clock)), lift: v.tel.ycom };
      this.endQueued = true; this.call('end', 3000, () => !this.ended);
    } else this.fail(`hit the ground at ${sp.toFixed(0)} m/s${tilt > SAFE_LANDING.tilt ? `, ${tilt.toFixed(0)}° from upright` : ''}`, 'ground');
  }
  // Start the flight from a given state (Academy lessons): altitude h, vertical/horizontal speed relative to the air,
  // attitude 'up' | 'prograde' | 'retrograde', which stage is active, optional fuel (t) for that stage.
  placeState({ h, vUp = 0, vEast = 0, stage = this.v.cur, att = 'up', fuel = null, sas = 'stab' }) {
    const v = this.v, keepF = h < P.FAIRING_ALT && v.fairing > 0; this.ignited = true; this.flags.liftoff = 1; this.flags.fairing = keepF ? 0 : 1; this.ascent = false; // f4: below the fairing altitude the fairing stays on
    while (v.cur < stage) v.cur++;
    if (!keepF) v.fairing = 0; v._g = null; v.clamped = false; this.met = 600; v.ut = 0; v.throttle = 0;
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
    if (!this.ignited || this.flags.dead || v.clamped || this.alt < C.railsAltOf(this.body)) return false;
    if (b && b.state === 'flying') return false;
    if (this.autoOn && v.guid !== 'done' && v.guid !== 'coast') return false;
    if (this.ret && this.ret.phase !== 'coast') return false;
    if (this.parked) return false;
    if (v.ut > 0 && v.stages[v.cur].fuel > 0 && !(this.autoOn && (v.guid === 'done' || v.guid === 'coast'))) return false;
    if (inp.pitch || inp.yaw || inp.roll || (v.trans || []).some(Boolean)) return false;
    return true;
  }
  // f1: while the booster is still flying (split-screen staging) warp stays low so both craft keep full physics
  warpLimit() { const w = this._warpLimit(); return ((this.booster && this.booster.state === 'flying') || this.boosters.some(x => x.state === 'flying')) && w[0] > BOOSTER_WARP ? [BOOSTER_WARP, 'booster in flight'] : w; }
  _warpLimit() {
    const v = this.v, h = this.alt;
    if (!this.ignited || this.flags.dead) return [1, ''];
    if (this.flyingBooster()) return [1, 'flying booster'];
    if (this.parked) return [1, ''];
    if (this.ret && this.ret.phase === 'entry' && h < 60000) return [v.chute.state === 'main' ? 10 : 4, 'reentry'];
    const top = this.body === 'earth' ? ATM : P.atmTop(this.body);
    if (h < top && v.thrust > 0) return [4, 'engines on in the air'];
    if (v.thrust > 0 && this.autoWarp) return [4, 'burning'];
    if (this.railsOK()) return [WARPS[WARPS.length - 1], ''];
    if (h < C.railsAltOf(this.body)) return [50, this.body === 'earth' ? 'below 140 km' : P.BODIES[this.body].atm ? 'in the atmosphere' : 'too low'];
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
    this.realT += rdt; this.updateAutoWarp(); this.updateExec();
    const wt = this.warpTarget;
    if (wt && this.tAbs >= wt.t - 1e-3) { this.warpTarget = null; this.setWarp(0, true); this.toast(`Arrived: ${wt.label}`, '#ffd23a'); this.call('sound', 'beep', 1000); }
    const W = this.effWarp(); let simDt = rdt * SIM_SPEED * W;
    if (this.warpTarget) simDt = Math.max(0, Math.min(simDt, this.warpTarget.t - this.tAbs));
    this.rails = W > 1 && this.railsOK();
    if (this.rails) return this.railsAdvance(simDt);
    const W2 = Math.min(W, 50), simDt2 = this.warpTarget ? Math.min(rdt * SIM_SPEED * W2, simDt || rdt * SIM_SPEED) : rdt * SIM_SPEED * W2;
    const step = W2 > 4 ? PHYS_DT * 2 : PHYS_DT, N = Math.max(1, Math.ceil(simDt2 / step - 1e-9));
    for (let i = 0; i < N; i++) this.step(simDt2 / N);
    this.checkSOI(); if (this.alarms.length) this.fireAlarms();
    return simDt2;
  }
  // Event-bounded rails: one Kepler jump per frame, cut at the first SOI change, node lead, alarm or the
  // atmosphere / low-altitude boundary; the warp drops there.
  railsAdvance(simDt) {
    const v = this.v, body = this.body, lead = this.nodes.map(n => ({ t: n.t - this.nodeBurnTime(n) / 2 - NODE_LEAD })).filter(n => n.t > this.tAbs + 0.5);
    const al = this.alarms.filter(a => a.t > this.tAbs + 0.5);
    const ev = C.nextEvent(body, v.r, v.v, this.tAbs, simDt, { nodes: [...lead, ...al], stopAlt: C.railsAltOf(body) - (body === 'earth' ? 3000 : 0) });
    const dt = ev ? Math.max(0, ev.dt) : simDt;
    P.railsStep(v, dt); this.met += dt; this.postStep(); this.updateReturn(dt); this.updateNode(0, 1);
    if (ev) {
      if (ev.type === 'soi-exit' || ev.type === 'soi-enter') { this.switchBody(ev.to); }
      else if (ev.type === 'node') {
        const a = this.alarms.find(x => Math.abs(x.t - (this.tAbs)) < 1);
        if (a) { this.alarms.splice(this.alarms.indexOf(a), 1); this.toast('⏰ Alarm: ' + a.label, '#ffd23a'); this.call('sound', 'beep', 880); }
        else if (!this.exec) this.toast('Maneuver node ahead — point SAS MANEUVER (8) and burn', '#ffd23a');
        if (!this.exec || this.warpTarget) this.warpTarget = this.exec ? null : this.warpTarget;
        this.setWarp(0, true);
      } else { this.rails = false; this.setWarp(Math.min(this.warpI, 5), true); if (body !== 'earth') this.toast(P.BODIES[body].atm ? `Entering ${P.BODIES[body].name}'s atmosphere` : `Low over ${P.BODIES[body].name} — warp limited`, '#ffb35c'); }
    } else this.checkSOI();
    return dt;
  }
  // ---------- one physics step ----------
  step(dt) {
    const v = this.v, f = this.flags;
    if (this.parked) { // recovered capsule: rides the turning Earth
      v.clock += dt; const w = P.omegaOf(v), th = w * v.clock; v.r = V.rotZ(V.scale(this.parked.ef, P.radOf(v) + this.parked.lift), th); v.v = [-w * v.r[1], w * v.r[0], 0]; v.w = [0, 0, 0];
      if (v.tel) { v.tel.q = 0; v.tel.heat = 0; v.tel.vAir = 0; v.tel.gload = 1; }
      return;
    }
    if (this.ret) this.updateReturn(dt);
    if (this.exec && !f.dead) this.updateExec();
    if (!f.dead) {
      if (!this.ignited) { v.throttle = 0; v.steerDir = null; }
      else if (this.ret) { v.throttle = v.cur <= this.lastPow ? v.ut : 0; if (!this.ret.auto) v.steerDir = null; }
      else if (this.autoOn && !v.clamped) {
        if (v.ascentTable) v.ascentMet = this.met; // PR #12 hook: table-driven stage-1 ascent
        const gd = P.autoGuide(v); v.steerDir = gd.dir;
        if (gd.phase === 'done' && v.ut > 0) { v.ut = 0; if (!f.cutoff) { f.cutoff = 1; this.toast('AUTO cutoff — orbit reached', '#7dffa6'); } }
        v.throttle = v.auto ? gd.throttle : this.autoThrottle ? Math.min(v.ut, gd.throttle) : v.ut;
        // f3 auto-staging: AUTO stages the booster itself while it still has the fuel to fly home and land (15 % margin)
        if (v.cur === 0 && this.last > 0 && this.recovery === 'rtls' && this.autoStage !== false && this.alt > 2000 && this.canStage() && this.met > 30) { // f4 RTLS: keep enough for boostback + entry + landing
          const s0 = v.stages[0], up0 = V.norm(v.r), va0 = v.tel && v.tel.va ? v.tel.va : v.v, vh0 = V.len(V.sub(va0, V.scale(up0, V.dot(va0, up0))));
          const need = s0.dry * (Math.exp((1.4 * vh0 + 1900) / (s0.eng.ispVac * 9.80665)) - 1);
          if (s0.fuel <= need && (!s0.radial || this.alt > 30000 || s0.fuel < 0.5 * need)) { /* side boosters: not inside the Max-Q region (the lone core would over-pressure) */ this.toast(`AUTO: ${s0.radial ? 'side boosters' : 'booster'} away with ${s0.fuel.toFixed(1)} t for the flight home`, '#9cc3ff'); this.stage(); }
        } else if (v.cur === 0 && this.last > 0 && !v.stages[0].radial && this.autoStage !== false && this.alt > 2000 && this.canStage()) {
          if (this._plan === undefined) { try { this._plan = this.design ? planBuild(this.design, { earthRot: v.earthRot !== false }) : null; } catch (e) { this._plan = null; } }
          const pl = this._plan; if (pl && pl.orbit && pl.landed && v.stages[0].fuel <= pl.minReserve) { this.toast(`AUTO: staging — booster keeps ${v.stages[0].fuel.toFixed(1)} t to fly home`, '#9cc3ff'); this.stage(); }
        }
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
      this.updateNode(dt, m0);
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
        if (v.clamped && !v.holdDown && this.ignited && v.throttle > 0.95) { f.padTime += dt; if (f.padTime > 6 || (st && st.fuel <= 0)) this.fail('too heavy to lift off (TWR < 1)', 'twr'); }
        if (!f.mach1 && tel.mach > 1 && h < 30000) { f.mach1 = 1; this.toast('Mach 1 — supersonic', '#9cc3ff'); }
        if (!f.highQ && tel.q > 30000 && v.thrust > 0) { f.highQ = 1; /* one hint system: the persistent HIGH Q hint (hint()) says it; no duplicate toast */ }
        if (!f.maxq && this.maxQ > 8000 && tel.q < this.maxQ * 0.95) { f.maxq = 1; if (!this.ret) this.toast(`Max-Q passed (${(this.maxQ / 1000).toFixed(1)} kPa)`, '#9cc3ff'); }
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
    for (const bb of this.boosters.length ? this.boosters : b ? [b] : []) if (bb.state === 'flying') { // f4.2: every booster has its own sim
      const n = Math.max(1, Math.ceil(dt / (1 / 50) - 1e-9));
      for (let i = 0; i < n && bb.state === 'flying'; i++) this.stepBooster(bb, dt / n);
    }
    if (!this.ended && !f.dead && f.orbit && !this.deep && !this.nodes.length && this.body === 'earth' && v.thrust <= 0 && !this.boosters.some(x => x.state === 'flying') && (!b || b.state !== 'flying') && !this.endQueued && !this.ret) {
      // a craft that can come home keeps flying: the mission ends at touchdown (or press R)
      if (this.rec.capsule && this.rec.shield && this.rec.chute) { if (!this.homeHint) { this.homeHint = 1; this.toast('Orbit! Press O to deorbit and bring the capsule home', '#ffd23a'); } }
      else { this.endQueued = true; this.call('end', 2500, () => !f.dead); }
    }
  }
  postStep() {
    const v = this.v, f = this.flags, h = this.alt;
    if (this.body !== 'earth') { // other bodies: orbit goal; Earth's own flags below stay as they were
      const o = P.orbitOf(v), b = P.BODIES[this.body], floor = b.atm ? P.atmTop(this.body) : Math.max(5000, b.R * 0.005);
      if (o.e < 1 && o.pe > floor && o.ra < b.soi && !(this.goals[this.body] || {}).orbit) this.goal(this.body, 'orbit');
      return;
    }
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
      b.tgtR = null; b.tgtAt = null;
      const va = P.airVel(b, b.r, b.v);
      if (b.retro && V.len(va) > 3) { const tgt = V.norm(V.scale(va, -1)), ax = V.cross(b.dir, tgt), s = V.len(ax), ang = Math.atan2(s, V.dot(b.dir, tgt)), rate = 1.2 * dt; if (s > 1e-9) b.dir = V.norm(V.qrot(V.qAxisAngle(ax, Math.min(ang, rate)), b.dir)); }
      const inp = b.input || {}, up = V.norm(b.r), east = P.eastOf(b.r), north = V.cross(up, east);
      if (inp.pitch) b.dir = V.norm(V.qrot(V.qAxisAngle(north, -inp.pitch * 0.7 * dt), b.dir));
      if (inp.yaw) b.dir = V.norm(V.qrot(V.qAxisAngle(up, -inp.yaw * 0.7 * dt), b.dir));
      b.throttle = b.stages[0].fuel > 0 ? b.ut : 0; b.n = b.nSel ? Math.min(b.nSel, b.nMax) : bh0 > 12000 ? Math.min(3, b.nMax) : 1;
      b.phase = b.throttle > 0 ? 'burning' : 'falling';
    } else { b.tgtR = (b.ship || this.ship) ? shipPos((b.ship || this.ship), b.clock, b.earthRot !== false) : null; b.tgtAt = (b.ship || this.ship) ? (t => shipPos((b.ship || this.ship), t, b.earthRot !== false)) : null; P.boosterAutopilot(b, dt); }
    b.deck = (b.ship || this.ship) && !(b.ship || this.ship).lz && surfDist(b.r, shipPos((b.ship || this.ship), b.clock, b.earthRot !== false)) < 40 ? DECK : 0; // aim at the deck only when over it (same test as the contact check)
    const e = P.stepPoint(b, dt);
    const bh = V.len(b.r) - R, sp = V.len(P.airVel(b, b.r, b.v)); b.maxH = Math.max(b.maxH, bh);
    if (burnedUp(b, bh, sp)) { b.state = 'lost'; this.flags.booster = 'burned up on reentry (do an entry burn)'; this.call('boosterLost', b, true); this.toast(`Booster${b.id ? ' ' + b.id : ''} burned up`, '#ff6262'); return; }
    const ship = (b.ship || this.ship);
    if (ship && !b.manual && bh < 30000 && V.dot(b.v, b.r) < 0 && !ship.moved) { // the droneship holds station at the predicted impact; terminal guidance does the rest
      const im = P.predictImpact(b), at = im ? im.r : b.r, t = im ? im.t : b.clock;
      ship.ef = V.norm(V.rotZ(at, b.earthRot === false ? 0 : -P.OMEGA_E * t)); ship.moved = true; this.call('shipMoved', ship);
    }
    if (b.state === 'flying') {
      const nearShip = ship && !ship.lz && surfDist(b.r, shipPos(ship, b.clock, b.earthRot !== false)) < 40;
      if (e === 'ground' || (nearShip && bh < DECK)) this.landBooster(b, sp);
    }
  }
  landBooster(b, sp) {
    const f = b.id === 'B' ? (this.flagsB || (this.flagsB = {})) : this.flags, ship = (b.ship || this.ship), up = V.norm(b.r), tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(b.dir, up))));
    const dist = ship ? surfDist(b.r, shipPos(ship, b.clock, b.earthRot !== false)) : 1e9;
    b.throttle = 0; b.thrust = 0; b.touchV = sp;
    let ok = false;
    if (b.maxH < 2000) { b.state = 'lost'; f.booster = 'lost (staged too low)'; }
    else if (b.manual) {
      if (sp < 8 && tilt < 0.25 && dist < 35) {
        ok = true; f.boosterBonus = 2500 + Math.round((35 - dist) * 25) + Math.round((8 - sp) * 80);
        f.booster = `landed by hand — ${dist.toFixed(1)} m off center at ${sp.toFixed(1)} m/s`; this.toast(`🎯 YOU LANDED IT! +${f.boosterBonus}`, '#7dffa6');
      } else { f.booster = sp < 8 && dist >= 35 ? `missed the ${ship && ship.lz ? 'landing zone' : 'droneship'} by ${(dist - 35).toFixed(0)} m` : sp < 8 ? 'tipped over (too tilted)' : `crashed at ${sp.toFixed(0)} m/s`; this.toast('Booster lost — ' + f.booster, '#ff6262'); }
    } else if (sp < 10) { ok = true; f.boosterBonus = 1000; f.booster = ship && ship.lz ? `auto-landed at ${b.lzName || 'the landing zone'} (RTLS)` : 'auto-landed on the droneship'; this.toast(`🎯 BOOSTER${b.id ? ' ' + b.id : ''} AUTO-LANDED${b.lzName ? ' AT ' + b.lzName : ''} +1000`, '#7dffa6'); }
    else { f.booster = `crashed at ${sp.toFixed(0)} m/s (needed more fuel: stage earlier)`; this.toast('Booster lost', '#ff6262'); }
    if (ok) { b.state = 'landed'; b.dir = up; this.call('boosterLanded', b); this.call('sound', 'landed'); }
    else { b.state = 'lost'; this.call('boosterLost', b, false); }
    // ride along with the rotating Earth from now on
    b.ef = V.norm(V.rotZ(b.r, b.earthRot === false ? 0 : -P.OMEGA_E * b.clock)); b.lift = ok && dist < 40 ? (ship && ship.lz ? 0.4 : DECK) : 0;
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
    s *= mult; s += f.boosterBonus + ((this.flagsB && this.flagsB.boosterBonus) || 0) + this.goalScore(); // f5: Heavy side booster B scores too if (f.dead) s *= 0.5;
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
    if (v.clamped && v.holdDown) return 'TEST STAND — static fire, held down by the clamps';
    if (v.clamped) return 'Not enough thrust… lighten the rocket';
    if (tel.q > 30000 && engineOn) return this.autoOn ? 'HIGH Q — AUTO is throttling down' : 'HIGH Q — throttle down (Ctrl)';
    if (!this.autoOn && h < 8000 && sp < 900) return 'Press F for AUTO (flies all the way to orbit), or pitch east yourself with W (SAS holds your heading)';
    if (v.cur < this.last && cs.fuel <= 0) return this.autoOn ? '' : v.cur === 0 ? 'Booster empty — tap STAGE' : `Stage ${v.cur + 1} empty — tap STAGE`;
    if (v.cur === 0 && this.last > 0 && h > 20000 && !this.autoOn) return this.boosterCanLand() ? `Stage now — booster has ${s1.fuel.toFixed(1)} t, enough to land` : `⚠ Booster ${s1.fuel.toFixed(1)} t: no longer enough to land it — stage soon (SPACE twice)`;
    if (fuelLeft <= 0 && !f.orbit) return 'Out of fuel — suborbital';
    if (f.orbit && !engineOn && this.rec.capsule && this.rec.chute && (!b || b.state !== 'flying')) return 'In orbit 🛰️ — press O to deorbit and bring the capsule home';
    if (f.orbit) return engineOn ? 'In orbit! Cut throttle (X)' : b && b.state === 'flying' ? 'Orbit! Watch the booster: B · fly it: Y' : 'Orbit achieved 🛰️';
    if (v.auto) return 'Upper stage on AUTO (flying to orbit) — press Z/X/F or steer to take over';
    if (this.autoOn) {
      const tAp = P.timeToApV(v);
      if (v.guid === 'circ') return 'AUTO circularizing at apoapsis — burning until Pe > 150 km';
      if (v.guid === 'coast') return `AUTO coasting to apoapsis (${Math.round(tAp / SIM_SPEED)} s) — press G to warp there`;
      return 'AUTO flying the gravity turn' + (v.cur === 0 && !v.stages[0].radial && this.last > 0 ? ' — it stages and lands the booster for you' : '');
    }
    if (engineOn && isFinite(o.ap) && o.ap > 170000 && h < ATM - 10000) return 'Ap is high enough — cut throttle (X) and coast';
    if (!engineOn && h < ATM && vr > 0) return h > 20000 ? 'Coasting — press "Warp to Ap" (G)' : 'Coasting…';
    if (h > ATM - 5000 || (!engineOn && vr <= 20)) return vr > 60 && !engineOn ? 'Warp to Ap (G), then burn prograde (SAS 2)' : engineOn ? 'Burn until Pe > 130 km' : 'Burn now! F (AUTO) or Z (full throttle)';
    return '';
  }
}
