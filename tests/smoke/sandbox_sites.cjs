// f5.4 sandbox launch-from-anywhere smoke (phone 390x844): open the 📍 picker, pick Moon / Mars / an Earth site, FLY on AUTO,
// screenshot the pad on Home, liftoff and orbit. Usage: U=http://localhost:8931/ OUT=dir node tests/smoke/sandbox_sites.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8931/', OUT = process.env.OUT || '/tmp/sb';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 const ALL = [['moon', 0], ['mars', 0], ['earth', 1]] /* Moon Base Pad, Mars Base Pad (Gale), North Coast Complex */, ONLY = process.env.BODY; for (const [body, idx] of ALL.filter(x => !ONLY || x[0] === ONLY)) {
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(URL + '?noacademy', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(3000);
  await pg.click('#hSite'); await pg.click(`#sitePick .spBodies button[data-b="${body}"]`); await pg.waitForTimeout(300); await pg.screenshot({ path: `${OUT}/${body}_picker.png` });
  await pg.click(`#sitePick .spSites button[data-i="${idx}"]`); await pg.click('#sitePick .spX'); if (body === 'earth') await pg.click('#hNext'); /* an orbital rocket (Pip is suborbital) */ await pg.waitForTimeout(5000);
  await pg.screenshot({ path: `${OUT}/${body}_home.png` }); ok(await pg.evaluate(b => window.__game.F.body === b, body), `${body}: Home rocket sits on ${body}`);
  await pg.click('#hFly'); await pg.waitForTimeout(9000); await pg.screenshot({ path: `${OUT}/${body}_liftoff.png` });
  const st = await pg.evaluate(() => ({ alt: window.__game.F.alt, body: window.__game.F.body }));
  ok(st.body === body && st.alt > 20, `${body}: lifted off (${st.alt.toFixed(0)} m)`);
  for (let k = 0; k < 120; k++) { const d = await pg.evaluate(b => { const G = window.__game, F = G.F; for (let i = 0; i < 1500 && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); } /* fast-forward the live flight (same Flight code; swiftshader frames are too slow for real time) */ return F.flags.dead || (b === 'earth' ? F.flags.orbit : (F.goals[b] || {}).orbit) && F.v.guid === 'done'; }, body); if (d) break; await pg.waitForTimeout(300); }
  const fin = await pg.evaluate(b => { const F = window.__game.F, o = window.__game.P.orbitOf(F.v); return { body: F.body, dead: F.flags.dead, ap: o.ap, pe: o.pe, orbit: b === 'earth' ? !!F.flags.orbit : !!(F.goals[b] || {}).orbit }; }, body);
  await pg.screenshot({ path: `${OUT}/${body}_orbit.png` }); ok(fin.orbit && !fin.dead, `${body}: orbit Ap ${(fin.ap / 1e3).toFixed(0)} km Pe ${(fin.pe / 1e3).toFixed(0)} km`);
  ok(!errs.length, `${body}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
