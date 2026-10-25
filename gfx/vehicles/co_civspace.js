// co-civspace-1: civil space agency heritage vehicles, rocketdb tier S. Original geometry, no logos/names.
// Dimensions: game-studio rocketdb (GCAT stage table) + design.md; the stack breakdown is art-fitted to the 110.6 m total.
import * as THREE from 'three/webgpu';
import { Kit, xf, weakDisposeListeners } from './kit.js?v=f5.8z';
import * as PR from './profiles.js?v=f5.8z';
import { lathe, tube, bell, ringPos, ring, decal, strut } from './parts.js?v=f5.8z';
const PI = Math.PI;
function group(name, kids, h) { const g = new THREE.Group(); g.name = name; for (const c of kids) g.add(c); g.userData.height = h; g.userData.stages = Object.fromEntries(kids.map(c => [c.name, c])); g.userData.legs = []; return g; }
const LOCAL = new Map();
function lmat(key) { if (LOCAL.has(key)) return LOCAL.get(key); let m;
  if (key === 'x-foam' || key === 'x-foam2') { const c = document.createElement('canvas'); c.width = 256; c.height = 512; const x = c.getContext('2d'); x.fillStyle = key === 'x-foam' ? '#b8622c' : '#a6582a'; x.fillRect(0, 0, 256, 512);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 2600; i++) { const v = r(); x.fillStyle = `rgba(${v > 0.5 ? '255,170,110' : '90,40,15'},${0.05 + r() * 0.08})`; x.fillRect(r() * 256, r() * 512, 2 + r() * 8, 1 + r() * 5); }
    if (key === 'x-foam2') for (let y = 0; y < 512; y += 16) { x.fillStyle = 'rgba(60,25,8,0.35)'; x.fillRect(0, y, 256, 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.cached = true; m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, metalness: 0 }); }
  else if (key === 'x-bellblack') m = new THREE.MeshStandardMaterial({ color: 0x2a2826, roughness: 0.5, metalness: 0.8, side: THREE.DoubleSide });
  else if (key === 'x-salmon' || key === 'x-salmon2') m = new THREE.MeshStandardMaterial({ color: key === 'x-salmon' ? 0xc98a5e : 0xb07650, roughness: 0.7, metalness: 0.15 }); // ULX: kerosene core paint
  else if (key === 'x-bellchar') m = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.8, metalness: 0.2, side: THREE.DoubleSide }); // ablative bell
  else if (key === 'x-tile') m = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.85, metalness: 0.05 });
  else if (key === 'x-rcc') m = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.7, metalness: 0.1 });
  else m = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.55 });
  m.name = key; m.userData.cached = true; weakDisposeListeners(m); LOCAL.set(key, m); return m; } // weak listeners: no per-render leak (rockets-3 fix)
// roll pattern: black quadrant panels over white paint (the classic test-range pattern; generic, no insignia)
function quads(k, r, y, h, a0 = 0, n = 2) { for (let i = 0; i < n; i++) tube(k, r * 1.006, r * 1.006, h, y, 'dark', { open: true, t0: a0 + i * PI, tl: PI / 2, seg: k.hi ? 10 : 4 }); }
function band(k, r, y, h) { tube(k, r * 1.006, r * 1.006, h, y, 'dark', { open: true, seg: k.hi ? 40 : 14 }); }
function stringers(k, r, y, h, n, key = 'paint:0,0') { if (!k.hi || k.mid) return; for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * PI; k.add(new THREE.BoxGeometry(0.09, h, 0.06), key, xf([Math.cos(a) * (r + 0.03), y + h / 2, Math.sin(a) * (r + 0.03)], [0, -a, 0])); } }
// Saturnine V stack heights (m, from the K-1 exits): stage1 0-42.1, interstage 42.1-47.6, stage2 -72.4, stage3 taper -77.4 + cyl -90.1,
// IU -91.0, SLA -99.5 (6.6 -> 3.9 m), SM -102.2, CM -105.4, LES tower+motor -110.6
const R1 = 5.03, R3 = 3.3, Y = { ic: 42.1, is: 47.6, ii: 72.4, tp: 77.4, ivb: 90.1, iu: 91.0, sla: 99.5, sm: 102.2, cm: 105.4, top: 110.6 };
function sic(d, o) { const k = new Kit(d), b0 = 5.2; // body starts above the hanging bells
  // 5 K-1: centre + 4 at 45° under the fins; bells 3.76 m exit, ~5.8 m long incl. nozzle extension
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
  stringers(k, R1, b0 + 21, 3, 48, 'dark'); // intertank corrugation only (tank stringers read as noise)
  for (const a of [0.2, PI + 0.2]) k.add(new THREE.BoxGeometry(0.5, 32, 0.7), 'paint:0,0', xf([Math.cos(a) * (R1 + 0.3), b0 + 22, Math.sin(a) * (R1 + 0.3)], [0, -a, 0])); // tunnels (LOX/cable)
  decal(k, 'booster.side', R1, 20, 8, PI, 0.5);
  const g = k.build('stage1'); for (const m of g.children) if (m.name.endsWith(':bell')) m.material = lmat('x-bellblack'); g.userData.top = Y.ic; return g; } // K-1: dark regen tubes
function sii(d) { const k = new Kit(d);
  tube(k, R1, R1, Y.is - Y.ic, Y.ic, 'paint:0,0'); band(k, R1, Y.ic + 0.2, 0.5); stringers(k, R1, Y.ic, Y.is - Y.ic, 36); // interstage (falls away after ignition)
  for (const [x, z] of ringPos([[4, 2.65, PI / 4], [1, 0]])) bell(k, 1.0, 3.1, x, Y.ic + 1.0, z, { ext: false, head: 0.9, rt: 0.3 }); // 5 hydrogen upper-stage bells (inside the interstage)
  tube(k, R1, R1, Y.ii - Y.is, Y.is, 'paint:0,0'); band(k, R1, Y.ii - 3.6, 3.6); // all white, black forward skirt band
  ring(k, R1, Y.is + 9, 0.03); ring(k, R1, Y.is + 17, 0.03);
  decal(k, 'upper.side', R1, Y.is + 6, 9, PI, 0.45);
  const g = k.build('stage2'); g.userData.top = Y.ii; return g; }
function sivb(d) { const k = new Kit(d);
  tube(k, R1, R3, Y.tp - Y.ii, Y.ii, 'paint:0,0'); stringers(k, (R1 + R3) / 2, Y.ii + 0.5, 4, 20); // conical aft interstage 10.06 -> 6.6 m
  bell(k, 1.0, 3.1, 0, Y.tp - 3.2, 0, { head: 0.9, rt: 0.3 }); // one hydrogen upper-stage bell
  tube(k, R3, R3, Y.ivb - Y.tp, Y.tp, 'paint:0,0'); quads(k, R3, Y.tp, 4.2, 0, 2); band(k, R3, Y.ivb - 0.8, 0.8); // aft roll quadrants
  for (const a of [PI / 2, 3 * PI / 2]) k.add(new THREE.BoxGeometry(1.4, 1.1, 1.2), 'paint:0,0', xf([Math.cos(a) * (R3 + 0.5), Y.tp + 0.8, Math.sin(a) * (R3 + 0.5)], [0, -a, 0])); // APS pods
  k.add(new THREE.BoxGeometry(0.3, Y.ivb - Y.tp - 1, 0.5), 'paint:0,0', xf([R3 + 0.2, (Y.tp + Y.ivb) / 2, 0]));
  const g = k.build('stage3'); g.userData.top = Y.ivb; return g; }
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
// ---- Space Truck Stack (parody of the winged orbiter stack): ET axis at x=z=0, boosters at x=±6.6, orbiter on +z ----
// rocketdb space-truck (GCAT): SRB 45.5 x 3.71 m, ET 47.0 x 8.4 m, orbiter 37.2 m long; stack 56.1 m; wingspan 23.8 m (art-fitted placement)
function kbuild(k, name) { const g = k.build(name); for (const m of g.children) { const key = m.name.split(':').slice(1).join(':'); if (key.startsWith('x-')) m.material = lmat(key); } return g; }
const TR = PR.TRUCK, ET0 = 9.1, ETT = 56.1, OZ = TR.etR + 1.25 + 2.5; // tank base/top, orbiter fuselage centre z
function srb(d, side) { const k = new Kit(d), r = TR.srbR, x = side * 6.6;
  k.push(xf([x, 0, 0]));
  bell(k, 1.9, 3.4, 0, 0, 0, { head: 0, rt: 0.9 }); // flexible-bearing nozzle
  tube(k, 2.65, r, 3.6, 2.9, 'paint:0.2,0'); // aft skirt flare
  tube(k, r, r, 39.5 - 6.5, 6.5, 'paint:0,0'); for (const y of [12.6, 20.2, 27.8, 34.6]) ring(k, r, y, 0.035); // segment field joints
  tube(k, r, r * 0.95, 1.2, 39.5, 'paint:0,0'); lathe(k, PR.ogive(r * 0.95, TR.srbNose - 1.2, 40.7, k.hi ? 18 : 7, 0.1), 'paint:0,0'); // frustum + nose
  k.add(new THREE.BoxGeometry(0.4, 32, 0.4), 'paint:0,0', xf([-side * 0.3 * 0, 22, r + 0.15])); // systems tunnel
  k.pop();
  for (const y of [9.8, 41.0]) strut(k, [x - side * r, y, 0], [side * TR.etR, y + (y > 20 ? 0.6 : 0), 0], 0.18, 'dark'); // attach struts
  const g = kbuild(k, side < 0 ? 'SRB-L' : 'SRB-R'); return g; }
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
  k.pop(); return kbuild(k, 'orbiter'); }
export function spaceTruck(o) { const d = o.detail; const g = group('space-truck', [srb(d, -1), srb(d, 1), et(d), orbiter(d)], ETT + 1.5);
  if (o.plume) { const p = plume(5, [[-6.6, 0], [6.6, 0]], 2.4, 70 * o.plume); g.add(p); const q = plume(3, [[0, OZ + 1.3], [-1.35, OZ - 0.6], [1.35, OZ - 0.6]], 1.1, 30 * o.plume); q.position.y = 4.5; g.add(q); } return g; }
export const CO_CIVSPACE = {
  'space-truck': { height: 57.6, build: spaceTruck, src: 'rocketdb space-truck (GCAT): SRB 45.5 x 3.71 m, ET 47 x 8.4 m, orbiter 37.2 m; stack 56.1 m', est: ['orbiter planform', 'attach placement'] },
  'saturnine-v': { height: 110.6, build: saturnine, src: 'rocketdb saturnine-v (GCAT): 110.6 m, 10.06 m; stage1 42.1, stage2 24.8, stage3 6.6 m dia; stack split art-fitted', est: ['IU/SLA/CSM/LES split', 'fin shape'] },
};
export { group, lmat, kbuild, plume }; // shared helpers for the other co_* company files
