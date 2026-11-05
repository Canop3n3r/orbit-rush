// Phone portrait AUTO ascent: flight hud_ctl stays ≤5. Warp stays reachable from ☰
// and must not join the flight button set (AUTO, STAGE, MAP, ☰, camera already fill five).
// Usage: node tests/smoke/ascent_hud_ctl_smoke.cjs [baseUrl]
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/tmp/pw/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const RAW = process.argv[2] || 'http://127.0.0.1:8765/';
const BASE = RAW + (RAW.includes('?') ? '&' : '?') + 'webgl&noacademy&fx=low';
const GPU = ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
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
  return { n: bs.length, labs: [...new Set(bs.map(lab))].sort() };
};
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU, headless: true });
  const page = await br.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  let bad = 0;
  const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  try {
    await page.goto(BASE, { timeout: 300000 });
    await page.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { document.getElementById('firstRun')?.classList.add('hidden'); document.getElementById('hFly')?.click(); });
    await page.waitForTimeout(2800);
    const pad = await page.evaluate(HUDCTL);
    ok(pad.n <= 5, `pad hud_ctl ${pad.n}≤5 labs=${pad.labs.join(',')}`);
    await page.evaluate(() => { const G = window.__game; if (!G.F.ignited) G.press('Space'); G.F.setAuto(true); });
    await page.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 12; i++) F.advance(1 / 60); });
    await page.waitForTimeout(800);
    const asc = await page.evaluate(HUDCTL);
    ok(asc.n <= 5, `AUTO ascent hud_ctl ${asc.n}≤5 labs=${asc.labs.join(',')}`);
    ok(['AUTO', 'STAGE', 'MAP'].every(k => asc.labs.includes(k)) && asc.labs.some(l => l.includes('☰')), `AUTO STAGE MAP menu stay on the ascent HUD (${asc.labs.join(',')})`);
    const reach = await page.evaluate(() => {
      const up = document.getElementById('mWarpUp');
      const menu = document.getElementById('mMenu');
      const btn = document.getElementById('mMenuBtn');
      if (btn) btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      const open = !!(menu && !menu.classList.contains('hidden'));
      const r = up && up.getBoundingClientRect();
      const shown = !!(up && menu && up.closest('#mMenu') && open && r && r.width >= 40 && r.height >= 40 && getComputedStyle(up).display !== 'none');
      if (up && shown) up.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      return { open, shown, inMenu: !!(up && up.closest('#mMenu')), warp: window.__game.F.effWarp() };
    });
    await page.waitForTimeout(400);
    const after = await page.evaluate(HUDCTL);
    ok(reach.inMenu && reach.shown, `time warp is a ≥40px control inside ☰ (open ${reach.open})`);
    ok(reach.warp > 1, `▶▶ in ☰ still steps time warp (now ×${reach.warp})`);
    ok(after.n <= 5 && !after.labs.includes('warp'), `warp step does not put ▶▶ back on the flight HUD (${after.n}: ${after.labs.join(',')})`);
    if (process.env.SHOT) await page.evaluate(() => { const m = document.getElementById('mMenu'); if (m) m.classList.add('hidden'); }).then(() => page.screenshot({ path: process.env.SHOT, timeout: 60000 }));
    await page.evaluate(() => { window.__game.F.setAuto(false); window.__game.F.setWarp(0, true); });
    await page.waitForTimeout(600);
    const manual = await page.evaluate(() => {
      const e = document.getElementById('wUp');
      const r = e.getBoundingClientRect();
      const c = getComputedStyle(e);
      const shown = r.width >= 40 && r.height >= 40 && c.display !== 'none' && c.visibility !== 'hidden' && !e.hidden;
      return { shown, warp: window.__game.F.effWarp(), auto: document.body.classList.contains('autoOn') };
    });
    ok(!manual.auto && manual.shown && manual.warp === 1, `AUTO off puts ▶▶ back on the bar at ×${manual.warp}`);
  } finally { await br.close(); }
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
