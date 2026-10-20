// Arion Space (launch consortium era) — Europia: 3.05 m kerosene s1 (two engines, lower skirt), 2.0 m s2 (four small engines),
// 2.0 m s3, ogive fairing; white with blue/yellow bands. rocketdb europia (GCAT) + design.md.
import { stage, fairing, PI, livery } from './co_gen.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'europia': 'Europia' };
function eu(o) { const d = o.detail, bl = livery(0x2c4f9e), ye = livery(0xe0b437);
  const a = stage(d, 's1', { r: 1.525, h: 17.7, y0: 1.6, eng: [[2, 0.6, 0.48, 1.4, 0]], skirt: 1.6, bands: [[1.0, 0.6, bl], [1.6, 0.3, ye], [17.0, 0.7]], decalY: 9 });
  const b = stage(d, 's2', { r: 1.0, h: 6.5, y0: a.userData.top, eng: [[4, 0.5, 0.2, 0.6, PI / 4]], drop: 0.6, skirt: 1.525, bands: [[0.3, 0.4, bl]] });
  const c = stage(d, 's3', { r: 1.015, h: 3.8, y0: b.userData.top, eng: [[1, 0, 0.3, 0.6]], drop: 0.5, bands: [[0, 0.4, ye]] });
  const f = fairing(d, 'payload', { r: 1.05, rb: 1.015, cyl: 0.8, nose: 2.6, y0: c.userData.top });
  const g = group('europia', [a, b, c, f], f.userData.top); g.userData.displayName = NAMES['europia'];
  if (o.plume) g.add(plume(0, [[0.6, 0], [-0.6, 0]], 0.8, 30 * o.plume)); return g; }
export const CO_EUROPIA = {
  'europia': { name: NAMES['europia'], height: 31.7, build: o => eu(o), src: 'rocketdb europia (GCAT): 3.05 m s1 17.7 m (2 engines), 2.01 m s2 6.5 m (4 engines), 2.03 m s3 3.8 m, fairing; 31.7 m', est: ['fairing'] },
};
