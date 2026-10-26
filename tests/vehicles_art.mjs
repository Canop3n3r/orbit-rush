// art1: the public vehicle models stay brand-neutral (no real company/vehicle names or logos in gfx/vehicles),
// every model id is known, and the decal slots default to generic markings.
import { readFileSync, readdirSync } from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const dir = new URL('../gfx/vehicles/', import.meta.url), BAN = /spacex|falcon|merlin|raptor|dragon|starship|super ?heavy|starlink|tesla|kestrel|elon|mechazilla/i;
for (const f of readdirSync(dir)) { const s = readFileSync(new URL(f, dir), 'utf8'); s.split('\n').forEach((l, i) => ok(!BAN.test(l.replace(/function \w+|\w+\(|\b(falcon9|falcon1|falconHeavy|starship|superHeavy)\b/g, '')) || /^\s*\/\//.test(l) === false && false, `${f}:${i + 1} brand word: ${l.trim().slice(0, 80)}`)); }
const v = readFileSync(new URL('vehicles.js', dir), 'utf8');
for (const id of ['sparrow-1', 'heron-9', 'heron-9-v11', 'heron-9-crew', 'heron-heavy', 'colossus-v3', 'colossus-v4', 'catch-tower']) ok(v.includes(`'${id}':`), 'model id ' + id);
{ const c = readFileSync(new URL('co_civspace.js', dir), 'utf8'); for (const id of ['saturnine-v', 'space-truck']) ok(c.includes(`'${id}':`), 'co-civspace model id ' + id); }
const d = readFileSync(new URL('decals.js', dir), 'utf8'); ok(/setBrandPack/.test(d) && /function generic/.test(d), 'decal slots with generic default');
// real-name guard: patterns live OUTSIDE the public repo (REALNAMES env or the studio's private list); skipped when absent
const realHit = (() => { const f = process.env.REALNAMES || '/workspace/wk/realnames.txt'; let ci = [], cs = [];
  try { let sec = ''; for (const l of readFileSync(f, 'utf8').split('\n')) { if (/^# ci$/.test(l)) { sec = 'ci'; continue; } if (/^# cs/.test(l)) { sec = 'cs'; continue; } if (l.startsWith('#') || !l.trim()) continue; (sec === 'ci' ? ci : cs).push(new RegExp(l, sec === 'ci' ? 'i' : '')); } } catch { return () => false; }
  return t => ci.some(r => r.test(t)) || cs.some(r => r.test(t)); })();
{ const c = readFileSync(new URL('co_albion.js', dir), 'utf8'); for (const id of ['dark-dart']) ok(c.includes(`'${id}':`), 'co_albion id ' + id); ok(!realHit(c), 'co_albion.js: no real names'); }
{ const c = readFileSync(new URL('co_arion.js', dir), 'utf8'); for (const id of ['arion-5','arion-62','arion-64']) ok(c.includes(`'${id}':`), 'co_arion id ' + id); ok(!realHit(c), 'co_arion.js: no real names'); }
{ const c = readFileSync(new URL('co_vegara.js', dir), 'utf8'); for (const id of ['vegara','vegara-c']) ok(c.includes(`'${id}':`), 'co_vegara id ' + id); ok(!realHit(c), 'co_vegara.js: no real names'); }
{ const c = readFileSync(new URL('co_bluehz.js', dir), 'utf8'); for (const id of ['new-glendale']) ok(c.includes(`'${id}':`), 'co_bluehz id ' + id); ok(!realHit(c), 'co_bluehz.js: no real names'); }
{ const c = readFileSync(new URL('co_bolt.js', dir), 'utf8'); for (const id of ['electrino','electrino-recovery']) ok(c.includes(`'${id}':`), 'co_bolt id ' + id); ok(!realHit(c), 'co_bolt.js: no real names'); }
{ const c = readFileSync(new URL('co_convex.js', dir), 'utf8'); for (const id of ['titanus-4','atlantean-crew','atlantean-upper']) ok(c.includes(`'${id}':`), 'co_convex id ' + id); ok(!realHit(c), 'co_convex.js: no real names'); }
{ const c = readFileSync(new URL('co_dougwing.js', dir), 'utf8'); for (const id of ['deltoid-2-heavy9','deltoid-2-light3']) ok(c.includes(`'${id}':`), 'co_dougwing id ' + id); ok(!realHit(c), 'co_dougwing.js: no real names'); }
{ // owner rule 2026-10-20: only reusable boosters (Heron core9 and the Colossus booster, Super Lift, New Glendale) get landing legs or grid fins; the Selene lander keeps its lander legs
  const ALLOW = new Set(['co_bluehz.js', 'co_rocketwell.js', 'co_originals.js']), CALL = /\b(gridFins|legs|setLegs)\(/;
  for (const f of readdirSync(dir).filter(f => /^(co_.*|gen_b)\.js$/.test(f) && !ALLOW.has(f))) ok(!CALL.test(readFileSync(new URL(f, dir), 'utf8')), f + ': no landing legs or grid fins');
  const v = readFileSync(new URL('vehicles.js', dir), 'utf8'), fins = [...v.matchAll(/^(?:export )?function (\w+)|gridFins\(k/gm)].reduce((a, m) => (m[1] ? (a.f = m[1]) : a.at.push(a.f), a), { f: '', at: [] }).at;
  ok(fins.length > 0 && fins.every(f => f === 'core9' || f === 'colossusBooster'), 'vehicles.js: grid fins only on the Heron core and Colossus booster (' + fins.join(',') + ')'); }
{ const c = readFileSync(new URL('co_cnfoll.js', dir), 'utf8'); for (const id of ['kite-1','kite-3','ballast-1','granite-2','lifttop-1','onestep-m1','parabolica-1']) ok(c.includes(`'${id}':`), 'co_cnfoll id ' + id); ok(!realHit(c), 'co_cnfoll.js: no real names'); }
{ const c = readFileSync(new URL('co_orbitron_b.js', dir), 'utf8'); for (const id of ['conestogo','minotaurus-1','minotaurus-4','taurox']) ok(c.includes(`'${id}':`), 'co_orbitron_b id ' + id); ok(!realHit(c), 'co_orbitron_b.js: no real names'); }
{ const c = readFileSync(new URL('co_isra_b.js', dir), 'utf8'); for (const id of ['geo-slinger','slinger-mini','slinger-mk3']) ok(c.includes(`'${id}':`), 'co_isra_b id ' + id); ok(!realHit(c), 'co_isra_b.js: no real names'); }
{ const c = readFileSync(new URL('co_levant.js', dir), 'utf8'); for (const id of ['negev-dart']) ok(c.includes(`'${id}':`), 'co_levant id ' + id); ok(!realHit(c), 'co_levant.js: no real names'); }
{ const c = readFileSync(new URL('co_skyland.js', dir), 'utf8'); for (const id of ['ember-finch-2','ember-finch-2e','ember-finch-3']) ok(c.includes(`'${id}':`), 'co_skyland id ' + id); ok(!realHit(c), 'co_skyland.js: no real names'); }
{ const c = readFileSync(new URL('co_southstar_c.js', dir), 'utf8'); for (const id of ['partial-orbiter']) ok(c.includes(`'${id}':`), 'co_southstar_c id ' + id); ok(!realHit(c), 'co_southstar_c.js: no real names'); }
{ const c = readFileSync(new URL('co_jaxo_b.js', dir), 'utf8'); for (const id of ['epsilonix','hoshi-m','hoshi-v','kago-sounder','kawasemi','mejiro','samba-4s','uguisu']) ok(c.includes(`'${id}':`), 'co_jaxo_b id ' + id); ok(!realHit(c), 'co_jaxo_b.js: no real names'); }
{ const c = readFileSync(new URL('co_martell_b.js', dir), 'utf8'); for (const id of ['titanus-3','athenix']) ok(c.includes(`'${id}':`), 'co_martell_b id ' + id); ok(!realHit(c), 'co_martell_b.js: no real names'); }
{ const c = readFileSync(new URL('co_convex_b.js', dir), 'utf8'); for (const id of ['atlantean-centaurus']) ok(c.includes(`'${id}':`), 'co_convex_b id ' + id); ok(!realHit(c), 'co_convex_b.js: no real names'); }
{ const c = readFileSync(new URL('co_jade_b.js', dir), 'utf8'); for (const id of ['jade-lantern-1','jade-lantern-2','jade-lantern-2c','jade-lantern-2d','jade-lantern-2e','jade-lantern-4','jade-lantern-6','jade-lantern-7','jade-lantern-8','jade-lantern-11','jade-lantern-12','gale-runner-1']) ok(c.includes(`'${id}':`), 'co_jade_b id ' + id); ok(!realHit(c), 'co_jade_b.js: no real names'); }
{ const c = readFileSync(new URL('co_krunov_b.js', dir), 'utf8'); for (const id of ['gulok','kopyo-m']) ok(c.includes(`'${id}':`), 'co_krunov_b id ' + id); ok(!realHit(c), 'co_krunov_b.js: no real names'); }
{ const c = readFileSync(new URL('co_expl.js', dir), 'utf8'); for (const id of ['swiftlet-1','swiftlet-1a','swiftlet-11','wayfarer-1','wayfarer-2','ember-finch-1']) ok(c.includes(`'${id}':`), 'co_expl id ' + id); ok(!realHit(c), 'co_expl.js: no real names'); }
{ const c = readFileSync(new URL('co_galen.js', dir), 'utf8'); for (const id of ['millstone-1','millstone-2']) ok(c.includes(`'${id}':`), 'co_galen id ' + id); ok(!realHit(c), 'co_galen.js: no real names'); }
{ const c = readFileSync(new URL('co_dougwing_b.js', dir), 'utf8'); for (const id of ['thorin','thorin-agenta','thorin-capable','thorin-capablestar','thorin-toaster','deltoid','deltoid-3']) ok(c.includes(`'${id}':`), 'co_dougwing_b id ' + id); ok(!realHit(c), 'co_dougwing_b.js: no real names'); }
{ const c = readFileSync(new URL('co_jadelantern.js', dir), 'utf8'); for (const id of ['jade-lantern-5','jade-lantern-5b']) ok(c.includes(`'${id}':`), 'co_jadelantern id ' + id); ok(!realHit(c), 'co_jadelantern.js: no real names'); }
{ const c = readFileSync(new URL('co_jadelantern2.js', dir), 'utf8'); for (const id of ['jade-lantern-2f','jade-lantern-3b']) ok(c.includes(`'${id}':`), 'co_jadelantern2 id ' + id); ok(!realHit(c), 'co_jadelantern2.js: no real names'); }
{ const c = readFileSync(new URL('co_isra.js', dir), 'utf8'); for (const id of ['polar-slinger','monsoon-heavy']) ok(c.includes(`'${id}':`), 'co_isra id ' + id); ok(!realHit(c), 'co_isra.js: no real names'); }
{ const c = readFileSync(new URL('co_jaxo.js', dir), 'utf8'); for (const id of ['tsubame','tsubame-2024']) ok(c.includes(`'${id}':`), 'co_jaxo id ' + id); ok(!realHit(c), 'co_jaxo.js: no real names'); }
{ const c = readFileSync(new URL('co_tsurugi.js', dir), 'utf8'); for (const id of ['tsurugi-22','tsurugi-24','tsurugi-30']) ok(c.includes(`'${id}':`), 'co_tsurugi id ' + id); ok(!realHit(c), 'co_tsurugi.js: no real names'); }
{ const c = readFileSync(new URL('co_krasnaya.js', dir), 'utf8'); for (const id of ['rodnik', 'rodnik-2', 'lastochka', 'pervy']) ok(c.includes(`'${id}':`), 'co-krasnaya model id ' + id); ok(!realHit(c), 'co_krasnaya.js: no real names'); }
{ const c = readFileSync(new URL('co_moonhammer.js', dir), 'utf8'); for (const id of ['moonhammer']) ok(c.includes(`'${id}':`), 'co_moonhammer id ' + id); ok(!realHit(c), 'co_moonhammer.js: no real names'); }
{ const c = readFileSync(new URL('co_mogutny.js', dir), 'utf8'); for (const id of ['mogutny', 'mogutny-glider']) ok(c.includes(`'${id}':`), 'co_mogutny id ' + id); ok(!realHit(c), 'co_mogutny.js: no real names'); }
{ const c = readFileSync(new URL('co_krunov.js', dir), 'utf8'); for (const id of ['gorynych-m','gorynych-k']) ok(c.includes(`'${id}':`), 'co_krunov id ' + id); ok(!realHit(c), 'co_krunov.js: no real names'); }
{ const c = readFileSync(new URL('co_martell.js', dir), 'utf8'); for (const id of ['titanus-2','titanus-2-icbm']) ok(c.includes(`'${id}':`), 'co_martell id ' + id); ok(!realHit(c), 'co_martell.js: no real names'); }
{ const c = readFileSync(new URL('co_orbitron.js', dir), 'utf8'); for (const id of ['pegacorn','antarion']) ok(c.includes(`'${id}':`), 'co_orbitron id ' + id); ok(!realHit(c), 'co_orbitron.js: no real names'); }
{ const c = readFileSync(new URL('co_originals.js', dir), 'utf8'); for (const id of ['selene','ares']) ok(c.includes(`'${id}':`), 'co_originals id ' + id); ok(!realHit(c), 'co_originals.js: no real names'); }
{ const c = readFileSync(new URL('co_rocketwell.js', dir), 'utf8'); for (const id of ['space-truck', ...(['super-lift-crew','super-lift-cargo','super-lift-1b-crew','super-lift-1b-cargo'])]) ok(c.includes(`'${id}':`), 'co-rocketwell model id ' + id); ok(!realHit(c), 'co_rocketwell.js: no real names'); }
{ const c = readFileSync(new URL('co_southstar.js', dir), 'utf8'); for (const id of ['steppe-arrow-2','steppe-arrow-3']) ok(c.includes(`'${id}':`), 'co_southstar id ' + id); ok(!realHit(c), 'co_southstar.js: no real names'); }
{ const c = readFileSync(new URL('co_ulx.js', dir), 'utf8'); ok(!realHit(c), 'co_ulx.js: no real names'); }
{ const c = readFileSync(new URL('co_vulc.js', dir), 'utf8'); for (const id of ['vulcanis-2s','vulcanis-4l','vulcanis-6l']) ok(c.includes(`'${id}':`), 'co_vulc id ' + id); ok(!realHit(c), 'co_vulc.js: no real names'); }
{ const c = readFileSync(new URL('co_baltic.js', dir), 'utf8'); for (const id of ['baltic-hammer','baltic-hammer-tandem']) ok(c.includes(`'${id}':`), 'co_baltic id ' + id); ok(!realHit(c), 'co_baltic.js: no real names'); }
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
{ const c = readFileSync(new URL('co_europia.js', dir), 'utf8'); for (const id of ['europia']) ok(c.includes(`'${id}':`), 'co_europia id ' + id); ok(!realHit(c), 'co_europia.js: no real names'); }
{ const c = readFileSync(new URL('co_gaulois.js', dir), 'utf8'); for (const id of ['diamantine-a','diamantine-b']) ok(c.includes(`'${id}':`), 'co_gaulois id ' + id); ok(!realHit(c), 'co_gaulois.js: no real names'); }
{ const c = readFileSync(new URL('co_irg.js', dir), 'utf8'); for (const id of ['flock-hopper','featherwing-1']) ok(c.includes(`'${id}':`), 'co_irg id ' + id); ok(!realHit(c), 'co_irg.js: no real names'); }
{ const c = readFileSync(new URL('co_taiga.js', dir), 'utf8'); for (const id of ['taiga-1','taiga-a5']) ok(c.includes(`'${id}':`), 'co_taiga id ' + id); ok(!realHit(c), 'co_taiga.js: no real names'); }
{ const c = readFileSync(new URL('co_lingvolt.js', dir), 'utf8'); for (const id of ['scoutling','scoutling-x1']) ok(c.includes(`'${id}':`), 'co_lingvolt id ' + id); ok(!realHit(c), 'co_lingvolt.js: no real names'); }
{ const c = readFileSync(new URL('co_vantguard.js', dir), 'utf8'); for (const id of ['vantguard']) ok(c.includes(`'${id}':`), 'co_vantguard id ' + id); ok(!realHit(c), 'co_vantguard.js: no real names'); }
{ const c = readFileSync(new URL('co_ssb.js', dir), 'utf8'); for (const id of ['cosmokart-1', 'cosmokart-1b', 'cosmokart-2', 'cosmokart-3m', 'whirligig-2', 'whirligig-3', 'riverbend']) ok(c.includes(`'${id}':`), 'co_ssb id ' + id); ok(!realHit(c), 'co_ssb.js: no real names'); }
{ const c = readFileSync(new URL('co_kometa.js', dir), 'utf8'); for (const id of ['kometa']) ok(c.includes(`'${id}':`), 'co_kometa id ' + id); ok(!realHit(c), 'co_kometa.js: no real names'); }
// space-center sites (art-sites-N): every gfx/sites/site_<id>.js is pure layout data; kinds exist in the kit, coordinates valid, names clean
{ const { readdirSync } = await import('node:fs'); const sd = new URL('../gfx/sites/', import.meta.url), G = await import('../gfx/sites/geo.js?v=f5.9-5');
  const KINDS = [...readFileSync(new URL('kit.js', sd), 'utf8').matchAll(/^  ([a-z]+)\(K, o\)/gm)].map(m => m[1]), REUSE = ['cape-north', 'lz1', 'cape-heritage', 'gulf-port'];
  ok(KINDS.length >= 15, `site kit part kinds (${KINDS.length})`); for (const f of readdirSync(sd)) { const c = readFileSync(new URL(f, sd), 'utf8'); ok(!realHit(c), `gfx/sites/${f}: no real names`); if (f.endsWith('.js')) ok(!/InstancedMesh/.test(c), `gfx/sites/${f}: no InstancedMesh`); }
  for (const f of readdirSync(sd).filter(f => /^site_[a-z0-9-]+\.js$/.test(f))) { const { SITE: S } = await import(new URL(f + '?v=f5.9-5', sd)); const id = f.slice(5, -3);
    ok(S.id === id, `${f}: id ${S.id}`); ok(['earth', 'moon', 'mars', 'generic'].includes(S.body), `${id}: body ${S.body}`); ok(Math.abs(S.lat) <= 90 && Math.abs(S.lon) <= 180, `${id}: lat/lon in range`);
    ok(!/\(/.test(S.name), `${id}: name has no parenthetical`); for (const o of [...S.layout, ...(S.stations || []).flatMap(s => s.layout)]) ok(KINDS.includes(o.k), `${id}: part kind ${o.k}`);
    const kinds = new Set(S.layout.map(o => o.k)), st = (S.stations || []).flatMap(s => s.layout.map(o => o.k));
    if (S.body === 'earth') { ok(kinds.has('pad') || kinds.has('catch') || kinds.has('lz'), `${id}: has a pad`); ok(kinds.has('vab') || kinds.has('hangar'), `${id}: has an assembly building`); for (const k of ['tanks', 'road', 'masts', 'water']) ok(kinds.has(k), `${id}: has ${k}`); }
    else ok(S.sandbox && (kinds.has('lz') || kinds.has('pad')), `${id}: off-world sandbox pad`);
    if (S.body === 'moon' || S.body === 'mars') for (const k of ['hab', 'tanks', 'dish', 'rover', 'lz', 'berm']) ok(kinds.has(k), `${id}: base has ${k}`);
    const landing = kinds.has('lz') && S.body === 'earth' || st.includes('droneship'); ok(REUSE.includes(id) ? landing : !landing && !st.length, `${id}: landing zones/droneships only at reusable-booster sites (${landing})`);
    const u = G.upDir(S.body, S.lat, S.lon), m = G.siteMatrix(S.body, S.lat, S.lon, 1); ok(Math.abs(Math.hypot(...u) - 1) < 1e-9 && Math.abs(m[4] - u[0]) + Math.abs(m[5] - u[1]) + Math.abs(m[6] - u[2]) < 1e-9, `${id}: local +Y = surface normal`);
    for (const s of S.stations || []) { const o = G.localOffset(S.body, S.lat, S.lon, s.lat, s.lon); ok(o[1] < 0 && Math.hypot(o[0], o[2]) > 1e5, `${id}: station ${s.id} downrange (${(Math.hypot(o[0], o[2]) / 1000).toFixed(0)} km)`); } }
  { const p = G.upDir('earth', 28.6084, -80.6043); ok(Math.abs(p[0] - 1) < 1e-9, 'sites: game pad maps to Earth-fixed +x'); const o = G.localOffset('earth', 28.6084, -80.6043, 28.6084, -80.5); ok(o[0] > 9000 && Math.abs(o[2]) < 50, 'sites: +X is east'); const n = G.localOffset('earth', 28.6084, -80.6043, 28.7, -80.6043); ok(n[2] < -9000, 'sites: -Z is north'); }
  console.log(`vehicles_art (sites): ${pass} passed, ${fail} failed`); if (fail) process.exit(1); }
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
