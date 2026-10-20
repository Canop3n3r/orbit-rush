// f5.2.1 memory smoke (Chrome crash hotfix): load, picker scroll, N rocket swaps, mission card, one AUTO flight; geometries/textures/heap capped.
// Usage: U=http://localhost:8899/ W=1280 H=800 node tests/smoke/memory.cjs
const { chromium } = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist','--enable-precise-memory-info','--js-flags=--expose-gc'];
const URL = process.env.U || 'http://localhost:8898/', W = +(process.env.W || 1280), H = +(process.env.H || 800), N = +(process.env.N || 20);
(async () => { const br = await chromium.launch({ args: GPU }); const pg = await br.newPage({ viewport: { width: W, height: H } });
 const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('crash', () => console.log('PAGE CRASH'));
 await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); localStorage.setItem('orbitrush.sandbox', '1'); } catch (e) {} });
 await pg.goto(URL + '?noacademy', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 180000 }); await pg.waitForTimeout(3000);
 const cdp = await pg.context().newCDPSession(pg);
 const R = {}; const snap = async tag => { try { await pg.evaluate(() => window.gc && gc()); } catch (e) {} const m = await pg.evaluate(() => window.__game.mem ? window.__game.mem() : { heap: performance.memory && Math.round(performance.memory.usedJSHeapSize / 1048576) });
   const pm = await cdp.send('Performance.getMetrics').catch(() => null); if (pm) { const g = Object.fromEntries(pm.metrics.map(x => [x.name, x.value])); m.jsHeapMB = Math.round(g.JSHeapUsedSize / 1048576); m.nodes = g.Nodes; }
   R[tag] = m; console.log(tag.padEnd(14), JSON.stringify(m)); };
 await cdp.send('Performance.enable'); await snap('load');
 await pg.evaluate(() => window.openPicker()); await pg.waitForTimeout(500);
 for (let y = 0; y < 30; y++) { await pg.evaluate(() => { const p = document.getElementById('picker'); p.scrollTop += 400; }); await pg.waitForTimeout(150); }
 await snap('picker-scroll');
 const ids = await pg.evaluate(() => [...document.querySelectorAll('#picker .pkC[data-m]')].map(c => c.dataset.m));
 await pg.evaluate(() => document.getElementById('pkClose').click());
 for (let k = 0; k < N; k++) { const id = ids[(k * 7) % ids.length]; await pg.evaluate(id => { window.openPicker(); document.querySelector(`#picker [data-m="${id}"]`).click(); }, id); await pg.waitForTimeout(1500); if (k % 5 === 4) await snap('swap ' + (k + 1)); }
 await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Missions/.test(b.textContent) && b.offsetParent); b && b.click(); }); await pg.waitForTimeout(400);
 await pg.evaluate(() => { const t = document.querySelector('button.mis[data-m=orbit]'); t && t.click(); }); await pg.waitForTimeout(600); await snap('mission card');
 await pg.evaluate(() => { const b = document.getElementById('mcAuto'); b && b.click(); }); await pg.waitForTimeout(90000); await snap('flight 90s');
 const a = R.load, b = R['swap ' + N], c = R['swap 10'] || a; let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
 ok(b.geometries <= a.geometries + 60, `geometries flat after ${N} swaps: ${a.geometries} -> ${b.geometries} (cap +60)`);
 ok(b.geometries <= c.geometries + 30, `geometries swap 10 -> ${N}: ${c.geometries} -> ${b.geometries} (cap +30)`);
 ok(b.textures <= a.textures + 30, `textures ${a.textures} -> ${b.textures} (cap +30)`);
 ok(b.jsHeapMB <= a.jsHeapMB + 40, `JS heap ${a.jsHeapMB} -> ${b.jsHeapMB} MB (cap +40)`);
 ok(!errs.length, 'no page errors ' + errs.slice(0, 2).join(' | '));
 await br.close(); process.exit(bad ? 1 : 0); })();
