// stages-pass-1 (positions compared in the radial group's frame): every strap-on / solid side booster plume sits under that booster's own bell (x/z within 0.35 m, plume starts at the bell exit height).
// stages-pass-2: also one booster group per strap-on (no merged set), and every side plume's width is sized from its OWN bell (plume width / bell exit radius is the same for big and small strap-ons, within 15 %).
// Usage: U=http://localhost:8931/ node tests/smoke/radial_plume_bells.cjs [ids...]
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8931/', ids = process.argv.slice(2).length ? process.argv.slice(2) : ['heron-heavy', 'atlantean-v-551', 'polar-slinger', 'tsubame-2024', 'jade-lantern-5b', 'deltoid'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
    await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`) || document.querySelector(`.pkC[data-th="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2500);
    const r = await pg.evaluate(async () => { const G = window.__game, { NOZZLES } = await import(new URL('gfx/vehicles/nozzles.js?v=f5.9-12', location.href).href), THREE = G.THREE || (await import(new URL('gfx/three.js', location.href).href).catch(() => null));
      const h = G.hero, st = (h.userData.hi || h).userData.stages || {}, NZ = NOZZLES[G.design.model] || {}, rg = G.SG.find(g => g.userData.radial); if (!rg) return { none: true };
      G.rocketG.updateMatrixWorld(true); const bells = [], ctrs = [];
      for (const k of Object.keys(st)) { if (!/^(srb|strap|side|ssb)/i.test(k)) continue; const nd = st[k].userData.nodes; // staged asset: manifest bells (asset frame -> rotY + offset); procedural: nozzles.js
        const pts = nd && nd.engines ? nd.engines.map(e => { const a = nd.rotY || 0, c = Math.cos(a), sn = Math.sin(a); return [e.pos[0] * c + e.pos[2] * sn + nd.offset[0], e.pos[1] + nd.offset[1], -e.pos[0] * sn + e.pos[2] * c + nd.offset[2]]; }) : (NZ[k] || []);
        const br = nd && nd.engines ? nd.engines.map(e => e.bell_r) : (NZ[k] || []).map(p => p[3]); const bs = pts.map((p, i) => { const v = rg.worldToLocal(st[k].localToWorld(st[k].position.clone().set(p[0], p[1], p[2]))); return [v.x, v.y, v.z, br[i] || 0, ctrs.length]; }); if (!bs.length) continue; bells.push(...bs); ctrs.push([0, 2].map(i => bs.reduce((a, b) => a + b[i], 0) / bs.length).concat([Math.min(...bs.map(b => b[1])), Math.max(...bs.map(b => b[3]))])); }
      const pl = rg.userData.plume, all = [pl, ...(pl.userData.extra || [])], s = h.scale.x; let worst = 0, worstY = 0; const ratio = [], hit = new Set();
      for (const p of all) { const w = p.position; /* rg-local: plumes are children of the radial group */ let best = 1e9, by = 0; let bb = null; const per = all.length < bells.length && all.length % ctrs.length === 0; for (const b of per ? ctrs.map((c, i) => [c[0], c[2], c[1], c[3], i]) : bells) { const d = Math.hypot(b[0] - w.x, b[2] - w.z); if (d < best) { best = d; by = Math.abs(b[1] - w.y); bb = b; } }
        if (bb) { hit.add(bb[4]); if (bb[3] > 0) ratio.push((p.userData.w || 1) * p.scale.x / bb[3]); } worst = Math.max(worst, best / s); worstY = Math.max(worstY, by / s); }
      return { n: all.length, bells: bells.length, boosters: ctrs.length, worst, worstY, hit: hit.size, rk: ratio.length ? Math.max(...ratio) / Math.min(...ratio) : 1 }; });
    if (r.none) { ok(false, id + ': no radial group'); continue; }
    ok(r.n === r.bells || (r.n < r.bells && r.n % r.boosters === 0) || (r.n < r.bells && r.hit === r.n), `${id}: one side plume per side bell, per booster, or a ground-lit subset on distinct bells (${r.n} plumes, ${r.bells} bells, ${r.boosters} boosters, ${r.hit} distinct)`);
    ok(r.hit >= Math.min(r.n, r.boosters), `${id}: no two plumes stacked on one booster while another has none (${r.hit} distinct of ${r.n})`);
    ok(r.boosters >= 2, `${id}: one stage group per strap-on (${r.boosters} booster groups)`);
    ok(r.rk < 1.15, `${id}: side plume width sized from its own bell (width/bell spread x${r.rk.toFixed(2)})`);
    ok(r.worst < 0.35, `${id}: side plumes under their bells (worst x/z miss ${r.worst.toFixed(2)} m)`);
    ok(r.worstY < 0.35, `${id}: side plumes start at the bell exit (worst y miss ${r.worstY.toFixed(2)} m)`);
    ok(!errs.length, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
