// co-rocketwell-1: RocketWell Orbiter Systems (parody) — Space Truck Stack (moved here from co_civspace.js) and the
// Super Lift System (Block 1 crew/cargo, Block 1B crew/cargo) sharing the segmented booster + foam core helpers.
// Dimensions: rocketdb space-truck / super-lift (GCAT) + design.md. Original geometry, no logos/names.
import * as THREE from 'three/webgpu';
import { Kit, xf } from './kit.js?v=f5.9-4';
import * as PR from './profiles.js?v=f5.9-4';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.9-4';
import { group, lmat, kbuild, plume } from './co_civspace.js?v=f5.9-4';
const PI = Math.PI;
// ---- Space Truck Stack (parody of the winged orbiter stack): ET axis at x=z=0, boosters at x=±6.6, orbiter on +z ----
// rocketdb space-truck (GCAT): SRB 45.5 x 3.71 m, ET 47.0 x 8.4 m, orbiter 37.2 m long; stack 56.1 m; wingspan 23.8 m (art-fitted placement)
const TR = PR.TRUCK, ET0 = 9.1, ETT = 56.1, OZ = TR.etR + 1.25 + 2.5; // tank base/top, orbiter fuselage centre z
// segmented solid booster (shared: 4 segments = 45.5 m truck booster, 5 segments = 54 m lift-system booster)
export function segBooster(d, side, o = {}) { const k = new Kit(d), r = TR.srbR, x = side * (o.x || 6.6), ex = ((o.seg || 4) - 4) * 8.5, toEt = o.toR || TR.etR;
  k.push(xf([x, 0, 0]));
  bell(k, 1.9, 3.4, 0, 0, 0, { head: 0, rt: 0.9 }); // flexible-bearing nozzle
  tube(k, 2.65, r, 3.6, 2.9, 'paint:0.2,0'); // aft skirt flare
  tube(k, r, r, 39.5 + ex - 6.5, 6.5, 'paint:0,0'); for (let i = 1; i <= (o.seg || 4); i++) ring(k, r, 6.5 + i * (33 + ex) / ((o.seg || 4) + 0.3), 0.035, o.joint || 'dark'); // segment field joints // segment field joints
  tube(k, r, r * 0.95, 1.2, 39.5 + ex, 'paint:0,0'); lathe(k, PR.ogive(r * 0.95, TR.srbNose - 1.2, 40.7 + ex, k.hi ? 18 : 7, 0.1), 'paint:0,0'); // frustum + nose
  k.add(new THREE.BoxGeometry(0.4, 32, 0.4), 'paint:0,0', xf([0, 22 + ex / 2, r + 0.15])); // systems tunnel
  k.pop();
  for (const y of [9.8 + (o.y0 || 0), 41.0 + ex]) strut(k, [x - side * r, y, 0], [side * toEt, y + (y > 20 ? 0.6 : 0), 0], 0.18, 'dark'); // attach struts
  const g = kbuild(k, side < 0 ? 'SRB-L' : 'SRB-R'); g.userData.top = 45.5 + ex; return g; }
function et(d) { const k = new Kit(d), r = TR.etR;
  lathe(k, [[0, ET0], [r * 0.6, ET0 + 0.2], [r * 0.92, ET0 + 1.0], [r, ET0 + 2.0]], 'x-foam'); // aft dome
  tube(k, r, r, 28.7, ET0 + 2.0, 'x-foam', { hs: 1 }); // LH2 tank
  tube(k, r * 1.004, r * 1.004, 6.9, ET0 + 30.7, 'x-foam2'); // ribbed intertank
  tube(k, r, r, ETT - TR.etNose - (ET0 + 37.6), ET0 + 37.6, 'x-foam'); lathe(k, PR.ogive(r, TR.etNose, ETT - TR.etNose, k.hi ? 22 : 8, 0.03), 'x-foam'); // LOX ogive
  tube(k, 0.06, 0.02, 1.6, ETT - 0.1, 'dark', { seg: 6 }); // nose spike
  tube(k, 0.22, 0.22, 34, ET0 + 4, 'x-foam', { x: 1.6, z: r + 0.15, seg: k.hi ? 10 : 5 }); // LOX feedline
  if (k.hi) for (const y of [ET0 + 6, ET0 + 18, ET0 + 30]) k.add(new THREE.BoxGeometry(0.5, 0.3, 0.5), 'x-foam2', xf([1.6, y, r + 0.1]));
  k.add(new THREE.BoxGeometry(0.5, 25, 0.35), 'x-foam', xf([-1.7, ET0 + 18, r + 0.12])); // cable tray
  for (const xx of [-1.2, 1.2]) strut(k, [xx, ET0 + 1.6, r], [xx * 1.5, ET0 + 0.2, OZ - 2.4], 0.16, 'dark'); strut(k, [0, ET0 + 32, r], [0, ET0 + 30.5, OZ - 2.4], 0.16, 'dark'); // orbiter attach
  return kbuild(k, 'ET'); }
function orbiter(d) { const k = new Kit(d), y0 = 7.6, L = 37.2, top = y0 + L, fy = top - TR.orbNose; // fuselage y0..fy, nose fy..top
  k.push(xf([0, 0, OZ]));
  k.add(new THREE.BoxGeometry(5.2, fy - y0, 3.0), 'paint:0,0', xf([0, (y0 + fy) / 2, -0.7])); // boxy lower fuselage (flat sides, flat belly)
  k.add(new THREE.CylinderGeometry(2.6, 2.6, fy - y0, k.hi ? 20 : 8, 1, false, -PI / 2, PI), 'paint:0,0', xf([0, (y0 + fy) / 2, 0.8], [0, 0, 0], [1, 1, 0.75])); // payload-bay doors (rounded top)
  k.add(new THREE.BoxGeometry(5.0, fy - y0 - 0.2, 0.08), 'x-tile', xf([0, (y0 + fy) / 2, -2.17])); // black belly
  lathe(k, PR.ogive(TR.orbR, TR.orbNose, fy, k.hi ? 16 : 7, 0.12), 'paint:0,0', { m: xf([0, 0, 0.3], [0, 0, 0], [1, 1, 0.94]) });
  lathe(k, PR.ogive(TR.orbR, TR.orbNose, fy, k.hi ? 16 : 7, 0.12), 'x-tile', { m: xf([0, 0, 0.25], [0, 0, 0], [1.01, 1, 0.95]), p0: PI * 0.65, pl: PI * 0.7 }); // black chin
  if (k.hi) { for (const a of [-0.5, -0.17, 0.17, 0.5]) k.add(new THREE.BoxGeometry(0.55, 0.45, 0.06), 'glass', xf([Math.sin(a) * 1.9, fy + 1.4, 0.3 + Math.cos(a) * 1.75], [0.5, a, 0])); // cockpit windows
    for (const sx of [-1, 1]) k.add(new THREE.BoxGeometry(0.04, fy - y0 - 6, 0.04), 'dark', xf([sx * 0.02, (y0 + fy) / 2 + 1, 2.78])); } // payload-bay door seam
  // double-delta wings (span along x), thin, white top / black underside
  const wing = new THREE.Shape([new THREE.Vector2(0, y0 - 0.4), new THREE.Vector2(11.9, y0), new THREE.Vector2(11.9, y0 + 1.4), new THREE.Vector2(5.4, y0 + 13.5), new THREE.Vector2(2.9, y0 + 21.5), new THREE.Vector2(0, y0 + 24)]);
  for (const sx of [-1, 1]) { const m = xf([0, 0, -1.4], [0, 0, 0], [sx, 1, 1]); k.add(new THREE.ExtrudeGeometry(wing, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: k.hi && !k.mid ? 3 : 1, curveSegments: 1 }), 'paint:0,0', m); // rounded airfoil-ish section (~1.2 m root)
    k.add(new THREE.ShapeGeometry(wing), 'x-tile', xf([0, 0, -1.77], [0, PI, 0], [-sx, 1, 1])); // underside (below the bevel)
    k.add(new THREE.BoxGeometry(0.35, 0.35, 0.6), 'x-rcc', xf([sx * 11.9, y0 + 0.7, -1.1])); }
  if (k.hi) { const le = (a, b) => strut(k, [a[0], a[1], -1.13], [b[0], b[1], -1.13], 0.2, 'x-rcc'); for (const sx of [-1, 1]) { le([sx * 11.9, y0 + 1.4], [sx * 5.4, y0 + 13.5]); le([sx * 5.4, y0 + 13.5], [sx * 2.9, y0 + 21.5]); } }
  // vertical tail (+z), with split rudder line
  const fin = new THREE.Shape([new THREE.Vector2(0, y0 + 0.2), new THREE.Vector2(0, y0 + 9.5), new THREE.Vector2(7.6, y0 + 4.6), new THREE.Vector2(7.6, y0 + 1.6)]);
  k.add(new THREE.ExtrudeGeometry(fin, { depth: 0.45, bevelEnabled: false, curveSegments: 1 }), 'paint:0,0', xf([-0.22, 0, 2.6], [0, -PI / 2, 0]));
  // aft: 3 main engines (triangle) + 2 manoeuvring pods + body flap
  for (const [x, z] of [[0, 1.3], [-1.35, -0.6], [1.35, -0.6]]) bell(k, 1.15, 3.1, x, y0 - 3.1, z, { head: 0.5, rt: 0.35 });
  for (const sx of [-1, 1]) { tube(k, 0.85, 0.85, 4.5, y0 - 0.2, 'paint:0,0', { x: sx * 1.85, z: 2.0, seg: k.hi ? 14 : 6 }); bell(k, 0.4, 1.0, sx * 1.85, y0 - 1.1, 2.0, { head: 0 }); }
  k.add(new THREE.BoxGeometry(5.6, 0.3, 2.2), 'x-tile', xf([0, y0 - 0.3, -1.4])); // body flap
  decal(k, 'orbiter.side', 2.55, y0 + 14, 3, PI / 2, 0.8);
  k.pop(); const og = kbuild(k, 'orbiter'); og.userData.bay = { y: y0 + 15, h: 8, r: 2.5, cz: OZ }; return og; } // bay: dorsal payload bay (rockets-pass-1)
export function spaceTruck(o) { const d = o.detail; const g = group('space-truck', [segBooster(d, -1), segBooster(d, 1), et(d), orbiter(d)], ETT + 1.5);
  if (o.plume) { const p = plume(5, [[-6.6, 0], [6.6, 0]], 2.4, 70 * o.plume); g.add(p); const q = plume(3, [[0, OZ + 1.3], [-1.35, OZ - 0.6], [1.35, OZ - 0.6]], 1.1, 30 * o.plume); q.position.y = 4.5; g.add(q); } return g; }
// ---- Super Lift System: 8.4 m foam core (4 hydrogen engines in a square), two 5-segment boosters ----
const CR = 4.2, C0 = 3.6, CT = C0 + 64.6; // core body base/top
function core(d) { const k = new Kit(d);
  for (const [x, z] of ringPos([[4, 1.75, PI / 4]])) bell(k, 1.15, 3.1, x, 0.5, z, { head: 0.5, rt: 0.35 });
  lathe(k, [[0, C0], [CR * 0.9, C0], [CR, C0 + 0.6]], 'dark'); tube(k, CR, CR, 4.6, C0 + 0.6, 'x-foam2'); // engine section boat-tail
  tube(k, CR, CR, CT - C0 - 5.2, C0 + 5.2, 'x-foam', { hs: 1 }); tube(k, CR * 1.004, CR * 1.004, 6, C0 + 44, 'x-foam2'); // LH2 tank, intertank
  tube(k, 0.22, 0.22, 40, C0 + 6, 'x-foam', { x: 1.5, z: CR + 0.15, seg: k.hi ? 10 : 5 });
  decal(k, 'booster.side', CR, C0 + 22, 6, PI, 0.6);
  return kbuild(k, 'core'); }
function upper5(d) { const k = new Kit(d), y = CT; tube(k, CR, 2.5, 8.4, y, 'silver'); ring(k, CR, y + 0.2, 0.03); // stage adapter cone 8.4 -> 5 m
  bell(k, 0.6, 1.9, 0, y + 6.4, 0, { ext: true, head: 0.3, rt: 0.15 }); tube(k, 2.5, 2.5, 5.0, y + 8.4, 'paint:0,0'); tube(k, 2.5, 2.5, 1.0, y + 13.4, 'grey');
  const g = kbuild(k, 'upper'); g.userData.top = y + 14.4; g.userData.r = 2.5; return g; }
function eus(d) { const k = new Kit(d), y = CT; tube(k, CR, CR, 1.5, y, 'grey');
  for (const [x, z] of ringPos([[4, 1.6, PI / 4]])) bell(k, 0.6, 1.9, x, y + 0.2, z, { ext: true, head: 0.3, rt: 0.15 });
  tube(k, CR, CR, 16.5, y + 1.5, 'paint:0,0'); ring(k, CR, y + 9, 0.03); const g = kbuild(k, 'upper'); g.userData.top = y + 18; g.userData.r = CR; return g; }
// crew: adapter, covered service module, covered capsule, escape tower
function crew(d, y0, r0) { const k = new Kit(d), r = 2.5;
  if (r0 > r) { tube(k, r0, r0, 8.0, y0, 'paint:0,0'); tube(k, r0, r, 2.2, y0 + 8, 'paint:0,0'); y0 += 10.2; } // co-manifest adapter (Block 1B)
  tube(k, r, r, 1.0, y0, 'grey'); tube(k, r, r, 4.8, y0 + 1.0, 'paint:0,0'); if (k.hi) for (let i = 0; i < 3; i++) lathe(k, [[r * 1.004, y0 + 1], [r * 1.004, y0 + 5.8]], 'dark', { seg: 1, p0: i * 2 * PI / 3, pl: 0.008 }); // 3 jettison panels
  const c0 = y0 + 5.8; lathe(k, [[0, c0], [r, c0], [r * 0.97, c0 + 0.3], [r * 0.42, c0 + 3.2], [r * 0.3, c0 + 3.4], [0, c0 + 3.45]], 'paint:0,0'); // boost cover over the capsule
  const tb = c0 + 3.4; tube(k, 0.55, 0.55, 2.2, tb, 'paint:0,0'); if (k.hi) for (const a of [0, PI / 2, PI, 1.5 * PI]) bell(k, 0.22, 0.6, Math.cos(a) * 0.55, tb + 0.2, Math.sin(a) * 0.55, { head: 0 }); // abort motor nozzles
  tube(k, 0.55, 0.4, 3.0, tb + 2.2, 'paint:0,0'); lathe(k, PR.ogive(0.4, 1.4, tb + 5.2, 10, 0.15), 'paint:0,0'); tube(k, 0.04, 0.02, 0.8, tb + 6.55, 'dark', { seg: 6 });
  const g = kbuild(k, 'payload'); g.userData.top = tb + 7.35; return g; }
function cargoF(d, y0, r0, R, cyl) { const k = new Kit(d), p = PR.fairing(R, cyl, R * 2.4, y0, r0, k.hi ? 20 : 8, R > r0 ? 1.5 : 0.1);
  lathe(k, p, 'paint:0,0'); if (k.hi) for (const ph of [0, PI]) lathe(k, p.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); decal(k, 'fairing.side', R, y0 + 4, 3, PI / 2, 0.8);
  const g = kbuild(k, 'payload'); g.userData.top = p.at(-1)[1]; return g; }
export function superLift(o, v) { const d = o.detail, kids = [segBooster(d, -1, { seg: 5, x: 6.75 }), segBooster(d, 1, { seg: 5, x: 6.75 }), core(d)];
  const u = /1b/.test(v) ? eus(d) : upper5(d); kids.push(u);
  const p = /crew/.test(v) ? crew(d, u.userData.top, u.userData.r) : /1b/.test(v) ? cargoF(d, u.userData.top, CR, 4.5, 15) : cargoF(d, u.userData.top, 2.5, 2.7, 10);
  kids.push(p); const g = group('super-lift-' + v, kids, p.userData.top);
  if (o.plume) { g.add(plume(0, [[-6.75, 0], [6.75, 0]], 2.6, 80 * o.plume)); g.add(plume(0, ringPos([[4, 1.75, PI / 4]]), 1.1, 35 * o.plume)); } return g; }
export const CO_ROCKETWELL = {
  'space-truck': { height: 57.6, build: spaceTruck, src: 'rocketdb space-truck (GCAT): SRB 45.5 x 3.71 m, ET 47 x 8.4 m, orbiter 37.2 m; stack 56.1 m', est: ['orbiter planform', 'attach placement'] },
  'super-lift-crew': { height: 98, build: o => superLift(o, 'crew'), src: 'rocketdb super-lift Block 1 crew (GCAT): 98 m, core 64.6 x 8.4 m, 5-seg boosters 54 x 3.71 m', est: ['adapter/capsule split'] },
  'super-lift-cargo': { height: 95, build: o => superLift(o, 'cargo'), src: 'Block 1 cargo (planned, 5 m fairing)', est: ['planned config'] },
  'super-lift-1b-crew': { height: 111, build: o => superLift(o, '1b-crew'), src: 'Block 1B crew (planned): 111 m, 4-engine upper stage + co-manifest adapter', est: ['planned config'] },
  'super-lift-1b-cargo': { height: 112, build: o => superLift(o, '1b-cargo'), src: 'Block 1B cargo (planned): 8.4 m+ fairing', est: ['planned config'] },
};
