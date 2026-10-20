// Per-stage engine fields (engineCount, engineName, propellant, nozzleLayout, reusable) on every roster + catalog vehicle.
// Sources: spec:engines_layout. Run: node tests/engines_layout.mjs
import fs from 'fs';
import { VEHICLES, ENGINES } from '../vehicles/catalog.js';
const dir = new URL('../vehicles/roster/', import.meta.url);
const vehicles = VEHICLES.map(v => ({ v, file: 'catalog.js' })); const engines = { ...ENGINES };
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'loss.js')) {
  const m = await import(new URL(f, dir));
  for (const [k, val] of Object.entries(m)) {
    if (k.startsWith('ROSTER_')) for (const v of val) vehicles.push({ v, file: f });
    if (k.startsWith('ENGINES_')) Object.assign(engines, val);
  }
}
const PROPS = ['kerolox', 'methalox', 'hydrolox', 'hypergolic', 'solid'];
const TYPES = ['ring', 'cluster', 'single'];
const REUSABLE_OK = new Set(['heron-9', 'heron-9-v11', 'heron-9-crew', 'heron-heavy', 'colossus-v3', 'colossus-v4', 'new-glendale']);
const FIELDS = ['engineCount', 'engineName', 'propellant', 'nozzleLayout', 'reusable'];
let pass = 0, fail = 0, stages = 0, est = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('FAIL', msg); } };
for (const { v, file } of vehicles) v.stages.forEach((s, i) => {
  const at = `${file} ${v.id} stage ${i}`; stages++;
  const sum = Object.values(s.engines).reduce((a, b) => a + b, 0);
  ok(Number.isInteger(s.engineCount) && s.engineCount >= 1, `${at}: engineCount ${s.engineCount}`);
  ok(s.engineCount === sum, `${at}: engineCount ${s.engineCount} != engines sum ${sum}`);
  const names = String(s.engineName).split('+');
  ok(names.every(n => n in engines && n in s.engines) && names.length === Object.keys(s.engines).length, `${at}: engineName ${s.engineName} not the stage's public engine ids`);
  ok(PROPS.includes(s.propellant), `${at}: propellant ${s.propellant}`);
  const L = s.nozzleLayout;
  ok(L && TYPES.includes(L.type), `${at}: nozzleLayout.type ${L && L.type}`);
  ok(!L || L.type !== 'single' || s.engineCount === 1, `${at}: single layout with ${s.engineCount} engines`);
  if (L && L.positions !== undefined) {
    ok(Array.isArray(L.positions) && L.positions.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)), `${at}: positions malformed`);
    ok(L.positions.length === s.engineCount, `${at}: ${L.positions.length} positions for ${s.engineCount} engines`);
  }
  ok(typeof s.reusable === 'boolean', `${at}: reusable not boolean`);
  ok(!s.reusable || REUSABLE_OK.has(v.id), `${at}: reusable true outside the allowed set`);
  if (s.estimated !== undefined) {
    est++;
    ok(s.estimated === true && Array.isArray(s.estimatedFields) && s.estimatedFields.length > 0 && s.estimatedFields.every(f => FIELDS.includes(f)), `${at}: estimated without valid estimatedFields`);
  } else ok(s.estimatedFields === undefined, `${at}: estimatedFields without estimated`);
});
ok(vehicles.some(({ v }) => v.id === 'new-glendale' && v.stages.some(s => s.reusable)), 'new-glendale has a reusable stage');
console.log(`engines_layout: ${vehicles.length} vehicles, ${stages} stages (${est} with estimated fields)`);
console.log(`engines_layout: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
