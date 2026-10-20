// Pure, headless mission runner (no DOM). Flies a mission's vehicle on one-tap AUTO through flight.js
// (simulateAuto -> Flight.step -> P.autoGuide), then runs the deploy sequence on orbit, evaluates the
// objectives and scores. The same object can be driven frame-by-frame by the UI via missionSession().
import * as P from '../physics.js?v=f2';
import { Flight, simulateAuto, planBuild, shipPos } from '../flight.js?v=f2';
import { TEMPLATES, cloneDesign } from '../parts.js?v=f2';
import { brandName } from './brand.js';
import { validateMission } from './schema.js';
const V = P.V;
// Flyable design for a mission: the template with the payload part's mass set to the game-scaled mass.
export function missionDesign(m) {
  const t = TEMPLATES.find(x => x.name === m.vehicle.template); if (!t) throw new Error('no template ' + m.vehicle.template);
  const d = cloneDesign(t); d.name = brandName(m.id, m.name);
  if (m.vehicle.gameMassT != null) { const p = d.parts.find(q => q.id === (m.vehicle.payloadPart || 'sat')); if (p) p.m = m.vehicle.gameMassT; }
  return d;
}
// Session: attach to a live Flight (UI) or a headless one; call tick(F, dt) after every F.step / advance.
export function missionSession(m) {
  const S = { m, t: 0, phase: 'ascent', log: [], released: false, dispensed: 0, holdS: 0, idx: 0, stepT: 0, nextAt: 0, done: false };
  const ev = (k, x = {}) => S.log.push({ k, met: S.t, ...x });
  S.tick = (F, dt) => {
    S.t += dt; if (S.done) return S;
    if (S.phase === 'ascent') { if (F.flags.orbit && F.v.guid === 'done') { S.phase = 'deploy'; S.stepT = 0; ev('orbit'); } else return S; }
    const band = m.objectives.find(o => o.kind === 'band');
    if (band && inBand(F, band)) S.holdS += dt;
    const d = m.deploy[S.idx]; if (!d) { S.done = true; return S; }
    S.stepT += dt; let next = false;
    switch (d.kind) {
      case 'fairing-sep': if (F.flags.fairing) { ev('fairing-sep'); next = true; } else if (S.stepT > 600) { ev('fairing-stuck'); next = true; } break;
      case 'stack-release': if (S.stepT >= (d.delayS || 0)) { S.released = true; ev('stack-release'); next = true; } break;
      case 'dispense': // staggered: one unit every intervalS (first at once)
        while (S.stepT >= S.nextAt && S.dispensed - (S._dBase || 0) < d.count) { S.dispensed++; ev('dispense', { n: S.dispensed, label: d.label }); S.nextAt += d.intervalS; }
        if (S.dispensed - (S._dBase || 0) >= d.count) { S._dBase = S.dispensed; next = true; } break;
      case 'coast': if (S.stepT >= d.s) next = true; break;
      case 'propellant-check': ev('propellant', { t: F.v.stages[F.lastPow].fuel }); next = true; break;
      case 'booster-return': { const b = F.booster; if (!b || b.state !== 'flying' || S.stepT > 1800) { S.booster = boosterResult(F); ev('booster', S.booster); next = true; } break; }
    }
    if (next) { S.idx++; S.stepT = 0; S.nextAt = 0; }
    return S;
  };
  return S;
}
const inBand = (F, o) => { const e = P.orbitOf(F.v); return Math.abs(e.pe - o.altM) <= o.tolM && Math.abs(e.ap - o.altM) <= o.tolM; };
function boosterResult(F) {
  const b = F.booster; if (!b) return { state: 'none' };
  const up = V.norm(b.r), sp = F.ship ? shipPos(F.ship, b.clock, b.earthRot !== false) : null;
  const dist = sp ? Math.acos(Math.max(-1, Math.min(1, V.dot(up, V.norm(sp))))) * P.R : Infinity;
  return { state: b.state, distM: dist, touchV: b.touchV ?? null, msg: F.flags.booster };
}
export function evaluate(m, F, S) {
  const o = P.orbitOf(F.v), b = S.booster || boosterResult(F), res = [];
  for (const q of m.objectives) {
    let pass = false;
    switch (q.kind) {
      case 'orbit': pass = !!F.flags.orbit && !F.flags.dead; break;
      case 'pe-min': pass = o.pe >= q.m; break;
      case 'ap-max': pass = o.ap <= q.m; break;
      case 'band': pass = inBand(F, q); break;
      case 'fairing-sep': pass = !!F.flags.fairing; break;
      case 'stack-release': pass = S.released; break;
      case 'dispensed': pass = S.dispensed >= q.count; break;
      case 'booster-landed': pass = b.state === 'landed'; break;
      case 'booster-catch': pass = b.state === 'landed' && b.distM <= q.radiusM && (b.touchV ?? 99) <= (q.maxSpeed ?? 10); break;
      case 'propellant': pass = F.v.stages[F.lastPow].fuel >= q.minT; break;
      case 'hold': pass = S.holdS >= q.s; break;
    }
    res.push({ id: q.id, label: q.label, pass, points: pass ? q.points || 0 : 0, required: !!q.required });
  }
  const flight = m.scoring && m.scoring.base === 0 ? 0 : F.score();
  const bonus = res.reduce((s, r) => s + r.points, 0), complete = res.every(r => r.pass || !r.required);
  return { complete, objectives: res, flightScore: flight, objectiveScore: bonus, score: complete ? flight + bonus : Math.round((flight + bonus) * 0.5) };
}
// One-tap AUTO, fully headless. Returns { complete, score, objectives, log, flight }.
export function runMission(m, opts = {}) {
  const v = validateMission(m); if (!v.ok) throw new Error('invalid mission: ' + v.err.join('; '));
  const design = missionDesign(m), dt = opts.dt || 1 / 25;
  const reserve = m.vehicle.reserve ?? (m.deploy.some(d => d.kind === 'booster-return') ? planBuild(design).minReserve : undefined);
  const S = missionSession(m);
  const r = simulateAuto(design, { dt, reserve: reserve ?? undefined, each: (F) => S.tick(F, dt) });
  const F = r.F;
  for (let t = 0; t < (opts.tPost || 4000) && !S.done && !F.flags.dead; t += dt) { F.step(dt); S.tick(F, dt); }
  const e = evaluate(m, F, S);
  return { ...e, log: S.log, flight: { orbit: r.orbit, ap: P.orbitOf(F.v).ap, pe: P.orbitOf(F.v).pe, booster: F.flags.booster, dead: F.flags.dead, reserve }, F };
}
