// Stage-1 ascent table (timelines/ascent.js) flown headlessly through AUTO (physics/guidance.js v.ascentTable hook).
// Checks Max-Q time/pressure and MECO altitude against spec:ascent-heron-9#ref within ±15 %. Run: node tests/ascent.mjs
import { ASCENT, sampleAscent } from '../timelines/ascent.js';
import { flyAuto } from '../timelines/sim.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const TOL = 0.15, within = (a, b) => Math.abs(a / b - 1) <= TOL, pct = (a, b) => ((a / b - 1) * 100).toFixed(0) + '%';
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
