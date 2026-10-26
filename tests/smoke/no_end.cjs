// f5.6 (owner): reaching orbit / landing never ends the flight or pops the end card; only destruction does.
// Usage: U=http://localhost:8958/ node tests/smoke/no_end.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8958/';
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 const pg = await br.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
 await pg.goto(URL + '?noacademy&fx=low&scenario=orbit'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 });
 await pg.evaluate(() => window.__game.launch()); await pg.waitForTimeout(2000);
 await pg.evaluate(() => { const F = window.__game.F; F.call('end', 100, () => true); }); await pg.waitForTimeout(1500);
 const r = await pg.evaluate(() => ({ end: !document.getElementById('end').classList.contains('hidden'), ended: window.__game.F.ended, state: window.__game.state, orbit: !!window.__game.F.flags.orbit }));
 ok(!r.end && !r.ended && r.state === 'flight', 'goal end-call keeps flying, no card ' + JSON.stringify(r));
 await pg.evaluate(() => window.__game.F.fail('test')); await pg.waitForTimeout(4500);
 ok(await pg.evaluate(() => !document.getElementById('end').classList.contains('hidden')), 'destruction still ends the flight');
 ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | ')); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
