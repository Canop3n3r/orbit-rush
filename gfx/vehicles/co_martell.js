// co-martell-1: Martell Marietta (parody) — Titanus II: 3.05 m two-stage hypergolic rocket. 'titanus-2' = crew launcher (white/grey,
// adapter + two-seat capsule); 'titanus-2-icbm' = dark missile with re-entry nose. rocketdb titanus-2 (GCAT) + design.md. No logos/names.
import { stage, nose, capsule, kb, Kit, tube, ring, PI, livery, isHi } from './co_gen.js?v=f5.9-4';
import { group, plume } from './co_civspace.js?v=f5.9-4';
const R = 1.525;
function t2(o, crew) { const d = o.detail, key = crew ? 'paint:0,0' : livery(0x3b3d40);
  const a = stage(d, 's1', { r: R, h: 19.0, y0: 2.2, eng: [[2, 0.72, 0.6, 2.1]], key, skirt: R * 1.03, bands: [[18.0, 1.0], [8.0, 0.3, 'grey']], decalY: 10 });
  const b = stage(d, 's2', { r: R, h: 7.8, y0: a.userData.top, eng: [[1, 0, 0.62, 1.6]], drop: 1.4, ext: true, key, bands: [[0, 0.8]] });
  const top = crew ? (() => { const k = new Kit(d), y = b.userData.top; tube(k, R, 1.16, 1.6, y, 'paint:0,0'); if (isHi(k)) ring(k, 1.16, y + 1.55, 0.015); return [kb(k, 'adapter', y + 1.6), capsule(d, 'capsule', { r: 1.15, h: 2.1, y0: y + 1.6, can: 0.35 })]; })()
    : [nose(d, 'payload', { r: R, L: 3.2, y0: b.userData.top, key: 'dark', tip: 0.1, base: 0.4 })];
  const g = group(crew ? 'titanus-2' : 'titanus-2-icbm', [a, b, ...top], top.at(-1).userData.top); if (o.plume) g.add(plume(0, [[0.72, 0], [-0.72, 0]], 0.7, 30 * o.plume)); if (!crew) g.userData.fixedNose = true; return g; }
export const CO_MARTELL = {
  'titanus-2': { height: 33.2, build: o => t2(o, true), src: 'rocketdb titanus-2 (GCAT crew config): s1 3.05 m (2 engines), s2 (1 engine), adapter + 2-seat capsule, 33.2 m', est: ['adapter length'] },
  'titanus-2-icbm': { height: 32.6, build: o => t2(o, false), src: 'rocketdb titanus-2 missile config: dark livery, re-entry nose', est: ['nose length'] },
};
