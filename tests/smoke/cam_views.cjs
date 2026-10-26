// f5.9: V cycles the camera (vehicle -> free -> ground -> horizon -> vehicle), < > step the time warp, / cancels it,
// the launch opens with a slow zoom-out, and the ground camera zooms out toward the horizon.
//   U=http://localhost:8982/ [VP=844x390] node tests/smoke/cam_views.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8982/', [W, H] = (process.env.VP || '844x390').split('x').map(Number);
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const pg = await br.newPage({ viewport: { width: W, height: H } }); pg.setDefaultTimeout(600000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
  await pg.click('#hFly'); await pg.waitForTimeout(2500);
  const cv = () => pg.evaluate(() => window.__game.camView()), key = k => pg.evaluate(k => window.__game.press(k), k);
  ok((await cv()).view === 'vehicle', 'a flight starts in the vehicle camera');
  const seq = []; for (let i = 0; i < 4; i++) { await key('KeyV'); await pg.waitForTimeout(250); seq.push((await cv()).view); }
  ok(seq.join() === 'free,ground,horizon,vehicle', 'V cycles free, ground, horizon, vehicle: ' + seq.join());
  await key('KeyV'); await key('KeyV'); await pg.waitForFunction(() => { const c = window.__game.camView(); return c.gact && c.label === '🎥 GROUND'; }, null, { timeout: 600000 }); const g0 = await cv();
  ok(g0.view === 'ground' && g0.label === '🎥 GROUND' && !g0.btnHidden, 'the camera button shows the view ' + g0.label);
  await pg.evaluate(() => document.querySelector('canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true }))); const g1 = await cv();
  ok(g1.gzoom > g0.gzoom * 1.5, `ground camera zooms out toward the horizon (zoom ${g0.gzoom} -> ${g1.gzoom})`);
  await key('KeyV'); await key('KeyV'); await pg.waitForTimeout(300);
  // launch opening shot: start AUTO, ignite, the camera pulls back and then settles
  const d0 = (await cv()).dist; await key('KeyF'); await key('Space'); await pg.waitForFunction(() => window.__game.camView().open === 1, null, { timeout: 600000 }); const o1 = await cv(); await pg.waitForFunction(() => window.__game.camView().openT > 5, null, { timeout: 600000 }); const o2 = await cv();
  ok(o1.open === 1 && o2.dist > d0 * 1.4, `launch opens with a slow zoom-out (dist ${d0} -> ${o1.dist} -> ${o2.dist}, open=${o1.open})`);
  await pg.mouse.move(W / 2, H / 2); await pg.mouse.down(); await pg.mouse.move(W / 2 + 40, H / 2 + 10); await pg.mouse.up(); await pg.waitForTimeout(400);
  ok((await cv()).open === 0, 'a drag cancels the opening shot, zoom stays available');
  await pg.close();
  const p2 = await br.newPage({ viewport: { width: W, height: H } }); p2.setDefaultTimeout(600000); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(URL + '?noacademy&fx=low&scenario=orbit'); await p2.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
  await p2.evaluate(() => window.__game.launch()); await p2.waitForTimeout(2500);
  const wi = () => p2.evaluate(() => window.__game.F.warpI), pk = k => p2.evaluate(k => window.__game.press(k), k);
  await pk('Period'); await pk('Period'); const up = await wi(); await pk('Comma'); const dn = await wi(); await pk('Slash'); const z = await wi();
  ok(up === 2 && dn === 1 && z === 0, `> > = warp step 2, < = 1, / cancels to 0 (${up},${dn},${z})`);
  ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
