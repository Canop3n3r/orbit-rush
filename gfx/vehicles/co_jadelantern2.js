// Jade Sky Academy — Jade Lantern 2F (crew: 3.35 m core with 4 engines, four 2.25 m liquid boosters with cone noses, 2nd stage,
// 3.8 m crew fairing + escape tower) and Jade Lantern 3B (same lower stack + hydrogen 3rd stage, 4 m fairing). White.
// rocketdb jade-lantern-2f / jade-lantern-3 (GCAT) + design.md; dims art-fitted. No logos/names.
import { stage, fairing, tower, PI, livery, Kit, tube, kb } from './co_gen.js?v=f5.9-3';
import { group, plume } from './co_civspace.js?v=f5.9-3';
const R = 1.675, RB = 1.125, OFF = R + RB + 0.1, ANG = [0, PI / 2, PI, 3 * PI / 2];
function side(d, i) { const a = ANG[i], g = stage(d, 'side' + i, { r: RB, h: 13.0, y0: 2.0, eng: [[1, 0, 0.55, 1.8]], bands: [[0, 0.6], [12.2, 0.4]], extra: k => tube(k, RB, 0.12, 2.8, 15.0, 'paint:0,0') });
  g.position.set(Math.cos(a) * OFF, 0.3, Math.sin(a) * OFF); g.rotation.y = -a; g.userData.top = 17.8; return g; }
function ls(o, crew) { const d = o.detail, a = stage(d, 's1', { r: R, h: 21.5, y0: 2.2, eng: [[4, 0.7, 0.45, 1.9, PI / 4]], skirt: R * 1.02, bands: [[20.7, 0.8], [8.0, 0.3]], decalY: 13 });
  const kids = [a, ...ANG.map((_, i) => side(d, i))];
  const b = stage(d, 's2', { r: R, h: crew ? 13.5 : 11.5, y0: a.userData.top, eng: [[1, 0, 0.55, 1.5], [4, 1.1, 0.15, 0.5, PI / 4]], drop: 1.2, bands: [[0, 0.8]] }); kids.push(b); let y = b.userData.top;
  if (!crew) { const c = stage(d, 's3', { r: 1.5, h: 11.4, y0: y, eng: [[2, 0.5, 0.3, 0.9]], drop: 0.8, ext: true, key: livery(0xe3ddd0), skirt: R, bands: [[10.8, 0.6]] }); kids.push(c); y = c.userData.top; }
  const f = fairing(d, 'payload', { r: crew ? 1.9 : 2.0, rb: crew ? R : 1.5, cyl: crew ? 7.5 : 4.4, nose: crew ? 4.2 : 4.6, y0: y }); kids.push(f);
  if (crew) kids.push(tower(d, 'les', { y0: f.userData.top - 0.3, w: 0.3, h: 2.2, rocket: 0.3 }));
  const g = group(crew ? 'jade-lantern-2f' : 'jade-lantern-3b', kids, kids.at(-1).userData.top); if (o.plume) g.add(plume(0, ANG.map(a => [Math.cos(a) * OFF, Math.sin(a) * OFF]), 0.9, 40 * o.plume)); return g; }
// display names: the only place they live (cheap to rename later)
export const NAMES = {'jade-lantern-2f': 'Jade Lantern 2F Crew', 'jade-lantern-3b': 'Jade Lantern 3B'};
export const CO_JADELANTERN2 = {
  'jade-lantern-2f': { name: NAMES['jade-lantern-2f'], height: 55.6, build: o => ls(o, true), src: 'rocketdb jade-lantern-2f (GCAT): 3.35 m core 4 engines, 4 x 2.25 m boosters, s2, 3.8 m crew fairing + tower', est: ['fairing/tower'] },
  'jade-lantern-3b': { name: NAMES['jade-lantern-3b'], height: 56.6, build: o => ls(o, false), src: 'rocketdb jade-lantern-3 (3B-type): + 3 m hydrogen 3rd stage, 4 m fairing', est: ['fairing'] },
};
