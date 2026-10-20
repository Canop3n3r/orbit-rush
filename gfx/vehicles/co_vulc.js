// United Lift Alliance (ULX) — Vulcanis: 5.4 m methane core (2 engines, tan foam), 2/4/6 slim solids, 5.4 m hydrogen upper
// (2 engines), 5.4 m fairing standard/long. rocketdb vulcanis (GCAT) + design.md; dims art-fitted. No logos/names.
import * as THREE from 'three/webgpu';
import { xf } from './kit.js?v=art1';
import { stage, fairing, PI, livery, ringPos, Kit, tube, lathe, PR, kb, isHi } from './co_gen.js?v=art1';
import { group, plume } from './co_civspace.js?v=art1';
const R = 2.7, RS = 0.8, OFF = R + RS + 0.08;
function solids(d, name, ang) { const k = new Kit(d), seg = isHi(k) ? 16 : k.mid ? 10 : 6, L = 21.9, nL = 2.6;
  for (const a of ang) { const x = Math.cos(a) * OFF, z = Math.sin(a) * OFF; k.add(new THREE.LatheGeometry([[0.35, 1.4], [0.5, 0.8], [0.6, 0]].map(([r, y]) => new THREE.Vector2(r, y)), seg), 'bell', xf([x, 0, z]));
    tube(k, RS, RS, L - nL - 1.4, 1.4, 'paint:0,0', { x, z, seg }); lathe(k, PR.ogive(RS, nL, L - nL, isHi(k) ? 8 : 4, 0.08), 'paint:0,0', { seg, m: xf([x, 0, z]) }); }
  const g = kb(k, name, L); g.position.y = 0.6; return g; }
function vc(o, n, long) { const d = o.detail, tan = livery(0xc58a4c);
  const a = stage(d, 'core', { r: R, h: 30.8, y0: 2.8, eng: [[2, 1.0, 0.9, 2.6, PI / 2]], key: tan, skirt: R * 1.02, bands: [[29.8, 1.0, 'paint:0,0']], decalY: 20 });
  const ang = n === 2 ? [PI / 2, -PI / 2] : n === 4 ? [PI / 3, 2 * PI / 3, -PI / 3, -2 * PI / 3] : ringPos([[6, 1, PI / 6]]).map(([x, z]) => Math.atan2(z, x));
  const kids = [a]; if (n) kids.push(solids(d, 'srbA', ang));
  const b = stage(d, 'upper', { r: R, h: 11.7, y0: a.userData.top, eng: [[2, 0.9, 0.55, 1.7, 0]], drop: 1.6, ext: true, bands: [[0, 1.0], [11.0, 0.7]] });
  const f = fairing(d, 'payload', { r: R, rb: R, cyl: long ? 13.0 : 7.5, nose: 7.8, y0: b.userData.top }); kids.push(b, f);
  const g = group(`vulcanis-${n}${long ? 'l' : 's'}`, kids, f.userData.top); if (o.plume) g.add(plume(0, [[1.0, 0], [-1.0, 0]], 1.2, 55 * o.plume)); return g; }
export const CO_VULC = {
  'vulcanis-2s': { height: 60.7, build: o => vc(o, 2, false), src: 'rocketdb vulcanis (GCAT): 5.4 m core 33.3 m (2 engines), 2 solids 21.9 m, upper 11.7 m, standard fairing', est: ['fairing length'] },
  'vulcanis-4l': { height: 66.2, build: o => vc(o, 4, true), src: 'rocketdb vulcanis (4 solids, long fairing; 67 m class)', est: ['fairing length'] },
  'vulcanis-6l': { height: 66.2, build: o => vc(o, 6, true), src: 'rocketdb vulcanis (6 solids, long fairing)', est: ['fairing length'] },
};
