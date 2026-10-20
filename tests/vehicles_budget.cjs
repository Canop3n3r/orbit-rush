// perf budgets per LOD (Playtest QA perf report rockets-1). Needs the art server (python -m http.server 8761) + playwright-core.
// Usage: node tests/vehicles_budget.cjs [url]   (skips with exit 0 if playwright isn't installed)
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('vehicles_budget: skipped (no playwright)'); process.exit(0); }
const url = process.argv[2] || 'http://localhost:8761/gfx/vehicles/budget.html';
const BUD = { ...Object.fromEntries(['thorin','thorin-agenta','thorin-capable','thorin-capablestar','thorin-toaster','deltoid','deltoid-3'].map(id => [id, { hi: [12000, 32], mid: [4000, 26], lo: [2000, 20] }])), ...Object.fromEntries(['kometa'].map(id => [id, { hi: [12000, 32], mid: [4000, 26], lo: [2000, 20] }])), ...Object.fromEntries(['cosmokart-1','cosmokart-1b','cosmokart-2','cosmokart-3m','whirligig-2','whirligig-3','riverbend'].map(id => [id, { hi: [12000, 32], mid: [4000, 26], lo: [2000, 20] }])) /* tier B phone budget */, ...Object.fromEntries(['dark-dart'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), // [maxTris, maxMeshes] per id/detail
  'heron-heavy': { hi: [20000, 38], lo: [7000, 22] }, 'heron-9': { hi: [20000, 30], lo: [2700, 12] }, 'heron-9-v11': { hi: [20000, 30], lo: [2700, 12] }, 'heron-9-crew': { hi: [20000, 30], lo: [2700, 12] },
  'colossus-v3': { mid: [17000, 14], lo: [6000, 10] }, 'colossus-v4': { mid: [17000, 14], lo: [6000, 10] }, 'sparrow-1': { hi: [8000, 16], lo: [1500, 10] },
  'saturnine-v': { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }, 'space-truck': { hi: [30000, 30], mid: [8000, 24], lo: [4000, 18] },
  ...Object.fromEntries(['europia'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['vegara','vegara-c'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['arion-5','arion-62','arion-64'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['baltic-hammer','baltic-hammer-tandem'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['new-glendale'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['electrino','electrino-recovery'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['titanus-4','atlantean-crew','atlantean-upper'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['deltoid-2-heavy9','deltoid-2-light3'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['diamantine-a','diamantine-b'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['jade-lantern-2f','jade-lantern-3b'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['jade-lantern-5','jade-lantern-5b'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['new-shepherdish','featherwing-1'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['polar-slinger','monsoon-heavy'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['tsurugi-22','tsurugi-24','tsurugi-30'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['tsubame','tsubame-2024'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['rodnik', 'rodnik-2', 'lastochka', 'pervy'].map(id => [id, { hi: [30000, 40], mid: [8000, 30], lo: [4000, 24] }])),
  'moonhammer': { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }, 'mogutny': { hi: [32000, 32], mid: [8000, 26], lo: [4000, 20] },
  ...Object.fromEntries(['taiga-1','taiga-a5'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['gorynych-m','gorynych-k'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['scoutling','scoutling-x1'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['titanus-2','titanus-2-icbm'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['vantguard'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['redrock','redrock-crew','junebug-1','saturnine-1','saturnine-1b'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['pegacorn','antarion'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['selene','ares'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['super-lift-crew','super-lift-cargo','super-lift-1b-crew','super-lift-1b-cargo'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['steppe-arrow-2','steppe-arrow-3'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])),
  ...Object.fromEntries(['vulcanis-2s','vulcanis-4l','vulcanis-6l'].map(id => [id, { hi: [30000, 32], mid: [8000, 26], lo: [4000, 20] }])), ...Object.fromEntries(['atlantean-v-401','atlantean-v-411','atlantean-v-421','atlantean-v-431','atlantean-v-501','atlantean-v-511','atlantean-v-521','atlantean-v-531','atlantean-v-541','atlantean-v-551','atlantean-v-401-l','atlantean-v-501-m','atlantean-v-551-l','atlantean-v-541-m','deltoid-4-m','deltoid-4-m42','deltoid-4-m52','deltoid-4-m54','deltoid-4-heavy'].map(id => [id, { hi: [30000, 40], mid: [8000, 30], lo: [4000, 24] }])) }; // co-civspace-1: tier S phone budget = mid <= 8k tris
(async () => { const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] }); const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); await p.goto(url); await p.waitForFunction(() => window.__budget, null, { timeout: 240000 }); const r = await p.evaluate(() => window.__budget); await b.close();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
  for (const x of r.rows) { const B = BUD[x.id]?.[x.detail]; console.log(`${x.id.padEnd(22)} ${x.detail.padEnd(3)} tris ${String(x.tris).padStart(6)} meshes ${x.meshes}`); if (B) { ok(x.tris <= B[0], `${x.id} ${x.detail} tris ${x.tris} > ${B[0]}`); ok(x.meshes <= B[1], `${x.id} ${x.detail} meshes ${x.meshes} > ${B[1]}`); } }
  const NEED = { 'heron-heavy': ['booster', 'side0', 'side1', 'upper'], 'space-truck': ['SRB-L', 'SRB-R', 'ET', 'orbiter'], 'saturnine-v': ['stage1', 'stage2', 'stage3', 'IU', 'SLA', 'CSM', 'LES'] };
  Object.assign(NEED, Object.fromEntries(['cosmokart-1','cosmokart-1b','cosmokart-2','cosmokart-3m','whirligig-2','whirligig-3','riverbend'].map(id => [id, ['s1','s2','payload']])));
  Object.assign(NEED, Object.fromEntries(['kometa'].map(id => [id, ['s1','s2','side0','side1','side2','side3','payload']])));
  Object.assign(NEED, Object.fromEntries(['dark-dart'].map(id => [id, ['s1', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['europia'].map(id => [id, ['s1','s2','s3','payload']])));
  Object.assign(NEED, Object.fromEntries(['vegara','vegara-c'].map(id => [id, ['s1', 's2', 's3', 'upper', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['arion-5','arion-62','arion-64'].map(id => [id, ['core', 'srb0', 'srb1', 'upper', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['baltic-hammer','baltic-hammer-tandem'].map(id => [id, ['body']])));
  Object.assign(NEED, Object.fromEntries(['new-glendale'].map(id => [id, ['s1', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['electrino','electrino-recovery'].map(id => [id, ['booster', 'upper', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['deltoid-2-heavy9','deltoid-2-light3'].map(id => [id, ['s1', 'srbA', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['diamantine-a','diamantine-b'].map(id => [id, ['s1','s2','s3','payload']])));
  Object.assign(NEED, Object.fromEntries(['jade-lantern-2f','jade-lantern-3b'].map(id => [id, ['s1', 'side0', 'side1', 'side2', 'side3', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['jade-lantern-5','jade-lantern-5b'].map(id => [id, ['core', 'side0', 'side1', 'side2', 'side3', 'payload']])));
  Object.assign(NEED, { 'new-shepherdish': ['booster', 'capsule'], 'featherwing-1': ['carrier', 'spaceplane'] });
  Object.assign(NEED, Object.fromEntries(['tsubame','tsubame-2024'].map(id => [id, ['s1', 'srb0', 'srb1', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['rodnik', 'rodnik-2', 'lastochka', 'pervy'].map(id => [id, ['core', 'strap0', 'strap1', 'strap2', 'strap3', 'payload']])));
  Object.assign(NEED, { 'mogutny-glider': ['core', 'side0', 'side1', 'side2', 'side3', 'orbiter'] }); Object.assign(BUD, { 'mogutny-glider': { hi: [32000, 32], mid: [8000, 26], lo: [4000, 20] } });
  Object.assign(NEED, Object.fromEntries(['rodnik', 'rodnik-2', 'lastochka', 'pervy'].map(id => [id, ['core', 'strap0', 'strap1', 'strap2', 'strap3', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['moonhammer'].map(id => [id, ['s1', 's2', 's3', 's4', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['mogutny'].map(id => [id, ['core', 'side0', 'side1', 'side2', 'side3', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['taiga-1','taiga-a5'].map(id => [id, ['core','upper','payload']])));
  Object.assign(NEED, Object.fromEntries(['gorynych-m','gorynych-k'].map(id => [id, ['s1', 's2', 's3', 'upper', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['scoutling','scoutling-x1'].map(id => [id, ['s1','s2','s3','s4','payload']])));
  Object.assign(NEED, Object.fromEntries(['vantguard'].map(id => [id, ['s1','s2','s3','payload']])));
  Object.assign(NEED, Object.fromEntries(['pegacorn','antarion'].map(id => [id, ['s1', 's2', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['selene','ares'].map(id => [id, ['booster', 'transfer', 'fairing']])));
  Object.assign(NEED, Object.fromEntries(['super-lift-crew','super-lift-cargo','super-lift-1b-crew','super-lift-1b-cargo'].map(id => [id, ['SRB-L', 'SRB-R', 'core', 'upper', 'payload']])));
  Object.assign(NEED, Object.fromEntries(['steppe-arrow-2','steppe-arrow-3'].map(id => [id, ['s1', 's2', 'payload']])));
  Object.assign(NEED, { ...Object.fromEntries(['vulcanis-2s','vulcanis-4l','vulcanis-6l'].map(id => [id, ['core', 'srbA', 'upper', 'payload']])) });
  Object.assign(NEED, Object.fromEntries(['baltic-hammer','baltic-hammer-tandem'].map(id => [id, ['body']])));
  for (const x of r.stages) { const names = Object.keys(x.stages); ok(names.length >= 2, `${x.id} ${x.detail}: ≥2 stages (${names})`);
    for (const n of NEED[x.id] || []) ok(names.includes(n), `${x.id} ${x.detail}: stage ${n} present`);
    for (const [n, s] of Object.entries(x.stages)) { ok(s.own && s.detached && s.meshes > 0, `${x.id} ${x.detail}: stage ${n} is its own group with meshes and detaches`); ok(s.rest > 0, `${x.id} ${x.detail}: vehicle keeps meshes after detaching ${n}`); }
    if (/heron/.test(x.id)) { ok(x.legs.length === (x.id === 'heron-heavy' ? 3 : 1), `${x.id} ${x.detail}: leg sets ${x.legs.length}`); for (const d of x.legs) ok(d > 1, `${x.id} ${x.detail}: setLegs deploys (feet drop ${d} m)`); }
    console.log(`stages ${x.id} ${x.detail}: ${Object.entries(x.stages).map(([n, s]) => n + ':' + s.meshes).join(' ')} legs ${x.legs}`); }
  console.log('titan v3+v4 share', JSON.stringify(r.share), 'mem cycles', JSON.stringify(r.mem));
  ok(r.share.unique < r.share.meshes, 'titan v3/v4 share geometry'); ok(r.mem.every(m => m.gpu === r.mem[0].gpu && m.cache === r.mem[0].cache), 'geometry count flat across model cycles');
  console.log('rendered heap MB per cycle', JSON.stringify(r.heap)); if (r.heap[0] != null) ok(r.heap[3] - r.heap[1] < 3, `rendered model cycles: heap flat (cycle2 ${r.heap[1]} -> cycle4 ${r.heap[3]} MB, < 3 MB growth; was +27.5 MB/cycle)`);
  ok(errs.length === 0, 'page errors: ' + errs.join('; ')); console.log(`vehicles_budget: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); })();
