// Albion Rocket Establishment (parody, historic) — Dark Dart: 2 m kerosene/peroxide first stage with 8 small engines in 4 pairs,
// 1.37 m second stage (2 engines), small solid third stage inside a short ogive fairing; black livery with silver bands.
// rocketdb dark-dart (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, fairing, PI, livery } from './co_gen.js?v=f5.9-7';
import { group, plume } from './co_civspace.js?v=f5.9-7';
function dd(o) { const d = o.detail, blk = livery(0x1e1f22);
  const a = stage(d, 's1', { r: 1.0, h: 7.6, y0: 1.0, eng: [[8, 0.6, 0.14, 0.6, PI / 8]], key: blk, skirt: 1.04, bands: [[0, 0.4, 'silver'], [7.2, 0.4, 'silver']], decalY: 4 });
  const b = stage(d, 's2', { r: 0.685, h: 2.6, y0: a.userData.top, eng: [[2, 0.3, 0.14, 0.5]], drop: 0.4, key: blk, skirt: 1.0, bands: [[2.3, 0.3, 'silver']] });
  const f = fairing(d, 'payload', { r: 0.685, rb: 0.685, cyl: 0.6, nose: 1.4, y0: b.userData.top, key: blk });
  const g = group('dark-dart', [a, b, f], f.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 0.6, 12 * o.plume)); return g; }
export const CO_ALBION = { 'dark-dart': { height: 13.3, build: dd, src: 'rocketdb dark-dart (GCAT): 2 m s1 (8 engines), 1.37 m s2, solid 3rd under fairing, ~13 m', est: ['stage split'] } };
