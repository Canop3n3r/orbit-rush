// f5.2.2 Home render smoke (iPhone black-Home regression of f5.2.1): load Home on a phone viewport, page through 20 rockets
// with homeSet (Home is one screen since f5.8, no › button), then check the Home scene still draws (sky/pad/rocket = non-black pixels) and stays drawing after the swaps.
// Usage: B=chromium|webkit U=http://localhost:8898/ node tests/smoke/home_render.cjs   (screens in $OUT, default /tmp/hr)
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core'); const { execFileSync } = require('child_process');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const B = process.env.B || 'chromium', URL = process.env.U || 'http://localhost:8898/', OUT = process.env.OUT || '/tmp/hr', N = +(process.env.N || 20);
const lit = f => +execFileSync('python3', ['-c', `from PIL import Image\nim=Image.open('${f}').convert('L');w,h=im.size;px=list(im.crop((0,0,w,int(h*0.62))).getdata());print(sum(1 for p in px if p>24)/len(px))`]).toString();
(async () => { const br = await pw[B].launch(B === 'chromium' ? { executablePath: process.env.CHROME || undefined, args: GPU } : {}); const pg = await br.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
 const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
 await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
 await pg.goto(URL + '?noacademy', { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(5000);
 let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + B + ': ' + m); if (!t) bad++; };
 ok(await pg.evaluate(() => { const h = document.getElementById('home'); return h && !h.classList.contains('hidden'); }), 'Home is up');
 const shot = async n => { const f = `${OUT}/${B}_${n}.png`; await pg.screenshot({ path: f }); return [f, lit(f)]; };
 const [f0, a] = await shot('home_0'); ok(a > 0.3, `Home draws at load: ${(a * 100).toFixed(0)}% lit (${f0})`);
 for (let k = 0; k < N; k++) { await pg.evaluate(k => window.__game.homeSet(k + 1), k); await pg.waitForTimeout(B === 'webkit' ? 2500 : 1500); }
 await pg.waitForTimeout(3000); const [f1, b] = await shot('home_' + N); ok(b > 0.3 && b > a * 0.6, `Home still draws after ${N} swaps: ${(b * 100).toFixed(0)}% lit (${f1})`);
 const bad2 = errs.filter(e => !/favicon|404/.test(e)); ok(!bad2.length, 'no page/console errors ' + bad2.slice(0, 3).join(' | '));
 await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + B + ': ' + e.message); process.exit(1); });
