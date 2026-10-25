// co-gls-1 branch: Jade Sky Academy (parody state launch academy) — Jade Lantern 5 (5 m hydrogen core with 2 bells, four 3.35 m
// kerosene boosters with conical noses (2 bells each), 5 m hydrogen upper, 5.2 m ogive fairing) and Jade Lantern 5B (no upper stage,
// very long 20 m fairing for heavy LEO modules). Dimensions: rocketdb jade-lantern-5 (GCAT) + design.md; splits art-fitted. No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf, weakDisposeListeners } from './kit.js?v=f5.9-1';
import * as PR from './profiles.js?v=f5.9-1';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.9-1';
import { group, plume } from './co_civspace.js?v=f5.9-1';
const PI = Math.PI, R = 2.5, RB = 1.675, RF = 2.6, BOFF = R + RB + 0.15;
const LM = new Map(); // local livery materials (cached + weak dispose listeners: flat heap)
function lm(key) { if (LM.has(key)) return LM.get(key); const m = new THREE.MeshStandardMaterial(key === 'x-sky' ? { color: 0x8fb4d6, roughness: 0.5 } : { color: 0xe9e4d6, roughness: 0.7 });
  m.name = key; m.userData.cached = true; weakDisposeListeners(m); LM.set(key, m); return m; }
function kb(k, name) { const g = k.build(name); for (const m of g.children) { const key = m.name.split(':').slice(1).join(':'); if (key.startsWith('x-')) m.material = lm(key); } return g; }
const sky = (k, r, y, h, lv = 'mid') => (lv === 'mid' ? k.hi : k.detail === 'hi') && tube(k, r * 1.005, r * 1.005, h, y, 'x-sky', { open: true, seg: k.hi ? 40 : 14 });
// 5 m core stage: 2 hydrogen bells, white foam-look tank, pale-blue bands; y0 = tank bottom
function core(d, h, y0 = 2.4) { const k = new Kit(d); for (const [x, z] of ringPos(k.detail === 'hi' ? [[7, 2.0, 0], [1, 0]] : k.detail === 'mid' ? [[3, 2.0, 0], [1, 0]] : [[2, 1.05]])) bell(k, k.detail === 'hi' ? 0.62 : 0.75, 2.4, x, 0, z, { head: 0.5, rt: 0.25 }); // 8 engines (roster), fewer bells on the light LODs
  lathe(k, [[0, y0], [R * 0.8, y0], [R, y0 + 0.6]], 'dark'); tube(k, R, R, h - 0.6, y0 + 0.6, 'x-cream', { hs: 1 });
  sky(k, R, y0 + h * 0.3, 0.9); sky(k, R, y0 + h - 1.2, 0.9); ring(k, R, y0 + h * 0.55, 0.02);
  if (k.hi) { for (const a of [0, PI]) k.add(new THREE.BoxGeometry(0.35, h - 3, 0.3), 'grey', xf([Math.cos(a) * (R + 0.12), y0 + h / 2, Math.sin(a) * (R + 0.12)], [0, -a, 0])); }
  decal(k, 'booster.side', R, y0 + h * 0.62, 5, PI / 2, 0.6);
  const g = kb(k, 'core'); g.userData.top = y0 + h; return g; }
// 3.35 m booster: 2 bells, white tank, conical nose (straight cone, not ogive), pale-blue nose band
function booster(d, name, a) { const k = new Kit(d), L = 27.6, nL = 6.0, x = Math.cos(a) * BOFF, z = Math.sin(a) * BOFF;
  for (const [bx, bz] of ringPos([[2, 0.75, PI / 2]])) bell(k, 0.55, 1.8, bx, 0, bz, { head: 0.3, rt: 0.2 });
  tube(k, RB * 1.05, RB, 1.4, 1.6, k.detail === 'hi' ? 'dark' : 'x-cream'); tube(k, RB, RB, L - nL - 3.0, 3.0, 'x-cream'); sky(k, RB, L - nL - 1.6, 1.0, 'hi'); ring(k, RB, 3.0 + (L - nL) * 0.45, 0.02);
  tube(k, RB, 0.18, nL, L - nL, 'x-cream'); // conical nose
  if (k.hi) { for (const y of [5, L - nL - 2]) strut(k, [-RB * 0.95, y, 0], [-(BOFF - R) - RB + 0.1, y, 0], 0.12, 'dark');
  }
  const g = kb(k, name); g.position.set(x, 0.6, z); g.rotation.y = -a; return g; }
function upper(d, y0) { const k = new Kit(d), h = 10.6; tube(k, R, R, 1.8, y0, 'dark'); // interstage truss skirt
  for (const [x, z] of ringPos([[2, 0.7]])) bell(k, 0.45, 1.3, x, y0 + 0.2, z, { ext: true, head: 0.25, rt: 0.12 });
  tube(k, R, R, h - 1.8, y0 + 1.8, 'x-cream'); sky(k, R, y0 + h - 1.4, 0.8); tube(k, R, R, 0.8, y0 + h, 'dark');
  const g = kb(k, 'upper'); g.userData.top = y0 + h + 0.8; return g; }
function fairing(d, y0, cyl) { const k = new Kit(d), p = PR.fairing(RF, cyl, 6.6, y0, R * 0.999, k.hi ? 20 : 8, 0.05); lathe(k, p, 'x-cream');
  sky(k, RF, y0 + 0.6 + cyl * 0.85, 0.7); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 });
  decal(k, 'fairing.side', RF, y0 + cyl * 0.5, 3, PI / 2, 0.8); const g = kb(k, 'payload'); g.userData.top = p.at(-1)[1]; return g; }
const ANG = [PI / 4, 3 * PI / 4, 5 * PI / 4, 7 * PI / 4];
function ls5(o, b) { const d = o.detail, c = core(d, b ? 31.0 : 31.3), kids = [c, ...ANG.map((a, i) => booster(d, 'side' + i, a))];
  let top = c.userData.top; if (!b) { const u = upper(d, top); kids.push(u); top = u.userData.top; }
  const f = fairing(d, top, b ? 13.0 : 5.4); kids.push(f); const g = group(b ? 'jade-lantern-5b' : 'jade-lantern-5', kids, f.userData.top);
  if (o.plume) { g.add(plume(0, ANG.map(a => [Math.cos(a) * BOFF, Math.sin(a) * BOFF]), 1.5, 60 * o.plume)); g.add(plume(0, [[1.05, 0], [-1.05, 0]], 0.8, 30 * o.plume)); } return g; }
// display names: the only place they live (cheap to rename later)
export const NAMES = {'jade-lantern-5': 'Jade Lantern 5', 'jade-lantern-5b': 'Jade Lantern 5B'};
export const CO_JADELANTERN = {
  'jade-lantern-5': { name: NAMES['jade-lantern-5'], height: 57.2, build: o => ls5(o, false), src: 'rocketdb jade-lantern-5 (GCAT): core 31.7 x 5.0 m, 4 boosters 27.6 x 3.35 m, upper 10.6 m, 5.2 m fairing', est: ['fairing length', 'interstage split'] },
  'jade-lantern-5b': { name: NAMES['jade-lantern-5b'], height: 53.1, build: o => ls5(o, true), src: 'rocketdb jade-lantern-5 (5B config): no upper stage, ~20 m fairing', est: ['fairing length'] },
};
