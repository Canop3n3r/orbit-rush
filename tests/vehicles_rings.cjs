// Regression (rockets-pass-1, ghost nose cone): weld/seam rings must be open bands. A closed ring's flat end caps stuck out as a
// floating disc where the hull narrows (the ship's nose base). Needs the art server (python -m http.server 8771 at the repo root).
// Usage: node tests/vehicles_rings.cjs [viewerUrl]   (skips with exit 0 without playwright)
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('vehicles_rings: skipped (no playwright)'); process.exit(0); }
const url = process.argv[2] || 'http://localhost:8771/gfx/vehicles/viewer.html?webgl';
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); const pg = await br.newPage({ viewport: { width: 300, height: 300 } });
  let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; }; pg.on('pageerror', e => { console.log('pageerror', e.message); bad++; });
  await pg.goto(url); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 180000 });
  const r = await pg.evaluate(async () => { const base = new URL(location.href).pathname.replace(/viewer\.html$/, ''); const K = await import(base + 'kit.js?v=f5.8y'), P = await import(base + 'parts.js?v=f5.8y');
    const k = new K.Kit('hi'); P.ring(k, 4.5, 10, 0.04, 'grey'); const g = k.build('t'); let caps = 0, tris = 0; g.traverse(o => { if (!o.isMesh) return; const n = o.geometry.attributes.normal; tris += n.count / 3; for (let i = 0; i < n.count; i++) if (Math.abs(n.getY(i)) > 0.99) caps++; }); return { caps, tris }; });
  ok(r.tris > 0, `ring builds geometry (${r.tris} tris)`); ok(r.caps === 0, `ring has no flat end-cap vertices (${r.caps})`);
  await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
