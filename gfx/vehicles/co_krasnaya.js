// co-krasnaya-1: Krasnaya Orbita Bureau (parody) R-7 family: rodnik (crew), rodnik-2 (upper block + wide fairing),
// lastochka (early crew ball shroud), pervy (2-stage first-orbit). Original geometry, no logos/names.
// Dimensions: rocketdb rodnik / rodnik-2 / lastochka / pervy (GCAT) + design.md; strap-on/core profile art-fitted.
// crossSep(g, t): the four strap-ons pivot about their lower attach point and swing their noses outward (0..1),
// the classic "cross" separation; t = 0 attached.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.8z';
import * as PR from './profiles.js?v=f5.8z';
import { regNozzle, lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.8z';
import { group, lmat, plume } from './co_civspace.js?v=f5.8z';
const PI = Math.PI, R = PR.R7;
const darkBells = g => { for (const m of g.children) if (m.name.endsWith(':bell')) m.material = lmat('x-bellblack'); return g; };
function bands(k, prof, ys, key = 'grey') { for (const y of ys) { let r = 0; for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; r = r0 + (r1 - r0) * (y - y0) / (y1 - y0); break; } tube(k, r * 1.008, r * 1.008, 0.35, y, key, { open: true }); } }
// four-chamber engine cluster (+ vernier pair or quad), exits at y = 0
// light bell (no powerhead): 36 chambers per vehicle, so keep them cheap. Key 'bell' -> darkened by darkBells
function mini(k, re, L, x, y, z, rt) { const n = k.hi && !k.mid ? 5 : 3, seg = k.hi && !k.mid ? 14 : k.mid ? 8 : 6, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(1 - t, 1.7), t * L)); } k.add(new THREE.LatheGeometry(pts, seg), 'bell', xf([x, y, z])); regNozzle(k, x, y, z, re); }
function cluster(k, x0, z0, rr, nV, vr) { for (const [x, z] of ringPos([[4, rr, PI / 4]])) mini(k, 0.36, 1.45, x0 + x, 0.05, z0 + z, 0.17);
  if (k.hi) for (const [x, z] of ringPos([[nV, vr, 0]])) mini(k, 0.17, 0.7, x0 + x, 0.35, z0 + z, 0.08); }
function core(d) { const k = new Kit(d), prof = PR.rkCore(1.5); cluster(k, 0, 0, 0.42, 4, 1.05);
  lathe(k, prof, 'paint:0.15,0'); bands(k, prof, [9.5, 19.6, 26.6]); tube(k, 1.03, 1.03, 0.4, 1.1, 'dark');
  decal(k, 'booster.side', 1.47, 22, 2.6, 0, 0.8);
  return darkBells(k.build('core')); }
// one strap-on; group origin = lower attach pivot on the core surface, local +x = radial out
function strap(d, i) { const k = new Kit(d), a = PI / 4 + i * PI / 2, cx = R.off - 1.1, tilt = Math.atan((R.off - 1.62) / (R.sTip - 1.5));
  k.push(xf([cx, -1.5, 0])); k.push(xf([0, 1.5, 0], [0, 0, tilt]).multiply(xf([0, -1.5, 0])));
  cluster(k, 0, 0, 0.42, 2, 0.95); const prof = PR.r7Strap(1.5); lathe(k, prof, 'paint:0.2,0'); bands(k, prof, [5.6, 12.5]); tube(k, R.sr, R.sr, 0.4, 1.1, 'dark');
  // air rudder (small triangular fin) on the outer side + the attach strut at the nose
  k.add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.1, 0.2), new THREE.Vector2(0, 1.6)]), { depth: 0.08, bevelEnabled: false }), 'grey', xf([R.sr, 1.7, -0.04]));
  k.pop(); k.pop(); strut(k, [R.off - 1.1 - 0.25, R.sTip - 1.6, 0], [0.32, R.sTip - 1.3, 0], 0.07, 'dark');
  const g = darkBells(k.build('strap' + i)); g.position.set(Math.cos(a) * 1.1, 1.5, Math.sin(a) * 1.1); g.rotation.y = -a; g.userData.pivot = true; return g; }
export function crossSep(g, t) { for (const s of Object.values(g.userData.stages)) if (s.userData.pivot) { s.rotation.z = -t * 1.1; s.position.y = 1.5 - t * 4; } }
function third(d, o) { const k = new Kit(d), y0 = R.coreTop, top = y0 + 1.3 + (o.h3 || 6.7), r = o.r3 || 1.33;
  for (let i = 0; i < (k.hi ? 12 : 6); i++) { const a0 = i / 12 * 2 * PI, a1 = (i + 1.5) / 12 * 2 * PI; strut(k, [Math.cos(a0) * 1.25, y0, Math.sin(a0) * 1.25], [Math.cos(a1) * r * 0.95, y0 + 1.3, Math.sin(a1) * r * 0.95], 0.04, 'dark'); } // open truss interstage
  for (const [x, z] of ringPos([[4, 0.35, PI / 4]])) mini(k, 0.22, 0.9, x, y0 + 0.2, z, 0.1);
  tube(k, r, r, top - y0 - 1.3, y0 + 1.3, 'paint:0,0'); bands(k, [[r, y0], [r, top]], [y0 + 1.6, top - 0.6]);
  decal(k, 'upper.side', r, y0 + 3, 2, 0, 0.9);
  const g = darkBells(k.build('third')); g.userData.top = top; return g; }
function crew(d, y0) { const k = new Kit(d), p = PR.rkShroud(y0); lathe(k, p, 'paint:0,0'); tube(k, 1.5 * 1.008, 1.5 * 1.008, 0.4, y0 + 3.6, 'grey', { open: true });
  if (k.hi) for (let i = 0; i < 4; i++) { const a = i * PI / 2; k.push(xf([Math.cos(a) * 1.55, y0 + 3.2, Math.sin(a) * 1.55], [0, -a, 0]));
    k.add(new THREE.BoxGeometry(0.12, 1.4, 1.1), k.hi ? 'tiframe' : 'dark', xf([0.4, 0, 0], [0, 0, -0.5])); k.pop(); } // 4 lattice stabiliser panels (folded)
  const tb = y0 + 8.6; for (const [x, z] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) strut(k, [x * 0.25, tb, z * 0.25], [x * 0.12, tb + 2.4, z * 0.12], 0.04, 'dark'); // escape tower
  tube(k, 0.28, 0.24, 2.5, tb + 2.4, 'paint:0,0'); lathe(k, PR.ogive(0.24, 0.9, tb + 4.9, 10, 0.2), 'paint:0,0');
  const g = k.build('payload'); g.userData.top = tb + 5.8; return g; }
function cargo(d, y0) { const k = new Kit(d); tube(k, 1.33, 1.33, 1.6, y0, 'grey'); const p = PR.fairing(2.05, 4.5, 4.4, y0 + 1.6, 1.33, k.hi ? 18 : 8, 1.2); lathe(k, p, 'paint:0,0');
  if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 });
  const g = k.build('payload'); g.userData.top = p.at(-1)[1]; return g; }
function ball(d, y0) { const k = new Kit(d); tube(k, 1.3, 1.3, 1.2, y0, 'paint:0,0'); lathe(k, PR.ogive(1.3, 3.2, y0 + 1.2, k.hi ? 18 : 7, 0.12), 'paint:0,0');
  if (k.hi) for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI; k.add(new THREE.BoxGeometry(0.4, 0.3, 0.1), 'dark', xf([Math.cos(a) * 1.0, y0 + 2.4, Math.sin(a) * 1.0], [0.5, -a + PI / 2, 0])); } // vent windows
  const g = k.build('payload'); g.userData.top = y0 + 4.4; return g; }
function firstCone(d) { const k = new Kit(d); lathe(k, PR.ogive(1.33, 3.0, R.coreTop, k.hi ? 16 : 7, 0.08), 'silver'); const g = k.build('payload'); g.userData.top = R.coreTop + 3.0; return g; }
function rk(o, name, upper, pay) { const d = o.detail, c = core(d), s = [0, 1, 2, 3].map(i => strap(d, i)), kids = [c, ...s];
  let top = R.coreTop; if (upper) { const u = third(d, upper); kids.push(u); top = u.userData.top; }
  const p = pay(d, top); kids.push(p); const g = group(name, kids, p.userData.top);
  if (o.cross) crossSep(g, o.cross);
  if (o.plume) { const P = plume(0, [[0, 0], ...ringPos([[4, R.off, PI / 4]])], 1.2, 40 * o.plume); g.add(P); } return g; }
export const CO_KRASNAYA = {
  'rodnik': { height: 49.5, build: o => rk(o, 'rodnik', { h3: 6.7 }, crew), src: 'rocketdb rodnik (GCAT): ~49.5 m crew, core 2.95 m, strap-ons 2.68 m x 19.6 m', est: ['core taper', 'shroud'] },
  'rodnik-2': { height: 46.3, build: o => rk(o, 'rodnik-2', { h3: 6.7 }, (d, y) => cargo(d, y)), src: 'rocketdb rodnik-2 (GCAT): ~46 m with upper block + 4.1 m fairing', est: ['fairing length'] },
  'lastochka': { height: 38.4, build: o => rk(o, 'lastochka', { h3: 3.1, r3: 1.29 }, ball), src: 'rocketdb lastochka (GCAT): 38.4 m, small 3rd stage 2.58 m', est: ['shroud'] },
  'pervy': { height: 30.8, build: o => rk(o, 'pervy', null, firstCone), src: 'rocketdb pervy (GCAT): ~29-31 m, 2 stages, conical nose', est: ['nose length'] },
};
