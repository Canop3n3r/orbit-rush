// f5.9-0: Build is gone. Every roster rocket launches straight from Home (Fly -> pad -> STAGE) with no page errors, and
// old deep links (?hangar, a stale saved-design key) fall back to Home with the default rocket. Also asserts no Build DOM remains.
// Usage: U=http://localhost:8958/ node tests/smoke/launch_all.cjs [N=limit]   (one browser, one page per rocket)
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const U = process.env.U || 'http://localhost:8958/';
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const BUILD_IDS = ['build', 'launchBtn', 'saveBtn', 'delBtn', 'savedSel', 'palette', 'stack', 'bExp', 'bAdv', 'homeBack', 'hnBuild', 'pkBuild', 'standBtn', 'tunnelBtn', 'dropBtn'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const mk = async (q, pre) => { const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); pg.errs = [];
    pg.on('pageerror', e => pg.errs.push('pageerror: ' + e.message)); pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[Orbit Rush\]/.test(t)) && !/WebGL2|Effects:|lowering (effects|render)|GPU\/driver|No available|GPU stall|swiftshader|Failed to load resource/i.test(t)) pg.errs.push(t.slice(0, 120)); });
    await pg.addInitScript(p => { try { localStorage.setItem('or_seen_welcome', '1'); if (p) for (const k in p) localStorage.setItem(k, p[k]); } catch (e) { } }, pre || null);
    await pg.goto(U + q, { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1200); return [ctx, pg]; };
  // 1) Home: no Build DOM, deep links + stale saved designs fall back to Home with the default rocket
  for (const [tag, q, pre] of [['plain', '?noacademy&fx=low'], ['?hangar', '?noacademy&fx=low&hangar'], ['stale design key', '?noacademy&fx=low', { 'orbitrush.designs.v1': '[{"name":"old","design":{"stages":[]}}]', 'orbitrush.sandbox': '1' }]]) {
    const [ctx, pg] = await mk(q, pre); const r = await pg.evaluate(ids => { const G = window.__game, h = G.home(); return { homeOn: !!document.getElementById('home') && getComputedStyle(document.getElementById('home')).display !== 'none', sel: h && h.list[h.index] ? h.list[h.index].id : null, left: ids.filter(i => document.getElementById(i)), fly: !!document.getElementById('hFly') }; }, BUILD_IDS).catch(e => ({ err: e.message }));
    ok(r.homeOn && r.fly && !r.err, `${tag}: opens Home with Fly ${r.err || ''}`); ok(r.left && r.left.length === 0, `${tag}: no Build elements in the DOM ${r.left ? r.left.join(',') : ''}`); ok(pg.errs.length === 0, `${tag}: no page errors ${pg.errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  // 2) every roster rocket: Home -> Fly -> flight state, ignites with STAGE and climbs
  let [c0, p0] = await mk('?noacademy&fx=low'); const ids = await p0.evaluate(() => window.__game.home().list.map(r => r.id)); await c0.close();
  const lim = +(process.env.N || 0) || ids.length;
  for (const id of ids.slice(0, lim)) { const [ctx, pg] = await mk('?noacademy&fx=low'); const tag = `launch ${id}`;
    try { await pg.evaluate(id => { const G = window.__game, i = G.home().list.findIndex(r => r.id === id); G.homeSet(i); document.getElementById('hFly').click(); }, id); await pg.waitForTimeout(1800);
      const a = await pg.evaluate(() => ({ st: window.__game.state, home: document.getElementById('home') && getComputedStyle(document.getElementById('home')).display !== 'none' }));
      await pg.evaluate(() => { const F = window.__game.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 400; i++) { F.realT += 0.02; F.step(0.02); } }); const b = await pg.evaluate(() => ({ alt: window.__game.F.alt, met: window.__game.F.met }));
      ok(a.st === 'flight' && !a.home && b.met > 5 && b.alt > 20, `${tag}: Fly goes straight to flight and lifts off (alt ${Math.round(b.alt)} m at T+${Math.round(b.met)}s)`);
    } catch (e) { ok(false, `${tag}: ${e.message}`); }
    ok(pg.errs.length === 0, `${tag}: no page errors ${pg.errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  console.log(`launch_all: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
