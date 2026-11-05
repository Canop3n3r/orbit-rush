// f5.9-30: trailer URL hooks. Clean plate hides HUD/toasts/nav without pausing, warp is set with no toast, a dolly path moves.
//   U=http://localhost:8960/ node tests/smoke/trailer_hooks.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const URL = process.env.U || 'http://localhost:8960/';
(async () => {
  const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const pg = await br.newPage({ viewport: { width: 1280, height: 800 } }); pg.setDefaultTimeout(240000);
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); localStorage.removeItem('orbitRush.site.v1'); } catch (e) { } });
  await pg.goto(URL + '?hud=0&trailer=1&warp=10&cine=dolly&fx=low&webgl&noacademy');
  await pg.waitForFunction(() => window.__cine && window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
  await pg.waitForFunction(() => { const F = window.__game.flight && window.__game.flight(); return F && window.__cine.status && window.__cine.status().on; }, null, { timeout: 60000 });
  await pg.waitForTimeout(600);
  const plate = await pg.evaluate(() => {
    const disp = id => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : 'missing'; };
    const F = window.__game.flight(), st = window.__cine.status();
    return { clean: document.body.classList.contains('clean'), pause: st.pause, paused: st.paused, hud: disp('hud'), top: disp('topBar'), bot: disp('botBar'), nav: disp('nav'), badge: disp('badge'), ignite: disp('ignite'),
      toasts: (document.getElementById('toasts') || {}).textContent || '', warpI: F.warpI, eff: F.effWarp(), path: st.path && st.path.name, dist: st.path && st.path.dist, real: F.realT, body: F.body };
  });
  ok(plate.clean && plate.pause === false && plate.paused === false, 'clean plate is on and the sim is not paused');
  ok(plate.hud === 'none' && plate.top === 'none' && plate.bot === 'none', `HUD and both bars are hidden (hud ${plate.hud}, top ${plate.top}, bot ${plate.bot})`);
  ok(plate.nav === 'none' || plate.nav === 'missing', `navball hidden (${plate.nav})`);
  ok(plate.badge === 'none' && plate.ignite === 'none', `badge and ignite hidden (${plate.badge}, ${plate.ignite})`);
  ok(!/Time warp/.test(plate.toasts), 'warp did not toast', JSON.stringify(plate.toasts).slice(0, 80));
  ok(plate.warpI === 3 && plate.path === 'dolly' && plate.dist > 200, `warp index ×10 and dolly starts wide (i ${plate.warpI}, ${plate.path}, dist ${plate.dist && plate.dist.toFixed(0)})`);
  const moved = await pg.evaluate(async () => {
    const t0 = window.__game.flight().realT, d0 = window.__game.camView().dist;
    window.__cine.seek(6);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const st = window.__cine.status(), cam = window.__game.camView();
    return { t0, real: window.__game.flight().realT, d0, dist: cam.dist, fov: window.__game.scn.camera.fov, path: st.path && st.path.dist };
  });
  ok(moved.path > 120 && moved.path < 180 && moved.dist < moved.d0 - 40, `dolly at 6s frames in (path ${moved.path.toFixed(0)}, cam ${moved.d0.toFixed(0)} → ${moved.dist.toFixed(0)}, fov ${moved.fov.toFixed(0)})`);
  ok(moved.fov > 28 && moved.fov < 36, `dolly fov is the mid keyframe (${moved.fov.toFixed(1)})`);
  ok(moved.real > moved.t0, `sim time advances under the clean plate (${moved.t0.toFixed(2)} → ${moved.real.toFixed(2)})`);
  const warp = await pg.evaluate(() => {
    const F = window.__game.flight(); F.placeInOrbit(200000);
    const p = window.__cine.warp(100); const toasts = (document.getElementById('toasts') || {}).textContent || '';
    return { mult: p && p.mult, quiet: p && p.quiet, eff: F.effWarp(), warpI: F.warpI, toasts, gain: window.__orAudio.gain(0.25), master: window.__orAudio.master };
  });
  ok(warp.quiet && warp.mult === 100 && warp.eff === 100 && !/Time warp/.test(warp.toasts), `script warp ×100 is quiet and effective in orbit (eff ${warp.eff})`);
  ok(warp.gain === 0.25 && Math.abs(warp.master - 0.25) < 1e-6, `__orAudio master gain is 0.25 (${warp.master})`);
  await pg.goto(URL + '?fx=low&webgl&noacademy');
  await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
  await pg.waitForTimeout(500);
  const home = await pg.evaluate(() => ({ clean: document.body.classList.contains('clean'), cine: window.__cine.active, fly: !!document.getElementById('hFly') }));
  ok(!home.clean && !home.cine && home.fly, 'a normal URL does not enable trailer mode');
  await pg.click('#hFly');
  await pg.waitForTimeout(1500);
  const play = await pg.evaluate(() => {
    const hud = document.getElementById('hud'), top = document.getElementById('topBar');
    return { clean: document.body.classList.contains('clean'), hud: hud && getComputedStyle(hud).display, top: top && getComputedStyle(top).display, hidden: hud && hud.classList.contains('hidden') };
  });
  ok(!play.clean && play.hud !== 'none' && !play.hidden && play.top === 'grid', `normal flight still shows the HUD (hud ${play.hud}, top ${play.top}, hidden ${play.hidden})`);
  ok(!errs.length, 'no page errors ' + errs.slice(0, 3).join(' | '));
  await br.close();
  console.log(bad ? `trailer_hooks: ${bad} FAIL` : 'trailer_hooks: all ok');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
