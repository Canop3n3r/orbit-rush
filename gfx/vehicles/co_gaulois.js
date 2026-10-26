// Gaulois Spatial — Diamantine: slim three-stage launcher, 1.4 m liquid s1 with four small fins, 0.8 m s2, solid s3 in ogive fairing;
// white/black checker roll pattern. 'diamantine-a' (first type, 19 m) and 'diamantine-b' (longer/wider s1, 23.5 m). rocketdb diamantine + design.md.
import { stage, fairing, fin, quads, PI } from './co_gen.js?v=f5.9-5';
import { group, plume } from './co_civspace.js?v=f5.9-5';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'diamantine-a': 'Diamantine A', 'diamantine-b': 'Diamantine B' };
function dm(o, B) { const d = o.detail, id = B ? 'diamantine-b' : 'diamantine-a', R = B ? 0.7 : 0.67, H = B ? 14.0 : 10.0;
  const a = stage(d, 's1', { r: R, h: H, y0: 1.0, eng: [[1, 0, 0.45, 1.0]], skirt: R * 1.05, quad: [H - 2.4, 1.6], bands: [[0.4, 0.4]], decalY: H * 0.45,
    extra: k => { quads(k, R, 1.0 + 1.4, 1.2); for (let i = 0; i < 4; i++) fin(k, PI / 4 + i * PI / 2, R, 0.5, 1.4, 0.4, 0.05); } });
  const b = stage(d, 's2', { r: 0.4, h: 4.6, y0: a.userData.top, eng: [[1, 0, 0.26, 0.6]], drop: 0.5, skirt: R, quad: [2.0, 1.0] });
  const c = stage(d, 's3', { r: 0.33, h: 1.7, y0: b.userData.top, eng: [[1, 0, 0.18, 0.35]], drop: 0.3, key: 'dark' });
  const f = fairing(d, 'payload', { r: 0.45, rb: 0.4, cyl: 1.8, nose: 1.6, y0: b.userData.top });
  const g = group(id, [a, b, c, f], f.userData.top); g.userData.displayName = NAMES[id];
  if (o.plume) g.add(plume(0, [[0, 0]], 0.5, 20 * o.plume)); return g; }
export const CO_GAULOIS = {
  'diamantine-a': { name: NAMES['diamantine-a'], height: 19.0, build: o => dm(o, false), src: 'rocketdb diamantine (first type): 1.34 m s1 ~10 m, 0.8 m s2 4.6 m, solid s3, fairing', est: ['s1 length', 'fairing'] },
  'diamantine-b': { name: NAMES['diamantine-b'], height: 23.5, build: o => dm(o, true), src: 'rocketdb diamantine (B, GCAT): 1.4 m s1 14.0 m, 0.8 m s2 4.6 m, 0.8 m s3 1.7 m; 23.5 m', est: ['fairing', 'fins'] },
};
