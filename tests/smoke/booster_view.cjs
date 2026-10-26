// f5.9: the booster-landing split view. In the PIP and in the expanded (full-screen) booster view: the layout walk is clean,
// a drag orbits the booster camera, wheel zooms it, ⟲ FOLLOW appears only after a manual move and puts the camera back.
//   U=http://localhost:8982/ [VP=844x390] [CHROME=...] node tests/smoke/booster_view.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const { CHECK } = require('./ui_walk.cjs');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const OUT = process.env.OUT || '', URL = process.env.U || 'http://localhost:8982/', VPS = (process.env.VP || '844x390,390x844').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const shot = async n => { if (OUT) await globalThis.__pg.screenshot({ path: `${OUT}/bv_${n}_${globalThis.__vp}.png` }); return null; }; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(600000); globalThis.__pg = pg; globalThis.__vp = vp; const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
    await pg.evaluate(() => { const c = document.querySelector('.pkC[data-m="colossus-v4"]'); if (!c) throw new Error('no colossus card'); c.click(); });
    await pg.click('#hFly'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 60000 && !F.flags.dead && !(G.booster && G.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForFunction(() => { const s = document.getElementById('split'); return s && !s.classList.contains('hidden'); }, null, { timeout: 600000 });
    const pip = await shot('pip') || await pg.evaluate(CHECK, { state: 'booster-pip', flight: true }); ok(!pip.fails.length, `${vp} booster PIP layout (${pip.n} controls) ${pip.fails.join('; ')}`);
    { const c = await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await pg.mouse.click(c[0], c[1]); } /* a tap on the PiP expands it; the button only appears in the expanded view (⤡ BACK) */ await pg.waitForFunction(() => document.getElementById('split').classList.contains('fullB'), null, { timeout: 600000 });
    const rs = () => pg.evaluate(() => { const r = document.getElementById('spReset'), s = window.__game.split; return { shown: !!r.offsetParent, manual: !!s.manual, yaw: +s.yaw.toFixed(3), dist: +s.dist.toFixed(1) }; });
    const r0 = await rs(); ok(!r0.shown && !r0.manual, `${vp} expanded booster view starts following (no reset button)`);
    const full = await shot('full') || await pg.evaluate(CHECK, { state: 'booster-full', flight: true }); ok(!full.fails.length, `${vp} expanded booster view layout (${full.n} controls) ${full.fails.join('; ')}`);
    const box = await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await pg.mouse.move(box[0], box[1]); await pg.mouse.down(); await pg.mouse.move(box[0] + 60, box[1] + 10, { steps: 4 }); await pg.mouse.up();
    await pg.mouse.move(box[0], box[1]); await pg.mouse.wheel(0, 500);
    await pg.waitForFunction(() => window.__game.split.manual, null, { timeout: 600000 });
    const r1 = await rs(); ok(r1.manual && r1.shown && r1.yaw !== r0.yaw, `${vp} drag orbits the booster camera and shows ⟲ FOLLOW (yaw ${r0.yaw} -> ${r1.yaw})`);
    const z = await pg.evaluate(() => { document.getElementById('spPane').dispatchEvent(new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true })); return window.__game.split.dist; });
    ok(z > r1.dist || z >= 1500 || r1.dist !== r0.dist, `${vp} wheel zooms the booster camera (dist ${r0.dist} -> ${r1.dist} -> ${z})`);
    const man = await shot('man') || await pg.evaluate(CHECK, { state: 'booster-manual', flight: true }); ok(!man.fails.length, `${vp} layout with the reset button showing ${man.fails.join('; ')}`);
    await pg.click('#spReset'); const r2 = await rs(); ok(!r2.manual && !r2.shown && r2.dist === 90, `${vp} ⟲ FOLLOW resets the camera (dist ${r2.dist}, manual ${r2.manual})`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
