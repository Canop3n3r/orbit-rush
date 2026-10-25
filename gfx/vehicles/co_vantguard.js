// NOSA — Vantguard: slim finless three-stage launcher (liquid s1, liquid s2, small spherical-ish solid s3 under a long ogive nose),
// white with black roll bands. rocketdb vantguard (GCAT) + design.md.
import { stage, fairing, PI, livery } from './co_gen.js?v=f5.8x';
import { group, plume } from './co_civspace.js?v=f5.8x';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'vantguard': 'Vantguard' };
function vg(o) { const d = o.detail, blk = 'dark';
  const a = stage(d, 's1', { r: 0.57, h: 11.4, y0: 1.0, eng: [[1, 0, 0.36, 0.9]], skirt: 0.6, bands: [[1.2, 0.5], [5.6, 0.5], [10.6, 0.5]], quad: [7.5, 1.6], decalY: 3.5 });
  const b = stage(d, 's2', { r: 0.405, h: 5.0, y0: a.userData.top, eng: [[1, 0, 0.26, 0.6]], drop: 0.5, skirt: 0.57, bands: [[0, 0.6, blk], [3.0, 0.3]] });
  const c = stage(d, 's3', { r: 0.23, h: 1.4, y0: b.userData.top, eng: [[1, 0, 0.14, 0.3]], drop: 0.3, key: blk });
  const f = fairing(d, 'payload', { r: 0.42, rb: 0.405, cyl: 1.6, nose: 3.0, y0: b.userData.top });
  const g = group('vantguard', [a, b, c, f], f.userData.top); g.userData.displayName = NAMES['vantguard'];
  if (o.plume) g.add(plume(0, [[0, 0]], 0.45, 18 * o.plume)); return g; }
export const CO_VANTGUARD = {
  'vantguard': { name: NAMES['vantguard'], height: 22.1, build: o => vg(o), src: 'rocketdb vantguard (GCAT): 1.14 m finless liquid s1 11.4 m, 0.81 m s2 5.0 m, 0.46 m solid s3 1.4 m in nose', est: ['fairing'] },
};
