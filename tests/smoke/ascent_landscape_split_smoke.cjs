// Landscape touch + desktop, right after Heron-9 stage sep (AUTO ascent → split/PIP): flight hud_ctl ≤ 5.
// Same HUDCTL rules as tests/smoke/ui_budget_smoke.cjs. CRAFT, time warp and the camera
// belong in ☰ for that beat. RELEASE stays a top-level button (portrait keeps it on the STAGE slot;
// these sizes keep it as its own control). Orbit may still show RELEASE and STAGE together.
//   node tests/smoke/ascent_landscape_split_smoke.cjs [baseUrl] [vp]
//   SHOT=/tmp/ascent_844.png node tests/smoke/ascent_landscape_split_smoke.cjs http://127.0.0.1:8960/ 844x390
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/tmp/pw/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const RAW = process.argv[2] || 'http://127.0.0.1:8765/';
const vp = process.argv[3] || '844x390';
const [W, H] = vp.split('x').map(Number);
const BASE = RAW + (RAW.includes('?') ? '&' : '?') + 'webgl&noacademy&fx=low';
const GPU = ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const touch = W < 1000;
const HUDCTL = () => {
  const vis = e => {
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    for (let q = e; q && q !== document.body; q = q.parentElement) {
      const c = getComputedStyle(q);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    }
    return true;
  };
  const bs = [...document.querySelectorAll('button')].filter(b => !b.closest('#home,#build,#mMenu,#dMenu,#end,.modal,#sitePick,#split,.spCard') && vis(b));
  const lab = b => (b.querySelector('kbd') ? b.firstChild.textContent : b.textContent).replace(/\s+/g, '').replace(/[◀▶]+/, 'warp') || b.id;
  return { n: bs.length, labs: [...new Set(bs.map(lab))].sort(), body: document.body.className, split: document.body.classList.contains('splitOn'), pip: document.body.classList.contains('pip'), orbit: document.body.classList.contains('inOrbit') };
};
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU, headless: true });
  const page = await br.newPage({ viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 });
  let bad = 0;
  const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  try {
    await page.goto(BASE, { timeout: 300000 });
    await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { document.getElementById('firstRun')?.classList.add('hidden'); const G = window.__game, i = G.home().list.findIndex(r => r.id === 'swift'); if (i >= 0) G.homeSet(i); });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('hFly')?.click());
    let pad = null;
    for (let k = 0; k < 25; k++) {
      pad = await page.evaluate(HUDCTL);
      if (pad.labs.includes('AUTO') && pad.labs.includes('STAGE') && pad.n >= 3 && pad.n <= 5) break;
      await page.waitForTimeout(200);
    }
    ok(pad.n <= 5 && pad.n >= 3 && pad.labs.includes('AUTO') && pad.labs.includes('STAGE'), `pad hud_ctl ${pad.n}≤5 labs=${pad.labs.join(',')}`);
    if (process.env.SHOT_PAD) await page.screenshot({ path: process.env.SHOT_PAD, timeout: 60000 });
    await page.evaluate(() => { const G = window.__game; if (!G.F.ignited) G.press('Space'); G.F.setAuto(true); });
    await page.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 12; i++) F.advance(1 / 60); });
    await page.waitForTimeout(500);
    const asc = await page.evaluate(HUDCTL);
    ok(asc.n <= 5 && !asc.split, `AUTO ascent hud_ctl ${asc.n}≤5 before split labs=${asc.labs.join(',')}`);
    if (process.env.SHOT_ASC) await page.screenshot({ path: process.env.SHOT_ASC, timeout: 60000 });
    let st = null;
    for (let k = 0; k < 90 && !(st && st.sep); k++) {
      st = await page.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 4 && !(F.booster && F.booster.state === 'flying' && F.v.cur > 0) && !F.flags.dead; i++) F.advance(1 / 60); return { sep: !!(F.booster && F.booster.state === 'flying' && F.v.cur > 0), dead: !!F.flags.dead, alt: Math.round(F.alt), cur: F.v && F.v.cur }; });
    }
    await page.waitForTimeout(700);
    const hud = await page.evaluate(HUDCTL);
    console.log('post-sep', JSON.stringify(hud));
    ok(st && st.sep && !st.dead, `Heron-9 reached stage sep alive (alt ${st && st.alt} cur ${st && st.cur})`);
    ok(hud.split && hud.pip && !hud.orbit, `ascent split/PIP, not orbit (${hud.body})`);
    ok(hud.n <= 5, `post-sep hud_ctl ${hud.n}≤5 labs=${hud.labs.join(',')}`);
    ok(['AUTO', 'MAP', 'STAGE'].every(k => hud.labs.includes(k)) && hud.labs.some(l => l.includes('☰')), `AUTO MAP STAGE ☰ stay (${hud.labs.join(',')})`);
    ok(hud.labs.some(l => /RELEASE/.test(l)), `RELEASE stays reachable (${hud.labs.join(',')})`);
    ok(!hud.labs.includes('warp') && !hud.labs.some(l => /CRAFT|VEHICLE/.test(l)), `CRAFT, warp and camera are not top-level (${hud.labs.join(',')})`);
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, timeout: 60000 });
    const box = await page.evaluate(touch => { const b = document.getElementById(touch ? 'mMenuBtn' : 'dMenuBtn'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, touch);
    if (box && touch) await page.touchscreen.tap(box.x, box.y); else if (box) await page.mouse.click(box.x, box.y);
    await page.waitForTimeout(400);
    const menu = await page.evaluate(touch => {
      const m = document.getElementById(touch ? 'mMenu' : 'dMenu');
      const vis = e => !!(e && !e.hidden && e.getBoundingClientRect().width > 4 && getComputedStyle(e).display !== 'none');
      const w = m && m.querySelector('[data-warp]'), c = m && m.querySelector('[data-craft]'), g = m && m.querySelector('[data-gcam]');
      return { open: !!(m && !m.classList.contains('hidden')), warp: vis(w), warpText: w ? w.textContent : '', craft: vis(c), cam: vis(g), camText: g ? g.textContent : '' };
    }, touch);
    ok(menu.open && menu.warp && /Warp/.test(menu.warpText), `☰ offers time warp (${JSON.stringify(menu)})`);
    ok(menu.open && menu.craft, `☰ offers the craft list (${JSON.stringify(menu)})`);
    if (touch) ok(menu.open && menu.cam && /VEHICLE|cam/i.test(menu.camText), `☰ offers the camera (${JSON.stringify(menu)})`);
    const wbox = await page.evaluate(touch => { const b = document.querySelector((touch ? '#mMenu' : '#dMenu') + ' [data-warp]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, touch);
    if (wbox && touch) await page.touchscreen.tap(wbox.x, wbox.y); else if (wbox) await page.mouse.click(wbox.x, wbox.y);
    await page.waitForTimeout(400);
    const stepped = await page.evaluate(() => ({ warp: window.__game.F.effWarp(), toast: (document.getElementById('toasts') || {}).innerText || '' }));
    ok(stepped.warp > 1 || /warp/i.test(stepped.toast), `☰ warp steps time or reports the cap (${JSON.stringify(stepped)})`);
    let orb = null;
    for (let k = 0; k < 80 && !(orb && orb.done); k++) orb = await page.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 15 && !F.flags.orbit && !F.flags.dead; i++) F.advance(1 / 60); return { done: !!F.flags.orbit, dead: !!F.flags.dead }; });
    await page.waitForTimeout(600);
    const late = await page.evaluate(() => { const vis = id => { const e = document.getElementById(id); if (!e || e.hidden || e.classList.contains('hidden')) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 4 && r.height > 4 && c.display !== 'none' && c.visibility !== 'hidden'; }; const stage = document.getElementById('mStage') || document.getElementById('dStage'); return { orbit: document.body.classList.contains('inOrbit'), rel: vis('relBtn'), warp: vis('wUp'), craft: vis('craftBtn'), stage: !!(stage && vis(stage.id)), touch: document.body.classList.contains('touch') }; });
    ok(late.orbit && !orb.dead && late.rel && late.stage && late.craft, `orbit keeps RELEASE and STAGE, and CRAFT returns (${JSON.stringify(late)})`);
    ok(late.touch || late.warp, `orbit restores the bar warp on desktop (${JSON.stringify(late)})`);
  } finally { await br.close(); }
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
