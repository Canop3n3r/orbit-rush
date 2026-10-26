// Craft switching in the real page (f6.2): launch, put the rocket in orbit, release the payload, switch to it with the keys, check the model and the list,
// power it off and on, switch back, view another craft, and screenshot every craft type. One browser, desktop size.
// Usage: U=http://localhost:8987/ SHOTS=/workspace/shots_craft node tests/smoke/craft_switch.cjs [type ...]
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const U = process.env.U || 'http://localhost:8987/', SHOTS = process.env.SHOTS || '/tmp/shots_craft';
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
(async () => { require('fs').mkdirSync(SHOTS, { recursive: true }); const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { n++; console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), pg = await ctx.newPage(); pg.setDefaultTimeout(120000); const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message)); pg.on('console', m => { const t = m.text(); if ((m.type() === 'error' || /\[Orbit Rush\]/.test(t)) && !/WebGL2|Effects:|lowering (effects|render)|GPU\/driver|No available|Failed to load resource|favicon|tiles/i.test(t)) errs.push(m.type() + ': ' + t.slice(0, 200)); });
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
  await pg.goto(U + '?noacademy&webgl&scenario=orbit&alt=300000', { waitUntil: 'domcontentloaded', timeout: 180000 }); await pg.waitForFunction(() => window.__game && !document.getElementById('boot'), null, { timeout: 120000 }).catch(() => {});
  await pg.evaluate(() => { const c = document.querySelector('.pkC[data-m="heron-9"]'); if (c) c.click(); window.__game.launch(); }); await pg.waitForTimeout(2500);
  const shot = async name => { await pg.waitForTimeout(700); await pg.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const S = () => pg.evaluate(() => { const F = window.__game.F; return { alt: F.alt, craft: F.v.craft ? F.v.craft.type : null, n: F.fleet.list.length, active: F.fleet.activeId, dead: F.flags.dead, hint: F.hint(), btn: !document.getElementById('craftBtn').classList.contains('hidden') }; });
  let s = await S(); ok(s.alt > 200000 && s.n === 1 && !s.craft, `orbit start: the rocket is vessel 1 (alt ${Math.round(s.alt / 1000)} km)`); ok(!s.btn, 'CRAFT button hidden with one vessel');
  await shot('01_rocket_in_orbit');
  await pg.evaluate(() => { const F = window.__game.F; F.releasePayload(); }); await pg.waitForFunction(() => !document.getElementById('craftBtn').classList.contains('hidden'), null, { timeout: 60000 }).catch(() => {}); s = await S(); ok(s.n === 2 && s.btn, 'payload released: two vessels and the CRAFT button shows');
  await shot('02_payload_released');
  await pg.keyboard.press('BracketRight'); await pg.waitForTimeout(900); s = await S(); ok(!!s.craft, `] switches to the payload (${s.craft})`); await shot('03_piloting_payload');
  const art = await pg.evaluate(() => { const G = window.__game; return { sg: G.SG ? G.SG.length : -1, kids: G.rocketG.children.length, vis: G.rocketG.visible, hero: !!G.hero }; }); ok(art.kids > 2 && art.vis && !art.hero, `the craft model replaced the rocket art (${JSON.stringify(art)})`);
  await pg.keyboard.press('Equal'); await pg.waitForTimeout(600); const rows = await pg.evaluate(() => [...document.querySelectorAll('#vsl .vr')].map(r => r.innerText.replace(/\n/g, ' | '))); ok(rows.length === 2 && /FLYING/.test(rows.join()), `the craft list shows both vessels: ${rows.join(' // ').slice(0, 220)}`); await shot('04_craft_list');
  await pg.click('#vsl .vr:not(.act) [data-a="view"]'); await pg.waitForTimeout(800); await shot('05_view_other'); await pg.click('#vsl .vr:not(.vw):not(.act) [data-a="view"]').catch(() => {});
  await pg.click('#vsl [data-a="close"]').catch(() => {});
  await pg.keyboard.press('Minus'); await pg.waitForTimeout(500); let pw0 = await pg.evaluate(() => window.__game.F.v.craft.power); ok(pw0 === false, 'the - key powers the craft off'); await shot('06_power_off');
  await pg.keyboard.press('Minus'); await pg.waitForTimeout(300); pw0 = await pg.evaluate(() => window.__game.F.v.craft.power); ok(pw0 === true, 'and on again');
  await pg.keyboard.press('BracketLeft'); await pg.waitForTimeout(900); s = await S(); ok(!s.craft && s.n === 2, 'back on the rocket stage with [');
  const art2 = await pg.evaluate(() => { const G = window.__game; return { sg: G.SG.length, hero: !!G.hero, cur: G.F.v.cur }; }); ok(art2.sg >= 1 && art2.hero, `the rocket art is back (${JSON.stringify(art2)})`); await shot('07_back_on_rocket');
  // every craft type: add one next to the rocket, switch, screenshot
  const types = process.argv.slice(2).length ? process.argv.slice(2) : await pg.evaluate(() => Object.keys(window.__craft.CRAFT_TYPES).filter(t => t !== 'stage'));
  for (const t of types) { const id = await pg.evaluate(t => { const G = window.__game, F = G.F, v = F.v; const o = F.fleet.add({ name: t, type: t, origin: false, r: v.r.map((x, i) => x + [20000, 0, 0][i]), v: v.v.slice(), t: F.tAbs, body: F.body, m: window.__craft.CRAFT_TYPES[t].mass, house: 'demo' }); return o.id; }, t);
    const sw = await pg.evaluate(id => window.__game.F.switchTo(id, true), id); await pg.waitForTimeout(800);
    await pg.evaluate(() => { const G = window.__game, F = G.F; F.v.ut = 1; F.step(0.02); F.step(0.02); }); await pg.waitForTimeout(500); await shot('type_' + t);
    s = await S(); ok(sw && s.craft === t && !s.dead, `type ${t}: switched, the model draws, no crash`); await pg.evaluate(() => { const F = window.__game.F; F.v.ut = 0; F.v.throttle = 0; F.switchTo(F.originId, true); }); await pg.waitForTimeout(300); await pg.evaluate(id => window.__game.F.fleet.remove(id), id); }
  ok(errs.length === 0, 'no page errors or [Orbit Rush] warnings' + (errs.length ? ': ' + errs.slice(0, 4).join(' || ') : ''));
  await br.close(); console.log(`${n - bad}/${n} ok`); process.exit(bad ? 1 : 0); })();
