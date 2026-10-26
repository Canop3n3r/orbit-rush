// f5.9: UI survey. Loads the game at a viewport, drives it to a state, dumps visible interactive elements + overlaps + a screenshot.
//   U=http://localhost:8971/ OUT=/workspace/shots_f59 VP=390x844 STATES=home,pad,fly node tests/smoke/ui_survey.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8971/', OUT = process.env.OUT || '/workspace/shots_f59', STATES = (process.env.STATES || 'home,pad,fly').split(','), VPS = (process.env.VP || '390x844').split(',');
require('fs').mkdirSync(OUT, { recursive: true });
const SURVEY = () => {
  const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; if (p.tagName === 'DETAILS' && !p.open && !e.closest('summary') && e.tagName !== 'SUMMARY') return false; } return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const els = [...document.querySelectorAll('button,select,input,a[href],[role=button],summary,canvas#navBall,#navBall')].filter(vis);
  const nm = e => (e.id ? '#' + e.id : (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName.toLowerCase()) + '"' + (e.textContent || '').trim().slice(0, 12) + '"');
  const rects = els.map(e => { const r = e.getBoundingClientRect(); return { n: nm(e), e, l: r.left, t: r.top, r: r.right, b: r.bottom }; });
  const ov = []; for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) { const a = rects[i], b = rects[j]; if (a.e.contains(b.e) || b.e.contains(a.e)) continue; const w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t); if (w > 2 && h > 2) ov.push(a.n + ' x ' + b.n + ' ' + Math.round(w) + 'x' + Math.round(h)); }
  const off = rects.filter(a => a.l < -1 || a.t < -1 || a.r > innerWidth + 1 || a.b > innerHeight + 1).map(a => a.n);
  const nb = document.getElementById('navBall'); let nav = null; if (nb && vis(nb)) { const r = nb.getBoundingClientRect(); nav = { cx: Math.round(r.left + r.width / 2), w: Math.round(r.width), bottom: Math.round(r.bottom) }; }
  const font = [...new Set([...document.querySelectorAll('button,div,span,p,h1,h2,h3,h4,label,select,b')].filter(vis).map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '')))];
  return { W: innerWidth, H: innerHeight, n: rects.length, ctl: rects.map(a => a.n + '@' + Math.round(a.l) + ',' + Math.round(a.t) + ',' + Math.round(a.r - a.l) + 'x' + Math.round(a.b - a.t)), overlaps: ov, offscreen: off, nav, fonts: font };
};
module.exports = { SURVEY };
if (require.main === module) (async () => {
  const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  for (const v of VPS) { const [w, h] = v.split('x').map(Number); const touch = Math.min(w, h) < 700;
    const pg = await br.newPage({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(180000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    const dump = async tag => { await pg.waitForTimeout(600); const s = await pg.evaluate(SURVEY); await pg.screenshot({ path: `${OUT}/${tag}_${v}.png` }); console.log(`== ${tag} ${v} n=${s.n} nav=${JSON.stringify(s.nav)} fonts=${s.fonts}`); console.log(' overlaps:', s.overlaps.join(' | ') || 'none'); console.log(' offscreen:', s.offscreen.join(' | ') || 'none'); if (process.env.LIST) console.log(' ', s.ctl.join('  ')); };
    for (const st of STATES) {
      if (st === 'home') await dump('home');
      if (st === 'pad') { await pg.click('#hFly'); await pg.waitForTimeout(2500); await dump('pad'); }
      if (st === 'fly') { await pg.evaluate(() => { const g = window.__game; g.press('KeyF'); g.press('Space'); }); await pg.waitForTimeout(9000); await dump('fly'); }
      if (st === 'pause') { await pg.keyboard.press('Escape'); await dump('pause'); await pg.keyboard.press('Escape'); }
      if (st === 'map') { await pg.evaluate(() => window.__game.press('KeyM')); await dump('map'); await pg.evaluate(() => window.__game.press('KeyM')); }
      if (st === 'more') { await pg.evaluate(() => { const d = document.querySelector('details#mMenu, #mMenuBtn, #flightMore'); d && d.click && d.click(); }); await dump('more'); }
    }
    console.log('errors:', errs.slice(0, 3)); await pg.close(); }
  await br.close(); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
