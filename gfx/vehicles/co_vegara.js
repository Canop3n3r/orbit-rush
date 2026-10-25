// Arion Space — Vegara: four-stage small launcher (three solids in a slim stack + small liquid upper module), ogive fairing;
// 'vegara' (3 m first stage) and 'vegara-c' (bigger 3.4 m first stage, wider 2nd, 3.3 m fairing). rocketdb vegara (GCAT) + design.md.
import { stage, fairing, PI, livery } from './co_gen.js?v=f5.8v';
import { group, plume } from './co_civspace.js?v=f5.8v';
function vg(o, c) { const d = o.detail, R1 = c ? 1.7 : 1.5, R2 = c ? 1.2 : 0.95, grey = livery(0x9a9da0);
  const a = stage(d, 's1', { r: R1, h: c ? 13.4 : 11.7, y0: 1.8, eng: [[1, 0, R1 * 0.55, 1.7]], key: 'paint:0,0', skirt: R1 * 1.04, bands: [[0.4, 0.5], [c ? 12.8 : 11.1, 0.6, grey]], decalY: 6 });
  const b = stage(d, 's2', { r: R2, h: 7.5, y0: a.userData.top, eng: [[1, 0, R2 * 0.55, 1.1]], drop: 0.9, key: 'paint:0,0', skirt: R1, bands: [[0, 0.8, grey]] });
  const e = stage(d, 's3', { r: 0.95, h: 4.1, y0: b.userData.top, eng: [[1, 0, 0.45, 0.8]], drop: 0.6, key: 'paint:0,0', bands: [[0, 0.5, grey]] });
  const u = stage(d, 'upper', { r: 1.1, h: 1.7, y0: e.userData.top, eng: [[1, 0, 0.2, 0.5]], drop: 0.4, ext: true, key: 'dark' });
  const f = fairing(d, 'payload', { r: c ? 1.65 : 1.3, rb: 1.1, cyl: c ? 3.4 : 2.4, nose: c ? 3.6 : 3.0, y0: u.userData.top });
  const g = group(c ? 'vegara-c' : 'vegara', [a, b, e, u, f], f.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 1.0, 30 * o.plume)); return g; }
export const CO_VEGARA = {
  'vegara': { height: 33.2, build: o => vg(o, false), src: 'rocketdb vegara (GCAT): 3 m solid s1 11.7 m, 1.9 m s2 7.5 m, s3 4.1 m, liquid upper, 2.6 m fairing', est: ['fairing'] },
  'vegara-c': { height: 36.5, build: o => vg(o, true), src: 'rocketdb vegara (C-type): 3.4 m s1 13.4 m, wider s2, 3.3 m fairing', est: ['fairing'] },
};
