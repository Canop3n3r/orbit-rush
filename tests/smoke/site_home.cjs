// f5.4i site Home + picker shots (Bay Starport camera vs the catch tower, real map textures, 844x390 picker)
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
(async () => { const br = await pw.chromium.launch({ args: GPU });
 for (const [tag, vp] of [['390', { width: 390, height: 844 }], ['844', { width: 844, height: 390 }]]) {
 const pg = await br.newPage({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }); pg.setDefaultTimeout(120000);
 await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
 await pg.goto('' + (process.env.U || 'http://localhost:8941/') + '?noacademy'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(2000);
 await pg.click('#hSite'); await pg.click('#sitePick .spBodies button[data-b="earth"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `' + (process.env.OUT || '/tmp/rel') + '/map_${tag}.png` });
 await pg.click('#sitePick .spBodies button[data-b="mars"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: `' + (process.env.OUT || '/tmp/rel') + '/mapmars_${tag}.png` });
 await pg.click('#sitePick .spBodies button[data-b="earth"]');
 await pg.evaluate(() => [...document.querySelectorAll('#sitePick .spSites button')].find(b => /Bay/.test(b.textContent)).click()); await pg.click('#sitePick .spX');
 for (const t of [4, 10]) { await pg.waitForTimeout(t === 4 ? 4000 : 6000); await pg.screenshot({ path: `' + (process.env.OUT || '/tmp/rel') + '/gulf_${tag}_${t}.png` }); }
 await pg.close(); }
 await br.close(); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
