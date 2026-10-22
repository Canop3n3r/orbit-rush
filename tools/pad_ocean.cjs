// Pad-camera ocean shots at sea level: Q="&gfx=high&sun=day" TAG=high node tools/pad_ocean.cjs -> /workspace/shots/flight2_ocean_pad_<TAG>[_seqNN].png
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const U = process.env.U || 'http://localhost:8933/', TAG = process.env.TAG || 'high', N = +(process.env.N || 0), O = '/workspace/shots/flight2_ocean_pad_' + TAG;
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU });
  const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(300000); pg.on('pageerror', e => console.log('PE', e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(U + '?noacademy' + (process.env.Q || '&gfx=high&sun=day')); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(3000);
  await pg.click('#hSite'); await pg.click('#sitePick .spBodies button[data-b="earth"]'); await pg.waitForTimeout(300); await pg.click(`#sitePick .spSites button[data-i="${process.env.SITE || 4}"]`); await pg.click('#sitePick .spX'); await pg.waitForTimeout(6000);
  await pg.click('#hFly'); await pg.waitForTimeout(5000); // on the pad, flight camera, engines off (f5.5b: no auto-ignite)
  console.log(await pg.evaluate(() => JSON.stringify({ alt: window.__game.F.alt, ign: window.__game.F.ignited })));
  for (let k = 0; k < 4; k++) { await pg.evaluate(k => window.__game.camSet(k * Math.PI / 2, 0.06, 60), k); await pg.waitForTimeout(2500); await pg.screenshot({ path: `${O}_yaw${k}.png` }); }
  const best = +(process.env.YAW ?? -1); if (best >= 0) await pg.evaluate(k => window.__game.camSet(k * Math.PI / 2, 0.06, 60), best); await pg.waitForTimeout(2000);
  await pg.screenshot({ path: O + '.png' });
  for (let i = 0; i < N; i++) { await pg.screenshot({ path: `${O}_seq${String(i).padStart(2, '0')}.png` }); await pg.waitForTimeout(250); }
  await br.close(); })();
