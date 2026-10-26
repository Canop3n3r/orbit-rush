// Independent Rocketeers Guild — plain white. 'flock-hopper': stubby 3.0 m suborbital booster (4 engines), ring fin near the top,
// four wedge base fins, capsule on top. 'featherwing-1': small air-launched spaceplane (round fuselage, stub wings, twin feathering
// tail booms) slung under a twin-boom carrier plane; built lying flat. rocketdb flock-hopper / featherwing-1 + design.md.
import { stage, capsule, fin, Kit, kb, tube, lathe, bell, PR, PI, isHi, xf } from './co_gen.js?v=f5.9-9';
import { group, plume } from './co_civspace.js?v=f5.9-9';
// display names: the only place they live (cheap to rename later)
export const NAMES = { 'flock-hopper': 'Flock Hopper', 'featherwing-1': 'Featherwing I' };
function ns(o) { const d = o.detail, R = 1.5;
  const a = stage(d, 'booster', { r: R, h: 12.0, y0: 1.6, eng: [[4, 0.6, 0.38, 1.0, PI / 4]], skirt: R * 1.04, bands: [[11.2, 0.4]], decalY: 6,
    extra: k => { tube(k, R * 1.35, R * 1.35, 0.9, 12.0, 'dark', { open: true, seg: isHi(k) ? 40 : 14 }); for (let i = 0; i < 4; i++) fin(k, PI / 4 + i * PI / 2, R, 0.9, 2.6, 0.0, 0.12); } });
  const c = capsule(d, 'capsule', { r: 1.8, h: 2.4, y0: a.userData.top + 0.1, key: 'paint:0,0', can: 0.5 });
  const g = group('flock-hopper', [a, c], c.userData.top); g.userData.displayName = NAMES['flock-hopper'];
  if (o.plume) g.add(plume(0, [[0, 0]], 1.0, 25 * o.plume)); return g; }
// flat builders: local y = nose direction, local z = up; group rotated so y -> -z(world) and z -> y(world)
function flat(g, h) { g.rotation.x = -PI / 2; g.position.y = h; return g; }
function plane(d) { const k = new Kit(d), r = 0.75, s = isHi(k) ? 18 : 8; tube(k, r, r, 2.6, -1.4, 'paint:0,0', { seg: s }); lathe(k, PR.ogive(r, 2.0, 1.2, isHi(k) ? 10 : 5, 0.05), 'paint:0,0', { seg: s });
  tube(k, r * 0.8, r, 0.6, -2.0, 'dark', { seg: s });
  tube(k, r * 0.3, r * 0.8, 0.5, -2.5, 'dark', { seg: s }); // plan #8: closed aft end (nozzle fairing)
  bell(k, 0.26, 0.55, 0, -3.05, 0, { head: 0.1, rt: 0.09 }); // unit 4b: the rocket motor bell sits in the tail cone (exit 0.55 m behind the fairing)
  if (isHi(k)) tube(k, r * 1.01, r * 1.01, 0.35, 0.6, 'dark', { open: true, seg: s }); // window band
  for (const a of [0, PI]) { fin(k, a, r * 0.7, 2.0, 1.8, -1.6, 0.08, 'paint:0,0'); fin(k, a, r + 1.9, 0.08, 1.4, -2.6, 0.06, 'paint:0,0'); }
  for (const a of [PI / 2 - 0.25, PI / 2 + 0.25]) fin(k, a, r * 0.6, 1.1, 1.2, -2.4, 0.05, 'paint:0,0');
  const g = flat(kb(k, 'spaceplane', 2.6), 1.9); g.userData.nozzles = (g.userData.nozzles || []).map(([x, y, z, re]) => [x, Math.round((z + 1.9) * 100) / 100, -y, re]); return g; } // nozzles into the rotated group's frame (flat(): local y -> -z, z -> y + h)
function carrier(d) { const k = new Kit(d), s = isHi(k) ? 16 : 6;
  tube(k, 0.6, 0.6, 5.5, -2.5, 'paint:0,0', { seg: s }); lathe(k, PR.ogive(0.6, 1.5, 3.0, isHi(k) ? 8 : 4, 0.05), 'dark', { seg: s });
  for (const a of [0, PI]) fin(k, a, 0.55, 12.0, 2.0, 0.0, 0.14, 'paint:0,0');
  for (const x of [-3.0, 3.0]) { tube(k, 0.32, 0.32, 9.0, -6.0, 'paint:0,0', { x, seg: s }); lathe(k, PR.ogive(0.32, 0.9, 3.0, 4, 0.05), 'paint:0,0', { x, seg: s }); }
  fin(k, 0, -3.0, 6.0, 1.2, -6.0, 0.1, 'paint:0,0');
  // plan #8: closed tails, canopy, two jet pods under the wing roots, vertical tails on the booms
  tube(k, 0.08, 0.6, 1.4, -3.9, 'paint:0,0', { seg: s });
  for (const x of [-3.0, 3.0]) { tube(k, 0.05, 0.32, 0.8, -6.8, 'paint:0,0', { x, seg: s }); k.push(xf([x, 0, 0])); fin(k, PI / 2, 0.3, 1.6, 1.4, -6.4, 0.08, 'paint:0,0'); k.pop(); }
  tube(k, 0.42, 0.42, 1.2, 1.6, 'dark', { seg: s }); // canopy glazing band
  for (const x of [-1.6, 1.6]) { tube(k, 0.3, 0.26, 2.4, -0.6, 'grey', { x, seg: s }); tube(k, 0.22, 0.22, 0.1, -0.65, 'dark', { x, seg: s }); }
  for (let i = 0; i < 4; i++) tube(k, 0.06, 0.06, 0.12, -1.8 + (i % 2) * 2.4, 'dark', { x: i < 2 ? -0.5 : 0.5, seg: 4 });
  return flat(kb(k, 'carrier', 4.4), 3.4); }
function fw(o) { const d = o.detail, c = carrier(d), p = plane(d); const g = group('featherwing-1', [c, p], 4.4); g.userData.displayName = NAMES['featherwing-1'];
  if (o.plume) { const pl = plume(0, [[0, 0]], 0.4, 10 * o.plume); pl.rotation.x = PI / 2; pl.position.set(0, 1.9, 2.0); g.add(pl); } return g; }
export const CO_IRG = {
  'flock-hopper': { name: NAMES['flock-hopper'], height: 18.0, build: ns, src: 'rocketdb flock-hopper (GCAT): 3.0 m booster 12 m (4 engines), ring fin, wedge fins, capsule; ~18 m with capsule', est: ['capsule', 'ring fin'] },
  'featherwing-1': { name: NAMES['featherwing-1'], height: 4.4, build: fw, src: 'rocketdb featherwing-1: 5 m x 1.5 m spaceplane under a twin-boom carrier (carrier dims art-fitted)', est: ['carrier', 'wing planform'] },
};
