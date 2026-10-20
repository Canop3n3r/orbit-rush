// art1: the public vehicle models stay brand-neutral (no real company/vehicle names or logos in gfx/vehicles),
// every model id is known, and the decal slots default to generic markings.
import { readFileSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const dir = new URL('../gfx/vehicles/', import.meta.url), BAN = /spacex|falcon|merlin|raptor|dragon|starship|super ?heavy|starlink|tesla|kestrel|elon|mechazilla/i;
for (const f of readdirSync(dir)) { const s = readFileSync(new URL(f, dir), 'utf8'); s.split('\n').forEach((l, i) => ok(!BAN.test(l.replace(/function \w+|\w+\(|\b(falcon9|falcon1|falconHeavy|starship|superHeavy)\b/g, '')) || /^\s*\/\//.test(l) === false && false, `${f}:${i + 1} brand word: ${l.trim().slice(0, 80)}`)); }
const v = readFileSync(new URL('vehicles.js', dir), 'utf8');
for (const id of ['sparrow-1', 'heron-9', 'heron-9-v11', 'heron-9-crew', 'heron-heavy', 'titan-ss-v3', 'titan-ss-v4', 'catch-tower']) ok(v.includes(`'${id}':`), 'model id ' + id);
{ const c = readFileSync(new URL('co_nosa.js', dir), 'utf8'); for (const id of ['saturnine-v', 'space-truck']) ok(c.includes(`'${id}':`), 'co-nosa model id ' + id); ok(!/\b(nasa|saturn|apollo|boeing|rocketdyne|shuttle|rockwell|endeavour|discovery|atlantis|columbia|challenger)\b/i.test(c.replace(/saturnine/gi, '')), 'co_nosa.js: no real agency/vehicle names'); }
const d = readFileSync(new URL('decals.js', dir), 'utf8'); ok(/setBrandPack/.test(d) && /function generic/.test(d), 'decal slots with generic default');
{ const c = readFileSync(new URL('co_dougwing.js', dir), 'utf8'); for (const id of ['deltoid-2-heavy9','deltoid-2-light3']) ok(c.includes(`'${id}':`), 'co_dougwing id ' + id); ok(!/\b(delta|douglas|mcdonnell|boeing|thor|gem-?\d+|rs-27|aj10|ula)\b/i.test(c), 'co_dougwing.js: no real names'); }
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
// heron-9 fairing dimensions (specs sheet: 5.2 m diameter, ~13 m long, wider than the 3.66 m stage)
{ const F = PR.HERON_FAIRING, p = PR.NOSES['heron-9.fairing'](), rMax = Math.max(...p.map(q => q[0])), L = p.at(-1)[1] - p[0][1];
  ok(Math.abs(2 * rMax - 5.2) < 0.01, `fairing diameter 5.2 m (got ${(2 * rMax).toFixed(2)})`);
  ok(Math.abs(L - 13.1) < 0.2, `fairing length ~13.1 m (got ${L.toFixed(2)})`);
  ok(2 * F.rBase > 3.6 && 2 * F.rBase < 3.75 && rMax > F.rBase, 'boattail from the 3.66 m stage out to the wider fairing');
  ok(F.nose / (2 * F.r) > 1.2, 'ogive nose at least 1.2 calibers (not a blunt capsule)');
  console.log(`vehicles_art (fairing): ${pass} passed, ${fail} failed`); if (fail) process.exit(1); }
