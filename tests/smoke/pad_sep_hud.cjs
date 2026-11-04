// f5.9-22 (owner, phone portrait): the full HUD (navball, mph telemetry, throttle slider, STAGE) shows on the pad and stays after a payload separation.
//   U=http://localhost:8960/ [VP=390x844] node tests/smoke/pad_sep_hud.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', P = process.env.P || 'pad_sep';
const VIS = () => { const v = id => { const e = document.getElementById(id); if (!e) return 0; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 4 && r.height > 4 && c.display !== 'none' && c.visibility !== 'hidden' ? 1 : 0; }; return { nav: v('navBall'), plain: v('plain'), thr: v('mThr') || v('dThr'), tank: v('tankViz'), stage: v('mStage') || v('dStage'), cls: document.body.className }; };
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0;
 for (const vp of (process.env.VP||'390x844').split(',')) { const [W, H] = vp.split('x').map(Number); const m = Math.min(W,H) < 700;
  const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: m, hasTouch: m }); const errs=[]; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
  await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(3500);
  const pad = await pg.evaluate(VIS); await pg.screenshot({ path: `${process.env.SHOT || '/tmp'}/${P}_pad_${vp}.png` }); console.log(vp, 'pad', JSON.stringify(pad));
  await pg.evaluate(() => { const G = window.__game; G.F.setAuto(true); if (!G.F.ignited) G.press('Space'); });
  for (let k = 0; k < 120; k++) { const dn = await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 60 * 20 && !(F.flags.orbit && F.v.guid === 'done'); i++) F.advance(1 / 60); return !!(F.flags.orbit && F.v.guid === 'done'); }); if (dn) break; }
  await pg.waitForTimeout(800); await pg.evaluate(() => { const b = document.getElementById('relBtn'); b && /RELEASE/.test(b.textContent) && b.click(); }); await pg.waitForTimeout(2500);
  const sep = await pg.evaluate(VIS); await pg.screenshot({ path: `${process.env.SHOT || '/tmp'}/${P}_sep_${vp}.png` }); console.log(vp, 'sep', JSON.stringify(sep));
  for (const [n, s] of [['pad', pad], ['sep', sep]]) for (const k of ['nav', 'plain', 'thr', 'stage']) if (!s[k]) { bad++; console.log('FAIL', vp, n, k); }
  if (errs.length) { bad++; console.log('FAIL errs', errs.slice(0,2).join('|')); } await pg.close(); }
 await br.close(); console.log(bad ? `pad_sep_hud: ${bad} FAIL` : 'pad_sep_hud: all ok'); process.exit(bad ? 1 : 0); })();
