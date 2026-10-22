// In-flight ground shots: pad + ~2/10/50/150 km on Earth, Moon, Mars. Usage: TAG=before|after BODY=moon node tools/flight_shots.cjs
// Needs a static server on :8931 at the repo root. Writes /workspace/shots/flight_<TAG>_<body>_<alt>.png
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const U = process.env.U || 'http://localhost:8931/', TAG = process.env.TAG || 'before', OUT = '/workspace/shots';
const ALTS = [2000, 10000, 50000, 150000];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); const log = [];
  for (const body of (process.env.BODY || 'earth,moon,mars').split(',')) {
    const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy' + (process.env.Q || ''), { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(3000);
    await pg.click('#hSite'); await pg.click(`#sitePick .spBodies button[data-b="${body}"]`); await pg.waitForTimeout(300);
    await pg.click(`#sitePick .spSites button[data-i="${body === 'earth' ? 1 : 0}"]`); await pg.click('#sitePick .spX'); if (body === 'earth') await pg.click('#hNext'); await pg.waitForTimeout(6000);
    await pg.screenshot({ path: `${OUT}/flight_${TAG}_${body}_pad.png` });
    await pg.click('#hFly'); await pg.waitForTimeout(1500);
    if (await pg.evaluate(() => !window.__game.F.ignited)) { await pg.keyboard.press('f'); await pg.keyboard.press('Space'); } await pg.waitForTimeout(2500); await pg.screenshot({ path: `${OUT}/flight_${TAG}_${body}_0km.png` });
    for (const a of ALTS) {
      const alt = await pg.evaluate(a => { const F = window.__game.F; for (let i = 0; i < 60000 && !F.flags.dead && F.alt < a; i++) { F.realT += 0.02; F.step(0.02); }
        if (F.alt < a * 0.8) { const r = F.v.r, L = Math.hypot(...r), k = (L - F.alt + a) / L; F.v.r = r.map(x => x * k); F.flags.dead = false; F.realT += 0.02; F.step(0.02); } /* past apoapsis: lift the craft radially for the shot */
        return F.alt; }, a);
      await pg.waitForTimeout(3500); await pg.screenshot({ path: `${OUT}/flight_${TAG}_${body}_${a / 1000}km.png` }); log.push(`${body} ${a / 1000}km -> ${(alt / 1000).toFixed(1)} km`);
    }
    const info = await pg.evaluate(() => window.__game.lod && window.__game.lod()); log.push(body + ' lod ' + JSON.stringify(info).slice(0, 300)); if (errs.length) log.push(body + ' errors ' + errs.slice(0, 3).join(' | ')); await pg.close();
  }
  console.log(log.join('\n')); await br.close(); })();
