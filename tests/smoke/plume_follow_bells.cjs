// Unit 3 smoke: after a launch the first-stage plumes sit under the model's own bells (count = main bells in nozzles.js).
// Imports resolve against the page URL so this also works under a sub-path (GitHub Pages /orbit-rush/).
// Usage: U=http://localhost:8931/ node tests/smoke/plume_follow_bells.cjs [ids...]
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8931/', ids = process.argv.slice(2).length ? process.argv.slice(2) : ['heron-9-v11', 'colossus-v4', 'space-truck'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
    await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2500);
    const r = await pg.evaluate(async () => { const G = window.__game, { plumeLayout } = await import(new URL('fun/plumetable.js?v=f5.8x', location.href).href), { NOZZLES } = await import(new URL('gfx/vehicles/nozzles.js?v=f5.8x', location.href).href);
      const g = G.SG.find(x => !x.userData.radial), pl = g.userData.plume, NZ = NOZZLES[G.design.model] || {}; const main = Object.values(NZ).find(l => l.length) || [];
      const first = Object.entries(NZ).find(([k, l]) => l.length && !/^(srb|strap|side)/i.test(k)); const L = plumeLayout(first ? first[1] : NZ.orbiter, 1);
      return { id: G.design.model, nEng: pl.userData.nEng, extras: (pl.userData.extra || []).length, want: L ? L.n : null, cen: L ? L.cen : null }; });
    ok(r.want !== null && r.nEng === r.want, `${id}: first-stage plumes = model bells (${r.nEng} vs ${r.want}, ${r.extras} extra)`); ok(!errs.length, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
