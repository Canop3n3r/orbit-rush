// One parameterized screenshot tool (replaces the ~118 one-off *_shots.cjs scripts, archived in game-studio/orbit-rush/archive/shots_scripts/).
// Usage: node tools/shots.cjs [--url U] [--vp 390x844,844x390] [--states home,atlas,settings,fly+wait:20] [--out DIR] [--query 'noacademy&fx=low']
//   A state is steps joined by '+': home | atlas | settings | fly | wait:SEC | tap:CSS | key:KEY | eval:JS | rocket:ID (sets ?rocket=ID before load)
//   Output: DIR/<state>_<WxH>.png plus DIR/index.json (page errors per shot). One browser, one page at a time.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const a = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL = a('url', process.env.U || 'https://canop3n3r.github.io/orbit-rush/'), VPS = a('vp', '390x844,844x390').split(','),
  STATES = a('states', 'home').split(','), OUT = a('out', '/workspace/shots/tool'), Q = a('query', 'noacademy&fx=low');
const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
const NAMED = { home: [], atlas: ['tap:#hAtlasB', 'wait:1.5'], settings: ['tap:#hGear', 'wait:1.5'], fly: ['tap:#hFly', 'wait:3'] };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const index = [];
  for (const vp of VPS) for (const st of STATES) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const steps = st.split('+').flatMap(s => NAMED[s] || [s]); const rk = steps.find(s => s.startsWith('rocket:'));
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
    await pg.goto(URL + '?' + Q + (rk ? '&rocket=' + rk.slice(7) : '')); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
    for (const s of steps) { const [k, ...r] = s.split(':'); const v = r.join(':');
      if (k === 'wait') await pg.waitForTimeout(+v * 1000);
      else if (k === 'tap') { const p = await pg.evaluate(q => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, v);
        if (!p) errs.push('no element ' + v); else if (touch) await pg.touchscreen.tap(...p); else await pg.mouse.click(...p); }
      else if (k === 'key') await pg.keyboard.press(v); else if (k === 'eval') await pg.evaluate(v); }
    const f = `${OUT}/${st.replace(/[^\w.-]+/g, '_')}_${vp}.png`; await pg.screenshot({ path: f }); index.push({ file: f, vp, state: st, errors: errs }); console.log(f, errs.length ? 'ERR ' + errs[0] : ''); await pg.close(); }
  fs.writeFileSync(OUT + '/index.json', JSON.stringify(index, null, 1)); await br.close(); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
