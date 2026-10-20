// perf budgets per LOD (Playtest QA perf report rockets-1). Needs the art server (python -m http.server 8761) + playwright-core.
// Usage: node tests/vehicles_budget.cjs [url]   (skips with exit 0 if playwright isn't installed)
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('vehicles_budget: skipped (no playwright)'); process.exit(0); }
const url = process.argv[2] || 'http://localhost:8761/gfx/vehicles/budget.html';
const BUD = { ...Object.fromEntries(['diamantine-a','diamantine-b'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), // [maxTris, maxMeshes] per id/detail
  'heron-heavy': { hi: [20000, 38], lo: [7000, 22] }, 'heron-9': { hi: [20000, 30], lo: [2700, 12] }, 'heron-9-v11': { hi: [20000, 30], lo: [2700, 12] }, 'heron-9-crew': { hi: [20000, 30], lo: [2700, 12] },
  'colossus-v3': { mid: [17000, 14], lo: [6000, 10] }, 'colossus-v4': { mid: [17000, 14], lo: [6000, 10] }, 'sparrow-1': { hi: [8000, 16], lo: [1500, 10] },
  'saturnine-v': { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }, 'space-truck': { hi: [30000, 30], mid: [8000, 24], lo: [4000, 18] } }; // co-nosa-1: tier S phone budget = mid <= 8k tris
(async () => { const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] }); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.__budget, null, { timeout: 240000 }); const r = await p.evaluate(() => window.__budget); await b.close();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
  for (const x of r.rows) { const B = BUD[x.id]?.[x.detail]; console.log(`${x.id.padEnd(22)} ${x.detail.padEnd(3)} tris ${String(x.tris).padStart(6)} meshes ${x.meshes}`); if (B) { ok(x.tris <= B[0], `${x.id} ${x.detail} tris ${x.tris} > ${B[0]}`); ok(x.meshes <= B[1], `${x.id} ${x.detail} meshes ${x.meshes} > ${B[1]}`); } }
  const NEED = { 'heron-heavy': ['booster', 'side0', 'side1', 'upper'], 'space-truck': ['SRB-L', 'SRB-R', 'ET', 'orbiter'], 'saturnine-v': ['stage1', 'stage2', 'stage3', 'IU', 'SLA', 'CSM', 'LES'] };
  Object.assign(NEED, Object.fromEntries(['diamantine-a','diamantine-b'].map(id => [id, ['s1','s2','s3','payload']])));
  for (const x of r.stages) { const names = Object.keys(x.stages); ok(names.length >= 2, `${x.id} ${x.detail}: ≥2 stages (${names})`);
    for (const n of NEED[x.id] || []) ok(names.includes(n), `${x.id} ${x.detail}: stage ${n} present`);
    for (const [n, s] of Object.entries(x.stages)) { ok(s.own && s.detached && s.meshes > 0, `${x.id} ${x.detail}: stage ${n} is its own group with meshes and detaches`); ok(s.rest > 0, `${x.id} ${x.detail}: vehicle keeps meshes after detaching ${n}`); }
    if (/heron/.test(x.id)) { ok(x.legs.length === (x.id === 'heron-heavy' ? 3 : 1), `${x.id} ${x.detail}: leg sets ${x.legs.length}`); for (const d of x.legs) ok(d > 1, `${x.id} ${x.detail}: setLegs deploys (feet drop ${d} m)`); }
    console.log(`stages ${x.id} ${x.detail}: ${Object.entries(x.stages).map(([n, s]) => n + ':' + s.meshes).join(' ')} legs ${x.legs}`); }
  console.log('titan v3+v4 share', JSON.stringify(r.share), 'mem cycles', JSON.stringify(r.mem));
  ok(r.share.unique < r.share.meshes, 'titan v3/v4 share geometry'); ok(r.mem.every(m => m.gpu === r.mem[0].gpu && m.cache === r.mem[0].cache), 'geometry count flat across model cycles');
  console.log('rendered heap MB per cycle', JSON.stringify(r.heap)); if (r.heap[0] != null) ok(r.heap[3] - r.heap[1] < 3, `rendered model cycles: heap flat (cycle2 ${r.heap[1]} -> cycle4 ${r.heap[3]} MB, < 3 MB growth; was +27.5 MB/cycle)`);
  ok(errs.length === 0, 'page errors: ' + errs.join('; ')); console.log(`vehicles_budget: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
