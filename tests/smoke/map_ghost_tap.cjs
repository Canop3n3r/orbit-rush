// QA f5.9-16 (Playtest QA Bot): on phones the flight MAP button fires on pointerdown and the map bar's ⋯ sits on the very same spot
// (390x844: MAP centre 305,28 = ⋯ centre 305,28), so the click that follows the same touch could land on ⋯ and open the 10-button
// map grid over a third of the screen (live f5.9-16: 1 in 6 single MAP taps + the QA walk). Checks: N real single touch taps on MAP never
// leave the ⋯ grid open; a deliberate ⋯ tap after the map is up still opens it; no page errors.
//   U=http://localhost:8960/ [VP=390x844,844x390] [N=8] node tests/smoke/map_ghost_tap.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390').split(','), N = +(process.env.N || 8);
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number);
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    const pos = sel => pg.evaluate(sel => { const b = [...document.querySelectorAll(sel)].find(e => e.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    const st = () => pg.evaluate(() => { const m = document.getElementById('mapMore'), bar = document.getElementById('mapBar'); return { more: !!m && !m.classList.contains('hidden') && m.getBoundingClientRect().height > 0, map: !!bar && bar.getBoundingClientRect().width > 0 }; });
    let opened = 0, mapped = 0;
    for (let i = 0; i < N; i++) { const p = await pos('#mMap,#dMap'); if (!p) { ok(false, `${vp}: MAP button not found`); break; } await pg.touchscreen.tap(p[0], p[1]); await pg.waitForTimeout(1000); const s = await st(); if (s.map) mapped++; if (s.more) opened++;
      await pg.evaluate(() => { document.getElementById('mapMore')?.classList.add('hidden'); document.querySelector('#mapBar [data-a=close]')?.click(); }); await pg.waitForTimeout(1200); }
    ok(mapped === N, `${vp}: a single MAP tap opens the map (${mapped}/${N})`);
    ok(opened === 0, `${vp}: a single MAP tap never also opens the ⋯ grid (${opened}/${N})`);
    const p = await pos('#mMap,#dMap'); await pg.touchscreen.tap(p[0], p[1]); await pg.waitForTimeout(1200); const m = await pos('#mapBar [data-a=more]'); await pg.touchscreen.tap(m[0], m[1]); await pg.waitForTimeout(700);
    ok((await st()).more, `${vp}: a deliberate ⋯ tap on the open map still opens the grid`);
    ok(!errs.length, `${vp}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `map_ghost_tap: ${bad} FAIL` : 'map_ghost_tap: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
