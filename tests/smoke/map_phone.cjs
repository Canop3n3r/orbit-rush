// f5.9-17 (owner, real iPhone): the phone portrait map must be usable. In orbit with a deployed satellite, open the map at 390x844 and check:
// the Tracking list is a small pill until tapped (≤ 44 px tall), opens below the map bar as a short card (≤ 30 % of the height) and closes again;
// the focus sits in the middle of the free area between the top bar and the bottom (± 12 % of the height); visible map labels never overlap; no page errors.
//   U=http://localhost:8960/ [VP=390x844] [SHOT=dir] node tests/smoke/map_phone.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800').split(','), SHOT = process.env.SHOT || '';
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number);
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: Math.min(W, H) < 700, hasTouch: Math.min(W, H) < 700 }); pg.setDefaultTimeout(300000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { const G = window.__game; G.F.setAuto(true); if (!G.F.ignited) G.press('Space'); });
    for (let k = 0; k < 120; k++) { const dn = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 20 && !(F.flags.orbit && F.v.guid === 'done'); i++) F.advance(1 / 60); return !!(F.flags.orbit && F.v.guid === 'done'); }); if (dn) break; }
    console.log(vp, 'flight', await pg.evaluate(() => JSON.stringify({ o: window.__game.F.flags.orbit, g: window.__game.F.v.guid, alt: Math.round(window.__game.F.alt) })));
    await pg.waitForTimeout(800); await pg.evaluate(() => { const b = document.getElementById('relBtn'); b && /RELEASE/.test(b.textContent) && b.click(); }); await pg.waitForTimeout(1500);
    { const p = await pg.evaluate(() => { const b = [...document.querySelectorAll('#mMap,#dMap')].find(e => e.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); if (p) { if (Math.min(W, H) < 700) await pg.touchscreen.tap(p[0], p[1]); else await pg.mouse.click(p[0], p[1]); } } await pg.waitForTimeout(3000);
    const rect = sel => pg.evaluate(sel => { const e = document.querySelector(sel); if (!e || e.classList.contains('hidden')) return null; const r = e.getBoundingClientRect(); return r.width > 0 ? { t: r.top, b: r.bottom, l: r.left, r: r.right, h: r.height } : null; }, sel);
    const bar = await rect('#mapBar'), tr = await rect('#mapTrack');
    console.log(vp, 'map', JSON.stringify(bar), JSON.stringify(tr), await pg.evaluate(() => document.body.className));
    ok(!!bar, `${vp}: map open`);
    ok(!!tr && tr.h <= 44, `${vp}: Tracking collapsed to a pill (${tr ? Math.round(tr.h) : 'none'} px ≤ 44)`);
    if (SHOT) await pg.screenshot({ path: `${SHOT}/map_${vp}.png` });
    const f = await pg.evaluate(() => window.__game.mapFocusPx && window.__game.mapFocusPx());
    const y0 = bar && bar.t < H * 0.4 ? bar.b : 0, y1 = bar && bar.t >= H * 0.4 ? bar.t : H, mid = (y0 + y1) / 2;
    ok(!!f && Math.abs(f[1] - mid) <= H * 0.12 && Math.abs(f[0] - W / 2) <= W * 0.12, `${vp}: focus centred in the free area (focus ${f && f.join(',')}, free-area centre ${Math.round(W / 2)},${Math.round(mid)})`);
    const ov = await pg.evaluate(() => { const r = [...document.querySelectorAll('.mmark')].filter(d => d.style.display !== 'none' && d.offsetWidth).map(d => d.getBoundingClientRect()); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const a = r[i], b = r[j]; if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) n++; } return { n, of: r.length }; });
    ok(ov.n === 0, `${vp}: map labels don't overlap (${ov.n} overlaps among ${ov.of})`);
    if (tr) { await (Math.min(W, H) < 700 ? pg.tap('#mapTrack h4') : pg.click('#mapTrack h4')); await pg.waitForTimeout(1500); const t2 = await rect('#mapTrack');
      ok(!!t2 && t2.h <= H * 0.3 + 1 && (!bar || bar.t >= H * 0.4 || t2.t >= bar.b - 2), `${vp}: Tracking opens as a short card under the bar (${t2 ? Math.round(t2.t) + '+' + Math.round(t2.h) : 'none'} px, ≤ 30 %)`);
      if (SHOT) await pg.screenshot({ path: `${SHOT}/map_track_${vp}.png` });
      await (Math.min(W, H) < 700 ? pg.tap('#mapTrack h4') : pg.click('#mapTrack h4')); await pg.waitForTimeout(1500); const t3 = await rect('#mapTrack'); ok(!!t3 && t3.h <= 44, `${vp}: Tracking collapses again`); }
    ok(await pg.evaluate(() => window.__game.mapFocusId()) === 'craft', `${vp}: map opens focused on the craft`);
    await pg.evaluate(() => window.__game.mapSetFocus('moon')); await pg.waitForTimeout(1500); const fm = await pg.evaluate(() => window.__game.mapFocusId());
    await pg.evaluate(() => window.__game.press('KeyM')); await pg.waitForTimeout(1200); await pg.evaluate(() => window.__game.press('KeyM')); await pg.waitForTimeout(2500);
    const f2 = await pg.evaluate(() => ({ id: window.__game.mapFocusId(), on: document.body.classList.contains('mapOn') }));
    ok(fm === 'moon' && f2.on && f2.id === 'craft', `${vp}: after looking at the Moon, reopening the map focuses the craft again (${fm} -> ${f2.id})`);
    if (SHOT) await pg.screenshot({ path: `${SHOT}/map_reopen_${vp}.png` });
    ok(!errs.length, `${vp}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `map_phone: ${bad} FAIL` : 'map_phone: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL map_phone', e.message); process.exit(1); });
