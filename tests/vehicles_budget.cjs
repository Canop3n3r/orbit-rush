// perf budgets per LOD (Playtest QA perf report rockets-1). Needs the art server (python -m http.server 8761) + playwright-core.
// Usage: node tests/vehicles_budget.cjs [url]   (skips with exit 0 if playwright isn't installed)
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('vehicles_budget: skipped (no playwright)'); process.exit(0); }
const url = process.argv[2] || 'http://localhost:8761/gfx/vehicles/budget.html';
const BUD = { // [maxTris, maxMeshes] per id/detail
  'heron-heavy': { hi: [20000, 30], lo: [6000, 15] }, 'heron-9': { lo: [2500, 12] }, 'heron-9-v11': { lo: [2500, 12] }, 'heron-9-crew': { lo: [2500, 12] },
  'titan-ss-v3': { mid: [17000, 14], lo: [6000, 10] }, 'titan-ss-v4': { mid: [17000, 14], lo: [6000, 10] }, 'sparrow-1': { hi: [8000, 16], lo: [1500, 10] } };
(async () => { const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.__budget, null, { timeout: 240000 }); const r = await p.evaluate(() => window.__budget); await b.close();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
  for (const x of r.rows) { const B = BUD[x.id]?.[x.detail]; console.log(`${x.id.padEnd(22)} ${x.detail.padEnd(3)} tris ${String(x.tris).padStart(6)} meshes ${x.meshes}`); if (B) { ok(x.tris <= B[0], `${x.id} ${x.detail} tris ${x.tris} > ${B[0]}`); ok(x.meshes <= B[1], `${x.id} ${x.detail} meshes ${x.meshes} > ${B[1]}`); } }
  console.log('titan v3+v4 share', JSON.stringify(r.share), 'mem cycles', JSON.stringify(r.mem));
  ok(r.share.unique < r.share.meshes, 'titan v3/v4 share geometry'); ok(r.mem.every(m => m.gpu === r.mem[0].gpu && m.cache === r.mem[0].cache), 'geometry count flat across model cycles');
  ok(errs.length === 0, 'page errors: ' + errs.join('; ')); console.log(`vehicles_budget: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
