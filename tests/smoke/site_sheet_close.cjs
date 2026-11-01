// QA f5.9-13 (Playtest QA Bot): the 📍 Launch-site sheet (#sitePick) puts a full-screen 40% backdrop over Home, but unlike Atlas, Settings and
// 🎯 it did not close on Esc or on a tap outside its card (live f5.9-13: the tap on the dimmed scene was swallowed, sheet stayed open).
// Checks at every size: Esc closes it, a tap/click outside .spBox closes it, a tap on the card itself keeps it open, no page errors.
//   U=http://localhost:8960/ [VP=390x844,844x390,1280x800,1920x1080] node tests/smoke/site_sheet_close.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800,1920x1080').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    const isOpen = () => pg.evaluate(() => { const e = document.getElementById('sitePick'); return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; });
    const open = async () => { await pg.evaluate(() => document.getElementById('hSite').click()); await pg.waitForTimeout(900); return isOpen(); };
    const tap = async (x, y) => { if (touch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); await pg.waitForTimeout(700); };
    ok(await open(), `${vp} 📍 opens`);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(600); ok(!(await isOpen()), `${vp} Esc closes the 📍 sheet`);
    await open(); const out = await pg.evaluate(() => { const b = document.querySelector('#sitePick .spBox').getBoundingClientRect(); const pts = [[12, b.top - 12], [12, b.top + 6], [innerWidth - 12, 70], [12, 70]]; for (const [x, y] of pts) { if (y < 0 || y > innerHeight) continue; if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) continue; const h = document.elementFromPoint(x, y); if (h && (h.id === 'sitePick')) return { x: Math.round(x), y: Math.round(y) }; } return null; });
    ok(!!out, `${vp} a point on the dimmed backdrop outside the card exists ${JSON.stringify(out)}`);
    if (out) { await tap(out.x, out.y); ok(!(await isOpen()), `${vp} a tap outside the card closes the 📍 sheet`); }
    await open(); const head = await pg.evaluate(() => { const b = document.querySelector('#sitePick .spHead b').getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; });
    await tap(head.x, head.y); ok(await isOpen(), `${vp} a tap on the card title keeps it open`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(`site_sheet_close: ${bad ? 'FAILED ' + bad : 'all ok'}`); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
