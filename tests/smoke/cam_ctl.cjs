// f5.6f camera/controls smoke: pitch clamp, map up fixed, no LOCKED roll, D key does not roll, staging distance eases.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8958/', OUT = process.env.OUT || '/workspace/shots_f56/cam';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 const pg = await br.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
 await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1000);
 await pg.click('#hFly'); await pg.waitForTimeout(2000);
 await pg.evaluate(() => window.__game.setCam(90, 0.5, -1.4)); await pg.waitForTimeout(2500); let c = await pg.evaluate(() => window.__game.camInfo());
 ok(c.pitch >= -0.151, 'pad: camera pitch clamped above the ground ' + c.pitch.toFixed(2)); await pg.screenshot({ path: OUT + '/low.png' });
 await pg.evaluate(() => window.__game.setCam(90, 0.5, 1.5)); await pg.waitForTimeout(2500); c = await pg.evaluate(() => window.__game.camInfo());
 ok(c.pitch <= 1.2001, 'top-down pitch capped at 1.2 rad ' + c.pitch.toFixed(2)); await pg.screenshot({ path: OUT + '/high.png' });
 await pg.evaluate(() => { window.__game.settings.camStyle = 'locked'; }); await pg.waitForTimeout(400); c = await pg.evaluate(() => window.__game.camInfo());
 const up = await pg.evaluate(() => { const r = window.__game.v.r, l = Math.hypot(...r); return r.map(x => x / l); }); const dot = c.up[0] * up[0] + c.up[1] * up[1] + c.up[2] * up[2];
 ok(dot > 0.99, 'LOCKED style keeps up = local vertical ' + dot.toFixed(3));
 await pg.evaluate(() => window.__game.press('KeyM')); await pg.waitForTimeout(800); c = await pg.evaluate(() => window.__game.camInfo()); ok(c.up[1] === 1 && c.up[0] === 0, 'map up fixed ' + c.up); await pg.screenshot({ path: OUT + '/map.png' }); await pg.evaluate(() => window.__game.exitMap());
 { const d = await br.newPage({ viewport: { width: 1280, height: 800 } }); await d.goto(URL + '?noacademy&fx=low'); await d.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 });
   await d.click('#hFly'); await d.waitForTimeout(1500); await d.keyboard.press('Space'); for (let k = 0; k < 60; k++) { if (await d.evaluate(() => window.__game.F.alt > 400)) break; await d.waitForTimeout(1000); }
   await d.evaluate(() => { window.__game.v.sas = 'off'; }); await d.keyboard.down('KeyD'); let wr = 0, wy = 0; for (let k = 0; k < 8; k++) { await d.waitForTimeout(500); const w = await d.evaluate(() => window.__game.v.w.slice()); wr = Math.max(wr, Math.abs(w[1])); wy = Math.max(wy, Math.abs(w[0]), Math.abs(w[2])); } await d.keyboard.up('KeyD');
   ok(wy > 0.02 && wr < wy * 0.35, `D yaws without rolling: max yaw/pitch rate ${wy.toFixed(3)} rad/s, max roll rate ${wr.toFixed(3)} rad/s`); await d.screenshot({ path: OUT + '/d1280_yaw.png' }); await d.close(); }
 ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
