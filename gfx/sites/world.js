// world-pop-1: dressing around the launch sites (pure layout -> kit parts). Adds three merged-mesh parts to gfx/sites/kit.js:
//   scatter  trees / scrub / boulders around a site, kept off the pad, trench, roads, buildings and water (2 draw calls: flora, boulder)
//   hills    a far ring of low rolling hills or volcanic islets (1 draw call: hill), kept on land for coastal sites
//   lot      a small parking lot with parked vans (reuses asphalt / white / clad / dark: no extra draw call)
// Scatter is deterministic (seeded) and LOD'd by count: hi = full, mid (phone near) = ~1/4, lo = none (hills only, coarse).
// Trunks, rocks and hill skirts reach 2.5 m below y = 0 so they meet the game's ground tile (main.js PAD_SINK 2 m) without floating.
// Photo textures (CC0, assets/world/*.webp, see CREDITS.md) replace the procedural canvas maps in the browser only (node tests: none).
import * as THREE from 'three/webgpu';
import { landTest, keepOut } from './worldmask.js?v=f5.9-23';
export { landTest, keepOut };
const ER = 6378137, SINK = 2.5;
function rnd(seed) { let x = (seed >>> 0) || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
// ---------- photo textures (browser only) ----------
const PHOTO = { ground: ['grass', 0.25, 0xe2e8c4], sand: ['sand', 0.4, 0xf2ead8], concrete: ['concrete', 0.5, 0xe4e1da], apron: ['gravel', 0.6, 0xd8d4cc], boulder: ['rock', 0.5, 0xb8b2a8], hill: ['grass', 0.02, 0xc4cca8] };
const PT = new Map(), PEND = []; let loader = null;
export const photosReady = () => Promise.all(PEND); // viewer: wait for the photo maps before the hero shot
function photoTex(name, rep, srgb) { const key = name + (srgb ? ':c' : ':n') + rep; if (PT.has(key)) return PT.get(key); if (typeof document === 'undefined') return null;
  loader ||= new THREE.TextureLoader(); let done; PEND.push(new Promise(r => (done = r))); const t = loader.load(new URL(`../../assets/world/${name}_${srgb ? 'col' : 'nor'}.webp`, import.meta.url).href, done, undefined, done);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 4; t.userData.cached = true; PT.set(key, t); return t; }
// called by kit.js smat(): returns the photo-map overrides for material key k (or null)
export function photoMaps(k) { const p = PHOTO[k]; if (!p) return null; const map = photoTex(p[0], p[1], true); if (!map) return null;
  return { map, normalMap: photoTex(p[0], p[1], false), normalScale: new THREE.Vector2(0.6, 0.6), color: p[2] }; }
export const WORLD_MDEF = { flora: [0xffffff, 0.9, 0], boulder: [0xffffff, 0.95, 0], hill: [0xffffff, 1, 0] };
// ---------- vertex tint (kit SK.add bakes AO into the colour attribute; multiply our tint into the last added geometry) ----------
function tinted(K, geo, k, m, rgb) { K.add(geo, k, m); const g = K.b.get(k).at(-1), c = g.attributes.color.array; for (let i = 0; i < c.length; i += 3) { c[i] *= rgb[0]; c[i + 1] *= rgb[1]; c[i + 2] *= rgb[2]; } }
const hex = (h, j = 0, a = Math.random) => { const f = 1 + (a() - 0.5) * j; return [((h >> 16) & 255) / 255 * f, ((h >> 8) & 255) / 255 * f, (h & 255) / 255 * f]; };
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const M = (p, ry = 0, s = [1, 1, 1], rx = 0, rz = 0) => { _e.set(rx, ry, rz); return new THREE.Matrix4().compose(_v.set(...p), _q.setFromEuler(_e), _s.set(...s)); };
// ---------- plant / rock models (flat-shaded low poly, one 'flora' material, colour by vertex; world-pop-2: crowns open-ended, rocks icosahedra = fewer tris per plant) ----------
const PLANTS = {
  pine(K, x, z, s, a) { const h = (16 + 10 * a()) * s, seg = K.hi ? 6 : 4; // slash pine: tall bare trunk, flat high crown
    tinted(K, new THREE.CylinderGeometry(0.25 * s, 0.4 * s, h + SINK, 3, 1, true), 'flora', M([x, (h - SINK) / 2, z]), hex(0x5a4330, 0.2, a));
    tinted(K, new THREE.ConeGeometry(4.2 * s, 6 * s, seg, 1, true), 'flora', M([x, h, z], a() * 6), hex(0x3f5a2c, 0.25, a));
    if (K.hi) tinted(K, new THREE.ConeGeometry(3 * s, 4.5 * s, seg, 1, true), 'flora', M([x + 0.4, h + 2.6 * s, z], a() * 6), hex(0x4a6a33, 0.25, a)); },
  palm(K, x, z, s, a) { const h = (7 + 5 * a()) * s, lean = (a() - 0.5) * 0.35, ry = a() * 6; // cabbage / coconut palm: thin leaning trunk, drooping star crown
    tinted(K, new THREE.CylinderGeometry(0.22 * s, 0.32 * s, h + SINK, 3, 1, true), 'flora', M([x, (h - SINK) / 2, z], ry, [1, 1, 1], lean), hex(0x7a6650, 0.2, a));
    const top = [x, h * Math.cos(lean), z + h * Math.sin(lean)], c = K.hi ? new THREE.IcosahedronGeometry(1, 0) : new THREE.OctahedronGeometry(1, 0);
    tinted(K, c, 'flora', M(top, ry, [4.2 * s, 1.5 * s, 4.2 * s], (a() - 0.5) * 0.4), hex(0x3d6b2a, 0.25, a)); }, // fronds: a flattened spiky star
  scrub(K, x, z, s, a) { const g = K.hi ? new THREE.IcosahedronGeometry(1.6 * s, 0) : new THREE.OctahedronGeometry(1.6 * s, 0); // saw palmetto / beach scrub
    tinted(K, g, 'flora', M([x, 0.35 * s, z], a() * 6, [1.3 + 0.5 * a(), 0.55 + 0.3 * a(), 1.2 + 0.4 * a()]), hex([0x58693a, 0x6b7340, 0x4c6236, 0x7d7a48][(a() * 4) | 0], 0.25, a)); },
  grass(K, x, z, s, a) { const g = new THREE.ConeGeometry(0.9 * s, 1.4 * s, 3, 1, true); tinted(K, g, 'flora', M([x, 0.5 * s, z], a() * 6), hex(0x9a9558, 0.3, a)); }, // dune grass tuft
  rock(K, x, z, s, a) { const g = K.hi ? new THREE.IcosahedronGeometry(1.2 * s, 0) : new THREE.OctahedronGeometry(1.2 * s, 0);
    tinted(K, g, 'boulder', M([x, 0.35 * s - 0.6, z], a() * 6, [1 + 0.6 * a(), 0.6 + 0.5 * a(), 1 + 0.5 * a()], (a() - 0.5) * 0.5, (a() - 0.5) * 0.5), hex(0xd8d2c6, 0.3, a)); },
};
// scatter: o = { at, seed, r0, r1, mix: { pine: n, palm: n, scrub: n, grass: n, rock: n }, shore: n (boulders along the coast / island rim) }
// counts are the hi tier; mid keeps o.mid (default 0.25) of each, lo none
function scatter(K, o, S) { if (K.lo) return; const a = rnd(hash(S.id + (o.seed || ''))), land = landTest(S), free = keepOut(S), f = K.hi ? 1 : (o.mid ?? 0.25);
  const r0 = o.r0 || 60, r1 = o.r1 || 900, ok = (x, z, m) => land(x, z, m) && free(x, z, m);
  const groves = []; for (let i = 0, t = 0; groves.length < (o.groves || 36) && t < 4000; t++) { const q = a() * Math.PI * 2, r = Math.sqrt(r0 * r0 + a() * (r1 * r1 - r0 * r0)), x = Math.cos(q) * r, z = Math.sin(q) * r; if (ok(x, z, 20)) groves.push([x, z, 25 + 45 * a()]); }
  const gauss = () => (a() + a() + a() - 1.5) * 1.4;
  for (const [kind, n0] of Object.entries(o.mix || {})) { const n = Math.round(n0 * f), tree = kind === 'pine' || kind === 'palm', cl = tree ? 0.85 : 0.6; let placed = 0, tries = 0;
    while (placed < n && tries++ < n * 40) { // most plants grow in groves (and scrub around their edges), the rest anywhere on free land
      let x, z; if (groves.length && a() < cl) { const [gx, gz, gr] = groves[(a() * groves.length) | 0], k = tree ? 1 : 1.8; x = gx + gauss() * gr * k; z = gz + gauss() * gr * k; } else { const t = a() * Math.PI * 2, r = Math.sqrt(r0 * r0 + a() * (r1 * r1 - r0 * r0)); x = Math.cos(t) * r; z = Math.sin(t) * r; }
      if (Math.hypot(x, z) < r0 || Math.hypot(x, z) > r1 || !ok(x, z, kind === 'pine' ? 4 : 2)) continue;
      PLANTS[kind](K, x, z, 0.8 + 0.6 * a(), a); placed++; } }
  if (o.shore) { const n = Math.round(o.shore * f); let placed = 0, tries = 0; // boulders strung along the shoreline (just inside the land edge)
    while (placed < n && tries++ < n * 60) { const t = a() * Math.PI * 2, r = r0 + a() * (r1 - r0), x = Math.cos(t) * r, z = Math.sin(t) * r;
      if (!land(x, z, 0) || land(x, z, 45) || !free(x, z, 2)) continue; PLANTS.rock(K, x, z, 1.2 + 1.8 * a(), a); placed++; } } }
// hills: o = { r0, r1, h, seg, from, to (bearing range, radians, 0 = east, pi/2 = south), islets: n }
function hills(K, o, S) { const a = rnd(hash(S.id + 'hills')), land = landTest(S);
  const na = K.hi ? (o.seg || 64) : K.lo ? 20 : 32, nr = K.hi ? 6 : K.lo ? 3 : 4, r0 = o.r0 || 5000, r1 = o.r1 || 9000, H = o.h || 120;
  const ph = [a() * 6, a() * 6, a() * 6], from = o.from ?? 0, to = o.to ?? Math.PI * 2;
  if (o.islets) { for (let i = 0; i < o.islets; i++) { const t = from + (to - from) * a(), r = r0 + (r1 - r0) * a(), x = Math.cos(t) * r, z = Math.sin(t) * r, h = H * (0.4 + 0.6 * a()), w = h * (3 + 3 * a());
      const ex = SINK * 4 + r * r / (2 * ER), Ht = h + ex, g = new THREE.ConeGeometry(w, Ht, K.lo ? 6 : K.hi ? 12 : 8, K.lo ? 1 : 2), p = g.attributes.position;
      for (let j = 0; j < p.count; j++) if (p.getY(j) > -Ht / 2 + 0.1 && p.getY(j) < Ht / 2 - 0.1) { const f = 0.8 + 0.4 * a(); p.setX(j, p.getX(j) * f); p.setZ(j, p.getZ(j) * f); } // only the middle ring wobbles (the cone stays watertight)
      tinted(K, g, 'hill', M([x, h - r * r / (2 * ER) - Ht / 2, z], a() * 6), hex(0x6f8a52, 0.2, a)); } return; }
  // a ring band, radial rows r0..r1, crest in the middle; heights = summed sines (rolling ridges), zero where the ground is sea
  const P = [], C = []; const ht = (t, r) => { const u = (r - r0) / (r1 - r0), env = Math.sin(Math.PI * Math.min(1, Math.max(0, u))) ** 0.8;
    const n = 0.55 + 0.25 * Math.sin(t * 7 + ph[0]) + 0.15 * Math.sin(t * 17 + ph[1] + u * 3) + 0.1 * Math.sin(t * 31 + ph[2]); const x = Math.cos(t) * r, z = Math.sin(t) * r;
    return (land(x, z, 600) ? 1 : 0) * H * env * n; };
  for (let i = 0; i < na; i++) for (let j = 0; j < nr; j++) { const t0 = from + (to - from) * i / na, t1 = from + (to - from) * (i + 1) / na, q0 = r0 + (r1 - r0) * j / nr, q1 = r0 + (r1 - r0) * (j + 1) / nr;
    const v = (t, r) => { const h = ht(t, r); return [Math.cos(t) * r, h - SINK - r * r / (2 * ER) - (h > 1 ? 0 : 4), Math.sin(t) * r, h]; }, A = v(t0, q0), B = v(t1, q0), Cc = v(t1, q1), Dd = v(t0, q1);
    if (A[3] + B[3] + Cc[3] + Dd[3] < 2) continue; for (const w of [A, Dd, Cc, A, Cc, B]) { P.push(w[0], w[1], w[2]); const k = Math.min(1, w[3] / H); C.push(0.75 + 0.15 * k, 0.8 + 0.1 * k, 0.65 + 0.2 * k); } } // brown-green foot, greener crest
  if (!P.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals();
  K.add(g, 'hill'); const gg = K.b.get('hill').at(-1), c = gg.attributes.color.array; for (let i = 0; i < c.length; i++) c[i] *= C[i]; }
// parking lot with parked vans (support-area clutter)
function lot(K, o, S) { const w = o.w || 40, d = o.d || 24, a = rnd(hash(S.id + 'lot' + (o.at || []).join()));
  K.flat('asphalt', w, d, [0, 0, 0], 0, 0.03); if (K.lo) return; const nx = Math.floor(w / 4);
  for (const row of [-1, 1]) for (let i = 0; i < nx; i++) { const x = -w / 2 + 2 + i * 4; if (K.hi) K.flat('white', 0.15, 5, [x - 2, 0, row * (d / 2 - 3)], 0, 0.06);
    if (a() < (o.fill ?? 0.6)) { const k = ['white', 'clad', 'band', 'red'][(a() * 4) | 0]; K.box(k, 2, 1.6, 4.6, [x, 0, row * (d / 2 - 3)]); if (K.hi) K.box('glass', 1.9, 0.7, 2, [x, 1.6, row * (d / 2 - 3) - row * 0.4]); } } }
// world-pop-2: belts = dense, clumped tree lines and scrub hedges along the roads, the pad perimeter and the coast.
// o = { seed, road: clumps per 100 m of road (each side), perimeter: clumps on a ring at o.ring m, coast: clumps along the shore band,
//       kinds: { tree: 'pine'|'palm', under: 'scrub'|'grass' }, mid (phone share, default 0.25) }. Same land / keep-out rules as scatter.
// Each clump = 1..4 trees of one size class + an under-storey of 2..5 shrubs, tinted together (a clump shares a hue shift).
const TINTS = [[1, 1, 1], [0.86, 0.95, 0.8], [1.12, 1.06, 0.82], [0.78, 0.86, 0.72], [1.05, 1.1, 0.9], [1.2, 1.02, 0.7]]; // base, dark, olive-dry, deep, fresh, sun-scorched
function clump(K, x, z, a, o, ok, treeShare) { const tint = TINTS[(a() * TINTS.length) | 0], sz = 0.6 + 1.1 * a() ** 1.5, tree = o.kinds?.tree || 'pine', under = o.kinds?.under || 'scrub';
  const nt = a() < treeShare ? 1 + ((a() * 4) | 0) : 0, nu = 2 + ((a() * 4) | 0), put = (kind, px, pz, s) => { if (!ok(px, pz, kind === 'pine' ? 3 : 1.5)) return; const n0 = K.b.get('flora')?.length || 0; PLANTS[kind](K, px, pz, s, a);
    for (const g of (K.b.get('flora') || []).slice(n0)) { const c = g.attributes.color.array; for (let i = 0; i < c.length; i += 3) { c[i] *= tint[0]; c[i + 1] *= tint[1]; c[i + 2] *= tint[2]; } } };
  for (let i = 0; i < nt; i++) put(tree, x + (a() - 0.5) * 14 * sz, z + (a() - 0.5) * 14 * sz, sz * (0.8 + 0.4 * a()));
  for (let i = 0; i < nu; i++) put(under, x + (a() - 0.5) * 18, z + (a() - 0.5) * 18, (0.6 + 0.8 * a()) * (nt ? 1 : 1.3)); }
function belts(K, o, S) { if (K.lo) return; const a = rnd(hash(S.id + 'belts' + (o.seed || ''))), land = landTest(S), free = keepOut(S), f = K.hi ? 1 : (o.mid ?? 0.25), ok = (x, z, m) => land(x, z, m) && free(x, z, m);
  const per = n => Math.max(0, Math.round(n * f)), ts = o.trees ?? 0.6;
  if (o.road) for (const r of S.layout.filter(q => q.k === 'road')) for (let i = 1; i < r.pts.length; i++) { const [x0, z0] = r.pts[i - 1], [x1, z1] = r.pts[i], L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (const side of [-1, 1]) { const n = per(o.road * L / 100); for (let j = 0; j < n; j++) { const t = (j + a()) / n, off = (r.w || 10) / 2 + 18 + 22 * a(); clump(K, x0 + ux * L * t - uz * off * side, z0 + uz * L * t + ux * off * side, a, o, ok, ts); } } }
  if (o.perimeter) { const n = per(o.perimeter), R = o.ring || 200; for (let j = 0; j < n; j++) { const t = (j + a() * 0.6) / n * Math.PI * 2, r = R + (a() - 0.5) * 30; clump(K, Math.cos(t) * r, Math.sin(t) * r, a, o, ok, ts * 0.6); } }
  if (o.coast) { const n = per(o.coast), r1 = o.r1 || 1500; let placed = 0, tries = 0; // shore band: on land, within ~120 m of the waterline
    while (placed < n && tries++ < n * 200) { const t = a() * Math.PI * 2, r = Math.sqrt(a()) * r1, x = Math.cos(t) * r, z = Math.sin(t) * r; if (!land(x, z, 15) || land(x, z, 120)) continue;
      clump(K, x, z, a, { kinds: o.coastKinds || { tree: 'palm', under: 'grass' } }, ok, ts * 0.5); placed++; } } }
export const WORLD_PARTS = { scatter, hills, lot, belts };
