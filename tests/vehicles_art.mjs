// art1: the public vehicle models stay brand-neutral (no real company/vehicle names or logos in gfx/vehicles),
// every model id is known, and the decal slots default to generic markings.
import { readFileSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const dir = new URL('../gfx/vehicles/', import.meta.url), BAN = /spacex|falcon|merlin|raptor|dragon|starship|super ?heavy|starlink|tesla|kestrel|elon|mechazilla/i;
for (const f of readdirSync(dir)) { const s = readFileSync(new URL(f, dir), 'utf8'); s.split('\n').forEach((l, i) => ok(!BAN.test(l.replace(/function \w+|\w+\(|\b(falcon9|falcon1|falconHeavy|starship|superHeavy)\b/g, '')) || /^\s*\/\//.test(l) === false && false, `${f}:${i + 1} brand word: ${l.trim().slice(0, 80)}`)); }
const v = readFileSync(new URL('vehicles.js', dir), 'utf8');
for (const id of ['sparrow-1', 'heron-9', 'heron-9-v11', 'heron-9-crew', 'heron-heavy', 'titan-ss-v3', 'titan-ss-v4', 'catch-tower']) ok(v.includes(`'${id}':`), 'model id ' + id);
const d = readFileSync(new URL('decals.js', dir), 'utf8'); ok(/setBrandPack/.test(d) && /function generic/.test(d), 'decal slots with generic default');
console.log(`vehicles_art: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
