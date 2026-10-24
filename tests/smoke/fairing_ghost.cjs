// Ghost nose cone smoke: fairing separation on a ship-type hero (no shell group) must spawn no half shells; on a rocket with a
// fairing it spawns exactly two. Usage: U=http://localhost:8931/ node tests/smoke/fairing_ghost.cjs [ids...]
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const U = process.env.U || 'http://localhost:8931/', ids = process.argv.slice(2).length ? process.argv.slice(2) : ['colossus-v4', 'heron-9-v11'];
const WANT = { 'colossus-v4': 0 };
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  for (const id of ids) { const pg = await br.newPage({ viewport: { width: 960, height: 540 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(U + '?noacademy&webgl', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading')); await pg.waitForTimeout(1000);
    await pg.evaluate(id => { const c = document.querySelector(`.pkC[data-m="${id}"]`); if (!c) throw new Error('no picker card ' + id); c.click(); window.__game.launch(); }, id); await pg.waitForTimeout(1500);
    // real ascent (AUTO) until the fairing separates itself, then count the half shells the separation spawned
    const n = await pg.evaluate(() => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true); for (let i = 0; i < 40000 && !F.flags.dead && !F.flags.fairing; i++) { F.realT += 0.02; F.step(0.02); } return F.flags.fairing ? G.fairHalves.length : -1; });
    const want = id in WANT ? WANT[id] : 2; ok(n === want, `${id}: fairing separation spawns ${n} half shells (want ${want})`); ok(!errs.length, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
