// Reusable part builders (all original geometry). y is up, units are metres, every builder adds to a Kit.
import * as THREE from 'three/webgpu';
import { xf } from './kit.js?v=art1';
const PI = Math.PI;
// cylinder/frustum with its base at y
export function tube(k, r0, r1, h, y, key, o = {}) { const g = new THREE.CylinderGeometry(r1, r0, h, o.seg || k.seg, o.hs || 1, !!o.open, o.t0 || 0, o.tl || 2 * PI); k.add(g, key, xf([o.x || 0, y + h / 2, o.z || 0], o.r || [0, 0, 0])); }
// ogive nose from radius r at y up to a tip (blunt radius tip)
export function ogive(k, r, L, y, key, tip = 0.08) { const pts = [], n = k.hi ? 18 : 7, rho = (r * r + L * L) / (2 * r);
  for (let i = 0; i <= n; i++) { const t = i / n, yy = t * L, rr = Math.sqrt(Math.max(0, rho * rho - (L - yy) ** 2)) + r - rho; pts.push(new THREE.Vector2(Math.max(tip * r, rr), y + yy)); }
  pts.push(new THREE.Vector2(0, y + L)); k.add(new THREE.LatheGeometry(pts, k.seg), key); }
// rocket bell: exit radius re at y, throat rt, length L, regen look; ext = radiative extension fraction (vacuum)
export function bell(k, re, L, x, y, z, o = {}) {
  const rt = o.rt || re * 0.38, pts = [], n = k.hi ? 12 : 5;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(1 - t, 1.7), t * L)); }
  k.add(new THREE.LatheGeometry(pts, k.hi ? 28 : 10), o.ext ? 'bellx' : 'bell', xf([x, y, z]));
  if (!k.hi) return;
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
    if (k.hi) { k.add(new THREE.PlaneGeometry(w, h), 'ti', xf([0, h / 2 + 0.1, 0], [0, PI / 2, 0]));
      const t = 0.08; for (const [px, py, sx, sy] of [[0, 0.1, w, t], [0, h + 0.1, w, t], [-w / 2, h / 2 + 0.1, t, h], [w / 2, h / 2 + 0.1, t, h]]) k.add(new THREE.BoxGeometry(t * 3, sy, sx), 'tiframe', xf([0, py, px]));
    } else k.add(new THREE.BoxGeometry(0.12, h, w), 'tiframe', xf([0, h / 2 + 0.1, 0]));
    k.pop(); k.add(new THREE.BoxGeometry(0.5, 0.6, 0.6), 'dark', xf([0.1, 0, 0])); k.pop(); }
}
// landing legs: separate animatable group (pivots at the hull bottom); t=0 stowed against the hull, 1 deployed
export function legs(KitC, detail, r, len, y, n = 4, a0 = PI / 4) {
  const g = new THREE.Group(); g.name = 'legs'; g.userData.pivots = [];
  for (let i = 0; i < n; i++) { const a = a0 + i / n * 2 * PI, piv = new THREE.Group(); piv.position.set(Math.cos(a) * (r + 0.12), y, Math.sin(a) * (r + 0.12)); piv.rotation.y = -a;
    const k = new KitC(detail);
    k.add(new THREE.BoxGeometry(0.28, len, 0.9), 'carbon', xf([0.14, len / 2, 0])); // main leg (carbon/honeycomb)
    k.add(new THREE.BoxGeometry(0.3, 0.5, 1.1), 'dark', xf([0.16, len - 0.25, 0])); // foot
    if (k.hi) { k.add(new THREE.CylinderGeometry(0.09, 0.09, len * 0.55, 6), 'grey', xf([0.36, len * 0.35, 0], [0, 0, 0.1])); k.add(new THREE.BoxGeometry(0.06, len * 0.9, 0.06), 'dark', xf([0.3, len * 0.5, 0.42])); }
    const m = k.build('leg'); piv.add(m); g.add(piv); g.userData.pivots.push(piv); }
  setLegs(g, 0); return g;
}
// stowed legs point up along the hull (rotation 0); deployed swing out and down by ~115°
export function setLegs(g, t) { for (const p of g.userData.pivots) p.rotation.z = -t * 2.0; g.userData.t = t; }
// decal strip: a cylinder section just outside radius r, height h, centred on angle ac, arc width (radians)
export function decal(k, slot, r, y, h, ac = 0, arc = 1.1) { if (!k.hi) return; k.add(new THREE.CylinderGeometry(r * 1.004, r * 1.004, h, 24, 1, true, ac - arc / 2 + PI / 2, arc), 'decal:' + slot, xf([0, y + h / 2, 0])); }
// external raceway / cable tray along a tank
export function raceway(k, r, y0, y1, a = PI / 2) { k.add(new THREE.BoxGeometry(0.22, y1 - y0, 0.45), k.hi ? 'paint:0,0' : 'paint:0,0', xf([Math.cos(a) * (r + 0.1), (y0 + y1) / 2, Math.sin(a) * (r + 0.1)], [0, -a, 0])); }
export function ring(k, r, y, t, key = 'dark') { tube(k, r + t, r + t, t * 1.6, y, key); }
// strut between two points
export function strut(k, a, b, rad, key) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B), g = new THREE.CylinderGeometry(rad, rad, L, 6);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); k.add(g, key, new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))); }
