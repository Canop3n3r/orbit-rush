// QA f5.9-7 (live d9ca4843): END FLIGHT must not take the RELEASE button's spot, and no popup survives under the end card.
//   1. at orbit a real DOUBLE tap on RELEASE (120 ms apart) releases the payload and must NOT end the flight (the 2nd tap lands where "■ End flight" appears).
//   2. with the craft list open, ending the flight must close it (no FLY / VIEW rows left over the end card).
// Usage: [VP=390x844,844x390] [U=https://canop3n3r.github.io/orbit-rush/] node tests/smoke/release_end_safe.cjs   (exit 1 on any FAIL)
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/workspace/pwt/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const U = process.env.U || 'https://canop3n3r.github.io/orbit-rush/', VPS = (process.env.VP || '390x844,844x390').split(',');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
let n = 0, bad = 0; const ok = (t, m, i) => { n++; if (!t) bad++; console.log((t ? 'ok   ' : 'FAIL ') + m + (i ? ' ' + JSON.stringify(i) : '')); };
(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  for (const vp of VPS) {
    const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(300000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    const tap = async (x, y) => { if (touch) await pg.touchscreen.tap(x, y); else await pg.mouse.click(x, y); };
    const rect = sel => pg.evaluate(sel => { const b = sel.startsWith('#') ? document.querySelector(sel) : [...document.querySelectorAll('button')].find(e => new RegExp(sel, 'i').test(e.textContent.trim()) && e.getBoundingClientRect().width > 1 && !e.closest('.hidden')); if (!b || b.classList.contains('hidden')) return null; const r = b.getBoundingClientRect(); return r.width > 1 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);
    await pg.goto(U + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.click('#hFly'); await pg.waitForTimeout(2500);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.setAuto(true, true); F.stagePress(); for (let i = 0; i < 90000 && !F.flags.dead && !F.flags.orbit; i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForTimeout(2500);
    const st = () => pg.evaluate(() => { const F = window.__game.F; return { released: !!F.released, ended: !!F.ended, endCard: !document.getElementById('end').classList.contains('hidden') }; });
    const rb = await rect('#relBtn'); ok(!!rb, `${vp} RELEASE is on screen at orbit`); if (!rb) { await pg.close(); continue; }
    await tap(rb.x, rb.y); await pg.waitForTimeout(120); await tap(rb.x, rb.y); await pg.waitForTimeout(2500);
    const s1 = await st(); ok(s1.released, `${vp} double tap released the payload`, s1);
    ok(!s1.endCard && !s1.ended, `${vp} a double tap on RELEASE does not end the flight`, s1);
    if (s1.endCard) { const k = await rect('Keep flying'); if (k) { await tap(k.x, k.y); await pg.waitForTimeout(1500); } }
    const cb = await rect('^CRAFT'); ok(!!cb, `${vp} CRAFT button on screen after release`); if (cb) { await tap(cb.x, cb.y); await pg.waitForTimeout(900); }
    const e = await rect('#relBtn'); if (e) { await tap(e.x, e.y); await pg.waitForTimeout(2500); }
    const s2 = await pg.evaluate(() => { const vis = b => { const r = b.getBoundingClientRect(); return r.width > 2 && !b.closest('.hidden') && getComputedStyle(b).visibility !== 'hidden'; }; return { end: !document.getElementById('end').classList.contains('hidden'), craftRows: [...document.querySelectorAll('button')].filter(b => /^(FLY|VIEW|FLYING)$/.test(b.textContent.trim()) && vis(b)).length }; });
    ok(s2.end, `${vp} End flight shows the end card`, s2); ok(s2.craftRows === 0, `${vp} the craft list closes when the end card opens (no FLY/VIEW rows over it)`, s2);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close();
  }
  await br.close(); console.log(`release_end_safe: ${n - bad}/${n} ok`); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
