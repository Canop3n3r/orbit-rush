// Krunov Machine Works — Taiga: modular 2.9 m common cores (one engine each), wider 3.6 m upper, 4.1 m fairing.
// 'taiga-1' single core light, 'taiga-a5' heavy with four strap-on cores (cone noses). Grey-white, dark band, blue stripe. rocketdb taiga + design.md.
import { stage, fairing, PI, livery } from './co_gen.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'taiga-1': 'Taiga 1', 'taiga-a5': 'Taiga A5' };
const R = 1.45, ANG = [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4], OFF = 2 * R + 0.1;
function taiga(o, heavy) { const d = o.detail, gw = livery(0xd9dbd6), blue = livery(0x3a64a8), id = heavy ? 'taiga-a5' : 'taiga-1';
  const a = stage(d, 'core', { r: R, h: 27.7, y0: 2.4, eng: [[1, 0, 0.9, 2.2]], key: gw, skirt: R * 1.03, bands: [[0, 1.0], [24.5, 0.4, blue], [26.7, 1.0]], decalY: 14 });
  const sides = heavy ? ANG.map((g, i) => { const s = stage(d, 'side' + i, { r: R, h: 25.5, y0: 2.4, eng: [[1, 0, 0.9, 2.2]], key: gw, bands: [[0, 1.0], [22.5, 0.4, blue]]}); s.position.set(Math.cos(g) * OFF, 0, Math.sin(g) * OFF); return s; }) : [];
  for (const s of sides) { const n = stage(d, s.name + 'n', { r: R, r1: 0.25, h: 3.4, y0: 27.9, key: gw }); s.add(...n.children.splice(0)); }
  const r2 = heavy ? 1.8 : R, b = stage(d, 'upper', { r: r2, h: heavy ? 5.5 : 6.5, y0: a.userData.top, eng: [[1, 0, 0.55, 1.4]], drop: 1.0, ext: true, key: gw, skirt: heavy ? R : 0, bands: [[0, 0.8]] });
  const f = fairing(d, 'payload', { r: heavy ? 2.05 : 1.6, rb: r2, cyl: heavy ? 5.0 : 3.5, nose: heavy ? 5.5 : 4.0, y0: b.userData.top });
  const g = group(id, [a, ...sides, b, f], f.userData.top); g.userData.displayName = NAMES[id];
  if (o.plume) g.add(plume(0, heavy ? [[0, 0], ...ANG.map(t => [Math.cos(t) * OFF, Math.sin(t) * OFF])] : [[0, 0]], 1.0, 50 * o.plume)); return g; }
export const CO_TAIGA = {
  'taiga-1': { name: NAMES['taiga-1'], height: 41.5, build: o => taiga(o, false), src: 'rocketdb taiga (light): 2.9 m common core 27.7 m, upper, fairing', est: ['upper length', 'fairing'] },
  'taiga-a5': { name: NAMES['taiga-a5'], height: 43.0, build: o => taiga(o, true), src: 'rocketdb taiga (A5, GCAT): 2.9 m core + 4 strap-on cores, 3.6 m upper 5.5 m, 4.1 m fairing; 42.8 m', est: ['fairing', 'strap nose'] },
};
