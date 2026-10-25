// Ling-Volt Scout Co. — Scoutling: slim all-solid four-stage launcher, four base fins with tip tabs, white with black roll bands; ogive fairing.
// 'scoutling' (late D-type, 25 m) and 'scoutling-x1' (first X-type, 21.6 m, smaller nose). rocketdb scoutling (GCAT) + design.md.
import { stage, fairing, fin, PI, livery } from './co_gen.js?v=f5.9-4';
import { group, plume } from './co_civspace.js?v=f5.9-4';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'scoutling': 'Scoutling', 'scoutling-x1': 'Scoutling X-1' };
function sc(o, x1) { const d = o.detail, s = x1 ? 0.9 : 1;
  const a = stage(d, 's1', { r: 0.57, h: 9.4 * s, y0: 1.2, eng: [[1, 0, 0.42, 1.0]], bands: [[0.6, 0.35], [4.2 * s, 0.35], [8.6 * s, 0.5]], decalY: 5,
    extra: k => { for (let i = 0; i < 4; i++) fin(k, PI / 4 + i * PI / 2, 0.57, 0.85, 2.2, 0.05, 0.06); } });
  const b = stage(d, 's2', { r: 0.4, h: 6.0 * s, y0: a.userData.top, eng: [[1, 0, 0.3, 0.7]], drop: 0.6, skirt: 0.57, bands: [[2.5, 0.3]] });
  const c = stage(d, 's3', { r: 0.38, h: 2.9, y0: b.userData.top, eng: [[1, 0, 0.25, 0.5]], drop: 0.4, bands: [[0, 0.3]] });
  const e = stage(d, 's4', { r: 0.25, h: 1.5, y0: c.userData.top, eng: [[1, 0, 0.16, 0.35]], drop: 0.3, key: 'dark', skirt: 0.38 });
  const f = fairing(d, 'payload', { r: x1 ? 0.42 : 0.53, rb: 0.38, cyl: x1 ? 1.0 : 1.6, nose: x1 ? 1.4 : 1.9, y0: e.userData.top - 1.2 });
  const id = x1 ? 'scoutling-x1' : 'scoutling', g = group(id, [a, b, c, e, f], f.userData.top); g.userData.displayName = NAMES[id];
  if (o.plume) g.add(plume(0, [[0, 0]], 0.5, 18 * o.plume)); return g; }
export const CO_LINGVOLT = {
  'scoutling': { name: NAMES['scoutling'], height: 25.0, build: o => sc(o, false), src: 'rocketdb scoutling (GCAT): 1.14 m solid s1 9.4 m, 0.79 m s2 6.0 m, 0.76 m s3 2.9 m, 0.5 m s4 1.5 m, fairing', est: ['fairing', 'fins'] },
  'scoutling-x1': { name: NAMES['scoutling-x1'], height: 21.6, build: o => sc(o, true), src: 'rocketdb scoutling (first X-type): shorter s1/s2, smaller nose', est: ['fairing', 'fins'] },
};
