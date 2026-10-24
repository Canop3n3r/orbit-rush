// Payload smoke (rockets-pass-1): (1) after a real fairing separation the model's payload mesh is visible on the upper stage,
// (2) RELEASE flies off that SAME object (no new mesh pops in). Usage: U=http://localhost:8931/ node tests/smoke/payload_release.cjs [ids...]
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8931/', ids = process.argv.slice(2).length ? process.argv.slice(2) : ['heron-9-v11', 'colossus-v4'];
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
    await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2000);
    const A = await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 40000 && !F.flags.dead && !F.flags.fairing; i++) { F.realT += 0.02; F.step(0.02); }
      G.syncStages && G.syncStages(); const st = G.hero && G.hero.userData.stages, sat = st && st.sat; let vis = !!sat; for (let o = sat; o; o = o.parent) if (!o.visible) vis = false;
      return { fairing: !!F.flags.fairing, has: !!sat, vis, uuid: sat && sat.uuid, onHero: (() => { for (let o = sat; o; o = o.parent) if (o === G.hero) return true; return false; })(), rel: F.canRelease && F.canRelease() }; });
    ok(A.fairing, `${id}: real ascent reaches fairing separation`); ok(A.has && A.vis && A.onHero, `${id}: payload mesh is visible on the upper stage after the fairing is gone (has=${A.has} vis=${A.vis})`);
    const B = await pg.evaluate(async uuid => { const G = window.__game, F = G.F; if (!F.canRelease()) { F.placeInOrbit(170000); G.syncStages(); }
      const sat0 = G.hero.userData.stages.sat; const u0 = sat0.uuid; document.getElementById('relBtn').click(); await new Promise(r => setTimeout(r, 600));
      const sv = G.satVis; return { u0, same: !!sv && sv.sat.uuid === u0, left: (() => { for (let o = sv && sv.sat; o; o = o.parent) if (o === G.hero) return false; return !!sv; })(), gone: true }; });
    ok(B.same, `${id}: RELEASE flies off the model's own payload mesh (same object, no pop-in)`); ok(B.left && B.gone, `${id}: the payload left the stage`); ok(!errs.length, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
