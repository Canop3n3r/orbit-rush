// co-arion-1: Arion Space (parody European consortium) — Arion 5 (cryogenic 5.4 m core, single big hydrogen bell, two tall
// grey solid boosters, cryo upper inside a long ogive fairing) and Arion 6 (62: 2 / 64: 4 solid boosters, re-ignitable upper,
// short or long fairing). Dimensions: rocketdb arion-5 / arion-6 (GCAT) + design.md; fairing/stage splits art-fitted. No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.8r';
import * as PR from './profiles.js?v=f5.8r';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.8r';
import { group, plume } from './co_civspace.js?v=f5.8r';
const PI = Math.PI, R = PR.ARION.r;
function core(d, h, y0 = 2.6) { const k = new Kit(d); bell(k, 1.05, 3.0, 0, 0, 0, { head: 0.7, rt: 0.33 });
  lathe(k, [[0, y0], [R * 0.85, y0], [R, y0 + 0.5]], 'dark'); tube(k, R, R, h - 0.5, y0 + 0.5, 'paint:0,0', { hs: 1 }); ring(k, R, y0 + h * 0.62, 0.02); ring(k, R, y0 + h - 0.3, 0.02);
  k.add(new THREE.BoxGeometry(0.4, h - 2, 0.4), 'paint:0,0', xf([0, y0 + h / 2, R + 0.15]));
  decal(k, 'booster.side', R, y0 + h * 0.4, 4, PI, 0.6);
  const g = k.build('core'); g.userData.top = y0 + h; return g; }
// solid booster (grey), radius r, length L, nose length nL; group origin at its own axis
function solid(d, name, r, L, nL, x, z) { const k = new Kit(d), a = Math.atan2(z, x);
  bell(k, r * 0.62, 2.0, 0, 0, 0, { head: 0, rt: r * 0.3 }); tube(k, r * 1.08, r, 1.6, 1.6, 'dark');
  tube(k, r, r, L - nL - 3.2, 3.2, 'grey'); for (const f of [0.35, 0.6]) ring(k, r, 3.2 + (L - nL - 3.2) * f, 0.025);
  lathe(k, PR.ogive(r, nL, L - nL, k.hi ? 14 : 6, 0.12), 'grey');
  if (k.hi) for (const y of [4, L - nL - 1]) strut(k, [-r * 0.9, y, 0], [-(Math.hypot(x, z) - R) - r + 0.1, y, 0], 0.12, 'dark'); // attach struts toward the core
  const g = k.build(name); g.position.set(x, 0.4, z); g.rotation.y = -a; return g; }
function upper(d, y0, h, five) { const k = new Kit(d); bell(k, five ? 0.5 : 1.05, five ? 1.4 : 2.4, 0, y0 + 0.1, 0, { ext: true, head: 0.3, rt: 0.12 });
  tube(k, R, R, h, y0, five ? 'paint:0,0' : 'grey'); ring(k, R, y0 + h - 0.6, 0.02); tube(k, R, R, 1.1, y0 + h, 'dark'); // equipment bay band
  const g = k.build('upper'); g.userData.top = y0 + h + 1.1; return g; }
function fairing(d, y0, cyl) { const k = new Kit(d), p = PR.fairing(R, cyl, 7.0, y0, R * 0.999, k.hi ? 20 : 8, 0.05); lathe(k, p, 'paint:0,0');
  if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', R, y0 + 3, 3, PI / 2, 0.8);
  const g = k.build('payload'); g.userData.top = p.at(-1)[1]; return g; }
function arion5(o) { const d = o.detail, c = core(d, 30.5), off = R + PR.ARION.srb5 + 0.35, kids = [c, solid(d, 'srb0', PR.ARION.srb5, 31.6, 4.2, off, 0), solid(d, 'srb1', PR.ARION.srb5, 31.6, 4.2, -off, 0)];
  const u = upper(d, c.userData.top, 4.7, true); kids.push(u); const f = fairing(d, u.userData.top, 9.5); kids.push(f); const g = group('arion-5', kids, f.userData.top);
  if (o.plume) { g.add(plume(0, [[off, 0], [-off, 0]], 1.6, 70 * o.plume)); g.add(plume(0, [[0, 0]], 1.0, 30 * o.plume)); } return g; }
function arion6(o, n, long) { const d = o.detail, c = core(d, 28.0), off = R + PR.ARION.srb6 + 0.3, ang = n === 2 ? [0, PI] : [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4];
  const kids = [c, ...ang.map((a, i) => solid(d, 'srb' + i, PR.ARION.srb6, 13.5, 3.2, Math.cos(a) * off, Math.sin(a) * off))];
  const u = upper(d, c.userData.top, 10.5, false); kids.push(u); const f = fairing(d, u.userData.top, long ? 12.5 : 6.5); kids.push(f); const g = group('arion-6' + n, kids, f.userData.top);
  if (o.plume) g.add(plume(0, ang.map(a => [Math.cos(a) * off, Math.sin(a) * off]), 1.4, 50 * o.plume)); return g; }
export const CO_ARION = {
  'arion-5': { height: 52.7, build: arion5, src: 'rocketdb arion-5 (GCAT, ECA-type): core 30.5 x 5.4 m, solids 31.6 x 3.06 m, fairing 17 m', est: ['upper/bay split'] },
  'arion-62': { height: 56.2, build: o => arion6(o, 2, false), src: 'rocketdb arion-6 two-solid config: ~56 m, solids 13.5 x 3.4 m, short fairing', est: ['stage split'] },
  'arion-64': { height: 62.2, build: o => arion6(o, 4, true), src: 'rocketdb arion-6 four-solid config: ~62 m, long fairing', est: ['stage split'] },
};
