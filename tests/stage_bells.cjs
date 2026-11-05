// OR-010: every thrust stage must show engine bells from aft after lower stages separate.
// A stage with nozzles fails when its bell meshes sit ABOVE the stage's lowest hull (bells trapped
// inside a closed interstage sleeve / tank, so the aft view is a flat circular face).
// Needs the tree served. Usage: U=http://localhost:8959/ node tests/stage_bells.cjs [ids...]
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('stage_bells: skipped (no playwright)'); process.exit(0); }
const U = process.env.U || 'http://localhost:8959/', ids = process.argv.slice(2);
const SKIP = /^(les|LES|tower|IU|SLA|adapter|fairing|payload|sat|bay|struts|ET|capsule|service|tub|spaceplane|carrier)$/;
(async () => {
  const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const pg = await br.newPage(); let bad = 0; const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  await pg.goto(U + 'gfx/vehicles/viewer.html?webgl&staged=off');
  await pg.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 240000 });
  const R = await pg.evaluate(async ids => {
    const M = await import('/gfx/vehicles/vehicles.js?v=' + (window.__TAG || 'f5.9-25'));
    const T = await import('three/webgpu');
    const out = [], bb = new T.Box3();
    const isBell = m => /bell/i.test(m.name) || (m.material && /bell/i.test(m.material.name || ''));
    const list = ids.length ? ids : Object.keys(M.VEHICLES);
    for (const id of list) {
      if (!M.VEHICLES[id] || !M.VEHICLES[id].build) continue;
      const g = M.build(id, { detail: 'hi', legs: 0, payload: false, staged: false });
      g.updateMatrixWorld(true);
      const stages = (g.userData && g.userData.stages) || {};
      for (const [key, st] of Object.entries(stages)) {
        const noz = (st.userData && st.userData.nozzles) || [];
        if (!noz.length) continue;
        let bellMin = Infinity, stageMin = Infinity, nBell = 0;
        st.traverse(m => {
          if (!m.isMesh || !m.visible) return;
          // dress/frost overlays can sit in a wrong frame on some heroes; they must not define the aft face
          if (/dress|frost|foam|fin|leg|flap|strut|gridfin|lattice|strake|rudder/i.test(m.name)) return;
          bb.setFromObject(m);
          if (isBell(m)) { nBell++; bellMin = Math.min(bellMin, bb.min.y); return; }
          // hull floor only (paint/carbon/…); plain dark/grey is usually fins, truss or detail and would false-positive
          const mat = (m.material && m.material.name) || '';
          const nm = m.name + '|' + mat;
          if (!/paint|carbon|silver|steel|foam|skirt|shield|cream|salmon|tile|soot|x-c|x-foam|bell/i.test(nm)) return;
          if (/^merged:dark$|:dark$/.test(m.name) && !/skirt|shield|paint|carbon/i.test(nm)) return;
          stageMin = Math.min(stageMin, bb.min.y);
        });
        if (stageMin === Infinity) stageMin = bellMin; // bells-only stage
        out.push({ id, key, nNoz: noz.length, nBell, bellMin, stageMin, gap: nBell ? bellMin - stageMin : null });
      }
      M.dispose(g);
    }
    return out;
  }, ids);
  const rows = R.filter(r => !SKIP.test(r.key));
  ok(rows.length > 0, `scanned ${rows.length} thrust stages (${R.length - rows.length} exempt)`);
  for (const r of rows) {
    ok(r.nBell >= 1, `${r.id}/${r.key}: ≥1 bell mesh for ${r.nNoz} nozzle(s) (got ${r.nBell})`);
    // bells must reach the aft of the stage. Positive gap = bells trapped above a flat hull face.
    if (r.nBell >= 1) ok(r.gap <= 0.05, `${r.id}/${r.key}: bells reach the aft face (bellMin-stageMin=${r.gap.toFixed(2)} m)`);
  }
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
  console.log(`stage_bells: ${rows.length} thrust stages, ${bad} failed`);
  await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
