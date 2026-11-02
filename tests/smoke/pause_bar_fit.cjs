// QA f5.9-18 (Playtest QA Bot): the 🐞 Bug button made 8 Pause buttons; at 390x844 they overflowed (▶ Resume at x=-9 and 🐞 Bug past the right
// edge, 5 labels clipped). Checks every Pause button is fully on screen, its label is not clipped and it stays >=44x40, at 390x844, 360x780
// and 844x390; no page errors. Backend blocked (never sends).
//   U=http://localhost:8960/ [VP=390x844,360x780,844x390] [OUT=/tmp/pause_bar_fit] node tests/smoke/pause_bar_fit.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const fs = require('fs');
const GPU = ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox'];
const U = process.env.U || 'http://localhost:8960/', OUT = process.env.OUT || '/tmp/pause_bar_fit', VPS = (process.env.VP || '390x844,360x780,844x390').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; fs.mkdirSync(OUT, { recursive: true }); const errs = [];
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(300000); pg.on('pageerror', e => errs.push(vp + ': ' + e.message)); await pg.route(/supabase\.co/, r => r.abort());
    await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
    await pg.goto(U + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => document.getElementById('hFly').click()); await pg.waitForTimeout(2500);
    await pg.evaluate(() => window.__game.press('Escape')); await pg.waitForTimeout(1200);
    const r = await pg.evaluate(() => { const bs = [...document.querySelectorAll('#pause .mbox>.col button')].filter(b => b.offsetWidth > 0);
      return bs.map(b => { const r = b.getBoundingClientRect(); return { t: b.innerText.replace(/\s+/g, ' ').trim(), x: Math.round(r.left), r: Math.round(r.right), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), clip: b.scrollWidth > b.clientWidth + 1 }; }); });
    const off = r.filter(b => b.x < 0 || b.r > W), clip = r.filter(b => b.clip), small = r.filter(b => b.w < 44 || b.h < 40);
    const okk = r.length >= 8 && !off.length && !clip.length && !small.length; if (!okk) bad++;
    console.log((okk ? 'ok   ' : 'FAIL ') + `${vp}: ${r.length} pause buttons; off-screen [${off.map(b => b.t).join(', ')}]; text clipped [${clip.map(b => b.t).join(', ')}]; <44x40 [${small.map(b => b.t + ' ' + b.w + 'x' + b.h).join(', ')}]`);
    console.log('     ' + r.map(b => `${b.t}@${b.x},${b.y} ${b.w}x${b.h}`).join(' | '));
    await pg.screenshot({ path: `${OUT}/pausebar_${vp}.png` }); await pg.close(); }
  if (errs.length) { bad++; console.log('FAIL page errors ' + errs.slice(0, 2).join(' | ')); } await br.close(); console.log(bad ? `pause_bar_fit: ${bad} FAIL` : 'pause_bar_fit: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
