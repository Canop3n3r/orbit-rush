// Fixed-nose flag (rockets-pass-1): a model whose 'payload' stage group is a fixed re-entry nose sets userData.fixedNose (so main.js
// never hides it and no payload mesh is added); every other model with a 'payload' shell carries a payload mesh and no flag.
// Needs the art server on :8771. Usage: node tests/vehicles_nose.cjs [viewerUrl]
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('vehicles_nose: skipped (no playwright)'); process.exit(0); }
const url = process.argv[2] || 'http://localhost:8771/gfx/vehicles/viewer.html?webgl';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); const pg = await br.newPage();
  let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; }; pg.on('pageerror', e => { console.log('pageerror', e.message); bad++; });
  await pg.goto(url); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 180000 });
  const r = await pg.evaluate(async () => { const M = await import('/gfx/vehicles/vehicles.js?v=f5.8w'); const fixed = [], shellNoSat = [];
    for (const id of Object.keys(M.VEHICLES)) { const g = M.build(id, { detail: 'lo' }), st = g.userData.stages || {}; if (g.userData.fixedNose) { fixed.push(id + (st.sat ? ':HAS_SAT' : '')); } else if (st.payload && !st.sat && !/^payload-/.test(id)) shellNoSat.push(id); }
    return { fixed, shellNoSat }; });
  ok(r.fixed.length >= 1 && r.fixed.every(x => !x.endsWith(':HAS_SAT')), `fixed-nose models carry no payload mesh: ${r.fixed.join(',')}`);
  ok(r.shellNoSat.length === 0, `every other model with a payload shell carries a payload mesh (missing: ${r.shellNoSat.join(',')})`);
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
