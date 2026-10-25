// co-bolt-1: Bolt Labyrinth (parody) — Electrino small launcher: all-black composite, 9 small pump-fed engines (8 + 1),
// single vacuum engine upper stage, kick stage inside a short clamshell. Dimensions: rocketdb electrino (GCAT): 18 m, 1.2 m.
// Variant electrino-recovery: booster with a heat-shield base + parachute bay band (recovery attempts). No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.8z';
import * as PR from './profiles.js?v=f5.8z';
import { lathe, tube, bell, ringPos, ring, decal } from './parts.js?v=f5.8z';
import { group, plume } from './co_civspace.js?v=f5.8z';
const PI = Math.PI, B = PR.BOLT, H1 = 12.1;
function booster(d, rec) { const k = new Kit(d), r = B.r;
  for (const [x, z] of ringPos([[8, 0.4, PI / 8], [1, 0]])) bell(k, 0.13, 0.42, x, 0, z, { head: k.hi && !k.mid ? 0.12 : 0, rt: 0.05 });
  k.add(new THREE.CircleGeometry(r * 0.98, k.hi ? 24 : 8), rec ? 'shield' : 'dark', xf([0, 0.45, 0], [-PI / 2, 0, 0]));
  tube(k, r, r, 0.5, 0.42, 'dark'); tube(k, r, r, H1 - 0.92, 0.92, 'carbon', { hs: 1 }); for (const y of [4.5, 8.8]) ring(k, r, y, 0.006, 'grey');
  if (rec) tube(k, r * 1.01, r * 1.01, 0.6, H1 - 1.2, 'paint:0,0', { open: true }); // parachute bay band
  decal(k, 'booster.side', r, 6, 2.0, 0, 1.2);
  const g = k.build('booster'); g.userData.top = H1; return g; }
function upper(d) { const k = new Kit(d), r = B.r, y = H1; tube(k, r, r, 1.0, y, 'carbon'); // interstage (vacuum bell inside)
  bell(k, 0.3, 0.85, 0, y + 0.1, 0, { ext: true, head: 0.1, rt: 0.06 }); tube(k, r, r, 2.4, y + 1.0, 'carbon'); ring(k, r, y + 1.05, 0.006, 'grey');
  const g = k.build('upper'); g.userData.top = y + 3.4; return g; }
function payload(d, y0) { const k = new Kit(d); tube(k, B.r * 0.9, B.r * 0.9, 0.3, y0, 'silver'); // kick stage ring (visible at separation)
  const p = PR.fairing(B.fr, B.cyl, B.nose, y0 + 0.3, B.r * 0.999, k.hi ? 18 : 8, 0.05); lathe(k, p, 'carbon');
  if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'grey', { s: 1.004, seg: 1, p0: ph - 0.006, pl: 0.012 });
  const g = k.build('payload'); g.userData.top = p.at(-1)[1]; return g; }
function electrino(o, rec) { const d = o.detail, b = booster(d, rec), u = upper(d), p = payload(d, u.userData.top); const g = group(rec ? 'electrino-recovery' : 'electrino', [b, u, p], p.userData.top);
  if (o.plume) g.add(plume(0, ringPos([[8, 0.4, PI / 8], [1, 0]]), 0.2, 14 * o.plume)); return g; }
export const CO_BOLT = {
  'electrino': { height: 18.0, build: o => electrino(o, false), src: 'rocketdb electrino (GCAT): 18 m, 1.2 m dia', est: ['fairing split'] },
  'electrino-recovery': { height: 18.0, build: o => electrino(o, true), src: 'rocketdb electrino recovery configuration', est: ['shield/band look'] },
};
