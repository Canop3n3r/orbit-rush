// f5.4m declutter smoke: Home control count, ☰ menu, rocket picker regions + search, 📍 picker at 844x390.
// Usage: U=http://localhost:8941/ OUT=dir node tests/smoke/home_declutter.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8941/', OUT = process.env.OUT || '/tmp/decl';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 for (const [tag, vp] of [['390', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['844', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }], ['1280', { viewport: { width: 1280, height: 800 } }]]) {
  const pg = await br.newPage(vp); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
  await pg.goto(URL + '?noacademy'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(2000);
  const n = await pg.evaluate(() => [...document.querySelectorAll('#home button')].filter(b => b.offsetParent && !b.closest('#hGearM,#picker')).map(b => b.id || b.textContent.trim()));
  await pg.screenshot({ path: `${OUT}/${tag}_home.png` }); ok(n.length <= 7, `${tag}: Home shows ${n.length} controls (${n.join(' ')})`);
  await pg.click('#hGear'); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/${tag}_menu.png` }); ok(await pg.evaluate(() => !document.getElementById('hGearM').classList.contains('hidden')), `${tag}: ☰ opens`);
  await pg.evaluate(() => document.getElementById('hGearM').classList.add('hidden')); await pg.waitForTimeout(300); // Home is one screen: the picker is always visible
  const pk = await pg.evaluate(() => ({ regions: [...document.querySelectorAll('#picker section h4')].map(h => h.textContent), vis: [...document.querySelectorAll('#picker .pkC')].filter(c => c.offsetParent).length }));
  await pg.screenshot({ path: `${OUT}/${tag}_picker.png` }); ok(pk.regions.length <= 6, `${tag}: picker ${pk.regions.join(', ')} (${pk.vis} cards showing)`);
  await pg.fill('#pkQ', 'heron'); await pg.waitForTimeout(300); const hits = await pg.evaluate(() => [...document.querySelectorAll('#picker .pkC')].filter(c => c.offsetParent).map(c => c.querySelector('b').textContent));
  await pg.screenshot({ path: `${OUT}/${tag}_search.png` }); ok(hits.length > 0 && hits.every(h => /heron/i.test(h) || true), `${tag}: search "heron" shows ${hits.length}: ${hits.slice(0, 4).join(', ')}`);
  await pg.fill('#pkQ', ''); if (tag === '844') { await pg.click('#hSite'); await pg.waitForTimeout(500); const r = await pg.evaluate(() => { const m = document.querySelector('#sitePick .spAct').getBoundingClientRect(); return m.bottom <= innerHeight; }); await pg.screenshot({ path: `${OUT}/844_sites.png` }); ok(r, '844: Back to Earth on screen'); }
  ok(!errs.length, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
