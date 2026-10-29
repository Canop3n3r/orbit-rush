// QA f5.9-9: every staged (Blender) rocket on AUTO must reach orbit, drop its stage meshes, split the fairing into 2 halves, and offer a
// tappable RELEASE once in orbit (payload deployable without a hidden extra STAGE). Then a real tap on RELEASE must release the payload.
// Red on f5.9-9 (dfd186de) for electrino: AUTO parks with the near-empty kick stage attached and RELEASE only appears after a manual STAGE.
// Usage: U=http://localhost:8959/ [VP=390x844] node tests/smoke/staged_deploy.cjs [ids...]   (default: every enabled rocket in assets/rockets/index.json)
const fs = require('fs'), path = require('path'); const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8959/', [W, H] = (process.env.VP || '390x844').split('x').map(Number), touch = Math.min(W, H) < 700;
const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'rockets', 'index.json'), 'utf8'));
let ids = process.argv.slice(2); if (!ids.length) ids = Object.entries(idx.rockets).filter(([, v]) => v.enabled).map(([k]) => k);
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const ctx = await br.newContext({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }), pg = await ctx.newPage(); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    try { await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } }); await pg.goto(U + '?noacademy&webgl'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(1000);
      await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`) || document.querySelector(`.pkC[data-th="${id}"]`); /* house rockets (heron) are data-i cards */ if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { const F = window.__game.F; F.setAuto(true, true); if (!F.ignited) F.stagePress(); });
      const r = await pg.evaluate(() => { const G = window.__game, F = G.F; let i = 0; for (; i < 2000 / 0.02 && !F.flags.dead && !F.flags.orbit; i++) { F.realT += 0.02; F.step(0.02); } for (let k = 0; k < 100; k++) { F.realT += 0.02; F.step(0.02); } G.syncStages && G.syncStages(); return { orbit: !!F.flags.orbit, dead: F.flags.dead || null, cur: G.v.cur, n: G.v.stages.length, halves: G.fairHalves ? G.fairHalves.length : 0, crew: !F.payloadParts().length }; });
      await pg.waitForTimeout(2500);
      ok(r.orbit && !r.dead, `${id}: AUTO reaches orbit ${JSON.stringify(r)}`); ok(r.cur >= 1, `${id}: at least one stage dropped (cur ${r.cur}/${r.n})`); ok(r.halves === 2, `${id}: fairing split into 2 halves (${r.halves})`);
      if (r.crew) { ok(true, `${id}: crew capsule (no payload to RELEASE; STAGE separates it)`); await ctx.close(); continue; }
      const rel = await pg.evaluate(() => { const e = document.getElementById('relBtn'); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 1 && getComputedStyle(e).visibility !== 'hidden' && b.bottom <= innerHeight && b.top >= 0 ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; });
      ok(!!rel, `${id}: RELEASE is on screen in orbit without an extra STAGE (stage ${r.cur + 1}/${r.n} still attached)`);
      if (rel) { if (touch) await pg.touchscreen.tap(rel.x, rel.y); else await pg.mouse.click(rel.x, rel.y); await pg.waitForTimeout(1500); ok(await pg.evaluate(() => !!window.__game.F.released), `${id}: a real tap on RELEASE releases the payload`); }
    } catch (e) { ok(false, `${id}: ${e.message.slice(0, 160)}`); }
    ok(errs.length === 0, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await ctx.close(); }
  console.log(`staged_deploy: ${n - bad}/${n} pass`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
