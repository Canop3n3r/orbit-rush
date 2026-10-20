// UI step #6: every vehicle/variant has a distinct one-word name and valid reach keys.
import { VEHICLES, MISSION_VARIANTS, REACH_ICONS } from '../vehicles/catalog.js';
import { SHORT_NAMES, shortName, setBrandPack } from '../vehicles/brand.js';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const all = [...VEHICLES, ...(MISSION_VARIANTS || [])];
const seen = new Set();
for (const v of all) {
  const n = SHORT_NAMES[v.id];
  ok(typeof n === 'string' && /^[A-Za-z]+$/.test(n), `${v.id} one-word name (${n})`);
  ok(!seen.has(n), `${v.id} name distinct`); seen.add(n);
  ok(Array.isArray(v.reach) && v.reach.length > 0 && v.reach.every(k => k in REACH_ICONS), `${v.id} reach keys valid`);
  ok(v.reach?.includes('LEO'), `${v.id} reaches LEO`);
  if (v.reach?.includes('GTO')) ok(v.payloadGTO > 0 || v.id === 'titan-ss-v3', `${v.id} GTO backed`);
}
setBrandPack({ 'short:heron-9': 'X' }); ok(shortName('heron-9') === 'X', 'brand pack override'); setBrandPack({});
console.log(`ui_names: ${pass}/${pass + fail}`); if (fail) process.exit(1);
