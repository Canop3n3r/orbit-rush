// f5.9-12 (QA f5.9-11): Atlas and Settings measured with Playtest QA's census (text nodes + controls with a layout box, ui% = opaque hits
// on an 8 px grid), opened the way a player does: 🪐 on Home and ⚙ on Home. Folded <details> must not count; desktop sheets must not fill the screen.
//   U=http://localhost:8960/ [VP=390x844,844x390,1280x800,1920x1080] node tests/smoke/census_sheets.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800,1920x1080').split(',');
const CENSUS = () => {
      const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); if (r.width < 2 || r.height < 2 || s.visibility === 'hidden' || +s.opacity < 0.05) return null; if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return null; return r; };
      const ctl = [...document.querySelectorAll('button,[role=button],input,select,a')].map(e => [e, vis(e)]).filter(x => x[1]);
      const off = ctl.filter(([e, r]) => r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1).map(([e]) => e.id || e.textContent.trim().slice(0, 12));
      const small = ctl.filter(([e, r]) => Math.min(r.width, r.height) < 40).map(([e, r]) => (e.id || e.textContent.trim().slice(0, 14)) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      let words = 0; const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) { const p = t.parentElement; if (!p || !t.textContent.trim()) continue; const r = p.getBoundingClientRect(), s = getComputedStyle(p); if (r.width < 1 || s.visibility === 'hidden' || +s.opacity < 0.05 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue; let hid = false; for (let q = p; q; q = q.parentElement) { const qs = getComputedStyle(q); if (qs.display === 'none' || qs.visibility === 'hidden') { hid = true; break; } } if (!hid) words += t.textContent.trim().split(/\s+/).length; }
      let ui = 0, n = 0; for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) { n++; const h = document.elementFromPoint(x, y); if (h && h.tagName !== 'CANVAS' && h !== document.body && h !== document.documentElement) { const s = getComputedStyle(h); const bg = s.backgroundColor; const a = bg.startsWith('rgba') ? +bg.split(',')[3].replace(')', '') : (bg === 'transparent' ? 0 : 1); if (a >= 0.3 || h.closest('button')) ui++; } }
      return { controls: ctl.length, labels: ctl.slice(0, 40).map(([e, r]) => (e.id || '·') + ':' + e.textContent.trim().slice(0, 12) + '@' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)), small, off, words, uiPct: +(100 * ui / n).toFixed(1) }; };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700, desk = W >= 900;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    const tap = async sel => { const r = await pg.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const q = e.getBoundingClientRect(); return q.width ? [q.left + q.width / 2, q.top + q.height / 2] : null; }, sel); if (!r) return false; if (touch) await pg.touchscreen.tap(r[0], r[1]); else await pg.mouse.click(r[0], r[1]); return true; };
    ok(await tap('#hAtlasB'), `${vp} 🪐 on Home`); await pg.waitForTimeout(1500); const a = await pg.evaluate(CENSUS);
    const ghost = await pg.evaluate(() => { const b = document.getElementById('hFly'); if (!b) return false; const q = b.getBoundingClientRect(); if (!q.width) return false; const h = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!h && (h === b || b.contains(h)); });
    ok(a.words <= 90, `${vp} atlas words ${a.words} ≤ 90 (QA census, Home behind it included; was 333)`); ok(!desk || a.uiPct <= 50, `${vp} atlas covers ${a.uiPct}% (desktop ≤ 50)`); ok(desk || !ghost, `${vp} atlas is opaque on a phone (Fly not hit-testable through it)`);
    await tap('#atlasClose'); await pg.waitForTimeout(600);
    ok(await tap('#hGear'), `${vp} ⚙ on Home`); await pg.waitForTimeout(1500); const s = await pg.evaluate(CENSUS);
    ok(s.controls <= 14, `${vp} settings controls ${s.controls} ≤ 14 (QA census, Home bar included)`); ok(!desk || s.uiPct <= 60, `${vp} settings covers ${s.uiPct}% (desktop ≤ 60)`); ok(!s.small.length || !desk, `${vp} settings targets ≥40px ${s.small.join(' ')}`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `census_sheets: ${bad} FAIL` : 'census_sheets: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
