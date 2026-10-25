// co-jaxo-1: JAXO — Tsurugi: 5.2 m core (2 or 3 expander engines), 5.2 m upper, 5.2 m fairing; '-30' no solids / 3 engines,
// '-22' two solids, '-24' four solids (long fairing). Cream with pale-blue bands. rocketdb tsurugi (GCAT) + design.md. No logos/names.
import { stage, fairing, srm, PI, livery } from './co_gen.js?v=f5.8x';
import { group, plume } from './co_civspace.js?v=f5.8x';
const R = 2.6;
function tsurugi(o, cfg) { const d = o.detail, sky = livery(0x7fa8cf), cream = livery(0xe8e2d2), ne = cfg === '30' ? 3 : 2, ns = cfg === '30' ? 0 : +cfg[1];
  const a = stage(d, 's1', { r: R, h: 34.5, y0: 2.8, eng: ne === 3 ? [[3, 1.0, 0.85, 2.6, PI / 2]] : [[2, 0.95, 0.85, 2.6, PI / 2]], key: cream, skirt: R * 1.02, bands: [[33.3, 1.2, sky], [5.5, 0.6, sky]], decalY: 20 });
  const b = stage(d, 's2', { r: R, h: 11.0, y0: a.userData.top, eng: [[1, 0, 0.7, 1.8]], drop: 1.5, ext: true, bands: [[0, 1.0]] });
  const f = fairing(d, 'payload', { r: R, rb: R, cyl: ns === 4 ? 6.5 : 4.0, nose: 6.4, y0: b.userData.top });
  const off = R + 1.25 + 0.1, ang = ns === 4 ? [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4] : ns === 2 ? [0, PI] : [];
  const s = ang.map((g, i) => srm(d, 'srb' + i, { r: 1.25, L: 14.6, nL: 2.8, x: Math.cos(g) * off, z: Math.sin(g) * off, coreR: R }));
  const g = group('tsurugi-' + cfg, [a, ...s, b, f], f.userData.top); if (o.plume) g.add(plume(0, ang.length ? ang.map(a => [Math.cos(a) * off, Math.sin(a) * off]) : [[0, 0]], 1.2, 50 * o.plume)); return g; }
// display names: the only place they live (cheap to rename later)
export const NAMES = {'tsurugi-22': 'Tsurugi 22', 'tsurugi-24': 'Tsurugi 24', 'tsurugi-30': 'Tsurugi 30'};
export const CO_TSURUGI = {
  'tsurugi-22': { name: NAMES['tsurugi-22'], height: 58.8, build: o => tsurugi(o, '22'), src: 'rocketdb tsurugi (GCAT 22-type): 5.2 m core 2 engines, 2 solids, short 5.2 m fairing', est: ['fairing length'] },
  'tsurugi-24': { name: NAMES['tsurugi-24'], height: 61.3, build: o => tsurugi(o, '24'), src: 'rocketdb tsurugi (24-type): 4 solids, long fairing (63 m class)', est: ['fairing length'] },
  'tsurugi-30': { name: NAMES['tsurugi-30'], height: 58.8, build: o => tsurugi(o, '30'), src: 'rocketdb tsurugi (30-type): 3 engines, no solids', est: ['fairing length'] },
};
