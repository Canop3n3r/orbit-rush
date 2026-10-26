// Flies a rocket on AUTO in the real game (headless) and takes screenshots at: pad, liftoff, staging, fairing split, payload release.
// Usage: U=http://localhost:8975/ OUT=/workspace/shots_blender node tools/blender/flight_shots.cjs <id> [phone|desk] [tag] ; EXTRA='&staged=off' for the procedural "before".
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const U = process.env.U || 'http://localhost:8975/', OUT = process.env.OUT || '/workspace/shots_blender';
const [id, dev = 'phone', tag = 'after'] = process.argv.slice(2); const phone = dev === 'phone';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await br.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[Orbit Rush\]/.test(t)) && !/WebGL2|Effects:|lowering|GPU\/driver|No available adapters|Failed to load resource/.test(t)) errs.push(t.slice(0, 200)); });
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } }); await pg.goto(U + '?noacademy&webgl' + (process.env.EXTRA || ''), { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
  await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`); if (!c) throw new Error('no card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(6000);
  const shot = async n => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${OUT}/${id}_${dev}_${tag}_${n}.png` }); console.log('shot', n); };
  const info = await pg.evaluate(() => { const h = window.__game.hero, o = h && (h.levels || [{ object: h }])[0].object; return { staged: !!(o && o.userData.staged), det: o && o.userData.detail }; }); console.log(JSON.stringify(info));
  await shot('1pad');
  await pg.evaluate(() => { const F = window.__game.F; F.stagePress(); F.setAuto(true, true); });
  const step = n => pg.evaluate(n => { const F = window.__game.F; for (let i = 0; i < n; i++) { F.realT += 0.02; F.step(0.02); } return { met: F.met, alt: F.alt, cur: F.v.cur, fair: F.flags.fairing, rel: !!F.released }; }, n);
  let s = await step(100); await shot('2liftoff'); let cur0 = s.cur, fairShot = false, stageShot = false, relShot = false, k = 0;
  while (k++ < 400 && !relShot) { s = await step(60);
    if (!stageShot && s.cur > cur0) { stageShot = true; await step(30); await shot('3staging'); }
    if (!fairShot && s.fair) { fairShot = true; await step(20); await shot('4fairing'); await step(80); await shot('4fairing_b'); }
    if (fairShot && !relShot) { const can = await pg.evaluate(() => { const F = window.__game.F; return F.canRelease && F.canRelease(); }); if (can || s.alt > 140000) { await pg.evaluate(() => { const F = window.__game.F; try { F.releasePayload(); } catch (e) { } }); await step(120); await shot('5release'); relShot = true; } }
    if (s.met > 1500) break; }
  console.log(JSON.stringify({ stageShot, fairShot, relShot, errs: errs.slice(0, 4) })); await br.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
