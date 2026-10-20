// Orbit Rush hero vehicle models (art1). Real-inspired proportions from public dimensions; logo-free, name-free
// generic markings (brand packs can fill decal slots, see decals.js). Pure art: no physics, no DOM besides canvases.
//
// API:  build(id, { detail: 'hi'|'lo', legs: 0..1, fins: 0..1 }) -> THREE.Group
//       buildLOD(id, opts) -> THREE.LOD (hi near, lo far), userData = { id, height, stages: {name: Group}, legs: [...] }
//       VEHICLES[id] = { label, height, build }
// Every vehicle: origin at the bottom of the lowest engine exit, +Y up. Each stage is a named child group
// (e.g. 'booster', 'upper', 'payload', 'side0') so a game can detach stages; userData.legs groups take setLegs(g, t).
import * as THREE from 'three/webgpu';
import { Kit, xf, mat, compact, compactStages, shareGeometries, dispose, release, geometryCacheSize } from './kit.js?v=art1';
export { dispose, release, geometryCacheSize };
import * as PR from './profiles.js?v=art1';
import { lathe, tube, ogive, bell, ringPos, gridFins, legs, setLegs, decal, raceway, ring, strut } from './parts.js?v=art1';
export { setLegs, mat };
import { CO_NOSA } from './co_nosa.js?v=art1'; // co-nosa-1: NOSA heritage vehicles
import { CO_ORIGINALS } from './co_originals.js?v=art1';
const PI = Math.PI;
// ---- kerolox booster core (9 engines, octaweb, legs, grid fins) ----
function core9(detail, o = {}) {
  const k = new Kit(detail), r = 1.83, H = o.H || 40.9, top = o.nose ? H : H;
  for (const [x, z] of ringPos([[8, 1.22, PI / 8], [1, 0]])) bell(k, 0.46, 1.25, x, 0, z, { head: 0.55 });
  // octaweb heat shield (quilted blanket plate the bells poke through) + shaded, sooty engine skirt
  k.add(new THREE.CircleGeometry(r * 0.99, k.hi ? 32 : 8), 'shield', xf([0, 1.3, 0], [-PI / 2, 0, 0]));
  tube(k, r, r, 0.95, 1.3, 'skirt', { seg: k.hi ? 32 : 8 });
  if (k.hi && !o.v11) for (const [x, z] of ringPos([[8, 1.22, PI / 8]])) k.add(new THREE.CylinderGeometry(0.52, 0.6, 0.35, 14, 1, true), 'shield', xf([x, 1.12, z])); // aft thermal boots
  const soot = Math.round((o.soot ?? 0.75) * 4) / 4; tube(k, r, r, H - 2.25, 2.25, `paint:${soot},0`, { hs: 1 }); // post-flight soot rising from the base (o.soot 0 fresh .. 1 heavily reflown)
  ring(k, r, H * 0.42, 0.02); raceway(k, r, 2.4, H - 0.4, PI / 2, 'dark');
  if (o.frost) tube(k, r * 1.004, r * 1.004, H * 0.55 - 0.3, H * 0.45, 'frost', { open: true }); // LOX-tank frost (upper tank of the first stage) when fuelled
  decal(k, 'booster.side', r, H * 0.35, 4.2, 0, 1.3);
  if (o.nose) { ogive(k, r, 6.2, H, 'paint:0,0.6'); gridFins(k, r + 0.05, H - 1.6, 1.15, 1.4, 4, PI / 4, o.fins ?? 0.15); }
  else { tube(k, r, r, 6.6, H, o.v11 ? 'paint:0,0.2' : 'carbon'); gridFins(k, r + 0.05, H + 5.2, 1.15, 1.4, 4, PI / 4, o.fins ?? 0.15);
    if (k.hi) for (const a of [0, PI / 2, PI, 1.5 * PI]) k.add(new THREE.BoxGeometry(0.35, 0.5, 0.35), 'dark', xf([Math.cos(a) * (r + 0.15), H + 3.6, Math.sin(a) * (r + 0.15)])); } // cold-gas thrusters
  const g = k.build('booster'); const L = legs(Kit, detail, r, 9.6, 1.0); setLegs(L, o.legs ?? 0); g.add(L); g.userData.legs = L; g.userData.height = o.nose ? H + 6.2 : H + 6.6; return g;
}
function upper(detail, o = {}) { const k = new Kit(detail), r = 1.83, y0 = o.y0, h = o.h || 11.6;
  bell(k, 1.3, 3.2, 0, y0 - 3.4, 0, { ext: true, rt: 0.3, head: 0.8 }); // vacuum engine with heat-tinted extension (mostly inside the interstage)
  tube(k, r, r, h, y0, 'paint:0,0.25'); ring(k, r, y0 + h * 0.55, 0.02); decal(k, 'upper.side', r, y0 + 3, 2.6, 0, 1.0); raceway(k, r, y0 + 0.3, y0 + h - 0.3);
  tube(k, r, 1.6, 0.6, y0 + h, 'dark'); const g = k.build('upper'); g.userData.top = y0 + h + 0.6; return g; }
function fairing(detail, y0, r = PR.HERON_FAIRING.r, cyl = PR.HERON_FAIRING.cyl, nose = PR.HERON_FAIRING.nose, rBase = PR.HERON_FAIRING.rBase, bt = PR.HERON_FAIRING.bt) { const k = new Kit(detail), prof = PR.fairing(r, cyl, nose, y0, rBase, k.hi ? 22 : 8, bt);
  lathe(k, prof, 'paint:0,0'); // ONE continuous profile: boattail, barrel, tangent ogive (tip +Y)
  if (k.hi) { for (const ph of [0, PI]) lathe(k, prof.slice(1), 'dark', { s: 1.003, seg: 1, p0: ph - 0.004, pl: 0.008 }); // the two half seams
    lathe(k, prof.slice(1, 4), 'carbon', { s: 1.002 }); decal(k, 'fairing.side', r, y0 + 2.2, 2.2, PI / 2, 1.0); }
  const g = k.build('payload'); g.userData.top = prof[prof.length - 1][1]; return g; }
function capsule(detail, y0) { const k = new Kit(detail), r = 1.85;
  tube(k, r, r, 3.7, y0, 'paint:0,0'); // trunk
  tube(k, r * 1.003, r * 1.003, 3.0, y0 + 0.4, 'solar', { open: true, tl: PI, t0: PI }); // body-mounted solar half
  if (k.hi) for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; k.add(new THREE.BoxGeometry(1.0, 1.6, 0.08), 'paint:0,0', xf([Math.cos(a) * (r + 0.5), y0 + 0.9, Math.sin(a) * (r + 0.5)], [0, -a + PI / 2, 0])); }
  const c0 = y0 + 3.7; tube(k, r, r, 0.2, c0, 'dark'); // heat-shield rim
  const cp = PR.capsule(r, c0); lathe(k, cp.slice(0, 2), 'dark'); lathe(k, cp.slice(1), 'paint:0,0'); // dark heat-shield face, then sidewall + nose cap
  if (k.hi) { for (let i = 0; i < 4; i++) { const a = i * PI / 2; k.add(new THREE.BoxGeometry(0.5, 0.9, 0.35), 'dark', xf([Math.cos(a) * r * 0.86, c0 + 1.2, Math.sin(a) * r * 0.86], [0, -a, -0.32])); } // abort-thruster pods
    for (const a of [-0.35, 0, 0.35]) k.add(new THREE.BoxGeometry(0.1, 0.35, 0.45), 'glass', xf([Math.cos(a) * r * 0.78, c0 + 1.9, Math.sin(a) * r * 0.78], [0, -a, -0.33]));
    decal(k, 'capsule.side', r * 0.75, c0 + 1.0, 0.8, PI, 0.9); }
  const g = k.build('payload'); g.userData.top = c0 + 4.0; return g; }
function group(name, kids, h) { const g = new THREE.Group(); g.name = name; for (const c of kids) g.add(c); g.userData.height = h; g.userData.stages = Object.fromEntries(kids.map(c => [c.name, c])); g.userData.legs = kids.map(c => c.userData.legs).filter(Boolean); return g; }
// ---- vehicles ----
function heron(o) { const d = o.detail, b = core9(d, o), u = upper(d, { y0: 46.0 }), f = o.crew ? capsule(d, u.userData.top) : fairing(d, u.userData.top); return group(o.crew ? 'heron-9-crew' : 'heron-9', [b, u, f], f.userData.top); }
function sparrow(o) { const d = o.detail, k = new Kit(d), r = 0.835;
  bell(k, 0.55, 1.3, 0, 0, 0, { head: 0.5 }); tube(k, r, r, 0.6, 1.25, 'dark'); tube(k, r, r, 13.9, 1.85, 'silver'); ring(k, r, 9, 0.015); decal(k, 'booster.side', r, 6, 2.0, 0, 1.4);
  tube(k, r, r, 1.2, 15.75, 'carbon'); const b = k.build('booster');
  const u = new Kit(d); bell(u, 0.42, 1.0, 0, 16.0, 0, { ext: true, rt: 0.12, head: 0.3 }); tube(u, r, r, 2.4, 16.95, 'silver'); decal(u, 'upper.side', r, 17.2, 1.4, 0, 1.2); const U = u.build('upper');
  const f = fairing(d, 18.85, 0.75, 0.6, 1.85, 0.66, 0.6); return group('sparrow', [b, U, f], 21.3); }
function heronHeavy(o) { const d = o.detail === 'hi' ? 'mid' : o.detail, // phone budget: hi = mid-detail cores (≤20k tris, ≤30 meshes)
   c = core9(d, o), u = upper(d, { y0: 46.0 }), f = fairing(d, u.userData.top), kids = [c, u, f];
  for (const s of [-1, 1]) { const b = core9(d, { ...o, nose: true, H: 40.9 }); b.name = s < 0 ? 'side0' : 'side1'; b.position.x = s * 3.86; b.rotation.y = s < 0 ? PI : 0; kids.push(b); }
  const k = new Kit(d); for (const s of [-1, 1]) { for (const y of [4.5, 38.5]) strut(k, [s * 1.8, y, 0], [s * 2.05, y, 0], 0.3, 'dark'); if (k.hi) strut(k, [s * 1.8, 37, 0.6], [s * 2.05, 39, 0.6], 0.12, 'grey'); }
  kids.push(k.build('struts')); return group('heron-heavy', kids, f.userData.top); }
function colossusBooster(detail, o) { const k = new Kit(detail), r = 4.5, H = o.boosterH || 72.3;
  const pos = ringPos([[3, 0.95, PI / 6], [10, 2.55], [20, 3.85, PI / 20]]);
  for (const [x, z] of pos) bell(k, 0.62, 1.55, x, 0, z, { rt: 0.26, head: k.hi ? 0.9 : 0 });
  tube(k, r, r, 0.4, 1.4, 'dark'); tube(k, r * 1.02, r, 3.2, 1.4, 'steel'); // engine skirt + shielding
  tube(k, r, r, H - 4.6 - 1.8, 4.6, 'steel'); if (o.frost ?? 0) tube(k, r * 1.004, r * 1.004, H - 4.6 - 1.8, 4.6, 'frost', { open: true }); // cryo frost: LOX (lower) and CH4 (upper) tanks, clear at the common dome ring(k, r, 30, 0.03, 'grey'); ring(k, r, 52, 0.03, 'grey');
  if (k.hi) for (const a of [PI / 2 - 0.18, PI / 2 + 0.18]) k.add(new THREE.BoxGeometry(0.35, H - 8, 0.5), 'steel', xf([Math.cos(a) * (r + 0.15), H / 2, Math.sin(a) * (r + 0.15)], [0, -a, 0])); // chines
  decal(k, 'colossusbooster.side', r, 40, 6, 0, 0.9);
  if (k.hi) { for (const a of [PI * 0.25, PI * 1.25]) raceway(k, r, 6, H - 3, a, 'steel'); for (const y of [12, 30, 52]) ring(k, r, y, 0.035, 'grey'); // conduit raceways, weld lands
    for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; k.add(new THREE.BoxGeometry(1.4, 1.0, 0.25), 'dark', xf([Math.cos(a) * (r + 0.1), 3.6, Math.sin(a) * (r + 0.1)], [0, -a + PI / 2, 0])); } } // QD / ground-service plates
  // vented hot-staging ring
  tube(k, r, r, 1.8, H - 1.8, 'dark'); if (k.hi) for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * PI; k.add(new THREE.BoxGeometry(0.25, 1.4, 0.9), 'steel', xf([Math.cos(a) * r, H - 0.9, Math.sin(a) * r], [0, -a, 0])); }
  gridFins(k, r + 0.05, H - 5.5, 2.4, 3.2, o.gridFins || 3, PI / 2, o.fins ?? 1); // brief: v3/v4 boosters carry 3 grid fins
  const g = k.build('booster'); g.userData.height = H; return g; }
function ship(detail, y0, L = 52.1) { const k = new Kit(detail), r = 4.5, nose = 16, cyl = L - nose - 2;
  // windward = -Z half (theta pi/2 .. 3pi/2 in three's cylinder/lathe convention); tile edge lines at +-X
  for (const [x, z] of ringPos([[3, 1.0, PI / 6]])) bell(k, 0.65, 1.6, x, y0 + 0.2, z, { rt: 0.26, head: 0.8 }); // sea-level (gimbaled)
  for (const [x, z] of ringPos([[3, 3.05, PI / 2]])) bell(k, 1.15, 3.0, x, y0 - 1.0, z, { ext: true, rt: 0.26, head: 0.8 }); // vacuum (fixed, large)
  tube(k, r, r, 2, y0, 'skirt'); tube(k, r, r, cyl, y0 + 2, 'steel'); ogive(k, r, nose, y0 + 2 + cyl, 'steel', 0.12);
  tube(k, r * 1.006, r * 1.006, cyl, y0 + 2, 'tiles', { open: true, t0: PI / 2, tl: PI });
  lathe(k, PR.ogive(r, nose, y0 + 2 + cyl, k.hi ? 18 : 7, 0.12).map(([a, b]) => [a * 1.006, b]), 'tiles', { p0: PI / 2, pl: PI });
  // flaps: planar, hinged on the tile edge; windward face tiled, steel back; actuator fairing over the hinge
  const flap = (yb, h, w0, w1, side, rad, lean = 0) => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w0, 0.6); sh.lineTo(w1, h); sh.lineTo(0, h); sh.closePath();
    k.push(xf([side * rad, yb, 0], [lean, side < 0 ? PI : 0, 0]));
    k.add(new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false }), 'steel');
    k.add(new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }), 'tiles', xf([0, 0, -0.07]));
    k.add(new THREE.CylinderGeometry(0.35, 0.35, h, 10), 'steel', xf([0.1, h / 2, 0.2])); k.pop(); };
  for (const s of [-1, 1]) { flap(y0 + 1.5, 11, 5.0, 3.4, s, r); // aft
    flap(y0 + 2 + cyl + 3.5, 9, 3.4, 1.6, s, 4.1, 0); } // forward (on the nose, smaller, slightly leeward on v3)
  decal(k, 'ship.side', r, y0 + 20, 6, -PI / 2, 0.9); // leeward steel side
  if (k.hi) { for (const a of [PI * 0.1, -PI * 0.1]) raceway(k, r, y0 + 3, y0 + 2 + cyl, a, 'steel'); for (const y of [y0 + 2.2, y0 + 2 + cyl * 0.42, y0 + 2 + cyl - 0.3]) ring(k, r, y, 0.04, 'grey'); // raceways, aft dome / common dome / forward weld lands
    k.add(new THREE.BoxGeometry(1.6, 1.2, 0.2), 'dark', xf([0, y0 + 2 + cyl - 3, r + 0.05])); } // payload/door hatch outline
  const g = k.build('upper'); g.userData.top = y0 + 2 + cyl + nose; return g; }
function colossus(o) { const b = colossusBooster(o.detail, o), s = ship(o.detail, b.userData.height, o.shipH || 52.1); return group('colossus', [b, s], s.userData.top); }
// ---- ground systems: catch tower with chopsticks + orbital launch mount ----
function catchTower(o) { const k = new Kit(o.detail), W = 12, H = 146, TX = -24, lv = 9, n = Math.floor(H / lv);
  tube(k, 30, 32, 2, -2, 'concrete', { seg: 48 });
  // square lattice: 4 corner chords, a horizontal ring and X bracing on every face of every bay, floor decks every 4 bays
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) k.add(new THREE.BoxGeometry(2.2, H, 2.2), 'tower', xf([TX + dx * W / 2, H / 2, dz * W / 2]));
  const dl = Math.hypot(W, lv), da = Math.atan2(lv, W);
  for (let i = 0; i < n; i++) { for (let f = 0; f < 4; f++) { const ry = f * PI / 2, cx = Math.sin(ry) * W / 2, cz = Math.cos(ry) * W / 2;
      k.add(new THREE.BoxGeometry(W, 0.9, 0.9), 'tower', xf([TX + cx, (i + 1) * lv, cz], [0, ry + PI / 2, 0]));
      for (const sg of k.hi ? [1, -1] : [i % 2 ? 1 : -1]) k.add(new THREE.BoxGeometry(dl, 0.6, 0.6), 'tower', xf([TX + cx, i * lv + lv / 2, cz], [0, ry + PI / 2, sg * da])); }
    if (k.hi && i % 4 === 3) k.add(new THREE.BoxGeometry(W, 0.4, W), 'grey', xf([TX, (i + 1) * lv - 0.6, 0])); }
  tube(k, 0.25, 0.6, 18, H, 'grey', { x: TX, seg: 8 }); // lightning mast
  // chopsticks: lattice carriage + two Warren-truss arms (top/bottom chords, verticals, diagonals), at the catch height
  const cy = o.catchY ?? 104, open = o.open ?? 0.55; k.push(xf([TX + W / 2 + 1, cy, 0]));
  for (const [y, z] of [[-6, -7], [-6, 7], [6, -7], [6, 7]]) k.add(new THREE.BoxGeometry(4, 1, 1), 'tower', xf([0, y, z]));
  for (const z of [-7, 7]) for (const x of [-1.5, 1.5]) k.add(new THREE.BoxGeometry(1, 13, 1), 'tower', xf([x, 0, z]));
  for (const x of [-1.5, 1.5]) for (const y of [-6, 6]) k.add(new THREE.BoxGeometry(1, 1, 15), 'tower', xf([x, y, 0]));
  for (const sg of [1, -1]) k.add(new THREE.BoxGeometry(1, Math.hypot(12, 14), 0.8), 'tower', xf([1.5, 0, 0], [sg * Math.atan2(14, 12), 0, 0])); // carriage face X-brace (in the Y-Z plane)
  for (const s2 of [-1, 1]) { k.push(xf([1, 0, s2 * 5.5], [0, -s2 * open, 0])); const L = 38, hT = 4.4, nb = 9, bw = L / nb;
    for (const y of [hT / 2, -hT / 2]) k.add(new THREE.BoxGeometry(L, 1.0, 2.4), 'tower', xf([L / 2, y, 0]));
    for (let j = 0; j <= nb; j++) k.add(new THREE.BoxGeometry(0.6, hT, 0.6), 'tower', xf([j * bw, 0, 0]));
    for (let j = 0; j < nb; j++) k.add(new THREE.BoxGeometry(Math.hypot(bw, hT), 0.45, 0.45), 'tower', xf([j * bw + bw / 2, 0, 0], [0, 0, (j % 2 ? 1 : -1) * Math.atan2(hT, bw)]));
    if (k.hi) { k.add(new THREE.BoxGeometry(34, 0.5, 2.0), 'dark', xf([20, hT / 2 + 0.7, 0])); k.add(new THREE.BoxGeometry(3, 1.2, 2.4), 'paint:0,0', xf([30, hT / 2 + 1.2, -s2 * 0.4])); } // catch rail + catch block
    k.pop(); }
  k.pop();
  // ship quick-disconnect arm
  k.add(new THREE.BoxGeometry(14, 2.2, 2.2), 'tower', xf([TX + W / 2 + 7, 120, 3]));
  // orbital launch mount: ring table on six legs
  const mY = 20; k.add(new THREE.TorusGeometry(6.2, 1.2, 8, 40), 'steel', xf([0, mY, 0], [PI / 2, 0, 0])); tube(k, 7.8, 7.8, 2.6, mY - 1.3, 'steel', { open: true });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 2 * PI + PI / 6; k.add(new THREE.BoxGeometry(2.2, mY, 2.2), 'concrete', xf([Math.cos(a) * 8.5, mY / 2, Math.sin(a) * 8.5])); }
  if (k.hi) for (let i = 0; i < 20; i++) { const a = i / 20 * 2 * PI; k.add(new THREE.BoxGeometry(0.6, 1.2, 0.6), 'dark', xf([Math.cos(a) * 5.4, mY + 1.0, Math.sin(a) * 5.4])); } // hold-down clamps
  tube(k, 10, 10, 0.3, 0, 'steel', { seg: 32 }); // deluge plate
  const g = k.build('tower'); g.userData.height = H + 18; g.userData.mountY = mY + 1.3; g.userData.catchY = cy; return group('tower', [g], H + 18); }
// ---- payloads ----
function roadster(o) { const k = new Kit(o.detail);
  tube(k, 1.2, 0.9, 0.8, 0, 'dark'); // payload adapter
  tube(k, 0.55, 0.45, 0.6, 0.78, 'dark'); // mount bracket up into the chassis (no floating car)
  k.push(xf([0, 1.25, 0], [0.25, 0.6, 0.1]));
  const body = new THREE.SphereGeometry(1, k.hi ? 32 : 12, k.hi ? 16 : 8); k.add(body, 'red', xf([0, 0.45, 0], [0, 0, 0], [2.0, 0.42, 0.9]));
  k.add(new THREE.BoxGeometry(3.6, 0.35, 1.7), 'red', xf([0, 0.35, 0]));
  k.add(new THREE.BoxGeometry(0.5, 0.4, 1.4), 'glass', xf([0.35, 0.82, 0], [0, 0, -0.9]));
  for (const [x, z] of [[1.25, 0.82], [1.25, -0.82], [-1.2, 0.82], [-1.2, -0.82]]) k.add(new THREE.CylinderGeometry(0.33, 0.33, 0.24, k.hi ? 20 : 8), 'rubber', xf([x, 0.2, z], [PI / 2, 0, 0]));
  // generic suited mannequin in the driver seat
  k.add(new THREE.BoxGeometry(0.42, 0.62, 0.36), 'suit', xf([-0.15, 1.0, 0.32])); k.add(new THREE.SphereGeometry(0.18, 12, 8), 'suit', xf([-0.15, 1.45, 0.32])); k.add(new THREE.SphereGeometry(0.12, 10, 6), 'glass', xf([-0.02, 1.47, 0.32]));
  k.add(new THREE.BoxGeometry(0.5, 0.12, 0.12), 'suit', xf([0.15, 1.05, 0.5], [0, 0, -0.4]));
  k.pop(); return group('roadster', [k.build('payload')], 3.2); }
function satStack(o) { const k = new Kit(o.detail), n = o.count || 20, h = 0.19;
  tube(k, 1.2, 0.9, 0.8, 0, 'dark');
  for (let i = 0; i < n; i++) { const y = 0.9 + i * (h + 0.04), j = (i % 2 ? 0.04 : -0.04);
    k.add(new THREE.BoxGeometry(2.8, h, 1.4), 'grey', xf([j, y + h / 2, 0])); if (k.hi) { k.add(new THREE.BoxGeometry(2.7, 0.02, 1.3), 'solar', xf([j, y + h + 0.011, 0])); k.add(new THREE.BoxGeometry(0.4, h * 0.8, 0.6), 'gold', xf([j - 1.2, y + h / 2, 0.45])); } }
  for (const [x, z] of [[1.25, 0.6], [-1.25, 0.6], [1.25, -0.6], [-1.25, -0.6]]) tube(k, 0.05, 0.05, n * (h + 0.04) + 0.3, 0.8, 'dark', { x, z, seg: 6 });
  return group('satstack', [k.build('payload')], 0.9 + n * (h + 0.04)); }
// ids match vehicles/catalog.js (gamebot-specs/vehicles); display names come from vehicles/brand.js, never from here.
// Dimensions: specs/*.md (Vehicle Specs Bot). est: values that are ESTIMATE in the sheet or art-only guesses.
export const VEHICLES = {
  'sparrow-1': { height: 21.3, build: sparrow, src: 'specs/sparrow.md: 21.3 m, 1.7 m dia' },
  'heron-9': { height: 70, build: heron, src: 'specs/heron.md: 70 m, 3.7 m, S1 41.2 m (47.7 w/ interstage), fairing 5.2 x 13 m' },
  'heron-9-v11': { height: 68.4, build: o => heron({ ...o, v11: true }), src: 'specs/heron.md (v1.1)', est: ['height (art)'] },
  'heron-9-crew': { height: 65.7, build: o => heron({ ...o, crew: true }), src: 'specs sheet (heron-9-crew, capsule-2): 65.7 m, capsule 4 m dia, 8.1 m with trunk' },
  'heron-heavy': { height: 70, build: heronHeavy, src: 'specs sheet (heron-heavy): 70 m, 12.2 m wide' },
  'colossus-v3': { height: 124.4, build: o => colossus({ ...o, boosterH: 72.3, shipH: 52.1, gridFins: 3 }), src: 'specs sheet (colossus) Block 3: booster 72.3 m, ship 52.1 m (ESTIMATE), 9 m', est: ['shipH'] },
  'colossus-v4': { height: 142, build: o => colossus({ ...o, boosterH: 81, shipH: 61, gridFins: 3 }), src: 'specs sheet (colossus) Block 4 (planned): 81 m + 61 m', est: ['planned vehicle'] },
  'catch-tower': { height: 164, build: catchTower, src: 'public ~146 m tower (art estimate)', est: ['all'] },
  'payload-roadster': { height: 3.2, build: roadster, src: 'generic roadster-style car (art)', est: ['all'] },
  ...CO_NOSA, ...CO_ORIGINALS,
  'payload-flatsat-stack': { height: 5.6, build: satStack, src: 'specs sheet flatsat-style flat-pack stack (art)', est: ['plate size'] },
};
// detail: 'hi' | 'mid' (phones: hi features, fewer segments; titan ~15k) | 'lo'. lo (and heron-heavy hi) are merged per material.
export function build(id, o = {}) { const V = VEHICLES[id]; const det = o.detail || 'hi'; const g = V.build({ ...o, detail: det }); g.userData.id = id; g.userData.detail = det;
  if (det === 'lo' || det === 'mid' || id === 'heron-heavy') compactStages(g, ['legs'], det !== 'hi' || id === 'heron-heavy');
  else if (/^heron-9|^selene$/.test(id)) compactStages(g, ['legs'], true); // rockets-3: heron-9 hi merged per material per stage (was 40-41 meshes)
  shareGeometries(g); // merged per material inside each stage; stages + legs stay separate
  let tris = 0; g.traverse(m => { if (m.isMesh) tris += m.geometry.attributes.position.count / 3; }); g.userData.tris = tris; return g; }
// hi until the vehicle spans < ~1/6 of the view at 55° FOV, then lo (no lattice/decals/powerheads)
// o.phone: the near level uses 'mid' (titan ~11k instead of ~53k tris)
export function buildLOD(id, o = {}) { const lod = new THREE.LOD(), hi = build(id, { ...o, detail: o.phone ? 'mid' : 'hi' }), lo = build(id, { ...o, detail: 'lo' }), h = VEHICLES[id].height;
  lod.addLevel(hi, 0); lod.addLevel(lo, Math.max(60, h * 6)); lod.userData = { ...hi.userData, hi, lo }; lod.name = id; return lod; }
// prewarm(ids, o): build LODs off the critical path (one per idle slice) so titan hi (58-70 ms on the main thread,
// Playtest QA rockets-2) is never built mid-flight. Returns a Map id -> Promise<LOD>; take() hands one out.
const WARM = new Map();
export function prewarm(ids, o = {}) { const idle = globalThis.requestIdleCallback || (f => setTimeout(f, 16)); let chain = Promise.resolve();
  for (const id of ids) if (!WARM.has(id + (o.phone ? ':p' : ''))) { const p = chain = chain.then(() => new Promise(r => idle(() => r(buildLOD(id, o))))); WARM.set(id + (o.phone ? ':p' : ''), p); }
  return WARM; }
export async function takeWarm(id, o = {}) { const k = id + (o.phone ? ':p' : ''), p = WARM.get(k); WARM.delete(k); return p ? p : buildLOD(id, o); }
