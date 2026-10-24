// Hero follows the physics vehicle (f5.8r, after the rockets-pass-2 report "model stays on the pad while the HUD climbs"):
// launches each rocket on a 390x844 touch phone, flies it (manual STAGE with the real two-tap confirm, or AUTO), and checks
//  - no page errors and no "[Orbit Rush] ..." console warnings/errors (a swallowed alignCorePlumes TDZ error hid for a whole pass),
//  - the model is the phone tier (mid, never hi) and is visible with an on-screen box,
//  - the model's world position follows the sim: distance from the pad ≈ HUD altitude (±20% +80 m) before AND after the stage drop.
// Usage: U=http://localhost:8959/ node tests/smoke/hero_follow.cjs [ids...]   (ALL=1: every picker card, ~25 s each; MODE=auto|manual|both)
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const U = process.env.U || 'http://localhost:8959/', MODE = process.env.MODE || 'both';
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const mk = async () => { const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); pg.errs = [];
    pg.on('pageerror', e => pg.errs.push('pageerror: ' + e.message)); pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[Orbit Rush\]/.test(t)) && !/WebGL2|Effects:|lowering (effects|render)|GPU\/driver|No available adapters|Failed to load resource/.test(t)) pg.errs.push('console: ' + t.slice(0, 200)); });
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} }); await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000); return [ctx, pg]; };
  let [ctx, pg] = await mk(); const all = await pg.evaluate(() => [...document.querySelectorAll('.pkC[data-m]')].map(c => c.dataset.m)); await ctx.close();
  const want = process.argv.slice(2), ids = want.length ? want : process.env.ALL ? all : ['colossus-v4', 'heron-9-v11', 'jade-lantern-5'];
  for (const id of ids) for (const mode of MODE === 'both' ? ['manual', 'auto'] : [MODE]) { if (!want.length && !process.env.ALL && mode === 'auto' && id !== ids[0]) continue; [ctx, pg] = await mk(); const tag = `${id}/${mode}`;
    try { await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2200);
      const S = () => pg.evaluate(async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const G = window.__game, F = G.F, V = G.rocketG.position.constructor, a = G.rocketG.getWorldPosition(new V()), p = G.pad.getWorldPosition(new V()), bb = G.rocketBox && G.rocketBox();
        return { met: F.met, alt: F.alt, cur: F.v.cur, dist: a.distanceTo(p), vis: G.hero ? G.hero.visible : null, box: bb && (bb.h || bb.height), det: G.hero && (G.hero.levels || [{ object: G.hero }])[0].object.userData.detail }; });
      const step = n2 => pg.evaluate(n2 => { const F = window.__game.F; for (let i = 0; i < n2; i++) { F.realT += 0.02; F.step(0.02); } }, n2);
      const a0 = await S(); ok(a0.vis && a0.det === 'mid', `${tag}: hero visible on the pad, phone tier (${a0.det})`);
      await pg.evaluate(m => { const F = window.__game.F; F.stagePress(); if (m === 'auto') F.setAuto(true, true); }, mode); const rows = []; let did = false;
      const multi = await pg.evaluate(() => window.__game.F.last > 0); for (let k = 0; k < 70; k++) { await step(30); await pg.waitForTimeout(10); const s = await S(); rows.push(s);
        if (mode === 'manual' && multi && !did && s.met > 12) { for (let q = 0; q < 4 && !did; q++) { did = (await pg.evaluate(() => window.__game.F.stagePress())) === 'stage'; if (!did) await step(20); } }
        if (s.met > (did || !multi ? 30 : 16) && (s.alt > 300 || s.met > 50)) break; }
      const fol = rows.filter(r => r.alt > 120); const bad1 = fol.filter(r => Math.abs(r.dist - r.alt) > 0.2 * r.alt + 80);
      ok(fol.length >= 3 && bad1.length === 0, `${tag}: model follows the sim altitude (${fol.length} samples, worst off ${Math.round(Math.max(0, ...fol.map(r => Math.abs(r.dist - r.alt))))} m of ${Math.round(Math.max(...fol.map(r => r.alt)))} m)`);
      if (mode === 'manual' && multi) ok(did && rows[rows.length - 1].cur >= 1, `${tag}: manual STAGE drops the booster (cur ${rows[rows.length - 1].cur})`);
      ok(rows.every(r => r.vis && r.box > 20), `${tag}: hero stays visible with an on-screen box (min box ${Math.round(Math.min(...rows.map(r => r.box || 0)))} px)`);
    } catch (e) { ok(false, `${tag}: ${e.message}`); }
    ok(pg.errs.length === 0, `${tag}: no page errors / [Orbit Rush] warnings ${pg.errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  console.log(`hero_follow: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
