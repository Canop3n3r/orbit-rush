// f5.5 sim UI smoke (Aaron 2026-10-22): no missions in UI, no auto-launch, plain telemetry (mph, Pe/Ap + T-, Δv/stage), navball joystick.
// Usage: U=http://localhost:8957/ OUT=dir [ONLY=1,2] node tests/smoke/sim_ui.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8957/', OUT = process.env.OUT || '/workspace/shots_f55', ONLY = (process.env.ONLY || '1,2,3,4').split(',');
require('fs').mkdirSync(OUT, { recursive: true });
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 for (const [tag, vp] of [['844', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }], ['1280', { viewport: { width: 1280, height: 800 } }]]) {
  const pg = await br.newPage(vp); pg.setDefaultTimeout(120000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1500);
  const vis = s => pg.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent && getComputedStyle(e).visibility !== 'hidden').length, s);
  if (ONLY.includes('1')) {
   const mis = await pg.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && /mission|career|contract/i.test(b.textContent + ' ' + b.title + ' ' + b.id)).map(b => b.id || b.textContent.trim()));
   ok(!mis.length, `${tag}: home shows no mission/career buttons (${mis.join(',')})`);
   await pg.click('#hMenuB'); await pg.waitForTimeout(200); const mm = await pg.evaluate(() => [...document.querySelectorAll('#hMenu button')].map(b => b.textContent));
   ok(!mm.some(t => /mission|career/i.test(t)), `${tag}: ☰ has no Missions/Career (${mm.join(' | ')})`); await pg.click('#hMenuB');
   await pg.screenshot({ path: `${OUT}/${tag}_home.png` }); }
  await pg.click('#hFly'); await pg.waitForTimeout(2500);
  const st = await pg.evaluate(() => { const g = window.__game; return { state: g.state, ign: g.ignited, auto: !!g.F.autoOn, dir: !!(g.director && g.director.active), alt: g.F.alt }; });
  if (ONLY.includes('2')) {
   ok(st.state === 'flight' && !st.ign && !st.auto && !st.dir, `${tag}: FLY lands on the pad idle, no AUTO, no director (${JSON.stringify(st)})`);
   await pg.evaluate(() => { window.__game.press('KeyF'); }); const af = await pg.evaluate(() => ({ auto: !!window.__game.F.autoOn, ign: window.__game.ignited })); ok(af.auto && !af.ign, `${tag}: AUTO can be armed on the pad without launching ${JSON.stringify(af)}`); await pg.evaluate(() => window.__game.press('KeyF'));
   const mt = await vis('#opTask, .mcIn'); ok(!mt, `${tag}: no mission prompt in flight`); }
  if (ONLY.includes('3')) {
   const t = await pg.evaluate(() => { const e = document.getElementById('spd'); if (!e) return null; const r = e.getBoundingClientRect(); return { txt: e.textContent, l: r.left, b: r.bottom, h: r.height, fs: parseFloat(getComputedStyle(e.querySelector('.spV') || e).fontSize) }; });
   ok(t && /mph/i.test(t.txt) && t.l < innerW(vp) * 0.35 && t.b > vp.viewport.height * 0.6 && t.fs >= 28, `${tag}: big mph speedometer bottom-left ${JSON.stringify(t)}`);
   const ign0 = await pg.evaluate(() => window.__game.ignited); if (!ign0) { await pg.evaluate(() => { window.__game.press('KeyF'); window.__game.press('Space'); }); await pg.waitForTimeout(9000); }
   const ap = await pg.evaluate(() => { const e = document.getElementById('apPe'); return e && e.offsetParent ? e.textContent : null; });
   ok(ap && /Ap/.test(ap) && /Pe/.test(ap) && /T[-+−]/.test(ap), `${tag}: Ap/Pe with T-/+ (${ap})`);
   const dv = await pg.evaluate(() => { const e = document.getElementById('dvStages'); return e && e.offsetParent ? [...e.querySelectorAll('.dvS')].map(x => x.textContent) : null; });
   ok(dv && dv.length >= 1 && dv.every(x => /m\/s/.test(x)), `${tag}: Δv per stage ${JSON.stringify(dv)}`);
   ok(!(await vis('#navFuel, #navFuelT, #pRings')), `${tag}: old fuel bar gone`); }
  if (ONLY.includes('4')) { await pg.evaluate(() => { if (window.__game.F.autoOn) window.__game.press('KeyF'); }); await pg.waitForTimeout(300);
   const nb = await pg.evaluate(() => { const c = document.getElementById('navBall'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
   ok(!!nb, `${tag}: navball found ${JSON.stringify(nb)}`);
   if (nb) { const p0 = await pg.evaluate(() => window.__game.v.pitchCmd ?? null);
    await pg.mouse.move(nb.x, nb.y); await pg.mouse.down(); await pg.mouse.move(nb.x, nb.y - nb.w * 0.3, { steps: 4 });
    const j = await pg.evaluate(() => window.__game.stickCmd ? window.__game.stickCmd() : null); await pg.mouse.up();
    ok(j && Math.abs(j.pitch) > 0.2, `${tag}: dragging navball commands pitch ${JSON.stringify(j)}`);
    const inc = await pg.evaluate(() => { const e = document.getElementById('nbInc'); return e && e.offsetParent ? e.textContent : null; }); ok(inc && /INC/i.test(inc) && /°/.test(inc), `${tag}: navball shows inclination (${inc})`); } }
  await pg.screenshot({ path: `${OUT}/${tag}_pad.png` });
  if (ONLY.includes('2')) { await pg.evaluate(() => window.__game.press('Space')); await pg.waitForTimeout(4000); const a = await pg.evaluate(() => ({ ign: window.__game.ignited, alt: window.__game.F.alt })); ok(a.ign, `${tag}: STAGE ignites (${JSON.stringify(a)})`); await pg.screenshot({ path: `${OUT}/${tag}_ascent.png` }); }
  ok(!errs.length, `${tag}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
function innerW(vp) { return vp.viewport.width; }
