// Launches every staged (Blender) rocket on a 390x844 touch phone: the model must swap to the staged mid tier before ignition, the flight must run
// (liftoff, climb, staging if the rocket has any) with no page errors / [Orbit Rush] warnings, and the hero must follow the sim altitude.
// Usage: U=http://localhost:8959/ node tests/staged_launch.cjs [ids...]   (default: every enabled rocket in assets/rockets/index.json; LIMIT=n caps the count)
const fs = require('fs'), path = require('path'); const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const U = process.env.U || 'http://localhost:8959/', idx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'rockets', 'index.json'), 'utf8'));
let ids = process.argv.slice(2); if (!ids.length) ids = Object.entries(idx.rockets).filter(([, v]) => v.enabled).map(([k]) => k); if (process.env.LIMIT) ids = ids.slice(0, +process.env.LIMIT);
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); const errs = [];
    pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[Orbit Rush\]/.test(t)) && !/WebGL2|Effects:|lowering|GPU\/driver|No available adapters|Failed to load resource/.test(t)) errs.push(t.slice(0, 200)); });
    try { await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } }); await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(800);
      await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`) || document.querySelector(`.pkC[data-th="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id);
      const t0 = Date.now(); let inf = null; while (Date.now() - t0 < 40000) { inf = await pg.evaluate(() => { const h = window.__game.hero, o = h && (h.levels || [{ object: h }])[0].object; return { staged: !!(o && o.userData.staged), det: o && o.userData.detail, tris: o && Math.round(o.userData.tris || 0) }; }); if (inf.staged) break; await pg.waitForTimeout(500); }
      ok(inf && inf.staged && inf.det === 'mid', `${id}: staged mid-tier model on the pad (${JSON.stringify(inf)})`);
      const r = await pg.evaluate(async () => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); const V = G.rocketG.position.constructor; let maxAlt = 0, cur0 = F.v.cur, maxCur = cur0, worst = 0;
        for (let k = 0; k < 40; k++) { for (let i = 0; i < 30; i++) { F.realT += 0.02; F.step(0.02); } await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); maxAlt = Math.max(maxAlt, F.alt); maxCur = Math.max(maxCur, F.v.cur);
          const a = G.rocketG.getWorldPosition(new V()), p = G.pad.getWorldPosition(new V()); if (F.alt > 120) worst = Math.max(worst, Math.abs(a.distanceTo(p) - F.alt) - (0.2 * F.alt + 80)); }
        const h = G.hero, o = h && (h.levels || [{ object: h }])[0].object; return { maxAlt, staged: !!(o && o.userData.staged), worst, met: F.met }; });
      ok(r.maxAlt > 200 && r.staged, `${id}: flew (alt ${Math.round(r.maxAlt)} m in ${r.met.toFixed(0)} s), still staged`); ok(r.worst <= 0, `${id}: hero follows the sim altitude (worst excess ${Math.round(r.worst)} m)`);
    } catch (e) { ok(false, `${id}: ${e.message}`); }
    ok(errs.length === 0, `${id}: no page errors / [Orbit Rush] warnings ${errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  console.log(`staged_launch: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
