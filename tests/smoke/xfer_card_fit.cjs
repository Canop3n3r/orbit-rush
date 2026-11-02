// QA f5.9-14 (Playtest QA Bot): the 🎯 transfer planner card is capped at 35dvh. On a 844x390 phone in landscape that is 136 px, so the sticky
// action row covered the Moon/Mars/Venus chips and hid the verdict line (live f5.9-14). Checks, Moon preselected, at each size:
// portrait: card ≤35% of the screen height; every size: chips, verdict and ▶ Launch on AUTO fully inside the card's visible box and not covered,
// card area ≤40% of the screen, no page errors.   U=http://localhost:8960/ [VP=390x844,844x390,1280x800] node tests/smoke/xfer_card_fit.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hXfer').click()); await pg.waitForTimeout(6000);
    const m = await pg.evaluate(() => { const box = document.querySelector('#xferPlan .xp-box'), b = box.getBoundingClientRect();
      const vis = sel => { const e = document.querySelector('#xferPlan ' + sel); if (!e) return { sel, found: false }; const r = e.getBoundingClientRect(); const inBox = r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.width > 0;
        const x = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2, h = document.elementFromPoint(x, y); return { sel, inBox, top: !!h && (e === h || e.contains(h)), r: [Math.round(r.top), Math.round(r.bottom)] }; };
      return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], hPct: +(100 * b.height / innerHeight).toFixed(1), aPct: +(100 * b.width * b.height / innerWidth / innerHeight).toFixed(1),
        on: [...document.querySelectorAll('#xferPlan .xp-chips .on')].map(e => e.textContent.trim()), parts: [vis('.xp-chips button'), vis('.xp-verdict'), vis('.xp-auto')] }; });
    console.log('     ' + vp + ' ' + JSON.stringify(m));
    ok(/Moon/.test(m.on.join()), `${vp} Moon is preselected`);
    if (H > W) ok(m.hPct <= 35.5, `${vp} card ≤35% of the screen height (${m.hPct}%)`);
    ok(m.aPct <= 40, `${vp} card covers ≤40% of the screen (${m.aPct}%)`);
    ok(m.parts[0].r && m.parts[2].r && m.parts[0].r[1] <= m.parts[2].r[0], `${vp} chips end above the action row (chips ${m.parts[0].r}, actions ${m.parts[2].r})`);
    for (const p of m.parts) ok(p.found !== false && p.inBox && p.top, `${vp} ${p.sel} fully visible inside the card and not covered ${JSON.stringify(p)}`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(`xfer_card_fit: ${bad ? 'FAILED ' + bad : 'all ok'}`); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
