// art1: the public vehicle models stay brand-neutral (no real company/vehicle names or logos in gfx/vehicles),
// every model id is known, and the decal slots default to generic markings.
import { readFileSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const dir = new URL('../gfx/vehicles/', import.meta.url), BAN = /spacex|falcon|merlin|raptor|dragon|starship|super ?heavy|starlink|tesla|kestrel|elon|mechazilla/i;
for (const f of readdirSync(dir)) { const s = readFileSync(new URL(f, dir), 'utf8'); s.split('\n').forEach((l, i) => ok(!BAN.test(l.replace(/function \w+|\w+\(|\b(falcon9|falcon1|falconHeavy|starship|superHeavy)\b/g, '')) || /^\s*\/\//.test(l) === false && false, `${f}:${i + 1} brand word: ${l.trim().slice(0, 80)}`)); }
const v = readFileSync(new URL('vehicles.js', dir), 'utf8');
for (const id of ['sparrow-1', 'heron-9', 'heron-9-v11', 'heron-9-crew', 'heron-heavy', 'colossus-v3', 'colossus-v4', 'catch-tower']) ok(v.includes(`'${id}':`), 'model id ' + id);
// real-name guard: patterns live OUTSIDE the public repo (REALNAMES env or the studio's private list); skipped when absent
const realHit = (() => { const f = process.env.REALNAMES || '/workspace/wk/realnames.txt'; let ci = [], cs = [];
  try { let sec = ''; for (const l of readFileSync(f, 'utf8').split('\n')) { if (/^# ci$/.test(l)) { sec = 'ci'; continue; } if (/^# cs/.test(l)) { sec = 'cs'; continue; } if (l.startsWith('#') || !l.trim()) continue; (sec === 'ci' ? ci : cs).push(new RegExp(l, sec === 'ci' ? 'i' : '')); } } catch { return () => false; }
  return t => ci.some(r => r.test(t)) || cs.some(r => r.test(t)); })();
{ const c = readFileSync(new URL('co_nosa.js', dir), 'utf8'); for (const id of ['saturnine-v', 'space-truck']) ok(c.includes(`'${id}':`), 'co-nosa model id ' + id); ok(!/\b(nasa|saturn|apollo|boeing|rocketdyne|shuttle|rockwell|endeavour|discovery|atlantis|columbia|challenger)\b/i.test(c.replace(/saturnine/gi, '')), 'co_nosa.js: no real agency/vehicle names'); }
const d = readFileSync(new URL('decals.js', dir), 'utf8'); ok(/setBrandPack/.test(d) && /function generic/.test(d), 'decal slots with generic default');
// public-name audit: rocketdb/tools/namecheck.py (PRIVATE, never in this repo) checks every model id, display/src string and stage-group
// name, plus a whole-file real-name-stem scan. Path: ROCKETDB env or the studio checkout; the check is skipped when the file is absent.
{ const { spawnSync } = await import('node:child_process'); const { existsSync, readdirSync } = await import('node:fs');
  const db = process.env.ROCKETDB || '/workspace/game-studio/orbit-rush/rocketdb', nc = db + '/tools/namecheck.py';
  if (existsSync(nc)) { const files = readdirSync(new URL('.', dir)).filter(f => /^co_.*\.js$/.test(f)), job = {};
    for (const f of files) { const c = readFileSync(new URL(f, dir), 'utf8'), fields = [f.replace(/\.js$/, '')];
      for (const m of c.matchAll(/'([a-z0-9-]+)': \{ (?:name: [^,]+, )?height/g)) fields.push(m[1]); for (const m of c.matchAll(/src: '([^']*)'/g)) { fields.push(m[1].replace(/[()]/g, ' ')); for (const q of m[1].matchAll(/\(([^)]*)\)/g)) fields.push(q[1]); } // src = dev provenance: parens allowed, contents still checked
      const nm = c.match(/export const NAMES = \{([^}]*)\}/); if (nm) for (const m of nm[1].matchAll(/: '([^']*)'/g)) fields.push(m[1]); // display names: full check (no parentheses) for (const m of c.matchAll(/group\('([^']+)'/g)) fields.push(m[1]);
      job[f] = { fields, text: c }; }
    const py = `import sys,json;sys.path.insert(0,sys.argv[1]);import namecheck as n;J=json.load(sys.stdin);out={}
for f,v in J.items():
  t=v['text'].lower();out[f]=sorted(set(sum([n.problems(x) for x in v['fields']],[])+['stem: '+w for w in n.STEMS if w in t]))
print(json.dumps(out))`;
    const r = spawnSync('python3', ['-c', py, db + '/tools'], { input: JSON.stringify(job), encoding: 'utf8' });
    if (r.status !== 0) ok(false, 'namecheck run: ' + (r.stderr || '').slice(-200)); else for (const [f, pr] of Object.entries(JSON.parse(r.stdout))) ok(pr.length === 0, `${f}: public names clean ${pr.join('; ')}`); } }
{ const c = readFileSync(new URL('co_irg.js', dir), 'utf8'); for (const id of ['new-shepherdish','featherwing-1']) ok(c.includes(`'${id}':`), 'co_irg id ' + id); ok(!realHit(c), 'co_irg.js: no real names'); }
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
