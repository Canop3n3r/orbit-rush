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
// noses/fairings: every profile's narrowest point is its highest point (tips point +Y, away from the engines)
const PR = await import('../gfx/vehicles/profiles.js');
for (const [id, f] of Object.entries(PR.NOSES)) { const p = f().filter((q, i) => i > 0); // skip the closing base point (r 0 at the base)
  const top = p.reduce((a, b) => b[1] > a[1] ? b : a), minR = Math.min(...p.map(q => q[0])), base = p[0];
  ok(top[0] === minR, `${id}: narrowest radius at max Y (top r ${top[0].toFixed(3)}, min r ${minR.toFixed(3)})`);
  ok(base[0] > 0.5 * Math.max(...p.map(q => q[0])), `${id}: wide at the base`);
  let mono = true; for (let i = 1; i < p.length; i++) if (p[i][1] < p[i - 1][1] - 1e-9) mono = false; ok(mono, `${id}: profile goes bottom → top`);
  const tail = p.slice(-6); let dec = true; for (let i = 1; i < tail.length; i++) if (tail[i][0] > tail[i - 1][0] + 1e-9) dec = false; ok(dec, `${id}: radius shrinks toward the tip`); }
ok(Math.abs(PR.ogive(2, 5)[0][0] - 2) < 1e-9 && PR.ogive(2, 5).at(-1)[0] < 0.01, 'ogive: r at base, ~0 at tip');
console.log(`vehicles_art (noses): ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
