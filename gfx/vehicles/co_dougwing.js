// co-dougwing-1: Doug-Wing Aerospace (parody) — Deltoid II: 2.44 m teal first stage (main engine + 2 verniers), ring of slim white
// solid motors (9 on the 7925-type, 3 on the 7320-type), 2.44 m second stage, 2.9 m fairing (3.0 m-class bulbous on 79xx).
// rocketdb deltoid-2 (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, fairing, PI, livery, ringPos, Kit, tube, lathe, PR, kb, isHi, ring } from './co_gen.js?v=f5.8r';
import * as THREE from 'three/webgpu';
import { xf } from './kit.js?v=f5.8r';
import { regNozzle } from './parts.js?v=f5.8r';
import { group, plume } from './co_civspace.js?v=f5.8r';
// a set of slim solids as ONE separable stage (the real vehicle drops them in groups: 6 ground-lit, then 3 air-lit)
function solids(d, name, pos) { const k = new Kit(d), seg = isHi(k) ? 16 : k.mid ? 10 : 6, L = 13.0, nL = 1.6;
  for (const [x, z] of pos) { k.add(new THREE.LatheGeometry([[0.2, 0], [0.32, -0.15], [0.36, -0.6]].map(([r, y]) => new THREE.Vector2(r, y + 0.6)), seg), 'bell', xf([x, 0.4, z])); regNozzle(k, x, 0.4, z, 0.36);
    tube(k, RS, RS, L - nL - 0.6, 1.0, 'paint:0,0', { x, z, seg }); lathe(k, PR.ogive(RS, nL, L - nL + 0.4, isHi(k) ? 8 : 4, 0.08), 'paint:0,0', { seg, m: xf([x, 0, z]) }); }
  return kb(k, name, 13.4); }
const R = 1.22, RS = 0.505, OFF = R + RS + 0.05;
function d2(o, n) { const d = o.detail, teal = livery(0x2f7f86);
  const a = stage(d, 's1', { r: R, h: 25.0, y0: 2.0, eng: [[1, 0, 0.62, 2.0], [2, 1.0, 0.12, 0.4, PI / 2]], key: teal, skirt: R * 1.02, bands: [[24.0, 1.0, 'paint:0,0'], [11.0, 0.25]], decalY: 14 });
  const b = stage(d, 's2', { r: R, h: 6.0, y0: a.userData.top, eng: [[1, 0, 0.4, 1.0]], drop: 0.9, ext: true, key: 'paint:0,0', bands: [[0, 0.5]] });
  const f = fairing(d, 'payload', { r: n === 9 ? 1.45 : 1.25, rb: R, cyl: 3.6, nose: 4.6, y0: b.userData.top });
  const ang = ringPos([[n, OFF, n === 9 ? 0.35 : PI / 6]]).map(([x, z]) => Math.atan2(z, x));
  const P = ang.map(g => [Math.cos(g) * OFF, Math.sin(g) * OFF]), s = n === 9 ? [solids(d, 'srbA', P.filter((_, i) => i % 3 !== 2)), solids(d, 'srbB', P.filter((_, i) => i % 3 === 2))] : [solids(d, 'srbA', P)];
  const g = group(n === 9 ? 'deltoid-2-heavy9' : 'deltoid-2-light3', [a, ...s, b, f], f.userData.top); if (o.plume) g.add(plume(0, ang.slice(0, 6).map(a => [Math.cos(a) * OFF, Math.sin(a) * OFF]), 0.5, 25 * o.plume)); return g; }
export const CO_DOUGWING = {
  'deltoid-2-heavy9': { height: 39.2, build: o => d2(o, 9), src: 'rocketdb deltoid-2 (GCAT 79xx-type): s1 2.44 m 26 m, 9 x 1.0 m solids 13 m, s2 6 m, 2.9 m fairing', est: ['fairing'] },
  'deltoid-2-light3': { height: 38.6, build: o => d2(o, 3), src: 'rocketdb deltoid-2 (73xx-type): 3 solids, 2.5 m fairing', est: ['fairing'] },
};
