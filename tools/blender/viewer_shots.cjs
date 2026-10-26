// Contact shots of staged models in gfx/vehicles/viewer.html (headless chrome): U=http://localhost:8975/ OUT=/workspace/shots_blender node tools/blender/viewer_shots.cjs <tier> <id> [id...]
// Writes <OUT>/v_<id>_<tier>_<view>.png for views: side (yaw .7), front, close (engines). One browser, one page.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const U = process.env.U || 'http://localhost:8975/', OUT = process.env.OUT || '/workspace/shots_blender';
const [tier, ...ids] = process.argv.slice(2);
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const pg = await br.newPage({ viewport: { width: 640, height: 800 } }); pg.setDefaultTimeout(240000);
  await pg.goto(`${U}gfx/vehicles/viewer.html?webgl&staged=all&tier=${tier}`); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready);
  for (const id of ids) {
    for (const [n, o] of [['side', { yaw: 0.7 }], ['front', { yaw: 2.3 }], ['base', { yaw: 0.7, camY: 0.12, aim: 0.1, k: 0.55 }]]) {
      await pg.evaluate(async ([id, o, tier]) => { const V = window.__viewer; await V.showStaged(id, { ...o, detail: tier });
        if (o.k) { const c = V.cam, h = (Math.hypot(c.position.x, c.position.z) - 6) / 1.75, d = Math.max(9, h * o.k), yw = o.yaw; c.position.set(Math.cos(yw) * d, h * o.camY, Math.sin(yw) * d); V.ctl.target.set(0, h * o.aim, 0); V.ctl.update(); } }, [id, o, tier]);
      await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/v_${id}_${tier}_${n}.png` }); } console.log('shot', id); }
  await br.close(); })().catch(e => { console.log('FAIL', e.message); process.exit(1); });
