// co-jaxo-1: JAXO (parody Japanese aero-space organisation) — H-Too: 4 m hydrogen core (1 engine), 4 m upper, 4 m-class fairing;
// 'h-too' = two big solids; 'h-too-2024' = two big + two slim solids. White with pale-blue bands. rocketdb h-too (GCAT) + design.md.
import { stage, fairing, srm, PI, livery } from './co_gen.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
const R = 2.0;
function ht(o, four) { const d = o.detail, sky = livery(0x7fa8cf), cream = livery(0xe8e2d2);
  const a = stage(d, 's1', { r: R, h: 33.0, y0: 2.6, eng: [[1, 0, 0.95, 2.6]], key: cream, skirt: R * 1.02, bands: [[31.8, 1.2, sky], [6.0, 0.6, sky]], decalY: 20 });
  const b = stage(d, 's2', { r: R, h: 9.2, y0: a.userData.top, eng: [[1, 0, 0.6, 1.6]], drop: 1.4, ext: true, bands: [[0, 0.9]] });
  const f = fairing(d, 'payload', { r: 2.035, rb: R, cyl: 6.0, nose: 6.0, y0: b.userData.top });
  const off = R + 1.25 + 0.1, big = [0, PI].map((g, i) => srm(d, 'srb' + i, { r: 1.25, L: 15.2, nL: 3.0, x: Math.cos(g) * off, z: Math.sin(g) * off, coreR: R }));
  const offS = R + 0.5 + 0.1, small = four ? [PI / 2, -PI / 2].map((g, i) => srm(d, 'ssb' + i, { r: 0.5, L: 14.9, nL: 2.0, x: Math.cos(g) * offS, z: Math.sin(g) * offS, coreR: R, bands: [] })) : [];
  const g = group(four ? 'h-too-2024' : 'h-too', [a, ...big, ...small, b, f], f.userData.top); if (o.plume) g.add(plume(0, [[off, 0], [-off, 0]], 1.2, 45 * o.plume)); return g; }
export const CO_JAXO = {
  'h-too': { height: 56.9, build: o => ht(o, false), src: 'rocketdb h-too (GCAT): 4 m core 37.8 m, 2 x 2.5 m solids 15.2 m, s2 9.2 m, 4 m fairing', est: ['fairing length'] },
  'h-too-2024': { height: 56.9, build: o => ht(o, true), src: 'rocketdb h-too (2024-type): + 2 slim solids', est: ['fairing length'] },
};
