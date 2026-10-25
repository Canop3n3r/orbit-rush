// Plume comparison shots: a rocket on the pad (sea level) and lifted to vacuum, engines lit, chase camera looking at the base.
// Usage: TAG=before|after U=http://localhost:8931/ node tools/plume_shots.cjs [id[:upper][@cameraDistanceM] ...]   (':upper' = fly to space and stage to the next stage)
// Writes /workspace/shots_plume/<TAG>_<id>_<sea|vac>.png. Needs a static server on the repo root. One browser at a time.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8931/', TAG = process.env.TAG || 'after', OUT = process.env.OUT || '/workspace/shots_plume';
const cases = process.argv.slice(2).length ? process.argv.slice(2) : ['sparrow-1', 'heron-9', 'colossus-v4', 'tsurugi', 'hoshi-v'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU });
  for (const c of cases) { const [c0, dd] = c.split('@'), [id, mode] = c0.split(':'), DIST = +(dd || process.env.DIST || 60);
    const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
    const shot = async (name, alt) => { const info = await pg.evaluate(async alt => { const F = window.__game.F; const step = n => { for (let i = 0; i < n; i++) { F.realT += 0.02; F.step(0.02); } };
        if (alt) { const r = F.v.r, L = Math.hypot(...r), k = (L - F.alt + alt) / L; F.v.r = r.map(x => x * k); F.flags.dead = false; }
        if (!F.ignited) F.stagePress(); F.v.ut = 1; step(alt ? 60 : 150); const G = window.__game; const L = G.rocketG ? 1 : 0; return { alt: Math.round(F.alt), thr: +F.v.throttle.toFixed(2), cur: F.v.cur }; }, alt);
      await pg.evaluate(([DIST, AIM]) => window.__game.camSet(0.9, 0.04, DIST, AIM), [DIST, +(process.env.AIM || -0.12)]); await pg.waitForTimeout(3000); await pg.screenshot({ path: `${OUT}/${TAG}_${id}${mode ? '_' + mode : ''}_${name}.png` }); console.log(id, name, JSON.stringify(info)); };
    try {
      await pg.evaluate(id => { const k = document.querySelector(`.pkC[data-m="${id}"]`); if (!k) throw new Error('no picker card ' + id); k.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2000);
      if (mode === 'upper') { await pg.evaluate(() => { const F = window.__game.F; if (!F.ignited) F.stagePress(); F.v.ut = 1; const r = F.v.r, L = Math.hypot(...r), k = (L - F.alt + 130000) / L; F.v.r = r.map(x => x * k); for (let i = 0; i < 200; i++) { F.realT += 0.02; F.step(0.02); } for (let q = 0; q < 6 && F.v.cur < 1; q++) { F.stagePress(); for (let i = 0; i < 40; i++) { F.realT += 0.02; F.step(0.02); } } F.v.ut = 1; });
        await shot('vac', 0); }
      else { await shot('sea', 0); await shot('vac', 200000); }
    } catch (e) { console.log('ERR', id, e.message); }
    if (errs.length) console.log(id, 'page errors', errs.slice(0, 3).join(' | ')); await pg.close(); }
  await br.close(); })();
