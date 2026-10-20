// co-nosa-1: NOSA (parody national agency) heritage vehicles, rocketdb tier S. Original geometry, no logos/names.
// Dimensions: game-studio rocketdb (GCAT stage table) + design.md; the stack breakdown is art-fitted to the 110.6 m total.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=art1';
import * as PR from './profiles.js?v=art1';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=art1';
const PI = Math.PI;
function group(name, kids, h) { const g = new THREE.Group(); g.name = name; for (const c of kids) g.add(c); g.userData.height = h; g.userData.stages = Object.fromEntries(kids.map(c => [c.name, c])); g.userData.legs = []; return g; }
// roll pattern: black quadrant panels over white paint (the classic test-range pattern; generic, no insignia)
function quads(k, r, y, h, a0 = 0, n = 2) { for (let i = 0; i < n; i++) tube(k, r * 1.003, r * 1.003, h, y, 'dark', { open: true, t0: a0 + i * PI, tl: PI / 2, seg: k.hi ? 10 : 4 }); }
function band(k, r, y, h) { tube(k, r * 1.003, r * 1.003, h, y, 'dark', { open: true, seg: k.hi ? 40 : 14 }); }
function stringers(k, r, y, h, n) { if (!k.hi || k.mid) return; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * PI; k.add(new THREE.BoxGeometry(0.09, h, 0.06), 'paint:0,0', xf([Math.cos(a) * (r + 0.03), y + h / 2, Math.sin(a) * (r + 0.03)], [0, -a, 0])); } }
// Saturnine V stack heights (m, from the F-1 exits): S-IC 0-42.1, interstage 42.1-47.6, S-II -72.4, S-IVB taper -77.4 + cyl -90.1,
// IU -91.0, SLA -99.5 (6.6 -> 3.9 m), SM -102.2, CM -105.4, LES tower+motor -110.6
const R1 = 5.03, R3 = 3.3, Y = { ic: 42.1, is: 47.6, ii: 72.4, tp: 77.4, ivb: 90.1, iu: 91.0, sla: 99.5, sm: 102.2, cm: 105.4, top: 110.6 };
function sic(d, o) { const k = new Kit(d), b0 = 5.2; // body starts above the hanging bells
  // 5 F-1: centre + 4 at 45° under the fins; bells 3.76 m exit, ~5.8 m long incl. nozzle extension
  for (const [x, z] of ringPos([[4, 3.2, PI / 4], [1, 0]])) bell(k, 1.88, 5.6, x, 0, z, { head: 1.4, rt: 0.55 });
  k.add(new THREE.CircleGeometry(R1 * 0.99, k.hi ? 40 : 12), 'shield', xf([0, b0, 0], [-PI / 2, 0, 0])); // heat shield
  tube(k, R1, R1, 7.0, b0, 'paint:0.25,0', { hs: 1 }); // thrust structure
  for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2, cx = Math.cos(a) * 3.9, cz = Math.sin(a) * 3.9; // engine fairings: cones over the outer engines
    k.add(new THREE.CylinderGeometry(1.25, 2.1, 6.2, k.hi ? 18 : 6, 1, false, 0, 2 * PI), 'paint:0.4,0', xf([cx, b0 + 1.6, cz]));
    // stabilising fins (trapezoid, ~7 m root) on the fairings, pointing radially out
    const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(3.5, -0.6), new THREE.Vector2(3.5, 2.4), new THREE.Vector2(0, 7.2)]);
    k.add(new THREE.ExtrudeGeometry(fin, { depth: 0.18, bevelEnabled: false }), 'paint:0.25,0', xf([Math.cos(a) * (R1 + 0.2), b0 - 0.8, Math.sin(a) * (R1 + 0.2)], [0, -a, 0], [1, 1, 1]).multiply(xf([0, 0, -0.09]))); }
  tube(k, R1, R1, 20.4, b0 + 7, 'paint:0,0'); // RP-1 + intertank + LOX (one shell)
  quads(k, R1, b0 + 7, 13.8, 0); // black roll quadrants on the fuel tank
  band(k, R1, b0 + 20.8, 3.2); // intertank black band
  tube(k, R1, R1, Y.ic - (b0 + 27.4), b0 + 27.4, 'paint:0,0'); quads(k, R1, Y.ic - 3.0, 3.0, PI / 2, 2); // LOX tank + forward skirt checker
  stringers(k, R1, b0 + 7, 13.8, 24); stringers(k, R1, b0 + 21, 3, 48);
  for (const a of [0.2, PI + 0.2]) k.add(new THREE.BoxGeometry(0.5, 32, 0.7), 'paint:0,0', xf([Math.cos(a) * (R1 + 0.3), b0 + 22, Math.sin(a) * (R1 + 0.3)], [0, -a, 0])); // tunnels (LOX/cable)
  decal(k, 'booster.side', R1, 20, 8, PI, 0.5);
  const g = k.build('S-IC'); g.userData.top = Y.ic; return g; }
function sii(d) { const k = new Kit(d);
  tube(k, R1, R1, Y.is - Y.ic, Y.ic, 'paint:0,0'); band(k, R1, Y.ic + 0.2, 0.5); stringers(k, R1, Y.ic, Y.is - Y.ic, 36); // interstage (falls away after ignition)
  for (const [x, z] of ringPos([[4, 2.65, PI / 4], [1, 0]])) bell(k, 1.0, 3.1, x, Y.ic + 1.0, z, { ext: false, head: 0.9, rt: 0.3 }); // 5 J-2 (inside the interstage)
  tube(k, R1, R1, Y.ii - Y.is, Y.is, 'paint:0,0'); band(k, R1, Y.ii - 3.6, 3.6); // all white, black forward skirt band
  ring(k, R1, Y.is + 9, 0.03); ring(k, R1, Y.is + 17, 0.03);
  decal(k, 'upper.side', R1, Y.is + 6, 9, PI, 0.45);
  const g = k.build('S-II'); g.userData.top = Y.ii; return g; }
function sivb(d) { const k = new Kit(d);
  tube(k, R1, R3, Y.tp - Y.ii, Y.ii, 'paint:0,0'); stringers(k, (R1 + R3) / 2, Y.ii + 0.5, 4, 20); // conical aft interstage 10.06 -> 6.6 m
  bell(k, 1.0, 3.1, 0, Y.tp - 3.2, 0, { head: 0.9, rt: 0.3 }); // one J-2
  tube(k, R3, R3, Y.ivb - Y.tp, Y.tp, 'paint:0,0'); quads(k, R3, Y.tp, 4.2, 0, 2); band(k, R3, Y.ivb - 0.8, 0.8); // aft roll quadrants
  for (const a of [PI / 2, 3 * PI / 2]) k.add(new THREE.BoxGeometry(1.4, 1.1, 1.2), 'paint:0,0', xf([Math.cos(a) * (R3 + 0.5), Y.tp + 0.8, Math.sin(a) * (R3 + 0.5)], [0, -a, 0])); // APS pods
  k.add(new THREE.BoxGeometry(0.3, Y.ivb - Y.tp - 1, 0.5), 'paint:0,0', xf([R3 + 0.2, (Y.tp + Y.ivb) / 2, 0]));
  const g = k.build('S-IVB'); g.userData.top = Y.ivb; return g; }
function iu(d) { const k = new Kit(d); tube(k, R3, R3, Y.iu - Y.ivb, Y.ivb, 'silver'); if (k.hi) for (let i = 0; i < 16; i++) { const a = i / 16 * 2 * PI; k.add(new THREE.BoxGeometry(0.5, 0.5, 0.1), 'dark', xf([Math.cos(a) * (R3 + 0.03), Y.ivb + 0.45, Math.sin(a) * (R3 + 0.03)], [0, -a + PI / 2, 0])); }
  const g = k.build('IU'); g.userData.top = Y.iu; return g; }
function sla(d) { const k = new Kit(d), rs = 1.96; tube(k, R3, rs, Y.sla - Y.iu, Y.iu, 'paint:0,0'); // tapered adapter (lander inside)
  if (k.hi) for (let i = 0; i < 4; i++) lathe(k, [[R3 * 1.004, Y.iu], [rs * 1.004, Y.sla]], 'dark', { seg: 1, p0: i * PI / 2 - 0.004, pl: 0.008 }); // 4 petal seams
  const g = k.build('SLA'); g.userData.top = Y.sla; return g; }
function csm(d) { const k = new Kit(d), r = 1.96;
  bell(k, 1.25, 2.9, 0, Y.sla - 2.6, 0, { ext: true, rt: 0.25, head: 0.4 }); // service-engine bell (mostly inside the adapter)
  tube(k, r, r, Y.sm - Y.sla, Y.sla, 'silver'); // service module (bright metal)
  if (k.hi) for (let i = 0; i < 4; i++) { const a = PI / 4 + i * PI / 2; k.add(new THREE.BoxGeometry(0.5, 0.9, 0.35), 'grey', xf([Math.cos(a) * (r + 0.2), Y.sm - 0.9, Math.sin(a) * (r + 0.2)], [0, -a, 0])); } // RCS quads
  const cp = PR.crewCone(r, Y.sm); lathe(k, cp, 'paint:0,0'); // covered command module (boost cover, white)
  const g = k.build('CSM'); g.userData.top = Y.cm; return g; }
function les(d) { const k = new Kit(d), y0 = Y.cm - 0.35, tw = 3.0; // 4-leg truss tower, motor, canard section, nose spike
  const legs = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, z]) => [x * 0.75, z * 0.75]);
  for (const [x, z] of legs) strut(k, [x, y0, z], [x * 0.35, y0 + tw, z * 0.35], 0.06, 'dark');
  if (k.hi) for (let i = 0; i < 4; i++) { const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 4]; strut(k, [ax, y0 + 0.1, az], [bx * 0.6, y0 + tw * 0.6, bz * 0.6], 0.035, 'dark'); }
  const ym = y0 + tw; tube(k, 0.33, 0.33, 3.2, ym, 'paint:0,0'); band(k, 0.33, ym + 1.2, 0.5); // motor with black band
  for (const a of [0, PI / 2, PI, 1.5 * PI]) bell(k, 0.14, 0.35, Math.cos(a) * 0.3, ym - 0.2, Math.sin(a) * 0.3, { head: 0 });
  lathe(k, PR.escapeNose(0.33, 1.6, ym + 3.2), 'paint:0,0'); tube(k, 0.03, 0.01, Y.top - (ym + 4.6), ym + 4.6, 'dark', { seg: 6 }); // nose + q-ball spike
  const g = k.build('LES'); g.userData.top = Y.top; return g; }
// plume (ascent shots only, o.plume): additive glow cones, own material (not cached -> freed by dispose)
function plume(n, pts, r, L) { const g = new THREE.Group(); g.name = 'plume'; const m = new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, z] of pts) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, L, 16, 1, true), m); c.position.set(x, -L / 2, z); c.rotation.x = PI; g.add(c);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, L * 0.45, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); c2.position.set(x, -L * 0.225, z); c2.rotation.x = PI; g.add(c2); } return g; }
export function saturnine(o) { const d = o.detail; const g = group('saturnine-v', [sic(d, o), sii(d), sivb(d), iu(d), sla(d), csm(d), les(d)], Y.top);
  if (o.plume) g.add(plume(5, ringPos([[4, 3.2, PI / 4], [1, 0]]), 2.2, 60 * o.plume)); return g; }
export const CO_NOSA = {
  'saturnine-v': { height: 110.6, build: saturnine, src: 'rocketdb saturnine-v (GCAT): 110.6 m, 10.06 m; S-IC 42.1, S-II 24.8, S-IVB 6.6 m dia; stack split art-fitted', est: ['IU/SLA/CSM/LES split', 'fin shape'] },
};
