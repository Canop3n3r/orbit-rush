// Phone portrait, right after Heron-9 stage sep (AUTO ascent → split/PIP): flight hud_ctl ≤ 5.
// Same HUDCTL rules as tests/smoke/ui_budget_smoke.cjs. CRAFT, time warp and the camera
// overflow belong in ☰ for that beat. RELEASE stays a top-level button. Orbit may still
// show RELEASE and STAGE together; this check does not treat that as a failure.
//   U=http://localhost:8960/ [VP=390x844] [SHOT=/tmp/ascent_split_hud.png] node tests/smoke/ascent_split_hud.cjs
const pw = require(process.env.PW || '/tmp/pw/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/';
const SHOT = process.env.SHOT || '/tmp/ascent_split_hud.png';
const HUDCTL = () => { const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; for (let q = e; q && q !== document.body; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } return true; };
  const bs = [...document.querySelectorAll('button')].filter(b => !b.closest('#home,#build,#mMenu,#dMenu,#end,.modal,#sitePick,#split,.spCard') && vis(b)); const lab = b => (b.querySelector('kbd') ? b.firstChild.textContent : b.textContent).replace(/\s+/g, '').replace(/[◀▶]+/, 'warp') || b.id; return { n: bs.length, labs: [...new Set(bs.map(lab))].sort(), split: document.body.classList.contains('splitOn'), pip: document.body.classList.contains('pip'), orbit: document.body.classList.contains('inOrbit'), cls: document.body.className }; };
(async () => {
  const [W, H] = (process.env.VP || '390x844').split('x').map(Number);
  const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  pg.setDefaultTimeout(180000); const errs = []; pg.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
  await pg.goto(URL + '?v=ascent-split&webgl&noacademy&fx=low', { timeout: 180000 });
  await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000 });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => { document.getElementById('firstRun')?.classList.add('hidden'); const G = window.__game, i = G.home().list.findIndex(r => r.id === 'swift'); if (i >= 0) G.homeSet(i); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => document.getElementById('hFly').click());
  await pg.waitForTimeout(2000);
  await pg.evaluate(() => { const G = window.__game; G.F.setAuto(true); if (!G.F.ignited) G.press('Space'); });
  let st = null;
  for (let k = 0; k < 90 && !(st && st.sep); k++) {
    st = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 4 && !(F.booster && F.booster.state === 'flying' && F.v.cur > 0) && !F.flags.dead; i++) F.advance(1 / 60); return { sep: !!(F.booster && F.booster.state === 'flying' && F.v.cur > 0), dead: !!F.flags.dead, alt: Math.round(F.alt), cur: F.v.cur, rel: !!F.canRelease() }; });
  }
  await pg.waitForTimeout(900);
  const hud = await pg.evaluate(HUDCTL);
  console.log('post-sep', JSON.stringify(hud));
  ok(st && st.sep && !st.dead, `Heron-9 reached stage sep alive (alt ${st && st.alt} cur ${st && st.cur})`);
  ok(hud.split && hud.pip && !hud.orbit, `ascent split/PIP, not orbit (${hud.cls})`);
  ok(hud.n <= 5, `hud_ctl ${hud.n} ≤ 5 [${hud.labs.join(', ')}]`);
  ok(hud.labs.some(l => /RELEASE/.test(l)), `RELEASE stays reachable [${hud.labs.join(', ')}]`);
  ok(!hud.labs.includes('warp') && !hud.labs.some(l => /CRAFT|VEHICLE/.test(l)), `CRAFT, warp and camera are not top-level [${hud.labs.join(', ')}]`);
  await pg.screenshot({ path: SHOT, timeout: 60000 });
  const box = await pg.evaluate(() => { const b = document.getElementById('mMenuBtn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (box) await pg.touchscreen.tap(box.x, box.y);
  await pg.waitForTimeout(400);
  const menu = await pg.evaluate(() => { const m = document.getElementById('mMenu'); const vis = e => !!(e && !e.hidden && e.getBoundingClientRect().width > 4); const w = m && m.querySelector('[data-warp]'), c = m && m.querySelector('[data-craft]'); return { open: !!(m && !m.classList.contains('hidden')), warp: vis(w), warpText: w ? w.textContent : '', craft: vis(c) }; });
  ok(menu.open && menu.warp && /Warp/.test(menu.warpText), `☰ offers time warp while the bar button is folded (${JSON.stringify(menu)})`);
  ok(menu.open && menu.craft, `☰ offers the craft list (${JSON.stringify(menu)})`);
  const wbox = await pg.evaluate(() => { const b = document.querySelector('#mMenu [data-warp]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (wbox) await pg.touchscreen.tap(wbox.x, wbox.y);
  await pg.waitForTimeout(500);
  const stepped = await pg.evaluate(() => ({ warp: window.__game.F.effWarp(), toast: (document.getElementById('toasts') || {}).innerText || '' }));
  ok(stepped.warp > 1 || /warp/i.test(stepped.toast), `☰ warp steps time or reports the cap (${JSON.stringify(stepped)})`);
  let orb = null;
  for (let k = 0; k < 80 && !(orb && orb.done); k++) orb = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 15 && !(F.flags.orbit) && !F.flags.dead; i++) F.advance(1 / 60); return { done: !!F.flags.orbit, dead: !!F.flags.dead }; });
  await pg.waitForTimeout(700);
  const late = await pg.evaluate(() => { const vis = id => { const e = document.getElementById(id); if (!e || e.hidden || e.classList.contains('hidden')) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 4 && r.height > 4 && c.display !== 'none' && c.visibility !== 'hidden'; }; return { orbit: document.body.classList.contains('inOrbit'), rel: vis('relBtn'), warp: vis('wUp'), craft: vis('craftBtn'), stage: vis('mStage') }; });
  ok(late.orbit && !orb.dead && late.rel && late.stage && late.warp && late.craft, `orbit keeps RELEASE and STAGE, and the bar warp and CRAFT return (${JSON.stringify(late)})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await br.close();
  console.log(bad ? `ascent_split_hud: ${bad} FAIL` : 'ascent_split_hud: all ok');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
