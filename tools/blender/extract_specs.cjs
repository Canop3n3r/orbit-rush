// Extracts per-stage geometry specs (hull silhouette, livery bands, nozzles with bell lengths, legs, stage placement) from the
// procedural hero models into tools/blender/specs/<id>.json. These are the INPUT of the Blender kit (tools/blender/kit/*):
// the Blender models keep the real-scale proportions of the vehicle data. Needs the repo served ($BASE, default :8975) + playwright-core + chrome.
// Usage: node tools/blender/extract_specs.cjs [ids...]   (all vehicles when no ids). Deterministic (rounded, sorted).
const pw = require(process.env.PWT || '/workspace/pwt/node_modules/playwright-core'), fs = require('fs'), path = require('path');
const OUT = path.join(__dirname, 'specs'); fs.mkdirSync(OUT, { recursive: true });
const ids = process.argv.slice(2);
(async () => {
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto((process.env.BASE || 'http://localhost:8975') + '/gfx/vehicles/viewer.html?webgl'); await p.waitForFunction(() => window.__viewer && window.__viewer.ready, null, { timeout: 180000 });
  const rows = await p.evaluate(async ([want, TAG]) => {
    const T = await import('three/webgpu'); const RX = await import('/fun/exhaust.js?v=' + TAG), SM = await import('/fun/stagemap.js?v=' + TAG); const M = await import('/gfx/vehicles/vehicles.js?v=' + (TAG)); const SK = await import('/gfx/vehicles/stage_keys.js?v=' + (TAG));
    const r2 = x => Math.round(x * 100) / 100, out = {};
    const OVER = /decal|frost|soot|dress|foil|:frost/, BELLM = /^(merged:)?(bell|bellx)$/, SKIPM = /(^|:)(ti|tiframe|rubber|glass|gold|solar|tower|concrete)(:|$)/;
    for (const id of (want.length ? want : Object.keys(M.VEHICLES))) {
      if (/^(catch-tower|payload-)/.test(id)) continue; let g; try { g = M.build(id, { detail: 'hi', legs: 0, payload: false }); } catch (e) { out[id] = { error: String(e) }; continue; }
      g.updateMatrixWorld(true); const st = g.userData.stages || {}, spec = { id, height: M.VEHICLES[id].height, stages: [] };
      const order = SK.STAGE_KEYS[id] || Object.keys(st);
      let mg = null, coreKeys = []; try { mg = SM.modelGroups(order); coreKeys = [...mg.core.flat(), ...mg.top]; } catch (e) { }
      for (const key of order) { const sg = st[key]; if (!sg) continue; sg.updateMatrixWorld(true);
        const inv = sg.matrixWorld.clone().invert(), rel = new T.Matrix4().copy(g.matrixWorld).invert().multiply(sg.matrixWorld), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3(); rel.decompose(pos, q, sc);
        const eu = new T.Euler().setFromQuaternion(q, 'YXZ'), hull = [], bells = [], v = new T.Vector3(); let legsG = null;
        sg.traverse(o => { if (o.name === 'legs' && !o.isMesh) legsG = o; });
        const skipLeg = o => { for (let p = o; p && p !== sg; p = p.parent) if (p.name === 'legs') return true; return false; };
        sg.traverse(o => { if (!o.isMesh || skipLeg(o) || !o.visible) return; const mn = (o.material && o.material.name) || '', m = new T.Matrix4().copy(inv).multiply(o.matrixWorld), a = o.geometry.attributes.position;
          const nm = o.name + '|' + mn; if (OVER.test(nm)) return; const isBell = BELLM.test(mn) || /bell/.test(o.name) && !/merged:/.test(o.name);
          const arr = isBell ? bells : hull; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); arr.push(v.x, v.y, v.z, mn); } });
        if (hull.length < 12 * 4) { spec.stages.push({ key, empty: true, offset: [r2(pos.x), r2(pos.y), r2(pos.z)] }); continue; }
        // hull axis: bbox centre of the hull vertices (skipped materials do not count)
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9;
        const hv = []; for (let i = 0; i < hull.length; i += 4) { const mn = hull[i + 3]; if (SKIPM.test(mn)) continue; hv.push(i); }
        for (const i of hv) { x0 = Math.min(x0, hull[i]); x1 = Math.max(x1, hull[i]); z0 = Math.min(z0, hull[i + 2]); z1 = Math.max(z1, hull[i + 2]); y0 = Math.min(y0, hull[i + 1]); y1 = Math.max(y1, hull[i + 1]); }
        const wx = x1 - x0, wz = z1 - z0; let cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const R0 = Math.max(wx, wz) / 2; if (Math.hypot(cx, cz) < 0.25 * R0) { cx = 0; cz = 0; }
        // slice every hull triangle at a grid of heights; per level and material keep the crossings' radius + angular coverage (16 sectors).
        // The outermost ring-like surface (>= 11 sectors: raceways, struts, fins and legs are not hull) is the visible hull radius + material.
        const H = y1 - y0, step = Math.min(0.25, Math.max(0.04, H / 500)), NL = Math.floor(H / step) + 1, lv = Array.from({ length: NL }, () => new Map());
        for (let t = 0; t + 11 < hull.length; t += 12) { const ia = [t, t + 4, t + 8]; const mn = hull[t + 3]; if (SKIPM.test(mn)) continue;
          for (let e = 0; e < 3; e++) { const A = ia[e], B = ia[(e + 1) % 3], ya = hull[A + 1], yb = hull[B + 1]; if (Math.abs(ya - yb) < 1e-6) continue; const lo = Math.max(0, Math.ceil((Math.min(ya, yb) - y0) / step - 1e-9)), hi = Math.min(NL - 1, Math.floor((Math.max(ya, yb) - y0) / step + 1e-9));
            for (let l = lo; l <= hi; l++) { const y = y0 + l * step, u = (y - ya) / (yb - ya); const x = hull[A] + (hull[B] - hull[A]) * u - cx, z = hull[A + 2] + (hull[B + 2] - hull[A + 2]) * u - cz, rr = Math.hypot(x, z);
              const sec = Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 16) % 16; let f = lv[l].get(mn); if (!f) lv[l].set(mn, f = { sec: 0, r: 0 }); f.sec |= 1 << sec; f.r = Math.max(f.r, rr); } } }
        const bitc = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; }, pts = [];
        for (let l = 0; l < NL; l++) { let best = null; for (const [mn, f] of lv[l]) { if (bitc(f.sec) < 11) continue; if (!best || f.r > best.r + 0.004) best = { r: f.r, m: mn }; } if (best) pts.push([y0 + l * step, best.r, best.m.replace(/^merged:/, '')]); }
        // silhouette: polyline simplification on radius vs y (0.4% of R0 tolerance); livery: run-length of the visible material
        const tol = Math.max(0.01, R0 * 0.004), keep = new Uint8Array(pts.length); if (pts.length) { keep[0] = keep[pts.length - 1] = 1; const dp = (i, j) => { let mx = 0, mi = -1; for (let k = i + 1; k < j; k++) { const u = (pts[k][0] - pts[i][0]) / (pts[j][0] - pts[i][0] || 1), d = Math.abs(pts[i][1] + (pts[j][1] - pts[i][1]) * u - pts[k][1]); if (d > mx) { mx = d; mi = k; } } if (mx > tol && mi > 0) { keep[mi] = 1; dp(i, mi); dp(mi, j); } }; dp(0, pts.length - 1); }
        const sil = pts.filter((_, i) => keep[i]).map(q => [r2(q[0]), r2(q[1])]), runs = []; for (const q of pts) { const lst = runs[runs.length - 1]; if (lst && lst[2] === q[2]) lst[1] = q[0] + step; else runs.push([q[0], q[0] + step, q[2]]); }
        // runs shorter than 0.15 m (weld rings, thin accent lines) fold into the previous run
        const bands = []; for (const q of runs) { const lst = bands[bands.length - 1]; if (lst && (q[1] - q[0] < 0.15 || lst[2] === q[2])) lst[1] = q[1]; else bands.push([q[0], q[1], q[2]]); }
        for (const q of bands) { q[0] = r2(q[0]); q[1] = r2(q[1]); }
        // lathe-axis hull: bell-less. engine-section materials (skirt/shield) kept as 'dark'
        const nz = []; const NZ = (await import('/gfx/vehicles/nozzles.js?v=' + (TAG))).NOZZLES[id] || {};
        for (const n of NZ[key] || []) { let top = n[1], bot = n[1]; for (let i = 0; i < bells.length; i += 4) if (Math.hypot(bells[i] - n[0], bells[i + 2] - n[2]) < n[3] * 1.25) { top = Math.max(top, bells[i + 1]); bot = Math.min(bot, bells[i + 1]); }
          nz.push([n[0], n[1], n[2], n[3], r2(Math.max(0.2, top - n[1]))]); }
        let leg = null; if (legsG) { const pv = legsG.userData.pivots || []; let len = 0; for (const pg of pv.slice(0, 1)) { pg.updateMatrixWorld(true); const pi = pg.matrixWorld.clone().invert(), bb = new T.Box3(), t = new T.Box3(); pg.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(new T.Matrix4().copy(pi).multiply(o.matrixWorld)); bb.union(t); } }); len = bb.max.y; }
          leg = { pivots: pv.map(pg => [r2(pg.position.x), r2(pg.position.y), r2(pg.position.z)]), len: r2(len) }; }
        // grid fins: titanium lattice meshes outside the legs, clustered by azimuth
        let fins = null; { const fv = []; sg.traverse(o => { if (!o.isMesh || skipLeg(o)) return; const mn = (o.material && o.material.name) || ''; if (!/(^|:)(ti|tiframe)$/.test(mn.replace(/^merged:/, ''))) return; const m = new T.Matrix4().copy(inv).multiply(o.matrixWorld), a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m); fv.push([v.x - cx, v.y, v.z - cz]); } });
          if (fv.length > 8) { const occ = new Array(16).fill(0), ys = [], rr = []; for (const [x, y, z] of fv) { const s16 = Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * 16) % 16; occ[s16]++; ys.push(y); rr.push(Math.hypot(x, z)); }
            let groups = []; let start = occ.findIndex((c, i) => c === 0 && occ[(i + 1) % 16] > 0); if (start >= 0) { for (let k = 1; k <= 16; k++) { const i = (start + k) % 16; if (occ[i] > 0) { if (!groups.length || groups[groups.length - 1].end !== (i + 15) % 16) groups.push({ s: i, end: i, n: 1 }); else { groups[groups.length - 1].end = i; groups[groups.length - 1].n++; } } } }
            if (groups.length) { const g0 = groups[0], aMid = (((g0.s + g0.n / 2) / 16) * 2 * Math.PI) - Math.PI, rmax = Math.max(...rr), ymin = Math.min(...ys), ymax = Math.max(...ys);
              fins = { n: groups.length, a0: r2(aMid), y: r2(ymin), h: r2(ymax - ymin), w: r2(Math.max(0.8, 2 * rmax * Math.sin(Math.min(1.2, (g0.n * Math.PI / 16) / 2)))), r: r2(rmax) }; } } }
        spec.stages.push({ key, offset: [r2(pos.x), r2(pos.y), r2(pos.z)], rotY: r2(eu.y), axis: [r2(cx), r2(cz)], y0: r2(y0), y1: r2(y1), w: [r2(wx), r2(wz)],
          prof: sil, bands, noz: nz, legs: leg, fins, info: (() => { try { const radial = /^(srb|strap|side|struts|ssb)/i.test(key); if (radial) return RX.stageEngines(id, 0, [], true, 1); const ci = coreKeys.indexOf(key); return ci >= 0 ? RX.coreInfo(id, ci, coreKeys.length) : null; } catch (e) { return null; } })() });
      }
      for (const stg of spec.stages) if (stg.info) stg.info = { prop: stg.info.prop, vac: !!stg.info.vacuumOnly, tKN: stg.info.tKN || 0, n: stg.info.n || 0 };
      out[id] = spec; try { M.dispose(g); } catch (e) { }
    }
    return out; }, [ids, process.env.TAG || 'f6.0a']);
  let n = 0; for (const [id, s] of Object.entries(rows)) { fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify(s) + '\n'); n++; }
  console.log('wrote', n, 'specs to', OUT); await b.close();
})().catch(e => { console.log('FAIL', e); process.exit(1); });
