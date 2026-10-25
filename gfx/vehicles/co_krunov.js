// co-krunov-1: Krunov Machine Works (parody heavy-rocket plant) — Gorynych-M (7.4 m first stage: central 4.1 m oxidizer tank ringed by
// six 1.6 m fuel tanks, one engine under each; 4-engine second stage; third stage; doughnut-tank upper under a 4.35 m fairing) and
// Gorynych-K (third stage + spherical-tank kick stage in a long fairing). Dimensions: rocketdb gorynych (GCAT) + design.md. No logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.9-1';
import * as PR from './profiles.js?v=f5.9-1';
import { lathe, tube, bell, ringPos, ring, decal } from './parts.js?v=f5.9-1';
import { group, plume } from './co_civspace.js?v=f5.9-1';
const PI = Math.PI, RC = 2.05, RO = 0.8, OFF = RC + RO - 0.05, RF = 2.18;
const hiOnly = k => k.detail === 'hi';
function s1(d) { const k = new Kit(d), y0 = 2.2, h = 21.2; // central oxidizer tank + 6 outboard fuel tanks, engine under each outboard
  for (const [x, z] of ringPos([[6, OFF, 0]])) { bell(k, 0.62, 2.0, x, 0.1, z, { head: 0.4, rt: 0.22 }); tube(k, RO, RO, h - 1.5, y0, 'paint:0,0', { x, z, seg: k.hi ? 18 : 8 });
    lathe(k, PR.ogive(RO, 1.5, y0 + h - 1.5, k.hi ? 8 : 4, 0.3), 'paint:0,0', { x, z, seg: k.hi ? 18 : 8 }); ring(k, RO, y0 + 0.6, 0.02) }
  tube(k, RC * 1.1, RC, 1.4, y0 - 0.4, 'dark'); tube(k, RC, RC, h, y0, 'paint:0,0'); if (hiOnly(k)) { ring(k, RC, y0 + h * 0.5, 0.02); for (const [x, z] of ringPos([[6, OFF + RO * 0.98, 0]])) k.add(new THREE.BoxGeometry(0.15, h - 3, 0.15), 'grey', xf([x, y0 + h / 2, z])); }
  decal(k, 'booster.side', RC, y0 + h * 0.6, 4, PI / 6, 0.5); const g = k.build('s1'); g.userData.top = y0 + h; return g; }
function s2(d, y0) { const k = new Kit(d), h = 14.6; tube(k, RC, RC, 2.0, y0, 'dark', { open: hiOnly(k) }); // lattice interstage look
  if (hiOnly(k)) for (const [x, z] of ringPos([[12, RC * 0.98, 0]])) tube(k, 0.06, 0.06, 2.0, y0, 'grey', { x, z, seg: 4 });
  for (const [x, z] of ringPos([[4, 1.1, PI / 4]])) bell(k, 0.42, 1.3, x, y0 + 0.4, z, { head: 0.2, rt: 0.15 });
  tube(k, RC, RC, h - 2.0, y0 + 2.0, 'paint:0,0'); ring(k, RC, y0 + h * 0.55, 0.02); const g = k.build('s2'); g.userData.top = y0 + h; return g; }
function s3(d, y0) { const k = new Kit(d), h = 6.5; bell(k, 0.5, 1.4, 0, y0 - 1.0, 0, { head: 0.2, rt: 0.16 }); if (hiOnly(k)) for (const [x, z] of ringPos([[4, 1.6, 0]])) bell(k, 0.18, 0.6, x, y0 - 0.4, z, { head: 0.1 });
  tube(k, RC, RC, h, y0, 'paint:0,0'); tube(k, RC * 1.004, RC * 1.004, 0.5, y0 + h - 0.5, 'dark', { open: true }); const g = k.build('s3'); g.userData.top = y0 + h; return g; }
// fairing; upper stage inside (hidden by the shroud, but a separable stage): 'm' doughnut tank, 'k' sphere + toroid kick stage
function upper(d, y0, kind) { const k = new Kit(d); if (!hiOnly(k)) tube(k, 1.6, 1.6, kind === 'm' ? 2.0 : 3.6, y0, 'grey', { seg: 8 }); else if (kind === 'm') { k.add(new THREE.TorusGeometry(1.45, 0.55, k.hi ? 10 : 6, k.hi ? 28 : 12), 'grey', xf([0, y0 + 0.9, 0], [PI / 2, 0, 0])); tube(k, 1.0, 1.0, 2.0, y0, 'grey'); }
  else { k.add(new THREE.SphereGeometry(1.5, k.hi ? 18 : 8, k.hi ? 12 : 6), 'grey', xf([0, y0 + 2.6, 0])); k.add(new THREE.TorusGeometry(1.2, 0.4, 6, k.hi ? 24 : 10), 'grey', xf([0, y0 + 0.8, 0], [PI / 2, 0, 0])); }
  if (hiOnly(k)) bell(k, 0.35, 0.9, 0, y0 - 0.6, 0, { ext: true, head: 0.1 }); const g = k.build('upper'); g.userData.top = y0 + (kind === 'm' ? 2.6 : 4.2); return g; }
function fairing(d, y0, cyl) { const k = new Kit(d), p = PR.fairing(RF, cyl, 5.0, y0, RC * 0.999, k.hi ? 18 : 8, 0.6); lathe(k, p, 'paint:0,0');
  if (hiOnly(k)) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', RF, y0 + cyl * 0.5, 3, PI / 2, 0.8);
  const g = k.build('payload'); g.userData.top = p.at(-1)[1]; return g; }
function prot(o, kind) { const d = o.detail, a = s1(d), b = s2(d, a.userData.top), c = s3(d, b.userData.top), u = upper(d, c.userData.top + 0.6, kind), f = fairing(d, c.userData.top, kind === 'm' ? 8.6 : 9.6);
  const g = group('gorynych-' + kind, [a, b, c, u, f], f.userData.top); if (o.plume) g.add(plume(0, ringPos([[6, OFF, 0]]), 0.9, 45 * o.plume)); return g; }
export const CO_KRUNOV = {
  'gorynych-m': { height: 58.2, build: o => prot(o, 'm'), src: 'rocketdb gorynych (GCAT): 7.4 m first stage 21.2 m (4.1 m core + 6 x 1.6 m tanks), 2nd 14.6 m, 3rd 6.5 m, 4.35 m fairing', est: ['fairing length', 'upper inside shroud'] },
  'gorynych-k': { height: 59.2, build: o => prot(o, 'k'), src: 'rocketdb gorynych (K + sphere kick stage config), longer fairing', est: ['fairing length'] },
};
