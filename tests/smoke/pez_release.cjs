// legs-fins-1: Colossus slot dispenser in the game. Before RELEASE the door is shut and every satellite is inside the hull;
// RELEASE opens the door and the satellites slide out one by one; then the payload flies on. Frames: SHOTS=dir to save PNGs.
// Usage: U=http://localhost:PORT/ [ID=colossus-v3] [SHOTS=/workspace/shots] node tests/smoke/pez_release.cjs
const fs = require('fs'), path = require('path'); const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8959/', [W, H] = (process.env.VP || '390x844').split('x').map(Number), touch = Math.min(W, H) < 700;
const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'rockets', 'index.json'), 'utf8'));
const ID = process.env.ID || 'titan-ss-v3', SH = process.env.SHOTS;
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const ctx = await br.newContext({ viewport: { width: W, height: H } }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  try { await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } }); await pg.goto(U + '?noacademy&webgl'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 });
    await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`) || document.querySelector(`.pkC[data-th="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, ID); await pg.waitForTimeout(4000);
    await pg.evaluate(() => { const F = window.__game.F || window.__game.flight(); F.setAuto(true, true); if (!F.ignited) F.stagePress(); });
    await pg.evaluate(() => { const G = window.__game, F = G.F || G.flight(); for (let i = 0; i < 2000 / 0.02 && !F.flags.dead && !F.flags.orbit; i++) { F.realT += 0.02; F.step(0.02); } for (let k = 0; k < 100; k++) { F.realT += 0.02; F.step(0.02); } G.syncStages && G.syncStages(); });
    await pg.waitForTimeout(2500);
    const probe = () => pg.evaluate(() => { const G = window.__game, h = G.hero; if (!h) return null; const lv = (h.levels || [{ object: h }]).map(l => l.object).find(o => o.visible && o.userData.bayTime) || (h.levels || [{ object: h }]).map(l => l.object).find(o => o.userData.bayTime); if (!lv) return { none: true };
      const st = lv.userData.stages || {}, sats = st.sat ? st.sat.children.filter(c => /^sat_/.test(c.name)) : [], R = 4.5; let reach = 0, out = 0;
      for (const s of sats) { const z = s.position.z, w = s.userData.r || 2; reach = Math.max(reach, Math.hypot(w, Math.abs(z) + w)); if (Math.abs(z) > R) out++; }
      return { door: +(st.bay ? st.bay.rotation.x : NaN).toFixed(3), n: sats.length, reach: +reach.toFixed(2), out, released: !!(G.F || G.flight()).released, satVis: !!G.satVis, onShip: !!(st.sat && st.sat.parent) }; });
    const p0 = await probe(); ok(p0 && !p0.none && p0.n >= 1, `${ID}: slot dispenser present ${JSON.stringify(p0)}`);
    ok(p0 && p0.door === 0 && p0.reach < 4.5 && p0.out === 0, `${ID}: before RELEASE the door is shut and every satellite is inside the hull ${JSON.stringify(p0)}`);
    if (SH) await pg.screenshot({ path: `${SH}/legsfins_pezrel_0.png` });
    await pg.evaluate(() => { const F = window.__game.F || window.__game.flight(); F.releasePayload(); });
    let maxDoor = 0, maxOut = 0, last = null; for (let t = 1; t <= 20; t++) { await pg.waitForTimeout(1000); const p = await probe(); last = p; if (p && !p.none) { maxDoor = Math.max(maxDoor, Math.abs(p.door || 0)); maxOut = Math.max(maxOut, p.out); } if (SH && t % 3 === 0) await pg.screenshot({ path: `${SH}/legsfins_pezrel_${t}.png` }); console.log('  t+' + t + 's ' + JSON.stringify(p)); }
    ok(maxDoor > 1, `${ID}: RELEASE opens the slot door (max |rot| ${maxDoor})`); ok(maxOut >= 1, `${ID}: satellites slide out through the slot (max outside ${maxOut})`);
    ok(last && last.released && last.satVis, `${ID}: payload flies on after the slot sequence ${JSON.stringify(last)}`);
  } catch (e) { ok(false, `${ID}: ${e.message.slice(0, 200)}`); }
  ok(errs.length === 0, `${ID}: no page errors ${errs.slice(0, 2).join(' | ')}`); await ctx.close(); console.log(`pez_release: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
