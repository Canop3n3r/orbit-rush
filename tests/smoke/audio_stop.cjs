// Flight audio never leaks into the menus (f5.8y, owner: "whatever sound was playing when a rocket ends its flight keeps playing into the menu").
// Phone 390x844, one browser. Flies a few seconds, then checks the number of live LOOPING sources (engine rumble + wind) and the flight bus gain
//   in flight (loops >= 1) · after a crash end card (0 loops) · after Keep flying (loops back) · under the pause menu (0) · after Home (0 loops, bus faded to 0)
//   · after the next launch (bus back to 1, loops back).
// Usage: node tests/smoke/audio_stop.cjs http://localhost:8958/
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/workspace/pwt/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const base = process.argv[2] || 'http://localhost:8958/', W = 390, H = 844;
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
let n = 0, bad = 0; const ok = (t, m, info) => { n++; if (!t) bad++; console.log((t ? 'ok   ' : 'FAIL ') + m + (info ? ' ' + JSON.stringify(info) : '')); };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }), pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
  await pg.goto(base + '?noacademy&touch&fx=low', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(800);
  await pg.touchscreen.tap(W / 2, H * 0.45); await pg.waitForTimeout(500);
  const A0 = () => pg.evaluate(() => window.__game.audio()), A = async () => { let a = await A0(); for (let i = 0; i < 12 && (a.loops > 0 || a.bus > 0.01) && a.bus < 1 + 1; i++) { if (a.bus === 1 && a.loops > 0) break; await pg.waitForTimeout(300); a = await A0(); } return a; }, // a fade runs on audio time: give it up to ~3.6 s under load
   step = s => pg.evaluate(s => { const F = window.__game.F; for (let i = 0; i < s * 50; i++) { F.realT += 0.02; F.step(0.02); } }, s);
  const flyTo = async () => { await pg.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); const G = window.__game; G.setDesign(G.TEMPLATES.find(t => t.name === 'Light & fast') || G.TEMPLATES[0]); G.launch(); }); await pg.waitForTimeout(800);
    await pg.evaluate(() => window.__game.press('Space')); await step(15); await pg.waitForTimeout(600); };
  await flyTo(); let a = await A(); ok(a.state === 'running' && a.loops >= 1 && a.bus === 1, 'in flight: engine/wind loops live, bus open', a);
  // crash end card
  await pg.evaluate(() => { const G = window.__game; G.F.flags.dead = 'Impact at 50 m/s'; G.F.flags.cause = 'impact'; G.showEnd(); }); await pg.waitForTimeout(1500); a = await A();
  ok(a.loops === 0, 'crash end card: zero looping sources', a);
  await pg.evaluate(() => document.getElementById('againBtn').click()); await pg.waitForTimeout(1200); a = await A();
  ok(a.loops === 0 && a.bus < 0.01, 'Home after the crash: zero looping sources, flight bus faded out', a);
  // Home straight from a live flight (no end card), pause menu
  await flyTo(); a = await A(); ok(a.loops >= 1 && a.bus === 1, 'second flight: loops live and bus reopened', a);
  await pg.evaluate(() => window.__game.setPause(true)); await pg.waitForTimeout(900); a = await A(); ok(a.loops === 0, 'pause menu: zero looping sources', a);
  await pg.evaluate(() => window.__game.setPause(false)); await pg.waitForTimeout(600); a = await A(); ok(a.loops >= 1, 'unpause: loops back', a);
  await pg.evaluate(() => window.__game.goBuild()); await pg.waitForTimeout(1200); a = await A(); ok(a.loops === 0 && a.bus < 0.01, 'Home mid-flight: zero looping sources, bus faded out', a);
  // no wind roar can come back in the menus even if the flight tick fires (state build)
  await pg.waitForTimeout(1000); a = await A(); ok(a.loops === 0, 'a second later in the menu: still zero loops', a);
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
  console.log(`audio_stop: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
