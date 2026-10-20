// Regression tests for the Playtest QA headless report (missions_headless_2026-10-19), one block per item.
import * as P from '../physics.js?v=f2';
import { Flight } from '../flight.js?v=f2';
import { runMission, missionDesign, missionSession, evaluate, applyMission } from '../missions/runner.js';
import { validateMission } from '../missions/schema.js';
import { loadMissions } from '../missions/catalog.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const ms = Object.fromEntries((await loadMissions()).map(m => [m.id, m]));
const idle = (m, s = 600) => { const F = applyMission(m, new Flight(missionDesign(m))), S = missionSession(m); for (let t = 0; t < s; t += 0.04) { F.step(0.04); S.tick(F); } return { F, S, e: evaluate(m, F, S) }; };
const dies = m => runMission(m, { each: F => { if (F.met > 90 && !F.flags.orbit) { if (F.autoOn || F.v.auto) F.setAuto(false, true); F.v.ut = 0; F.v.throttle = 0; } } });
const obj = (e, id) => e.objectives.find(o => o.id === id);
// (1) refuel cannot be won on the pad or by dying mid-ascent
{ const m = ms.refuel, a = idle(m), b = dies(m);
  ok(!obj(a.e, 'deliver').pass && !a.e.complete && a.e.objectiveScore === 0, `1 refuel idle on pad: deliver ✗, score ${a.e.score}`);
  ok(!b.flight.orbit && !obj(b, 'deliver').pass && b.objectiveScore === 0, `1 refuel dying mid-ascent: deliver ✗, score ${b.score} (${b.flight.dead || 'suborbital'})`);
  ok(runMission(m).complete, '1 refuel still winnable on AUTO + transfer'); }
// (2) gameMassT affects the flight and is validated
{ const m = ms['constellation-batch'];
  for (const g of [NaN, 0, -5, 1e6, '3', Infinity]) ok(!validateMission({ ...m, vehicle: { ...m.vehicle, gameMassT: g } }).ok, '2 rejects gameMassT ' + String(g));
  ok(validateMission(m).ok, '2 accepts the mission mass');
  const mk = g => ({ ...m, vehicle: { ...m.vehicle, gameMassT: g } });
  const F1 = applyMission(mk(1), new Flight(missionDesign(m))), F8 = applyMission(mk(8), new Flight(missionDesign(m)));
  ok(Math.abs(P.massOf(F8.v) - P.massOf(F1.v) - 7) < 1e-6, `2 liftoff mass follows gameMassT (+${(P.massOf(F8.v) - P.massOf(F1.v)).toFixed(2)} t)`);
  let threw = false; try { runMission({ ...ms['crew-dock'], vehicle: { ...ms['crew-dock'].vehicle, gameMassT: 10 } }); } catch (e) { threw = /payload part/.test(e.message); }
  ok(threw, '2 gameMassT on a template without the payload part is rejected (not silently ignored)');
  const r1 = runMission(mk(1)), r6 = runMission(mk(6));
  const s1 = r1.F.v.stages[r1.F.lastPow].fuel, s6 = r6.F.v.stages[r6.F.lastPow].fuel;
  ok(s6 < s1 - 0.5, `2 heavier payload burns more upper-stage fuel (${s1.toFixed(2)} t left at 1 t vs ${s6.toFixed(2)} t at 6 t)`); }
// (3) failed runs get no objective credit unless partial
{ const m = ms['constellation-batch'], a = dies(m);
  ok(!a.complete && a.objectiveScore === 0 && a.score === Math.round(a.flightScore * 0.5), `3 failed run: objectives 0, score = flight/2 (${a.score})`);
  const mp = { ...m, objectives: m.objectives.map(o => o.id === 'booster' ? { ...o, partial: true } : o) }, b = dies(mp), bo = obj(b, 'booster');
  ok(!b.complete && b.objectiveScore === (bo.pass ? bo.points : 0), `3 partial objective keeps its points on failure (booster ${bo.pass ? '✓' : '✗'}, ${b.objectiveScore})`); }
// (4) evaluate() does not trust a forged session
{ const m = ms['constellation-batch'], F = new Flight(missionDesign(m)), S = missionSession(m);
  Object.assign(S, { phase: 'deploy', orbitT: 0, releasedT: 1, dispensed: 999, holdS: 1e9, propT: 99, done: true });
  const e = evaluate(m, F, S); ok(!obj(e, 'release').pass && !obj(e, 'dispense').pass && e.objectiveScore === 0, '4 forged session on the pad: no release / dispense credit');
  const c = ms['crew-dock'], Sc = Object.assign(missionSession(c), { phase: 'deploy', orbitT: 0, holdS: 1e9 }); ok(!obj(evaluate(c, new Flight(missionDesign(c)), Sc), 'dock').pass, '4 forged hold time on the pad: dock ✗');
  const S3 = Object.assign(missionSession(ms.refuel), { phase: 'deploy', orbitT: 0, propT: 99 }); ok(!obj(evaluate(ms.refuel, new Flight(missionDesign(ms.refuel)), S3), 'deliver').pass, '4 forged propellant check on the pad: deliver ✗');
  const r2 = runMission(m); r2.S.orbitT = r2.F.tAbs + 10; ok(!evaluate(m, r2.F, r2.S).complete, '4 session orbit time in the future is rejected');
  const r3 = runMission(m); r3.S.holdS = 0; r3.S.releasedT = r3.S.orbitT - 5; ok(!obj(evaluate(m, r3.F, r3.S), 'release').pass, '4 release stamped before orbit is rejected'); }
// (5) each mission has its own target orbit and a post-orbit player task
{ const ends = [];
  for (const m of Object.values(ms)) { const r = runMission(m), key = `${Math.round(r.flight.ap / 5e3) * 5}x${Math.round(r.flight.pe / 5e3) * 5}`; ends.push(key);
    ok(r.complete && m.deploy.some(d => d.kind === 'transfer') && r.log.some(e => e.k === 'node'), `5 ${m.id}: player task (transfer burns) done, ends ${(r.flight.ap / 1e3).toFixed(0)} × ${(r.flight.pe / 1e3).toFixed(0)} km`);
    const lazy = runMission(m, { player: false, postFrames: 60000 }); ok(!lazy.complete, `5 ${m.id}: skipping the player task does not complete (score ${lazy.score})`); }
  ok(new Set(ends).size === ends.length, '5 all missions end in different orbits: ' + ends.join(', ')); }
// (6) crew-dock: default AUTO orbit does not satisfy the band; overshoot fails
{ const m = ms['crew-dock'], lazy = runMission(m, { player: false, postFrames: 60000 });
  ok(!obj(lazy, 'band').pass && !obj(lazy, 'dock').pass, `6 default AUTO orbit (${(lazy.flight.ap / 1e3).toFixed(0)} × ${(lazy.flight.pe / 1e3).toFixed(0)} km) misses the band`);
  const over = { ...m, deploy: m.deploy.map(d => d.kind === 'transfer' ? { ...d, apM: 300000, peM: 300000 } : d) }, o = runMission(over);
  ok(!obj(o, 'band').pass && !o.complete && o.objectiveScore === 0, `6 overshoot to ${(o.flight.ap / 1e3).toFixed(0)} km fails (score ${o.score} vs perfect ${runMission(m).score})`); }
// (7) tower-catch: f4 terminal guidance makes the 35 m catch required, and AUTO earns it
{ const m = ms['tower-catch'], z = m.objectives.find(o => o.id === 'zone'), c = m.objectives.find(o => o.id === 'catch');
  ok(/^Land near the tower/.test(z.label) && z.required && c.required && c.radiusM === 35 && runMission(m).objectives.find(o => o.id === 'catch').pass, '7 tower catch (35 m) required and passed on AUTO'); }
// (8) score independent of the frame dt
{ const m = ms['constellation-batch'], a = runMission(m, { dt: 1 / 25 }), b = runMission(m, { dt: 0.2 }), c = runMission(m, { dt: 1 / 60 });
  ok(a.score === b.score && a.score === c.score, `8 same score at dt 1/25, 0.2, 1/60 (${a.score}, ${b.score}, ${c.score})`);
  const S1 = missionSession(m), F = { tAbs: 0, flags: { dead: '' } }; S1.tick(F); F.tAbs = 10; S1.tick(F); ok(S1.tLast === 10, '8 session time is sim time, not caller dt'); }
console.log(`missions_regress: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
