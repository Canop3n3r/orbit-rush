// logos-deploy-1: (1) every launch house's rockets carry logo decals (one model per house, staged assets where they exist, hi tier);
// (2) every payload kind's deploy pivots move between k=0, 0.5 and 1. SHOTS=dir also saves logos_<house>.png and a deploy frame sequence.
// Usage: U=http://localhost:8958/ [SHOTS=/workspace/shots] node tests/smoke/logos_deploy.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8958/', SH = process.env.SHOTS || '';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  try { const pg = await br.newPage({ viewport: { width: 720, height: 900 } }); pg.setDefaultTimeout(300000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(U + 'gfx/vehicles/viewer.html?webgl&id=heron-9'); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready);
    const sets = await pg.evaluate(async () => { const V = await import(new URL('vehicles.js?v=f5.9-27', location.href).href); return Object.fromEntries(Object.entries(V.HOUSE_SETS).map(([h, ids]) => [h, ids.filter(i => V.VEHICLES[i])])); });
    for (const [h, ids] of Object.entries(sets)) { if (!ids.length) { ok(false, `${h}: no models`); continue; } let got = null, used = null;
      for (const id of ids.slice(0, 3)) { const r = await pg.evaluate(async id => { await window.__viewer.showStaged(id); const c = window.__viewer.cur; const L = []; c.traverse(m => { if (m.isMesh && /^logo:/.test(m.name)) L.push(m.name); }); return { L, house: c.userData.house }; }, id); if (r.L.length) { got = r; used = id; break; } got = got || r; used = used || id; }
      ok(got.L.length >= 1 && got.L.every(n => n.startsWith('logo:' + h + ':')), `${h}: ${used} carries ${got.L.length} logo decals (${[...new Set(got.L.map(n => n.split(':')[2]))].join(',')})`);
      if (SH) { await pg.waitForTimeout(600); await pg.screenshot({ path: `${SH}/logos_${h}.png` }); } }
    const kinds = await pg.evaluate(async () => { const P = await import(new URL('payloads.js?v=f5.9-27', location.href).href); const out = {};
      for (const k of P.KINDS) { if (k === 'roadster') continue; const s = P.buildPayload(k, { detail: 'hi' }), u = s.userData, snap = () => u.pivots.map(p => [p.rotation.x, p.rotation.y, p.rotation.z, p.position.y, p.scale.x].map(v => +v.toFixed(4)).join());
        u.deploy(0); const a = snap(); u.deploy(0.5); const b = snap(); u.deploy(1); const c = snap(); out[k] = { n: u.pivots.length, mid: a.filter((x, i) => x !== b[i]).length, end: a.filter((x, i) => x !== c[i]).length }; }
      return out; });
    for (const [k, r] of Object.entries(kinds)) ok(r.n >= 1 && r.mid >= 1 && r.end >= Math.ceil(r.n * 0.5), `${k}: ${r.n} pivots, ${r.mid} moved by k=0.5, ${r.end} by k=1`);
    if (SH) for (const [id, kind] of [['heron-9', 'geosat'], ['heron-9', 'comsat'], ['heron-9', 'flatpack']]) { await pg.evaluate(({ id, kind }) => window.__viewer.showStaged(id, { payload: kind, sep: true }), { id, kind });
      for (const k of [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1]) { await pg.evaluate(k => { const s = window.__viewer.cur.userData.stages.sat; s.userData.deploy(k); }, k); await pg.waitForTimeout(400); await pg.screenshot({ path: `${SH}/logos_deploy_${kind}_${String(Math.round(k * 100)).padStart(3, '0')}.png` }); } }
    ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); }
  catch (e) { ok(false, e.message); }
  await br.close(); process.exit(bad ? 1 : 0); })();
