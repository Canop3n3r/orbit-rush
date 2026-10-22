// Ocean shots near the home coast: sea level (pad view), 2 km, 10 km stills + an animated frame sequence -> /workspace/shots/flight2_ocean*
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const U = process.env.U || 'http://localhost:8933/', O = '/workspace/shots/flight2_ocean', Q = process.env.Q || '&gfx=high';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU });
  const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(300000); pg.on('pageerror', e => console.log('PE', e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(U + '?noacademy' + Q); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(3000);
  await pg.click('#hSite'); await pg.click('#sitePick .spBodies button[data-b="earth"]'); await pg.waitForTimeout(300); await pg.click('#sitePick .spSites button[data-i="1"]'); await pg.click('#sitePick .spX'); await pg.click('#hNext'); await pg.waitForTimeout(5000);
  for (let i = 0; i < 12; i++) { await pg.screenshot({ path: `${O}_seq_${String(i).padStart(2, '0')}.png` }); await pg.waitForTimeout(350); } // pad camera looks over the surf
  await pg.screenshot({ path: `${O}_sealevel.png` });
  await pg.click('#hFly'); await pg.waitForTimeout(3000); await pg.keyboard.press('f'); await pg.keyboard.press('Space'); await pg.waitForTimeout(1000);
  for (const a of [2000, 10000]) { await pg.evaluate(a => { const F = window.__game.F; for (let i = 0; i < 60000 && F.alt < a; i++) { F.realT += 0.02; F.step(0.02); } }, a); await pg.waitForTimeout(3000); await pg.screenshot({ path: `${O}_${a / 1000}km.png` }); }
  await br.close(); })();
