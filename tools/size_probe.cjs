// sizes-1: measure every house model's height and core body diameter (writes JSON for vehicles/dims.js `art` / `xz`).
// Usage: serve the repo root on :8971, then `node tools/size_probe.cjs > /tmp/art.json`. One headless browser.
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader'] }); try {
  const pg = await br.newPage(); await pg.goto((process.env.U || 'http://localhost:8971/') + 'tools/size_probe.html');
  await pg.waitForFunction(() => window.__out, null, { timeout: 300000 }); console.log(JSON.stringify((await pg.evaluate(() => window.__out)).out, null, 1));
} finally { await br.close(); } })();
