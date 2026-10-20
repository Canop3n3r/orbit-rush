// Pure, headless mission runner (no DOM). Flies a mission's vehicle on one-tap AUTO through flight.js
// (Flight.step -> P.autoGuide), then runs the deploy sequence on orbit, evaluates the objectives and scores.
// The UI drives the same session frame by frame: S = missionSession(m); applyMission(m, F) once after
// new Flight(...); S.tick(F) after every F.advance / F.step. Session timing uses SIM time (F.tAbs), never
// the caller's frame dt, so scores do not depend on frame rate.
import * as P from '../physics.js?v=f2';
import * as C from '../physics/patched.js?v=f2';
import { Flight, planBuild, shipPos } from '../flight.js?v=f2';
import { TEMPLATES, cloneDesign } from '../parts.js?v=f2';
import { displayName } from '../vehicles/brand.js';
import { VEHICLES } from '../vehicles/catalog.js';
import { validateMission } from './schema.js';
const V = P.V;
export const SUB_DT = 1 / 25;              // s: fixed headless physics sub-step (any frame dt is split into these)
// Display names: mission and vehicle ids resolve through the shared brand lookup (vehicles/brand.js); the
// public build has no pack, so missions show their neutral name.
export const missionName = m => { const n = displayName(m.id); return n === m.id ? m.name : n; };
export const vehicleOf = m => VEHICLES.find(v => v.id === m.vehicle.vehicleId) || null;
export const vehicleName = m => displayName(m.vehicle.vehicleId || m.vehicle.role);
export function missionDesign(m) {
  const t = TEMPLATES.find(x => x.name === m.vehicle.template); if (!t) throw new Error('no template ' + m.vehicle.template);
  const d = cloneDesign(t); d.name = missionName(m); return d;
}
// Payload mass: Flight builds parts from the catalogue, so the game-scaled payload mass is applied to the
// live vehicle (the stack geometry / mass cache is rebuilt). Call once, right after constructing the Flight.
export function applyMission(m, F) {
  const id = m.vehicle.payloadPart || 'sat', mt = m.vehicle.gameMassT; if (mt == null) return F;
  let n = 0; for (const s of F.v.stages) for (const p of s.parts) if (p.id === id) { p.m = mt; n++; }
  if (!n) throw new Error(`gameMassT set but template '${m.vehicle.template}' has no '${id}' payload part`);
  F.v._g = null; return F;
}
const orbitOK = F => !!F.flags.orbit && !F.flags.dead && P.orbitOf(F.v).pe > P.ORBIT_PE;
const inBand = (F, o) => { const e = P.orbitOf(F.v); return Math.abs(e.ap - o.apM) <= o.tolM && Math.abs(e.pe - o.peM) <= o.tolM; };
// Two-burn transfer from the current orbit to { apM, peM } (altitudes): burn 1 at the current apoapsis sets
// the opposite apsis to apM, burn 2 there sets the other side to peM. Returns a flight.js node.
function transferNode(F, which, d) {
  const v = F.v, mu = P.MU, o = P.orbitOf(v);
  const t = which === 1 ? P.timeToApV(v) : C.timeToPe(v.r, v.v, mu) < P.timeToApV(v) && Math.abs(o.pe - d.apM) < Math.abs(o.ap - d.apM) ? C.timeToPe(v.r, v.v, mu) : P.timeToApV(v);
  const s = P.propagate(v.r, v.v, t, mu), r1 = V.len(s.r), r2 = P.R + (which === 1 ? d.apM : d.peM);
  return { t: F.tAbs + t, pro: Math.sqrt(mu * (2 / r1 - 2 / (r1 + r2))) - V.len(s.v) };
}
export function missionSession(m) {
  const S = { m, phase: 'ascent', log: [], idx: 0, stepT0: null, tLast: null, orbitT: null, deployT0: null,
    releasedT: null, dispensed: 0, holdS: 0, propT: null, task: null, burns: 0, done: false };
  const ev = (k, F, x = {}) => S.log.push({ k, t: F.tAbs, met: F.met, ...x });
  S.tick = F => {
    const now = F.tAbs, dt = S.tLast == null ? 0 : Math.max(0, now - S.tLast); S.tLast = now;
    if (S.done || F.flags.dead) return S;
    if (S.phase === 'ascent') { if (orbitOK(F) && F.v.guid === 'done') { S.phase = 'deploy'; S.orbitT = S.deployT0 = S.stepT0 = now; ev('orbit', F); } else return S; }
    const band = m.objectives.find(o => o.kind === 'band');
    if (band && orbitOK(F) && inBand(F, band) && !F.exec && !F.nodes.length) S.holdS += dt;
    const d = m.deploy[S.idx]; if (!d) { S.done = true; S.task = null; return S; }
    const el = now - S.stepT0; let next = false;
    switch (d.kind) {
      case 'fairing-sep': if (F.flags.fairing) { ev('fairing-sep', F); next = true; } else if (el > 600) { ev('fairing-stuck', F); next = true; } break;
      case 'stack-release': if (el >= (d.delayS || 0)) { S.releasedT = now; ev('stack-release', F); next = true; } break;
      case 'dispense': { // staggered: one unit every intervalS (first at once), counted from sim time
        S._dBase ??= S.dispensed; const want = Math.min(d.count, Math.floor(el / d.intervalS) + 1);
        while (S.dispensed - S._dBase < want) { S.dispensed++; ev('dispense', F, { n: S.dispensed, label: d.label }); }
        if (S.dispensed - S._dBase >= d.count) { S._dBase = undefined; next = true; } break; }
      case 'transfer': // player task: execute the planned burns (UI shows S.task; headless autoPlayer executes)
        if (!F.nodes.length && !F.exec) {
          if (S._burn === 2) { S._burn = 0; ev('transfer-done', F, { ap: P.orbitOf(F.v).ap, pe: P.orbitOf(F.v).pe }); S.task = null; next = true; }
          else { S._burn = (S._burn || 0) + 1; F.addNode(transferNode(F, S._burn, d)); S.burns++; S.task = { kind: 'execute-node', burn: S._burn, of: 2, label: d.label || 'Reach the target orbit' }; ev('node', F, { burn: S._burn }); }
        } break;
      case 'coast': if (el >= d.s) next = true; break;
      case 'propellant-check': S.propT = F.v.stages[F.lastPow].fuel; ev('propellant', F, { t: S.propT }); next = true; break;
      case 'booster-return': { const b = F.booster; if (!b || b.state !== 'flying' || el > 1800) { S.booster = boosterResult(F); ev('booster', F, S.booster); next = true; } break; }
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
  return { state: b.state, distM: dist, touchV: b.touchV ?? null, msg: F.flags.booster };
}
// Objectives are recomputed from Flight state; session progress only counts if it is consistent with it
// (orbit reached, deploy phase entered, event times inside the flight's own timeline).
export function evaluate(m, F, S) {
  const o = P.orbitOf(F.v), b = boosterResult(F), orb = orbitOK(F), now = F.tAbs;
  const deployed = orb && S.phase !== 'ascent' && S.orbitT != null && S.orbitT <= now && F.flags.orbit;
  const sinceOrbit = deployed ? now - S.orbitT : 0;
  // dispenses cannot exceed what the schedule allows in the time spent on orbit
  let maxDisp = 0, tt = 0; for (const d of m.deploy) { if (d.kind === 'dispense') maxDisp += Math.min(d.count, Math.floor(Math.max(0, sinceOrbit - tt) / d.intervalS) + 1); tt += d.delayS || d.s || 0; }
  const released = deployed && S.releasedT != null && S.releasedT >= S.orbitT && S.releasedT <= now;
  const dispensed = released ? Math.min(S.dispensed, maxDisp) : 0, hold = deployed ? Math.min(S.holdS, sinceOrbit) : 0;
  const prop = deployed && S.propT != null ? Math.min(S.propT, F.v.stages[F.lastPow].fuel) : null;
  const res = [];
  for (const q of m.objectives) {
    let pass = false;
    switch (q.kind) {
      case 'orbit': pass = orb; break;
      case 'pe-min': pass = orb && o.pe >= q.m; break;
      case 'ap-max': pass = orb && o.ap <= q.m; break;
      case 'band': pass = orb && inBand(F, q); break;
      case 'fairing-sep': pass = !!F.flags.fairing && orb; break;
      case 'stack-release': pass = released; break;
      case 'dispensed': pass = dispensed >= q.count; break;
      case 'booster-landed': pass = b.state === 'landed'; break;
      case 'booster-catch': pass = b.state === 'landed' && b.distM <= q.radiusM && (b.touchV ?? 99) <= (q.maxSpeed ?? 10); break;
      case 'propellant': pass = prop != null && prop >= q.minT; break;
      case 'hold': pass = hold >= q.s; break;
    }
    res.push({ id: q.id, label: q.label, pass, points: pass ? q.points || 0 : 0, required: !!q.required, partial: !!q.partial });
  }
  const complete = res.every(r => r.pass || !r.required);
  // a failed run keeps half its flight score and only objectives explicitly marked partial
  if (!complete) for (const r of res) if (!r.partial) r.points = 0;
  const flight = m.scoring && m.scoring.base === 0 ? 0 : F.score(), bonus = res.reduce((s, r) => s + r.points, 0);
  return { complete, objectives: res, flightScore: flight, objectiveScore: bonus, score: complete ? flight + bonus : Math.round(flight * 0.5) + bonus };
}
// Headless "perfect player" for the post-orbit task: warp to the node, then execute it.
function autoPlayer(F, S) {
  if (!S.task || !F.nodes.length) { S._warped = false; return; }
  if (!F.exec) { if (!S._warped) { F.warpToNode(true); S._warped = true; } else if (!F.warpTarget) F.setExec(true); }
}
// One-tap AUTO, fully headless. opts.dt = caller's frame dt (split into fixed SUB_DT physics steps);
// opts.player: false skips the post-orbit task (a player who never taps), opts.each(F, S) per sub-step.
export function runMission(m, opts = {}) {
  const v = validateMission(m); if (!v.ok) throw new Error('invalid mission: ' + v.err.join('; '));
  const design = missionDesign(m), frame = opts.dt || SUB_DT, n = Math.max(1, Math.round(frame / SUB_DT));
  const reserve = opts.reserve !== undefined ? opts.reserve : m.vehicle.reserve ?? (m.deploy.some(d => d.kind === 'booster-return') ? planBuild(design).minReserve : undefined);
  const F = applyMission(m, new Flight(design, {}, {})), S = missionSession(m);
  F.stagePress(); F.setAuto(true, true);
  const sub = () => { F.realT += SUB_DT; F.step(SUB_DT); S.tick(F); if (opts.each) opts.each(F, S); };
  // ascent: same staging rule as flight.js simulateAuto (stage with `reserve` t left so the booster can land)
  for (let t = 0; t < (opts.tMax || 2400) && S.phase === 'ascent' && !F.flags.dead && !F.flags.stranded; t += SUB_DT * n) {
    for (let i = 0; i < n; i++) {
      if (reserve != null && F.v.cur === 0 && F.v.stages[0].fuel <= reserve && F.canStage() && F.alt > 2000) F.stage();
      sub();
    }
  }
  // on orbit: real-time advance (fixed sub-steps; warps to nodes on rails), booster keeps flying meanwhile
  for (let i = 0; i < (opts.postFrames || 4e5) && S.phase !== 'ascent' && !S.done && !F.flags.dead; i++) {
    if (opts.player !== false) autoPlayer(F, S);
    F.advance(SUB_DT / 2); S.tick(F); if (opts.each) opts.each(F, S);
  }
  const e = evaluate(m, F, S), oo = P.orbitOf(F.v);
  return { ...e, log: S.log, flight: { orbit: orbitOK(F), ap: oo.ap, pe: oo.pe, booster: F.flags.booster, dead: F.flags.dead, reserve }, F, S };
}
