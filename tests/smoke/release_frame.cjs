// f5.4i release smoke: ?scenario=orbit, RELEASE the payload, then shoot the separation (phone 390x844 + desktop 1280x800).
// Checks the sat is on screen, not under #relBtn (End flight) and that the camera frames sat + stage.
// Usage: U=http://localhost:8941/ OUT=dir node tests/smoke/release_frame.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8941/', OUT = process.env.OUT || '/tmp/rel';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 for (const [tag, vp] of [['phone', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desk', { viewport: { width: 1280, height: 800 } }]]) {
  const pg = await br.newPage(vp); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(URL + '?noacademy&scenario=orbit', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 });
  await pg.waitForTimeout(1500); await pg.evaluate(() => { const b = document.getElementById('hFly'); if (b) b.click(); }); await pg.waitForTimeout(3000);
  const can = await pg.evaluate(() => window.__game.F.canRelease()); ok(can, `${tag}: RELEASE offered in orbit`);
  await pg.evaluate(() => document.getElementById('relBtn').click());
  for (const s of [2, 6]) { await pg.waitForTimeout(s === 2 ? 2000 : 4000); await pg.screenshot({ path: `${OUT}/${tag}_rel${s}.png` }); }
  const r = await pg.evaluate(() => window.__game.relFrame && window.__game.relFrame());
  console.log(tag, JSON.stringify(r));
  ok(r && r.sat && r.sat.on, `${tag}: sat on screen`); ok(r && r.stage && r.stage.on, `${tag}: stage on screen`); ok(r && !r.under, `${tag}: End flight button clear of the sat`);
  ok(!errs.length, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
