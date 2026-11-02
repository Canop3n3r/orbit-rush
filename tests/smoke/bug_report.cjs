// f5.9-18: in-game bug reports. At 390x844 (touch) and 1280x800: in flight, ☰ ⏸ Pause → 🐞 Report a bug opens the card with a real
// screenshot of the game view; Remove / Retake work; Send with no endpoint queues the report locally (note, build, viewport, rocket,
// phase, alt, speed, jpeg shot); once an endpoint is configured the queue flushes to it (POST, JSON, headers) and empties;
// the card fits the screen; Settings has the shake toggle and a 🐞 button; no page errors.
//   U=http://localhost:8960/ [VP=390x844,1280x800] [SHOT=dir] node tests/smoke/bug_report.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,1280x800').split(','), SHOT = process.env.SHOT || '';
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/bug state/.test(m.text())) console.log('CONSOLE', m.text().slice(0, 200)); });
    const posts = []; await pg.route('http://localhost:9/bug-test', r => { posts.push({ h: r.request().headers(), b: r.request().postData() }); r.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' }); });
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); localStorage.removeItem('or_bug_queue'); localStorage.removeItem('or_bug_cfg'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { const G = window.__game; G.F.setAuto(true); if (!G.F.ignited) G.press('Space'); for (let i = 0; i < 60 * 60; i++) G.F.advance(1 / 60); }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => window.__game.press('Escape')); await pg.waitForTimeout(800); // ⏸ Pause sheet
    const bb = await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-bug]')].find(e => e.offsetWidth > 0); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    ok(!!bb, `${vp}: 🐞 Report a bug in the Pause sheet`);
    if (bb) { if (touch) await pg.touchscreen.tap(bb[0], bb[1]); else await pg.mouse.click(bb[0], bb[1]); } else await pg.evaluate(() => window.__game.bug.open());
    await pg.waitForFunction(() => !document.getElementById('bugCard').classList.contains('hidden'), null, { timeout: 15000 }).catch(() => { }); await pg.waitForTimeout(600);
    const c = await pg.evaluate(() => { const e = document.getElementById('bugCard'), b = e.querySelector('.bgBox').getBoundingClientRect(), s = window.__game.bug.shot; return { open: !e.classList.contains('hidden'), shot: s ? s.slice(0, 23) : null, len: s ? s.length : 0, box: [b.left, b.top, b.right, b.bottom].map(Math.round), meta: e.querySelector('.bgMeta').textContent }; });
    ok(c.open, `${vp}: bug card opens`); ok(c.shot === 'data:image/jpeg;base64,' && c.len > 5000, `${vp}: screenshot captured (${c.len} chars)`);
    ok(c.box[0] >= 0 && c.box[1] >= 0 && c.box[2] <= W && c.box[3] <= H, `${vp}: card inside the screen ${c.box.join(',')}`); ok(/f5\.\d|dev/.test(c.meta) && /\d+×\d+/.test(c.meta), `${vp}: meta line "${c.meta}"`);
    if (SHOT) await pg.screenshot({ path: `${SHOT}/bug_card_${vp}.png` });
    await pg.click('#bugCard [data-a=drop]'); const dropped = await pg.evaluate(() => window.__game.bug.shot === null && document.getElementById('bugCard').classList.contains('noShot')); ok(dropped, `${vp}: Remove drops the screenshot`);
    await pg.click('#bugCard [data-a=retake]'); await pg.waitForFunction(() => !!window.__game.bug.shot, null, { timeout: 10000 }).catch(() => { }); ok(await pg.evaluate(() => !!window.__game.bug.shot), `${vp}: Retake grabs a new one`);
    await pg.fill('#bugCard textarea', 'smoke: stage button stuck'); await pg.click('#bugCard [data-a=send]'); await pg.waitForTimeout(800);
    const q = await pg.evaluate(() => window.__game.bug.queue()); const r = q[0] || {};
    ok(q.length === 1 && r.note === 'smoke: stage button stuck' && r.build && r.viewport && r.viewport.w === W && r.state && r.state.rocket && r.state.phase && r.state.alt && r.state.speed && /^data:image\/jpeg/.test(r.shot || ''), `${vp}: no endpoint → queued locally with note/build/viewport/state/shot (${JSON.stringify({ n: q.length, st: r.state })})`);
    ok(await pg.evaluate(() => document.getElementById('bugCard').classList.contains('hidden')), `${vp}: card closes after Send`);
    await pg.evaluate(() => localStorage.setItem('or_bug_cfg', JSON.stringify({ url: 'http://localhost:9/bug-test', headers: { apikey: 'public-test' } })));
    const fl = await pg.evaluate(() => window.__game.bug.flush()); const p0 = posts[0] || { b: '{}', h: {} }; const pb = JSON.parse(p0.b || '{}');
    ok(fl.sent === 1 && fl.left === 0 && posts.length === 1 && pb.note === 'smoke: stage button stuck' && p0.h.apikey === 'public-test' && /json/.test(p0.h['content-type'] || ''), `${vp}: endpoint set → queue flushes (POST JSON + headers), queue empty (${JSON.stringify(fl)})`);
    await pg.evaluate(() => window.__game.press('Escape')); await pg.waitForTimeout(400);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('[data-q=settings]')].find(e => e.offsetWidth > 0); b && b.click(); }); await pg.waitForTimeout(800);
    ok(await pg.evaluate(() => !!document.querySelector('#settings #bugShake') && !!document.querySelector('#settings #bugOpenS')), `${vp}: Settings has the shake toggle and 🐞 button`);
    ok(!errs.length, `${vp}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `bug_report: ${bad} FAIL` : 'bug_report: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL bug_report', e.message); process.exit(1); });
