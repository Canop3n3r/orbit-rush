// Terrain/ocean hand-off (f5.9 terrain): the 150 km ground tile must fade into the globe, no round edge at any altitude.
// Shoots the flight view at 0,1,5,20,44,100,200,400 km on a desktop and a phone viewport and reports, per shot, the strongest
// luminance step along a ring of the screen (a hard circular tile edge shows up as a big step between neighbouring pixels).
// Usage: U=http://localhost:8971/ OUT=/workspace/shots_terrain/after node tests/smoke/terrain_blend.cjs [alts_km...]
// Needs python3 + PIL for the pixel analysis (tests/smoke/terrain_edge.py).
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'), { execFileSync } = require('child_process'), path = require('path');
const U = process.env.U || 'http://localhost:8971/', OUT = process.env.OUT || '/tmp/terrain_blend', MAXSTEP = +(process.env.MAXSTEP || 0.10);
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const ALTS = process.argv.slice(2).length ? process.argv.slice(2).map(Number) : [0, 1, 5, 20, 44, 100, 200, 400];
const VIEWS = process.env.VIEWS ? process.env.VIEWS.split(',') : ['1280x800', '390x844'];
(async () => { require('fs').mkdirSync(OUT, { recursive: true }); const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0;
  const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const vs of VIEWS) { const [w, h] = vs.split('x').map(Number), phone = w < 500;
    const ctx = await br.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); pg.errs = [];
    pg.on('pageerror', e => pg.errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl' + (process.env.GFX ? '&gfx=' + process.env.GFX : ''), { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'));
    await pg.evaluate(() => window.__game.launch()); await pg.waitForTimeout(2500);
    for (const km of ALTS) {
      await pg.evaluate(([km, PITCH, OFFS]) => { const G = window.__game, F = G.F; if (km > 0) { F.placeInOrbit(km * 1000); const v = F.v, r = Math.hypot(...v.r), sp = Math.hypot(...v.v), th = G.P.OMEGA_E * (v.clock || 0) + (OFFS !== null ? OFFS : km <= 5 ? 0 : 0.012) /* over the pad up to 5 km, else ~75 km downrange of it */; v.r = [r * Math.cos(th), r * Math.sin(th), 0]; v.v = [-sp * Math.sin(th), sp * Math.cos(th), 0]; }
        F.advance = () => 0; F.flags.dead = false; // frozen: the shot is of the render at this altitude, not of the flight
        for (const e of document.body.children) if (!e.querySelector('canvas') && e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; G.camSet(0.0, km <= 1 ? 0.3 : PITCH, km > 5 ? 600 : km > 1 ? 300 : km > 0 ? 200 : 60); }, [km, +(process.env.PITCH || 1.15), process.env.OFFS ? +process.env.OFFS : null]);
      await pg.waitForTimeout(3500);
      const f = path.join(OUT, `${vs}_${String(km).padStart(3, '0')}km.png`); await pg.screenshot({ path: f });
      // A/B: the same frame with the near-field tile forced off. Where the tile has faded out (high altitude) the two must match; the tile must never "pop".
      const has = await pg.evaluate(() => typeof window.__game.tileOff === 'function'); if (!has) { console.log(`shot ${f}`); continue; }
      await pg.evaluate(() => window.__game.tileOff(true)); await pg.waitForTimeout(1200); const g = f.replace('.png', '_notile.png'); await pg.screenshot({ path: g }); await pg.evaluate(() => window.__game.tileOff(false));
      let res; try { res = JSON.parse(execFileSync('python3', [path.join(__dirname, 'terrain_edge.py'), f, g], { encoding: 'utf8' })); } catch (e) { res = { diff: 9, err: String(e).slice(0, 80) }; }
      const st = await pg.evaluate(() => window.__game.tileFadeInfo()); const hi = km >= 70;
      ok(!hi || (!st.vis && res.diff <= 0.02), `${vs} ${km} km: tile ${hi ? 'is switched off and the frame matches the globe-only frame (differs in ' + (res.diff * 100).toFixed(2) + '% of pixels)' : 'alpha ' + st.alt.toFixed(2) + ', rim alpha ' + st.rim.toFixed(2) + ', differs in ' + (res.diff * 100).toFixed(1) + '% of pixels'}`);
      ok(st.rim <= 0.001, `${vs} ${km} km: rim alpha ${st.rim.toFixed(3)} (the tile edge is fully faded)`);
    }
    ok(pg.errs.length === 0, `${vs}: no page errors ${pg.errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  console.log(`terrain_blend: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
