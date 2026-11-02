// QA f5.9-18 (Playtest QA Bot): typing in the bug-report note. The global flight keydown handler preventDefaults Space and the arrows and
// runs every game hotkey even while the note <textarea> has focus, so on a keyboard the note loses all its spaces ("QA test" -> "QAtest"),
// the caret cannot move, and letters double as hotkeys. Checks: the note keeps spaces and arrow-key edits, the paused game state does
// not change while typing, Esc in the note closes the card, no page errors. Never sends a report (all non-GET + supabase.co aborted).
//   U=http://localhost:8960/ [VP=1280x800,390x844] node tests/smoke/bug_note_keys.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '1280x800,390x844').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.route('**/*', r => { const q = r.request(); return (q.method() !== 'GET' || /supabase\.co/.test(q.url())) ? r.abort() : r.continue(); });
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); localStorage.removeItem('or_bug_queue'); localStorage.setItem('or_bug_cfg', JSON.stringify({ url: 'http://localhost:9/qa-null', headers: {} })); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    await pg.evaluate(() => window.__game.press('Escape')); await pg.waitForTimeout(800);
    const gs = () => pg.evaluate(() => { const G = window.__game, F = G.F; return JSON.stringify({ paused: !!G.paused, ign: !!F.ignited, map: document.body.classList.contains('mapOn'), auto: !!F.autoOn, sas: F.sas, thr: F.throttle }); });
    await pg.evaluate(() => window.__game.bug.open()); await pg.waitForFunction(() => { const e = document.getElementById('bugCard'); return e && !e.classList.contains('hidden'); }, null, { timeout: 30000 });
    const before = await gs(); await pg.focus('#bugCard textarea');
    await pg.keyboard.type('map test z x'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.press('ArrowLeft'); await pg.keyboard.type('Q'); await pg.waitForTimeout(500);
    const v = await pg.evaluate(() => document.querySelector('#bugCard textarea').value);
    ok(v === 'map test zQ x', `${vp}: note keeps spaces and arrow edits ("${v}")`);
    const after = await gs(); ok(after === before, `${vp}: typing the note does not drive the game (${before} -> ${after})`);
    await pg.keyboard.press('Escape'); await pg.waitForTimeout(500); ok(await pg.evaluate(() => document.getElementById('bugCard').classList.contains('hidden')), `${vp}: Esc in the note closes the card`);
    ok(await pg.evaluate(() => JSON.parse(localStorage.getItem('or_bug_queue') || '[]').length === 0), `${vp}: nothing queued or sent`);
    ok(!errs.length, `${vp}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `bug_note_keys: ${bad} FAIL` : 'bug_note_keys: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
