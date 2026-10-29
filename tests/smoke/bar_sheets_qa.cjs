// QA f5.9-12 (Playtest QA Bot): two regressions the budget + census smokes miss.
//  1. THR pill on screen: the 46px pill (e894c024) must sit fully inside the viewport and inside its bar #bbR, which must not overflow
//     (live f5.9-12: THR right edge 854/844, 1290/1280, 1930/1920, #bbR scrollWidth +18; throttle_orbit/ui_walk/booster_view fail on it).
//  2. Desktop sheets without a backdrop (W ≥ 900): the title bar must touch its body (live: 77–317 px gap), and the sheet must be dismissable
//     the desktop way, Esc or a click on empty space, or else Home must stay clickable (live: an invisible layer eats the click, Esc does nothing).
//   U=http://localhost:8960/ [VP=390x844,844x390,1280x800,1920x1080] node tests/smoke/bar_sheets_qa.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800,1920x1080').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700, desk = W >= 900;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    const isOpen = id => pg.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden') && e.getBoundingClientRect().width > 0; }, id);
    if (desk) for (const [btn, id, body] of [['#hAtlasB', 'atlas', '#atlasBody'], ['#hGear', 'settings', '#setBody']]) {
      await pg.click(btn); await pg.waitForTimeout(1200);
      const g = await pg.evaluate(([id, body]) => { const h2 = document.querySelector('#' + id + ' .mbox>h2'), b = document.querySelector(body); if (!h2 || !b) return null; return Math.round(b.getBoundingClientRect().top - h2.getBoundingClientRect().bottom); }, [id, body]);
      ok(g !== null && g <= 24, `${vp} ${id}: title bar sits on its body (gap ${g} px ≤ 24)`);
      await pg.keyboard.press('Escape'); await pg.waitForTimeout(600); const escClosed = !(await isOpen(id));
      if (!escClosed) { await pg.mouse.click(W - 30, Math.round(H * 0.45)); await pg.waitForTimeout(700); }
      const outClosed = escClosed || !(await isOpen(id));
      ok(outClosed, `${vp} ${id}: Esc or a click on empty space closes it (esc ${escClosed}, outside ${outClosed})`);
      if (await isOpen(id)) { await pg.evaluate(id => { const b = document.querySelector('#' + id + ' .mbox>h2 button, #' + id + ' button[id$=Close]'); b && b.click(); }, id); await pg.waitForTimeout(600); }
    }
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    const t = await pg.evaluate(() => { const e = document.getElementById('mThr') && document.getElementById('mThr').getBoundingClientRect().width ? document.getElementById('mThr') : document.getElementById('dThr'), bar = document.getElementById('bbR');
      if (!e) return null; const q = e.getBoundingClientRect(), b = bar && bar.getBoundingClientRect(); return { l: Math.round(q.left), r: Math.round(q.right), t: Math.round(q.top), btm: Math.round(q.bottom), barR: b ? Math.round(b.right) : null, over: bar ? bar.scrollWidth - bar.clientWidth : 0, W: innerWidth, H: innerHeight }; });
    ok(!!t && t.l >= 0 && t.r <= t.W && t.t >= 0 && t.btm <= t.H, `${vp} THR pill fully on screen ${JSON.stringify(t)}`);
    ok(!!t && (t.barR === null || t.r <= t.barR + 1) && t.over <= 2, `${vp} THR inside #bbR, bar not overflowing (overflow ${t && t.over} px)`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `bar_sheets_qa: ${bad} FAIL` : 'bar_sheets_qa: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
