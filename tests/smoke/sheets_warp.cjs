// f5.9-11 (QA f5.9-10): Atlas is short (collapsed rows, ≤60 words visible), Settings shows Units + Imperial on screen in phone landscape,
// every Settings / 📍 site-sheet target ≥40px, and key 0 at an apsis warps on to the next event (never "Nothing to warp to") at every size.
//   U=http://localhost:8960/ [VP=390x844,844x390,1280x800,1920x1080] node tests/smoke/sheets_warp.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', VPS = (process.env.VP || '390x844,844x390,1280x800,1920x1080').split(',');
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const vis = () => [...document.querySelectorAll('button,input,select,summary')].filter(e => { const r = e.getBoundingClientRect(); return (!e.checkVisibility || e.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) && r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(e).visibility !== 'hidden' && !e.closest('.hidden,#botBar,#topBar,#home'); });
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => window.__game.fun.openAtlas()); await pg.waitForTimeout(600);
    const at = await pg.evaluate(() => { const b = document.querySelector('#atlas .mbox'), t = b.innerText.trim().split(/\s+/).length, r = b.getBoundingClientRect(); return { words: t, closed: [...document.querySelectorAll('#atlas details.atl')].every(d => !d.open), x: !!document.querySelector('#atlasClose') }; });
    ok(at.words <= 60 && at.closed && at.x, `${vp} atlas: ${at.words} words visible (≤60), worlds collapsed ${at.closed}, ✕ ${at.x}`);
    await pg.evaluate(() => document.getElementById('atlasClose').click()); await pg.waitForTimeout(300);
    await pg.evaluate(() => { document.getElementById('hGear').click(); }); await pg.waitForTimeout(500); await pg.evaluate(() => { const b = [...document.querySelectorAll('#hGearM button')].find(b => /settings/i.test(b.textContent)); b && b.click(); }); await pg.waitForTimeout(800);
    const st = await pg.evaluate(vs => { const v = eval(vs)(), small = v.filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; }).map(e => (e.id || e.type) + ':' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)); const imp = document.querySelector('#settings input[value=imperial]'), q = imp && imp.getBoundingClientRect(); return { n: v.length, small, imp: !!q && q.top >= 0 && q.bottom <= innerHeight && q.height > 0 }; }, '(' + vis.toString() + ')');
    ok(!st.small.length, `${vp} settings: every target ≥40px (${st.n} controls) ${st.small.join(' ')}`); ok(st.imp, `${vp} settings: Imperial is on screen`);
    await pg.evaluate(() => { const c = document.querySelector('#settings .hx'); c && c.click(); }); await pg.waitForTimeout(400);
    await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /📍/.test(b.textContent) && b.offsetWidth); b && b.click(); }); await pg.waitForTimeout(800);
    const sp = await pg.evaluate(vs => eval(vs)().filter(e => e.closest('#sitePick')).filter(e => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 40; }).map(e => (e.id || e.textContent.trim().slice(0, 12)) + ':' + Math.round(e.getBoundingClientRect().height)), '(' + vis.toString() + ')');
    ok(!sp.length, `${vp} 📍 site sheet: every target ≥40px ${sp.join(' ')}`);
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1200);
    await pg.click('#hFly'); await pg.waitForTimeout(2500);
    const w = await pg.evaluate(async () => { const G = window.__game, F = G.F; F.setAuto(true, true); F.stagePress(); for (let i = 0; i < 90000 && !F.flags.orbit && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); } F.setAuto(false); F.v.ut = 0;
      const msgs = []; const o = F.toast.bind(F); F.toast = (m, c) => { msgs.push(m); return o(m, c); };
      const P = G.P, mu = P.muOf(F.v); const dt = P.timeToAp(F.v.r, F.v.v, mu); for (let t = 0; t < dt - 5; t += 0.5) { F.realT += 0.5; F.step(0.5); } /* coast to ~5 s before apoapsis */
      G.press('Digit0'); return { msgs, target: F.warpTarget ? F.warpTarget.label : null }; });
    ok(!w.msgs.some(m => /Nothing to warp/.test(m)) && !!w.target, `${vp} key 0 at apoapsis warps on (target ${w.target}; toasts ${JSON.stringify(w.msgs)})`);
    ok(!errs.length, `${vp} no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `sheets_warp: ${bad} FAIL` : 'sheets_warp: all ok'); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
