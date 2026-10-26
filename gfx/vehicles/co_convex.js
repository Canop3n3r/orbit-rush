// co-convex-1: ConVar Astro (parody) — Titanus IV (3.05 m core, 2 stages, two big solid motors, 5.1 m long fairing) and
// Atlantean (1.5-stage balloon-tank: jettisoned booster skirt with 2 engines + sustainer; crew capsule + tower, or slim upper stage).
// rocketdb titanus-4 / atlantean (GCAT) + design.md; splits art-fitted. No logos/names.
import { stage, nose, fairing, srm, capsule, tower, kb, Kit, tube, bell, ring, PI, isHi, livery } from './co_gen.js?v=f5.9-6';
import { group, plume } from './co_civspace.js?v=f5.9-6';
const R = 1.525;
function t4(o) { const d = o.detail, off = R + 1.6 + 0.15;
  const a = stage(d, 's1', { r: R, h: 26.0, y0: 2.2, eng: [[2, 0.72, 0.6, 2.1]], skirt: R * 1.03, bands: [[25.0, 1.0]], decalY: 14 });
  const b = stage(d, 's2', { r: R, h: 9.0, y0: a.userData.top, eng: [[1, 0, 0.62, 1.6]], drop: 1.4, ext: true, bands: [[0, 0.8]] });
  const f = fairing(d, 'payload', { r: 2.55, rb: R, cyl: 17, nose: 8, y0: b.userData.top });
  const s = [0, PI].map((ang, i) => srm(d, 'srb' + i, { r: 1.6, L: 34.3, nL: 4.5, x: Math.cos(ang) * off, z: Math.sin(ang) * off, key: livery(0x9a9c9e), coreR: R, bands: [0.2, 0.4, 0.6, 0.8] }));
  const g = group('titanus-4', [a, ...s, b, f], f.userData.top); if (o.plume) g.add(plume(0, [[off, 0], [-off, 0]], 1.5, 70 * o.plume)); return g; }
function booster(d) { const k = new Kit(d); for (const x of [-1.2, 1.2]) { bell(k, 0.55, 1.8, x, 0, 0, { head: 0.4, rt: 0.2 }); if (isHi(k)) tube(k, 0.55, 0.55, 1.2, 1.8, 'grey', { x, seg: 10 }); }
  tube(k, 2.0, R, 3.0, 1.6, 'paint:0,0'); tube(k, 2.0, 2.0, 0.3, 1.4, 'dark'); return kb(k, 'booster', 4.6); }
function sustainer(d, h) { const k = new Kit(d); bell(k, 0.45, 1.5, 0, 2.6, 0, { head: 0.3 }); tube(k, R, R, h - 3.0, 4.6, 'silver'); tube(k, R, 1.0, 3.0, 4.6 + h - 3.0, 'silver');
  if (isHi(k)) { ring(k, R, 10, 0.015); ring(k, R, 16, 0.015); for (const s of [-1, 1]) tube(k, 0.18, 0.18, h - 4, 5.0, 'grey', { x: s * (R + 0.1), seg: 6 }); }
  return kb(k, 'sustainer', 4.6 + h); }
function balloon(o, crew) { const d = o.detail, b = booster(d), s = sustainer(d, crew ? 18.5 : 20.5), y = s.userData.top; let top;
  if (crew) { const c = capsule(d, 'capsule', { r: 0.95, h: 2.1, y0: y, can: 0.65 }); top = [c, tower(d, 'les', { y0: c.userData.top, w: 0.32, h: 2.2, rocket: 0.14 })]; }
  else { const u = stage(d, 'upper', { r: 0.76, h: 6.2, y0: y, eng: [[1, 0, 0.35, 0.9]], drop: 0.8, ext: true, key: livery(0xc8c3b8), bands: [[5.6, 0.6]] }); top = [u, nose(d, 'payload', { r: 0.76, L: 2.6, y0: u.userData.top })]; }
  const g = group(crew ? 'atlantean-crew' : 'atlantean-upper', [b, s, ...top], top.at(-1).userData.top); if (o.plume) g.add(plume(0, [[1.2, 0], [-1.2, 0], [0, 0]], 0.6, 30 * o.plume)); return g; }
export const CO_CONVEX = {
  'titanus-4': { height: 63.2, build: t4, src: 'rocketdb titanus-4 (GCAT, B config): 3.05 m core 2 stages, 2 x 3.2 m solids 34.3 m, 5.1 m fairing ~26 m', est: ['fairing length'] },
  'atlantean-crew': { height: 28.7, build: o => balloon(o, true), src: 'rocketdb atlantean crew config: booster skirt + sustainer, 1.9 m capsule + tower, 28.7 m', est: ['tank taper'] },
  'atlantean-upper': { height: 36.2, build: o => balloon(o, false), src: 'rocketdb atlantean + slim 1.52 m upper stage config', est: ['upper length'] },
};
