// Space-center site kit: turns a pure-data site layout (gfx/sites/site_<id>.js) into merged, LOD'd meshes.
// Every static part is baked into ONE merged mesh per material per placed group (no instanced meshes: they leak on r172).
// API: buildSite(S, { detail: 'hi'|'mid'|'lo', ground }) -> Group   (local frame, see geo.js; userData { id, tris, lat, lon })
//      buildSiteLOD(S, { phone }) -> THREE.LOD (near = hi, or mid on phones; mid; lo)
//      placeSite(obj, S) applies the site's body-frame matrix;  dispose / release free geometry (materials are shared).
import * as THREE from 'three/webgpu';
import { mergeGeometries, weakDisposeListeners, dispose, release } from '../vehicles/kit.js?v=art1';
import { siteMatrix, localOffset, localBasis, BODY_R } from './geo.js?v=art1';
export { dispose, release, BODY_R };
export const LOD_DIST = { mid: 1500, lo: 6000 }; // metres from the camera
const MATS = new Map(), S = THREE.MeshStandardMaterial;
const MDEF = { concrete: [0xa8a49b, 0.95, 0], apron: [0x8e8b85, 0.9, 0], asphalt: [0x2c2d30, 0.92, 0], mark: [0xe8c22a, 0.6, 0], white: [0xf0efeb, 0.85, 0],
  clad: [0xd9dadc, 0.7, 0.15], band: [0x5a6f86, 0.6, 0.2], door: [0x3a3d42, 0.7, 0.4], tower: [0x7d4a2e, 0.65, 0.5], steel: [0x8c9198, 0.45, 0.85],
  tank: [0xeceae4, 0.4, 0.3], pipe: [0xb9bcc0, 0.4, 0.8], dark: [0x1e1f22, 0.7, 0.3], deck: [0x3b3e42, 0.85, 0.5], hull: [0x23272d, 0.6, 0.5],
  lamp: [0xfff2c8, 0.4, 0, 0xffe7a0], ground: [0x6f7452, 1, 0], sand: [0xc9b68e, 1, 0], sea: [0x15394f, 0.2, 0], regolith: [0x8d8a84, 1, 0],
  redsoil: [0x8f5a42, 1, 0], gold: [0xc9a043, 0.35, 1], solar: [0x1d2a4a, 0.3, 0.6], hab: [0xdedbd2, 0.6, 0.2], glass: [0x0c1218, 0.1, 0.3], green: [0x4d5a3a, 1, 0] };
export function smat(k) { if (MATS.has(k)) return MATS.get(k); const d = MDEF[k] || [0xff00ff, 1, 0];
  const m = new S({ color: d[0], roughness: d[1], metalness: d[2], ...(d[3] ? { emissive: d[3], emissiveIntensity: 2.2 } : {}) });
  if (k === 'mark') Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.name = 'site:' + k; m.userData.cached = true; weakDisposeListeners(m); MATS.set(k, m); return m; }
export const SEG = { hi: 20, mid: 10, lo: 6 };
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const M = (p = [0, 0, 0], ry = 0, s = [1, 1, 1]) => { _e.set(0, ry, 0); return new THREE.Matrix4().compose(_v.set(...p), _q.setFromEuler(_e), _s.set(...s)); };
// merge buffer: per material key; `tf` stack of placement matrices
export class SK { constructor(detail) { this.detail = detail; this.seg = SEG[detail]; this.hi = detail === 'hi'; this.lo = detail === 'lo'; this.b = new Map(); this.T = [new THREE.Matrix4()]; }
  push(m) { this.T.push(this.T.at(-1).clone().multiply(m)); return this; } pop() { this.T.pop(); return this; }
  add(geo, k, m) { const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m ? this.T.at(-1).clone().multiply(m) : this.T.at(-1)); (this.b.get(k) || this.b.set(k, []).get(k)).push(g); return this; }
  box(k, w, h, d, p = [0, 0, 0], ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), k, M([p[0], p[1] + h / 2, p[2]], ry)); } // p = bottom centre
  cyl(k, r0, r1, h, p = [0, 0, 0], seg = this.seg, open = false) { return this.add(new THREE.CylinderGeometry(r1, r0, h, Math.max(3, seg), 1, open), k, M([p[0], p[1] + h / 2, p[2]])); }
  sph(k, r, p, seg = this.seg) { return this.add(new THREE.SphereGeometry(r, Math.max(4, seg), Math.max(3, seg >> 1)), k, M(p)); }
  disc(k, r, p = [0, 0, 0], seg = this.seg * 2, y = 0.02) { const g = new THREE.CircleGeometry(r, Math.max(8, seg)); g.rotateX(-Math.PI / 2); return this.add(g, k, M([p[0], p[1] + y, p[2]])); }
  ring(k, r0, r1, p = [0, 0, 0], seg = this.seg * 2, y = 0.04) { const g = new THREE.RingGeometry(r0, r1, Math.max(8, seg)); g.rotateX(-Math.PI / 2); return this.add(g, k, M([p[0], p[1] + y, p[2]])); }
  flat(k, w, d, p = [0, 0, 0], ry = 0, y = 0.03) { const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); return this.add(g, k, M([p[0], p[1] + y, p[2]], ry)); }
  // square beam between two points (lattice members, pipes, arms)
  beam(k, a, b, t) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B); if (L < 1e-6) return this; const g = new THREE.BoxGeometry(t, L, t);
    const q = new THREE.Quaternion().setFromUnitVectors(Y, B.clone().sub(A).normalize()); return this.add(g, k, new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, _s.set(1, 1, 1))); }
  build(name) { const grp = new THREE.Group(); grp.name = name; let tris = 0;
    for (const [k, gs] of this.b) { const g = mergeGeometries(gs); for (const x of gs) x.dispose(); g.computeBoundingSphere(); const m = new THREE.Mesh(g, smat(k)); m.name = name + ':' + k; m.matrixAutoUpdate = false; if (k === 'mark') m.renderOrder = 1; grp.add(m); tris += g.attributes.position.count / 3; }
    grp.userData.tris = tris; return grp; } }

// ---------- parts (all take the kit, a layout item o, placed at o.at = [x, z] with o.rot radians) ----------
// lattice tower: square w x w, height h; hi = full lattice, mid = columns + bays, lo = solid box
export function lattice(K, w, h, k = 'tower', p = [0, 0, 0]) { const [x, y, z] = p, c = w / 2;
  if (K.lo) return K.box(k, w, h, w, p);
  const col = Math.max(0.4, w * 0.07), bay = K.hi ? 5 : 9, n = Math.max(1, Math.round(h / bay)), dy = h / n, P = [[-c, -c], [c, -c], [c, c], [-c, c]];
  for (const [a, b] of P) K.box(k, col, h, col, [x + a, y, z + b]);
  for (let i = 1; i <= n; i++) { const yy = y + i * dy; for (let j = 0; j < 4; j++) { const [a0, b0] = P[j], [a1, b1] = P[(j + 1) % 4];
    K.beam(k, [x + a0, yy, z + b0], [x + a1, yy, z + b1], col * 0.7); K.beam(k, [x + a0, yy - dy, z + b0], [x + a1, yy, z + b1], col * 0.45); } }
  if (!K.hi) K.box('dark', w * 0.55, h * 0.98, w * 0.55, p); // elevator core reads as a solid spine at mid
  return K; }
const parts = {
  pad(K, o) { const r = o.r || 60; K.disc('concrete', r, [0, 0, 0], K.seg * 2, 0.05); K.ring('mark', r * 0.92, r * 0.95);
    K.box('dark', o.trench || 12, 0.3, r * 1.6, [0, -0.2, r * 0.25]); // flame trench (dark slot in the hardstand)
    K.box('concrete', (o.trench || 12) + 4, 6, 10, [0, 0, -2]); // deflector/mount plinth
    const m = o.mount || 8; K.cyl('steel', m * 0.55, m * 0.5, 2, [0, 6, 0], K.seg, true);
    if (!K.lo) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; K.box('steel', 1.2, 6, 1.2, [Math.cos(a) * m * 0.45, 0, Math.sin(a) * m * 0.45]); }
    if (o.tower) { const t = o.tower; lattice(K, t.w || 10, t.h, 'tower', [t.x ?? -(r * 0.4), 0, t.z ?? 0]);
      K.cyl('steel', 0.4, 0.15, t.mast || 20, [t.x ?? -(r * 0.4), t.h, t.z ?? 0], 6); // lightning mast
      for (const a of t.arms || []) K.box('steel', a.len, 2.4, 2.6, [(t.x ?? -(r * 0.4)) + (t.w || 10) / 2 + a.len / 2, a.y, t.z ?? 0]); } // service/crew arms toward the vehicle
    if (o.hold !== false && !K.lo) for (const s of [-1, 1]) K.box('concrete', 6, 3, 6, [s * r * 0.6, 0, -r * 0.55]); }, // pad terminal rooms
  catch(K, o) { const w = o.w || 12, h = o.h || 145; lattice(K, w, h, 'steel'); K.cyl('steel', 0.5, 0.15, 12, [0, h, 0], 6);
    const ay = o.armY || h * 0.75, L = o.arm || 35; for (const s of [-1, 1]) { K.box('steel', 3, 4, L, [s * (w / 2 + 2), ay, w / 2 + L / 2]); if (!K.lo) K.box('dark', 1.2, 1.2, L * 0.9, [s * (w / 2 + 2), ay - 1.2, w / 2 + L / 2]); }
    K.box('steel', w + 6, 8, 6, [0, ay - 2, w / 2 + 1]); // carriage
    if (o.qd) K.box('steel', 2.5, 3, o.qd, [0, o.qdY || h * 0.6, w / 2 + o.qd / 2]); // ship quick-disconnect arm
    const r = o.mountR || 12; K.cyl('concrete', r * 1.1, r, 18, [0, 0, w / 2 + L * 0.85], K.seg); K.cyl('steel', r * 0.75, r * 0.8, 1.5, [0, 18, w / 2 + L * 0.85], K.seg, true);
    if (!K.lo) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.box('concrete', 2.5, 18, 2.5, [Math.cos(a) * r * 1.1, 0, w / 2 + L * 0.85 + Math.sin(a) * r * 1.1]); } // mount legs
    K.disc('concrete', o.r || 70, [0, 0, w / 2 + L * 0.5], K.seg * 2, 0.05); },
  vab(K, o) { const w = o.w, d = o.d, h = o.h; K.box('clad', w, h, d);
    if (!K.lo) { const n = K.hi ? 6 : 3; for (let i = 0; i < n; i++) K.box('band', w + 0.4, 1.2, d + 0.4, [0, h * (i + 1) / (n + 1), 0]);
      const nd = o.doors || 2; for (let i = 0; i < nd; i++) { const x = (i - (nd - 1) / 2) * w / nd; K.box('door', w / nd * 0.5, h * 0.85, 0.6, [x, 0, d / 2]); K.box('door', w / nd * 0.5, h * 0.85, 0.6, [x, 0, -d / 2]); }
      K.box('clad', w * 0.6, h * 0.35, d * 0.5, [w * 0.8, 0, 0]); } // low bay
    K.box('dark', w + 1, 0.8, d + 1, [0, h, 0]); },
  hangar(K, o) { const w = o.w || 60, d = o.d || 90, h = o.h || 22; K.box('clad', w, h * 0.6, d);
    const g = new THREE.CylinderGeometry(w / 2, w / 2, d, Math.max(4, K.seg), 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.scale(1, (h * 0.4) / (w / 2), 1); K.add(g, 'white', M([0, h * 0.6, 0]));
    if (!K.lo) K.box('door', w * 0.8, h * 0.55, 0.6, [0, 0, d / 2]); },
  tanks(K, o) { const n = o.n || 3, r = o.r || 8, gap = r * 2.6;
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * gap; if (o.style === 'h') { const g = new THREE.CylinderGeometry(r, r, r * 5, Math.max(4, K.seg)); g.rotateX(Math.PI / 2); K.add(g, 'tank', M([x, r + 1.5, 0])); if (!K.lo) { K.box('concrete', r * 1.6, 1.5, 1.5, [x, 0, -r * 1.8]); K.box('concrete', r * 1.6, 1.5, 1.5, [x, 0, r * 1.8]); } }
      else if (o.style === 'v') { K.cyl('tank', r, r, o.h || r * 4, [x, 0, 0]); K.cyl('tank', r, r * 0.6, r * 0.5, [x, o.h || r * 4, 0]); }
      else { K.sph('tank', r, [x, r * 1.25, 0]); if (!K.lo) for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + Math.PI / 4; K.box('steel', 0.8, r * 0.9, 0.8, [x + Math.cos(a) * r * 0.7, 0, Math.sin(a) * r * 0.7]); } } }
    if (!K.lo) { K.box('pipe', n * gap, 1.2, 1.2, [0, 1.5, r * 1.6]); K.flat('apron', n * gap + r, r * 4.5, [0, 0, 0]); } },
  road(K, o) { const w = o.w || 10, P = o.pts; for (let i = 1; i < P.length; i++) { const [x0, z0] = P[i - 1], [x1, z1] = P[i], L = Math.hypot(x1 - x0, z1 - z0);
      K.flat('asphalt', w, L + w * 0.5, [(x0 + x1) / 2, 0, (z0 + z1) / 2], Math.atan2(x1 - x0, z1 - z0), 0.025); if (o.line && !K.lo) K.flat('mark', 0.3, L, [(x0 + x1) / 2, 0, (z0 + z1) / 2], Math.atan2(x1 - x0, z1 - z0), 0.035); } },
  masts(K, o) { for (const [x, z] of o.pts) { const h = o.h || 40; K.cyl('steel', 0.7, 0.35, h, [x, 0, z], 6); K.box('lamp', 4, 2, 1, [x, h, z]); if (K.hi) K.box('steel', 4.6, 0.4, 1.4, [x, h - 0.4, z]); } },
  water(K, o) { const h = o.h || 60, r = o.r || 9; if (!K.lo) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; K.beam('steel', [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.35, h, Math.sin(a) * r * 0.35], 0.9); }
    K.cyl('steel', 1.2, 1.2, h, [0, 0, 0], 6); K.sph('white', r, [0, h + r * 0.6, 0]); },
  lz(K, o) { const r = o.r || 45; K.disc('concrete', r); K.ring('mark', r * 0.8, r * 0.86); const t = r * 0.06; K.flat('mark', t * 2, r * 1.2, [0, 0, 0], Math.PI / 4, 0.045); K.flat('mark', t * 2, r * 1.2, [0, 0, 0], -Math.PI / 4, 0.045);
    if (!K.lo) K.disc('apron', r * 1.35, [0, 0, 0], K.seg * 2, 0.01); },
  droneship(K, o) { const L = 92, W = 52; K.box('hull', W, 6, L, [0, -4, 0]); K.box('deck', W - 2, 0.4, L - 2, [0, 2, 0]); K.disc('sea', 900, [0, 0, 0], K.seg * 2, -0.2);
    K.ring('mark', 13, 14.5, [0, 2.4, 0]); K.flat('mark', 2.2, 24, [0, 2.4, 0], Math.PI / 4, 0.05); K.flat('mark', 2.2, 24, [0, 2.4, 0], -Math.PI / 4, 0.05);
    for (const s of [-1, 1]) { K.box('hull', 1.2, 3, L - 4, [s * (W / 2 - 0.6), 2, 0]); if (!K.lo) { K.box('tank', 6, 5, 8, [s * (W / 2 - 4), 2, -L / 2 + 6]); K.box('tank', 6, 5, 8, [s * (W / 2 - 4), 2, L / 2 - 6]); K.cyl('dark', 2.2, 2.2, 3, [s * (W / 2 - 4), -7, -L / 2 + 6], K.seg); K.cyl('dark', 2.2, 2.2, 3, [s * (W / 2 - 4), -7, L / 2 - 6], K.seg); } }
    if (K.hi) K.box('steel', W - 6, 0.6, 1, [0, 2.4, -L / 2 + 2]); },
  block(K, o) { K.box(o.mat || 'concrete', o.w || 20, o.h || 6, o.d || 14); if (o.roof && !K.lo) K.box('dark', (o.w || 20) * 0.3, 2, (o.d || 14) * 0.3, [0, o.h || 6, 0]); },
  stand(K, o) { const h = o.h || 30; lattice(K, 8, h, 'steel'); K.box('concrete', 16, 4, 16); K.box('steel', 12, 1.5, 12, [0, h, 0]); }, // static-fire stand
  hab(K, o) { const n = o.n || 3, r = o.r || 4; for (let i = 0; i < n; i++) { const g = new THREE.CylinderGeometry(r, r, r * 3, Math.max(4, K.seg)); g.rotateZ(Math.PI / 2); K.add(g, 'hab', M([0, r + 0.6, i * r * 2.4], 0)); if (!K.lo) K.sph('hab', r * 0.96, [r * 1.5, r + 0.6, i * r * 2.4], Math.max(4, K.seg >> 1)); }
    if (!K.lo) K.box('regolith', r * 5, r * 0.8, n * r * 2.4 + r * 2, [0, 0, (n - 1) * r * 1.2 - r * 3.2]); },
  solar(K, o) { const n = o.n || 4; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 12; if (!K.lo) K.cyl('steel', 0.2, 0.2, 2.5, [x, 0, 0], 4); const g = new THREE.BoxGeometry(10, 0.15, 5); g.rotateX(-0.5); K.add(g, 'solar', M([x, 2.8, 0])); } },
  berm(K, o) { const r = o.r || 40; K.add(new THREE.TorusGeometry(r, o.t || 2.5, 4, Math.max(8, K.seg * 2)).rotateX(Math.PI / 2), o.mat || 'regolith', M([0, 0.4, 0])); },
  dish(K, o) { const r = o.r || 5; K.cyl('steel', 0.4, 0.4, o.h || 6, [0, 0, 0], 6); const g = new THREE.SphereGeometry(r, Math.max(4, K.seg), 3, 0, Math.PI * 2, 0, 0.7); g.rotateX(-0.9); K.add(g, 'white', M([0, (o.h || 6) + 1, 0])); },
  ground(K, o) { K.disc(o.mat || 'ground', o.r || 2500, [0, 0, 0], K.seg * 3, -0.05); if (o.sea) K.flat('sea', o.sea.w || 12000, o.sea.d || 12000, [o.sea.x || 0, 0, o.sea.z || 0], 0, -0.1); },
};
export const PART_KINDS = Object.keys(parts);
// build one placed group (the main complex, or a remote station such as a droneship)
function buildGroup(S, items, detail, name, opts) { const K = new SK(detail);
  for (const o of items) { if (o.k === 'ground' && !opts.ground) continue; if (o.min && ['lo', 'mid', 'hi'].indexOf(detail) < ['lo', 'mid', 'hi'].indexOf(o.min)) continue;
    const [x, z] = o.at || [0, 0]; K.push(M([x, o.y || 0, z], o.rot || 0)); parts[o.k](K, o); K.pop(); }
  return K.build(name); }
export function buildSite(S, { detail = 'hi', ground = false } = {}) { const g = new THREE.Group(); g.name = 'site:' + S.id;
  const main = buildGroup(S, S.layout, detail, S.id, { ground }); g.add(main); let tris = main.userData.tris;
  for (const st of S.stations || []) { const s = buildGroup(S, st.layout, detail, S.id + ':' + st.id, { ground }); const R = BODY_R[S.body] || S.R;
    const off = localOffset(S.body, S.lat, S.lon, st.lat, st.lon, R); s.matrix.fromArray(localBasis(S.body, S.lat, S.lon, st.lat, st.lon)).setPosition(off[0], off[1], off[2]); s.matrixAutoUpdate = false; s.userData.station = st.id;
    g.add(s); tris += s.userData.tris; }
  Object.assign(g.userData, { id: S.id, body: S.body, lat: S.lat, lon: S.lon, detail, tris, site: true }); return g; }
export function buildSiteLOD(S, { phone = false } = {}) { const L = new THREE.LOD(); L.name = 'siteLOD:' + S.id;
  const near = buildSite(S, { detail: phone ? 'mid' : 'hi' }), mid = buildSite(S, { detail: 'mid' }), lo = buildSite(S, { detail: 'lo' });
  L.addLevel(near, 0); L.addLevel(mid, LOD_DIST.mid); L.addLevel(lo, LOD_DIST.lo); Object.assign(L.userData, { id: S.id, near, mid, lo }); return L; }
// place a built site (or LOD) in its body's frame (metres from the body centre)
export function placeSite(obj, S, R = BODY_R[S.body] || S.R) { obj.matrix.fromArray(siteMatrix(S.body, S.lat, S.lon, R, S.alt || 0)); obj.matrix.decompose(obj.position, obj.quaternion, obj.scale); return obj; }
export function disposeSite(obj) { if (obj.isLOD) { for (const l of obj.levels) dispose(l.object); obj.removeFromParent(); obj.levels.length = 0; return; } dispose(obj); }
