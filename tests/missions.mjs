// Missions module: schema validation, shared brand lookup, vehicle ids, a neutrality scan of every source
// line (code AND comments), and every mission flown headless on one-tap AUTO until it completes and scores.
import { readFileSync, readdirSync } from 'node:fs';
import { runMission, missionDesign, missionName, vehicleOf, vehicleName } from '../missions/runner.js';
import { validateMission } from '../missions/schema.js';
import { setBrandPack } from '../vehicles/brand.js';
import { VEHICLES } from '../vehicles/catalog.js';
import { loadMissions, MISSION_IDS } from '../missions/catalog.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
// Forbidden real-world names, stored ROT13 so this public file never spells them out.
const rot = s => s.replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.charCodeAt(0) - (c <= 'Z' ? 65 : 97) + 13) % 26)));
const BAD = ['fcnprk', 'fgneyvaxf?', 'snypbaf?', 'qentbaf?', 'fgnefuvcf?', 'fhcre ?urnil', 'zrpunmvyyn', 'pubcfgvpxf?', 'encgbef?', 'zreyvaf?', 'SU', 'nfqf', 'zhfx', 'S9'].map(rot);
const BRANDS = new RegExp('\\b(' + BAD.join('|') + ')\\b', 'i');
const here = new URL('..', import.meta.url), walk = d => readdirSync(new URL(d, here), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : [d + e.name]);
// fun/ and brand/ are scanned too; real names may live only in the private brand pack file brand/sx.js.
const BRAND_EXEMPT = new Set(['brand/sx.js']);
const files = [...walk('missions/'), ...walk('fun/'), ...walk('brand/').filter(f => !BRAND_EXEMPT.has(f)), ...readdirSync(new URL('tests/', here)).filter(f => /^(missions|campaign)/.test(f)).map(f => 'tests/' + f)];
for (const f of files) readFileSync(new URL(f, here), 'utf8').split('\n').forEach((l, i) => ok(!BRANDS.test(l), `${f}:${i + 1} neutral (code + comments): ${l.trim().slice(0, 80)}`));
ok(BRANDS.test(rot('fgnefuvc')) && !BRANDS.test('heron-9'), 'scan catches a real name and passes a neutral id');
ok(!validateMission({ id: 'Bad Id' }).ok, 'schema rejects a bad mission');
const ms = await loadMissions(); ok(ms.length === MISSION_IDS.length, 'catalog loads all missions: ' + ms.map(m => m.id).join(', '));
const cb = ms.find(m => m.id === 'constellation-batch');
setBrandPack({ 'constellation-batch': 'Private Label', 'heron-9': 'Private Rocket' });
ok(missionName(cb) === 'Private Label' && vehicleName(cb) === 'Private Rocket', 'brand pack overrides mission + vehicle names');
setBrandPack(null); ok(missionName(cb) === 'Constellation batch', 'no pack: neutral mission name');
for (const m of ms) {
  ok(MISSION_IDS.includes(m.id), m.id + ' listed in catalog');
  const v = validateMission(m); ok(v.ok, m.id + ' valid ' + v.err.join('; '));
  ok(!!vehicleOf(m), `${m.id}: vehicle id '${m.vehicle.vehicleId}' exists in vehicles/catalog.js`);
  if (m.vehicle.capsuleId) ok(VEHICLES.some(x => x.capsule && x.capsule.id === m.vehicle.capsuleId), `${m.id}: capsule id '${m.vehicle.capsuleId}' in catalog`);
  ok(!BRANDS.test(JSON.stringify(m)) && !BRANDS.test(missionDesign(m).name), m.id + ': no real names in data');
  const t = Date.now(), r = runMission(m);
  for (const o of r.objectives) ok(o.pass || !o.required, `${m.id}: ${o.label}`);
  ok(r.complete, `${m.id} completes on AUTO (${r.objectives.filter(o => o.pass).length}/${r.objectives.length} objectives, booster: ${r.flight.booster})`);
  ok(r.score > r.flightScore && r.objectiveScore > 0, `${m.id} scores ${r.score} (flight ${r.flightScore} + objectives ${r.objectiveScore})`);
  console.log(`  ${m.id}: score ${r.score}, Ap ${(r.flight.ap / 1e3).toFixed(0)} km Pe ${(r.flight.pe / 1e3).toFixed(0)} km, ${r.objectives.map(o => (o.pass ? '✓' : '✗') + o.id).join(' ')}, ${Date.now() - t} ms`);
}
console.log(`missions: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
