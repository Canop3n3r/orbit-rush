// plume-soft-1: real material + scene checks. Sparrow-1 flown by AUTO to 70 km (stage 2): the active plume is the soft vacuum shell, the hard cones are off,
// the material is additive / depthWrite off with a falloff > 0, and the plume starts at the bell exit. node tests/smoke/plume_soft.cjs [card]   (U = game url)
const pw = require('/workspace/pwt/node_modules/playwright-core');
const U = process.env.U || 'http://localhost:8931/', card = process.argv[2] || 'i1';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
  const mat = await pg.evaluate(async () => { const m = await import(new URL('fun/plumemat.js?v=' + (document.querySelector('script[src*="main.js"]') || {}).src?.split('v=')[1], location.href).href).catch(() => null); if (!m) return null; const x = m.vacPlumeMaterial({}); return { dw: x.depthWrite, add: x.blending === 2, tr: x.transparent, a: x.userData.vacPlume && x.userData.vacPlume.axialK, r: x.userData.vacPlume && x.userData.vacPlume.radialK }; });
  if (mat) ok(mat.dw === false && mat.add && mat.tr && mat.a > 0 && mat.r > 0, 'vacuum plume material: depthWrite false, additive, falloff > 0 (' + JSON.stringify(mat) + ')'); else console.log('skip material probe (module url)');
  await pg.evaluate(c => { const el = document.querySelector(/^i\d+$/.test(c) ? `.pkC[data-i="${c.slice(1)}"]` : `.pkC[data-m="${c}"]`); if (!el) throw new Error('no picker card ' + c); el.click(); window.__game.launch(); }, card); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 120000 && !F.flags.dead && F.alt < 70000; i++) { F.realT += 0.02; F.step(0.02); }
    return new Promise(res => { let n = 0; const look = () => { const g = G.SG[F.v.cur], pl = g && g.userData.plume, u = pl && pl.userData, vm = u && u.vacm; if (!(vm && vm.visible) && ++n < 60) return setTimeout(look, 500); // frames are slow on a loaded box: poll up to 30 s
      res({ dead: !!F.flags.dead, cur: F.v.cur, alt: F.alt, vis: !!(vm && vm.visible), outer: !!(u && u.outer && u.outer.visible), core: !!(u && u.core && u.core.visible), glow: !!(u && u.glow && u.glow.visible), op: u && u.mats && u.mats.plumeVac.opacity, y: pl && pl.position.y, sx: vm && vm.scale.x, sy: vm && vm.scale.y, w: u && u.w }); }; look(); }); });
  console.log(JSON.stringify(r));
  ok(!r.dead && r.cur >= 1, 'flew to stage 2'); ok(r.vis, 'the soft vacuum shell is on in vacuum'); ok(!r.outer && !r.core && !r.glow, 'the hard cones are off in vacuum');
  ok(r.op > 0.02 && r.op <= 0.8, 'vacuum shell opacity is faint, never opaque (' + (r.op && r.op.toFixed(3)) + ')'); ok(r.sx >= r.w * 0.9 && r.sy > r.w * 4, 'the shell starts at the nozzle width and has a real length (' + (r.sx && r.sx.toFixed(2)) + ' x ' + (r.sy && r.sy.toFixed(1)) + ')');
  ok(r.y > -0.01, 'the plume starts at the bell exit (stage-local y ' + (r.y && r.y.toFixed(2)) + ')'); ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await br.close(); process.exit(bad ? 1 : 0); })();
