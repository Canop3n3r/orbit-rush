// Orbitron Sciences (parody) — Pegacorn: air-launched 3-stage solid winged rocket (delta wing + 3 tail fins on stage 1), shown on a
// launch table for the showroom; Antarion: 3.9 m kerosene core (2 engines), solid upper, 3.9 m fairing. rocketdb pegacorn / antarion.
import * as THREE from 'three/webgpu';
import { xf } from './kit.js?v=f5.8s';
import { stage, fairing, PI, livery, fin } from './co_gen.js?v=f5.8s';
import { group, plume } from './co_civspace.js?v=f5.8s';
function peg(o) { const d = o.detail, R = 0.64, dk = livery(0x2e3033);
  const a = stage(d, 's1', { r: R, h: 8.9, y0: 0.9, eng: [[1, 0, 0.45, 0.9]], key: 'paint:0,0', bands: [[0, 0.5]], decalY: 5,
    extra: k => { const w = new THREE.Shape([[0, 0], [3.35, 0.3], [3.35, 1.1], [0, 4.2]].map(([z, y]) => new THREE.Vector2(z, y)));
      for (const s of [1, -1]) { const g = new THREE.ExtrudeGeometry(w, { depth: 0.12, bevelEnabled: false }); g.translate(0, 0, -0.06); k.add(g, dk, xf([0, 4.6, 0], [0, s * PI / 2, 0])); }
      for (let i = 0; i < 3; i++) fin(k, PI / 2 + i * 2 * PI / 3, R, 0.75, 1.2, 1.0, 0.06); } });
  const b = stage(d, 's2', { r: R, h: 3.3, y0: a.userData.top, eng: [[1, 0, 0.3, 0.6]], drop: 0.5, key: 'paint:0,0', bands: [[0, 0.3]] });
  const c = stage(d, 's3', { r: 0.49, h: 1.6, y0: b.userData.top, eng: [[1, 0, 0.2, 0.4]], drop: 0.3, key: 'dark', skirt: R });
  const f = fairing(d, 'payload', { r: R, rb: 0.49, cyl: 1.0, nose: 1.4, y0: c.userData.top });
  const g = group('pegacorn', [a, b, c, f], f.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 0.45, 10 * o.plume)); return g; }
function ant(o) { const d = o.detail, R = 1.95, tan = livery(0xd9c7a0);
  const a = stage(d, 's1', { r: R, h: 27.6, y0: 2.4, eng: [[2, 0.85, 0.6, 2.1, PI / 2]], key: tan, skirt: R * 1.02, bands: [[26.8, 0.8, 'paint:0,0'], [10, 0.3]], decalY: 16 });
  const b = stage(d, 's2', { r: 1.18, h: 3.9, y0: a.userData.top, eng: [[1, 0, 0.6, 1.2]], drop: 1.0, key: 'dark', skirt: R });
  const f = fairing(d, 'payload', { r: R, rb: 1.18, cyl: 4.0, nose: 3.4, y0: b.userData.top });
  const g = group('antarion', [a, b, f], f.userData.top); if (o.plume) g.add(plume(0, [[0.85, 0], [-0.85, 0]], 0.8, 35 * o.plume)); return g; }
export const CO_ORBITRON = {
  'pegacorn': { height: 18.1, build: peg, src: 'rocketdb pegacorn (GCAT): 1.28 m, 16.9 m, 3 solid stages, 6.7 m wing', est: ['wing planform'] },
  'antarion': { height: 42.3, build: ant, src: 'rocketdb antarion (GCAT): 3.9 m core 27.6 m (2 engines), solid upper 3.9 m, 3.9 m fairing', est: ['fairing'] },
};
