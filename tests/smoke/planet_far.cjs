// f6.4 far-planet smoke: a planet must stay opaque, lit and star-free from the surface out to the whole solar system.
// For each body x altitude the craft is placed on the Sun side of the body, the camera looks at the body centre and three
// frames are read back (UI hidden): normal, planet+cloud hidden, stars hidden. Inside the planet disc:
//   covered  = share of pixels that change when the planet is hidden   (the planet is drawn at all)      >= 0.9
//   starHole = share of pixels that change when the stars are hidden and are not drifting clouds (sky painted over the planet)    <= 0.02
//   lum      = mean luminance (0..255), the lit side must not be black                                    >= 25
// Usage: U=http://localhost:8964/ OUT=dir [BODIES=earth,moon,...] [ALTS=1000,10000,...] node tests/smoke/planet_far.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8964/', OUT = process.env.OUT || '/tmp/planetfar';
const BODIES = (process.env.BODIES || 'earth,moon,mars,venus,jupiter').split(',');
const ALTS = (process.env.ALTS || '1000,10000,30000,60000,100000,200000,400000').split(',').map(Number); // km above the surface
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const br = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: GPU }); let bad = 0; const rows = [];
  const pg = await br.newPage({ viewport: { width: 640, height: 360 } }); pg.setDefaultTimeout(180000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
  await pg.goto(URL + '?noacademy&fx=low&sun=day'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1500);
  await pg.click('#hFly'); await pg.waitForTimeout(3000);
  await pg.evaluate(async () => { // hide every DOM overlay so the screenshot is the canvas only
    const st = document.createElement('style'); st.textContent = 'html body > :not(canvas):not(#zz1):not(#zz2):not(#zz3){display:none !important}'; document.head.append(st);
    const { BODIES } = await import(new URL('physics/solar.js', location.href).href); window.__pf = { mode: 'normal', R: id => BODIES[id].R };
    window.__camHook = cam => { const G = window.__game, s = G.scn, F = G.flight(), m = window.__pf.mode, id = F.body, T = new s.camera.position.constructor();
      if (id === 'earth') s.earth.getWorldPosition(T); else T.copy(s.bodyG.position);
      const hide = m === 'noplanet'; if (id === 'earth') { s.earth.visible = !hide; if (s.W1 && hide) s.W1.g.visible = false; } else s.bodyG.visible = !hide;
      s.stars.visible = m !== 'nostars'; cam.up.set(0, 0, 1); cam.lookAt(T); cam.updateMatrixWorld();
      const d = cam.position.distanceTo(T), Rb = window.__pf.R(id), tanA = Math.tan(Math.asin(Math.min(1, Rb / d)));
      { const fov = Math.max(1.5, Math.min(55, 2 * Math.atan((innerHeight / 2) * tanA / 60) * 180 / Math.PI)); /* tele view so a far disc is >= ~60 px (the game's own view is 55 deg) */ if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); } }
      const f = (innerHeight / 2) / Math.tan(cam.fov * Math.PI / 360), p = T.clone().project(cam);
      window.__pf.disk = { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, r: f * tanA, d, id }; };
  });
  const frames = n => pg.evaluate(n => new Promise(r => { let k = 0; const f = () => (++k > n ? r() : requestAnimationFrame(f)); f(); }), n); // slow software GL: wait in rendered frames, not ms
  const grab = async mode => { await pg.evaluate(m => { window.__pf.mode = m; }, mode); await frames(3); return pg.screenshot(); };
  const analyse = async (a, b, c, a2) => pg.evaluate(async ([a, b, c, a2]) => {
    const dk = window.__pf.disk, load = async s => { const bm = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob()), cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0); return x.getImageData(0, 0, bm.width, bm.height).data; };
    const A = await load(a), B = await load(b), C = await load(c), A2 = await load(a2), W = innerWidth, H = innerHeight, k = A.length / 4 / (W * H) ** 1, sc = Math.sqrt(A.length / 4 / (W * H)); void k;
    let n = 0, cov = 0, hole = 0, lum = 0; const r = dk.r * 0.85 * sc, cx = dk.x * sc, cy = dk.y * sc, w = W * sc, h = H * sc;
    for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++) { if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const i = (y * w + x) * 4; n++;
      const dd = (P, Q) => Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) + Math.abs(P[i + 2] - Q[i + 2]); if (dd(A, B) > 36) cov++; if (dd(A, C) > 36 && dd(A2, C) > 36 && dd(A, A2) <= 36) hole++; /* drifting clouds change between frames; only a static sky pasted over the planet counts */ lum += 0.2126 * A[i] + 0.7152 * A[i + 1] + 0.0722 * A[i + 2]; }
    return { n, covered: n ? cov / n : 0, starHole: n ? hole / n : 0, lum: n ? lum / n : 0, r: dk.r, d: dk.d };
  }, [a.toString('base64'), b.toString('base64'), c.toString('base64'), a2.toString('base64')]);
  for (const body of BODIES) {
    await pg.evaluate(id => { const F = window.__game.flight(); F.v.clamped = false; F.ignited = true; F.checkSOI = () => false; /* the test parks the craft outside the SOI on purpose */ F.v.body = id; F.v._g = null; F.v.v = [0, 0, 0]; }, body); await frames(4);
    const { BR } = await pg.evaluate(() => ({ BR: window.__pf.R(window.__game.flight().body) }));
    for (const alt of ALTS) {
      await pg.evaluate(([alt, BR]) => { const F = window.__game.flight(), s = window.__game.scn.sunDirV, d = BR + alt * 1000; F.v.r = [s.x * d, s.y * d, s.z * d]; F.v.v = [0, 0, 0]; F.flags.dead = false; window.__game.camSet(0, 0.3, 60); }, [alt, BR]);
      await frames(4);
      const a = await grab('normal'), b = await grab('noplanet'), c = await grab('nostars'), a2 = await grab('normal'), r = await analyse(a, b, c, a2); r.body = body; r.alt = alt;
      const ok = r.n > 20 ? r.covered >= 0.9 && r.starHole <= 0.02 && r.lum >= 25 : null; rows.push({ ...r, ok });
      require('fs').writeFileSync(`${OUT}/${body}_${alt}.png`, a); if (process.env.DUMP) { require('fs').writeFileSync(`${OUT}/${body}_${alt}_nostars.png`, c); require('fs').writeFileSync(`${OUT}/${body}_${alt}_noplanet.png`, b); }
      console.log((ok === null ? 'skip ' : ok ? 'ok   ' : 'FAIL ') + `${body} alt ${alt} km: disc r=${r.r.toFixed(1)}px covered ${(r.covered * 100).toFixed(0)}% starHole ${(r.starHole * 100).toFixed(1)}% lum ${r.lum.toFixed(0)}`);
      if (ok === false) bad++;
    }
  }
  console.log('page errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none')); if (errs.length) bad++;
  require('fs').writeFileSync(`${OUT}/table.json`, JSON.stringify(rows, null, 1)); await br.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
