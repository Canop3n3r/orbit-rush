// f5.4j map frame (the owner's Mars report): sandbox launch on the Moon and Mars, open the map mid-ascent, assert the
// map's craft-to-body distance equals altitude + radius (and the body is drawn at its radius). Usage: U=... OUT=dir node tests/smoke/map_frame.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8941/', OUT = process.env.OUT || '/tmp/mapf';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 for (const body of ['moon', 'mars']) {
  const pg = await br.newPage({ viewport: { width: 1024, height: 576 } }); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
  await pg.goto(URL + '?noacademy'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1500);
  await pg.click('#hSite'); await pg.click(`#sitePick .spBodies button[data-b="${body}"]`); await pg.click('#sitePick .spSites button[data-i="0"]'); await pg.click('#sitePick .spX');
  await pg.click('#hFly'); await pg.waitForTimeout(4000);
  for (let k = 0; k < 40; k++) { const a = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 1500 && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); } return F.alt; }); if (a > (body === 'mars' ? 400000 : 60000)) break; }
  await pg.keyboard.press('KeyM'); await pg.waitForTimeout(2500); await pg.screenshot({ path: `${OUT}/${body}_map.png` });
  const r = await pg.evaluate(() => { const G = window.__game, F = G.F; return { body: F.body, alt: F.alt, p: G.mapProbe() }; });
  console.log(body, JSON.stringify(r));
  const want = r.alt + (r.p ? r.p.R : 0), err = r.p ? Math.abs(r.p.craftToBody - want) / want : 1;
  ok(r.body === body && r.p && err < 0.01, `${body}: map craft-to-body ${(r.p ? r.p.craftToBody / 1e3 : NaN).toFixed(0)} km = alt + R ${(want / 1e3).toFixed(0)} km (err ${(err * 100).toFixed(2)}%)`);
  ok(r.p && Math.abs(r.p.drawnR - r.p.R) / r.p.R < 0.01, `${body}: drawn at its radius`);
  ok(!errs.length, `${body}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
