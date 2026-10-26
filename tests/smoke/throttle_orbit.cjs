// f5.9 (QA f5.9-2 P1): in orbit with AUTO on, the throttle strip stays in the bottom bar at every size, is hit-testable,
// and touching it hands control to the player (AUTO off, throttle follows the finger).
//   U=http://localhost:8982/ [VP=390x844,844x390,1280x800] node tests/smoke/throttle_orbit.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8982/', VPS = (process.env.VP || '390x844,844x390,1280x800,1920x1080').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [w, h] = vp.split('x').map(Number), touch = Math.min(w, h) < 700;
    const pg = await br.newPage({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(180000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL + '?noacademy&fx=low&scenario=orbit'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
    await pg.evaluate(() => window.__game.launch()); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { const F = window.__game.F; F.setAuto(true); }); await pg.waitForTimeout(1200);
    const r = await pg.evaluate(() => { const g = window.__game, b = document.body, t = document.getElementById(b.classList.contains('touch') ? 'mThr' : 'dThr') || document.getElementById('dThr') || document.getElementById('mThr');
      const cands = ['mThr', 'dThr'].map(i => document.getElementById(i)).filter(e => e && e.getBoundingClientRect().width > 4 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
      const e = cands[0]; if (!e) return { found: false, orbit: !!g.F.flags.orbit, auto: !!g.F.autoOn };
      const q = e.getBoundingClientRect(), top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height * 0.15);
      return { found: true, id: e.id, inBar: !!e.closest('#botBar'), onscreen: q.left >= 0 && q.top >= 0 && q.right <= innerWidth && q.bottom <= innerHeight, hit: !!top && (top === e || e.contains(top)), rect: [q.left | 0, q.top | 0, q.width | 0, q.height | 0], orbit: !!g.F.flags.orbit, auto: !!g.F.autoOn }; });
    ok(r.found && r.orbit && r.auto, `${vp} AUTO on in orbit and the throttle strip shows ${JSON.stringify(r)}`);
    if (r.found) {
      ok(r.inBar && r.onscreen && r.hit, `${vp} strip is in the bottom bar, on screen and hit-testable`);
      const cx = r.rect[0] + r.rect[2] / 2, cy = r.rect[1] + r.rect[3] * 0.15;
      if (touch) await pg.touchscreen.tap(cx, cy); else await pg.mouse.click(cx, cy);
      /* QA f5.9-7b: v.throttle follows v.ut a few frames later; on SwiftShader at 1-5 fps a 600 ms read gave thr 0 at 3 of 4 sizes. Poll up to 4 s so the check proves the engine really throttles up */
      let a; for (let k = 0; k < 8; k++) { await pg.waitForTimeout(500); a = await pg.evaluate(() => ({ auto: !!window.__game.F.autoOn, ut: window.__game.F.v.ut, thr: window.__game.F.v.throttle })); if (a.thr > 0.6) break; }
      ok(!a.auto && a.ut > 0.6 && a.thr > 0.6, `${vp} tapping the strip hands control over and the engine throttles up ${JSON.stringify(a)}`);
    }
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
