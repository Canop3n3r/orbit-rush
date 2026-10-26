// co-southstar-1: Southstar Design Bureau (parody) — Steppe Arrow: 3.9 m kerosene two-stager (one 4-chamber first-stage engine,
// single-engine second stage with vernier), 3.9 m fairing; '-3' adds a kick stage inside a longer fairing. Olive-grey finish.
// rocketdb steppe-arrow (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, fairing, PI, livery, Kit, tube, bell, kb, isHi } from './co_gen.js?v=f5.9-5';
import { group, plume } from './co_civspace.js?v=f5.9-5';
const R = 1.95;
function sp(o, three) { const d = o.detail, ol = livery(0x8c8f7a);
  const a = stage(d, 's1', { r: R, h: 30.8, y0: 2.4, eng: [[4, 0.75, 0.5, 2.2, PI / 4]], key: ol, skirt: R * 1.02, bands: [[30.0, 0.8, 'paint:0,0'], [14.5, 0.3]], decalY: 18 });
  const b = stage(d, 's2', { r: R, h: 10.4, y0: a.userData.top, eng: [[1, 0, 0.75, 1.9], [1, 0, 0.3, 0.8]], drop: 1.6, ext: true, key: ol, bands: [[0, 1.2, 'paint:0,0']] });
  const kids = [a, b]; let y = b.userData.top;
  if (three) { const k = new Kit(d); tube(k, 1.5, 1.5, 3.0, y + 0.3, 'grey'); if (isHi(k)) bell(k, 0.4, 0.9, 0, y - 0.4, 0, { ext: true, head: 0.1 }); const u = kb(k, 'upper', y + 3.3); kids.push(u); }
  const f = fairing(d, 'payload', { r: R, rb: R, cyl: three ? 6.5 : 4.6, nose: 6.5, y0: y, key: 'paint:0,0' }); kids.push(f);
  const g = group(three ? 'steppe-arrow-3' : 'steppe-arrow-2', kids, f.userData.top); if (o.plume) g.add(plume(0, [[0, 0]], 1.4, 50 * o.plume)); return g; }
export const CO_SOUTHSTAR = {
  'steppe-arrow-2': { height: 54.8, build: o => sp(o, false), src: 'rocketdb steppe-arrow (GCAT 2-stage): s1 3.9 m 32.9 m, s2 10.4 m, 3.9 m fairing', est: ['fairing length'] },
  'steppe-arrow-3': { height: 56.7, build: o => sp(o, true), src: 'rocketdb steppe-arrow (3-stage sea/land config): kick stage inside a longer fairing', est: ['fairing length'] },
};
