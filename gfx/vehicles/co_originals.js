// co-originals-1: Orbit Rush Originals (house brand, fully fictional) — showroom ids 'selene' and 'ares' (Red Arrow).
// Built to read like their part stacks in fun/showroom.js + parts.js templates (chunky, toy-like proportions):
//   selene: 5-engine kerosene booster -> 4-engine hydrogen transfer stage (3 tanks) -> single-engine lander w/ legs + RCS, under a fairing
//   ares:   5-engine booster -> 4-engine hydrogen transfer stage -> kick stage -> entry capsule (ablative shield, chute) under a fairing
// Stages detach on every LOD; lander legs take setLegs(). Original designs: no real names/logos.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.9-0';
import * as PR from './profiles.js?v=f5.9-0';
import { lathe, tube, bell, ringPos, ring, decal, legs, setLegs } from './parts.js?v=f5.9-0';
import { group, plume } from './co_civspace.js?v=f5.9-0';
const PI = Math.PI, R = PR.ORIG.r;
function stripes(k, r, ys, key) { for (const y of ys) tube(k, r * 1.006, r * 1.006, 0.5, y, key, { open: true }); }
function booster(d, H, accent) { const k = new Kit(d);
  for (const [x, z] of ringPos([[4, 0.85, PI / 4], [1, 0]])) bell(k, 0.42, 1.2, x, 0, z, { head: 0.4, rt: 0.18 });
  k.add(new THREE.CircleGeometry(R * 0.99, k.hi ? 28 : 8), 'shield', xf([0, 1.25, 0], [-PI / 2, 0, 0])); tube(k, R, R, 0.9, 1.25, 'dark');
  tube(k, R, R, H - 2.15, 2.15, 'paint:0.2,0', { hs: 1 }); stripes(k, R, [H * 0.3, H * 0.62], accent); quadsCheck(k, R, H - 2.4, 2.0);
  for (let i = 0; i < 4; i++) { const a = i * PI / 2; k.add(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.5, -0.4), new THREE.Vector2(1.5, 1.2), new THREE.Vector2(0, 3.6)]), { depth: 0.14, bevelEnabled: false }), accent, xf([Math.cos(a) * R, 1.2, Math.sin(a) * R], [0, -a, 0]).multiply(xf([0, 0, -0.07]))); } // tail fins
  decal(k, 'booster.side', R, H * 0.4, 3, PI / 4, 0.9);
  const g = k.build('booster'); g.userData.top = H; return g; }
function quadsCheck(k, r, y, h) { for (let i = 0; i < 4; i++) tube(k, r * 1.006, r * 1.006, h / 2, y + (i % 2) * h / 2, 'dark', { open: true, t0: i * PI / 2, tl: PI / 2, seg: k.hi ? 8 : 3 }); } // checker band (original roll marker)
function transfer(d, y0, h, accent) { const k = new Kit(d); tube(k, R, R, 1.6, y0, 'dark'); // interstage (engines inside)
  for (const [x, z] of ringPos([[4, 0.7, PI / 4]])) bell(k, 0.36, 1.2, x, y0 + 0.2, z, { ext: true, head: 0.25, rt: 0.12 });
  tube(k, R, R, h, y0 + 1.6, 'silver'); stripes(k, R, [y0 + 1.6 + h / 3, y0 + 1.6 + 2 * h / 3], accent); // three hydrogen tanks (seams)
  const g = k.build('transfer'); g.userData.top = y0 + 1.6 + h; return g; }
function fairing(d, y0, cyl, nose, accent) { const k = new Kit(d), p = PR.fairing(PR.ORIG.fr, cyl, nose, y0, R, k.hi ? 20 : 8, 0.8); lathe(k, p, 'paint:0,0');
  lathe(k, p.slice(-6), accent); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 });
  const g = k.build('fairing'); g.userData.top = p.at(-1)[1]; return g; }
// Selene lander: gold-foil descent tank, ascent cabin, 4 legs, RCS quads, single engine
function lander(d, y0) { const k = new Kit(d);
  bell(k, 0.4, 1.0, 0, y0, 0, { ext: true, head: 0.2, rt: 0.12 }); tube(k, 1.2, 1.2, 1.4, y0 + 1.0, 'gold'); // descent stage (foil)
  k.add(new THREE.CylinderGeometry(1.25, 1.25, 1.5, k.hi ? 8 : 6), 'gold', xf([0, y0 + 1.75, 0], [0, PI / 8, 0])); // octagonal body
  tube(k, 0.9, 0.7, 1.4, y0 + 2.5, 'silver'); lathe(k, PR.ogive(0.7, 0.8, y0 + 3.9, k.hi ? 12 : 6, 0.3), 'silver'); // ascent cabin
  if (k.hi) { for (const a of [0, 0.5]) k.add(new THREE.BoxGeometry(0.3, 0.3, 0.06), 'glass', xf([Math.sin(a) * 0.8, y0 + 3.3, Math.cos(a) * 0.8], [0, a, 0]));
    for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; k.add(new THREE.BoxGeometry(0.3, 0.3, 0.3), 'grey', xf([Math.cos(a) * 0.95, y0 + 3.4, Math.sin(a) * 0.95])); } }
  const g = k.build('lander'); const L = legs(Kit, d, 1.2, 2.6, y0 + 1.0); setLegs(L, 0); g.add(L); g.userData.legs = L; g.userData.top = y0 + 4.7; return g; }
function kick(d, y0) { const k = new Kit(d); tube(k, R, 1.1, 0.8, y0, 'dark'); bell(k, 0.3, 0.7, 0, y0 + 0.1, 0, { ext: true, head: 0.15, rt: 0.08 }); tube(k, 1.1, 1.1, 1.2, y0 + 0.8, 'silver');
  const g = k.build('kick'); g.userData.top = y0 + 2.0; return g; }
function capsule(d, y0) { const k = new Kit(d), r = 1.25; tube(k, r, r, 0.35, y0, 'dark'); // ablative shield
  const cp = PR.capsule(r, y0 + 0.35); lathe(k, cp.slice(0, 2), 'dark'); lathe(k, cp.slice(1), 'paint:0,0'); tube(k, r * 0.5, r * 0.5, 0.3, y0 + 0.35 + 3.4, 'red'); // chute can
  if (k.hi) for (const a of [0.3, -0.3]) k.add(new THREE.BoxGeometry(0.28, 0.22, 0.05), 'glass', xf([Math.sin(a) * 0.95, y0 + 1.8, Math.cos(a) * 0.95], [-0.45, a, 0]));
  const g = k.build('capsule'); g.userData.top = y0 + 4.4; return g; }
function selene(o) { const d = o.detail, b = booster(d, 22, 'grey'), t = transfer(d, b.userData.top, 8.5, 'gold'), l = lander(d, t.userData.top + 0.3), f = fairing(d, t.userData.top, 4.6, 4.2, 'gold');
  const g = group('selene', [b, t, l, f], f.userData.top); g.userData.legs = [l.userData.legs]; if (o.legs !== undefined) setLegs(l.userData.legs, o.legs);
  if (o.plume) g.add(plume(0, ringPos([[4, 0.85, PI / 4], [1, 0]]), 0.6, 28 * o.plume)); return g; }
function ares(o) { const d = o.detail, b = booster(d, 22, 'red'), t = transfer(d, b.userData.top, 8.5, 'red'), kk = kick(d, t.userData.top), c = capsule(d, kk.userData.top), f = fairing(d, t.userData.top, 3.4, 4.0, 'red');
  const g = group('ares', [b, t, kk, c, f], f.userData.top); if (o.plume) g.add(plume(0, ringPos([[4, 0.85, PI / 4], [1, 0]]), 0.6, 28 * o.plume)); return g; }
export const CO_ORIGINALS = {
  'selene': { height: 43.5, build: selene, src: 'Orbit Rush Originals: showroom "Selene" (Moon lander template), fictional; art proportions', est: ['all (original design)'] },
  'ares': { height: 42.3, build: ares, src: 'Orbit Rush Originals: showroom "Red Arrow" (Mars explorer template), fictional', est: ['all (original design)'] },
};
