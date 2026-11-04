// f5.9-20 (owner: "every time I try to fly the super-heavy rockets the game just freezes"): fly rockets from the catalog for a few
// seconds on the WebGPU backend (the iPhone Safari path; swiftshader Vulkan here) and fail on a page error, a WebGPU validation error
// (an invalid pipeline drops every frame after it: the freeze), or a flight clock that stops.
//   U=http://localhost:8960/ [ALL=1 every rocket; default: the stacked super-heavies + every 4th] [VP=390x844] node tests/smoke/fly_all.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--no-sandbox', '--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-webgpu-adapter=swiftshader', '--use-vulkan=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://localhost:8960/', [W, H] = (process.env.VP || '390x844').split('x').map(Number), HEAVY = /colossus|super lift|saturnine|moonhammer|mogutny|new glendale|heavy/i;
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { if (!t || process.env.V) console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; n++; };
  const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: W < H, hasTouch: W < H }); pg.setDefaultTimeout(120000); let errs = [];
  pg.on('pageerror', e => errs.push('PE ' + e.message)); pg.on('console', m => { const t = m.text(); if (m.type() === 'error' || /Invalid (RenderPipeline|CommandBuffer|ShaderModule|BindGroup)|While validating|is not present in the VertexState/.test(t)) errs.push(t.slice(0, 160)); });
  await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) { } });
  await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(2000);
  const names = await pg.evaluate(() => [...document.querySelectorAll('#picker .pkC')].map(c => (c.querySelector('b') || {}).textContent || '').map(s => s.trim()));
  const pick = process.env.ALL ? names.map((_, i) => i) : names.map((s, i) => i).filter(i => HEAVY.test(names[i]) || i === 0);
  for (const i of pick) { errs = [];
    const r = await Promise.race([pg.evaluate(async i => { const G = window.__game, c = document.querySelectorAll('#picker .pkC')[i]; if (!c) return { skip: 1 }; c.click(); await new Promise(r => setTimeout(r, 900));
      document.getElementById('hFly').click(); await new Promise(r => setTimeout(r, 2000)); if (G.state !== 'flight') return { state: G.state };
      if (!G.F.ignited) G.press('Space'); const c0 = G.F.v.clock; await new Promise(r => setTimeout(r, 2500)); const c1 = G.F.v.clock;
      return { state: G.state, ign: !!G.F.ignited, dt: +(c1 - c0).toFixed(2) }; }, i), new Promise(r => setTimeout(() => r({ hang: 1 }), 60000))]).catch(e => ({ err: e.message }));
    if (r.skip) continue; const nm = names[i];
    ok(!r.hang && !r.err, `${nm}: page answers (no hang) ${r.err || ''}`); ok(r.state === 'flight', `${nm}: Fly opens the flight (${r.state})`); ok(r.dt > 0.5, `${nm}: the flight clock runs (${r.dt} s)`); ok(!errs.length, `${nm}: no page or WebGPU errors ${errs.slice(0, 2).join(' | ')}`);
    if (r.hang) break; await pg.evaluate(() => window.__game.goHome()).catch(() => { }); await pg.waitForTimeout(1500); }
  await br.close(); console.log(bad ? `fly_all: ${bad} FAIL of ${n}` : `fly_all: all ok (${n})`); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
