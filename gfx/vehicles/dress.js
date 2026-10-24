// rockets-pass-1 unit 4b: post-build "dressing" of every tank stage on the desktop (hi) tier. Reads the built stage groups (bounding box + median hull radius),
// then adds distinct materials in one merged mesh per material per stage: engine-section pump fairings, an external feedline with brackets, a composite interstage
// with separation ring + bolt pads, a thermal blanket on upper stages and spray-on foam on hydrogen tanks (roster-driven, see cryo.js). Mid keeps only the foam overlay.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=art1';
import { HYDRO } from './cryo.js?v=art1';
const PI = Math.PI, SKIP = /^(payload|sat|fairing|nose|bay|legs|orbiter|capsule|ship|crew|tower|abort|top|cap|tip|shroud|cargo|pod|probe)/i, OWN = /^(heron|colossus|sparrow|space-truck|saturnine|payload-|catch-tower)/;
const _b = new THREE.Box3(), _m = new THREE.Matrix4();
const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
function measure(sg) { _b.makeEmpty(); sg.traverse(m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { m.geometry.computeBoundingBox(); _b.union(m.geometry.boundingBox); } }); if (_b.isEmpty()) return null;
  const y0 = _b.min.y, h = _b.max.y - y0, cx = (_b.max.x + _b.min.x) / 2, cz = (_b.max.z + _b.min.z) / 2, rs = [];
  sg.traverse(m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) rs.push(Math.hypot(p.getX(i) - cx, p.getZ(i) - cz)); } }); // hull tubes have vertices only at their rims
  if (rs.length < 8) return null; rs.sort((a, b) => a - b); const r = rs[Math.floor(rs.length * 0.72)]; let yb = Infinity, yt = -Infinity; // hull bottom/top = extremes of the vertices on the barrel radius (engine fairings, skirts and fins hang outside it)
  sg.traverse(m => { if (m.isMesh && !/bell|soot|frost|foam|foil/.test(m.name)) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const d = Math.hypot(p.getX(i) - cx, p.getZ(i) - cz); if (d > r * 0.93 && d < r * 1.07) { const y = p.getY(i); if (y < yb) yb = y; if (y > yt) yt = y; } } } });
  if (!(yt - yb > 2 * r)) return null; return { y0: yb, h: yt - yb, cx, cz, r }; } // 72nd percentile: rim radius (cap centres, fins and struts do not move it)
const box = (k, key, w, h, d, p, a) => k.add(new THREE.BoxGeometry(w, h, d), key, xf(p, [0, a, 0]));
export function dressStages(g, id, det) {
  const st = g.userData.stages; if (!st || det === 'lo' || OWN.test(id)) return; const hd = HYDRO[id] || [], H = hash(id), cand = [];
  for (const [key, sg] of Object.entries(st)) { if (SKIP.test(key) || !sg || !sg.isGroup || sg.position.lengthSq() > 1e-6 || Math.abs(sg.rotation.y) + Math.abs(sg.rotation.x) + Math.abs(sg.rotation.z) > 1e-6 || sg.getObjectByName(key + ':dress')) continue;
    const me = measure(sg); if (me && me.r >= 0.25 && me.h > 2.2 * me.r) cand.push({ key, sg, ...me }); }
  if (!cand.length) return; const foot = Math.min(...cand.map(c => c.y0));
  for (const c of cand) { const { key, sg, y0, h, cx, cz, r } = c, first = Math.abs(y0 - foot) < 0.5, k = new Kit(det), foamed = hd.includes(key); let n = 0;
    if (foamed) { sg.traverse(m => { if (m.isMesh && /salmon|foam|orange|tan\b/.test(m.name)) n = -1; }); }
    if (foamed && n === 0 && det === 'hi') { const tint = H & 1; k.add(new THREE.CylinderGeometry(r * 1.012, r * 1.012, h * 0.84, det === 'hi' ? 40 : 18, 1, true), 'foam:' + tint, xf([cx, y0 + h * 0.5, cz])); }
    if (det === 'hi') {
      const nb = (H >> 3) % 3 === 0 ? 2 : r > 1.6 ? 6 : 4, a0 = (H % 7) * 0.3, FL = Math.min(h * 0.2, r * 3); // engine-section pump fairings (2, 4 or 6 by house)
      if (first) for (let i = 0; i < nb; i++) { const a = a0 + i / nb * 2 * PI, px = cx + Math.cos(a) * r * 1.035, pz = cz + Math.sin(a) * r * 1.035;
        k.add(new THREE.CylinderGeometry(r * 0.15, r * 0.15, FL, 10), 'grey', xf([px, y0 + FL * 0.5 + r * 0.05, pz], [0, -a, 0], [0.5, 1, 1])); // streamlined pump fairing
        k.add(new THREE.ConeGeometry(r * 0.15, r * 0.4, 10, 1), 'dark', xf([px, y0 + FL + r * 0.05 + r * 0.2, pz], [0, -a, 0], [0.5, 1, 1])); }
      if (first || h > 6 * r) { const af = a0 + PI / nb, L = h * 0.92, fx = cx + Math.cos(af) * r * 1.05, fz = cz + Math.sin(af) * r * 1.05; // external feedline
        k.add(new THREE.CylinderGeometry(r * 0.032, r * 0.032, L, 6), 'steel', xf([fx, y0 + h * 0.04 + L / 2, fz]));
        for (let i = 0; i <= 5; i++) box(k, 'dark', r * 0.07, r * 0.05, r * 0.11, [cx + Math.cos(af) * r * 1.03, y0 + h * 0.04 + L * i / 5, cz + Math.sin(af) * r * 1.03], -af); }
      const ih = Math.min(h * 0.1, r * 1.5); // composite interstage: ring, separation plane, bolt pads
      k.add(new THREE.CylinderGeometry(r * 1.013, r * 1.013, ih, 40, 1, true), 'carbon', xf([cx, y0 + h - ih * 0.5 - (first ? 0 : 0), cz]));
      k.add(new THREE.TorusGeometry(r * 1.014, r * 0.012, 4, 40), 'grey', xf([cx, y0 + h - ih, cz], [PI / 2, 0, 0]));
      for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * PI; box(k, 'grey', r * 0.03, r * 0.05, r * 0.07, [cx + Math.cos(a) * r * 1.017, y0 + h - ih * 0.5, cz + Math.sin(a) * r * 1.017], -a); }
      if (!first && !foamed) { const bh = h * 0.28; k.add(new THREE.CylinderGeometry(r * 1.01, r * 1.01, bh, 40, 4, true), 'foil', xf([cx, y0 + h * 0.52 + bh / 2, cz])); // thermal blanket
        for (const f of [0, 0.5, 1]) k.add(new THREE.CylinderGeometry(r * 1.016, r * 1.016, 0.05 * r + 0.02, 40, 1, true), 'dark', xf([cx, y0 + h * 0.52 + bh * f, cz])); }
    }
    if (!k.b.size) continue; const d = k.build(key + ':dress'); d.name = key + ':dress'; for (const m of [...d.children]) { m.name = key + ':' + m.name; sg.add(m); } }
}
