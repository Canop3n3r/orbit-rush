// co-krasnaya-2: Krasnaya Orbita Bureau — Energika: 7.75 m hydrogen core with 4 engines, four 3.9 m kerosene strap-ons (one
// 4-chamber engine each, cone noses), side-mounted cargo pod (no orbiter; the 'Buranchik' orbiter option is planned).
// rocketdb energika (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, nose, kb, Kit, tube, lathe, PR, ring, PI, isHi, livery, xf } from './co_gen.js?v=art1';
import { group, plume } from './co_nosa.js?v=art1';
const R = 3.9, RS = 1.95, OFF = R + RS + 0.15, ANG = [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4], PX = R + 2.05 + 0.25;
function core(d) { const g = stage(d, 'core', { r: R, h: 50.5, y0: 2.6, eng: [[4, 1.6, 0.85, 2.4, PI / 4]], skirt: R * 1.02, key: livery(0xd8a259), bands: [[0, 1.2], [49.0, 1.5, 'paint:0,0']], decalY: 30,
  extra: k => lathe(k, PR.ogive(R, 5.6, 53.1, k.hi ? 16 : 6, 0.3), livery(0xd8a259)) }); g.userData.top = 58.7; return g; }
function strap(d, i) { const a = ANG[i], g = stage(d, 'side' + i, { r: RS, h: 33.5, y0: 2.2, eng: [[4, 0.6, 0.42, 1.9, PI / 4]], key: livery(0xc9ccc4), bands: [[0.0, 1.0], [16, 0.4]],
  extra: k => tube(k, RS, 0.35, 5.5, 35.7, livery(0xc9ccc4)) }); g.position.set(Math.cos(a) * OFF, 0.4, Math.sin(a) * OFF); g.rotation.y = -a; g.userData.top = 41.2; return g; }
function pod(d) { const k = new Kit(d); tube(k, 2.05, 2.05, 30, 14.0, 'paint:0,0'); lathe(k, PR.ogive(2.05, 7.5, 44.0, k.hi ? 14 : 6, 0.1), 'paint:0,0'); tube(k, 2.0, 2.05, 1.2, 12.8, 'dark');
  if (isHi(k)) ring(k, 2.05, 28, 0.02);
  const g = kb(k, 'payload', 51.5); g.position.set(PX, 0, 0); return g; }
function energika(o) { const d = o.detail, c = core(d), kids = [c, ...ANG.map((_, i) => strap(d, i)), pod(d)];
  const g = group('energika', kids, 58.7); if (o.plume) g.add(plume(0, ANG.map(a => [Math.cos(a) * OFF, Math.sin(a) * OFF]), 1.6, 80 * o.plume)); return g; }
export const CO_ENERGIKA = {
  'energika': { height: 58.7, build: energika, src: 'rocketdb energika (GCAT): 58.7 m, 7.75 m core (4 engines), 4 strap-ons 3.9 m, side cargo pod', est: ['pod size', 'strap-on length'] },
};
