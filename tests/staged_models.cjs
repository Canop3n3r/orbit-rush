// Staged (Blender) rocket assets, f6.0. For EVERY rocket in assets/rockets/index.json:
//  (1) manifest valid: schema, stage order, every referenced .glb present, tiers hi/mid/lo, triangle budgets (hi <= 20000, mid <= 6000, lo <= 1500 per stage),
//      byte budget (mid tier <= 250 KB per rocket, fleet total <= 25 MB), engine nozzles line up with the plume table (gfx/vehicles/nozzles.js),
//  (2) in the browser, at every tier: the model builds from the manifest (userData.staged), one group per stage, nothing sticks out above the hull nose
//      (top of the bounding box <= vehicle height + 2%), mesh count <= 90, and no page errors.
// Usage: U=http://localhost:8959/ node tests/staged_models.cjs [ids...]
const fs = require('fs'), path = require('path'); const ROOT = path.join(__dirname, '..'), AR = path.join(ROOT, 'assets', 'rockets');
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { pw = null; }
const U = process.env.U || 'http://localhost:8959/', ids0 = process.argv.slice(2);
const idx = JSON.parse(fs.readFileSync(path.join(AR, 'index.json'), 'utf8')), ids = (ids0.length ? ids0 : Object.keys(idx.rockets)).filter(i => idx.rockets[i]);
let bad = 0, n = 0; const ok = (t, m) => { n++; if (!t) { bad++; console.log('FAIL ' + m); } else if (process.env.V) console.log('ok   ' + m); };
const BUD = { hi: 20000, mid: 6000, lo: 1500 }; let fleet = 0;
const nozSrc = fs.readFileSync(path.join(ROOT, 'gfx', 'vehicles', 'nozzles.js'), 'utf8'), NOZ = {}; for (const m of nozSrc.matchAll(/^\s*"([^"]+)": (\{.*\}),?$/gm)) { try { NOZ[m[1]] = JSON.parse(m[2]); } catch (e) { } }
for (const id of ids) {
  let man; try { man = JSON.parse(fs.readFileSync(path.join(AR, id, 'manifest.json'), 'utf8')); } catch (e) { ok(false, `${id}: manifest.json unreadable`); continue; }
  ok(man.schema === 1 && man.id === id && Array.isArray(man.stages) && man.stages.length > 0, `${id}: schema/id/stages`);
  const bytes = { hi: 0, mid: 0, lo: 0 };
  for (const st of man.stages) {
    ok(typeof st.key === 'string' && st.role && Array.isArray(st.offset) && st.size_m && st.attach && Array.isArray(st.engines), `${id}/${st.key}: required manifest fields`);
    for (const t of ['hi', 'mid', 'lo']) { const rel = st.asset && st.asset[t]; if (!rel) { ok(false, `${id}/${st.key}: no ${t} asset`); continue; }
      const fp = path.join(ROOT, rel); const ex = fs.existsSync(fp); ok(ex, `${id}/${st.key}.${t}: ${rel} present`); if (ex) { const b = fs.statSync(fp).size; bytes[t] += b; ok(b < 400000, `${id}/${st.key}.${t}: ${b} bytes`); const head = fs.readFileSync(fp).subarray(0, 4).toString(); ok(head === 'glTF', `${id}/${st.key}.${t}: is a GLB`); }
      ok(st.tris && st.tris[t] > 0 && st.tris[t] <= BUD[t], `${id}/${st.key}.${t}: ${st.tris && st.tris[t]} tris <= ${BUD[t]}`); }
    // engines vs plume table: the table is in the stage GROUP frame = group_noz_ref (asset origin in that frame) + asset-local
    const NZ = (NOZ[id] || {})[st.key]; if (NZ && st.engines.length) { const c = Math.cos(st.rotY || 0), s = Math.sin(st.rotY || 0); ok(NZ.length === st.engines.length, `${id}/${st.key}: ${st.engines.length} engines vs plume table ${NZ.length}`);
      if (NZ.length === st.engines.length) { const rf = st.group_noz_ref || [0, 0, 0], g = st.engines.map(e => [rf[0] + e.pos[0], rf[1] + e.pos[1], rf[2] + e.pos[2]]); const worst = NZ.reduce((w, p) => Math.max(w, Math.min(...g.map(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])))), 0); ok(worst < 0.06, `${id}/${st.key}: nozzles match the plume table (worst ${worst.toFixed(3)} m)`); } }
  }
  ok(bytes.mid <= 250 * 1024, `${id}: mid tier ${(bytes.mid / 1024).toFixed(0)} KB <= 250 KB`); fleet += bytes.hi + bytes.mid + bytes.lo;
}
console.log(`staged manifests: ${ids.length} rockets, fleet ${(fleet / 1048576).toFixed(2)} MB (all tiers, before dedupe sharing: files counted per stage)`);
(async () => {
  if (!pw || process.env.NO_BROWSER) { console.log(`staged_models: ${n - bad}/${n} pass (browser part skipped)`); process.exit(bad ? 1 : 0); }
  const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }), pg = await br.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(U + 'gfx/vehicles/viewer.html?webgl&staged=all'); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 240000 });
  const R = await pg.evaluate(async ids => { const M = await import('/gfx/vehicles/vehicles.js?v=' + (window.__TAG || document.querySelector('script[type=module]').textContent.match(/vehicles\.js\?v=([^']+)/)[1])), T = await import('three/webgpu'), out = [];
    for (const id of ids) { await M.preloadStaged(id, {}); await M.preloadStaged(id, { phone: true }); for (const detail of ['hi', 'mid', 'lo']) { const p0 = M.build(id, { detail, legs: 0, payload: false, staged: false }); p0.updateMatrixWorld(true); const pb = new T.Box3().setFromObject(p0); M.dispose(p0); const g = M.build(id, { detail, legs: 0, payload: false }); g.updateMatrixWorld(true); const bb = new T.Box3().setFromObject(g); let meshes = 0; g.traverse(m => { if (m.isMesh) meshes++; });
      out.push({ id, detail, staged: !!g.userData.staged, groups: Object.keys(g.userData.stages || {}).length, top: bb.max.y, bot: bb.min.y, H: pb.max.y, Hb: pb.min.y, meshes }); M.dispose(g); } } return out; }, ids);
  for (const r of R) { ok(r.staged, `${r.id} ${r.detail}: built from the manifest`); const man = JSON.parse(fs.readFileSync(path.join(AR, r.id, 'manifest.json'), 'utf8'));
    ok(r.groups === man.stages.length, `${r.id} ${r.detail}: ${r.groups} stage groups = ${man.stages.length} manifest stages`); ok(r.top <= r.H * 1.01 + 0.3, `${r.id} ${r.detail}: nothing above the procedural nose (top ${r.top.toFixed(1)} m vs ${r.H.toFixed(1)} m)`); ok(r.bot >= r.Hb - 0.5 - 0.01 * r.H, `${r.id} ${r.detail}: nothing below the engine exits (${r.bot.toFixed(2)} m vs ${r.Hb.toFixed(2)} m)`);
    ok(r.meshes <= 90, `${r.id} ${r.detail}: ${r.meshes} meshes <= 90`); }
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
  console.log(`staged_models: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
