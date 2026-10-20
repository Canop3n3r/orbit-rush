// Data-only vehicles (vehicles/catalog.js): sourced numbers vs the rocket equation. Run: node tests/vehicles.mjs
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
import { deltaV, payloadToLEO, LEO_DV } from '../vehicles/perf.js';
import { displayName, setBrandPack } from '../vehicles/brand.js';
let pass = 0, fail = 0, gaps = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const TOL = 0.08, within = (a, b) => Math.abs(a / b - 1) <= TOL, pct = (a, b) => ((a / b - 1) * 100).toFixed(1) + '%';
const REAL = /falcon|starship|dragon|merlin|raptor|spacex|kestrel|starlink/i;
ok(new Set(VEHICLES.map(v => v.id)).size === VEHICLES.length, `${VEHICLES.length} vehicles, unique ids`);
for (const [id, e] of Object.entries(ENGINES)) ok(e.ispVac > 0 && e.tVac > 0 && (e.tSl === 0 || (e.tSl < e.tVac && e.ispSl < e.ispVac)), `engine ${id}: SL ≤ vac thrust and Isp`);
for (const v of VEHICLES) {
  ok(!REAL.test(displayName(v.id)), `${v.id}: neutral default name "${displayName(v.id)}"`);
  ok(v.stages.every(s => s.recovery && s.dry > 0 && s.prop > 0 && Object.keys(s.engines).every(id => ENGINES[id])), `${v.id}: stages have engines, masses, recovery mode`);
  if (v.liftoff) { const m = v.stages.reduce((t, s) => t + s.dry + s.prop, 0) + v.payloadLEO + (v.fairing || 0); ok(within(m, v.liftoff), `${v.id}: liftoff ${(m / 1000).toFixed(0)} t vs sourced ${(v.liftoff / 1000).toFixed(0)} t (${pct(m, v.liftoff)})`); }
  const want = v.capacityLEO || v.payloadLEO, dv = deltaV(v, want), cap = payloadToLEO(v);
  const checks = [[within(dv, LEO_DV), `${v.id}: Δv ${dv.toFixed(0)} m/s with ${(want / 1000).toFixed(1)} t vs LEO ${LEO_DV} (${pct(dv, LEO_DV)})`],
                  [within(cap, want), `${v.id}: payload to LEO ${(cap / 1000).toFixed(1)} t vs sourced ${(want / 1000).toFixed(1)} t (${pct(cap, want)})`]];
  for (const [c, m] of checks) { if (!c && v.knownGap) { gaps++; console.log('  ⚠', m, '— KNOWN GAP:', v.knownGap); } else ok(c, m); }
  if (v.capsule) ok(cap >= v.capsule.launch, `${v.id}: capacity covers the ${(v.capsule.launch / 1000).toFixed(1)} t capsule`);
}
setBrandPack({ 'heron-9': 'Brand X' }); ok(displayName('heron-9') === 'Brand X' && displayName('sparrow-1') !== 'sparrow-1', 'brand pack overrides, neutral fallback');
console.log(`\nvehicles: ${pass} passed, ${fail} failed, ${gaps} known gaps (tolerance ±${TOL * 100}%)`); if (fail) process.exit(1);
