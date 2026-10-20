// f3 regression smokes (Playtest QA Bot). One command, headless Chrome (SwiftShader), phone 390x844 touch, low FX.
//   node tests/smoke/f3_smokes.cjs [baseUrl] [--shots dir] [--only name,name]
// baseUrl defaults to the live build. Exit 0 only if every check passes. Needs playwright-core + Chrome
// (PW_CORE=/path/to/playwright-core, CHROME=/usr/bin/google-chrome).
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/workspace/pwt/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const shots = opt('--shots'), only = (opt('--only') || '').split(',').filter(Boolean);
const base = args[0] || 'https://canop3n3r.github.io/orbit-rush/';
const GPU = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required'];
const W = 390, H = 844, results = [];
const rec = (name, ok, info) => { results.push({ name, ok, info }); console.log(ok ? 'PASS' : 'FAIL', name.padEnd(20), typeof info === 'string' ? info : JSON.stringify(info)); };
const want = n => !only.length || only.includes(n);
async function page(br, q = '') {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; window.__acs = []; const W = class extends AC { constructor(...a) { super(...a); window.__acs.push(this); } }; window.AudioContext = W; window.webkitAudioContext = W; });
  const pg = await ctx.newPage(); pg.ctx = ctx; pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.goto(base + (base.includes('?') ? '&' : '?') + 'noacademy&touch&fx=low' + q, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1200);
  return pg;
}
const shot = async (pg, n) => { if (shots) await pg.screenshot({ path: `${shots}/f3smoke_${n}.png` }); };
const launchTpl = (pg, name) => pg.evaluate(n => { const G = window.__game; document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  G.setDesign(G.TEMPLATES.find(t => t.name === n) || G.TEMPLATES[0]); G.launch(); }, name);

async function ascent(br) { // plume / shock / spiral / auto staging share one flight
  const pg = await page(br); await launchTpl(pg, 'Light & fast'); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const G = window.__game, F = G.F; G.press('Space'); F.setAuto(true); window.__taps = 0; window.__fuel0 = F.v.stages[0].fuel;
    const sp = F.stagePress.bind(F), st = F.stage.bind(F); window.__stageLog = [];
    F.stagePress = (...a) => { window.__taps++; return sp(...a); }; // any STAGE tap after ignition counts
    F.stage = (...a) => { const v = F.v; window.__stageLog.push({ cur: v.cur, fuel: +(v.stages[v.cur].fuel || 0).toFixed(0), alt: Math.round(F.alt) }); return st(...a); }; });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 200 && F.alt < 7600; i++) F.advance(1 / 60); });
  await pg.waitForTimeout(3500); // live frames lay the smoke trail
  const a = await pg.evaluate(() => { const G = window.__game; if (G.plumeAudit) return G.plumeAudit();
    const sh = G.fx && G.fx.shock; return { noHook: true, plumes: [], bad: [], shock: sh && sh.visible ? Math.max(sh.scale.x, sh.scale.y) : 0, L: G.P && G.P.stackGeom ? G.P.stackGeom(G.v).L : 0, smoke: null }; });
  const hasHide = await pg.evaluate(() => !!window.__game.fxHide), fxRoot = 'window.__game.fxHide ? window.__game.fxHide(ON) : (window.__game.fx && window.__game.fx.root && (window.__game.fx.root.visible = !ON))';
  const s1 = await pg.screenshot(); await pg.evaluate(fxRoot.replaceAll('ON', 'true')); await pg.waitForTimeout(300);
  const s0 = await pg.screenshot(); await pg.evaluate(fxRoot.replaceAll('ON', 'false')); if (shots) require('fs').writeFileSync(`${shots}/f3smoke_ascent.png`, s1);
  const cover = await pg.evaluate(async ([a, b]) => { const ld = async s => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * i.height / i.width); const g = c.getContext('2d'); g.drawImage(i, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height).data; };
    const A = await ld(a), B = await ld(b); let n = 0, k = 0; for (let i = 0; i < A.length; i += 4) { n++; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 24) k++; } return k / n; }, [s1.toString('base64'), s0.toString('base64')]);
  if (want('plume_on_nozzles')) rec('plume_on_nozzles', !a.noHook && a.plumes.length > 0 && a.bad.length === 0, a.noHook ? 'no plumeAudit() hook in this build: cannot verify plumes sit on nozzles' : { plumes: a.plumes.length, off: a.bad.length, engines: a.engines });
  if (want('no_shock_cone')) rec('no_shock_cone', cover <= 0.12 && a.shock <= a.L * 0.6 + 6, { fxCoverPct: +(cover * 100).toFixed(1), shock: +(+a.shock).toFixed(1), L: +(+a.L).toFixed(1), fxHideHook: hasHide });
  if (want('no_spiral_trail')) rec('no_spiral_trail', !!a.smoke && a.smoke.rms <= 9, a.noHook ? 'no plumeAudit() hook in this build: trail spread not measurable' : { trailRms_m: a.smoke && a.smoke.rms, puffs: a.smoke && a.smoke.n });
  if (want('auto_staging')) {
    const r = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 20 * 400 && F.v.cur === 0 && !F.flags.dead; i++) F.advance(1 / 20); return { cur: F.v.cur, fuel0: Math.round(window.__fuel0), taps: window.__taps, log: window.__stageLog, dead: F.flags.dead || null }; });
    const s = r.log[0]; rec('auto_staging', r.cur > 0 && r.taps === 0 && s && s.fuel > 0.02 * r.fuel0, { staged: r.cur > 0, stageTaps: r.taps, boosterFuelAtSep: s ? s.fuel : null, boosterFuel0: r.fuel0, alt: s ? s.alt : null, dead: r.dead });
  }
  await pg.ctx.close(); return pg.errs;
}
async function map(br) {
  const pg = await page(br); await launchTpl(pg, 'Light & fast'); await pg.waitForTimeout(1200);
  await pg.evaluate(() => { const G = window.__game, F = G.F; F.placeInOrbit(400000, F.v.stages.length - 1); G.syncStages(); F.ignited = true; F.flags.liftoff = true; G.press('KeyM'); });
  await pg.waitForTimeout(3000); await pg.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))); await pg.waitForTimeout(500); await shot(pg, 'map');
  if (want('map_ui_15pct')) {
    const m = await pg.evaluate(() => { const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 ? r : null; };
      let n = 0, k = 0; for (let y = 2; y < innerHeight; y += 8) for (let x = 2; x < innerWidth; x += 8) { n++; const e = document.elementFromPoint(x, y); if (e && e.tagName !== 'CANVAS' && e !== document.body && e !== document.documentElement && !(e.id || '').match(/^(mapLabels|mapui|map)$/i) && getComputedStyle(e).pointerEvents !== 'none') k++; }
      const labs = [...document.querySelectorAll('.mlab')].map(e => ({ t: e.textContent.trim().slice(0, 16), r: vis(e) })).filter(o => o.r && o.r.right > 0 && o.r.left < innerWidth && o.r.bottom > 0 && o.r.top < innerHeight);
      const ov = []; for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const a = labs[i].r, b = labs[j].r; const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 2 && h > 2) ov.push(labs[i].t + '×' + labs[j].t); }
      return { uiPct: +(100 * k / n).toFixed(1), labels: labs.length, overlaps: ov.slice(0, 6), nOverlap: ov.length }; });
    rec('map_ui_15pct', m.uiPct <= 15 && m.nOverlap === 0, m);
  }
  if (want('map_cam_upright')) {
    const roll = () => pg.evaluate(() => { const c = window.__game.smap.camera; c.updateMatrixWorld(); const e = c.matrixWorld.elements; return { rightZ: +e[2].toFixed(3), upZ: +e[6].toFixed(3) }; }); // NORTH = +Z
    const samples = [await roll()];
    const drag = async (dx, dy) => { await pg.mouse.move(W / 2, H / 2); await pg.mouse.down(); for (let i = 1; i <= 10; i++) await pg.mouse.move(W / 2 + dx * i / 10, H / 2 + dy * i / 10); await pg.mouse.up(); await pg.waitForTimeout(250); samples.push(await roll()); };
    await drag(150, 0); await drag(0, 300); await drag(-120, -320); await drag(200, 200); await pg.waitForTimeout(2500); samples.push(await roll());
    const worst = Math.max(...samples.map(s => Math.abs(s.rightZ))), flipped = samples.some(s => s.upZ < 0);
    rec('map_cam_upright', worst < 0.05 && !flipped, { maxRollSin: worst, flipped, samples: samples.length });
  }
  await pg.ctx.close(); return pg.errs;
}
async function audio(br) {
  const pg = await page(br); const st = () => pg.evaluate(() => { const G = window.__game; if (G.audio) return G.audio(); const a = (window.__acs || []).slice(-1)[0]; return { state: a ? a.state : 'none', master: a ? 1 : -1, muted: false, viaShim: true }; });
  const a0 = await st();
  await pg.touchscreen.tap(W / 2, H * 0.45); await pg.waitForTimeout(800);
  const a1 = await st();
  rec('audio_after_tap', a1.state === 'running' && a1.master > 0 && !a1.muted, { before: a0.state, after: a1.state, master: a1.master, muted: a1.muted });
  await pg.ctx.close(); return pg.errs;
}
async function endCard(br) {
  const pg = await page(br); await pg.evaluate(() => { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); window.__game.startMission('hop'); }); await pg.waitForTimeout(2000);
  for (let k = 0; k < 40; k++) { const done = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 15; i++) F.advance(1 / 60); const e = document.getElementById('end'); return e && !e.classList.contains('hidden'); }); await pg.waitForTimeout(400); if (done) break; }
  await pg.waitForTimeout(1500); await shot(pg, 'endcard');
  const r = await pg.evaluate(() => { const e = document.getElementById('end'); if (!e || e.classList.contains('hidden')) return { shown: false }; const r = e.getBoundingClientRect(), b = window.__game.rocketBox ? window.__game.rocketBox() : null;
    const lines = (document.getElementById('endBody').innerText.match(/\n/g) || []).length + 1;
    const ix = b ? Math.max(0, Math.min(r.right, b.x + b.w) - Math.max(r.left, b.x)) * Math.max(0, Math.min(r.bottom, b.y + b.h) - Math.max(r.top, b.y)) : null;
    return { shown: true, cardPct: +(100 * r.width * r.height / innerWidth / innerHeight).toFixed(1), cardH: Math.round(r.height), lines, rocket: b && [b.x, b.y, b.w, b.h].map(Math.round), rocketHiddenPct: b && b.w * b.h > 0 ? +(100 * ix / (b.w * b.h)).toFixed(0) : null }; });
  rec('end_card_compact', r.shown && r.cardPct <= 45 && r.lines <= 8 && (r.rocketHiddenPct === null ? true : r.rocketHiddenPct <= 20), r); // no rocketBox hook (f2): judged on size alone
  await pg.ctx.close(); return pg.errs;
}
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); const errs = [];
  const grp = { ascent: ['plume_on_nozzles', 'no_shock_cone', 'no_spiral_trail', 'auto_staging'], map: ['map_ui_15pct', 'map_cam_upright'], audio: ['audio_after_tap'], endCard: ['end_card_compact'] };
  for (const [g, f] of Object.entries({ ascent, map, audio, endCard })) { if (!grp[g].some(want)) continue;
    try { errs.push(...await f(br)); } catch (e) { for (const n of grp[g].filter(want)) if (!results.find(r => r.name === n)) rec(n, false, 'ERROR ' + e.message.split('\n')[0]); } }
  await br.close(); const nf = results.filter(r => !r.ok).length;
  console.log(`f3 smokes on ${base}: ${results.length - nf} passed, ${nf} failed; page errors: ${JSON.stringify(errs.slice(0, 5))}`);
  process.exit(nf ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
