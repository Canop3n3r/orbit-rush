// co-krasnaya-2: Krasnaya Orbita Bureau — Mogutny: 7.75 m hydrogen core with 4 engines, four 3.9 m kerosene strap-ons (one
// 4-chamber engine each, cone noses), side-mounted cargo pod (no orbiter; the glider option is planned).
// rocketdb mogutny (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, nose, kb, Kit, tube, lathe, PR, ring, PI, isHi, livery, xf } from './co_gen.js?v=f5.9-4';
import * as THREE from 'three/webgpu';
import { group, plume } from './co_civspace.js?v=f5.9-4';
const R = 3.9, RS = 1.95, OFF = R + RS + 0.15, ANG = [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4], PX = R + 2.05 + 0.25;
function core(d) { const g = stage(d, 'core', { r: R, h: 50.5, y0: 2.6, eng: [[4, 1.6, 0.85, 2.4, PI / 4]], skirt: R * 1.02, key: livery(0xd8a259), bands: [[0, 1.2], [49.0, 1.5, 'paint:0,0']], decalY: 30,
  extra: k => lathe(k, PR.ogive(R, 5.6, 53.1, k.hi ? 16 : 6, 0.3), livery(0xd8a259)) }); g.userData.top = 58.7; return g; }
function strap(d, i) { const a = ANG[i], g = stage(d, 'side' + i, { r: RS, h: 33.5, y0: 2.2, eng: [[4, 0.6, 0.42, 1.9, PI / 4]], key: livery(0xc9ccc4), bands: [[0.0, 1.0], [16, 0.4]],
  extra: k => tube(k, RS, 0.35, 5.5, 35.7, livery(0xc9ccc4)) }); g.position.set(Math.cos(a) * OFF, 0.4, Math.sin(a) * OFF); g.rotation.y = -a; g.userData.top = 41.2; return g; }
function pod(d) { const k = new Kit(d); tube(k, 2.05, 2.05, 30, 14.0, 'paint:0,0'); lathe(k, PR.ogive(2.05, 7.5, 44.0, k.hi ? 14 : 6, 0.1), 'paint:0,0'); tube(k, 2.0, 2.05, 1.2, 12.8, 'dark');
  if (isHi(k)) ring(k, 2.05, 28, 0.02);
  const g = kb(k, 'payload', 51.5); g.position.set(PX, 0, 0); return g; }
// glider: delta-wing glider mounted belly-to-core, nose up (no main engines; small tail thrusters), black belly
function orbiter(d) { const k = new Kit(d), X = R + 2.9, y0 = 13.0, L = 31.0;
  k.add(new THREE.CylinderGeometry(2.6, 2.6, L, isHi(k) ? 28 : 12, 1).scale(0.85, 1, 1), 'paint:0,0', xf([0, y0 + L / 2, 0]));
  lathe(k, PR.ogive(2.6, 5.2, y0 + L, k.hi ? 12 : 6, 0.5), 'paint:0,0', { m: new THREE.Matrix4().makeScale(0.85, 1, 1) });
  if (k.hi) k.add(new THREE.CylinderGeometry(2.63, 2.63, L, 14, 1, true, -PI / 2 - 0.9 + PI, 1.8).scale(0.85, 1, 1), 'dark', xf([0, y0 + L / 2, 0])); // belly tiles (core side)
  const wing = new THREE.Shape([[2.0, 0], [11.9, 0], [11.9, 1.4], [3.5, 15.5], [2.0, 19.0]].map(([z, y]) => new THREE.Vector2(z, y)));
  for (const sgn of [1, -1]) { const g = new THREE.ExtrudeGeometry(wing, { depth: 0.5, bevelEnabled: false }); g.translate(0, 0, -0.25); k.add(g, 'paint:0,0', xf([-0.8, y0, 0], [0, sgn > 0 ? -PI / 2 : PI / 2, 0])); }
  const fin = new THREE.Shape([[2.0, 0], [8.2, 1.5], [8.2, 4.5], [2.0, 9.0]].map(([x, y]) => new THREE.Vector2(x, y))), fg = new THREE.ExtrudeGeometry(fin, { depth: 0.35, bevelEnabled: false }); fg.translate(0, 0, -0.17); k.add(fg, 'paint:0,0', xf([0, y0, 0], [0, PI, 0])); // fin on the side away from the core
  if (k.hi) for (const z of [-1.0, 1.0]) k.add(new THREE.CylinderGeometry(0.35, 0.5, 0.9, 10), 'dark', xf([0.6, y0 - 0.4, z]));
  const g = kb(k, 'orbiter', y0 + L + 5.2); g.position.set(X, 0, 0); g.rotation.y = PI; return g; }
function mogutny(o, orb) { const d = o.detail, c = core(d), kids = [c, ...ANG.map((_, i) => strap(d, i)), orb ? orbiter(d) : pod(d)];
  const g = group(orb ? 'mogutny-glider' : 'mogutny', kids, 58.7); if (o.plume) g.add(plume(0, ANG.map(a => [Math.cos(a) * OFF, Math.sin(a) * OFF]), 1.6, 80 * o.plume)); return g; }
export const CO_MOGUTNY = {
  'mogutny-glider': { height: 58.7, build: o => mogutny(o, true), src: 'rocketdb mogutny (orbiter config): side-mounted delta-wing orbiter 36 m, span 24 m', est: ['orbiter shape'] },
  'mogutny': { height: 58.7, build: o => mogutny(o, false), src: 'rocketdb mogutny (GCAT): 58.7 m, 7.75 m core (4 engines), 4 strap-ons 3.9 m, side cargo pod', est: ['pod size', 'strap-on length'] },
};
