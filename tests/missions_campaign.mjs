// Anti-cheese regressions for the campaign-era missions (style of the Playtest QA headless reports) plus the
// five LOW items from the PR #7 re-review (missions_pr7_2026-10-20).
import * as P from '../physics.js?v=f2';
import { Flight } from '../flight.js?v=f2';
import { runMission, missionDesign, missionSession, evaluate, applyMission, missionFlightOpts, FAIL_MULT } from '../missions/runner.js';
import { validateMission } from '../missions/schema.js';
import { loadMissions } from '../missions/catalog.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const ms = Object.fromEntries((await loadMissions()).map(m => [m.id, m])), obj = (e, id) => e.objectives.find(o => o.id === id);
const NEW = ['first-orbit', 'station-rendezvous', 'sso-rideshare', 'gto-comsat', 'roadster-helio', 'super-heavy-catch', 'ship-transfer', 'lunar-landing', 'mars-ship'];
const LEO = ['first-orbit', 'station-rendezvous', 'sso-rideshare', 'gto-comsat', 'super-heavy-catch', 'ship-transfer'];
const best = {};
const dies = m => runMission(m, { each: F => { if (F.met > 90 && !F.flags.orbit) { if (F.autoOn || F.v.auto) F.setAuto(false, true); F.v.ut = 0; F.v.throttle = 0; } } });
for (const id of NEW) {
  const m = ms[id]; ok(!!m, id + ' in catalog'); const r = runMission(m); best[id] = r.score;
  ok(r.complete, `${id} completes headless (${r.score})`);
  // pad win / forged session
  const F = applyMission(m, new Flight(missionDesign(m), {}, missionFlightOpts(m))), S = missionSession(m).attach(F); for (let i = 0; i < 2000; i++) { F.step(0.04); S.tick(F); }
  Object.assign(S, { phase: 'deploy', done: true, idx: 99, releasedT: 1, dispensed: 999, holdS: 1e9, docked: true, transferred: 99 });
  const e = evaluate(m, F, S); ok(!e.complete && e.objectiveScore === 0, `${id}: pad + forged session earns nothing (${e.score})`);
  // lazy player (never does the post-orbit task)
  const lz = runMission(m, { player: false, postFrames: 60000 }); ok(!lz.complete && lz.score <= 0.15 * r.score, `${id}: skipping the player task fails (${lz.score} ≤ 15% of ${r.score})`);
  if (validateMission(m).ok && m.vehicle.gameMassT != null) for (const g of [NaN, 0, -1, 1e6]) ok(!validateMission({ ...m, vehicle: { ...m.vehicle, gameMassT: g } }).ok, `${id}: rejects gameMassT ${g}`);
}
for (const id of LEO) { const d = dies(ms[id]); ok(!d.complete && d.objectiveScore === 0 && d.score <= 0.15 * best[id], `${id}: dying mid-ascent earns ≤ 15% (${d.score})`); }
// dt independence on the new drivers
for (const id of ['station-rendezvous', 'gto-comsat']) { const a = runMission(ms[id], { dt: 1 / 25 }), b = runMission(ms[id], { dt: 0.2 }); ok(a.score === b.score, `${id}: same score at dt 1/25 and 0.2 (${a.score}, ${b.score})`); }
// rendezvous / dock / transfer gates are real
{ const m = ms['ship-transfer'], hard = { ...m, deploy: m.deploy.map(d => d.kind === 'dock' ? { ...d, relV: 1e-4, timeoutS: 300 } : d) }, r = runMission(hard);
  ok(!obj(r, 'dock').pass && !obj(r, 'xfer').pass && !r.complete, 'ship-transfer: no transfer without a real dock'); }
{ const m = ms['station-rendezvous'], r = runMission(m); const g = r.log.filter(e => e.k === 'gate').map(e => e.range); ok(g.length === 3 && g[0] > g[1] && g[1] > g[2], 'rendezvous gates crossed in order of closing range: ' + g.map(x => x.toFixed(0)).join(' > ')); }
// recovery layer
{ const m = ms['gto-comsat'], r = runMission({ ...m, vehicle: { ...m.vehicle, recovery: { ...m.vehicle.recovery, sideReserveFrac: 0.01 } } });
  ok(!obj(r, 'side').pass && !r.complete, 'gto-comsat: side boosters without an RTLS reserve are lost and the mission fails'); }
{ const r = runMission(ms['gto-comsat']); ok(r.recovery.side.mode === 'rtls' && r.recovery.side.distM < 2000 && r.recovery.core.mode === 'droneship' && r.recovery.core.lands, `gto-comsat: side RTLS ${r.recovery.side.distM.toFixed(0)} m from the pad, core on the droneship`); }
{ const r = runMission(ms['super-heavy-catch'], { player: false, postFrames: 20000 }); ok(!obj(r, 'catch').pass, 'super-heavy: AUTO alone does not get the catch (the player flies it)'); }
{ const r = runMission(ms['sso-rideshare']); ok(Math.abs(r.flight.incl - 97.6) < 0.3, 'sso: plane 97.6° reached ' + r.flight.incl.toFixed(2)); }
{ const r = runMission(ms['roadster-helio']); ok(r.flight.body === 'sun' && r.F.v && P.orbitOf(r.F.v).ra > 1.4 * 1.496e11, 'roadster: heliocentric, aphelion past 1.4 AU'); }
// ---- PR #7 re-review LOW items ----
{ const m = ms['crew-dock'], win = runMission(m).score, lz = runMission(m, { player: false, postFrames: 60000 }), over = runMission({ ...m, deploy: m.deploy.map(d => d.kind === 'transfer' ? { ...d, apM: 300000, peM: 300000 } : d) });
  ok(FAIL_MULT <= 0.15 && lz.score <= 0.15 * win && over.score <= 0.15 * win, `LOW1 failed runs ≤ 15% of a win (lazy ${lz.score}, overshoot ${over.score}, win ${win})`);
  ok(!obj(lz, 'dock').pass, 'LOW2 crew-dock hold counts time in the band (lazy run: long on orbit, never in band → dock ✗)');
  const a = applyMission({ ...m, vehicle: { ...m.vehicle, gameMassT: 3 } }, new Flight(missionDesign(m))), b = applyMission({ ...m, vehicle: { ...m.vehicle, gameMassT: 5 } }, new Flight(missionDesign(m)));
  ok(Math.abs(P.massOf(b.v) - P.massOf(a.v) - 2) < 1e-6, 'LOW3 crew-dock capsule mass is tunable (payload part = crew pod)'); }
{ const m = ms['constellation-batch'], lo = runMission({ ...m, vehicle: { ...m.vehicle, gameMassT: 1 } }), hi = runMission({ ...m, vehicle: { ...m.vehicle, gameMassT: 3 } });
  ok(lo.complete && hi.complete && lo.score <= hi.score, `LOW4 a lighter payload is not rewarded (1 t ${lo.score} ≤ 3 t ${hi.score})`); }
{ const m = ms.rideshare, r = runMission({ ...m, deploy: m.deploy.map(d => d.kind === 'transfer' ? { ...d, apM: 400000, peM: 380000 } : d) });
  ok(!obj(r, 'dropoff').pass && !obj(r, 'release').pass && !obj(r, 'all').pass, 'LOW5 rideshare: missed drop-off orbit → no release / dispense ✓'); }
console.log(`missions_campaign: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
