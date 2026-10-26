// rockets-pass-1 unit 4b: post-build "dressing" of every tank stage on the desktop (hi) tier. Reads the built stage groups (bounding box + median hull radius),
// then adds distinct materials in one merged mesh per material per stage: engine-section pump fairings, an external feedline with brackets, a composite interstage
// with separation ring + bolt pads, a thermal blanket on upper stages and spray-on foam on hydrogen tanks (roster-driven, see cryo.js). Mid keeps only the foam overlay.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.9-7';
import { HYDRO } from './cryo.js?v=f5.9-7';
import { NOZZLES } from './nozzles.js?v=f5.9-7';
const PI = Math.PI, SKIP = /^(payload|sat|fairing|nose|bay|legs|orbiter|capsule|ship|crew|tower|abort|top|cap|tip|shroud|cargo|pod|probe)/i, OWN = /^(heron|colossus|sparrow|space-truck|saturnine|payload-|catch-tower)/;
const _b = new THREE.Box3(), _m = new THREE.Matrix4();
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const walk = (o, f) => { if (o.name === 'legs') return; f(o); for (const c of o.children) walk(c, f); }; // landing legs reach far outside the hull barrel
const _v = new THREE.Vector3();
function measure(sg) { _b.makeEmpty(); walk(sg, m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { m.geometry.computeBoundingBox(); _b.union(m.geometry.boundingBox); } }); if (_b.isEmpty()) return null;
  const NL = 9, ylo = _b.min.y, H = _b.max.y - ylo; if (H < 1) return null; const lv = Array.from({ length: NL }, () => []);
  walk(sg, m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i + 2 < p.count; i += 3) for (let e = 0; e < 3; e++) { const a = i + e, b = i + (e + 1) % 3, ya = p.getY(a), yb = p.getY(b); if (ya === yb) continue;
    for (let l = 0; l < NL; l++) { const y = ylo + H * (0.1 + 0.8 * l / (NL - 1)), t = (y - ya) / (yb - ya); if (t >= 0 && t <= 1) lv[l].push(p.getX(a) + (p.getX(b) - p.getX(a)) * t, p.getZ(a) + (p.getZ(b) - p.getZ(a)) * t); } } } }); // slice every triangle edge at 9 heights
  const rr = [], cc = []; for (const pts of lv) { if (pts.length < 16) continue; let cx = (_b.max.x + _b.min.x) / 2, cz = (_b.max.z + _b.min.z) / 2, md = 0;
    for (let it = 0; it < 3; it++) { const ds = []; for (let i = 0; i < pts.length; i += 2) ds.push(Math.hypot(pts[i] - cx, pts[i + 1] - cz)); const sd = ds.slice().sort((x, y) => x - y); md = sd[sd.length >> 1];
      let sx = 0, sz = 0, n = 0; for (let i = 0; i < ds.length; i++) if (ds[i] > md * 0.9 && ds[i] < md * 1.1) { sx += pts[i * 2]; sz += pts[i * 2 + 1]; n++; } if (n < 6) break; cx = sx / n; cz = sz / n; }
    rr.push(md); cc.push([cx, cz]); } // per-level hull radius = median crossing radius (fins and struts are few), centre = mean of the hull crossings
  if (rr.length < 3) return null; const o = rr.map((v, i) => i).sort((x, y) => rr[x] - rr[y]), mi = o[o.length >> 1], r = rr[mi]; let cx = cc[mi][0], cz = cc[mi][1]; if (Math.hypot(cx, cz) < 0.3 * r) { cx = 0; cz = 0; } // stages on the model axis: grid fins and strakes skew the estimate, snap to it
  let yb = Infinity, yt = -Infinity; walk(sg, m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i) - cx, p.getZ(i) - cz); if (d > r * 0.95 && d < r * 1.05) { const y = p.getY(i); if (y < yb) yb = y; if (y > yt) yt = y; } } } });
  if (!(yt - yb > 2 * r)) return null; return { y0: yb, h: yt - yb, cx, cz, r }; }
// hull radius of a stage group at height y: 75th-percentile radial distance of its non-bell vertices within a thin band (fins and legs excluded by the 1.25r cap)
function localR(sg, y, cx, cz, r) { const d = [], band = Math.max(0.15, r * 0.25); walk(sg, m => { if (m.isMesh && !/bell|soot|frost|foam|foil|dress/.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) if (Math.abs(p.getY(i) - y) < band) { const q = Math.hypot(p.getX(i) - cx, p.getZ(i) - cz); if (q > r * 0.3 && q < r * 1.25) d.push(q); } } }); if (d.length < 6) return r; d.sort((x, y2) => x - y2); return d[Math.floor(d.length * 0.75)]; }
const a0hero = H => (H % 5) * 0.35 + 0.2;
const box = (k, key, w, h, d, p, a) => k.add(new THREE.BoxGeometry(w, h, d), key, xf(p, [0, a, 0]));
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion();
function rod(k, a, b, rad, key) { _A.set(...a); _B.set(...b); const L = _A.distanceTo(_B); _q.setFromUnitVectors(_Y, _B.clone().sub(_A).normalize()); k.add(new THREE.CylinderGeometry(rad, rad, L, 5), key, new THREE.Matrix4().compose(_A.clone().add(_B).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1))); }
// engine section: quilted thermal floor between the bells, a feed manifold ring, and per bell a turbopump can plus two gimbal actuator rods (hi tier; stages with bells below their hull)
function engineBay(k, nz, y0, cx, cz, r) { const list = (nz || []).filter(n => n[1] < y0 - 0.25 && n[1] > y0 - r * 6); if (!list.length) return false;
  const re = list.reduce((a, n) => a + n[3], 0) / list.length, ny = list.reduce((a, n) => a + n[1], 0) / list.length, dy = y0 - ny, ring = list.reduce((a, n) => a + Math.hypot(n[0] - cx, n[2] - cz), 0) / list.length, rm = Math.max(...list.map(n => Math.hypot(n[0] - cx, n[2] - cz) + n[3]));
  if (list.length >= 3) { k.add(new THREE.CylinderGeometry(Math.min(r * 1.0, rm + re * 0.5), Math.min(r * 1.0, rm + re * 0.5), 0.03 + re * 0.05, 36), 'shield', xf([cx, y0 - dy * 0.14, cz])); // thermal floor
    if (ring > re * 0.5) k.add(new THREE.TorusGeometry(ring, Math.max(0.03, re * 0.06), 5, 40), 'steel', xf([cx, y0 - dy * 0.3, cz], [PI / 2, 0, 0])); } // feed manifold
  for (const [x, y, z, e] of list) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, tx = -uz, tz = ux, top = y0 - dy * 0.06, mid = y + (top - y) * 0.55;
    k.add(new THREE.CylinderGeometry(e * 0.2, e * 0.2, e * 0.75, 8), 'dark', xf([x + ux * e * 0.62, top - e * 0.5, z + uz * e * 0.62])); // turbopump can
    for (const sg of [-1, 1]) rod(k, [x + tx * e * sg * 0.55 + ux * e * 0.3, top - 0.02, z + tz * e * sg * 0.55 + uz * e * 0.3], [x + tx * e * sg * 0.3 + ux * e * 0.35, mid, z + tz * e * sg * 0.3 + uz * e * 0.35], Math.max(0.025, e * 0.04), 'steel'); } // gimbal actuators
  return true; }
export function dressStages(g, id, det) {
  const st = g.userData.stages; if (!st || det === 'lo' || /^(payload-|catch-tower|saturnine)/.test(id)) return; const own = OWN.test(id), hd = HYDRO[id] || [], H = hash(id), cand = [];
  for (const [key, sg] of Object.entries(st)) { if (SKIP.test(key) || !sg || !sg.isGroup || sg.position.lengthSq() > 1e-6 || Math.abs(sg.rotation.y) + Math.abs(sg.rotation.x) + Math.abs(sg.rotation.z) > 1e-6 || sg.getObjectByName(key + ':dress')) continue;
    const me = measure(sg); if (me && me.r >= 0.25 && me.h > 2.2 * me.r) cand.push({ key, sg, ...me }); }
  const nzs = NOZZLES[id] || {};
  if (!cand.length) return;
  g.updateMatrixWorld(true); const boxes = Object.entries(st).filter(([k, x]) => x && x.isObject3D).map(([k, x]) => [k, new THREE.Box3().setFromObject(x)]); // f5.8r: stage tops only get a hot-staging ring / vent slots / interstage when something rides on them
 const foot = Math.min(...cand.map(c => c.y0));
  for (const c of cand) { const { key, sg, y0, h, r } = c, cx = own ? 0 : c.cx, cz = own ? 0 : c.cz, // tier-A hero stacks sit on the model axis (grid fins and strakes skew the estimate)
    first = Math.abs(y0 - foot) < 0.5, k = new Kit(det), foamed = hd.includes(key), topped = boxes.some(([k2, b2]) => k2 !== key && b2.min.y >= y0 + h - 0.5 * r && b2.max.y > y0 + h); let n = 0; // topped: another group (next stage, payload shell, sat) starts at this stage's top; a ship's own nose has none, so the louvre ring / interstage would float around the nose cone (rockets-pass-2 regression)
    if (foamed) { sg.traverse(m => { if (m.isMesh && /salmon|foam|orange|tan\b/.test(m.name)) n = -1; }); }
    if (foamed && n === 0 && det === 'hi') { const tint = H & 1; k.add(new THREE.CylinderGeometry(r * 1.012, r * 1.012, h * 0.84, det === 'hi' ? 40 : 18, 1, true), 'foam:' + tint, xf([cx, y0 + h * 0.5, cz])); }
    if (det === 'hi') { engineBay(k, nzs[key], y0, cx, cz, r);
    if (own) { const rr = r * 1.07; // the hull estimate runs a few percent low on tiled/stringered skins; slats stand proud of it
     // tier-A hero stages already carry their own interstage and fins: add louvred engine bay, a vented hot-staging ring and hatch panels instead
      const lh = Math.min(rr * 0.3, h * 0.04), nl = Math.round(Math.min(40, rr * 8)), ns = Math.min(24, Math.round(rr * 5));
      for (let i = 0; i < nl; i++) { const a = i / nl * 2 * PI; box(k, 'dark', rr * 0.05, lh, rr * 0.12, [cx + Math.cos(a) * rr * 1.02, y0 + lh * 2.4 + rr * 0.02, cz + Math.sin(a) * rr * 1.02], -a); } // louvres above the engine bay
      if (topped) { for (let i = 0; i < ns; i++) { const a = (i + 0.5) / ns * 2 * PI; box(k, 'dark', rr * 0.05, lh * 1.4, rr * 0.09, [cx + Math.cos(a) * rr * 1.02, y0 + h - lh * 1.6, cz + Math.sin(a) * rr * 1.02], -a); } // vent slots below the stage separation
      k.add(new THREE.TorusGeometry(rr * 1.03, rr * 0.016, 4, 48), 'steel', xf([cx, y0 + h - lh * 3.2, cz], [PI / 2, 0, 0])); }
      for (let i = 0; i < 4; i++) { const a = a0hero(H) + i * PI / 2; box(k, 'grey', rr * 0.05, lh * 2, rr * 0.22, [cx + Math.cos(a) * rr * 1.02, y0 + lh * 4.2 + rr * 0.05, cz + Math.sin(a) * rr * 1.02], -a); } } // access hatches
    const tapered = localR(sg, y0 + h * 0.85, cx, cz, r) < 0.88 * localR(sg, y0 + h * 0.2, cx, cz, r); // conical upper/solid stages narrow towards the nose: a barrel-radius ring or blanket would float off them
    if (!own && !tapered) {
      const nb = (H >> 3) % 3 === 0 ? 2 : r > 1.6 ? 6 : 4, a0 = (H % 7) * 0.3, FL = Math.min(h * 0.08, r * 1.7); // engine-section pump fairings (2, 4 or 6 by house)
      if (first) for (let i = 0; i < nb; i++) { const a = a0 + i / nb * 2 * PI, px = cx + Math.cos(a) * r * 1.035, pz = cz + Math.sin(a) * r * 1.035;
        k.add(new THREE.CylinderGeometry(r * 0.15, r * 0.15, FL, 10), 'grey', xf([px, y0 + FL * 0.5 + r * 0.05, pz], [0, -a, 0], [0.5, 1, 1])); // streamlined pump fairing
        k.add(new THREE.ConeGeometry(r * 0.15, r * 0.4, 10, 1), 'dark', xf([px, y0 + FL + r * 0.05 + r * 0.2, pz], [0, -a, 0], [0.5, 1, 1])); }
      if (first || h > 6 * r) { const af = a0 + PI / nb, L = h * 0.92, fx = cx + Math.cos(af) * r * 1.05, fz = cz + Math.sin(af) * r * 1.05; // external feedline
        k.add(new THREE.CylinderGeometry(r * 0.032, r * 0.032, L, 6), 'steel', xf([fx, y0 + h * 0.04 + L / 2, fz]));
        for (let i = 0; i <= 5; i++) box(k, 'dark', r * 0.07, r * 0.05, r * 0.11, [cx + Math.cos(af) * r * 1.03, y0 + h * 0.04 + L * i / 5, cz + Math.sin(af) * r * 1.03], -af); }
      const ih = Math.min(h * 0.1, r * 1.5), ri = Math.min(r, localR(sg, y0 + h - ih, cx, cz, r), localR(sg, y0 + h - ih * 0.5, cx, cz, r)); // ri: hull radius where the ring sits (conical upper stages narrow towards the top) // composite interstage: ring, separation plane, bolt pads
      if (topped) { k.add(new THREE.CylinderGeometry(ri * 1.013, ri * 1.013, ih, 40, 1, true), 'carbon', xf([cx, y0 + h - ih * 0.5 - (first ? 0 : 0), cz]));
      k.add(new THREE.TorusGeometry(ri * 1.014, ri * 0.012, 4, 40), 'grey', xf([cx, y0 + h - ih, cz], [PI / 2, 0, 0]));
      for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; box(k, 'grey', ri * 0.03, ri * 0.05, ri * 0.07, [cx + Math.cos(a) * ri * 1.017, y0 + h - ih * 0.5, cz + Math.sin(a) * ri * 1.017], -a); } }
      if (!first && !foamed) { const bh = h * 0.28; k.add(new THREE.CylinderGeometry(r * 1.01, r * 1.01, bh, 40, 4, true), 'foil', xf([cx, y0 + h * 0.52 + bh / 2, cz])); // thermal blanket
        for (const f of [0, 0.5, 1]) k.add(new THREE.CylinderGeometry(r * 1.016, r * 1.016, 0.05 * r + 0.02, 40, 1, true), 'dark', xf([cx, y0 + h * 0.52 + bh * f, cz])); }
    } }
    if (!k.b.size) continue; const d = k.build(key + ':dress'); d.name = key + ':dress'; for (const m of [...d.children]) { m.name = key + ':' + m.name; sg.add(m); } }
}
