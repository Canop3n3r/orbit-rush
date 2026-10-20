// Stage-1 ascent table (timelines/ascent.js) flown headlessly through AUTO (physics/guidance.js v.ascentTable hook).
// Checks Max-Q time/pressure and MECO altitude against spec:ascent-heron-9#ref within ±15 %. Run: node tests/ascent.mjs
import { ASCENT, sampleAscent } from '../timelines/ascent.js';
import { flyAuto, makeFlight } from '../timelines/sim.js';
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
import { stackGeom, massOf, qCap } from '../physics.js';
import { G0 } from '../physics/constants.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const TOL = 0.15, within = (a, b) => Math.abs(a / b - 1) <= TOL, pct = (a, b) => ((a / b - 1) * 100).toFixed(0) + '%';
{ // heron-9 game data corrections (spec:ascent-heron-9#game)
  const cat = VEHICLES.find(v => v.id === 'heron-9'), { F } = makeFlight('heron-9', { mode: 'drone-ship' }), v = F.v, e = ENGINES['kero-d'];
  const g = stackGeom(v), Afair = Math.PI * 5.2 ** 2 / 4, Abody = Math.PI * 3.7 ** 2 / 4;
  ok(Math.abs(g.A / Afair - 1) < 0.01, `heron-9 drag area at liftoff ${g.A.toFixed(2)} m² = 5.2 m fairing (${Afair.toFixed(2)} m²)`);
  v.fairing = 0; v._g = null; const g2 = stackGeom(v); v.fairing = cat.fairing / 1000; v._g = null;
  ok(Math.abs(g2.A / Abody - 1) < 0.01, `heron-9 drag area after fairing sep ${g2.A.toFixed(2)} m² = 3.7 m body (${Abody.toFixed(2)} m²)`);
  const s0 = v.stages[0], tSl = s0.eng.tv * s0.eng.ispSl / s0.eng.ispVac;
  ok(Math.abs(tSl - e.tSl) < 0.5, `heron-9 SL thrust per engine ${tSl.toFixed(1)} kN = sourced ${e.tSl} kN`);
  const mdot = s0.eng.tv * 1000 * s0.n / (s0.eng.ispVac * G0), tb = s0.fuelMax * 1000 / mdot;
  console.log(`  · mass flow ${(mdot / 1000).toFixed(3)} t/s; full-throttle burnout of ${s0.fuelMax} t: ${tb.toFixed(1)} s (sourced stage burn ${cat.burnTime} s)`);
  ok(Math.abs(tb / 150 - 1) <= 0.08, `heron-9 S1 full-throttle burnout ${tb.toFixed(1)} s vs ~150 s (±8%: ${((tb / 150 - 1) * 100).toFixed(1)}%)`);
  ok(Math.abs(massOf(v) - 536.3) < 1 && s0.fuelMax === 395.7, `heron-9 liftoff mass ${massOf(v).toFixed(1)} t with sourced 395.7 t S1 propellant`);
  ok(v.qFloor === 0.8 && qCap(40000, v.qFloor) === 0.8 && qCap(40000) === 0.4 && qCap(20000, 0.8) === 1, 'AUTO throttle-down floor 0.8 for heron-9 (default 0.4 unchanged)');
}
for (const [id, tab] of Object.entries(ASCENT)) {
  ok(tab.rows.every((r, i) => r.length === 3 && r[2] >= 0.4 && r[2] <= 1 && r[1] >= 0 && r[1] <= 90 && (i === 0 || r[0] > tab.rows[i - 1][0])) && /^spec:/.test(tab.src), `${id}: table rows [t, pitch°, throttle] ordered, throttle within 40–100 %`);
  ok(sampleAscent(tab, 1e4) === null && Math.abs(sampleAscent(tab, 65).throttle - 0.8) < 1e-9, `${id}: interpolation + hand-back after last row`);
  const ref = tab.ref, base = flyAuto(id, { mode: 'drone-ship' }), r = flyAuto(id, { mode: 'drone-ship', ascent: tab });
  console.log(`  · AUTO only : Max-Q ${base.peak.t} s ${(base.peak.q / 1000).toFixed(1)} kPa @ ${(base.peak.alt / 1000).toFixed(1)} km; MECO ${base.meco?.t} s @ ${(base.meco?.alt / 1000).toFixed(1)} km ${base.meco?.v} m/s`);
  console.log(`  · table     : Max-Q ${r.peak.t} s ${(r.peak.q / 1000).toFixed(1)} kPa @ ${(r.peak.alt / 1000).toFixed(1)} km; MECO ${r.meco?.t} s @ ${(r.meco?.alt / 1000).toFixed(1)} km ${r.meco?.v} m/s; orbit ${r.orbit}`);
  ok(within(r.peak.t, ref.maxqT), `${id}: Max-Q time ${r.peak.t} s vs ${ref.maxqT} s (${pct(r.peak.t, ref.maxqT)})`);
  ok(within(r.peak.q, ref.maxqQ), `${id}: Max-Q ${(r.peak.q / 1000).toFixed(1)} kPa vs ${ref.maxqQ / 1000} kPa EST (${pct(r.peak.q, ref.maxqQ)})`);
  ok(r.meco && within(r.meco.alt, ref.mecoAlt), `${id}: MECO altitude ${(r.meco?.alt / 1000).toFixed(1)} km vs ${ref.mecoAlt / 1000} km (${pct(r.meco?.alt, ref.mecoAlt)})`);
  ok(r.orbit, `${id}: upper stage still reaches orbit after the table hands back`);
}
console.log(`\nascent: ${pass} passed, ${fail} failed (tolerance ±${TOL * 100}%)`); if (fail) process.exit(1);
