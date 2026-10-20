// Missions module: schema validation, brand lookup, and every mission on this branch flown headless on
// one-tap AUTO until it completes and scores.
import { runMission, missionDesign } from '../missions/runner.js';
import { validateMission } from '../missions/schema.js';
import { brandName, setBrandPack } from '../missions/brand.js';
import { loadMissions, MISSION_IDS } from '../missions/catalog.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const BRANDS = /spacex|starlink|falcon|dragon|starship|super ?heavy|mechazilla/i;
ok(!validateMission({ id: 'Bad Id' }).ok, 'schema rejects a bad mission');
ok(brandName('medium-reusable-launcher') === 'medium reusable launcher', 'neutral vehicle role name');
setBrandPack({ names: { 'constellation-batch': 'Private Label' } }); ok(brandName('constellation-batch') === 'Private Label', 'brand pack overrides'); setBrandPack(null);
ok(brandName('constellation-batch') === 'Constellation batch', 'pack removed: neutral again');
const ms = await loadMissions(); ok(ms.length >= 1, 'catalog loads missions: ' + ms.map(m => m.id).join(', '));
for (const m of ms) {
  ok(MISSION_IDS.includes(m.id), m.id + ' listed in catalog');
  const v = validateMission(m); ok(v.ok, m.id + ' valid ' + v.err.join('; '));
  ok(!BRANDS.test(JSON.stringify(m)) && !BRANDS.test(missionDesign(m).name), m.id + ': no real brand names in public data');
  const t = Date.now(), r = runMission(m);
  for (const o of r.objectives) ok(o.pass || !o.required, `${m.id}: ${o.label}`);
  ok(r.complete, `${m.id} completes on AUTO (${r.objectives.filter(o => o.pass).length}/${r.objectives.length} objectives, booster: ${r.flight.booster})`);
  ok(r.score > r.flightScore && r.objectiveScore > 0, `${m.id} scores ${r.score} (flight ${r.flightScore} + objectives ${r.objectiveScore})`);
  console.log(`  ${m.id}: score ${r.score}, Ap ${(r.flight.ap / 1e3).toFixed(0)} km Pe ${(r.flight.pe / 1e3).toFixed(0)} km, ${r.objectives.map(o => (o.pass ? '✓' : '✗') + o.id).join(' ')}, ${Date.now() - t} ms`);
}
console.log(`missions: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
