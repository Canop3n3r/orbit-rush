import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fnv36, RETIRED, canonicalVehicleId, migrateSave } from '../vehicles/id_aliases.js';
assert.equal(fnv36('abc'), (0x1a47e90b).toString(36)); // FNV-1a 32 reference vector
for (const [h, id] of Object.entries(RETIRED)) { assert.match(h, /^[0-9a-z]{4,7}$/); assert.equal(canonicalVehicleId(id), id, 'new ids are canonical'); }
assert.deepEqual(new Set(Object.values(RETIRED)), new Set(['rodnik', 'rodnik-2', 'gorynych']));
assert.equal(canonicalVehicleId('heron-9'), 'heron-9'); assert.equal(canonicalVehicleId(undefined), undefined);
// a save whose stored id hashes to a retired entry migrates (simulate via a forged table entry)
RETIRED[fnv36('old-test-id')] = 'rodnik'; assert.deepEqual(migrateSave({ design: { vehicle: 'old-test-id' } }), { design: { vehicle: 'rodnik' } }); delete RETIRED[fnv36('old-test-id')];
// optional private check against rocketdb when present (never committed): hashes must match the alias map
try { const al = JSON.parse(readFileSync(new URL('../../game-studio/orbit-rush/rocketdb/public_ids_aliases.json', import.meta.url)));
  let n = 0; const walk = o => { for (const [k, v] of Object.entries(o || {})) if (v && typeof v === 'object') { if (Object.values(RETIRED).includes(v.new_id)) { assert.equal(canonicalVehicleId(k), v.new_id); n++; } else walk(v); } };
  walk(al); assert.equal(n, Object.keys(RETIRED).length, 'every retired entry checked against rocketdb');
} catch (e) { if (e.code !== 'ENOENT') throw e; }
// the design data no longer references a retired id
const cc = readFileSync(new URL('../design/career_contracts.js', import.meta.url), 'utf8');
for (const m of cc.matchAll(/vehicle: '([^']+)'/g)) assert.equal(canonicalVehicleId(m[1]), m[1]);
console.log('id_aliases ok');
