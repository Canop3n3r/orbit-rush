// f6.3 music + sound design smoke. Phone 390x844, one browser.
//   menu beat starts on Home (notes keep coming, quiet bus), crossfades out when a flight starts, engine crackle runs in flight,
//   space score starts above the atmosphere and stops on flight end (menu beat takes over on the end card), pause silences all flight sound
//   and plays the menu beat, vacuum makes flight sound very faint, music toggle + music / effects volume persist across a reload.
// Usage: node tests/smoke/audio_music.cjs http://localhost:8958/
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/workspace/pwt/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const base = process.argv[2] || 'http://localhost:8958/', W = 390, H = 844;
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
let n = 0, bad = 0; const ok = (t, m, info) => { n++; if (!t) bad++; console.log((t ? 'ok   ' : 'FAIL ') + m + (info ? ' ' + JSON.stringify(info) : '')); };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }), pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
  const open = async () => { await pg.goto(base + '?noacademy&touch&fx=low', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(800); await pg.touchscreen.tap(W / 2, H * 0.45); await pg.waitForTimeout(600); };
  const A = () => pg.evaluate(() => window.__game.audio()), until = async (f, ms = 6000) => { let a = await A(); for (let t = 0; t < ms && !f(a); t += 250) { await pg.waitForTimeout(250); a = await A(); } return a; };
  const step = s => pg.evaluate(s => { const F = window.__game.F; for (let i = 0; i < s * 50; i++) { F.realT += 0.02; F.step(0.02); } }, s);
  await open();
  // 1. menus have music
  let a = await until(x => x.music.mode === 'menu' && x.music.notes > 8); const n0 = a.music.notes; await pg.waitForTimeout(2500); const a2 = await A();
  ok(a.state === 'running' && a.music.mode === 'menu', 'Home: menu beat is playing', { mode: a.music.mode, ctx: a.state });
  ok(a2.music.notes > n0 + 5, 'Home: the beat keeps scheduling notes', { n0, nAfter: a2.music.notes });
  ok(Math.abs(a2.music.bus - 0.125) < 0.01, 'Home: music bus is about -18 dB (0.125)', { bus: a2.music.bus });
  const rm = []; for (let i = 0; i < 20; i++) { await pg.waitForTimeout(120); rm.push((await A()).music.rms); } a2.music.rms = Math.max(...rm);
  ok(a2.music.rms > 0.003 && a2.music.rms < 0.2, 'Home: the beat is audible but quiet (rms)', { rms: a2.music.rms });
  // 2. flight start crossfades the beat out, engine crackle runs
  await pg.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); const G = window.__game; G.setDesign(G.TEMPLATES.find(t => t.name === 'Light & fast') || G.TEMPLATES[0]); G.launch(); }); await pg.waitForTimeout(800);
  await pg.evaluate(() => window.__game.press('Space')); await step(10); await pg.waitForTimeout(600);
  a = await until(x => x.music.mode === 'off' && x.crack === 1);
  ok(a.music.mode === 'off', 'flight start: menu beat crossfades out (no music in the lower air)', { mode: a.music.mode });
  ok(a.crack === 1 && a.loops >= 1 && a.sfx === 1, 'flight: rumble + crackle loops live, effects volume 1', { crack: a.crack, loops: a.loops });
  // 2b. camera distance: vehicle camera loud, ground camera loses the rocket fast
  const chaseK = (await A()).mix.distK; await pg.evaluate(() => { const G = window.__game; if (!G.F.autoOn) G.press('KeyF'); G.setGroundCam(true); }); await step(3); a = await until(x => x.mix.distK < chaseK * 0.7, 4000);
  ok(chaseK > 0.9 && a.mix.distK < 0.4, 'camera distance: vehicle camera stays loud, ground camera is much quieter', { chase: chaseK, ground: a.mix.distK, dist: Math.round(a.mix.dist) });
  await pg.evaluate(() => window.__game.setGroundCam(false)); await pg.waitForTimeout(300);
  // 3. space score above the atmosphere; vacuum makes flight sound faint
  await pg.evaluate(() => { const G = window.__game; G.F.placeInOrbit(170000); }); await step(2); await pg.waitForTimeout(700);
  a = await until(x => x.music.mode === 'space' && x.music.notes > 0 && x.dist < 0.3, 9000); const s0 = a.music.notes; const s1 = await until(x => x.music.notes > s0, 25000);
  ok(a.music.mode === 'space', 'in orbit: space score is playing', { mode: a.music.mode, level: a.music.level });
  ok(s1.music.notes > s0, 'space score keeps evolving (pads and arps scheduled)', { s0, s1: s1.music.notes });
  ok(s1.music.rms > 0.002 && s1.music.rms < 0.1, 'space score is audible but quiet', { rms: s1.music.rms });
  ok(a.dist < 0.3 && a.mix.vacK < 0.25, 'vacuum: flight sound bus is very faint', { dist: a.dist, vacK: a.mix.vacK });
  // 4. pause: menu beat, zero flight sound
  await pg.evaluate(() => window.__game.setPause(true)); a = await until(x => x.music.mode === 'menu' && x.loops === 0 && x.bus < 0.01, 5000);
  ok(a.music.mode === 'menu' && a.loops === 0 && a.crack === 0 && a.bus < 0.01, 'pause: flight audio silenced, menu beat plays', { music: a.music.mode, loops: a.loops, crack: a.crack, bus: a.bus });
  await pg.evaluate(() => window.__game.setPause(false)); a = await until(x => x.music.mode === 'space' && x.loops >= 1, 8000);
  ok(a.music.mode === 'space' && a.loops >= 1 && a.crack === 1, 'unpause: space score and flight sound resume', { music: a.music.mode, loops: a.loops });
  // 5. flight end: end card has the menu beat, space score is gone
  await pg.evaluate(() => { const G = window.__game; G.F.flags.dead = 'Impact at 50 m/s'; G.F.flags.cause = 'impact'; G.showEnd(); }); a = await until(x => x.music.mode === 'menu', 5000);
  ok(a.music.mode === 'menu' && a.loops === 0, 'flight end: space score stops, menu beat on the end card', { mode: a.music.mode, loops: a.loops });
  await pg.evaluate(() => document.getElementById('againBtn').click()); a = await until(x => x.music.mode === 'menu', 4000);
  ok(a.music.mode === 'menu' && a.loops === 0, 'back to Home: menu beat, no flight loops', { mode: a.music.mode });
  // 6. settings: toggle + volumes persist
  await pg.evaluate(() => window.__game.qol.openSettings()); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const e = document.querySelector('[data-set="musicOn"]'); e.click(); }); a = await until(x => x.music.mode === 'off', 4000);
  ok(a.music.mode === 'off' && !a.music.enabled, 'Settings: music off stops the beat', { mode: a.music.mode });
  await pg.evaluate(() => { const e = document.querySelector('[data-set="musicOn"]'); e.click(); }); a = await until(x => x.music.mode === 'menu', 4000);
  ok(a.music.mode === 'menu', 'Settings: music on brings it back', { mode: a.music.mode });
  await pg.evaluate(() => { for (const [k, v] of [['musicVol', '0.8'], ['sfxVol', '0.4']]) { const e = document.querySelector('[data-vol="' + k + '"]'); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); } }); await pg.waitForTimeout(500); a = await A();
  ok(Math.abs(a.music.bus - 0.2) < 0.01 && Math.abs(a.sfx - 0.4) < 0.01, 'Settings: music volume 80% -> bus 0.2, effects 40%', { bus: a.music.bus, sfx: a.sfx });
  await pg.evaluate(() => document.querySelector('[data-set="musicOn"]').click()); await pg.waitForTimeout(300);
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('orbitrush.settings.v1')));
  ok(saved.musicOn === false && saved.musicVol === 0.8 && saved.sfxVol === 0.4, 'settings saved in localStorage', { musicOn: saved.musicOn, musicVol: saved.musicVol, sfxVol: saved.sfxVol });
  await open(); a = await A(); await pg.waitForTimeout(1500); a = await A();
  ok(a.music.mode === 'off' && !a.music.enabled && Math.abs(a.sfx - 0.4) < 0.01, 'after a reload: music still off, effects volume still 40%', { mode: a.music.mode, sfx: a.sfx });
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | '));
  console.log(`audio_music: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
