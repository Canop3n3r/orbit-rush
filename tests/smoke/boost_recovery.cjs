// f5.9-31: full-screen booster view. The orbit/pinch surface fills the viewport, a drag / wheel moves the main camera,
// and RTLS / BARGE / AUTO live in a sheet (one chip), not in the booster strip. AUTO reads downrange, speed and fuel.
//   U=http://localhost:8982/ [VP=390x844] [OUT=/workspace/shots] node tests/smoke/boost_recovery.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const { CHECK } = require('./ui_walk.cjs');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const OUT = process.env.OUT || '', URL = process.env.U || 'http://localhost:8982/', VPS = (process.env.VP || '390x844,844x390').split(','), M = process.env.M || 'colossus-v4';
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(600000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/boost23_${n}_${vp}.png` }); };
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
    await pg.evaluate(m => { const c = document.querySelector(`.pkC[data-m="${m}"]`) || document.querySelector(`.pkC[data-th="${m}"]`); if (!c) throw new Error('no card ' + m); c.click(); }, M);
    await pg.click('#hFly'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 60000 && !F.flags.dead && !(G.booster && G.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForFunction(() => { const s = document.getElementById('split'); return s && !s.classList.contains('hidden'); }, null, { timeout: 600000 });
    const rp0 = await pg.evaluate(() => { const b = window.__game.booster; return b.recPlan ? { ...b.recPlan, rtls: !!b.rtls } : null; });
    ok(rp0 && /rtls|ship/.test(rp0.mode) && rp0.pref === 'auto' && rp0.why, `${vp} AUTO picked ${rp0 && rp0.mode} (${rp0 && rp0.why}; Δv ${rp0 && rp0.have}/${rp0 && rp0.need} m/s)`);
    ok(rp0 && (rp0.mode === 'rtls') === rp0.rtls, `${vp} the booster flies the picked mode`);
    await pg.evaluate(() => document.getElementById('spFull').click()); await pg.waitForFunction(() => { const c = document.getElementById('spCardB'); return c.classList.contains('inBar') && c.getBoundingClientRect().bottom > innerHeight * 0.6; }, null, { timeout: 120000 }).catch(() => {}); await pg.waitForTimeout(1000);
    const pane0 = await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
    ok(pane0.w >= pane0.vw - 2 && pane0.h >= pane0.vh - 2, `${vp} booster camera surface fills the screen (${pane0.w | 0}x${pane0.h | 0} vs ${pane0.vw}x${pane0.vh})`);
    await pg.evaluate(() => document.getElementById('spRecBtn').click());
    const L = await pg.evaluate(() => { const c = document.getElementById('spCardB').getBoundingClientRect(), b = document.getElementById('botBar').getBoundingClientRect(), r = document.getElementById('spRec'), w = document.getElementById('spRecW');
      return { cTop: c.top, cBot: c.bottom, bTop: b.top, bBot: b.bottom, rec: r.getClientRects().length > 0 && r.getBoundingClientRect().height > 0, inBar: !!r.closest('#botBar,#spCardB'), txt: w.textContent, on: [...r.querySelectorAll('button.on')].map(x => x.dataset.rec) }; });
    ok(L.cBot <= L.bBot + 2 && L.cBot > L.bTop && L.cTop > L.bTop - 90, `${vp} booster strip fills the bottom bar band (strip ${L.cTop | 0}-${L.cBot | 0}, bar ${L.bTop | 0}-${L.bBot | 0})`);
    ok(L.rec && !L.inBar && /RETURN TO SITE|OCEAN BARGE/.test(L.txt) && /downrange/.test(L.txt) && L.on.join() === 'auto', `${vp} recovery sheet shows the mode and why: "${L.txt}" [${L.on}]`);
    await pg.waitForTimeout(600); await shot('full');
    const f = await pg.evaluate(CHECK, { state: 'booster-full', flight: true }); ok(!f.fails.length, `${vp} full booster view layout (${f.n} controls) ${f.fails.join('; ')}`);
    await pg.evaluate(() => document.getElementById('spRec').classList.add('hidden'));
    const c0 = await pg.evaluate(() => window.__game.camInfo()), box = [W / 2, H * 0.35];
    await pg.mouse.move(box[0], box[1]); await pg.mouse.down(); await pg.mouse.move(box[0] + 80, box[1] + 30, { steps: 5 }); await pg.mouse.up();
    await pg.evaluate(() => document.getElementById('spPane').dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true })));
    const c1 = await pg.evaluate(() => ({ ...window.__game.camInfo(), mode: window.__game.camMode, full: window.__game.split.full }));
    ok(c1.yaw !== c0.yaw && c1.dist > c0.dist && c1.mode === 'booster' && c1.full === 'b', `${vp} drag orbits + wheel zooms the full booster camera (yaw ${c0.yaw.toFixed(2)}→${c1.yaw.toFixed(2)}, dist ${c0.dist.toFixed(0)}→${c1.dist.toFixed(0)}), view stays full`);
    await pg.waitForTimeout(500); await shot('orbit');
    const other = rp0 && rp0.mode === 'rtls' ? 'ship' : 'rtls';
    await pg.evaluate(o => document.querySelector(`#spRec button[data-rec="${o}"]`).click(), other); await pg.waitForTimeout(1500);
    const s1 = await pg.evaluate(() => { const G = window.__game, b = G.booster; return { mode: b.recPlan.mode, pref: b.recPlan.pref, rtls: !!b.rtls, lz: !!(G.ship && G.ship.lz), txt: document.getElementById('spRecW').textContent }; });
    ok(s1.mode === other && s1.pref === other && s1.rtls === (other === 'rtls') && s1.lz === (other === 'rtls'), `${vp} override to ${other}: "${s1.txt}"`);
    await shot('override');
    await pg.evaluate(() => document.querySelector('#spRec button[data-rec="auto"]').click()); await pg.waitForTimeout(300);
    const s2 = await pg.evaluate(() => { const p = window.__game.booster.recPlan; return { pref: p.pref, mode: p.mode }; }); ok(s2.pref === 'auto' && s2.mode === rp0.mode, `${vp} AUTO goes back to ${s2.mode}`);
    // fly it out: the booster still lands (or is lost) without page errors
    await pg.evaluate(() => { const G = window.__game, F = G.F; for (let i = 0; i < 40000 && G.booster && G.booster.state === 'flying'; i++) { F.realT += 0.02; F.step(0.02); } });
    const fin = await pg.evaluate(() => ({ st: window.__game.booster && window.__game.booster.state, why: window.__game.F.flags.booster }));
    ok(fin.st === 'landed', `${vp} booster outcome: ${fin.st} (${fin.why || ''})`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
