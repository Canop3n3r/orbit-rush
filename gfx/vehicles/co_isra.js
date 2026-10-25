// co-isra-1: ISRA (parody Indian space research association) — Polar Sat-Slinger: 2.8 m solid first stage with 6 slim strap-on solids
// (one separable set), liquid 2nd stage, small solid 3rd, twin-engine 4th, 3.2 m fairing; Monsoon Heavy: 4 m twin-engine liquid core,
// two 3.2 m solid boosters, cryogenic upper, 5 m bulbous fairing. rocketdb polar-slinger / monsoon-heavy (GCAT) + design.md. No logos/names.
import * as THREE from 'three/webgpu';
import { xf } from './kit.js?v=f5.8x';
import { regNozzle } from './parts.js?v=f5.8x';
import { stage, fairing, srm, PI, livery, ringPos, Kit, tube, lathe, PR, kb, isHi } from './co_gen.js?v=f5.8x';
import { group, plume } from './co_civspace.js?v=f5.8x';
function solids(d, name, pos, r, L, nL) { const k = new Kit(d), seg = isHi(k) ? 16 : k.mid ? 10 : 6;
  for (const [x, z] of pos) { k.add(new THREE.LatheGeometry([[0.4, 0], [0.62, -0.3], [0.7, -1.0]].map(([a, y]) => new THREE.Vector2(a * r / 0.5 * 0.5, y + 1.0)), seg), 'bell', xf([x, 0.3, z])); regNozzle(k, x, 0.3, z, 0.7 * r);
    tube(k, r, r, L - nL - 1.0, 1.3, 'paint:0,0', { x, z, seg }); lathe(k, PR.ogive(r, nL, L - nL + 0.3, isHi(k) ? 8 : 4, 0.08), 'paint:0,0', { seg, m: xf([x, 0, z]) }); }
  return kb(k, name, L + 0.3); }
function polarSlinger(o) { const d = o.detail, R = 1.4, grey = livery(0xb9b4aa), off = R + 0.5 + 0.08;
  const a = stage(d, 's1', { r: R, h: 20.0, y0: 2.0, eng: [[1, 0, 0.8, 1.8]], key: grey, skirt: R * 1.04, bands: [[19.2, 0.8], [8, 0.3, 'paint:0,0']], decalY: 12 });
  const s = solids(d, 'srbA', ringPos([[6, off, PI / 6]]), 0.5, 12.0, 1.6);
  const b = stage(d, 's2', { r: R, h: 10.8, y0: a.userData.top, eng: [[2, 0.4, 0.42, 1.4, PI / 2]], drop: 1.2, bands: [[0, 0.8], [10.0, 0.4]] });
  const c = stage(d, 's3', { r: 1.0, r1: 1.0, h: 3.6, y0: b.userData.top, eng: [[2, 0.3, 0.14, 0.5]], drop: 0.4, key: grey, skirt: R, bands: [] }); // unit 4b: s3 carries its two roster engines (in the interstage, like s4)
  const e = stage(d, 's4', { r: 0.95, h: 2.4, y0: c.userData.top, eng: [[2, 0.35, 0.15, 0.5]], drop: 0.4, ext: true, key: 'silver' });
  const f = fairing(d, 'payload', { r: 1.6, rb: 1.0, cyl: 2.6, nose: 3.0, y0: e.userData.top });
  const g = group('polar-slinger', [a, s, b, c, e, f], f.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 1.0, 35 * o.plume)); return g; }
function monsoonHeavy(o) { const d = o.detail, R = 2.0, off = R + 1.6 + 0.1;
  const a = stage(d, 'core', { r: R, h: 21.0, y0: 2.4, eng: [[2, 0.85, 0.6, 2.0, PI / 2]], key: livery(0xc9a36a), skirt: R * 1.02, bands: [[20.2, 0.8]], decalY: 12 });
  const s = [0, PI].map((g, i) => srm(d, 'srb' + i, { r: 1.6, L: 25.0, nL: 3.4, x: Math.cos(g) * off, z: Math.sin(g) * off, coreR: R, bands: [0.25, 0.5, 0.75] }));
  const b = stage(d, 's2', { r: R, h: 10.5, y0: a.userData.top, eng: [[1, 0, 0.55, 1.5]], drop: 1.3, ext: true, bands: [[0, 0.8], [9.7, 0.5]] });
  const f = fairing(d, 'payload', { r: 2.5, rb: R, cyl: 4.0, nose: 5.0, y0: b.userData.top });
  const g = group('monsoon-heavy', [a, ...s, b, f], f.userData.top); if (o.plume) g.add(plume(0, [[off, 0], [-off, 0]], 1.5, 55 * o.plume)); return g; }
export const CO_ISRA = {
  'polar-slinger': { height: 45.4, build: polarSlinger, src: 'rocketdb polar-slinger (GCAT XL-type): 2.8 m s1 20 m + 6 strap-on solids 12 m, s2 12.8 m, s3, s4, 3.2 m fairing', est: ['s3/s4 split'] },
  'monsoon-heavy': { height: 43.9, build: monsoonHeavy, src: 'rocketdb monsoon-heavy (GCAT): 4 m core 21 m (2 engines), 2 x 3.2 m solids 25 m, cryo upper, 5 m fairing', est: ['fairing'] },
};
