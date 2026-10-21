// f5.4l desktop Build: simple vs ⚙ Advanced shots at 1280/1920 (U/OUT via edit; quick visual check)
const pw = require('/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
(async () => { const br = await pw.chromium.launch({ args: GPU }); const errs = [];
 for (const [w, h] of [[1280, 800], [1920, 1080]]) { const pg = await br.newPage({ viewport: { width: w, height: h } }); pg.on('pageerror', e => errs.push(e.message));
 await pg.addInitScript(() => { localStorage.setItem('or_seen_welcome', '1'); });
 await pg.goto('http://localhost:8941/?noacademy'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 240000 }); await pg.waitForTimeout(1500);
 await pg.click('#hnBuild'); await pg.waitForTimeout(3000);
 const r = await pg.evaluate(() => { const b = document.getElementById('build'), vis = e => e.offsetParent !== null; const ctl = [...b.querySelectorAll('button,select,input,summary,a')].filter(vis).length; const words = b.innerText.split(/\s+/).filter(Boolean).length; return { ctl, words, right: b.getBoundingClientRect().right }; });
 console.log(w, JSON.stringify(r)); await pg.screenshot({ path: `/tmp/mapf/build_${w}.png` });
 await pg.click('#bAdv'); await pg.waitForTimeout(1500); await pg.screenshot({ path: `/tmp/mapf/build_${w}_adv.png` }); await pg.click('#bAdv'); await pg.close(); }
 console.log('errs', errs.slice(0, 3)); await br.close(); })();
