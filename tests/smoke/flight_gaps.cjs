// QA f5.9-7b (Playtest QA Bot): flight-UI gaps that ui_budget_smoke does not measure (it passes 221/221 while these fail).
//   U=http://localhost:8982/ [VP=390x844,844x390,1280x800] node tests/smoke/flight_gaps.cjs   (exit 1 on any FAIL)
// 1 bars_auto_off: top + bottom bar ≤ 30% of the height in orbit with AUTO off (the usual state after RELEASE or a craft switch)
// 2 bars_orbit_auto: same with AUTO on in orbit (ascent is already ≤ 30%)
// 3 release_double_tap: two taps 300 ms apart on RELEASE release the payload but do not end the flight
// 4 end_closes_craft_list: END FLIGHT with the craft list open leaves one sheet (the end card), not both
// 5 craft_list_below_top_bar: the craft list header (title + ✕) is not under the top bar
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8982/', VPS = (process.env.VP || '390x844,844x390,1280x800').split(','), MAXBARS = +(process.env.MAXBARS || 30);
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    const tapAt = async (x, y) => { if (touch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); };
    const tap = async id => { const r = await pg.evaluate(id => { const b = typeof id === 'string' ? document.getElementById(id) : null; if (!b) return null; const q = b.getBoundingClientRect(); return q.width ? [q.left + q.width / 2, q.top + q.height / 2] : null; }, id); if (r) await tapAt(r[0], r[1]); return !!r; };
    const bars = () => pg.evaluate(() => { let s = 0; for (const id of ['topBar', 'botBar']) { const e = document.getElementById(id); if (e) s += e.getBoundingClientRect().height; } return +(100 * s / innerHeight).toFixed(1); });
    await tap('hFly'); await pg.waitForTimeout(3000);
    await pg.evaluate(() => { const F = window.__game.F; F.setAuto(true, true); F.stagePress(); for (let i = 0; i < 1500 / 0.02 && !F.flags.orbit && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); } window.__game.syncStages && window.__game.syncStages(); }); await pg.waitForTimeout(2500);
    const bOn = await bars(); ok(bOn <= MAXBARS, `${vp} bars_orbit_auto ${bOn}% ≤ ${MAXBARS}% (AUTO on, in orbit)`);
    await tap(touch ? 'mAuto' : 'dAuto'); await pg.waitForTimeout(1200);
    const bOff = await bars(); ok(bOff <= MAXBARS, `${vp} bars_auto_off ${bOff}% ≤ ${MAXBARS}% (AUTO off, in orbit; HDG/PIT/ROLL/INC row + ΔV block come back)`);
    const rp = await pg.evaluate(() => { const b = document.getElementById('relBtn'), q = b && b.getBoundingClientRect(); return q && q.width ? [q.left + q.width / 2, q.top + q.height / 2, b.textContent.trim()] : null; });
    if (!rp) ok(false, `${vp} release_double_tap: no RELEASE button in orbit`);
    else { await tapAt(rp[0], rp[1]); await pg.waitForTimeout(300); await tapAt(rp[0], rp[1]); await pg.waitForTimeout(1500);
      const r = await pg.evaluate(() => ({ end: !document.getElementById('end').classList.contains('hidden'), n: window.__game.F.fleet ? window.__game.F.fleet.list.length : 0 }));
      ok(r.n >= 2 && !r.end, `${vp} release_double_tap released (fleet ${r.n}) and the flight is still running (end card ${r.end ? 'OPEN' : 'closed'})`);
      if (r.end) { await tap('contBtn'); await pg.waitForTimeout(1500); } }
    const cb = await pg.evaluate(() => { const b = document.getElementById('craftBtn'); if (!b) return 'no craftBtn'; const q = b.getBoundingClientRect(); if (!q.width) return 'craftBtn hidden'; const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return h === b || b.contains(h) ? 'ok' : 'craftBtn covered by ' + (h ? h.id || h.className : '-'); });
    const opened = await tap('craftBtn'); await pg.waitForTimeout(1200); if (cb !== 'ok') console.log('note ' + vp + ' ' + cb);
    const hd = await pg.evaluate(() => { const v = document.getElementById('vsl'), h = v && v.querySelector('.vh'), x = v && v.querySelector('.vx'), t = document.getElementById('topBar'); if (!v || v.classList.contains('hidden') || !h) return null; const hq = h.getBoundingClientRect(), tq = t ? t.getBoundingClientRect() : { bottom: 0 }; const xq = x.getBoundingClientRect(), top = document.elementFromPoint(xq.left + xq.width / 2, xq.top + xq.height / 2); return { headTop: Math.round(hq.top), barBottom: Math.round(tq.bottom), xHit: !!top && (top === x || x.contains(top)) }; });
    ok(opened && hd && hd.headTop >= hd.barBottom - 1 && hd.xHit, `${vp} craft_list_below_top_bar ${hd ? JSON.stringify(hd) : 'craft list did not open (' + cb + ')'}`);
    const rel2 = await pg.evaluate(() => { const b = document.getElementById('relBtn'), q = b && b.getBoundingClientRect(); return q && q.width ? [q.left + q.width / 2, q.top + q.height / 2] : null; });
    if (rel2) { await tapAt(rel2[0], rel2[1]); await pg.waitForTimeout(2000); }
    const st = await pg.evaluate(() => ({ end: !document.getElementById('end').classList.contains('hidden'), list: !!document.getElementById('vsl') && !document.getElementById('vsl').classList.contains('hidden') }));
    if (!hd) console.log(`SKIP ${vp} end_closes_craft_list (list never opened)`); else ok(st.end && !st.list, `${vp} end_closes_craft_list end card ${st.end ? 'open' : 'closed'}, craft list ${st.list ? 'STILL OPEN' : 'closed'}`);
    if (process.env.OUT) await pg.screenshot({ path: `${process.env.OUT}/flight_gaps_${vp}_end.png` });
    ok(errs.length === 0, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `${bad} FAIL` : 'all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
