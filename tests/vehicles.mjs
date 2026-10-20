// Data-only vehicles (vehicles/catalog.js) vs the rocket-equation model (vehicles/perf.js). Run: node tests/vehicles.mjs
// Every payload figure is checked in the recovery mode it was quoted for; hard ±8 % tolerance; the only exception is a documented payloadBand (see catalog comment).
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
import { deltaV, payloadToLEO, leoDv } from '../vehicles/perf.js';
import { displayName, setBrandPack, NEUTRAL_NAMES } from '../vehicles/brand.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const TOL = 0.08, within = (a, b) => Math.abs(a / b - 1) <= TOL, pct = (a, b) => ((a / b - 1) * 100).toFixed(1) + '%';
ok(new Set(VEHICLES.map(v => v.id)).size === VEHICLES.length, `${VEHICLES.length} vehicles, unique ids`);
for (const [id, e] of Object.entries(ENGINES)) ok(e.ispVac > 0 && e.tVac > 0 && (e.tSl === 0 || (e.tSl < e.tVac && e.ispSl < e.ispVac)) && /^spec:/.test(e.src), `engine ${id}: SL ≤ vac thrust and Isp, neutral spec ref`);
for (const v of VEHICLES) {
  ok(NEUTRAL_NAMES[v.id] && displayName(v.id) === NEUTRAL_NAMES[v.id] && /^spec:/.test(v.src), `${v.id}: neutral default name "${displayName(v.id)}", ${v.src}`);
  ok(v.stages.every(s => s.recovery && s.dry > 0 && s.prop > 0 && Object.keys(s.engines).every(id => ENGINES[id])), `${v.id}: stages have engines, masses, recovery mode`);
  if (v.liftoff) { const m = v.stages.reduce((t, s) => t + s.dry + s.prop, 0) + v.modes[0].payloadLEO + (v.fairing || 0); ok(within(m, v.liftoff), `${v.id}: liftoff ${(m / 1000).toFixed(0)} t vs sourced ${(v.liftoff / 1000).toFixed(0)} t (${pct(m, v.liftoff)})`); }
  for (const md of v.modes) {
    const need = leoDv(v), dv = deltaV(v, md.payloadLEO, md.reserve), cap = payloadToLEO(v, md.reserve);
    ok(within(dv, need), `${v.id} [${md.mode}]: Δv ${dv.toFixed(0)} m/s with ${(md.payloadLEO / 1000).toFixed(1)} t vs LEO ${need.toFixed(0)} (${pct(dv, need)})`);
    if (md.payloadBand) ok(cap >= md.payloadBand[0] && cap <= md.payloadBand[1], `${v.id} [${md.mode}]: payload to LEO ${(cap / 1000).toFixed(1)} t within documented band ${md.payloadBand.map(x => x / 1000).join('-')} t (${md.src})`);
    else ok(within(cap, md.payloadLEO), `${v.id} [${md.mode}]: payload to LEO ${(cap / 1000).toFixed(1)} t vs sourced ${(md.payloadLEO / 1000).toFixed(1)} t (${pct(cap, md.payloadLEO)})`);
    if (v.capsule) ok(cap >= v.capsule.launch, `${v.id}: capacity covers the ${(v.capsule.launch / 1000).toFixed(1)} t capsule`);
  }
}
setBrandPack({ 'heron-9': 'Brand X' }); ok(displayName('heron-9') === 'Brand X' && displayName('sparrow-1') === NEUTRAL_NAMES['sparrow-1'], 'brand pack overrides, neutral fallback');
console.log(`\nvehicles: ${pass} passed, ${fail} failed (tolerance ±${TOL * 100}%)`); if (fail) process.exit(1);
