// Reusable part builders (all original geometry). y is up, units are metres, every builder adds to a Kit.
import * as THREE from 'three/webgpu';
import { xf, mat, mergeGeometries } from './kit.js?v=f5.6l';
import * as PR from './profiles.js?v=f5.6l';
export const lathe = (k, prof, key, o = {}) => k.add(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * (o.s || 1), y)), o.seg || k.seg, o.p0 || 0, o.pl || 2 * Math.PI), key, o.m);
const PI = Math.PI;
// cylinder/frustum with its base at y
export function tube(k, r0, r1, h, y, key, o = {}) { const g = new THREE.CylinderGeometry(r1, r0, h, o.seg || k.seg, o.hs || 1, !!o.open, o.t0 || 0, o.tl || 2 * PI);
  if (/^steel/.test(key)) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4 * (o.tl || 2 * PI) / (2 * PI), uv.getY(i) * h / 16); } k.add(g, key, xf([o.x || 0, y + h / 2, o.z || 0], o.r || [0, 0, 0])); }
// ogive nose from radius r at y up to the tip (+Y)
export function ogive(k, r, L, y, key, tip = 0.06) { lathe(k, PR.ogive(r, L, y, k.hi ? 18 : 7, tip), key); }
// rocket bell: exit radius re at y, throat rt, length L, regen look; ext = radiative extension fraction (vacuum)
export function bell(k, re, L, x, y, z, o = {}) {
  const rt = o.rt || re * 0.38, pts = [], n = k.mid ? 4 : k.hi ? 12 : 5; // mid 4 rows (titan: 33 bells -> -1.6k tris)
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(1 - t, 1.7), t * L)); }
  k.add(new THREE.LatheGeometry(pts, k.mid ? 12 : k.hi ? 28 : 10), o.ext ? 'bellx' : 'bell', xf([x, y, z]));
  if (!k.hi) return;
  if (k.mid) { const hp = o.head ?? L * 0.42; tube(k, rt * 1.25, rt * 1.1, hp * 0.55, y + L, 'grey', { x, z, seg: 8 }); k.add(new THREE.SphereGeometry(rt * 1.15, 8, 3, 0, 2 * PI, 0, PI / 2), 'dark', xf([x, y + L + hp * 0.55, z])); return; } // mid: chamber + dome only
  k.add(new THREE.TorusGeometry(re, re * 0.025, 4, 28), 'dark', xf([x, y + 0.01, z], [PI / 2, 0, 0])); // exit stiffener
  const hp = o.head ?? L * 0.42; // powerhead: chamber, injector dome, turbopump, gimbal
  tube(k, rt * 1.25, rt * 1.1, hp * 0.55, y + L, 'grey', { x, z, seg: 14 });
  k.add(new THREE.SphereGeometry(rt * 1.15, 12, 6, 0, 2 * PI, 0, PI / 2), 'dark', xf([x, y + L + hp * 0.55, z]));
  k.add(new THREE.CylinderGeometry(rt * 0.45, rt * 0.45, hp * 0.6, 10), 'grey', xf([x + rt * 1.6, y + L + hp * 0.3, z]));
  k.add(new THREE.TorusGeometry(rt * 1.05, rt * 0.12, 4, 12, PI), 'grey', xf([x + rt * 0.6, y + L + hp * 0.2, z], [0, 0, PI / 2]));
}
// a ring layout of engines: [count, radius, angle offset]
export function ringPos(rings) { const out = []; for (const [n, r, a0 = 0] of rings) for (let i = 0; i < n; i++) { const a = a0 + i / n * 2 * PI; out.push([Math.cos(a) * r, Math.sin(a) * r]); } return out; }
// grid fins: n lattice panels around radius r at height y (w x h), with titanium frame and hinge
export function gridFins(k, r, y, w, h, n = 4, a0 = PI / 4, deploy = 1) {
  for (let i = 0; i < n; i++) { const a = a0 + i / n * 2 * PI; k.push(xf([Math.cos(a) * r, y, Math.sin(a) * r], [0, -a, 0]));
    k.push(xf([0, 0, 0], [0, 0, -deploy * PI / 2 * 0.98])); // hinged at the hull: stowed points up, deployed sticks out
    if (k.hi) { // real lattice: +-45 deg blades with depth, so the fin reads as open cells from any angle (edge-on included)
      const d = 0.38, t = 0.045, step = k.mid ? 0.8 : 0.26, y0 = 0.1; // mid: coarse lattice (same silhouette, ~1/3 the blades)
      for (const sg of [1, -1]) for (let c = -(w + h); c <= w + h; c += step) { // blade line: v = sg*u + c, clipped to |u|<=w/2, 0<=v<=h
        let u0 = -w / 2, u1 = w / 2; const vAt = u => sg * u + c;
        const lo = sg > 0 ? (0 - c) : (c - h), hi = sg > 0 ? (h - c) : (c - 0); u0 = Math.max(u0, Math.min(lo, hi)); u1 = Math.min(u1, Math.max(lo, hi));
        if (u1 - u0 < 0.05) continue; const um = (u0 + u1) / 2, L = (u1 - u0) * Math.SQRT2;
        k.add(new THREE.BoxGeometry(d, L, t), 'tiframe', xf([0, y0 + vAt(um), um], [sg * PI / 4, 0, 0]));
      }
      const ft = 0.1; for (const [px, py, sx, sy] of [[0, 0.1, w, ft], [0, h + 0.1, w, ft], [-w / 2, h / 2 + 0.1, ft, h], [w / 2, h / 2 + 0.1, ft, h]]) k.add(new THREE.BoxGeometry(0.42, sy, sx), 'tiframe', xf([0, py, px]));
    } else k.add(new THREE.BoxGeometry(0.12, h, w), 'tiframe', xf([0, h / 2 + 0.1, 0]));
    k.pop(); k.add(new THREE.BoxGeometry(0.5, 0.6, 0.6), 'dark', xf([0.1, 0, 0])); k.pop(); }
}
// landing legs (brief: carbon/honeycomb, hinge at the base, stowed flush with the foot pad UP, helium telescoping
// deployment arm from the leg tip to the fuselage, small pusher). Separate animatable group; t=0 stowed, 1 deployed.
export function legs(KitC, detail, r, len, y, n = 4, a0 = PI / 4) {
  const g = new THREE.Group(); g.name = 'legs'; g.userData.pivots = []; g.userData.arms = [];
  const unit = new THREE.CylinderGeometry(1, 1, 1, 8); unit.translate(0, 0.5, 0);
  for (let i = 0; i < n; i++) { const a = a0 + i / n * 2 * PI, piv = new THREE.Group(); piv.position.set(Math.cos(a) * (r + 0.02), y, Math.sin(a) * (r + 0.02)); piv.rotation.y = -a;
    const k = new KitC(detail), lean = detail !== 'hi', K = key => lean ? 'carbon' : key; // mid/lo: one material per leg, no telescoping arms (draw calls)
    // tapered triangular-section leg: wide at the hinge, narrow at the foot; sits flush (0.22 m proud of the hull)
    const sh = new THREE.Shape(); sh.moveTo(-0.95, 0); sh.lineTo(0.95, 0); sh.lineTo(0.42, len); sh.lineTo(-0.42, len); sh.closePath();
    const lg = new THREE.ExtrudeGeometry(sh, detail === 'hi' ? { depth: 0.51, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.04, bevelSegments: 1 } : { depth: 0.55, bevelEnabled: false }); // plan #4: hi bevel catches edge light k.add(lg, K('carbon'), new THREE.Matrix4().makeRotationY(PI / 2));
    k.add(new THREE.BoxGeometry(0.06, len * 0.92, 0.1), K('grey'), xf([0.48, len * 0.5, 0])); // centre spine / arm recess
    if (detail === 'hi') for (const sg of [-1, 1]) { const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.lineTo(sg * 0.9, 0); hs.lineTo(sg * 0.4, len); hs.lineTo(0, len); hs.closePath(); // plan #4: shallow centre crease,
      k.add(new THREE.ExtrudeGeometry(hs, { depth: 0.03, bevelEnabled: false }), K('carbon'), new THREE.Matrix4().makeTranslation(0.55, 0, 0).multiply(new THREE.Matrix4().makeRotationY(PI / 2 - sg * 0.12))); } // two tilted faces -> light/dark split from low angles
    k.add(new THREE.CylinderGeometry(0.62, 0.72, 0.26, k.hi ? 16 : 8), K('dark'), xf([0.2, len + 0.02, 0], [0, 0, PI / 2])); // foot pad (crush core)
    k.add(new THREE.BoxGeometry(0.3, 0.5, 1.2), K('dark'), xf([0.1, 0.25, 0])); // hinge clevis
    piv.add(k.build('leg')); g.add(piv); g.userData.pivots.push(piv);
    if (lean) continue; if (!g.userData.armMesh) { const uni = unit.toNonIndexed(), geo = mergeGeometries(Array.from({ length: 2 * n }, () => uni.clone())); geo.userData.noShare = true; const am = new THREE.Mesh(geo, mat('grey')); am.name = 'arms'; g.add(am);
      g.userData.armMesh = am; g.userData.armBase = { pos: uni.attributes.position.array.slice(), nor: uni.attributes.normal.array.slice(), nv: uni.attributes.position.count }; uni.dispose(); }
    g.userData.arms.push({ piv, idx: i, A: new THREE.Vector3(Math.cos(a) * (r - 0.1), y + len * 0.42, Math.sin(a) * (r - 0.1)), tipL: new THREE.Vector3(0.24, len * 0.86, 0) }); }
  setLegs(g, 0); if (detail !== 'hi') packLegs(g); return g;
}
// mid/lo LOD: all legs of a set live in ONE mesh (1 draw call, was 4 on mid / 2 on lo). Each leg's pivot-local geometry is
// kept as a base copy; setLegs rotates the pivots and rewrites the vertices, so deployment stays smooth on every LOD.
function packLegs(g) { const parts = [];
  for (const piv of g.userData.pivots) { piv.updateMatrixWorld(true); const inv = piv.matrixWorld.clone().invert(), gs = [];
    piv.traverse(o => { if (!o.isMesh) return; let x = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); /* packed legs keep uv: the carbon material samples it (was a missing-uv warning) */ gs.push(x.applyMatrix4(inv.clone().multiply(o.matrixWorld))); });
    const one = gs.length > 1 ? mergeGeometries(gs) : gs[0]; parts.push({ piv, pos: one.attributes.position.array.slice(), nor: one.attributes.normal.array.slice(), uv: one.attributes.uv.array.slice(), nv: one.attributes.position.count });
    for (const x of gs) x.dispose(); if (one !== gs[0]) one.dispose(); piv.traverse(o => { if (o.isMesh && !o.geometry.userData.shared) o.geometry.dispose(); }); piv.clear(); }
  const tot = parts.reduce((s, p) => s + p.nv, 0), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tot * 3), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(tot * 3), 3));
  const UV = new Float32Array(tot * 2); geo.userData.noShare = true; let off = 0; for (const p of parts) { p.off = off; UV.set(p.uv, off * 2); off += p.nv; } geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); // uv is static (deploy only moves position/normal)
  const m = new THREE.Mesh(geo, mat('carbon')); m.name = 'legs:packed'; g.add(m); g.userData.pack = { mesh: m, parts }; setLegs(g, g.userData.t || 0); }
function packWrite(g) { const { mesh, parts } = g.userData.pack, a = mesh.geometry.attributes, P = a.position.array, N = a.normal.array;
  for (const p of parts) { p.piv.updateMatrix(); const M = p.piv.matrix, nm = _NM.getNormalMatrix(M);
    for (let v = 0; v < p.nv; v++) { const j = v * 3, o = (p.off + v) * 3; _P.fromArray(p.pos, j).applyMatrix4(M).toArray(P, o); _S2.fromArray(p.nor, j).applyMatrix3(nm).normalize().toArray(N, o); } }
  a.position.needsUpdate = a.normal.needsUpdate = true; mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere(); } // bounds follow the deploy (raycast/culling)
export function setLegs(g, t) { for (const p of g.userData.pivots) p.rotation.z = -t * 2.0; g.userData.t = t; if (g.userData.pack) packWrite(g);
  for (const m of g.userData.arms || []) { m.piv.updateMatrix(); _B.copy(m.tipL).applyMatrix4(m.piv.matrix); _d.subVectors(_B, m.A); const L = _d.length(); _d.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _d);
    // rockets-3: arms are 2 InstancedMeshes per leg set (was 2 meshes per leg) -> -6 draw calls on hi
    // rockets-3: all telescoping arms live in ONE mesh whose vertices are rewritten here (was 2 meshes per leg -> -7 draw calls)
    armWrite(g, 2 * m.idx, _M.compose(m.A, q, _S.set(0.16, L * 0.55, 0.16))); armWrite(g, 2 * m.idx + 1, _M.compose(_P.copy(m.A).addScaledVector(_d, L * 0.5), q, _S.set(0.1, L * 0.5, 0.1))); }
  if (g.userData.armMesh) { const G = g.userData.armMesh.geometry, a = G.attributes; a.position.needsUpdate = a.normal.needsUpdate = true; G.computeBoundingBox(); G.computeBoundingSphere(); } } // arms bounds follow the deploy (culling on)
function armWrite(g, copy, M) { const B = g.userData.armBase, a = g.userData.armMesh.geometry.attributes, P = a.position.array, N = a.normal.array, o = copy * B.nv * 3, nm = _NM.getNormalMatrix(M);
  for (let v = 0; v < B.nv; v++) { const j = v * 3; _P.fromArray(B.pos, j).applyMatrix4(M).toArray(P, o + j); _S2.fromArray(B.nor, j).applyMatrix3(nm).normalize().toArray(N, o + j); } }
const _NM = new THREE.Matrix3(), _S2 = new THREE.Vector3();
const _B = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const _M = new THREE.Matrix4(), _S = new THREE.Vector3(), _P = new THREE.Vector3();
// decal strip: a cylinder section just outside radius r, height h, centred on angle ac, arc width (radians)
export function decal(k, slot, r, y, h, ac = 0, arc = 1.1) { if (!k.hi) return; k.add(new THREE.CylinderGeometry(r * 1.004, r * 1.004, h, 24, 1, true, ac - arc / 2 + PI / 2, arc), 'decal:' + slot, xf([0, y + h / 2, 0])); }
// external raceway / cable tray along a tank
export function raceway(k, r, y0, y1, a = PI / 2, key = 'paint:0,0') { k.add(new THREE.BoxGeometry(0.14, y1 - y0, 0.32), key, xf([Math.cos(a) * (r + 0.1), (y0 + y1) / 2, Math.sin(a) * (r + 0.1)], [0, -a, 0])); }
export function ring(k, r, y, t, key = 'dark') { tube(k, r + t, r + t, t * 1.6, y, key); }
// strut between two points
export function strut(k, a, b, rad, key) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), g = new THREE.CylinderGeometry(rad, rad, L, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); k.add(g, key, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))); }
