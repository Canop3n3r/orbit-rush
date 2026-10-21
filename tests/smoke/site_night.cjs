// f5.4j site lights vs the local sun: pick a site on Home, shoot it, then again on a page whose clock is half a local day later (Moon: 14.8 d), shoot again.
// Checks the lights are on only when the sun at the site is below -4°. Usage: U=http://localhost:8941/ OUT=dir node tests/smoke/site_night.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8941/', OUT = process.env.OUT || '/tmp/night';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 for (const [body, re, half] of [['earth', /Atoll/, 43200], ['moon', /Moon Base/, 1275000], ['mars', /Mars Base/, 44400]]) {
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
  await pg.goto(URL + '?noacademy'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1500);
  await pg.click('#hSite'); await pg.click(`#sitePick .spBodies button[data-b="${body}"]`);
  await pg.evaluate(r => [...document.querySelectorAll('#sitePick .spSites button')].find(b => new RegExp(r).test(b.textContent)).click(), re.source); await pg.click('#sitePick .spX');
  await pg.waitForTimeout(5000); const a = await pg.evaluate(() => window.__game.siteSun()); await pg.screenshot({ path: `${OUT}/${body}_a.png` });
  await pg.evaluate(([b, h]) => { const G = window.__game; if (b === 'earth') G.P.setEarthPhase(G.P.earthPhase() + Math.PI); else G.F.t0 += h; }, [body, half]); /* half a local day later */
  await pg.waitForTimeout(3000); const b = await pg.evaluate(() => window.__game.siteSun()); await pg.screenshot({ path: `${OUT}/${body}_b.png` });
  console.log(body, JSON.stringify(a), JSON.stringify(b));
  for (const [s, t] of [[a, 'a'], [b, 'b']]) { ok(s.length > 0, `${body} ${t}: site art loaded`); for (const x of s) ok(x.night === x.el < -3 || Math.abs(x.el + 3) < 1.5, `${body} ${t}: sun ${x.el}° → lights ${x.night ? 'on' : 'off'} (${x.lights} lit)`); }
  if (body === 'earth') ok(a[0] && b[0] && a[0].night !== b[0].night, `${body}: day and night both seen`);
  ok(!errs.length, `${body}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
