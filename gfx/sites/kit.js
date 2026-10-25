// Space-center site kit: turns a pure-data site layout (gfx/sites/site_<id>.js) into merged, LOD'd meshes.
// Every static part is baked into ONE merged mesh per material per placed group (no instanced meshes: they leak on r172).
// API: buildSite(S, { detail: 'hi'|'mid'|'lo', ground }) -> Group   (local frame, see geo.js; userData { id, tris, lat, lon })
//      buildSiteLOD(S, { phone }) -> THREE.LOD (near = hi, or mid on phones; mid; lo)
//      placeSite(obj, S) applies the site's body-frame matrix;  dispose / release free geometry (materials are shared).
import * as THREE from 'three/webgpu';
import { weakDisposeListeners, dispose, release } from '../vehicles/kit.js?v=f5.9-0';
import { siteMatrix, localOffset, localBasis, BODY_R } from './geo.js?v=f5.9-0';
export { dispose, release, BODY_R };
export const LOD_DIST = { mid: 1500, lo: 6000 }; // metres from the camera
const MATS = new Map(), TEX = new Map(), S = THREE.MeshStandardMaterial;
// procedural PBR detail maps (canvas, cached, tiled in world space by SK.add's box-projected UVs, 8 m per tile)
function rnd(seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvasTex(key, draw, size = 256) { if (TEX.has(key)) return TEX.get(key); if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') return null;
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), { width: size, height: size }), g = c.getContext('2d'); draw(g, size, rnd(key.length * 977 + key.charCodeAt(0)));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = key.endsWith(':r') ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.cached = true; TEX.set(key, t); return t; }
const speckle = (g, n, r, a, lo, hi) => { for (let i = 0; i < 2600; i++) { const v = lo + (hi - lo) * a(); g.fillStyle = `rgba(${v},${v},${v},${0.08 + 0.12 * a()})`; g.fillRect(a() * n, a() * n, 1 + r * a(), 1 + r * a()); } };
const TEXDEF = {
  concrete: (g, n, a) => { g.fillStyle = '#b4b0a7'; g.fillRect(0, 0, n, n); speckle(g, n, 3, a, 90, 230); g.strokeStyle = 'rgba(60,58,54,0.55)'; g.lineWidth = 1.5; g.strokeRect(0, 0, n, n); g.beginPath(); g.moveTo(n / 2, 0); g.lineTo(n / 2, n); g.stroke(); // slab joints
    for (let i = 0; i < 7; i++) { const x = a() * n, y = a() * n, r = 10 + 40 * a(), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(70,64,55,0.28)'); gr.addColorStop(1, 'rgba(70,64,55,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); } }, // stains
  steel: (g, n, a) => { g.fillStyle = '#9aa0a7'; g.fillRect(0, 0, n, n); for (let y = 0; y < n; y++) { g.fillStyle = `rgba(255,255,255,${0.04 * a()})`; g.fillRect(0, y, n, 1); } speckle(g, n, 2, a, 60, 200);
    const gr = g.createLinearGradient(0, n, 0, 0); gr.addColorStop(0, 'rgba(70,55,40,0.35)'); gr.addColorStop(0.35, 'rgba(70,55,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, // grime from below
  rust: (g, n, a) => { g.fillStyle = '#86502f'; g.fillRect(0, 0, n, n); speckle(g, n, 4, a, 40, 170); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${120 + 60 * a()},${60 + 30 * a()},30,0.25)`; g.fillRect(a() * n, a() * n, 2 + 4 * a(), 8 + 40 * a()); } }, // rust streaks
  clad: (g, n, a) => { g.fillStyle = '#d6d7d9'; g.fillRect(0, 0, n, n); for (let x = 0; x < n; x += 8) { g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(x, 0, 2, n); } speckle(g, n, 2, a, 120, 220);
    const gr = g.createLinearGradient(0, n, 0, n * 0.6); gr.addColorStop(0, 'rgba(80,70,60,0.35)'); gr.addColorStop(1, 'rgba(80,70,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); }, // ribbed siding + splash grime
  asphalt: (g, n, a) => { g.fillStyle = '#313236'; g.fillRect(0, 0, n, n); speckle(g, n, 2, a, 20, 110); },
  tank: (g, n, a) => { g.fillStyle = '#eceae4'; g.fillRect(0, 0, n, n); speckle(g, n, 2, a, 170, 255); for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(110,95,80,0.12)'; g.fillRect(a() * n, a() * n * 0.4 + n * 0.6, 3 + 6 * a(), 20 + 60 * a()); } },
  ground: (g, n, a) => { g.fillStyle = '#6f7452'; g.fillRect(0, 0, n, n); speckle(g, n, 6, a, 50, 140); },
  sand: (g, n, a) => { g.fillStyle = '#c9b68e'; g.fillRect(0, 0, n, n); speckle(g, n, 5, a, 120, 230); },
  regolith: (g, n, a) => { g.fillStyle = '#8d8a84'; g.fillRect(0, 0, n, n); speckle(g, n, 5, a, 50, 190); for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(40,40,40,0.25)'; g.beginPath(); g.arc(a() * n, a() * n, 3 + 14 * a(), 0, 7); g.stroke(); } }, // small craters
  redsoil: (g, n, a) => { g.fillStyle = '#8f5a42'; g.fillRect(0, 0, n, n); speckle(g, n, 5, a, 50, 170); },
};
const MDEF = { concrete: [0xffffff, 0.95, 0, 'concrete'], apron: [0xc9c6c0, 0.9, 0, 'concrete'], asphalt: [0xffffff, 0.92, 0, 'asphalt'], mark: [0xe8c22a, 0.6, 0], white: [0xf2f1ed, 0.85, 0],
  clad: [0xffffff, 0.7, 0.15, 'clad'], band: [0x5a6f86, 0.6, 0.2], door: [0xa9adb2, 0.55, 0.6, 'clad'], tower: [0xffffff, 0.75, 0.45, 'rust'], steel: [0xffffff, 0.45, 0.8, 'steel'],
  tank: [0xffffff, 0.4, 0.3, 'tank'], pipe: [0xc4c7ca, 0.4, 0.8, 'steel'], dark: [0x2a2b2e, 0.85, 0.2, 'concrete'], deck: [0x4a4d52, 0.85, 0.5, 'steel'], hull: [0x2e333a, 0.6, 0.5, 'steel'],
  lamp: [0xfff2c8, 0.4, 0, null, 0xffe7a0], flood: [0xffffff, 0.3, 0, null, 0xfff4dc], win: [0x2a2a22, 0.3, 0, null, 0xffc874], beacon: [0xff3020, 0.4, 0, null, 0xff2010], ground: [0xffffff, 1, 0, 'ground'], sand: [0xffffff, 1, 0, 'sand'], sea: [0x15394f, 0.2, 0], regolith: [0xffffff, 1, 0, 'regolith'],
  redsoil: [0xffffff, 1, 0, 'redsoil'], gold: [0xc9a043, 0.35, 1], solar: [0x1d2a4a, 0.3, 0.6], hab: [0xdedbd2, 0.6, 0.2, 'tank'], glass: [0x0c1218, 0.1, 0.3], green: [0x4d5a3a, 1, 0],
  fence: [0x9da3a8, 0.5, 0.7], red: [0xb3241c, 0.5, 0.2], water: [0x2f6f8f, 0.15, 0] };
export function smat(k) { if (MATS.has(k)) return MATS.get(k); const d = MDEF[k] || [0xff00ff, 1, 0], map = d[3] ? canvasTex(d[3], TEXDEF[d[3]]) : null;
  const m = new S({ color: d[0], roughness: d[1], metalness: d[2], vertexColors: true, ...(map ? { map } : {}), ...(d[4] ? { emissive: d[4], emissiveIntensity: k === 'flood' ? 4 : k === 'win' ? 1.6 : 2.4 } : {}) });
  if (k === 'mark') Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.name = 'site:' + k; m.userData.cached = true; weakDisposeListeners(m); MATS.set(k, m); return m; }
// merge non-indexed geometries with position/normal/uv/color
function mergeGeometries(gs) { const out = new THREE.BufferGeometry(); for (const [a, n] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) { let len = 0; for (const g of gs) len += g.attributes[a].array.length;
  const arr = new Float32Array(len); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, n)); } return out; }
export const SEG = { hi: 20, mid: 8, lo: 6 };
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
const M = (p = [0, 0, 0], ry = 0, s = [1, 1, 1]) => { _e.set(0, ry, 0); return new THREE.Matrix4().compose(_v.set(...p), _q.setFromEuler(_e), _s.set(...s)); };
// merge buffer: per material key; `tf` stack of placement matrices
export class SK { constructor(detail) { this.detail = detail; this.seg = SEG[detail]; this.hi = detail === 'hi'; this.lo = detail === 'lo'; this.b = new Map(); this.T = [new THREE.Matrix4()]; this.base = 0; this.lights = []; this.noAO = new Set(['mark', 'lamp', 'flood', 'win', 'beacon', 'sea', 'ground', 'sand', 'regolith', 'redsoil', 'asphalt', 'water']); }
  push(m) { this.T.push(this.T.at(-1).clone().multiply(m)); return this; } pop() { this.T.pop(); return this; }
  add(geo, k, m) { const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); for (const a of Object.keys(g.attributes)) if (!['position', 'normal'].includes(a)) g.deleteAttribute(a);
    g.applyMatrix4(m ? this.T.at(-1).clone().multiply(m) : this.T.at(-1)); const P = g.attributes.position.array, N = g.attributes.normal.array, c = P.length / 3, uv = new Float32Array(c * 2), col = new Float32Array(c * 3), T = 8;
    for (let i = 0; i < c; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], nx = Math.abs(N[i * 3]), ny = N[i * 3 + 1], nz = Math.abs(N[i * 3 + 2]);
      if (Math.abs(ny) >= nx && Math.abs(ny) >= nz) { uv[i * 2] = x / T; uv[i * 2 + 1] = z / T; } else if (nx >= nz) { uv[i * 2] = z / T; uv[i * 2 + 1] = y / T; } else { uv[i * 2] = x / T; uv[i * 2 + 1] = y / T; }
      // baked AO: contact shadow near the ground (y local to the placed item), underside faces darker, slight sky term on tops
      const h = y - this.base, ao = Math.min(1, (0.5 + 0.5 * Math.min(1, Math.max(0, h) / 4)) * (ny < -0.5 ? 0.6 : 1) * (ny > 0.5 ? 1.05 : 0.92));
      col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = this.noAO.has(k) ? 1 : ao; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); (this.b.get(k) || this.b.set(k, []).get(k)).push(g); return this; }
  light(p, aim = [0, 0, 0], pri = 1) { const v = new THREE.Vector3(...p).applyMatrix4(this.T.at(-1)), a = new THREE.Vector3(...aim).applyMatrix4(this.T.at(-1)); this.lights.push({ p: v.toArray(), aim: a.toArray(), pri }); return this; }
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
// truss lattice tower: square w x w, height h. hi = X-braced bays on every face (4 m), mid = single diagonals (8 m) + core, lo = solid box
export function lattice(K, w, h, k = 'tower', p = [0, 0, 0]) { const [x, y, z] = p, c = w / 2;
  if (K.lo) return K.box(k, w, h, w, p);
  const col = Math.max(0.5, w * 0.07), bay = K.hi ? 4 : Math.max(8, h / 12), n = Math.max(1, Math.round(h / bay)), dy = h / n, P = [[-c, -c], [c, -c], [c, c], [-c, c]];
  for (const [a, b] of P) K.box(k, col, h, col, [x + a, y, z + b]);
  for (let i = 1; i <= n; i++) { const yy = y + i * dy; for (let j = 0; j < 4; j++) { const [a0, b0] = P[j], [a1, b1] = P[(j + 1) % 4];
    K.beam(k, [x + a0, yy, z + b0], [x + a1, yy, z + b1], col * 0.7); if (K.hi || j % 2 === 0) K.beam(k, [x + a0, yy - dy, z + b0], [x + a1, yy, z + b1], col * 0.4);
    if (K.hi) K.beam(k, [x + a1, yy - dy, z + b1], [x + a0, yy, z + b0], col * 0.4); }
    if (K.hi && i % 4 === 0) K.box('steel', w * 1.15, 0.4, w * 1.15, [x, yy, z]); } // service decks
  K.box('dark', w * 0.45, h * 0.99, w * 0.45, p); // elevator / stair core
  return K; }
// truss arm from a tower face along +x: two chords + zig-zag web, hinge drum at the root
function trussArm(K, x0, y, z, len, d = 2.4, k = 'steel', dir = 1) { const t = 0.35;
  if (K.lo) return K.box(k, len, d, d, [x0 + dir * len / 2, y - d / 2, z]);
  for (const zz of [-d / 2, d / 2]) { K.beam(k, [x0, y, z + zz], [x0 + dir * len, y, z + zz], t); K.beam(k, [x0, y - d, z + zz], [x0 + dir * len * 0.95, y - d * 0.7, z + zz], t); }
  const n = K.hi ? Math.max(2, Math.round(len / 2.5)) : Math.max(1, Math.round(len / 5)); for (let i = 0; i < n; i++) { const a = x0 + dir * len * i / n, b = x0 + dir * len * (i + 1) / n;
    K.beam(k, [a, y - d * (1 - 0.3 * i / n), z], [b, y, z], t * 0.8); }
  K.box('deck', len, 0.25, d, [x0 + dir * len / 2, y - d * 0.15, z]); K.cyl('steel', 0.9, 0.9, d + 0.8, [x0, y - d - 0.4, z], 8); return K; }
function catenary(K, x, top, z, span) { if (K.lo) return; for (const s of [-1, 1]) K.beam('steel', [x, top, z], [x + s * span, 0, z + span * 0.3], 0.12); } // lightning-mast catenary wires
function fence(K, pts, h = 2.4) { if (K.lo) return; for (let i = 1; i < pts.length; i++) { const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / (K.hi ? 12 : 48)));
  for (let j = 0; j <= n; j++) K.box('fence', 0.15, h, 0.15, [x0 + (x1 - x0) * j / n, 0, z0 + (z1 - z0) * j / n]);
  for (const hy of K.hi ? [0.3, h * 0.55, h] : [h]) K.beam('fence', [x0, hy, z0], [x1, hy, z1], 0.08); } }
function rackPipe(K, x0, x1, z, y = 4, n = 3) { // pipe rack: portal frames every 10-20 m carrying n pipes
  const L = Math.abs(x1 - x0), m = Math.max(1, Math.round(L / (K.hi ? 10 : 20)));
  if (!K.lo) for (let i = 0; i <= m; i++) { const x = x0 + (x1 - x0) * i / m; K.box('steel', 0.4, y, 0.4, [x, 0, z - 1.6]); K.box('steel', 0.4, y, 0.4, [x, 0, z + 1.6]); K.box('steel', 0.4, 0.4, 3.6, [x, y - 0.2, z]); }
  for (let j = 0; j < (K.lo ? 1 : n); j++) { const g = new THREE.CylinderGeometry(0.35, 0.35, L, K.hi ? 8 : 5, 1, true); g.rotateZ(Math.PI / 2); K.add(g, 'pipe', M([(x0 + x1) / 2, y + 0.4, z - 1 + j])); } }
const parts = {
  pad(K, o) { const r = o.r || 60, tw = o.trench || 12; K.disc('concrete', r, [0, 0, 0], K.seg * 2, 0.05); K.ring('mark', r * 0.92, r * 0.95);
    // flame trench: sunken slot with side walls and a wedge deflector under the mount, exiting south
    K.box('dark', tw, 0.3, r * 1.6, [0, -0.25, r * 0.3]); for (const s of [-1, 1]) K.box('concrete', 1.5, 3, r * 1.4, [s * (tw / 2 + 0.75), 0, r * 0.35]);
    { const g = new THREE.CylinderGeometry(0.01, tw * 0.45, 7, 3, 1); g.rotateX(Math.PI / 2); g.rotateZ(Math.PI); K.add(g, 'steel', M([0, 1.5, 3])); }
    K.box('concrete', tw + 4, 6, 10, [0, 0, -6]); const m = o.mount || 8; K.cyl('steel', m * 0.55, m * 0.5, 2, [0, 6, 0], K.seg, true); // mount ring on the plinth
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; K.box('steel', 1.2, 6, 1.2, [Math.cos(a) * m * 0.45, 0, Math.sin(a) * m * 0.45]); if (!K.lo) K.box('dark', 0.8, 1.6, 0.8, [Math.cos(a) * m * 0.45, 8, Math.sin(a) * m * 0.45]); } // hold-down clamps
    if (!K.lo) { // pad deluge: header ring with nozzle risers + feed main to the water tower side
      K.add(new THREE.TorusGeometry(m * 0.85, 0.3, 4, K.hi ? 24 : 12).rotateX(Math.PI / 2), 'pipe', M([0, 6.4, 0]));
      for (let i = 0; i < (K.hi ? 12 : 6); i++) { const a = i / (K.hi ? 12 : 6) * Math.PI * 2; K.cyl('pipe', 0.2, 0.2, 1.4, [Math.cos(a) * m * 0.85, 6.4, Math.sin(a) * m * 0.85], 4); }
      const g = new THREE.CylinderGeometry(0.6, 0.6, r, 6, 1, true); g.rotateZ(Math.PI / 2); K.add(g, 'pipe', M([r / 2 + m * 0.6, 1, -m])); }
    if (o.tower) { const t = o.tower, tx = t.x ?? -(r * 0.4), tz = t.z ?? 0, w = t.w || 10; lattice(K, w, t.h, 'tower', [tx, 0, tz]);
      K.cyl('steel', 0.5, 0.15, t.mast || 20, [tx, t.h, tz], 6); catenary(K, tx, t.h + (t.mast || 20), tz, r * 0.9); // lightning mast + catenary
      for (const a of t.arms || []) trussArm(K, tx + w / 2, a.y, tz, a.len, 2.6); }
    if (!K.lo) for (const s of [-1, 1]) K.box('concrete', 6, 3, 6, [s * r * 0.6, 0, -r * 0.55]);
    const f = r * 1.15; fence(K, [[-f, -f], [f, -f], [f, f], [-f, f], [-f, -f]]); // pad perimeter fence
    if (!K.lo) for (const [x, z] of [[-f, -f], [f, -f], [f, f], [-f, f]]) { K.cyl('steel', 0.4, 0.25, 30, [x * 0.95, 0, z * 0.95], 6); K.box('flood', 4, 2.2, 0.8, [x * 0.95, 30, z * 0.95], Math.atan2(x, z)); K.box('steel', 4.4, 0.4, 1.2, [x * 0.95, 29.6, z * 0.95], Math.atan2(x, z)); K.light([x * 0.95, 31, z * 0.95], [0, 10, 0], 0); }
    if (o.tower && !K.lo) { const t = o.tower, tx = t.x ?? -(r * 0.4); for (const a of t.arms || []) K.box('win', 1.2, 0.6, 0.3, [tx + (t.w || 10) / 2 + 0.6, a.y - 1, (t.z ?? 0) + (t.w || 10) / 2 + 0.2]); K.box('beacon', 0.8, 0.8, 0.8, [tx, t.h + (t.mast || 20), t.z ?? 0]); } }, // arm-root lights, mast beacon
  catch(K, o) { const w = o.w || 12, h = o.h || 145; lattice(K, w, h, 'steel'); K.cyl('steel', 0.5, 0.15, 12, [0, h, 0], 6); catenary(K, 0, h + 12, 0, 90); K.box('beacon', 1, 1, 1, [0, h + 12, 0]); if (K.hi) for (const yy of [h * 0.3, h * 0.6, h * 0.9]) K.box('flood', 3, 1.5, 0.5, [0, yy, w / 2 + 0.4]); K.light([0, h * 0.6, w / 2 + 2], [0, 10, w / 2 + (o.arm || 35) * 0.85], 0);
    const ay = o.armY || h * 0.75, L = o.arm || 35, zc = w / 2 + L * 0.85; K.box('steel', w + 6, 8, 6, [0, ay - 2, w / 2 + 1]); // carriage riding the tower
    for (const s of [-1, 1]) { // chopsticks: tapered truss arms on pivots, with catch rails and bumper pads
      const x = s * (w / 2 + 2.5); K.cyl('steel', 1.6, 1.6, 6, [x, ay - 3, w / 2 + 2], 10);
      if (K.lo) { K.box('steel', 3, 4, L, [x, ay - 2, w / 2 + L / 2]); continue; }
      for (const yy of [ay, ay - 4]) for (const xx of [x - 1.3, x + 1.3]) K.beam('steel', [xx, yy, w / 2 + 2], [xx * 0.98 + s * 0.4, yy + (yy === ay ? 0 : 2.5), w / 2 + 2 + L], 0.45);
      const n = K.hi ? 10 : 3; for (let i = 0; i < n; i++) { const z0 = w / 2 + 2 + L * i / n, z1 = w / 2 + 2 + L * (i + 1) / n; K.beam('steel', [x, ay - 4 + 2.5 * i / n, z0], [x, ay, z1], 0.3); }
      K.box('dark', 0.8, 1.0, L * 0.6, [x - s * 1.6, ay - 1.5, w / 2 + 2 + L * 0.35]); K.box('red', 1.2, 1.2, 1.6, [x - s * 1.8, ay - 1.2, zc]); }
    if (o.qd) trussArm(K, 0, o.qdY || h * 0.6, w / 2, o.qd, 3, 'steel', 1); // ship arm (built along +x, then reads as a side arm)
    const r = o.mountR || 12; K.cyl('concrete', r * 1.1, r, 18, [0, 0, zc], K.seg); K.cyl('steel', r * 0.75, r * 0.8, 1.5, [0, 18, zc], K.seg, true); if (!K.lo) K.cyl('dark', r * 0.6, r * 0.6, 0.4, [0, 18.2, zc], K.seg); // mount + flame opening
    if (!K.lo) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; K.box('concrete', 2.5, 18, 2.5, [Math.cos(a) * r * 1.15, 0, zc + Math.sin(a) * r * 1.15]); }
    if (!K.lo) { K.add(new THREE.TorusGeometry(r * 0.8, 0.35, 4, K.hi ? 24 : 12).rotateX(Math.PI / 2), 'pipe', M([0, 19.6, zc])); K.disc('water', r * 0.3, [0, 0, zc], 12, 0.08); } // deluge ring
    K.disc('concrete', o.r || 70, [0, 0, w / 2 + L * 0.5], K.seg * 2, 0.05); const f = (o.r || 70) * 1.05; fence(K, [[-f, -f + 20], [f, -f + 20], [f, f + 20], [-f, f + 20], [-f, -f + 20]]); },
  vab(K, o) { const w = o.w, d = o.d, h = o.h; K.box('clad', w, h, d);
    if (!K.lo) { const n = K.hi ? 6 : 3; for (let i = 0; i < n; i++) K.box('band', w + 0.4, 1.2, d + 0.4, [0, h * (i + 1) / (n + 1), 0]);
      const rib = K.hi ? 10 : 20; for (let x = -w / 2; x <= w / 2 + 0.1; x += rib) for (const s of [-1, 1]) K.box('steel', 1.0, h, 1.0, [x, 0, s * (d / 2 + 0.5)]); // vertical ribbing (pilasters)
      for (let z = -d / 2; z <= d / 2 + 0.1; z += rib) for (const s of [-1, 1]) K.box('steel', 1.0, h, 1.0, [s * (w / 2 + 0.5), 0, z]);
      const nd = o.doors || 2, rows = K.hi ? 7 : 4; for (let i = 0; i < nd; i++) { const x = (i - (nd - 1) / 2) * w / nd, dw = w / nd * 0.5, dh = h * 0.85;
        for (const s of [-1, 1]) { K.box('dark', dw + 2, dh + 1, 0.3, [x, 0, s * (d / 2 + 0.2)]); for (let r = 0; r < rows; r++) K.box('door', dw, dh / rows - 0.6, 0.7, [x, r * dh / rows, s * (d / 2 + 0.4)]); } } // stacked leaf door panels
      for (const s of [-1, 1]) K.box('win', w * 0.9, 0.8, 0.3, [0, h * 0.92, s * (d / 2 + 1.1)]); K.box('win', w * 0.5, 1, 0.3, [w * 0.8, h * 0.2, d * 0.25 + 0.2]);
      K.box('clad', w * 0.6, h * 0.35, d * 0.5, [w * 0.8, 0, 0]); for (let i = 0; i < (K.hi ? 6 : 3); i++) K.box('dark', 4, 3, 3, [w * 0.8 - w * 0.2 + i * w * 0.08, h * 0.35, 0]); } // low bay + roof units
    K.box('dark', w + 1, 0.8, d + 1, [0, h, 0]); },
  hangar(K, o) { const w = o.w || 60, d = o.d || 90, h = o.h || 22; K.box('clad', w, h * 0.6, d);
    const g = new THREE.CylinderGeometry(w / 2, w / 2, d, Math.max(4, K.seg), 1, false, -Math.PI / 2, Math.PI); g.rotateX(-Math.PI / 2); g.scale(1, (h * 0.4) / (w / 2), 1); K.add(g, 'white', M([0, h * 0.6, 0]));
    if (!K.lo) { const nl = K.hi ? 6 : 3; for (let i = 0; i < nl; i++) K.box('door', w * 0.8 / nl - 0.4, h * 0.55, 0.6, [-w * 0.4 + (i + 0.5) * w * 0.8 / nl, 0, d / 2]); K.box('steel', w * 0.85, 0.8, 1.2, [0, h * 0.55, d / 2 + 0.3]); for (const x of [-w * 0.3, 0, w * 0.3]) K.box('lamp', 1.4, 0.4, 0.8, [x, h * 0.58, d / 2 + 0.8]); // door leaves + track + door lights
      for (let z = -d / 2; z <= d / 2; z += K.hi ? 10 : 30) for (const s of [-1, 1]) K.box('steel', 0.8, h * 0.6, 0.8, [s * (w / 2 + 0.4), 0, z]); } },
  tanks(K, o) { const n = o.n || 3, r = o.r || 8, gap = r * 2.6;
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * gap; if (o.style === 'h') { const g = new THREE.CylinderGeometry(r, r, r * 5, Math.max(4, K.seg)); g.rotateX(Math.PI / 2); K.add(g, 'tank', M([x, r + 1.5, 0])); if (!K.lo) { K.sph('tank', r, [x, r + 1.5, -r * 2.5], Math.max(4, K.seg >> 1)); K.sph('tank', r, [x, r + 1.5, r * 2.5], Math.max(4, K.seg >> 1)); K.box('concrete', r * 1.6, 1.5, 1.5, [x, 0, -r * 1.8]); K.box('concrete', r * 1.6, 1.5, 1.5, [x, 0, r * 1.8]); } }
      else if (o.style === 'v') { K.cyl('tank', r, r, o.h || r * 4, [x, 0, 0]); K.cyl('tank', r, r * 0.6, r * 0.5, [x, o.h || r * 4, 0]); if (!K.lo) { K.cyl('concrete', r * 1.15, r * 1.15, 1, [x, 0, 0], K.seg); K.box('steel', 0.5, o.h || r * 4, 0.5, [x + r + 0.6, 0, 0]); } } // plinth + ladder
      else { K.sph('tank', r, [x, r * 1.25, 0]); if (!K.lo) { for (let j = 0; j < (K.hi ? 8 : 4); j++) { const a = j * Math.PI * 2 / (K.hi ? 8 : 4) + Math.PI / 4; K.box('steel', 0.8, r * 1.1, 0.8, [x + Math.cos(a) * r * 0.75, 0, Math.sin(a) * r * 0.75]); }
        K.add(new THREE.TorusGeometry(r * 0.78, 0.25, 3, K.hi ? 20 : 10).rotateX(Math.PI / 2), 'steel', M([x, r * 1.1, 0])); K.cyl('pipe', 0.5, 0.5, r * 1.25, [x, 0, r * 1.05], 6); } } } // legs, girth ring, drop leg
    rackPipe(K, -n * gap / 2 - r, n * gap / 2 + r, r * 1.9, 4, 3); if (!K.lo) { K.flat('apron', n * gap + r * 2, r * 5.5, [0, 0, 0]); for (const s of [-1, 1]) K.box('concrete', n * gap + r * 2, 1, 0.6, [0, 0, s * r * 2.75]); } }, // apron + spill bund
  road(K, o) { const w = o.w || 10, P = o.pts; for (let i = 1; i < P.length; i++) { const [x0, z0] = P[i - 1], [x1, z1] = P[i], L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      K.flat('asphalt', w, L + w * 0.5, [cx, 0, cz], ry, 0.025); if (K.lo) continue; const ux = (x1 - x0) / L, uz = (z1 - z0) / L;
      for (const s of [-1, 1]) K.flat('white', 0.25, L, [cx + uz * s * (w / 2 - 0.5), 0, cz - ux * s * (w / 2 - 0.5)], ry, 0.035); // edge lines
      if (o.line && K.hi) { const dash = K.hi ? 12 : 24, nd = Math.floor(L / dash); for (let j = 0; j < nd; j++) { const t = (j + 0.5) * dash - L / 2; K.flat('mark', 0.3, dash * 0.5, [cx + ux * t, 0, cz + uz * t], ry, 0.04); } } // dashed centre line
      if (o.poles !== false) { const sp = K.hi ? 60 : 300, np = Math.floor(L / sp); for (let j = 1; j <= np; j++) { const t = j * sp - L / 2, px = cx + ux * t + uz * (w / 2 + 2), pz = cz + uz * t - ux * (w / 2 + 2);
        K.cyl('steel', 0.18, 0.12, 9, [px, 0, pz], 4); K.box('lamp', 0.5, 0.25, 1.4, [px - uz * 0.8, 9, pz + ux * 0.8]); } } } }, // light poles
  masts(K, o) { for (const [x, z] of o.pts) { const h = o.h || 40; K.light([x, h, z], [x * 0.3, 0, z * 0.3], 1); K.cyl('steel', 0.7, 0.35, h, [x, 0, z], 6); K.box('lamp', 4, 2, 1, [x, h, z]); if (!K.lo) { K.box('steel', 4.6, 0.4, 1.4, [x, h - 0.4, z]); K.box('concrete', 2, 0.8, 2, [x, 0, z]); } if (K.hi) K.box('lamp', 4, 1.2, 1, [x, h - 2, z]); } },
  water(K, o) { const h = o.h || 60, r = o.r || 9; if (!K.lo) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; K.beam('steel', [Math.cos(a) * r * 0.9, 0, Math.sin(a) * r * 0.9], [Math.cos(a) * r * 0.35, h, Math.sin(a) * r * 0.35], 0.9); }
      for (let j = 1; j < (K.hi ? 4 : 2) + 1; j++) { const t = j / ((K.hi ? 4 : 2) + 1), rr = r * (0.9 - 0.55 * t); K.add(new THREE.TorusGeometry(rr, 0.2, 3, 8).rotateX(Math.PI / 2), 'steel', M([0, h * t, 0])); } } // tension rings
    K.cyl('pipe', 1.2, 1.2, h, [0, 0, 0], 6); K.sph('white', r, [0, h + r * 0.6, 0]); if (!K.lo) { K.add(new THREE.TorusGeometry(r * 0.95, 0.3, 3, K.hi ? 20 : 10).rotateX(Math.PI / 2), 'steel', M([0, h + r * 0.6, 0])); K.cyl('pipe', 0.8, 0.8, 30, [0, 0, 0], 6); } },
  lz(K, o) { const r = o.r || 45; K.disc('concrete', r); K.ring('mark', r * 0.8, r * 0.86); const t = r * 0.06; K.flat('mark', t * 2, r * 1.2, [0, 0, 0], Math.PI / 4, 0.045); K.flat('mark', t * 2, r * 1.2, [0, 0, 0], -Math.PI / 4, 0.045);
    if (!K.lo) { K.disc('apron', r * 1.35, [0, 0, 0], K.seg * 2, 0.01); for (let i = 0; i < (K.hi ? 16 : 8); i++) { const a = i / (K.hi ? 16 : 8) * Math.PI * 2; K.box('lamp', 0.6, 0.3, 0.6, [Math.cos(a) * r * 1.02, 0, Math.sin(a) * r * 1.02]); } } }, // edge lights
  droneship(K, o) { const L = 92, W = 52; K.box('hull', W, 6, L, [0, -4, 0]); K.box('deck', W - 2, 0.4, L - 2, [0, 2, 0]); K.disc('sea', 900, [0, 0, 0], K.seg * 2, -0.2);
    K.ring('mark', 13, 14.5, [0, 2.4, 0]); K.flat('mark', 2.2, 24, [0, 2.4, 0], Math.PI / 4, 0.05); K.flat('mark', 2.2, 24, [0, 2.4, 0], -Math.PI / 4, 0.05);
    for (const s of [-1, 1]) { K.box('hull', 1.2, 3, L - 4, [s * (W / 2 - 0.6), 2, 0]); if (!K.lo) { K.box('tank', 6, 5, 8, [s * (W / 2 - 4), 2, -L / 2 + 6]); K.box('tank', 6, 5, 8, [s * (W / 2 - 4), 2, L / 2 - 6]); K.cyl('dark', 2.2, 2.2, 3, [s * (W / 2 - 4), -7, -L / 2 + 6], K.seg); K.cyl('dark', 2.2, 2.2, 3, [s * (W / 2 - 4), -7, L / 2 - 6], K.seg);
      fence(K, [[s * (W / 2 - 0.3), -L / 2 + 12], [s * (W / 2 - 0.3), L / 2 - 12]], 1.2); } }
    if (K.hi) K.box('steel', W - 6, 0.6, 1, [0, 2.4, -L / 2 + 2]); },
  block(K, o) { const w = o.w || 20, h = o.h || 6, d = o.d || 14; K.box(o.mat || 'concrete', w, h, d); if (!K.lo) { K.box('dark', w + 0.6, 0.6, d + 0.6, [0, h, 0]); K.box('win', w * 0.7, 1.2, 0.2, [0, h * 0.5, d / 2]); K.box('win', w * 0.7, 1.2, 0.2, [0, h * 0.5, -d / 2]); K.box('lamp', 1.2, 0.4, 0.6, [0, h - 1, d / 2 + 0.4]); }
    if (o.roof && !K.lo) { K.box('dark', w * 0.3, 2, d * 0.3, [0, h, 0]); K.cyl('steel', 0.15, 0.1, 12, [w * 0.4, h, 0], 4); } },
  stand(K, o) { const h = o.h || 30; lattice(K, 8, h, 'steel'); K.box('concrete', 16, 4, 16); K.box('steel', 12, 1.5, 12, [0, h, 0]); }, // static-fire stand
  hab(K, o) { const n = o.n || 3, r = o.r || 4; for (let i = 0; i < n; i++) { const g = new THREE.CylinderGeometry(r, r, r * 3, Math.max(4, K.seg)); g.rotateZ(Math.PI / 2); K.add(g, 'hab', M([0, r + 0.6, i * r * 2.4], 0)); if (!K.lo) { K.sph('hab', r * 0.96, [r * 1.5, r + 0.6, i * r * 2.4], Math.max(4, K.seg >> 1)); K.box('steel', r * 3.2, 0.6, r * 1.4, [0, 0, i * r * 2.4]); } }
    if (!K.lo) K.box('regolith', r * 5, r * 0.8, n * r * 2.4 + r * 2, [0, 0, (n - 1) * r * 1.2 - r * 3.2]); },
  solar(K, o) { const n = o.n || 4; for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 12; if (!K.lo) K.cyl('steel', 0.2, 0.2, 2.5, [x, 0, 0], 4); const g = new THREE.BoxGeometry(10, 0.15, 5); g.rotateX(-0.5); K.add(g, 'solar', M([x, 2.8, 0])); } },
  berm(K, o) { const r = o.r || 40; K.add(new THREE.TorusGeometry(r, o.t || 2.5, 4, Math.max(8, K.seg * 2)).rotateX(Math.PI / 2), o.mat || 'regolith', M([0, 0.4, 0])); },
  dish(K, o) { const r = o.r || 5; K.cyl('steel', 0.4, 0.4, o.h || 6, [0, 0, 0], 6); const g = new THREE.SphereGeometry(r, Math.max(4, K.seg), 3, 0, Math.PI * 2, 0, 0.7); g.rotateX(-0.9); K.add(g, 'white', M([0, (o.h || 6) + 1, 0])); },
  rover(K, o) { const L = o.len || 3.2, W = o.w || 2.2; K.box('hab', L, 0.9, W, [0, 0.9, 0]); K.box('solar', L * 0.9, 0.08, W * 0.9, [0, 1.8, 0]);
    for (const i of [-1, 0, 1]) for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.35, K.lo ? 6 : K.hi ? 14 : 8); g.rotateX(Math.PI / 2); K.add(g, 'dark', M([i * L * 0.38, 0.42, s * (W / 2 + 0.2)])); }
    if (!K.lo) { K.cyl('steel', 0.06, 0.06, 1.4, [L * 0.35, 1.8, 0], 4); K.box('dark', 0.4, 0.3, 0.3, [L * 0.35, 3.2, 0]); K.box('lamp', 0.12, 0.2, 0.5, [L / 2 + 0.05, 1.3, 0]); if (o.dish) { const g = new THREE.SphereGeometry(0.5, 8, 2, 0, Math.PI * 2, 0, 0.8); g.rotateX(-1); K.add(g, 'white', M([-L * 0.3, 2.3, 0])); } } }, // six-wheel surface rover
  fence(K, o) { fence(K, o.pts, o.h || 2.4); },
  ground(K, o) { K.disc(o.mat || 'ground', o.r || 2500, [0, 0, 0], K.seg * 3, -0.05); if (o.sea) K.flat('sea', o.sea.w || 12000, o.sea.d || 12000, [o.sea.x || 0, 0, o.sea.z || 0], 0, -0.1); },
};
export const PART_KINDS = Object.keys(parts);
// build one placed group (the main complex, or a remote station such as a droneship)
function buildGroup(S, items, detail, name, opts) { const K = new SK(detail);
  for (const o of items) { if (o.k === 'ground' && !opts.ground) continue; if (o.min && ['lo', 'mid', 'hi'].indexOf(detail) < ['lo', 'mid', 'hi'].indexOf(o.min)) continue;
    const [x, z] = o.at || [0, 0]; K.base = o.y || 0; K.push(M([x, o.y || 0, z], o.rot || 0)); parts[o.k](K, o); K.pop(); }
  const grp = K.build(name); grp.userData.lights = K.lights; return grp; }
export function buildSite(S, { detail = 'hi', ground = false } = {}) { const g = new THREE.Group(); g.name = 'site:' + S.id;
  const main = buildGroup(S, S.layout, detail, S.id, { ground }); g.add(main); let tris = main.userData.tris;
  for (const st of S.stations || []) { const s = buildGroup(S, st.layout, detail, S.id + ':' + st.id, { ground }); const R = BODY_R[S.body] || S.R;
    const off = localOffset(S.body, S.lat, S.lon, st.lat, st.lon, R); s.matrix.fromArray(localBasis(S.body, S.lat, S.lon, st.lat, st.lon)).setPosition(off[0], off[1], off[2]); s.matrixAutoUpdate = false; s.userData.station = st.id;
    g.add(s); tris += s.userData.tris; }
  // night lighting: emissive heads/panels are always there; real lights only a few, gated by detail (hi 3, mid 1 point lights, lo none)
  const cand = (main.userData.lights || []).sort((a, b) => a.pri - b.pri), nL = { hi: 3, mid: 1, lo: 0 }[detail] || 0;
  for (const c of cand.slice(0, nL)) { const l = takeLight(); // pooled point lights: fresh light objects per build grew the heap on every site swap (r172 light node caches)
    l.position.set(...c.p); l.castShadow = false; l.name = 'siteLight'; g.add(l); }
  Object.assign(g.userData, { id: S.id, body: S.body, lat: S.lat, lon: S.lon, detail, tris, site: true, lights: Math.min(nL, cand.length) }); return g; }
export function buildSiteLOD(S, { phone = false } = {}) { const L = new THREE.LOD(); L.name = 'siteLOD:' + S.id;
  const near = buildSite(S, { detail: phone ? 'mid' : 'hi' }), mid = buildSite(S, { detail: 'mid' }), lo = buildSite(S, { detail: 'lo' });
  L.addLevel(near, 0); L.addLevel(mid, LOD_DIST.mid); L.addLevel(lo, LOD_DIST.lo); Object.assign(L.userData, { id: S.id, near, mid, lo }); return L; }
// place a built site (or LOD) in its body's frame (metres from the body centre)
export function placeSite(obj, S, R = BODY_R[S.body] || S.R) { obj.matrix.fromArray(siteMatrix(S.body, S.lat, S.lon, R, S.alt || 0)); obj.matrix.decompose(obj.position, obj.quaternion, obj.scale); return obj; }
// night switch for the game (by local sun elevation): real lights + emissive strength. Default after build: on.
export function setSiteNight(obj, on) { obj.traverse(o => { if (o.isLight) o.visible = on; }); }
const LPOOL = [];
function takeLight() { let l = LPOOL.find(x => x.userData.free); if (!l) { l = new THREE.PointLight(0xfff0d8, 3000, 360, 1.6); l.castShadow = false; LPOOL.push(l); } l.userData.free = false; l.visible = true; return l; }
const freeLights = o => { const ls = []; o.traverse(l => { if (l.isLight && LPOOL.includes(l)) ls.push(l); }); for (const l of ls) { l.removeFromParent(); l.userData.free = true; } };
export const siteLightPoolSize = () => LPOOL.length;
export function disposeSite(obj) { freeLights(obj); if (obj.isLOD) { for (const l of obj.levels) dispose(l.object); obj.removeFromParent(); obj.levels.length = 0; return; } dispose(obj); }
