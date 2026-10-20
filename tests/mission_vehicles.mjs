// Mission variants + payload items (vehicles/catalog.js). Run: node tests/mission_vehicles.mjs
import { VEHICLES, MISSION_VARIANTS, PAYLOADS } from '../vehicles/catalog.js';
import { deltaV, leoDv } from '../vehicles/perf.js';
import { displayName, NEUTRAL_NAMES } from '../vehicles/brand.js';
import { G0 } from '../physics/constants.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const V = Object.fromEntries(MISSION_VARIANTS.map(v => [v.id, v])), base = VEHICLES.find(v => v.id === 'titan-ss-v3');
for (const id of ['titan-ss-tanker', 'titan-ss-depot', 'titan-ss-lunar', 'titan-ss-mars']) {
  const v = V[id]; ok(!!v, `${id} exists`); if (!v) continue;
  ok(/^spec:/.test(v.src) && NEUTRAL_NAMES[id] && displayName(id) === NEUTRAL_NAMES[id], `${id}: neutral name "${displayName(id)}", ${v.src}`);
  ok(v.base === 'titan-ss-v3' && v.stages[0].prop === base.stages[0].prop && v.stages[0].dry === base.stages[0].dry, `${id}: booster matches titan-ss-v3 (${base.stages[0].prop / 1000} t prop)`);
}
const t = V['titan-ss-tanker'];
ok(t.cargoProp === 150000 && t.cargoProp >= t.cargoPropRange[0] && t.cargoProp <= t.cargoPropRange[1], `tanker load ${t.cargoProp / 1000} t (sourced ~150 t)`);
const dvT = deltaV(t, t.cargoProp, t.reserve), need = leoDv(t);
console.log(`  · tanker Δv with 150 t cargo + recovery reserve: ${dvT.toFixed(0)} m/s vs LEO ${need.toFixed(0)}`);
ok(dvT >= 0.85 * need, `tanker Δv sanity: ≥85% of LEO need with full cargo and reserve (${(dvT / need * 100).toFixed(0)}%)`);
ok(deltaV(t, t.cargoPropRange[0], t.reserve) >= 0.92 * need, `tanker Δv with ${t.cargoPropRange[0] / 1000} t (low end) ≥92% of LEO need`);
const d = V['titan-ss-depot'];
ok(d.storageCap >= base.stages[1].prop && d.est.includes('storageCap') && d.stages[1].est.includes('dry'), `depot storage ${d.storageCap / 1000} t ≥ ship tank, ESTIMATE-flagged`);
ok(deltaV(d, 0, [base.modes[0].reserve[0], 0]) >= leoDv(d), 'depot reaches LEO empty (Δv sanity)');
const shipDv = (v, pay) => { const s = v.stages[1], isp = 0.5 * 350 + 0.5 * 380; return isp * G0 * Math.log((s.dry + s.prop + pay) / (s.dry + pay)); };
for (const id of ['titan-ss-lunar', 'titan-ss-mars']) {
  const v = V[id];
  ok(v.payloadSurface > 0 && Array.isArray(v.est) && v.est.includes('dvNeed'), `${id}: surface payload ${v.payloadSurface / 1000} t present, Δv need ESTIMATE-flagged`);
  const dv = shipDv(v, v.payloadSurface);
  ok(dv >= v.dvNeed, `${id}: refilled ship Δv ${dv.toFixed(0)} m/s with ${v.payloadSurface / 1000} t ≥ need ${v.dvNeed} m/s (EST)`);
}
const L = V['titan-ss-lunar'];
ok(L.est.includes('payloadSurface') && L.stages[1].est.includes('dry') && L.stages[1].dry >= L.stages[1].dryRange[0] && L.stages[1].dry <= L.stages[1].dryRange[1] && L.stages[1].prop === 1200000, 'lunar: payload + dry ESTIMATE, dry in 85–100 t, tank 1,200 t sourced');
ok(!V['titan-ss-mars'].est.includes('payloadSurface'), 'mars: 100 t surface payload sourced (not ESTIMATE)');
const r = PAYLOADS.find(p => p.id === 'roadster-payload');
ok(r && r.mass >= r.massRange[0] && r.mass <= r.massRange[1] && Math.abs(r.mass - 1300) <= 100 && /^spec:/.test(r.src) && NEUTRAL_NAMES[r.id], `roadster-payload: payload item ${r?.mass} kg (~1.3 t), ${r?.src}`);
ok(r && VEHICLES.some(v => v.id === r.carrier) && !VEHICLES.some(v => v.id === r.id), 'roadster-payload is a payload (not a vehicle), carrier exists');
ok(new Set([...VEHICLES, ...MISSION_VARIANTS, ...PAYLOADS].map(x => x.id)).size === VEHICLES.length + MISSION_VARIANTS.length + PAYLOADS.length, 'ids unique across vehicles, variants, payloads');
console.log(`\nmission_vehicles: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
