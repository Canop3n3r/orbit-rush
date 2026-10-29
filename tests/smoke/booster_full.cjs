// f5.9-10 (QA f5.9-9 P2): the expanded booster view. BOOSTER ⤢ / ⤡ BACK sits in one spot (same rect in the PiP and expanded),
// no flight telemetry or navball ghosts show behind the bar while the booster owns the screen, and the booster is lit (not a black hole).
//   U=http://localhost:8960/ [VP=844x390,390x844,1280x800] [OUT=dir] node tests/smoke/booster_full.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '844x390,390x844,1280x800').split(','), OUT = process.env.OUT || '';
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(600000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
    await pg.evaluate(() => { const c = document.querySelector('.pkC[data-m="colossus-v4"]') || document.querySelector('.pkC[data-th="colossus-v4"]'); if (!c) throw new Error('no colossus card'); c.click(); });
    await pg.click('#hFly'); await pg.waitForTimeout(2000);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 60000 && !F.flags.dead && !(G.booster && G.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } for (let i = 0; i < 400; i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForFunction(() => { const s = document.getElementById('split'); return s && !s.classList.contains('hidden'); }, null, { timeout: 600000 }); await pg.waitForTimeout(1500);
    const btn = () => pg.evaluate(() => { const b = document.getElementById('spFull'); if (!b || !b.offsetParent) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), t: b.textContent.trim() }; });
    const b0 = await btn(); ok(!b0, `${vp} the PiP itself is the expand button (no stray ⤢ in the bar) ${JSON.stringify(b0)}`);
    await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }).then(c => pg.mouse.click(c[0], c[1]));
    await pg.waitForFunction(() => document.getElementById('split').classList.contains('fullB'), null, { timeout: 60000 }).catch(() => {}); await pg.waitForTimeout(2500);
    const b1 = await btn(), tb = await pg.evaluate(() => Math.round(document.getElementById('topBar').getBoundingClientRect().bottom));
    ok(!!b1 && Math.abs(W - (b1.x + b1.w) - 10) <= 3 && Math.abs(b1.y - tb - 8) <= 3, `${vp} ⤡ BACK pinned in one spot: 10px from the right, 8px under the top bar (${JSON.stringify(b1)}, bar ${tb})`);
    ok(!!b1 && /BACK/.test(b1.t), `${vp} expanded label reads ⤡ BACK (${b1 && b1.t})`);
    if (b1) { await pg.mouse.click(b1.x + b1.w / 2, b1.y + b1.h / 2); await pg.waitForTimeout(1500); ok(await pg.evaluate(() => !document.getElementById('split').classList.contains('fullB')), `${vp} ⤡ BACK returns to the PiP`); await pg.evaluate(() => { const r = document.getElementById('spPane').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }).then(c => pg.mouse.click(c[0], c[1])); await pg.waitForTimeout(2000); }
    const ghosts = await pg.evaluate(() => { const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && cs.display !== 'none' && !e.closest('.hidden'); };
      return ['nav', 'plain', 'navRd', 'navSasT'].filter(id => vis(document.getElementById(id))); });
    ok(!ghosts.length, `${vp} no flight telemetry / navball behind the expanded booster view (${ghosts.join(',') || 'none'})`);
    const lum = await pg.evaluate(() => new Promise(res => requestAnimationFrame(() => { const c = document.getElementById('spCanvas') || document.querySelector('#split canvas'); res(c ? c.id || 'canvas' : null); })));
    const png = await pg.screenshot({ clip: { x: W * 0.3, y: H * 0.3, width: W * 0.4, height: H * 0.4 } }); if (OUT) await pg.screenshot({ path: `${OUT}/booster_full_${vp}.png` });
    const st = await pg.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let bright = 0, n = 0; for (let i = 0; i < d.length; i += 16) { n++; if (d[i] + d[i + 1] + d[i + 2] > 150) bright++; } return +(100 * bright / n).toFixed(2); }, png.toString('base64'));
    ok(st > 0.5, `${vp} the booster is lit in the expanded view (${st}% bright pixels mid-screen, view ${lum})`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `booster_full: ${bad} FAIL` : 'booster_full: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
