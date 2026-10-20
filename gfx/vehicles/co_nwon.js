// co-krasnaya-2: Krasnaya Orbita Bureau — N-Won super-heavy moon rocket: 105 m cone stack, 30-engine first stage in two rings with
// 4 lattice grid fins, two conical upper stages, then lunar stack (two small stages, crew shroud, escape tower). White with grey.
// Dimensions: rocketdb n-won (GCAT) + design.md; stage split art-fitted. Fully parody; no logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=art1';
import * as PR from './profiles.js?v=art1';
import { lathe, tube, ringPos, ring, decal } from './parts.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
const PI = Math.PI, H = 105.3;
function mini(k, re, L, x, y, z, rt) { const hi = k.detail === 'hi', n = hi ? 5 : 3, seg = hi ? 14 : k.mid ? 8 : 6, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(1 - t, 1.7), t * L)); }
  k.add(new THREE.LatheGeometry(pts, seg), 'bell', xf([x, y, z])); }
const band = (k, r0, r1, h, y, key = 'grey') => tube(k, r0 * 1.004, r1 * 1.004, h, y, key, { open: true, seg: k.detail === 'hi' ? 40 : 14 });
function s1(d) { const k = new Kit(d), y0 = 2.0, h = 30, r0 = 8.4, r1 = 5.15; // 24 outer + 6 inner engines
  for (const [x, z] of ringPos([[k.detail === 'lo' ? 12 : 24, 7.2, 0], [6, 2.4, PI / 6]])) mini(k, k.detail === 'lo' && Math.hypot(x, z) > 5 ? 0.95 : 0.7, 1.9, x, 0.1, z, 0.3);
  lathe(k, [[0, y0], [r0 * 0.96, y0], [r0, y0 + 0.4]], 'dark'); tube(k, r0, r1, h - 0.4, y0 + 0.4, 'paint:0,0', { hs: 1 });
  band(k, r0 * 0.995, r0 * 0.98, 1.8, y0 + 1.2); if (k.hi) band(k, 6.0, 5.15, 4.0, y0 + h - 4.0, 'dark'); // truss interstage look
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; k.add(new THREE.BoxGeometry(2.6, 3.2, 0.35), 'dark', xf([Math.cos(a) * (r0 + 1.0), y0 + 2.4, Math.sin(a) * (r0 + 1.0)], [0, -a, 0])); }
  decal(k, 'booster.side', 7.2, y0 + 12, 6, PI / 2, 0.5); const g = k.build('s1'); g.userData.top = y0 + h; return g; }
function cone(d, name, y0, h, r0, r1, nE, re) { const k = new Kit(d); for (const [x, z] of ringPos([[nE, r0 * 0.55, PI / nE]])) mini(k, re, 1.6, x, y0 - 1.4, z, re * 0.4);
  tube(k, r0, r1, h, y0, 'paint:0,0'); if (k.hi) { band(k, r0, r0 - (r0 - r1) * 0.1, h * 0.1, y0, 'dark'); band(k, r1 + (r0 - r1) * 0.08, r1, h * 0.08, y0 + h * 0.92); }
  const g = k.build(name); g.userData.top = y0 + h; return g; }
function lunar(d, y0) { const k = new Kit(d); // 4th/5th stages + crew shroud + escape tower, one payload stack
  tube(k, 2.2, 2.2, 7.0, y0, 'paint:0,0'); band(k, 2.2, 2.2, 0.6, y0 + 7.0, 'dark'); tube(k, 2.2, 2.0, 15.0, y0 + 7.6, 'paint:0,0'); band(k, 2.05, 2.03, 1.2, y0 + 14);
  const nose = y0 + 22.6; lathe(k, PR.ogive(2.0, 4.0, nose, k.hi ? 14 : 6, 0.25), 'paint:0,0');
  tube(k, 0.25, 0.18, 4.6, nose + 3.9, 'grey', { seg: k.hi ? 10 : 6 }); lathe(k, PR.ogive(0.3, 1.4, nose + 8.5, 8, 0.05), 'dark');
  if (k.hi) for (const [x, z] of ringPos([[4, 0.32, PI / 4]])) tube(k, 0.05, 0.05, 2.2, nose + 3.6, 'grey', { x, z, seg: 4 });
  const g = k.build('payload'); g.userData.top = nose + 9.9; return g; }
function nwon(o) { const d = o.detail, a = s1(d), b = cone(d, 's2', a.userData.top, 20.5, 5.15, 3.8, 8, 0.55), c = cone(d, 's3', b.userData.top, 11.5, 3.8, 3.0, 4, 0.45);
  const g4 = cone(d, 's4', c.userData.top, 10.0, 3.0, 2.2, 1, 0.6), p = lunar(d, g4.userData.top);
  const g = group('n-won', [a, b, c, g4, p], p.userData.top); if (o.plume) g.add(plume(0, ringPos([[8, 6.8, 0]]), 2.4, 95 * o.plume)); return g; }
export const CO_NWON = {
  'n-won': { height: H, build: nwon, src: 'rocketdb n-won (GCAT): 105.3 m, 17 m base cone, 30-engine first stage, 3 conical stages + lunar stack', est: ['stage lengths', 'lunar stack split'] },
};
