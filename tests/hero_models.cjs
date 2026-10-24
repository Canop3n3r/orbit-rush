// Hero model sanity (f5.8q, after the rockets-pass-2 louvre-ring regression): for EVERY vehicle and tier (hi/mid/lo)
//  (1) nothing sticks out past the nose: the non-hull meshes (stage dress, frost, bay door, payload mesh) never rise above the hull nose by more than 2% of the height, and
//  (2) no dress mesh in the nose region (top 8% of the height) floats off the hull: its radial distance from the axis stays within the local hull radius (+15% proud) at its height (the louvre ring used to float around the ship's nose).
// Needs the tree served (python3 -m http.server $PORT in the repo root). Usage: U=http://localhost:8959/ node tests/hero_models.cjs [ids...]
let pw; try { pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'); } catch { console.log('hero_models: skipped (no playwright)'); process.exit(0); }
const U = process.env.U || 'http://localhost:8959/', ids = process.argv.slice(2);
(async () => { const br = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] }); const pg = await br.newPage(); let bad = 0; const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
  await pg.goto(U + 'gfx/vehicles/viewer.html?webgl'); await pg.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 240000 });
  const R = await pg.evaluate(async ids => { const M = await import('/gfx/vehicles/vehicles.js?v=f5.8u'), T = await import('three/webgpu'), out = [], v = new T.Vector3(), bb = new T.Box3();
    const isExtra = m => { for (let p = m; p; p = p.parent) if (/:dress|:frost|:foam|^bay$|^sat$/.test(p.name) || /dress|frost|foam/.test(p.name)) return true; return false; };
    for (const id of ids.length ? ids : Object.keys(M.VEHICLES)) for (const detail of ['hi', 'mid', 'lo']) { const g = M.build(id, { detail, legs: 0 }); g.updateMatrixWorld(true); const H = M.VEHICLES[id].height, hull = [], extra = [];
      g.traverse(m => { if (!m.isMesh) return; for (let p = m; p; p = p.parent) if (!p.visible) return; (isExtra(m) ? extra : hull).push(m); });
      let nose = -1e9; for (const m of hull) { bb.setFromObject(m); nose = Math.max(nose, bb.max.y); }
      const band = H * 0.012 + 0.2, pts = []; for (const m of hull) { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 2) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); pts.push(v.y, Math.hypot(v.x, v.z)); } }
      const hullR = y => { const d = []; for (let i = 0; i < pts.length; i += 2) if (pts[i] <= y + 0.05 && pts[i] > y - 2 * band) d.push(pts[i + 1]); if (d.length < 6) return null; d.sort((a, b) => a - b); return d[Math.floor(d.length * 0.9)]; };
      let over = 0, overN = '', float = 0, floatN = '';
      for (const m of extra) { bb.setFromObject(m); if (bb.max.y - nose > over) { over = bb.max.y - nose; overN = m.name; }
        const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 3) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (/frost|foam/.test(m.name) || v.y < nose - 0.08 * H) continue; const r = hullR(v.y); if (r == null) continue; const e = Math.hypot(v.x, v.z) - r * 1.15 - 0.05; if (e > float && /dress|dark|grey|steel|carbon|shield|foil/.test(m.name + m.parent.name)) { float = e; floatN = m.name + '@' + v.y.toFixed(1); } } }
      out.push({ id, detail, H, nose, over, overN, float, floatN }); M.dispose(g); } return out; }, ids);
  for (const id of [...new Set(R.map(r => r.id))]) { for (const r of R.filter(x => x.id === id)) { ok(r.over <= r.H * 0.02, `${id} ${r.detail}: nothing past the nose (extras ${r.over.toFixed(2)} m above ${r.nose.toFixed(1)}${r.over > 0 ? ' ' + r.overN : ''})`); ok(r.float <= Math.max(0.35, r.H * 0.004), `${id} ${r.detail}: dress stays on the hull (${r.float.toFixed(2)} m outside${r.float > 0.05 ? ' ' + r.floatN : ''})`); } }
  ok(errs.length === 0, 'no page errors ' + errs.slice(0, 2).join(' | ')); console.log(`hero_models: ${R.length} model×tier rows, ${bad} failed`); await br.close(); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
