// Pure, headless mission runner (no DOM). Flies a mission's vehicle on one-tap AUTO through flight.js
// (Flight.step -> P.autoGuide), then runs the deploy sequence on orbit, evaluates the objectives and scores.
// UI: S = missionSession(m); F = applyMission(m, new Flight(missionDesign(m), missionHooks(m, F?), missionFlightOpts(m)));
// S.attach(F) once; S.tick(F) after every F.advance; show S.task / S.log; evaluate(m, F, S) at the end.
// Trusted progress lives in a module-private record keyed by the Flight (never in S), and is only updated
// from Flight state, so a forged session cannot earn anything. Session timing uses SIM time (F.tAbs).
import * as P from '../physics.js?v=f2';
import * as C from '../physics/patched.js?v=f2';
import { Flight, planBuild, shipPos } from '../flight.js?v=f2';
import { TEMPLATES, cloneDesign, validate } from '../parts.js?v=f2';
import { Director } from '../fun/director.js?v=f2';
import { displayName } from '../vehicles/brand.js';
import { VEHICLES } from '../vehicles/catalog.js';
import { validateMission } from './schema.js';
import * as TG from './layers/target.js';
import * as RC from './layers/recovery.js';
const V = P.V, AU = 1.495978707e11;
export const SUB_DT = 1 / 25;              // s: fixed headless physics sub-step (any frame dt is split into these)
export const FAIL_MULT = 0.1;              // a failed run keeps 10% of its base score (≈ ≤ 15% of a win)
export const missionName = m => { const n = displayName(m.id); return n === m.id ? m.name : n; };
export const vehicleOf = m => VEHICLES.find(v => v.id === m.vehicle.vehicleId) || null;
export const vehicleName = m => displayName(m.vehicle.vehicleId || m.vehicle.role);
export function missionDesign(m) {
  let d;
  if (m.vehicle.parts) d = { name: '', parts: m.vehicle.parts.map(p => ({ ...p })) };
  else { const t = TEMPLATES.find(x => x.name === m.vehicle.template); if (!t) throw new Error('no template ' + m.vehicle.template); d = cloneDesign(t); }
  d.name = missionName(m); return d;
}
export const missionFlightOpts = m => ({ ...(m.vehicle.inclDeg ? { incl: m.vehicle.inclDeg } : {}), ...(m.epochUTC ? { t0: P.tFromDate(Date.parse(m.epochUTC)) } : {}) });
const REC = new WeakMap();
const rec = F => { let r = REC.get(F); if (!r) { r = { orbitT: null, bandS: 0, releasedT: null, releasedInBand: false, dispensed: 0, propT: null, gates: {}, dockS: 0, dockedT: null,
  transferred: 0, recov: {}, pad: V.norm(F.v.r), burns: 0, target: null, director: null }; REC.set(F, r); } return r; };
// Hooks: capture side-booster / core separations for the recovery layer.
export function missionHooks(m, getF) {
  const rv = m.vehicle.recovery || {};
  return { drop: d => { const F = getF(); if (!F) return; const R = rec(F), which = d.radial ? 'side' : d.stageIndex === 1 ? 'core' : 'stage' + d.stageIndex, mode = rv[which];
    if (!mode || R.recov[which]) return;
    R.recov[which] = mode === 'rtls' ? RC.rtls(d, R.pad) : RC.droneship(d); R.recov[which].t = F.tAbs; } };
}
// Payload mass: Flight builds parts from the catalogue, so the game-scaled payload mass is applied to the live
// vehicle (stack geometry / mass cache rebuilt). Call once, right after constructing the Flight.
export function applyMission(m, F) {
  rec(F);
  const id = m.vehicle.payloadPart || 'sat', mt = m.vehicle.gameMassT; if (mt == null) return F;
  let n = 0; for (const s of F.v.stages) for (const p of s.parts) if (p.id === id) { p.m = mt; n++; }
  if (!n) throw new Error(`gameMassT set but the vehicle has no '${id}' payload part`);
  F.v._g = null; return F;
}
const orbitOK = F => !!F.flags.orbit && !F.flags.dead && F.body === 'earth' && P.orbitOf(F.v).pe > P.ORBIT_PE;
const inBand = (F, o) => { if (F.body !== 'earth') return false; const e = P.orbitOf(F.v); return Math.abs(e.ap - o.apM) <= o.tolM && Math.abs(e.pe - o.peM) <= o.tolM; };
const inclDeg = F => P.orbitOf(F.v).inc * 180 / Math.PI;
function transferNode(F, which, d) {
  const v = F.v, mu = P.MU, o = P.orbitOf(v);
  const t = which === 1 ? P.timeToApV(v) : C.timeToPe(v.r, v.v, mu) < P.timeToApV(v) && Math.abs(o.pe - d.apM) < Math.abs(o.ap - d.apM) ? C.timeToPe(v.r, v.v, mu) : P.timeToApV(v);
  const s = P.propagate(v.r, v.v, t, mu), r1 = V.len(s.r), r2 = P.R + (which === 1 ? d.apM : d.peM);
  return { t: F.tAbs + t, pro: Math.sqrt(mu * (2 / r1 - 2 / (r1 + r2))) - V.len(s.v) };
}
// Plane change at the next equator crossing (ascending/descending node): rotate v about r by the inclination gap.
function planeNode(F, inclT) {
  const v = F.v, mu = P.MU, per = 2 * Math.PI * Math.sqrt(V.len(v.r) ** 3 / mu); let t = 0, z0 = v.r[2];
  for (let k = 1; k <= 400; k++) { const s = P.propagate(v.r, v.v, per * k / 400, mu); if (k * per / 400 > 300 && Math.sign(s.r[2]) !== Math.sign(z0)) { t = per * k / 400; break; } z0 = s.r[2]; }
  const s = P.propagate(v.r, v.v, t, mu), h = V.norm(V.cross(s.r, s.v)), cur = Math.acos(h[2]), want = inclT * Math.PI / 180;
  const u = V.norm(s.r), ang = (want - cur) * (s.v[2] >= 0 ? -1 : 1) * Math.sign(s.r[0] * 0 + 1);
  const rot = (x, a) => V.add(V.add(V.scale(x, Math.cos(a)), V.scale(V.cross(u, x), Math.sin(a))), V.scale(u, V.dot(u, x) * (1 - Math.cos(a))));
  let best = null; for (const sg of [1, -1]) { const nv = rot(s.v, sg * Math.abs(want - cur)), hn = V.norm(V.cross(s.r, nv)), err = Math.abs(Math.acos(hn[2]) - want); if (!best || err < best.err) best = { err, dv: V.sub(nv, s.v) }; }
  void ang; return TG.nodeFromVector(F, F.tAbs + t, best.dv);
}
export function missionSession(m) {
  const S = { m, phase: 'ascent', log: [], idx: 0, stepT0: null, tLast: null, task: null, done: false, failed: null, F: null };
  const ev = (k, F, x = {}) => S.log.push({ k, t: F.tAbs, met: F.met, ...x });
  const band = m.objectives.find(o => o.kind === 'band'), dockO = m.deploy.find(d => d.kind === 'dock');
  S.attach = F => { S.F = F; rec(F); return S; };
  S.tick = F => {
    const R = rec(F), now = F.tAbs, dt = S.tLast == null ? 0 : Math.max(0, now - S.tLast); S.tLast = now;
    if (S.done || F.flags.dead) return S;
    if (S.phase === 'ascent') { if (orbitOK(F) && F.v.guid === 'done') { S.phase = 'deploy'; S.stepT0 = now; R.orbitT = now; ev('orbit', F); } else return S; }
    // trusted per-tick bookkeeping from Flight state
    if (band && orbitOK(F) && inBand(F, band) && !F.exec && !F.nodes.length) R.bandS += dt;
    if (R.target && F.body === 'earth') { const x = TG.relState(F, R.target);
      for (const o of m.objectives) if (o.kind === 'gate' && R.gates[o.id] == null && x.range <= o.rangeM && x.relV <= o.relV) { R.gates[o.id] = now; ev('gate', F, { id: o.id, range: x.range, relV: x.relV }); }
      if (dockO) { if (x.range <= dockO.rangeM && x.relV <= dockO.relV) R.dockS += dt; else if (R.dockedT == null) R.dockS = 0; } }
    const d = m.deploy[S.idx]; if (!d) { S.done = true; S.task = null; return S; }
    const el = now - S.stepT0; let next = false;
    const twoBurn = (mk, label) => { // generic "player executes planned nodes" step; mk(k) returns node k or null when finished
      if (F.nodes.length || F.exec) return false;
      const n = mk((S._k || 0) + 1); if (!n) { S._k = 0; S.task = null; return true; }
      S._k = (S._k || 0) + 1; F.addNode(n); R.burns++; S.task = { kind: 'execute-node', burn: S._k, label }; ev('node', F, { burn: S._k, dv: C.nodeDv(n) }); return false; };
    switch (d.kind) {
      case 'fairing-sep': if (F.flags.fairing) { ev('fairing-sep', F); next = true; } else if (el > 600) { ev('fairing-stuck', F); next = true; } break;
      case 'stack-release': // only in the target orbit (when the mission has one): off-target, the deploy waits
        if (el >= (d.delayS || 0) && (!band || inBand(F, band))) { R.releasedT = now; R.releasedInBand = !band || inBand(F, band); ev('stack-release', F); next = true; } break;
      case 'dispense': {
        if (R.releasedT == null) break;
        S._dBase ??= R.dispensed; const want = Math.min(d.count, Math.floor(el / d.intervalS) + 1);
        while (R.dispensed - S._dBase < want) { R.dispensed++; ev('dispense', F, { n: R.dispensed, label: d.label }); }
        if (R.dispensed - S._dBase >= d.count) { S._dBase = undefined; next = true; } break; }
      case 'transfer': next = twoBurn(k => k <= 2 ? transferNode(F, k, d) : null, d.label || 'Reach the target orbit'); break;
      case 'raise-ap': next = twoBurn(k => k === 1 ? (() => { const tp = C.timeToPe(F.v.r, F.v.v, P.MU), s = P.propagate(F.v.r, F.v.v, tp, P.MU), r1 = V.len(s.r), r2 = P.R + d.apM;
        return { t: F.tAbs + tp, pro: Math.sqrt(P.MU * (2 / r1 - 2 / (r1 + r2))) - V.len(s.v) }; })() : null, d.label || 'Raise apoapsis'); break;
      case 'plane-change': next = twoBurn(k => { const nb = d.burns || 1, gap = d.inclDeg - inclDeg(F); if (k > nb + 1 || Math.abs(gap) < 0.05) return null; return planeNode(F, inclDeg(F) + gap / Math.max(1, nb + 1 - k)); }, d.label || 'Plane change'); break;
      case 'rendezvous': { // phasing (Lambert search), velocity match, then closing approaches until inside the dock gate
        if (!R.target) { R.target = TG.makeTarget(F, { altM: d.altM, leadDeg: d.leadDeg ?? 8, id: d.target || 'station' }); R.targetFuel = d.targetFuelT || 0; ev('target', F, { id: R.target.id }); }
        next = twoBurn(k => {
          const x = TG.relState(F, R.target); if (dockO && x.range <= dockO.rangeM * 0.8 && x.relV <= dockO.relV * 0.8) return null; if (k > 2 * (d.maxApproaches || 8) + 2) return null;
          if (k === 1) { const per = 2 * Math.PI * Math.sqrt(V.len(F.v.r) ** 3 / P.MU), pl = TG.planIntercept(F, R.target, { dMax: (d.phasingOrbits || 4) * per, steps: 160 }); if (!pl) return null; S._arr = pl.tArr; return pl.n1; }
          if (k % 2 === 0) return TG.matchNode(F, R.target, S._arr);
          const tf = Math.max(200, Math.min(1500, x.range / 5)), pl = TG.planIntercept(F, R.target, { dMin: 120, dMax: 121, tfMin: tf, tfMax: tf, steps: 1 }); if (!pl) return null; S._arr = pl.tArr; return pl.n1;
        }, 'Rendezvous: phasing and approach burns'); break; }
      case 'dock': if (R.dockS >= (d.holdS || 0)) { if (R.dockedT == null) { R.dockedT = now; const s = TG.targetAt(R.target, now); F.v.v = [...s.v]; ev('docked', F); } next = true; }
        else if (el > (d.timeoutS || 3600)) { ev('dock-timeout', F); next = true; } break;
      case 'prop-transfer': { // ship-to-ship: only while docked and still latched (within the dock range)
        if (R.dockedT == null) { next = true; break; }
        const x = TG.relState(F, R.target), st = F.v.stages[F.lastPow];
        if (x.range <= dockO.rangeM * 1.5) { const q = Math.min((d.rateTps || 0.5) * dt, R.targetFuel, st.fuelMax - st.fuel, d.t - R.transferred); if (q > 0) { st.fuel += q; R.targetFuel -= q; R.transferred += q; F.v._g = null; } }
        if (R.transferred >= d.t - 1e-6 || R.targetFuel <= 0 || st.fuel >= st.fuelMax - 1e-6) { ev('transfer', F, { t: R.transferred }); next = true; } break; }
      case 'director': { // hand-off to the one-tap mission autopilot (fun/director.js): transfer, capture, landing
        if (!R.director) { R.director = new Director(F, d.dest, {}); ev('director', F, { dest: d.dest }); S.task = { kind: 'follow-autopilot', dest: d.dest }; }
        if (!R.director.active) { ev('director-done', F, { ok: R.director.ok, result: R.director.result }); S.task = null; next = true; } break; }
      case 'interplanetary': { // ejection from the parking orbit on the Lambert-optimal departure (planInterplanetary)
        if (S._ip == null) { // planFull: Hohmann window, planInterplanetary's Lambert-optimal ejection ('exact') and a finite-burn tuned node
          const pl = C.planFull('earth', F.v.r, F.v.v, F.tAbs, d.target, { minWait: 1200, burn: F.burnModel() });
          if (!pl || !pl.reaches) { ev('no-window', F); next = true; break; }
          const node = pl.exact && pl.exactDv < pl.tunedDv * 1.05 ? pl.exact : pl.tuned;
          F.addNode(node); R.burns++; S._ip = 1; S.task = { kind: 'execute-node', burn: 1, label: 'Ejection burn' }; ev('node', F, { dv: C.nodeDv(node), exactDv: pl.exactDv, wait: pl.wait }); break; }
        if (!F.nodes.length && !F.exec) { S.task = null; if (F.body === 'sun') { ev('heliocentric', F); next = true; } else if (!F.warpTarget) S.task = { kind: 'warp-soi' }; }
        break; }
      case 'coast': if (el >= d.s) next = true; break;
      case 'propellant-check': R.propT = F.v.stages[F.lastPow].fuel; ev('propellant', F, { t: R.propT }); next = true; break;
      case 'booster-return': { const b = F.booster; if (!b || b.state !== 'flying' || el > 1800) { ev('booster', F, boosterResult(F)); next = true; } break; }
    }
    if (next) { S.idx++; S.stepT0 = now; }
    return S;
  };
  return S;
}
function boosterResult(F) {
  const b = F.booster; if (!b) return { state: 'none' };
  const up = V.norm(b.r), sp = F.ship ? shipPos(F.ship, b.clock, b.earthRot !== false) : null;
  const dist = sp ? Math.acos(Math.max(-1, Math.min(1, V.dot(up, V.norm(sp))))) * P.R : Infinity;
  return { state: b.state, distM: dist, touchV: b.touchV ?? null, msg: F.flags.booster, bonus: F.flags.boosterBonus };
}
// Base score, normalised: no reward for a lighter payload or for unused propellant (fuel only counts through
// explicit objectives). Payload delivered to a passing mission scales the base up, never down.
function baseScore(m, F, complete) {
  const f = F.flags; let s = Math.min(f.maxAlt || 0, P.ATM) / 100;
  if (f.space) s += 1000; if (f.orbit || F.body !== 'earth') s += 3000;
  if (complete) s += 400 * (m.vehicle.gameMassT || 2);
  return Math.round(s * (F.v.mult || 1) + (f.boosterBonus || 0));
}
// Objectives are recomputed from Flight state plus the module-private record (never from the session).
export function evaluate(m, F, S) {
  const R = REC.get(F) || rec(F), o = P.orbitOf(F.v), b = boosterResult(F), orb = orbitOK(F), now = F.tAbs;
  const deployed = R.orbitT != null && R.orbitT <= now, gBand = m.objectives.find(q => q.kind === 'band');
  const bandOK = !gBand || (orb && inBand(F, gBand));
  const released = deployed && R.releasedT != null && R.releasedInBand && bandOK;
  const res = [];
  for (const q of m.objectives) {
    let pass = false;
    switch (q.kind) {
      case 'orbit': pass = orb; break;
      case 'pe-min': pass = orb && o.pe >= q.m; break;
      case 'ap-max': pass = orb && o.ap <= q.m; break;
      case 'ap-min': pass = !F.flags.dead && F.body === 'earth' && deployed && o.ap >= q.m && o.pe > P.ORBIT_PE; break;
      case 'band': pass = orb && inBand(F, q); break;
      case 'incl': pass = orb && Math.abs(inclDeg(F) - q.deg) <= q.tol; break;
      case 'fairing-sep': pass = !!F.flags.fairing && deployed; break;
      case 'stack-release': pass = released && orb; break;
      case 'dispensed': pass = released && orb && R.dispensed >= q.count; break;
      case 'booster-landed': pass = b.state === 'landed'; break;
      case 'booster-catch': pass = b.state === 'landed' && b.distM <= q.radiusM && (b.touchV ?? 99) <= (q.maxSpeed ?? 10); break;
      case 'propellant': pass = deployed && R.propT != null && Math.min(R.propT, F.v.stages[F.lastPow].fuel) >= q.minT; break;
      case 'hold': pass = deployed && R.bandS >= q.s; break;
      case 'gate': pass = deployed && R.gates[q.id] != null; break;
      case 'docked': pass = deployed && R.dockedT != null; break;
      case 'transferred': pass = R.dockedT != null && R.transferred >= q.t - 1e-6; break;
      case 'landed-on': pass = deployed && F.body === q.body && !!F.flags.landed && !F.flags.dead; break;
      case 'orbiting': pass = deployed && F.body === q.body && !F.flags.dead && o.e < 1 && o.pe > 0; break;
      case 'helio': pass = deployed && F.body === 'sun' && !F.flags.dead && o.ra >= q.aphMinAU * AU; break;
      case 'recovered': { const r = R.recov[q.which]; pass = !!(r && r.lands && r.mode === q.mode && (q.maxDistM == null || r.distM <= q.maxDistM)); break; }
    }
    res.push({ id: q.id, label: q.label, pass, points: pass ? q.points || 0 : 0, required: !!q.required, partial: !!q.partial });
  }
  const complete = res.every(r => r.pass || !r.required);
  if (!complete) for (const r of res) if (!r.partial) r.points = 0;
  const base = m.scoring && m.scoring.base === 0 ? 0 : baseScore(m, F, complete), bonus = res.reduce((s, r) => s + r.points, 0);
  return { complete, objectives: res, flightScore: base, objectiveScore: bonus, score: complete ? base + bonus : Math.round(base * FAIL_MULT) + bonus, recovery: R.recov };
}
// Headless "perfect player" for post-orbit tasks: warp to the node, then execute it; follow the autopilot.
function autoPlayer(F, S) {
  const R = rec(F); if (R.director && R.director.active) { R.director.tick(SUB_DT / 2); return; }
  if (S.task && S.task.kind === 'warp-soi') { if (!F.warpTarget) F.warpToSOI(); return; }
  if (!S.task || !F.nodes.length) { S._warped = false; return; }
  if (!F.exec) { if (!S._warped) { F.warpToNode(true); S._warped = true; } else if (!F.warpTarget) F.setExec(true); }
}
// Scripted booster pilot (the player flying the booster by hand to the catch point), same cues as the HUD.
function boosterPilot(F) {
  const b = F.booster; if (!F.flyingBooster || !F.flyingBooster()) return;
  b.retro = true; b.deck = F.ship && V.len(V.sub(shipPos(F.ship, b.clock, true), b.r)) < 2000 ? 3 : 0; b.manual = false; P.boosterAutopilot(b, P.PHYS_DT || 0.02); b.manual = true;
  b.ut = b.throttle; b.nSel = b.n;
  if (F.ship && (F._pk = ((F._pk || 0) + 1) % 10) === 0) { const imp = P.predictImpact({ ...b, throttle: 0, fin: null });
    if (imp) { const tgt = shipPos(F.ship, imp.t, true), up = V.norm(imp.r), miss = V.sub(tgt, imp.r), hm = V.sub(miss, V.scale(up, V.dot(miss, up)));
      b.fin = b.throttle > 0 ? null : V.scale(hm, Math.min(1, V.len(hm) / 1000) / Math.max(V.len(hm), 1)); } }
}
// One-tap AUTO, fully headless. opts.dt = caller's frame dt (split into fixed SUB_DT physics steps);
// opts.player: false = a player who never does the post-orbit task; opts.each(F, S) per sub-step.
export function runMission(m, opts = {}) {
  const v = validateMission(m); if (!v.ok) throw new Error('invalid mission: ' + v.err.join('; '));
  const design = missionDesign(m); if (m.vehicle.parts && !validate(design).ok) throw new Error('invalid design: ' + validate(design).errors.join('; '));
  const frame = opts.dt || SUB_DT, n = Math.max(1, Math.round(frame / SUB_DT)), rv = m.vehicle.recovery || {};
  const reserve = opts.reserve !== undefined ? opts.reserve : m.vehicle.reserve ?? ((m.deploy.some(d => d.kind === 'booster-return') || rv.stage0) ? planBuild(design).minReserve : undefined);
  let F = null; const hooks = missionHooks(m, () => F);
  F = applyMission(m, new Flight(design, hooks, missionFlightOpts(m))); const S = missionSession(m).attach(F);
  const fmax = F.v.stages.map(s => s.fuelMax), frac = { 0: rv.sideReserveFrac, 1: rv.coreReserveFrac };
  F.autoStage = false; F.stagePress(); F.setAuto(true, true); // f4: the runner stages by its own reserve rule (f3 AUTO auto-staging would stage Moon/Mars boosters early)
  const pilot = rv.stage0 === 'catch-pilot' && opts.player !== false;
  const sub = () => { F.realT += SUB_DT; if (pilot) boosterPilot(F); F.step(SUB_DT); S.tick(F); if (opts.each) opts.each(F, S); };
  for (let t = 0; t < (opts.tMax || 2400) && S.phase === 'ascent' && !F.flags.dead && !F.flags.stranded; t += SUB_DT * n) {
    for (let i = 0; i < n; i++) {
      const c = F.v.cur;
      if (reserve != null && c === 0 && !F.v.stages[0].radial && F.v.stages[0].fuel <= reserve && F.canStage() && F.alt > 2000) { F.stage(); if (pilot && F.booster) F.toggleBooster(); }
      else if (frac[c] != null && c < F.lastPow && F.v.stages[c].fuel <= fmax[c] * frac[c] && F.canStage() && F.alt > 2000) F.stage();
      sub();
    }
  }
  if (pilot) for (let i = 0; i < 1e5 && F.booster && F.booster.state === 'flying' && !F.flags.dead; i++) { boosterPilot(F); F.realT += SUB_DT; F.step(SUB_DT); S.tick(F); }
  const maxF = opts.postFrames || m.maxFrames || 4e5;
  for (let i = 0; i < maxF && S.phase !== 'ascent' && !S.done && !F.flags.dead; i++) {
    if (opts.player !== false) autoPlayer(F, S);
    F.advance(SUB_DT / 2); S.tick(F); if (opts.each) opts.each(F, S);
  }
  const e = evaluate(m, F, S), oo = P.orbitOf(F.v);
  return { ...e, log: S.log, flight: { orbit: orbitOK(F), body: F.body, ap: oo.ap, pe: oo.pe, incl: oo.inc * 180 / Math.PI, booster: F.flags.booster, dead: F.flags.dead, reserve }, F, S };
}
