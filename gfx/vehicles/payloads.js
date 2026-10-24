// Payload models (rockets-pass-1): one light satellite/spacecraft per mission type. A payload is a Group with
//   .userData = { kind, r, h, cy, deploy(k) }   origin = the bottom of its adapter ring, +Y up, metres at the built size
// and at most two meshes (hi/mid: body + solar wings) or one (lo). The vehicle carries it under the fairing from t=0, so it is
// exposed when the shell opens and released as the same object (no new mesh appears at RELEASE).
// Colours are vertex colours on two shared materials; geometry is built per payload (never InstancedMesh).
import * as THREE from 'three/webgpu';
import { KINDS } from './payload_kinds.js?v=f5.8r';
export { KINDS };
const BODY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.62 }), WING = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.45, side: THREE.DoubleSide });
for (const m of [BODY, WING]) { m.userData.cached = true; m.name = 'payload'; }
const C = { gold: 0xc9a043, goldD: 0x9d7b2c, white: 0xe3e5e8, silver: 0x9aa0a8, dark: 0x25272b, black: 0x0c0d0f, grey: 0x6d727a, blue: 0x1b3a86, blue2: 0x264a9c, cell: 0x0f2558, cube: 0xd8d8d2 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color(), _s = new THREE.Vector3(1, 1, 1);
const at = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s).clone();
class Acc { constructor(lo = false) { this.g = []; this.lo = lo; }
  add(geo, col, m) { const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(m || _m.identity()); const n = g.attributes.position.count, c = new Float32Array(n * 3); _c.set(col); for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); this.g.push(g); return this; }
  box(w, h, d, col, x, y, z, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), col, at(x, y, z, 0, ry, 0)); }
  cyl(rt, rb, h, col, x, y, z, seg = 12, rx = 0, rz = 0) { return this.add(new THREE.CylinderGeometry(rt, rb, h, this.lo ? Math.min(seg, 6) : seg), col, at(x, y, z, rx, 0, rz)); }
  dish(r, col, x, y, z, seg = 10) { return this.add(new THREE.SphereGeometry(r, this.lo ? Math.min(seg, 6) : seg, this.lo ? 2 : 4, 0, Math.PI * 2, 0, 1.0), col, at(x, y, z, Math.PI, 0, 0)); } // bowl opens upward
  mesh(mat, name) { if (!this.g.length) return null; const out = new THREE.BufferGeometry(); for (const a of ['position', 'normal', 'color']) { const n = a === 'uv' ? 2 : 3; let len = 0; for (const g of this.g) len += g.attributes[a].array.length; const arr = new Float32Array(len); let o = 0;
      for (const g of this.g) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, n)); }
    for (const g of this.g) g.dispose(); const m = new THREE.Mesh(out, mat); m.name = name; return m; } }
const adapter = (b, r = 1.0) => { b.cyl(r * 0.72, r, 0.22, C.silver, 0, 0.11, 0, 16); b.cyl(r * 1.0, r * 1.0, 0.06, C.dark, 0, 0.03, 0, 16); }; // the stage-side ring stays; this is the payload attach cone
// one solar panel stack: n panels hinged at x0, each w (x) by l (z), at height y; cells as thin dark bars
function panels(w, n, x0, w1, l, y, gap = 0.05) { const A = new Acc(); for (let i = 0; i < n; i++) { const cx = x0 + i * (w1 + gap) + w1 / 2; A.box(w1, 0.03, l, i % 2 ? C.blue2 : C.blue, cx, y, 0); A.box(w1 * 0.96, 0.034, 0.04, C.cell, cx, y, 0); A.box(0.04, 0.034, l * 0.96, C.cell, cx, y, 0); } A.box(x0, 0.05, 0.08, C.silver, x0 / 2, y, 0); return A; }
const stow = (b, xh, y, l, hgt) => { for (const sg of [-1, 1]) { b.box(0.1, hgt, l, C.dark, sg * (xh + 0.05), y, 0); b.box(0.02, hgt * 0.88, l * 0.9, C.blue, sg * (xh + 0.11), y, 0); } }; // stowed solar array slab hugging the bus (the deployed array grows out of it)
// each builder fills {body, wings} (Acc) at nominal size (adapter radius 1); returns nominal height
const BUILD = {
  comsat(b, w, hi) { adapter(b); stow(b, 0.75, 1.3, 1.7, 1.6); b.box(1.5, 2.0, 1.5, C.gold, 0, 1.28, 0); b.box(1.54, 0.12, 1.54, C.white, 0, 0.34, 0); for (const s of [-1, 1]) b.box(1.3, 1.5, 0.04, C.white, 0, 1.4, s * 0.79);
    b.cyl(0.04, 0.04, 0.55, C.silver, 0.3, 2.55, 0, 6); b.dish(0.8, C.white, 0.3, 2.9, 0, hi ? 12 : 8); b.cyl(0.03, 0.03, 0.5, C.dark, 0.3, 3.0, 0, 6); for (const s of [-1, 1]) b.box(0.22, 0.34, 0.34, C.dark, s * 0.86, 1.3, 0);
    for (const s of [-1, 1]) { b.cyl(0.05, 0.05, 0.4, C.silver, s * 0.4, 2.45, 0.5, 6); } for (const s of [-1, 1]) { const P = panels(0, 3, 0.85, 1.15, 1.9, 1.3); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 3.2; },
  eo(b, w, hi) { adapter(b); stow(b, 0.675, 0.8, 1.1, 0.7); b.box(1.5, 1.1, 1.5, C.gold, 0, 0.87, 0); b.cyl(0.62, 0.62, 1.4, C.white, 0, 2.12, 0, hi ? 16 : 10); b.cyl(0.66, 0.66, 0.14, C.dark, 0, 2.89, 0, hi ? 16 : 10); b.cyl(0.5, 0.5, 0.02, C.black, 0, 2.97, 0, 10); b.box(0.9, 0.5, 0.06, C.white, 0, 3.25, 0.7, 0);
    b.cyl(0.08, 0.08, 0.6, C.grey, 0.7, 1.9, 0.0, 6); for (const s of [-1, 1]) b.box(0.2, 0.3, 0.3, C.dark, s * 0.78, 0.8, 0); b.box(0.9, 0.5, 0.06, C.white, 0, 3.25, -0.7, 0);
    for (const s of [-1, 1]) { const P = panels(0, 2, 0.8, 1.2, 1.5, 0.8); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 3.1; },
  nav(b, w, hi) { adapter(b); stow(b, 0.62, 1.0, 0.9, 0.9); b.cyl(0.62, 0.62, 1.3, C.gold, 0, 0.92, 0, 6); b.cyl(0.66, 0.66, 0.1, C.white, 0, 0.36, 0, 6); b.box(1.1, 0.12, 1.1, C.dark, 0, 1.64, 0); b.cyl(0.12, 0.12, 0.2, C.silver, 0, 1.8, 0, 8); b.box(0.5, 0.05, 0.5, C.goldD, 0.3, 1.74, 0.3);
    for (const s of [-1, 1]) b.box(0.18, 0.26, 0.26, C.dark, s * 0.62, 1.0, 0);
    for (const s of [-1, 1]) { const P = panels(0, 3, 0.65, 0.95, 1.25, 1.0); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 2.0; },
  probe(b, w, hi) { adapter(b); stow(b, 0.82, 0.75, 0.8, 0.8); b.cyl(0.5, 0.82, 1.1, C.silver, 0, 0.77, 0, hi ? 12 : 8); b.cyl(0.84, 0.84, 0.28, C.gold, 0, 0.66, 0, hi ? 12 : 8); b.cyl(0.06, 0.06, 0.6, C.silver, 0, 1.6, 0, 6); b.dish(1.0, C.white, 0, 2.0, 0, hi ? 14 : 8); b.cyl(0.05, 0.05, 0.4, C.dark, 0, 2.15, 0, 6);
    b.cyl(0.13, 0.13, 0.95, C.dark, 0.95, 0.9, 0.2, 8, 0, Math.PI / 2); for (let i = 0; i < 3; i++) b.cyl(0.2, 0.2, 0.03, C.grey, 0.7 + i * 0.22, 0.9, 0.2, 8, 0, Math.PI / 2); b.cyl(0.02, 0.02, 1.1, C.silver, -0.8, 1.3, 0.1, 4, 0, Math.PI / 2 * 0.4);
    for (const s of [-1, 1]) { const P = panels(0, 2, 0.82, 0.75, 1.0, 0.7); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 2.9; },
  cargo(b, w, hi) { adapter(b); stow(b, 0.95, 1.6, 0.8, 1.8); b.cyl(0.95, 0.95, 2.6, C.white, 0, 1.58, 0, hi ? 16 : 10); b.cyl(0.97, 0.97, 0.3, C.gold, 0, 1.2, 0, hi ? 16 : 10); b.cyl(0.97, 0.97, 0.12, C.gold, 0, 2.5, 0, hi ? 16 : 10);
    b.cyl(0.36, 0.56, 0.45, C.grey, 0, 3.1, 0, 10); b.cyl(0.4, 0.4, 0.08, C.dark, 0, 3.36, 0, 10); for (const s of [-1, 1]) b.box(0.05, 1.5, 0.6, C.silver, s * 0.88, 1.6, 0.4);
    for (const s of [-1, 1]) b.box(0.22, 0.34, 0.3, C.dark, s * 0.97, 0.9, 0);
    for (const s of [-1, 1]) { const P = panels(0, 2, 1.0, 1.3, 2.0, 0.9); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 3.45; },
  flatpack(b, w, hi) { adapter(b); stow(b, 0.85, 1.0, 1.2, 1.2); const n = hi ? 8 : 6; for (let i = 0; i < n; i++) b.box(1.7, 0.13, 1.7, i % 2 ? C.white : C.goldD, 0, 0.42 + i * 0.185, 0); for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) b.cyl(0.04, 0.04, n * 0.185 + 0.2, C.dark, x, 0.45 + n * 0.0925, z, 6);
    b.box(1.76, 0.08, 1.76, C.dark, 0, 0.5 + n * 0.185, 0); for (const s of [-1, 1]) b.box(0.2, 0.3, 0.3, C.dark, s * 0.9, 1.0, 0);
    for (const s of [-1, 1]) { const P = panels(0, 2, 0.9, 0.95, 1.1, 1.0); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 0.6 + n * 0.185; },
  rideshare(b, w, hi) { adapter(b); stow(b, 0.45, 3.07, 0.6, 0.6); b.cyl(1.0, 1.0, 0.12, C.silver, 0, 0.34, 0, 16); b.cyl(0.34, 0.34, 2.2, C.dark, 0, 1.4, 0, 10); const nc = hi ? 8 : 6;
    for (let lv = 0; lv < 2; lv++) for (let i = 0; i < nc; i++) { const a = (i + lv * 0.5) / nc * Math.PI * 2; b.box(0.4, 0.4, 0.4, (i + lv) % 2 ? C.cube : C.goldD, Math.cos(a) * 0.74, 0.62 + lv * 0.75, Math.sin(a) * 0.74, -a); }
    b.cyl(0.62, 0.62, 0.1, C.silver, 0, 2.56, 0, 12); b.box(0.9, 0.9, 0.9, C.gold, 0, 3.07, 0); b.cyl(0.02, 0.02, 0.7, C.silver, 0.2, 3.8, 0.2, 4);
    for (const s of [-1, 1]) { const P = panels(0, 2, 0.5, 0.5, 0.8, 3.07); for (const g of P.g) { if (s < 0) g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); w.g.push(g); } } return 3.8; },
};
const BUILDERS = new Map(); // external kinds (the demo payload is the roadster model registered by vehicles.js)
export const registerPayload = (kind, fn) => BUILDERS.set(kind, fn);
// buildPayload(kind, { r, h, detail }): scaled so its adapter radius <= r and its height <= h (metres)
export function buildPayload(kind, o = {}) {
  const detail = o.detail || 'hi', hi = detail !== 'lo', g = new THREE.Group(); g.name = 'sat';
  let nomH, wingMesh = null;
  if (BUILDERS.has(kind)) { const ext = BUILDERS.get(kind)(detail); g.add(ext.group); nomH = ext.h; g.userData = { kind, nomR: ext.r || 1 }; }
  else { const bld = BUILD[kind] || BUILD.comsat, body = new Acc(!hi), wing = new Acc(!hi); nomH = bld(body, wing, hi);
    if (!hi) { for (const gg of wing.g) gg.dispose(); wing.g.length = 0; } // lo: one body mesh (the stowed slabs), no deployable arrays
    const bm = body.mesh(BODY, 'sat-body'); g.add(bm); wingMesh = wing.mesh(WING, 'sat-wings'); if (wingMesh) { g.add(wingMesh); wingMesh.scale.x = 0.08; } g.userData = { kind, nomR: 1 }; }
  const s = Math.min((o.r ?? 1e9) / g.userData.nomR, (o.h ?? 1e9) / nomH); g.scale.setScalar(s);
  Object.assign(g.userData, { r: g.userData.nomR * s, h: nomH * s, cy: nomH / 2, // cy: centre height in the payload's own (unscaled) units
    deploy(k) { const e = Math.max(0, Math.min(1, k)), sm = e * e * (3 - 2 * e); if (wingMesh) wingMesh.scale.x = 0.08 + 0.92 * sm; } });
  return g;
}
