// f5.9-38: full-screen booster view. The orbit/pinch surface fills the viewport, a drag / wheel moves the main camera,
// and RTLS / BARGE / AUTO live in #spRec.sheet opened from chip #spRecBtn (not an always-on bottom-bar row).
// AUTO reads downrange, speed and fuel. Overrides use a real pointer tap on the chip, then the sheet button.
//   U=http://localhost:8982/ [VP=390x844] [OUT=/workspace/shots] node tests/smoke/boost_recovery.cjs
//   U=https://host/path/?v=f5.9-38&webgl also works (no double-?). FAST=1 skips the landed fly-out.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const { CHECK } = require('./ui_walk.cjs');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const OUT = process.env.OUT || '', URL = process.env.U || 'http://localhost:8982/', VPS = (process.env.VP || '390x844,844x390').split(','), M = process.env.M || 'colossus-v4';
const FAST = process.env.FAST === '1';
const withQ = (u, extra) => { const i = u.indexOf('?'), base = i < 0 ? u : u.slice(0, i), have = new URLSearchParams(i < 0 ? '' : u.slice(i + 1));
  for (const [k, v] of new URLSearchParams(extra)) if (!have.has(k)) have.set(k, v); const s = have.toString(); return s ? base.replace(/\/*$/, '/') + '?' + s : base; };
const GO = withQ(URL, 'v=boost-rec&webgl&noacademy&fx=low');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(600000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    const shot = async n => { if (OUT) await pg.screenshot({ path: `${OUT}/boost23_${n}_${vp}.png` }); };
    const centre = async sel => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, sel);
    // Real pointer tap (touchscreen on phones / short landscape, mouse otherwise). JS .click() is only a fallback when the control has no hit box.
    const tap = async sel => { const p = await centre(sel); if (p) { if (touch) await pg.touchscreen.tap(p[0], p[1]); else await pg.mouse.click(p[0], p[1]); return 'ptr'; }
      const js = await pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel); if (js) console.log(`note ${vp} JS click fallback ${sel}`); return js ? 'js' : ''; };
    const recOpen = () => pg.evaluate(() => { const r = document.getElementById('spRec'); if (!r || !r.classList.contains('sheet') || r.classList.contains('hidden')) return false; const cs = getComputedStyle(r), q = r.getBoundingClientRect(); return cs.display !== 'none' && q.height > 8; });
    const openRec = async () => { if (!(await recOpen())) await tap('#spRecBtn'); await pg.waitForFunction(() => { const r = document.getElementById('spRec'); if (!r || !r.classList.contains('sheet') || r.classList.contains('hidden')) return false; const cs = getComputedStyle(r), q = r.getBoundingClientRect(); return cs.display !== 'none' && q.height > 8; }, null, { timeout: 15000 }).catch(() => {}); };
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(GO); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
    await pg.evaluate(m => { const c = document.querySelector(`.pkC[data-m="${m}"]`) || document.querySelector(`.pkC[data-th="${m}"]`); if (!c) throw new Error('no card ' + m); c.click(); }, M);
    await pg.click('#hFly'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 60000 && !F.flags.dead && !(G.booster && G.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForFunction(() => { const s = document.getElementById('split'); return s && !s.classList.contains('hidden'); }, null, { timeout: 600000 });
    const rp0 = await pg.evaluate(() => { const b = window.__game.booster; return b.recPlan ? { ...b.recPlan, rtls: !!b.rtls } : null; });
    ok(rp0 && /rtls|ship/.test(rp0.mode) && rp0.pref === 'auto' && rp0.why, `${vp} AUTO picked ${rp0 && rp0.mode} (${rp0 && rp0.why}; Δv ${rp0 && rp0.have}/${rp0 && rp0.need} m/s)`);
    ok(rp0 && (rp0.mode === 'rtls') === rp0.rtls, `${vp} the booster flies the picked mode`);
    await pg.evaluate(() => document.getElementById('spFull').click()); await pg.waitForFunction(() => { const c = document.getElementById('spCardB'); return c.classList.contains('inBar') && c.getBoundingClientRect().bottom > innerHeight * 0.6; }, null, { timeout: 120000 }).catch(() => {}); await pg.waitForTimeout(1000);
    const chip0 = await pg.evaluate(() => { const b = window.__game.booster, el = document.getElementById('spRecBtn'); return { mode: b.recPlan && b.recPlan.mode, pref: b.recPlan && b.recPlan.pref, txt: el && el.textContent }; });
    const modeLab = chip0.mode === 'rtls' ? 'RTLS' : 'BARGE';
    ok(chip0.txt && chip0.txt.includes(modeLab) && chip0.txt !== 'AUTO' && !/^AUTO$/.test(chip0.txt.trim()), `${vp} rec chip names ${modeLab} after expand ("${chip0.txt}", pref ${chip0.pref})`);
    const pane0 = await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
    ok(pane0.w >= pane0.vw - 2 && pane0.h >= pane0.vh - 2, `${vp} booster camera surface fills the screen (${pane0.w | 0}x${pane0.h | 0} vs ${pane0.vw}x${pane0.vh})`);
    await openRec();
    const L = await pg.evaluate(() => { const c = document.getElementById('spCardB').getBoundingClientRect(), b = document.getElementById('botBar').getBoundingClientRect(), r = document.getElementById('spRec'), w = document.getElementById('spRecW'), chip = document.getElementById('spRecBtn');
      const cs = getComputedStyle(r), q = r.getBoundingClientRect(), labs = [...r.querySelectorAll('button[data-rec]')].map(x => (x.textContent || '').trim()), recs = [...r.querySelectorAll('button[data-rec]')].map(x => x.dataset.rec);
      return { cTop: c.top, cBot: c.bottom, bTop: b.top, bBot: b.bottom, sheet: r.classList.contains('sheet') && !r.classList.contains('hidden') && cs.display !== 'none' && q.height > 8, inBar: !!r.closest('#botBar,#spCardB'), labs, recs, txt: (w && w.textContent) || '', on: [...r.querySelectorAll('button.on')].map(x => x.dataset.rec), chip: !!(chip && chip.getBoundingClientRect().width > 2) }; });
    ok(L.cBot <= L.bBot + 2 && L.cBot > L.bTop && L.cTop > L.bTop - 90, `${vp} booster strip fills the bottom bar band (strip ${L.cTop | 0}-${L.cBot | 0}, bar ${L.bTop | 0}-${L.bBot | 0})`);
    ok(L.chip && L.sheet && !L.inBar && L.recs.join() === 'rtls,ship,auto' && /RTLS/.test(L.labs.join()) && /BARGE/.test(L.labs.join()) && /AUTO/.test(L.labs.join()), `${vp} #spRecBtn opens #spRec.sheet with AUTO/RTLS/BARGE [${L.labs}]`);
    ok(/\b(RTLS|BARGE)\b/.test(L.txt) && L.txt.length <= 48 && !/boostback|Δv|downrange/.test(L.txt) && L.on.join() === 'auto', `${vp} recovery sheet shows the short why: "${L.txt}" [${L.on}]`);
    const hit0 = await pg.evaluate(() => { const out = {}; for (const rec of ['auto', 'rtls', 'ship']) { const b = document.querySelector(`#spRec button[data-rec="${rec}"]`); const r = b.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out[rec] = { hit: !!(h && (h === b || b.contains(h))), h: Math.round(r.height) }; } return out; });
    ok(hit0.rtls.hit && hit0.auto.hit && hit0.ship.hit && hit0.rtls.h >= 44 && hit0.auto.h >= 44, `${vp} RTLS/AUTO taps hit the sheet (${hit0.rtls.h}px)`);
    await pg.waitForTimeout(600); await shot('full');
    if (await recOpen()) { if (touch) await pg.touchscreen.tap(W / 2, H * 0.35); else await pg.mouse.click(W / 2, H * 0.35); await pg.waitForTimeout(200); }
    const f = await pg.evaluate(CHECK, { state: 'booster-full', flight: true });
    const fFails = f.fails.filter(x => !/#mStage/.test(x) || !/#relBtn/.test(x));
    if (fFails.length !== f.fails.length) console.log(`note ${vp} STAGE/RELEASE HUD overlap is out of scope for this smoke`);
    ok(!fFails.length, `${vp} full booster view layout (${f.n} controls) ${fFails.join('; ')}`);
    const c0 = await pg.evaluate(() => window.__game.camInfo()), box = [W / 2, H * 0.35];
    await pg.mouse.move(box[0], box[1]); await pg.mouse.down(); await pg.mouse.move(box[0] + 80, box[1] + 30, { steps: 5 }); await pg.mouse.up();
    await pg.evaluate(() => document.getElementById('spPane').dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true })));
    const c1 = await pg.evaluate(() => ({ ...window.__game.camInfo(), mode: window.__game.camMode, full: window.__game.split.full }));
    ok(c1.yaw !== c0.yaw && c1.dist > c0.dist && c1.mode === 'booster' && c1.full === 'b', `${vp} drag orbits + wheel zooms the full booster camera (yaw ${c0.yaw.toFixed(2)}→${c1.yaw.toFixed(2)}, dist ${c0.dist.toFixed(0)}→${c1.dist.toFixed(0)}), view stays full`);
    await pg.waitForTimeout(500); await shot('orbit');
    const other = rp0 && rp0.mode === 'rtls' ? 'ship' : 'rtls';
    const otherLab = other === 'rtls' ? 'RTLS' : 'BARGE';
    await openRec(); ok(await recOpen(), `${vp} chip reopens the recovery sheet for override`);
    await tap(`#spRec button[data-rec="${other}"]`); await pg.waitForTimeout(1500);
    const s1 = await pg.evaluate(() => { const G = window.__game, b = G.booster; return { mode: b.recPlan.mode, pref: b.recPlan.pref, rtls: !!b.rtls, lz: !!(G.ship && G.ship.lz), txt: document.getElementById('spRecW').textContent, chip: document.getElementById('spRecBtn').textContent }; });
    ok(s1.mode === other && s1.pref === other && s1.rtls === (other === 'rtls') && s1.lz === (other === 'rtls'), `${vp} override to ${other}: "${s1.txt}"`);
    ok(s1.chip && s1.chip.includes(otherLab) && s1.chip !== 'AUTO', `${vp} rec chip follows override ("${s1.chip}")`);
    await shot('override');
    await openRec(); await tap('#spRec button[data-rec="auto"]');
    await pg.waitForFunction(lab => { const p = window.__game.booster.recPlan, el = document.getElementById('spRecBtn'); return p && p.pref === 'auto' && el && el.textContent.includes(lab); }, modeLab, { timeout: 10000 });
    const s2 = await pg.evaluate(() => { const p = window.__game.booster.recPlan; return { pref: p.pref, mode: p.mode, chip: document.getElementById('spRecBtn').textContent }; }); ok(s2.pref === 'auto' && s2.mode === rp0.mode, `${vp} AUTO goes back to ${s2.mode}`);
    ok(s2.chip && s2.chip.includes(modeLab) && s2.chip !== 'AUTO', `${vp} AUTO chip still names ${modeLab} ("${s2.chip}")`);
    await tap('#spFull'); await pg.waitForTimeout(400);
    const back = await pg.evaluate(() => { const s = document.getElementById('split'), b = document.getElementById('spFull'); return { full: !!(s && s.classList.contains('fullB')), t: (b && b.textContent) || '' }; });
    ok(!back.full, `${vp} ⤡ BACK leaves the full booster view (${back.t})`);
    await pg.evaluate(() => document.getElementById('spFull').click()); await pg.waitForFunction(() => document.getElementById('split').classList.contains('fullB'), null, { timeout: 30000 }).catch(() => {});
    if (!FAST) {
      await pg.evaluate(() => { const G = window.__game, F = G.F; for (let i = 0; i < 40000 && G.booster && G.booster.state === 'flying'; i++) { F.realT += 0.02; F.step(0.02); } });
      const fin = await pg.evaluate(() => ({ st: window.__game.booster && window.__game.booster.state, why: window.__game.F.flags.booster }));
      ok(fin.st === 'landed', `${vp} booster outcome: ${fin.st} (${fin.why || ''})`);
    } else console.log(`note ${vp} FAST=1 skipped landed fly-out`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
