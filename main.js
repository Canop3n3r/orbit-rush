import * as THREE from 'three/webgpu';
import * as P from './physics.js?v=ss1';
import { Flight, PRESETS, planBuild, assessDesign, SIM_SPEED, WARPS, shipPos, chuteLimits, SAFE_TOUCHDOWN, launchAzimuth, fmtDur } from './flight.js?v=ss1';
import * as C from './physics/patched.js?v=ss1';
import { createSolarMap } from './solarmap.js?v=ss1';
import { PARTS, TEMPLATES, ORBIT_DV, TANK_DRY, splitStages, designStats, validate, cloneDesign, insertPart, removePart, movePart, setEngines, swapStages, partMass, buildVehicle, aeroBalance } from './parts.js?v=ss1';
import { FX } from './fx.js?v=ss1';
import { createAcademy } from './academy-ui.js?v=ss1';
import { createMobile, isTouch } from './mobile.js?v=ss1';
import { localize } from './wording.js?v=ss1';
const TOUCH = isTouch();
import { QUALITY, QUALITY_ORDER, plumeShape, skinGlow } from './fxmap.js?v=ss1';
// Orbit Rush renderer + UI. All physics lives in physics/* (full-scale Earth, 6-DOF); this file only draws it.
// Rendering is camera-relative ("floating origin"): every frame the focused craft sits at the scene origin and
// everything else (the rotating Earth, pad, droneship, debris) is placed at (its ECI position − focus) computed
// in float64, so full-scale coordinates (6.4e6 m) never reach the GPU as large float32 numbers near the camera.
const { R, ATM, V } = P;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
export const BUILD = '2026-10-19-ss1';
const DEG = 180 / Math.PI;

// ---------- renderer: WebGPU first, WebGL2 fallback with a stated reason ----------
let gpuReason = '';
if (params.has('webgl')) gpuReason = 'forced by ?webgl';
else if (!('gpu' in navigator)) gpuReason = window.isSecureContext ? 'this browser has no WebGPU (navigator.gpu missing)' : 'not a secure (https) context';
else {
  try { const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!ad) gpuReason = 'no WebGPU adapter (GPU/driver blocklisted)'; }
  catch (e) { gpuReason = 'requestAdapter failed: ' + e.message; }
}
const renderer = new THREE.WebGPURenderer({ antialias: true, logarithmicDepthBuffer: true, forceWebGL: !!gpuReason, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
await renderer.init();
const isGPU = !!renderer.backend.isWebGPUBackend;
if (!isGPU && !gpuReason) gpuReason = 'WebGPU init failed; three.js fell back';
if (isGPU) { $('badge').textContent = '⚡ WebGPU'; $('badge').classList.add('gpu'); console.info('[Orbit Rush] Renderer: WebGPU'); }
else { $('badge').textContent = 'WebGL2 ⓘ'; $('badge').title = 'WebGPU unavailable: ' + gpuReason; console.warn('[Orbit Rush] Using WebGL2 fallback — reason:', gpuReason); }
$('badge').onclick = () => toast(isGPU ? 'Rendering with WebGPU' : 'WebGL2 fallback: ' + gpuReason, '#9cc3ff');
if (renderer.backend.device) renderer.backend.device.lost.then(i => console.warn('[Orbit Rush] WebGPU device lost:', i.message));
// ---------- effects (fx.js): GPU compute particles on WebGPU, CPU-integrated particles on WebGL2 ----------
const FXQ_KEY = 'orbitrush.fxq';
let fxQuality = (() => { const q = params.get('fx') || localStorage.getItem(FXQ_KEY); return QUALITY[q] ? q : TOUCH ? 'med' : 'high'; })(), fxAuto = 0;
const fxLocked = QUALITY[params.get('fx')] !== undefined; // ?fx=high|med|low pins the quality (no auto-lowering)
const fxGPU = params.has('fxgpu') || (isGPU && !params.has('fxcpu'));
const fx = new FX({ gpu: fxGPU, quality: fxQuality });
console.info('[Orbit Rush] Effects:', fxGPU ? 'GPU compute particles' : 'CPU particles (WebGL2 path)', '· quality', fxQuality);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ab8ff);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 3e8);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x334433, 1.0); scene.add(hemi);
const sunL = new THREE.DirectionalLight(0xffffff, 2.4); sunL.position.set(0.9, 0.35, 0.3); scene.add(sunL);


// ---------- launch complex (lattice tower, swing arm, mast, tanks) ----------
const steel = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.55, metalness: 0.7 });
let swingArm;
function buildLaunchComplex() {
  const g = new THREE.Group();
  const conc = new THREE.Mesh(new THREE.CylinderGeometry(32, 36, 4, 40), new THREE.MeshStandardMaterial({ color: 0x8d8d89, roughness: 0.95 })); conc.position.y = PAD_Z - 2; g.add(conc);
  const trench = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 40), new THREE.MeshStandardMaterial({ color: 0x1b1b1b })); trench.position.set(0, PAD_Z + 0.02, 18); g.add(trench);
  // lattice tower: 4 legs + instanced braces (one draw call)
  const TX = -10, W = 7, H = 84, lv = 4, nL = Math.floor(H / lv);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.7), steel); l.position.set(TX + dx * W / 2, H / 2, dz * W / 2); g.add(l); }
  const brace = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.28, 0.28), steel, nL * 8); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let k = 0; const diag = Math.hypot(W, lv), da = Math.atan2(lv, W);
  for (let i = 0; i < nL; i++) for (let f = 0; f < 4; f++) {
    const ry = f * Math.PI / 2, cx = Math.sin(ry) * W / 2, cz = Math.cos(ry) * W / 2;
    ps.set(TX + cx, i * lv + lv, cz); e.set(0, ry + Math.PI / 2, 0); q.setFromEuler(e); sc.set(W, 1, 1); brace.setMatrixAt(k++, m.compose(ps, q, sc));
    ps.set(TX + cx, i * lv + lv / 2, cz); e.set(0, ry + Math.PI / 2, (i % 2 ? 1 : -1) * da, 'YXZ'); q.setFromEuler(e); sc.set(diag, 1, 1); brace.setMatrixAt(k++, m.compose(ps, q, sc));
  }
  g.add(brace);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 22, 8), steel); mast.position.set(TX, H + 11, 0); g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3020 })); beacon.position.set(TX, H + 22, 0); g.add(beacon);
  // crew access / swing arm pivoting at the tower
  swingArm = new THREE.Group(); swingArm.position.set(TX + W / 2, 46, 0);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(6.2, 2.4, 2.2), steel); walk.position.x = 3.1; swingArm.add(walk);
  const room = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xeeeeee })); room.position.x = 5.6; swingArm.add(room);
  g.add(swingArm);
  // hold-down clamps
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78, c = new THREE.Mesh(new THREE.BoxGeometry(1, 2.2, 1), steel); c.position.set(Math.cos(a) * 2.6, PAD_Z + 1.1, Math.sin(a) * 2.6); g.add(c); }
  // water tower + LOX sphere + floodlights
  const wt = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 12, 24), new THREE.MeshStandardMaterial({ color: 0xd8d8d0 })); wt.position.set(-90, 52, -70); g.add(wt);
  for (const [dx, dz] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 46), steel); l.position.set(-90 + dx, 23, -70 + dz); g.add(l); }
  const lox = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 })); lox.position.set(80, 11, -60); g.add(lox);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 30, 6), steel); l.position.set(Math.cos(a) * 45, 15, Math.sin(a) * 45); g.add(l); }  return g;
}

// ---------- procedural noise ----------
function hash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v), L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}
function fbm(x, y, z) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 4; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.1; amp *= 0.5; } return a; }
function starTexture() {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 3000; i++) { const b = Math.random() ** 3; c.fillStyle = `rgba(${200 + 55 * Math.random()},${210 + 45 * Math.random()},255,${0.3 + b * 0.7})`; const s = b > 0.9 ? 2 : 1; c.fillRect(Math.random() * 2048, Math.random() * 1024, s, s); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}// ---------- planet colours (shared by the globe texture and the high-res ground tile) ----------
const PAD_EF = [1, 0, 0], PAD_Z = 0.4, DECK = 3;
function planetColor(d, out, fine) { // d: Earth-fixed unit vector → [r,g,b] 0..255
  let n = fbm(d[0] * 2.2 + 5, d[1] * 2.2, d[2] * 2.2);
  if (d[0] > 0.9) { // around the launch site: land to the west, open ocean downrange (boosters land at sea)
    const east = Math.atan2(d[1], d[0]) * R, coast = 12000 + 6000 * (fbm(d[2] * 3000, d[1] * 300, 1) - 0.5) * 2;
    const w = Math.min(1, Math.max(0, (0.2 - Math.abs(d[2])) / 0.06)) * Math.min(1, Math.max(0, (1.6e6 - east) / 3e5)) * Math.min(1, Math.max(0, (east + 2.5e5) / 1.5e5));
    const tgt = east > coast ? Math.min(n, 0.42) : east > -80000 ? Math.max(n, 0.58) : n;
    n = n + (tgt - n) * w;
  }
  const f = fine ? fbm(d[0] * 900, d[1] * 900, d[2] * 900) : 0.5;
  if (n > 0.52) { const t = (n - 0.52) * 4; out[0] = 55 + t * 110 + f * 30; out[1] = 100 + t * 60 + f * 25; out[2] = 45 + t * 40; if (n > 0.66) out[0] = out[1] = out[2] = 150 + t * 40; }
  else { const t = n / 0.52; out[0] = 10 + t * 20; out[1] = 40 + t * 60; out[2] = 90 + t * 80; }
  return out;
}
function planetTexture() {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), c = [0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const th = Math.PI * (j + 0.5) / H, ph = 2 * Math.PI * (i + 0.5) / W; // SphereGeometry UVs, after rotateX(+90°)
    planetColor([-Math.cos(ph) * Math.sin(th), -Math.sin(ph) * Math.sin(th), Math.cos(th)], c);
    const o = (j * W + i) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function cloudTexture() {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const th = Math.PI * (j + 0.5) / H, ph = 2 * Math.PI * (i + 0.5) / W, x = -Math.cos(ph) * Math.sin(th), y = -Math.sin(ph) * Math.sin(th), z = Math.cos(th);
    const cl = fbm(x * 5 + 9, y * 5, z * 5), pd = Math.acos(Math.max(-1, Math.min(1, x))) * R, a = Math.max(0, Math.min(1, (cl - 0.56) * 5)) * Math.min(1, Math.max(0.15, (pd - 2e5) / 3e5)); // clear skies over the launch site
    const o = (j * W + i) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = 255; img.data[o + 3] = a * 230;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- world: an Earth group in Earth-fixed coordinates, rotated by ω·t and offset by −focus ----------
const earth = new THREE.Group(); scene.add(earth);
const planetGeo = new THREE.SphereGeometry(R - 600, 384, 192); planetGeo.rotateX(Math.PI / 2);
const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 0.9 }));
earth.add(planet);
const cloudGeo = new THREE.SphereGeometry(R + 7000, 192, 96); cloudGeo.rotateX(Math.PI / 2);
const clouds = new THREE.Mesh(cloudGeo, new THREE.MeshStandardMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, roughness: 1, side: THREE.DoubleSide }));
earth.add(clouds);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R + ATM, 128, 64), new THREE.MeshBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false }));
earth.add(atmo);
const stars = new THREE.Mesh(new THREE.SphereGeometry(1e8, 32, 16), new THREE.MeshBasicMaterial({ map: starTexture(), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(stars);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
// Put a local (y-up) object on the surface at Earth-fixed direction ef, `lift` metres up. Its local +Z points east.
function onSurface(obj, ef, lift = 0) {
  const f = P.surfaceFrame(ef), q = f.q; // right-handed local frame (the old basis was mirrored: pad on its side)
  obj.quaternion.set(q[1], q[2], q[3], q[0]);
  obj.position.set(f.up[0], f.up[1], f.up[2]).multiplyScalar(R + lift); if (!obj.parent) earth.add(obj); return obj;
}
// High-res ground tile: a spherical cap of true radius R around the craft, built in float64 relative to its
// own centre (so its float32 vertices are small) and re-centred as the craft moves.
const TILE_R = 150000, TNR = 56, TNS = 120;
const tileGeo = new THREE.BufferGeometry();
{ const n = TNR * TNS + 1, idx = [];
  tileGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  tileGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  for (let j = 0; j < TNS; j++) idx.push(0, 1 + j, 1 + (j + 1) % TNS);
  for (let i = 0; i < TNR - 1; i++) for (let j = 0; j < TNS; j++) { const a = 1 + i * TNS + j, b = 1 + i * TNS + (j + 1) % TNS, c = a + TNS, d = b + TNS; idx.push(a, c, b, b, c, d); }
  tileGeo.setIndex(idx);
  const nrm = new Float32Array(n * 3); for (let k = 0; k < n; k++) nrm[k * 3 + 1] = 1; tileGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); } // normals exist before the first compile
const tile = new THREE.Mesh(tileGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); tile.frustumCulled = false; earth.add(tile);
let tileC = null;
function updateTile(ef) {
  if (tileC && V.dot(tileC, ef) > Math.cos(25000 / R)) return;
  const c = V.norm(ef), e = P.eastOf(c), nn = V.cross(c, e), pos = tileGeo.attributes.position.array, col = tileGeo.attributes.color.array, rgb = [0, 0, 0];
  tileC = c; tile.position.set(c[0] * R, c[1] * R, c[2] * R);
  const put = (k, th, ph) => {
    const s = Math.sin(th), cm1 = -2 * Math.sin(th / 2) ** 2, dx = Math.cos(ph) * s, dy = Math.sin(ph) * s;
    const off = [c[0] * cm1 + e[0] * dx + nn[0] * dy, c[1] * cm1 + e[1] * dx + nn[1] * dy, c[2] * cm1 + e[2] * dx + nn[2] * dy];
    pos[k * 3] = off[0] * R; pos[k * 3 + 1] = off[1] * R; pos[k * 3 + 2] = off[2] * R;
    planetColor(V.norm(V.add(c, off)), rgb, true); col[k * 3] = (rgb[0] / 255) ** 2.2; col[k * 3 + 1] = (rgb[1] / 255) ** 2.2; col[k * 3 + 2] = (rgb[2] / 255) ** 2.2;
  };
  put(0, 0, 0);
  for (let i = 0; i < TNR; i++) { const th = TILE_R / R * ((i + 1) / TNR) ** 1.8; for (let j = 0; j < TNS; j++) put(1 + i * TNS + j, th, 2 * Math.PI * j / TNS); }
  tileGeo.attributes.position.needsUpdate = true; tileGeo.attributes.color.needsUpdate = true; tileGeo.computeVertexNormals();
}
onSurface(buildLaunchComplex(), PAD_EF, 0);

// ---------- rocket meshes: one THREE.Group per stage, sized from the same part geometry the physics uses ----------
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.45, metalness: 0.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3, metalness: 0.9 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.5, metalness: 0.5 }),
  plume: new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeCore: new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  diamond: new THREE.MeshBasicMaterial({ color: 0xfff2d0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  canopy: new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.8, side: THREE.DoubleSide }),
  canopyW: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.8, side: THREE.DoubleSide }),
  line: new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.7 }),
};
// parts that glow when hot get their own material (emissive driven by the skin temperature, thermal.js)
const hotMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, emissive: 0x000000, ...o });
const PART_COL = { sat: 0xc9a34a, probe: 0xb8c4d6, crew: 0xdddddd };
const cyl = (r0, r1, h, mat, y, g, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.y = y + h / 2; g.add(m); return m; };
function bells(g, n, y, h, r) {
  const re = n === 1 ? 0.7 * r : n <= 4 ? 0.42 * r : 0.3 * r, rr = n === 1 ? 0 : r - re - 0.04;
  cyl(r * 0.92, r * 0.92, h * 0.22, M.black, y + h * 0.78, g);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, e = cyl(re * 0.35, re, h * 0.78, M.engine, y, g, 16); e.position.x = Math.cos(a) * rr; e.position.z = Math.sin(a) * rr; }
  return re;
}
function addFins(g, y, chord, r) {
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.7, chord, 0.14), M.black); const a = i * Math.PI / 2 + Math.PI / 4; f.position.set(Math.cos(a) * (r + 0.85), y, Math.sin(a) * (r + 0.85)); f.rotation.y = -a; g.add(f); }
}
function makePlume(w) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(w, 1, 24, 1, true), M.plume); outer.rotation.x = Math.PI; outer.position.y = -0.5; g.add(outer);
  const core = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, 1, 16, 1, true), M.plumeCore); core.rotation.x = Math.PI; core.position.y = -0.5; g.add(core);
  // shock diamonds (Mach disks) in the core while the jet is near ambient pressure (low altitude)
  const dia = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(w * 0.32, 12, 8), M.diamond); m.scale.y = 0.45; dia.add(m); }
  g.add(dia); g.userData = { dia, w };
  g.visible = false; return g;
}
// Parachute canopies (drogues, mains), drawn downstream of the canister along the airflow.
function makeChutes() {
  const g = new THREE.Group(), dome = (r, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), mat); return m; };
  const dro = new THREE.Group(), main = new THREE.Group();
  for (let i = 0; i < 2; i++) { const m = dome(3.5, M.canopy); m.position.set((i ? 1 : -1) * 3.2, 0, 0); dro.add(m); }
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, m = dome(12.5, i % 2 ? M.canopy : M.canopyW); m.position.set(Math.cos(a) * 11, 0, Math.sin(a) * 11); main.add(m); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3 * 2), 3));
  const lines = new THREE.LineSegments(lg, M.line); lines.frustumCulled = false;
  g.add(dro, main, lines); g.userData = { dro, main, lines }; g.visible = false; return g;
}
function makeRocketGroups(design) {
  const vv = buildVehicle(design), out = [];
  vv.stages.forEach((s, si) => {
    const g = new THREE.Group(); let y = 0, engH = 0, payloadY = null, bellW = 1, nEng = 0, rMax = 1.25; const hot = [];
    for (const [pi, p] of s.parts.entries()) {
      if (p.kind === 'fins' || p.kind === 'fairing') continue;
      const r = p.d / 2; rMax = Math.max(rMax, r);
      if (p.kind === 'shield') { const m = cyl(r * 1.03, r * 1.03, p.h, hotMat(p.id === 'tile' ? 0x26262a : 0x6b4528, { roughness: 0.9, metalness: 0 }), y, g); hot.push({ pi, mat: m.material }); y += p.h; continue; }
      if (p.kind === 'chute') { const m = cyl(r * 0.55, r, p.h, hotMat(0x9aa0a8), y, g); hot.push({ pi, mat: m.material }); y += p.h; continue; }
      if (p.kind === 'engine') { if (y === 0) engH = p.h; bellW = bells(g, p.n || 1, y, p.h, r); nEng += p.n || 1; }
      else if (p.kind === 'tank') { cyl(r, r, p.h, M.white, y, g); cyl(r + 0.02, r + 0.02, Math.min(1.2, p.h * 0.12), M.black, y + p.h - Math.min(1.2, p.h * 0.12), g); }
      else if (p.kind === 'decoupler') cyl(r, r, p.h, M.black, y, g);
      else if (p.kind === 'rcs') { cyl(r, r, p.h, M.grey, y, g); for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), M.black); const a = i * Math.PI / 2; b.position.set(Math.cos(a) * (r + 0.15), y + p.h / 2, Math.sin(a) * (r + 0.15)); g.add(b); } }
      else {
        if (payloadY === null) payloadY = y;
        if (p.id === 'crew') hot.push({ pi, mat: cyl(0.75, r, p.h, hotMat(PART_COL.crew, { roughness: 0.5, metalness: 0.3 }), y, g).material });
        else if (p.id === 'probe') hot.push({ pi, mat: cyl(r * 0.7, r, p.h, hotMat(PART_COL.probe, { metalness: 0.6, roughness: 0.3 }), y, g, 8).material });
        else { const m = new THREE.Mesh(new THREE.BoxGeometry(p.d * 0.75, p.h, p.d * 0.75), new THREE.MeshStandardMaterial({ color: PART_COL[p.id] || PART_COL.sat, metalness: 0.6, roughness: 0.3 })); m.position.y = y + p.h / 2; g.add(m); }
      }
      y += p.h;
    }
    for (const p of s.parts) if (p.kind === 'fins') addFins(g, engH + p.chord / 2, p.chord, rMax);
    let fair = null;
    const fp = s.parts.find(p => p.kind === 'fairing');
    if (fp && si === vv.stages.length - 1) {
      const y0 = payloadY ?? Math.max(0, y - 3), fr = fp.d / 2, cone = 1.6 * fp.d; fair = new THREE.Group();
      cyl(fr, fr, y - y0, M.white, 0, fair); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, fr, cone, 32), M.white); c.position.y = y - y0 + cone / 2; fair.add(c);
      fair.position.y = y0; g.add(fair);
    }
    const plume = makePlume(Math.max(0.8, nEng > 1 ? rMax * 0.95 : bellW * 1.1)); g.add(plume);
    let legs = null;
    if (si === 0) {
      legs = new THREE.Group();
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35), M.black); const a = i * Math.PI / 2 + 0.78; l.position.set(Math.cos(a) * (rMax + 2), 2.2, Math.sin(a) * (rMax + 2)); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); legs.add(l); }
      legs.visible = false; g.add(legs);
    }
    g.userData = { h: y, plume, legs, fair, fairH: fair ? 1.6 * fp.d : 0, hot, stage: si };
    out.push(g);
  });
  return out;
}
// CoM / CoP markers for the hangar preview (drawn through the hull)
const mk = (c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true })); m.renderOrder = 20; return m; };
const comMark = mk(0xffd23a), copMark = mk(0x38e1ff);
const toQ = (q, out = new THREE.Quaternion()) => out.set(q[1], q[2], q[3], q[0]);

// ---------- particles (instanced camera-facing quads; positions in ECI float64, drawn relative to the origin) ----------
const softTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
class Particles {
  constructor(n, additive) {
    this.n = n; this.i = 0; this.d = Array.from({ length: n }, () => ({ life: 0, shown: false }));
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: additive ? 1 : 0.7, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }), n);
    this.mesh.frustumCulled = false; this.c = new THREE.Color(); this.c2 = new THREE.Color(); this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
    for (let i = 0; i < n; i++) { this.mesh.setColorAt(i, this.c.set(0)); this.mesh.setMatrixAt(i, ZERO); }
    scene.add(this.mesh);
  }
  spawn(pos, vel, life, s0, s1, c0, c1, drag) {
    const p = this.d[this.i]; this.i = (this.i + 1) % this.n;
    p.x = pos[0]; p.y = pos[1]; p.z = pos[2]; p.vx = vel[0]; p.vy = vel[1]; p.vz = vel[2]; p.life = life; p.max = life; p.s0 = s0; p.s1 = s1; p.c0 = c0; p.c1 = c1; p.drag = drag;
  }
  clear() { for (const p of this.d) p.life = 0; }
  // Drag pulls each particle toward the local wind (the air turns with the Earth at rate w).
  update(dt, O, q, w) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      const p = this.d[i];
      if (p.life <= 0) { if (p.shown) { p.shown = false; this.mesh.setMatrixAt(i, ZERO); dirty = true; } continue; }
      dirty = true; p.shown = true;
      p.life -= dt; const k = Math.exp(-p.drag * dt), wx = -w * p.y, wy = w * p.x;
      p.vx = wx + (p.vx - wx) * k; p.vy = wy + (p.vy - wy) * k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - Math.max(p.life, 0) / p.max, s = p.s0 + (p.s1 - p.s0) * t;
      const fade = p.c1 === null ? (t > 0.7 ? (1 - t) / 0.3 : 1) : 1;
      this.p.set(p.x - O[0], p.y - O[1], p.z - O[2]); this.s.setScalar(s * fade);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, q, this.s));
      if (p.c1 !== null) { this.c.setHex(p.c0); this.c.lerp(this.c2.setHex(p.c1), t); } else this.c.setHex(p.c0);
      this.mesh.setColorAt(i, this.c);
    }
    if (dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
}
const fire = new Particles(450, true), smoke = new Particles(600, false);
const rnd = s => (Math.random() - 0.5) * s, jit = (a, s) => [a[0] + rnd(s), a[1] + rnd(s), a[2] + rnd(s)];

// ---------- audio ----------
let ac, rumble, rumbleF;
function noiseBuf(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; }
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; } ac = new (window.AudioContext || window.webkitAudioContext)();
  const src = ac.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
  rumbleF = ac.createBiquadFilter(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 300;
  rumble = ac.createGain(); rumble.gain.value = 0; src.connect(rumbleF).connect(rumble).connect(ac.destination); src.start();
}
function burst(vol, dur, freq) {
  if (!ac) return; const s = ac.createBufferSource(); s.buffer = noiseBuf(dur); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f).connect(g).connect(ac.destination); s.start();
}
function beep(f = 880) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.3); }
// ---------- hangar: part-based builder ----------
const LS_KEY = 'orbitrush.designs.v1';
let design = cloneDesign(TEMPLATES[0]), selected = -1;
const TYPE_ORDER = [['pod', 'Command'], ['payload', 'Payload'], ['fairing', 'Payload'], ['tank', 'Fuel tanks'], ['engine', 'Engines'], ['decoupler', 'Structure'], ['fins', 'Structure'], ['rcs', 'Structure'], ['shield', 'Recovery'], ['chute', 'Recovery']];
const TYPE_COL = { pod: '#9cc3ff', payload: '#e0b84a', fairing: '#e8e8e8', tank: '#f2f2f2', engine: '#ff9a3c', decoupler: '#888', fins: '#555', rcs: '#8a9099', shield: '#7a4a2a', chute: '#ff7a3c' };
const partStat = (id, p) => { const d = PARTS[id];
  if (d.type === 'engine') return `${d.tv} kN · Isp ${d.ispSl}/${d.ispVac} s · ${d.m} t`;
  if (d.type === 'tank') return `${d.fuel} t fuel · ${(d.fuel * TANK_DRY).toFixed(1)} t empty`;
  if (d.type === 'shield') return `${d.m} t · max ${d.heat.Tmax.toLocaleString()} K${d.heat.abl ? ' · ablative' : ' · reusable'}`;
  if (d.type === 'chute') return `${d.m} t · drogue + 3 mains`;
  return `${(p ? partMass(p) : d.m).toFixed(1)} t${d.mult ? ' · ×' + d.mult + ' score' : ''}`; };
function buildPalette() {
  const el = $('palette'); el.innerHTML = ''; let lastH = '';
  for (const [type, head] of TYPE_ORDER) {
    if (head !== lastH) { const h = document.createElement('div'); h.className = 'palH'; h.textContent = head; el.appendChild(h); lastH = head; }
    for (const [id, d] of Object.entries(PARTS)) if (d.type === type) {
      const t = document.createElement('div'); t.className = 'tile'; t.draggable = true; t.title = d.desc + ' (click to add above the selected part, or drag into the stack)';
      t.innerHTML = `<i style="background:${TYPE_COL[type]}"></i><b>${d.name}</b><small>${partStat(id)}</small>`;
      t.onclick = () => { if (!dragEaten()) addPart(id); }; touchDrag(t, 'new:' + id); t.ondragstart = e => { e.dataTransfer.setData('text/plain', 'new:' + id); e.dataTransfer.effectAllowed = 'copy'; };
      t.dataset.id = id; el.appendChild(t);
    }
  }
}
// Touch drag in the hangar: long-press (~0.3 s) a part or a stack row, then drag it onto the stack.
// A quick swipe still scrolls the drawer/list; a plain tap still adds/selects.
let dragState = null, eatClick = 0;
const dragEaten = () => performance.now() < eatClick;
function touchDrag(elm, data) {
  if (!TOUCH) return;
  elm.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const st = { data, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, ghost: null, over: null };
    st.timer = setTimeout(() => { st.on = true; dragState = st; mobile.vibrate(15); const g = elm.cloneNode(true); g.className += ' dragGhost'; g.style.width = elm.offsetWidth + 'px'; g.style.left = st.x + 'px'; g.style.top = st.y + 'px'; document.body.appendChild(g); st.ghost = g; }, 300);
    dragState = st;
  });
}
addEventListener('touchmove', e => { if (dragState && dragState.on) e.preventDefault(); }, { passive: false });
addEventListener('pointermove', e => {
  const st = dragState; if (!st || e.pointerId !== st.id) return;
  if (!st.on) { if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 10) { clearTimeout(st.timer); dragState = null; } return; }
  st.ghost.style.left = e.clientX + 'px'; st.ghost.style.top = e.clientY + 'px';
  const bl = $('build'), edge = 48; if (e.clientY > innerHeight - edge) bl.scrollTop += 14; else if (e.clientY < edge) bl.scrollTop -= 14; // auto-scroll while dragging
  const t = document.elementFromPoint(e.clientX, e.clientY), tg = t && t.closest('#stack .prow, #stack .dropEnd');
  if (st.over !== tg) { if (st.over) st.over.classList.remove('over'); if (tg) tg.classList.add('over'); st.over = tg; }
}, { passive: true });
const endDrag = e => {
  const st = dragState; if (!st || e.pointerId !== st.id) return; clearTimeout(st.timer); dragState = null;
  if (!st.on) return;
  st.ghost.remove(); eatClick = performance.now() + 400;
  const tg = st.over; if (!tg) return; tg.classList.remove('over');
  dropAt(st.data, tg.classList.contains('dropEnd') ? design.parts.length : +tg.dataset.i);
};
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
function setDesign(d, keepSel) { design = d; if (!keepSel) selected = -1; selected = Math.min(selected, design.parts.length - 1); refreshBuild(); }
// click: append at the bottom, or insert above the highlighted part (which stays highlighted)
function addPart(id) { if (selected < 0) setDesign(insertPart(design, id, design.parts.length), true); else { const at = selected; selected = -1; design = insertPart(design, id, at); selected = at + 1; refreshBuild(); } }
function dropAt(data, at) {
  if (data.startsWith('new:')) { design = insertPart(design, data.slice(4), at); if (selected >= at) selected++; }
  else if (data.startsWith('move:')) { const from = +data.slice(5); const to = from < at ? at - 1 : at; design = movePart(design, from, to); selected = -1; }
  refreshBuild();
}
function renderStack(stats) {
  const el = $('stack'); el.innerHTML = '';
  const groups = splitStages(design), N = groups.length;
  for (let gi = N - 1; gi >= 0; gi--) { // top stage first
    const st = stats.stages[gi], hd = document.createElement('div'); hd.className = 'stageH';
    hd.innerHTML = `<span>STAGE ${gi + 1}${gi === 0 ? ' · fires first' : gi === N - 1 ? ' · top' : ''}</span><em>${st.dv.toFixed(0)} m/s · TWR ${st.twr.toFixed(2)}</em>`;
    const up = document.createElement('button'); up.textContent = '⇧'; up.title = 'Move this stage up (fires later)'; up.disabled = gi === N - 1; up.onclick = () => setDesign(swapStages(design, gi, gi + 1));
    const dn = document.createElement('button'); dn.textContent = '⇩'; dn.title = 'Move this stage down (fires sooner)'; dn.disabled = gi === 0; dn.onclick = () => setDesign(swapStages(design, gi, gi - 1));
    hd.append(up, dn); el.appendChild(hd);
    for (const i of groups[gi]) {
      const p = design.parts[i], d = PARTS[p.id], row = document.createElement('div');
      row.className = 'prow' + (i === selected ? ' sel' : '') + (d.type === 'decoupler' ? ' dec' : ''); row.draggable = true;
      row.innerHTML = `<i style="background:${TYPE_COL[d.type]}"></i><b>${d.name}</b><small>${partStat(p.id, p)}</small>`;
      if (d.type === 'engine') {
        const m = document.createElement('span'); m.className = 'cnt';
        const minus = document.createElement('button'); minus.textContent = '−'; minus.onclick = e => { e.stopPropagation(); setDesign(setEngines(design, i, (p.n || 1) - 1), true); };
        const plus = document.createElement('button'); plus.textContent = '+'; plus.onclick = e => { e.stopPropagation(); setDesign(setEngines(design, i, (p.n || 1) + 1), true); };
        const n = document.createElement('u'); n.textContent = `×${p.n || 1}`; m.append(minus, n, plus); row.appendChild(m);
      }
      for (const [txt, title, fn] of [['▲', 'Move up', () => { setDesign(movePart(design, i, i - 1), true); selected = Math.max(0, i - 1); refreshBuild(); }], ['▼', 'Move down', () => { setDesign(movePart(design, i, i + 1), true); selected = Math.min(design.parts.length - 1, i + 1); refreshBuild(); }], ['✕', 'Remove', () => setDesign(removePart(design, i))]]) {
        const b = document.createElement('button'); b.textContent = txt; b.title = title; b.className = 'mini'; b.onclick = e => { e.stopPropagation(); fn(); }; row.appendChild(b);
      }
      row.onclick = () => { if (dragEaten()) return; selected = selected === i ? -1 : i; refreshBuild(); }; row.dataset.i = i; touchDrag(row, 'move:' + i);
      row.ondragstart = e => { e.dataTransfer.setData('text/plain', 'move:' + i); e.dataTransfer.effectAllowed = 'move'; };
      row.ondragover = e => { e.preventDefault(); row.classList.add('over'); }; row.ondragleave = () => row.classList.remove('over');
      row.ondrop = e => { e.preventDefault(); dropAt(e.dataTransfer.getData('text/plain'), i); };
      el.appendChild(row);
    }
  }
  const end = document.createElement('div'); end.className = 'dropEnd'; end.textContent = selected >= 0 ? 'Click a part on the left to add it above the highlighted part · click it again to deselect' : 'Drop parts here, or click a part on the left to add it at the bottom';
  end.ondragover = e => { e.preventDefault(); end.classList.add('over'); }; end.ondragleave = () => end.classList.remove('over');
  end.ondrop = e => { e.preventDefault(); dropAt(e.dataTransfer.getData('text/plain'), design.parts.length); };
  el.appendChild(end);
}
let planTimer = 0;
// Aero balance: CoM (yellow) must sit ahead of (above) the CoP (cyan) or the rocket flips nose-over in the air.
function aeroLine() {
  const ab = aeroBalance(design, 0.5); if (!ab) return '';
  const cls = ab.margin > 1 && ab.marginEmpty > 0.5 ? 'good' : ab.stable ? 'warn' : 'bad';
  const why = ab.stable ? (ab.margin > 1 ? 'weathervanes into the airflow' : 'only just stable; tail fins help') : 'UNSTABLE: the CoP is ahead of the CoM, so it will tumble in the air. Add Tail Fins at the bottom or move heavy parts up';
  return `<div class="msg aero"><span class="${cls}">Aero balance: <b class="kcom">● CoM</b> ${ab.ycom.toFixed(1)} m · <b class="kcop">● CoP</b> ${ab.ycp.toFixed(1)} m (from the bottom of ${ab.L.toFixed(1)} m) · margin ${ab.margin.toFixed(2)} cal full / ${ab.marginEmpty.toFixed(2)} cal booster empty — ${why}</span></div>`;
}
function refreshBuild() {
  const stats = designStats(design), val = validate(design);
  document.querySelectorAll('#presets button[data-p]').forEach(b => b.classList.toggle('on', JSON.stringify(TEMPLATES[+b.dataset.p].parts) === JSON.stringify(design.parts)));
  renderStack(stats);
  const rows = stats.stages.map((st, i) => { const a = stats.analysis.stages[i];
    return `<tr><td>${i + 1}</td><td>${a.engines.join(', ') || '<span class="bad">none</span>'}</td><td>${st.m0.toFixed(1)}→${st.m1.toFixed(1)} t</td><td>${st.dv.toFixed(0)}</td><td class="${st.twr < (i ? 0.3 : 1) ? 'bad' : st.twr < (i ? 0.5 : 1.2) ? 'warn' : ''}">${st.twr.toFixed(2)}${i ? '' : ' SL'}</td><td>${st.burn.toFixed(0)} s</td></tr>`; }).join('');
  const pct = Math.min(100, stats.total / (ORBIT_DV * 2) * 100), need = ORBIT_DV / (ORBIT_DV * 2) * 100;
  const dvC = stats.total < ORBIT_DV ? 'bad' : stats.total < ORBIT_DV + 600 ? 'warn' : 'good';
  $('readout').innerHTML = `<table><tr><th>Stg</th><th>Engines</th><th>Mass wet→dry</th><th>Δv m/s</th><th>TWR</th><th>Burn</th></tr>${rows}</table>
    <div class="dvline">Total Δv <b class="${dvC}">${stats.total.toFixed(0)} m/s</b> · orbit needs ~${ORBIT_DV.toLocaleString()} · liftoff mass ${stats.mass.toFixed(1)} t · score ×${stats.analysis.mult}</div>
    <div class="dvbar"><i class="${dvC}" style="width:${pct}%"></i><s style="left:${need}%"></s><em style="left:${need}%">orbit</em></div>
    ${val.errors.map(e => `<div class="msg bad">✘ ${e}</div>`).join('')}${val.warnings.map(e => `<div class="msg warn">⚠ ${e}</div>`).join('')}
    <div id="verdict" class="msg">${val.ok ? 'AUTO test flight: simulating…' : ''}</div><div id="landPlan" class="msg"></div>
    ${aeroLine()}
    <div class="small">Stage 1 TWR is at sea level, upper stages in vacuum. Δv uses mean Isp for stage 1. Full-scale Earth: orbit is ~7.8 km/s plus ~1.5 km/s of gravity, drag and steering losses.</div>`;
  $('launchBtn').disabled = !val.ok; $('launchBtn').textContent = val.ok ? 'ROLL TO PAD ▶' : 'Fix the design to launch';
  clearTimeout(planTimer); const key = JSON.stringify(design.parts);
  if (val.ok) planTimer = setTimeout(() => { // fly the design on AUTO headlessly (Web Worker): verdict + booster-landing advice
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    requestVerdict(design, (a, p) => {
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    $('verdict').innerHTML = `<span class="${a.level}">${a.text}</span>`;
    const el = $('landPlan'); const s1 = design && stats.analysis.stages[0];
    if (p.reason === 'single') el.innerHTML = '<span class="small">Single-stage rocket: no booster to land.</span>';
    else if (p.reason) el.innerHTML = '';
    else if (p.minReserve === null) el.innerHTML = '<span class="warn">⚠ Booster landing: this booster can\'t keep enough fuel to land. Add stage-1 fuel or use fewer engines.</span>';
    else if (!p.orbit) el.innerHTML = `<span class="warn">⚠ Booster landing needs ~${p.minReserve.toFixed(1)} t left at staging, but then the upper stages can't reach orbit.</span>`;
    else el.innerHTML = `<span class="good">✔ Booster can land: stage with ≥ ${p.minReserve.toFixed(1)} t left (of ${s1.fuel} t). AUTO alone stages it dry.</span>`;
    });
  }, 250);
  renderSaved();
  if (state === 'build') showPreview();
}
// Verdict sims run in worker.js so the hangar never stalls; only the newest request's answer is shown.
let verdictWorker = null, verdictId = 0; const verdictCbs = new Map();
try {
  if (!params.has('noworker')) {
    verdictWorker = new Worker(new URL('./worker.js?v=ss1', import.meta.url), { type: 'module' });
    verdictWorker.onmessage = e => { const { id, a, p, error } = e.data, cb = verdictCbs.get(id); verdictCbs.delete(id);
      if (error) { console.warn('[Orbit Rush] verdict worker:', error); if (cb && id === verdictId) cb(assessDesign(cb.design, { earthRot }), planBuild(cb.design, { earthRot })); return; }
      if (cb && id === verdictId) cb(a, p); };
    verdictWorker.onerror = e => { console.warn('[Orbit Rush] verdict worker unavailable, using the main thread', e.message || ''); verdictWorker = null; e.preventDefault && e.preventDefault();
      const cb = verdictCbs.get(verdictId); verdictCbs.clear(); if (cb) cb(assessDesign(cb.design, { earthRot }), planBuild(cb.design, { earthRot })); };
  }
} catch (e) { verdictWorker = null; }
function requestVerdict(d, cb) {
  const id = ++verdictId, dd = cloneDesign(d);
  if (verdictWorker) { cb.design = dd; verdictCbs.clear(); verdictCbs.set(id, cb); verdictWorker.postMessage({ id, design: dd, earthRot }); return; }
  cb(assessDesign(dd, { earthRot }), planBuild(dd, { earthRot }));
}
// templates + saved designs (localStorage)
TEMPLATES.forEach((t, i) => {
  const b = document.createElement('button'); b.innerHTML = i === 0 ? '<span class="rec">★ RECOMMENDED</span>' : t.name; b.title = t.note; b.dataset.p = i;
  b.onclick = () => setDesign(cloneDesign(TEMPLATES[i])); $('presets').appendChild(b);
});
const loadSaved = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } };
function renderSaved() {
  const sel = $('savedSel'), list = loadSaved(), cur = sel.value; sel.innerHTML = '<option value="">Saved designs…</option>' + list.map((d, i) => `<option value="${i}">${d.name.replace(/</g, '&lt;')}</option>`).join('');
  if (cur && +cur < list.length) sel.value = cur;
}
$('saveBtn').onclick = () => { const name = (prompt('Name this design:', design.name && !TEMPLATES.some(t => t.name === design.name) ? design.name : 'My rocket') || '').trim(); if (!name) return; const list = loadSaved().filter(d => d.name !== name); list.push({ name, parts: design.parts }); try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { } design.name = name; renderSaved(); toast('Saved “' + name + '”', '#9cc3ff'); };
$('savedSel').onchange = () => { const i = $('savedSel').value; if (i === '') return; const d = loadSaved()[+i]; if (d) setDesign(cloneDesign(d)); };
$('delBtn').onclick = () => { const i = $('savedSel').value; if (i === '') return; const list = loadSaved(); list.splice(+i, 1); try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch (e) { } $('savedSel').value = ''; renderSaved(); };
$('clearBtn').onclick = () => setDesign({ name: 'Custom', parts: [{ id: 'probe' }] });
buildPalette();
// ---------- game state ----------
let state = 'build', F, v, booster, rocketG, SG = [], camMode, gen = 0;
const debris = [];
const keys = {};
function later(fn, ms) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }
let shipVis = null;
const ER_KEY = 'orbitrush.earthRot';
let earthRot = localStorage.getItem(ER_KEY) !== '0';
const INC_KEY = 'orbitrush.incl', EPOCH = params.get('epoch') && isFinite(Date.parse(params.get('epoch'))) ? Date.parse(params.get('epoch')) : Date.now();
let launchIncl = Math.max(0, Math.min(180, +(params.get('incl') ?? localStorage.getItem(INC_KEY) ?? 0) || 0));
function siteVel(b) { const w = b.earthRot === false ? 0 : P.OMEGA_E; return [-w * b.r[1], w * b.r[0], 0]; }
const hooks = {
  toast: (m, c) => toast(m, c),
  sound: (k, f) => { if (k === 'ignite') burst(0.6, 1.2, 500); else if (k === 'beep') beep(f); else if (k === 'orbit') { beep(1320); setTimeout(() => beep(1760), 200); } else if (k === 'landed') { beep(1500); setTimeout(() => beep(1900), 180); } },
  stage: b => { b.mesh = detachStage(0); booster = b; },
  drop: d => { d.mesh = detachStage(d.stageIndex); d.t = 0; debris.push(d); },
  ship: s => { shipVis = makeShip(s); },
  shipMoved: s => shipVis && onSurface(shipVis, s.ef, 0),
  jettison: () => { const f = SG[SG.length - 1].userData.fair; if (f) { f.visible = false; const p = V.sub(v.r, V.scale(P.noseOf(v), -10)); for (let k = 0; k < 12; k++) smoke.spawn(p, jit(v.v, 15), 1.5, 1, 3, 0xffffff, null, 0.1); } beep(990); },
  // keys held for the booster must not leak into the upper stage (and vice versa) when control switches
  boosterControl: manual => { for (const k in keys) keys[k] = false; if (manual) { camMode = 'booster'; camDist = 160; } else camMode = 'chase'; $('tProg').classList.toggle('on', F.autoOn); },
  boosterLost: (b, moving) => { explode(b.r, moving ? b.v : siteVel(b), false); b.mesh.visible = false; b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  boosterLanded: b => { b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  fail: () => { explode(v.r, v.v, true); rocketG.visible = false; },
  chute: st => { if (st === 'failed') for (let k = 0; k < 30; k++) smoke.spawn(V.sub(v.r, V.scale(P.noseOf(v), -stackL() * 0.5)), jit(v.v, 12), 2, 1, 4, 0xff7a3c, null, 0.6); },
  recovered: () => { const up = V.norm(v.r); for (let k = 0; k < 60; k++) smoke.spawn(v.r, V.add(siteVel(v), V.add(V.scale(up, 4 + Math.random() * 10), [rnd(10), rnd(10), rnd(10)])), 2 + Math.random() * 2, 2, 9, 0xeaf4ff, null, 0.9); },
  end: (ms, cond) => later(() => { if (cond()) { if (academy && academy.active) academy.onEnd(); else showEnd(); } }, ms),
};
// Move a spent stage out of the rocket into the world; the rest of the stack drops down to the new bottom.
function detachStage(i) {
  const g = SG[i]; rocketG.remove(g); scene.add(g); g.position.set(0, 0, 0); g.userData.plume.visible = false; burst(0.5, 0.6, 1500); beep(660);
  let y = 0; for (let j = i + 1; j < SG.length; j++) { SG[j].position.y = y; y += SG[j].userData.h; }
  if (y < 14 && camDist > 45) camDist = 38; // a small capsule: bring the chase camera in
  const sep = V.sub(v.r, V.scale(P.noseOf(v), v.tel.ycom));
  for (let k = 0; k < 25; k++) smoke.spawn(sep, jit(v.v, 20), 1.5, 2, 8, 0xdddddd, null, 0.5);
  return g;
}
const stackL = () => (v && v.tel ? v.tel.L : 40);
function showPreview() {
  if (rocketG) scene.remove(rocketG);
  rocketG = new THREE.Group(); SG = design.parts.length ? makeRocketGroups(design) : [];
  let y = 0; for (const g of SG) { g.position.y = y; y += g.userData.h; rocketG.add(g); } scene.add(rocketG);
  F = new Flight(validate(design).ok ? design : TEMPLATES[0], hooks, { padZ: PAD_Z, earthRot, incl: launchIncl, epoch: EPOCH }); v = F.v;
  rocketG.add(comMark, copMark);
  fx.attach(rocketG); chuteVis = makeChutes(); rocketG.add(chuteVis);
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
}
// Re-stack the visible stage groups from v.cur (used after F.placeInOrbit in the ?scenario=orbit start)
function syncStages() {
  for (let j = 0; j < v.cur && j < SG.length; j++) SG[j].visible = false;
  let y = 0; for (let j = v.cur; j < SG.length; j++) { SG[j].position.y = y; y += SG[j].userData.h; }
  const f = SG.length && SG[SG.length - 1].userData.fair; if (f && v.fairing <= 0) f.visible = false;
}
let chuteVis = null;
function reset() {
  gen++;
  if (booster && booster.mesh) scene.remove(booster.mesh);
  for (const d of debris) scene.remove(d.mesh); debris.length = 0;
  if (shipVis) earth.remove(shipVis);
  shipVis = null; booster = null; camMode = 'chase'; if (typeof smap !== 'undefined') smap.reset();
  camDist = 90; camYaw = 0.5; camPitch = 0.12; mapZoom = 2.8; camAim = 0.45;
  fire.clear(); smoke.clear(); for (const k in keys) keys[k] = false;
  if (swingArm) swingArm.rotation.y = 0;
  $('end').classList.add('hidden'); $('toasts').innerHTML = '';
  showPreview();
}
function launch() {
  initAudio(); reset(); state = 'flight'; mobile.buzzed = false;
  const sc = params.get('scenario');
  if (['moon', 'moonsoi', 'mars', 'solar'].includes(sc) && !launch.busy) { launch.busy = true; try { runScenario(sc); } finally { launch.busy = false; } return; }
  if (sc === 'orbit' || sc === 'reentry') { // dev/test start: the capsule stack parked in orbit (optionally already deorbiting)
    F.placeInOrbit(+(params.get('alt') || 170000)); syncStages(); camDist = 60;
    if (sc === 'reentry') F.deorbit();
  }
  if (academy && academy.active) { // lesson start states (on the pad, mid-air, or in orbit)
    academy.onLaunch(F); syncStages(); const L = stackL(); if (F.v.cur > 0 || L < 25) camDist = Math.max(30, Math.min(90, L * 2.6 + 20));
  }
  document.activeElement && document.activeElement.blur();
  $('build').classList.add('hidden'); $('hud').classList.remove('hidden');
  mobile.show(true); if (TOUCH) $('ignite').innerHTML = 'Tap <b>STAGE</b> to ignite';
}
function goBuild() {
  reset(); state = 'build';
  $('hud').classList.add('hidden'); mobile.show(false); $('ignite').classList.add('hidden'); $('build').classList.remove('hidden');
  refreshBuild();
}
let camDist = 90, camYaw = 0.5, camPitch = 0.12, mapZoom = 2.8, camAim = 0.45;
$('earthRot').checked = earthRot;
function showAz() { $('inclIn').value = launchIncl; $('azOut').textContent = `→ heading ${(launchAzimuth(launchIncl, 0, earthRot ? P.OMEGA_E * R : 0) * DEG).toFixed(1)}°`; }
$('inclIn').onchange = e => { launchIncl = Math.max(0, Math.min(180, +e.target.value || 0)); try { localStorage.setItem(INC_KEY, String(launchIncl)); } catch (x) { } showAz(); reset(); refreshBuild(); };
showAz();
$('earthRot').onchange = e => { earthRot = e.target.checked; try { localStorage.setItem(ER_KEY, earthRot ? '1' : '0'); } catch (x) { } reset(); refreshBuild(); };
function setThrottleTouch(u) { // the touch slider takes over from AUTO like Z/X do
  if (state !== 'flight' || F.flags.dead) return;
  if (flyingBooster()) { booster.ut = u; return; }
  if (F.ret && F.ret.auto) F.setAuto(false);
  if (v.auto) F.takeOverUpper();
  if (F.autoOn && !v.clamped) { F.setAuto(false, true); $('tProg').classList.remove('on'); }
  v.ut = u; if (u === 0) F.autoWarp = false;
}
const mobile = createMobile({ press, setSAS: m => { if (state === 'flight') { if (v.auto) F.takeOverUpper(); F.setSAS(m); } }, setThrottle: setThrottleTouch, toast: (m, c) => toast(m, c), unlockAudio: initAudio });
const academy = createAcademy({ setDesign: d => setDesign(cloneDesign(d)), launch, goBuild, toast: (m, c) => toast(m, c),
  ctx: () => ({ state, F: state === 'flight' ? F : null, design, ui: { camMode, mapPanel: typeof smap !== 'undefined' ? smap.panelMode : null, plan: typeof smap !== 'undefined' ? smap.plan : null } }) });
const smap = createSolarMap({ renderer, getF: () => F, toast: (m, c) => toast(m, c), touch: TOUCH, earthMap: planet.material.map,
  onChange: (k) => { if (k === 'close') camMode = flyingBooster() ? 'booster' : 'chase'; if (k === 'exec') $('tProg').classList.remove('on'); } });
reset(); refreshBuild();
$('launchBtn').onclick = e => { e.currentTarget.blur(); launch(); };
$('againBtn').onclick = () => goBuild();
$('relaunchBtn').onclick = () => launch();
$('contBtn').onclick = () => { $('end').classList.add('hidden'); F.unfinish(); F.endQueued = true; };
function shareText() { const sc = F.score(); return `🚀 I scored ${sc.toLocaleString()} in Orbit Rush${F.flags.orbit ? ' — reached a full-scale orbit' : ''}${F.flags.boosterBonus ? ' and landed the booster' : ''}${F.flags.recovered ? ' and brought the capsule home' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');
function toast(msg, color = '#7dffa6') { msg = localize(msg, TOUCH); if (msg === $('hint').textContent || [...$('toasts').children].some(c => c.textContent === msg)) return;  const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

// ---------- input ----------
// Throttle Shift/Ctrl (or ↑/↓), Z/X full/cut · W/S pitch, A/D yaw, Q/E roll · C RCS · I/K J/L H/N RCS translate
// 1–7 SAS mode (V toggles SAS) · F AUTO · Space stage · T/, warp · G warp to Ap · M map · B booster cam · Y fly booster · R hangar
const SAS_KEYS = { Digit8: 'node', Digit1: 'stab', Digit2: 'prograde', Digit3: 'retrograde', Digit4: 'radial', Digit5: 'antiradial', Digit6: 'normal', Digit7: 'antinormal', Digit0: 'off' };
const flyingBooster = () => F.flyingBooster();
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'KeyR') { goBuild(); return; }
  if (code === 'KeyU') { cycleFx(); return; }
  if (code === 'Slash') { academy.toggleLearn(); return; }
  if (code === 'KeyM') { camMode = camMode === 'map' ? (flyingBooster() ? 'booster' : 'chase') : 'map'; return; }
  if (code === 'KeyT') { F.autoWarp = false; F.setWarp(F.warpI + 1 >= WARPS.length ? 0 : F.warpI + 1); return; }
  if (code === 'Comma') { F.autoWarp = false; F.setWarp(F.warpI - 1); return; }
  if (code === 'KeyG') { if (F.canWarpToAp() || !F.flags.orbit && F.body === 'earth') F.startAutoWarp(); else smap.warpNext(); return; }
  if (code === 'Period') { smap.warpNext(); return; }
  if (code === 'Digit9') { if (F.exec) { F.setExec(false); toast('Maneuver execution off', '#9cc3ff'); } else F.setExec(true); return; }
  if (code === 'KeyY') { F.toggleBooster(); return; }
  if (code === 'KeyB') { if (booster && booster.state === 'flying') camMode = camMode === 'booster' ? 'chase' : 'booster'; else toast('No booster in flight', '#ffb35c'); return; }
  if (F.flags.dead) return;
  if (flyingBooster()) { // controls go to the booster
    const b = booster;
    if (code === 'KeyZ') b.ut = 1; if (code === 'KeyX') b.ut = 0;
    if (code === 'KeyF') { b.retro = !b.retro; toast(b.retro ? 'Holding retrograde' : 'Manual tilt', '#9cc3ff'); }
    return;
  }
  if (code === 'KeyO') { if (F.ret) F.cancelReturn(); else F.deorbit(); return; }
  if (code === 'KeyP') { F.deployChute(); return; }
  if (F.ret && F.ret.auto && ['KeyZ', 'KeyX'].includes(code)) F.setAuto(false);
  if (v.auto && ['KeyZ', 'KeyX', 'KeyF'].includes(code)) { F.takeOverUpper(); if (code === 'KeyF') return; }
  let res;
  if (code === 'Space') { const r = res = F.stagePress(); if (r === 'ignite') $('ignite').classList.add('hidden'); }
  if (code === 'KeyZ') v.ut = 1;
  if (code === 'KeyX') { v.ut = 0; F.autoWarp = false; }
  if (code === 'KeyF') F.setAuto(!F.autoOn);
  if (code === 'KeyC') F.toggleRCS();
  if (code === 'KeyV') F.setSAS(v.sas === 'off' ? 'stab' : 'off');
  if (SAS_KEYS[code]) F.setSAS(SAS_KEYS[code]);
  $('tProg').classList.toggle('on', F.autoOn);
  return res;
}
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.target && e.target.tagName === 'BUTTON') e.target.blur();
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (state === 'flight' && camMode === 'map' && smap.key(e.code, e)) return;
  if (e.repeat) return; keys[e.code] = true; press(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') e.preventDefault(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k, t = b.dataset.t;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (k) keys[k] = true; if (t) press(t); });
  const up = () => { if (k) keys[k] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
$('warpBtn').onclick = e => { e.currentTarget.blur(); press('KeyT'); };
$('apBtn').onclick = e => { e.currentTarget.blur(); press('KeyG'); };
$('flyBtn').onclick = e => { e.currentTarget.blur(); press('KeyY'); };
$('sasBtn').onclick = e => { e.currentTarget.blur(); const i = P.SAS_MODES.indexOf(v.sas); F.setSAS(P.SAS_MODES[(i + 1) % P.SAS_MODES.length]); };
$('rcsBtn').onclick = e => { e.currentTarget.blur(); press('KeyC'); };
$('learnBtn').onclick = e => { e.currentTarget.blur(); academy.toggleLearn(); };
$('academyBtn').onclick = e => { e.currentTarget.blur(); academy.openMenu(); };
$('deoBtn').onclick = e => { e.currentTarget.blur(); press('KeyO'); };
$('chuteBtn').onclick = e => { e.currentTarget.blur(); press('KeyP'); };
const zoomLim = d => Math.min(5000, Math.max(20, d));
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') return; if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * (1 + e.deltaY * 0.001))); else camDist = zoomLim(camDist * (1 + e.deltaY * 0.001)); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointercancel', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId) || camMode === 'map') return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { camYaw -= (e.clientX - px) * 0.006; camPitch = Math.max(-1.4, Math.min(1.5, camPitch + (e.clientY - py) * 0.004)); }
  else if (pts.size === 2) { let o; for (const [id, q] of pts) if (id !== e.pointerId) o = q; const d0 = Math.hypot(px - o[0], py - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); const f = d0 / Math.max(d1, 1); if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * f)); else camDist = zoomLim(camDist * f); }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
});
const k1 = (a, b) => (keys[a] ? 1 : 0) - (keys[b] ? 1 : 0);
function readControls(rdt) {
  if (flyingBooster()) {
    const b = booster;
    if (keys.ShiftLeft || keys.ShiftRight || keys.ArrowUp) b.ut = Math.min(1, b.ut + rdt * 1.2);
    if (keys.ControlLeft || keys.ControlRight || keys.ArrowDown) b.ut = Math.max(0, b.ut - rdt * 1.2);
    b.input = { pitch: k1('KeyS', 'KeyW') - mobile.input.pitch, yaw: k1('KeyA', 'KeyD') + mobile.input.yaw };
    if (b.input.pitch || b.input.yaw) b.retro = false;
    return;
  }
  if (F.flags.dead) return;
  const mi = mobile.input, cl = x => Math.max(-1, Math.min(1, x));
  const inp = { pitch: cl(k1('KeyW', 'KeyS') + mi.pitch), yaw: cl(k1('KeyA', 'KeyD') + mi.yaw), roll: cl(k1('KeyE', 'KeyQ') + mi.roll) };
  const tr = [k1('KeyL', 'KeyJ'), k1('KeyH', 'KeyN'), k1('KeyI', 'KeyK')];
  const any = inp.pitch || inp.yaw || inp.roll || tr.some(Boolean);
  if (any && v.auto) F.takeOverUpper();
  if (any && F.ret && F.ret.auto) F.setAuto(false);
  if (any && F.autoOn && !v.clamped) { F.setAuto(false, true); toast('Manual control — SAS ' + P.SAS_LABEL[v.sas], '#9cc3ff'); $('tProg').classList.remove('on'); }
  if (keys.ShiftLeft || keys.ShiftRight || keys.ArrowUp) v.ut = Math.min(1, v.ut + rdt * 0.8);
  if (keys.ControlLeft || keys.ControlRight || keys.ArrowDown) v.ut = Math.max(0, v.ut - rdt * 0.8);
  v.input = v.clamped ? { pitch: 0, yaw: 0, roll: 0 } : inp; v.trans = tr;
}

// ---------- scenario starts (?scenario=moon|mars|solar, the smoke test and the SOI lesson) ----------
function runScenario(kind, o = {}) {
  const T = n => TEMPLATES.find(t => t.name === n);
  if (kind === 'moon' || kind === 'moonsoi' || kind === 'mars' || kind === 'solar') {
    setDesign(cloneDesign(T(kind === 'mars' ? 'Mars explorer' : 'Moon lander'))); launch(); F.placeInOrbit(200000, kind === 'mars' ? 2 : 1); syncStages(); camDist = 70;
    if (kind === 'solar') { camMode = 'map'; return F; }
    const pl = C.planFull('earth', v.r, v.v, F.tAbs, kind === 'mars' ? 'mars' : 'moon', { minWait: 1200 }); if (!pl || !pl.reaches) { toast('Scenario: no transfer found', '#ff6262'); return F; }
    F.target = pl.target; const n = F.addNode(pl.tuned); F.applyNodeNow(n);
    const pr = C.predict('earth', v.r, v.v, F.tAbs, { maxPatches: 3 }), ix = pr.patches.findIndex(p => p.body === pl.target);
    if (ix > 0) { const pa = pr.patches[ix - 1]; const tIn = pa.t1; if (kind === 'moonsoi') F.coastTo(tIn - (o.before ?? 6 * 3600)); else if (kind === 'mars') F.coastTo(tIn - 6 * 86400); else F.coastTo(tIn + (pr.patches[ix].t1 - tIn) * 0.35); }
    v.sas = 'prograde'; camMode = o.cam || 'map'; return F;
  }
}
// ---------- visuals ----------
function explode(pos, vel, big) {
  burst(big ? 1.2 : 0.7, 2.5, 700);
  for (let i = 0; i < (big ? 220 : 120); i++) {
    const a = Math.random() * 6.283, b = Math.random() * 3.14, s = Math.random() * (big ? 70 : 45);
    const dv = [Math.cos(a) * Math.sin(b) * s, Math.sin(a) * Math.sin(b) * s, Math.cos(b) * s];
    fire.spawn(pos, V.add(V.scale(vel, 1), dv), 0.6 + Math.random() * 1.4, 4, 14, 0xfff0b0, 0x401000, 1.2);
    if (i % 2) smoke.spawn(pos, V.add(vel, V.scale(dv, 0.5)), 4 + Math.random() * 4, 6, 26, 0x2b2b2b, null, 0.8);
  }
}
function showEnd() {
  if (F.ended) return; const score = F.finish();
  const flags = F.flags, o = F.orbitSnap ? F.orbitSnap.o : P.orbitOf(v), ok = flags.orbit && !flags.dead;
  $('endTitle').innerHTML = flags.recovered ? '🪂 Orbit and home!' : flags.dead ? (/burned up|overheated/.test(flags.dead) ? '🔥 Burned up' : '💥 Rapid Unscheduled Disassembly') : ok ? '🛰️ Orbit achieved!' : flags.stranded ? '🪂 Out of fuel — suborbital' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  if (flags.recovered) lines.push(`<span class="good">✔ Recovered — touchdown at ${flags.touchdown.toFixed(1)} m/s · peak heating ${(F.maxHeat / 1000).toFixed(0)} kW/m² · peak skin ${F.maxTskin.toFixed(0)} K · ${F.maxGret.toFixed(1)} g on entry</span>`);
  if (flags.stranded && !flags.dead) lines.push(`<span class="warn">${F.advice()}</span>`);
  lines.push(`Max altitude: ${((flags.maxAlt || 0) / 1000).toFixed(1)} km · Max-Q (ascent): ${(F.maxQ / 1000).toFixed(1)} kPa${F.maxQEntry > 1000 ? ` · entry peak q ${(F.maxQEntry / 1000).toFixed(1)} kPa` : ''} · max ${F.maxG.toFixed(1)} g · Δv used ${(F.dvUsed / 1000).toFixed(2)} km/s`);
  if (flags.space) lines.push('<span class="good">✔ Reached space (Kármán line, 100 km)</span>');
  if (flags.orbit) lines.push(`<span class="good">✔ Orbit — Ap ${isFinite(o.ap) ? (o.ap / 1000).toFixed(0) + ' km' : 'escape'} / Pe ${(o.pe / 1000).toFixed(0)} km · period ${isFinite(o.T) ? (o.T / 60).toFixed(1) + ' min' : '—'}</span>`);
  if (flags.booster) lines.push(flags.boosterBonus ? `<span class="good">✔ Booster ${flags.booster} (+${flags.boosterBonus})</span>` : `<span class="warn">✘ Booster ${flags.booster}</span>`);
  else if (booster && booster.state === 'flying') lines.push('Booster still descending…');
  lines.push(`Rocket: ${design.name || 'Custom'} — ${v.stages.length} stages, ${F.stats.total.toFixed(0)} m/s · payload ×${v.mult}`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  $('endBody').innerHTML = lines.join('<br>');
  $('contBtn').classList.toggle('hidden', !!flags.dead || !!flags.stranded);
  $('shareBtn').textContent = 'Share score';
  $('end').classList.remove('hidden');
}
function makeShip(s) {
  const g = new THREE.Group();
  const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x184a80, roughness: 0.3 })); sea.rotation.x = -Math.PI / 2; sea.position.y = 0.3; g.add(sea);
  const hull = new THREE.Mesh(new THREE.BoxGeometry(60, 5, 36), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 })); hull.position.y = DECK - 2.5; g.add(hull);
  const xm = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(34, 0.2, 2.2), xm); x1.rotation.y = 0.75; x1.position.y = DECK + 0.05; g.add(x1);
  const x2 = x1.clone(); x2.rotation.y = -0.75; g.add(x2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.6, 6, 40), xm); ring.rotation.x = Math.PI / 2; ring.position.y = DECK + 0.05; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3000, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1500; g.add(beam);
  return onSurface(g, s.ef, 0);
}
// Exhaust: plume mesh scaled by ambient pressure (it balloons in vacuum) plus fire/smoke particles.
function emit(veh, group, dt, bottom, dir) {
  const plume = group.userData.plume; const on = veh.thrust > 0.01;
  plume.visible = on; if (!on || dt <= 0) return;
  const h = V.len(veh.r) - R, p = P.pressureRatio(h), thr = veh.throttle;
  // underexpanded jet (fxmap.plumeShape): the plume widens ~sqrt(pe/pa) as the ambient pressure drops
  const ps = plumeShape(p * 101325, thr), len = (8 + 14 * thr) * ps.length, wid = Math.min(4.5, 1 + (ps.width - 1) * 0.45) * (0.6 + 0.4 * thr);
  plume.scale.set(wid, len, wid); plume.children[0].material.opacity = 0.5 + 0.4 * Math.random();
  const ud = plume.userData, dia = ud.dia; dia.visible = QUALITY[fx.q].diamonds && ps.diamonds > 0.02;
  if (dia.visible) { M.diamond.opacity = ps.diamonds * (0.55 + 0.3 * Math.random());
    dia.children.forEach((m, i) => { m.position.y = -(1.1 + i * 1.35) * ud.w * wid / len; m.scale.set(1 - i * 0.12, 1.4 * wid / len, 1 - i * 0.12); }); }
  const n = Math.min(6, Math.ceil(dt * 120));
  for (let i = 0; i < n; i++) {
    const sp = 60 + Math.random() * 40, spread = 6 + (1 - p) * 30;
    fire.spawn(V.addS(bottom, dir, -2), jit(V.addS(veh.v, dir, -sp), spread), 0.25 + Math.random() * 0.25, 2.5, 6 + (1 - p) * 10, 0xffd9a0, 0x200800, 2);
    if (p > 0.05 && Math.random() < 0.5 * p + 0.15) {
      const gk = h < 60 ? 1 : 0, up = V.norm(veh.r), wind = siteVel(veh);
      const base = V.add(wind, V.scale(V.sub(veh.v, wind), 0.15));
      const vel = gk ? V.add(base, [rnd(70), rnd(70), rnd(70)].map((x, k) => x - up[k] * x * 0.9)) : jit(V.addS(base, dir, -30), 8);
      smoke.spawn(V.addS(bottom, dir, -6), vel, 3 + Math.random() * 4 * p, 4, 14 + 14 * gk, p > 0.5 ? 0xe6e6e6 : 0xbfc6d0, null, 0.6);
    }
  }
}

// ---------- map: orbit line from the Kepler solution (physics/kepler.js) ----------
const LN = 257, lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LN * 3), 3));
const mapLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x7dffa6, depthTest: false, transparent: true })); mapLine.renderOrder = 10; mapLine.frustumCulled = false; scene.add(mapLine);
const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff9a3c, depthTest: false, transparent: true })); marker.renderOrder = 11; scene.add(marker);
const bMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9cc3ff, depthTest: false, transparent: true })); bMarker.renderOrder = 11; scene.add(bMarker);
let orbitPts = [], orbitT = 0;
function updateOrbitLine(O) {
  if ((orbitT -= 1) <= 0) { orbitT = 10; orbitPts = P.orbitPoints(v.r, v.v, LN - 1); }
  const a = lineGeo.attributes.position.array, n = orbitPts.length;
  for (let i = 0; i < LN; i++) { const p = orbitPts[Math.min(i, n - 1)] || v.r; a[i * 3] = p[0] - O[0]; a[i * 3 + 1] = p[1] - O[1]; a[i * 3 + 2] = p[2] - O[2]; }
  lineGeo.attributes.position.needsUpdate = true;
}

// ---------- HUD ----------
function hudNode() {
  const n = F.nodes[0]; if (!n) return ''; const dv = V.len(F.nodeRemaining(n) || [0, 0, 0]), bt = F.nodeBurnTime(n), dt = n.t - F.tAbs - bt / 2;
  return `\n<b data-l="node">NODE</b  >  Δv ${fmtN(dv, 1)} m/s · burn ${fmtDur(P.burnTimeFor(v, dv))} · ${n.started ? '<span class="warn">BURNING</span>' : dt > 0 ? `start in ${fmtDur(dt)}` : '<span class="warn">BURN NOW</span>'}${F.exec ? ' · AUTO' : ''}`.replace('</b  >', '</b>');
}
let tgtCache = { t: 0, s: '' };
function hudTarget() {
  const tg = F.target; if (!tg) return ''; const now = performance.now();
  if (now - tgtCache.t > 500) { tgtCache.t = now; const ts = P.transfer(tg, F.body, [0, 0, 0], [0, 0, 0], F.tAbs), d = V.len(V.sub(v.r, ts.r)), rv = V.len(V.sub(v.v, ts.v));
    let ca = ''; try { const pr = C.predict(F.body, v.r, v.v, F.tAbs, { nodes: F.nodes, maxPatches: 4, samples: 2 }), c = C.closestApproach(pr, tg); ca = c.inside ? ` · encounter Pe ${fmtD(c.alt)}` : isFinite(c.d) ? ` · CA ${fmtD(c.d)} in ${fmtDur(c.t - F.tAbs)}` : ''; } catch (e) { }
    tgtCache.s = `\n<b data-l="tgt">TGT</b>   ${P.BODIES[tg].name} · ${fmtD(d)} · rel ${fmtN(rv)} m/s${ca}`; }
  return tgtCache.s;
}
const fmtD = m => Math.abs(m) >= 1e5 ? (m / 1000).toFixed(0) + ' km' : Math.abs(m) >= 1000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(0) + ' m';
const fmtT = s => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
const fmtN = (x, d = 0) => x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
let hudT = 0, predT = 0;
function apS0() { const o = P.orbitOf(v), h = P.altOf(v), onPad = v.clamped || (h < 300 && v.tel.vAir < 60); return onPad ? '—' : !isFinite(o.ap) ? 'escape' : fmtD(o.ap); }
function peS0() { const o = P.orbitOf(v), h = P.altOf(v), onPad = v.clamped || (h < 300 && v.tel.vAir < 60); return onPad ? '—' : o.pe < -R * 0.5 ? 'in planet' : fmtD(o.pe); }
function hud() {
  const flags = F.flags, tel = v.tel, h = P.altOf(v), sp = V.len(v.v), up = V.norm(v.r), vr = V.dot(v.v, up), east = P.eastOf(v.r), north = V.cross(up, east);
  const o = P.orbitOf(v), nose = P.noseOf(v);
  const pitch = Math.acos(Math.max(-1, Math.min(1, V.dot(nose, up)))) * DEG, hdg = (Math.atan2(V.dot(nose, east), V.dot(nose, north)) * DEG + 360) % 360;
  const onPad = v.clamped || (h < 300 && tel.vAir < 60);
  const apS = onPad ? '—' : !isFinite(o.ap) ? 'escape' : fmtD(o.ap), peS = onPad ? '—' : o.pe < -R * 0.5 ? '(in planet)' : fmtD(o.pe);
  const qk = tel.q / 1000, qc = qk > 45 ? 'bad' : qk > 25 ? 'warn' : '', gc = tel.gload > 5 ? 'bad' : tel.gload > 4 ? 'warn' : '';
  const qa = tel.q * Math.min(tel.aoa, Math.PI - tel.aoa), ac = qa > 9000 ? 'bad' : qa > 5000 ? 'warn' : '';
  const W = F.effWarp(), [wMax, wWhy] = F.warpLimit();
  const clock = !F.ignited ? 'T- HOLD (on pad)' : !flags.liftoff ? 'T- 0:00 IGNITION' : `T+ ${fmtT(F.met)}`;
  const autoTag = v.auto ? ` [AUTOPILOT ${v.guid || ''}]` : F.autoOn ? ` [AUTO ${v.guid || ''}]` : '';
  const fair = v.fairing > 0 ? (flags.fairing ? 'fairing jettisoned' : `fairing on (drops above ${P.FAIRING_ALT / 1000} km at q̇ < 1.1 kW/m²)`) : '';
  const hasRCS = v.stages.slice(v.cur).some(s => s.parts.some(p => p.kind === 'rcs'));
  const space = h > P.KARMAN ? '<span class="good">SPACE</span>' : tel.layer;
  let t = `${clock}${autoTag}${F.rails ? ' <span class="good">[RAILS]</span>' : ''}
ALT   ${fmtD(h)} · ${space}${h < P.KARMAN && h > 60000 ? ` · Kármán line in ${fmtD(P.KARMAN - h)}` : ''}
SPD   ${fmtN(sp)} m/s orbital · ${fmtN(tel.vAir)} m/s air
V/S   ${vr.toFixed(0)} m/s
Ap    ${apS}${!onPad && v.guid !== 'done' && isFinite(o.ap) && vr > 0 ? `  in ${fmtT(P.timeToApV(v) / SIM_SPEED)}` : ''}
Pe    <span class="${o.pe > P.ORBIT_PE ? 'good' : ''}">${peS}</span>${!onPad && isFinite(o.T) && o.pe > P.KARMAN ? `  · period ${(o.T / 60).toFixed(1)} min` : ''}
MACH  ${tel.q > 1 && tel.machShown != null ? tel.machShown.toFixed(2) : tel.rarefied ? '— (rarefied)' : '—'}   Q <span class="${qc}">${qk.toFixed(1)} kPa</span> (max ${(F.maxQ / 1000).toFixed(1)})
AoA   <span class="${ac}">${tel.q > 1 ? (tel.aoa * DEG).toFixed(1) + '°' : '—'}</span>   G <span class="${gc}">${tel.gload.toFixed(2)}</span> (max ${F.maxG.toFixed(1)})
PITCH ${pitch.toFixed(1)}° from vertical · HDG ${hdg.toFixed(0)}°
SAS   ${P.SAS_LABEL[v.sas]} · RCS ${v.rcsOn ? (hasRCS ? `on ${(v.rcsFuel * 1000).toFixed(0)} kg` : 'on (no ring)') : 'off'}
STAGE ${v.cur + 1}/${v.stages.length}  ${fair}
AIR   ${tel.rho > 1e-9 ? `${tel.T.toFixed(0)} K · ρ ${tel.rho.toExponential(2)} · ${tel.regime || ''}${tel.Kn > 1e-3 ? ` Kn ${tel.Kn.toExponential(1)}` : ''}` : 'vacuum'}
SOI   ${P.BODIES[F.body].name}${F.body !== 'earth' ? '' : ''} · ${new Date(P.dateFromT(F.tAbs)).toISOString().slice(0, 16).replace('T', ' ')} UTC${hudNode()}${hudTarget()}
HEAT  ${tel.heat > 50 ? `T₀ ${fmtN(tel.Tstag)} K · q̇ <span class="${tel.heat > 3e5 ? 'warn' : ''}">${fmtN(tel.heat / 1000, 1)} kW/m²</span>` : '—'}${F.maxHeat > 2e4 ? ` (max ${fmtN(F.maxHeat / 1000, 0)})` : ''}`;
  const b = booster;
  if (b && b.state === 'flying') {
    const bh = V.len(b.r) - R, bu = V.norm(b.r), bvr = V.dot(b.v, bu), bva = P.airVel(b, b.r, b.v), bsp = V.len(bva);
    const ship = F.ship, sp0 = ship ? shipPos(ship, b.clock, b.earthRot !== false) : null;
    if (ship && (bh < 3000 || (predT += 0.1) > 0.5)) { predT = 0; const ip = bh < 3000 ? null : P.predictImpact(b); const at = ip ? ip.r : b.r, sAt = ip ? shipPos(ship, ip.t, b.earthRot !== false) : sp0;
      const d = V.sub(V.norm(sAt), V.norm(at)); b.miss = V.dot(d, P.eastOf(at)) * R; b.missN = V.dot(d, V.cross(V.norm(at), P.eastOf(at))) * R; }
    const bd = ship ? (b.miss ?? 0) : 0, bn = b.missN || 0, tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(b.dir, bu)))) * DEG;
    const dirS = !ship ? '' : Math.hypot(bd, bn) < 15 ? 'ON TARGET ✔' : `miss ${fmtD(Math.hypot(bd, bn))} — ship is ${bd > 0 ? 'EAST →' : '← WEST'}`;
    const bt = `BOOSTER ${b.manual ? '(YOU)' : '(auto)'}\nALT   ${fmtD(bh)}\nV/S   ${bvr.toFixed(0)} m/s   air ${bsp.toFixed(0)} m/s  M${(b.mach || 0).toFixed(1)}\nSHIP  ${dirS}\nTILT  ${tilt.toFixed(0)}°  THR ${(b.throttle * 100).toFixed(0)}% ×${b.n}\nFUEL  ${b.stages[0].fuel.toFixed(2)} t  ${b.phase}`;
    t = b.manual ? bt + `\n\nUPPER ${fmtD(h)} Ap ${apS} Pe ${peS}${v.auto ? ' [AUTOPILOT ' + (v.guid || '') + ']' : ''}` : t + '\n' + bt.split('\n').slice(0, 2).join('  ');
  } else if (b) t += `\nBOOSTER ${b.state}`;
  // Learn overlay: every readout label carries data-l (hover = one-line physics explanation, / lists them all)
  t = t.replace(/^(ALT|SPD|V\/S|Ap|Pe|MACH|AoA|PITCH|SAS|STAGE|AIR|HEAT)(?=\s)/gm, (m0) => `<b data-l="${({ 'V/S': 'vs' })[m0] || m0.toLowerCase()}">${m0}</b>`)
    .replace(/ {3}Q <span/, '   <b data-l="q">Q</b> <span').replace(/ {3}G <span/, '   <b data-l="g">G</b> <span');
  $('tele').innerHTML = t;
  const ctlV = flyingBooster() ? b : v, thr = ctlV.throttle || 0;
  if ($('bars').children.length !== v.stages.length + 1) {
    $('bars').innerHTML = '<div class="bar" data-l="thr"><span>THR</span><i id="thrBar"></i><b id="thrPct">0%</b></div>' + v.stages.map((_, i) => `<div class="bar fuel" data-l="fuel"><span>S${i + 1}</span><i id="fBar${i}"></i><b id="fPct${i}">100%</b></div>`).join('');
  }
  $('thrBar').style.height = thr * 100 + '%'; $('thrPct').textContent = Math.round(thr * 100) + '%';
  v.stages.forEach((st, i) => {
    const src = i === 0 && flyingBooster() ? b.stages[0] : st, live = i >= v.cur || (i === 0 && flyingBooster());
    const f = live && src.fuelMax > 0 ? src.fuel / src.fuelMax : 0;
    $('fBar' + i).style.height = f * 100 + '%'; $('fPct' + i).textContent = live && src.fuelMax > 0 ? Math.round(f * 100) + '%' : '—';
    $('fBar' + i).parentElement.classList.toggle('active', i === v.cur && !flyingBooster());
  });
  $('score').textContent = 'SCORE ' + F.score().toLocaleString();
  if (mobile.on) {
    const cs = v.stages[v.cur], fu = cs && cs.fuelMax > 0 ? Math.round(cs.fuel / cs.fuelMax * 100) + '%' : '—', dense = tel.q > 300;
    const hot = !dense && tel.heat > 2e4, hasChute = v.stages.slice(v.cur).some(s2 => s2.parts.some(p2 => p2.kind === 'chute'));
    const cv = flyingBooster() ? booster : v;
    mobile.render({ alt: fmtD(P.altOf(v)), spd: fmtN(V.len(v.v)) + ' m/s', ap: apS0(), pe: peS0(), mqL: dense ? 'MACH·Q' : hot ? 'HEAT' : 'V/S',
      mq: dense ? `${(tel.machShown ?? tel.mach).toFixed(1)}/${(tel.q / 1000).toFixed(0)}kPa` : hot ? `${fmtN(tel.heat / 1000)} kW/m²` : `${V.dot(v.v, V.norm(v.r)).toFixed(0)} m/s`,
      mqC: tel.q > 30000 || tel.heat > 3e5 ? 'warn' : '', fuel: fu, score: F.score().toLocaleString(), thr: mobile.thrDragging() ? (cv.ut ?? cv.throttle ?? 0) : (cv.throttle || cv.ut || 0),
      auto: F.autoOn, chute: hasChute && F.flags.liftoff && P.altOf(v) < 60000 && V.dot(v.v, V.norm(v.r)) < 0, home: F.ret ? 'CANCEL HOME' : 'HOME',
      rcs: v.rcsOn, fx: fx.q.toUpperCase(), warp: `${isGPU ? 'WebGPU' : 'WebGL2'} · warp ×${F.effWarp()}`, sas: v.sas, stageReady: false });
    if (F.flags.dead && !mobile.buzzed) { mobile.buzzed = true; mobile.vibrate([120, 60, 220]); }
  }
  $('warpBtn').textContent = F.autoWarp ? `⏩ TO Ap ×${W}${W < WARPS[F.warpI] ? ' (' + wWhy + ')' : ''}` : `WARP ×${W}${W < WARPS[F.warpI] ? ` (max ×${wMax}: ${wWhy})` : ''}`;
  $('apBtn').classList.toggle('hidden', !F.canWarpToAp() || F.autoWarp);
  $('flyBtn').classList.toggle('hidden', !(b && b.state === 'flying' && F.ship && b.stages[0].fuel > 0));
  $('flyBtn').textContent = b && b.manual ? 'AUTO-LAND BOOSTER (Y)' : 'FLY BOOSTER (Y)';
  heatPanel();
  $('deoBtn').classList.toggle('hidden', !(F.canDeorbit() && (F.flags.orbit || P.orbitOf(v).pe > 60000)) && !F.ret);
  $('deoBtn').textContent = F.ret ? (F.ret.auto ? 'RETURN: AUTO (O cancels)' : 'RETURN: MANUAL (F = auto)') : 'DEORBIT & RETURN (O)';
  const cst = v.chute && v.chute.state; $('chuteBtn').classList.toggle('hidden', !F.hasChute() || !F.ignited || cst === 'main' || cst === 'failed' || F.flags.recovered);
  $('chuteBtn').textContent = cst === 'drogue' ? 'MAIN CHUTES (P)' : 'DROGUES (P)';
  $('sasBtn').textContent = 'SAS ' + P.SAS_LABEL[v.sas]; $('rcsBtn').textContent = 'RCS ' + (v.rcsOn ? 'ON' : 'OFF');
  const hint = F.hint();
  const hintL = localize(hint, TOUCH); $('hint').textContent = hintL; $('hint').style.display = hint ? '' : 'none';
  $('ignite').classList.toggle('hidden', F.ignited || state !== 'flight');
}

// effects quality: hangar select, HUD button and U key; remembered in localStorage
function setFx(q, save = true) {
  if (!QUALITY[q]) return; fxQuality = q; fx.setQuality(q); $('fxSel').value = q; $('fxBtn').textContent = 'FX ' + ({ high: 'HIGH', med: 'MED', low: 'LOW' })[q];
  if (save) try { localStorage.setItem(FXQ_KEY, q); } catch (e) { }
}
function cycleFx() { const i = QUALITY_ORDER.indexOf(fx.q), q = QUALITY_ORDER[(i + QUALITY_ORDER.length - 1) % QUALITY_ORDER.length]; setFx(q); toast('Effects: ' + q.toUpperCase(), '#9cc3ff'); }
$('fxSel').onchange = e => setFx(e.target.value);
$('fxBtn').onclick = e => { e.currentTarget.blur(); cycleFx(); };
setFx(fxQuality, false);
// ---------- flow / heating effects (fx.js) + capsule visuals ----------
const camBody = new THREE.Vector3(), cv1 = new THREE.Vector3(), cv2 = new THREE.Vector3(), cq = new THREE.Quaternion(), heatCol = new THREE.Color();
let lastFx = null, fxMs = 0;
const toHex = c => (Math.round(Math.min(1, c[0]) * 255) << 16) | (Math.round(Math.min(1, c[1]) * 255) << 8) | Math.round(Math.min(1, c[2]) * 255);
function updateFX(rdt, pdt, base, nose, isMap) {
  const tel = v.tel, g = P.stackGeom(v), on = state === 'flight' && !F.flags.dead && rocketG.visible && !isMap && !F.parked;
  rocketG.updateMatrixWorld(true); camBody.copy(camera.position); rocketG.worldToLocal(camBody);
  const list = g.list.filter(e => e.kind !== 'fins'), top = list[list.length - 1];
  const shoulderY = !top ? g.L : top.kind === 'fairing' ? top.y + top.h - 1.6 * top.d : top.y + top.h * 0.3;
  const fs = fx.update(rdt, { tel, L: g.L, d: g.d, shoulderY, cam: camBody, on }, renderer); lastFx = fs;
  // incandescent skins: hot parts glow from ~800 K (Draper point) to white-hot
  for (let j = v.cur; j < SG.length; j++) for (const hp of SG[j].userData.hot) {
    const T = hp.part && hp.part.Ts || 300, k = skinGlow(T);
    hp.mat.emissive.setRGB(k * 1.6, k * k * 0.75, k * k * k * 0.45);
  }
  // ablation embers + plasma trail streaming off the windward rim (world coordinates, dragged back by the air)
  if (fs && pdt > 0 && (fs.ablate > 0.02 || fs.plasma > 0.15)) {
    const fb = tel.flowBody, d = cv1.set(fb[0], fb[1], fb[2]).applyQuaternion(rocketG.quaternion).normalize();
    const noseFirst = fb[1] < 0, yW = noseFirst ? g.L : 0, lead = V.addS(base, nose, yW), R0 = g.d / 2;
    const e1 = cv2.set(nose[0], nose[1], nose[2]).cross(d); if (e1.lengthSq() < 1e-4) e1.set(nose[0], nose[1], nose[2]).cross(Math.abs(nose[2]) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)); e1.normalize();
    const e2 = new THREE.Vector3(nose[0], nose[1], nose[2]).cross(e1).normalize(), n = Math.ceil(QUALITY[fx.q].ablate * (fs.ablate + fs.plasma * 0.6));
    const c0 = toHex(fs.plasmaColor), dd = [d.x, d.y, d.z];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = R0 * (0.9 + Math.random() * 0.2);
      const p0 = [lead[0] + (e1.x * Math.cos(a) + e2.x * Math.sin(a)) * rr, lead[1] + (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * rr, lead[2] + (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * rr];
      const vel = V.add(jit(v.v, 30), V.scale(dd, 60 + Math.random() * 80)); // shed downstream
      if (Math.random() < 0.6 + 0.4 * fs.ablate) fire.spawn(p0, vel, 0.5 + Math.random() * 1.2, 0.6 + R0 * 0.25, 0.2, Math.random() < 0.5 ? 0xffe0a0 : c0, 0x601800, 2.5 + Math.random() * 2);
      if (fs.ablate > 0.1 && Math.random() < 0.35 * fs.ablate) smoke.spawn(p0, V.add(jit(v.v, 20), V.scale(dd, 40)), 3 + Math.random() * 3, R0 * 0.6, R0 * 3, 0x3a3028, null, 1.5);
    }
  }
  // condensation puffs shed from the vapor collar at Max-Q
  if (fs && pdt > 0 && fs.vapor > 0.25 && Math.random() < fs.vapor * 0.5) {
    const pp = V.addS(base, nose, shoulderY - g.d), dd = V.norm(V.sub(siteVel(v), v.v));
    smoke.spawn(jit(pp, g.d * 1.6), V.add(v.v, V.scale(dd, 40)), 0.6, g.d * 0.6, g.d * 1.6, 0xffffff, null, 6);
  }
  // parachutes: canopies trail downstream of the pack along the airflow; they inflate over the opening time
  const c = v.chute, spec = F.chuteSpec(), cs = c && c.state;
  chuteVis.visible = !!spec && (cs === 'drogue' || cs === 'main') && state === 'flight' && !F.flags.dead;
  if (chuteVis.visible) {
    const S = spec[cs], x = Math.min(1, c.t / S.open), fb = tel.flowBody, y0 = g.chute ? g.chute.y + 0.5 : g.L, ud = chuteVis.userData;
    chuteVis.position.set(0, y0, 0); chuteVis.quaternion.setFromUnitVectors(Y_AXIS, cv1.set(fb[0], fb[1], fb[2]).normalize());
    const main = cs === 'main', grp = main ? ud.main : ud.dro, dist = main ? 34 : 16, inf = main ? 0.15 + 0.85 * x * x : 0.2 + 0.8 * x;
    ud.dro.visible = !main || x < 0.6; ud.main.visible = main; ud.dro.scale.setScalar(main ? 1 - x : inf); ud.dro.position.y = 16;
    grp.position.y = dist; grp.scale.set(inf, 0.6 + 0.4 * inf, inf);
    for (const m of grp.children) m.rotation.set(Math.sin(performance.now() / 700 + m.position.x) * 0.04, 0, Math.cos(performance.now() / 900 + m.position.z) * 0.04);
    const a = ud.lines.geometry.attributes.position.array; a.fill(0); let k = 0;
    for (const m of grp.children) { const r = 12.5 * (main ? 1 : 0.28) * inf; for (const sgn of [-1, 1]) { if (k >= 6) break; a[k * 6 + 3] = m.position.x * grp.scale.x + sgn * r * 0.7; a[k * 6 + 4] = dist; a[k * 6 + 5] = m.position.z * grp.scale.z; k++; } }
    ud.lines.geometry.attributes.position.needsUpdate = true;
  }
}

// Heat gauges: the three hottest parts vs their limits, the shield (and ablator left), parachute status.
const PNAME = id => (PARTS[id] && PARTS[id].name || id).replace(/ (Heat Shield|Parachute Pack|Fuel Tank|Command Pod)$/, '');
function heatPanel() {
  const el = $('heat'), parts = [];
  for (let j = v.cur; j < v.stages.length; j++) for (const p of v.stages[j].parts) if (p.Ts !== undefined) { const th = P.thermalOf(p); parts.push({ p, th, f: p.Ts / th.Tmax }); }
  const hot = parts.some(e => e.p.Ts > 420) || F.ret || v.tel.heat > 2e4;
  el.classList.toggle('hidden', !hot || state !== 'flight' || F.flags.dead); if (el.classList.contains('hidden')) return;
  parts.sort((a, b) => b.f - a.f);
  const bar = e => { const f = Math.max(0, Math.min(1, (e.p.Ts - 250) / (e.th.Tmax - 250))), c = e.f > 0.9 ? 'bad' : e.f > 0.7 ? 'warn' : ''; return `<div class="hg"><span>${PNAME(e.p.id)}</span><i><b style="width:${(f * 100).toFixed(0)}%"></b></i><em class="${c}">${e.p.Ts.toFixed(0)} K</em></div>`; };
  let h = `<h4 data-l="heatpanel">HEAT</h4>${parts.slice(0, 3).map(bar).join('')}`;
  const sh = parts.find(e => e.p.kind === 'shield');
  if (sh) h += `<div class="sm">Shield ${PNAME(sh.p.id)}: ${sh.p.Ts.toFixed(0)} / ${sh.th.Tmax} K${sh.p.abl0 ? ` · ablator ${(100 * sh.p.abl / sh.p.abl0).toFixed(0)}%` : ''}${v.tel.flowBody && v.tel.flowBody[1] > 0.5 ? ' <span class="good">windward ✔</span>' : v.tel.heat > 2e4 ? ' <span class="bad">not facing the flow!</span>' : ''}</div>`;
  else if (F.ret) h += '<div class="sm bad">No heat shield on this craft</div>';
  const spec = F.chuteSpec(), c = v.chute;
  if (spec) {
    const st = c.state, next = st === 'stowed' ? 'drogue' : st === 'drogue' ? 'main' : null, lim = next ? chuteLimits(spec, v.tel, next) : null;
    h += `<div class="sm">Chutes: ${st === 'stowed' ? 'stowed' : st === 'drogue' ? 'drogues out' : st === 'main' ? '<span class="good">mains out</span>' : `<span class="bad">${st}</span>`}${lim ? ` · ${next} ${lim.ok ? '<span class="good">safe now</span>' : `<span class="warn">${lim.why}</span>`}` : ''}${st === 'main' ? ` · ${v.tel.vAir.toFixed(1)} m/s (≤ ${SAFE_TOUCHDOWN})` : ''}</div>`;
  }
  el.innerHTML = h;
}

// ---------- main loop ----------
let last = performance.now(), slowT = 0, pixR = Math.min(devicePixelRatio, TOUCH ? 1.25 : 1.5);
const U = new THREE.Vector3(), E = new THREE.Vector3(), N = new THREE.Vector3(), tgtV = new THREE.Vector3(), offV = new THREE.Vector3(), tq = new THREE.Quaternion(), dv3 = new THREE.Vector3();
const setRel = (obj, p, O) => obj.position.set(p[0] - O[0], p[1] - O[1], p[2] - O[2]);
const dirQ = (obj, d) => obj.quaternion.setFromUnitVectors(Y_AXIS, dv3.set(d[0], d[1], d[2]));
await renderer.compileAsync(scene, camera).catch(() => {});
$('loading') && $('loading').remove();
if (!params.has('scenario') && !params.has('noacademy')) academy.firstRun();
renderer.setAnimationLoop(() => {
  const now = performance.now(), rdt = Math.min(0.1, (now - last) / 1000); last = now;
  let pdt = 0;
  slowT = rdt > 0.045 ? slowT + rdt : Math.max(0, slowT - rdt * 0.5);
  if (slowT > 2 && state === 'flight' && !fxLocked && QUALITY_ORDER.indexOf(fx.q) > 0 && lastFx) { // effects quality first, then resolution
    const q = QUALITY_ORDER[QUALITY_ORDER.indexOf(fx.q) - 1]; setFx(q, false); fxAuto++; slowT = 0; toast('Frame rate low — effects set to ' + q.toUpperCase(), '#ffb35c'); console.info('[Orbit Rush] lowering effects quality to', q);
  } else if (slowT > 2 && pixR > 0.6) { pixR = Math.max(0.6, pixR - 0.25); renderer.setPixelRatio(pixR); slowT = 0; console.info('[Orbit Rush] lowering render resolution to', pixR); }
  if (state === 'flight') {
    readControls(rdt);
    pdt = F.advance(rdt);
    if (swingArm && F.ignited && swingArm.rotation.y < 1.4) swingArm.rotation.y += rdt * 0.8;
  }
  const th = v.earthRot === false ? 0 : P.OMEGA_E * (v.clock || 0), wE = v.earthRot === false ? 0 : P.OMEGA_E;
  if (booster && booster.state !== 'flying' && booster.ef) { booster.r = V.rotZ(V.scale(booster.ef, R + booster.lift), th); booster.v = siteVel(booster); }
  // floating origin: the focused craft is at the scene origin
  const focus = (camMode === 'booster' && booster && booster.mesh && booster.mesh.visible) ? booster : v;
  const tel = v.tel, nose = P.noseOf(v), base = V.sub(v.r, V.scale(nose, tel.ycom));
  const O = focus === v ? v.r : booster.r;
  earth.position.set(-O[0], -O[1], -O[2]); earth.rotation.z = th;
  setRel(rocketG, base, O); toQ(v.q, rocketG.quaternion);
  if (state === 'flight' && !F.flags.dead && SG[v.cur]) emit(v, SG[v.cur], pdt, base, nose);
  else for (let j = v.cur; j < SG.length; j++) SG[j].userData.plume.visible = false;
  comMark.visible = copMark.visible = state === 'build';
  if (state === 'build') { comMark.position.set(0, tel.ycom, 0); copMark.position.set(0, P.centerOfPressure(P.stackGeom(v), 0.5), 0); }
  for (let k = debris.length - 1; k >= 0; k--) { // spent upper stages tumble away and are removed after a while
    const d = debris[k]; d.throttle = 0; let left = pdt; while (left > 0 && !d.gone) { const dt = Math.min(0.25, left); left -= dt; if (P.stepPoint(d, dt)) d.gone = true; }
    d.t += pdt; d.dir = V.norm(V.qrot(V.qAxisAngle(V.norm(d.r), pdt * 0.3), V.qrot(V.qAxisAngle(P.eastOf(d.r), pdt * 0.2), d.dir)));
    setRel(d.mesh, d.r, O); dirQ(d.mesh, d.dir);
    if (d.gone || d.t > 120) { scene.remove(d.mesh); debris.splice(k, 1); }
  }
  if (booster && booster.mesh.visible) {
    setRel(booster.mesh, booster.r, O); dirQ(booster.mesh, booster.dir);
    const bh = V.len(booster.r) - R, legs = booster.mesh.userData.legs; if (legs) legs.visible = booster.state === 'landed' || (booster.state === 'flying' && bh < 4000);
    if (booster.state === 'flying') emit(booster, booster.mesh, pdt, booster.r, booster.dir); else booster.mesh.userData.plume.visible = false;
  }
  // ground tile follows the focus (Earth-fixed coordinates)
  const fr = V.len(O), h = fr - R, isMap = camMode === 'map';
  tile.visible = !isMap && h < 400000;
  if (tile.visible) updateTile(V.rotZ(O, -th));
  // camera
  U.set(O[0] / fr, O[1] / fr, O[2] / fr); const ea = P.eastOf(O); E.set(ea[0], ea[1], ea[2]); N.crossVectors(U, E);
  hemi.position.copy(U);
  if (isMap) {
    const cu = new THREE.Vector3(U.x, U.y, 0); if (cu.lengthSq() < 1e-6) cu.set(0, 1, 0);
    camera.position.set(-O[0], -O[1], -O[2] + R * mapZoom); camera.up.copy(cu.normalize()); camera.lookAt(-O[0], -O[1], -O[2]);
  } else {
    if (focus === v) tgtV.set(nose[0], nose[1], nose[2]).multiplyScalar(stackL() * camAim - tel.ycom);
    else tgtV.set(booster.dir[0], booster.dir[1], booster.dir[2]).multiplyScalar(15);
    offV.copy(N).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(E, Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(U, Math.sin(camPitch));
    camera.position.copy(tgtV).addScaledVector(offV, camDist); camera.up.copy(U); camera.lookAt(tgtV);
  }
  if (rocketG) { const t0 = performance.now(); updateFX(rdt, pdt, base, nose, isMap); fxMs += (performance.now() - t0 - fxMs) * 0.05; }
  mapLine.visible = isMap && state === 'flight'; marker.visible = bMarker.visible = isMap;
  if (isMap) {
    updateOrbitLine(O); setRel(marker, v.r, O); marker.scale.setScalar(R * mapZoom * 0.006);
    if (booster && booster.state === 'flying') { setRel(bMarker, booster.r, O); bMarker.scale.setScalar(R * mapZoom * 0.005); } else bMarker.visible = false;
  }
  stars.position.copy(camera.position);
  const k = Math.min(1, Math.max(0, h / 70000));
  scene.background.setRGB(0.48 * (1 - k) ** 2, 0.72 * (1 - k) ** 1.6, 1.0 * (1 - k) ** 1.2);
  if (isMap) scene.background.setRGB(0, 0, 0.01);
  stars.material.opacity = isMap ? 1 : Math.min(1, Math.max(0, k * 1.4 - 0.3));
  atmo.material.opacity = isMap ? 0.12 : 0.22 * (1 - k * 0.3);
  fire.update(pdt, O, camera.quaternion, wE); smoke.update(pdt, O, camera.quaternion, wE);
  if (rumble) {
    const watchB = booster && booster.state === 'flying' && camMode === 'booster';
    const thK = state === 'flight' ? (watchB ? booster.thrust : F.flags.dead ? 0 : v.thrust) : 0;
    const p = P.pressureRatio(h);
    rumble.gain.setTargetAtTime(Math.min(0.9, thK / 3000 * (0.25 + 0.75 * p)), ac.currentTime, 0.08);
    rumbleF.frequency.setTargetAtTime(150 + 500 * p, ac.currentTime, 0.2);
  }
  if (state === 'flight' && (hudT += rdt) > 0.1) { academy.tick(hudT); hudT = 0; hud(); academy.tick(0); academy.renderLearn(); }
  else if (state === 'build' && academy.active && (hudT += rdt) > 0.25) { academy.tick(hudT); hudT = 0; }
  if (state === 'build') { camYaw += rdt * 0.15; camDist = Math.max(70, stackL() * 1.9); camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.36, 0, innerWidth, innerHeight); }
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const mapOn = state === 'flight' && camMode === 'map';
  if (smap.state.on !== mapOn) smap.show(mapOn);
  if (mapOn) { smap.update(rdt); renderer.render(smap.scene, smap.camera); }
  else renderer.render(scene, camera);
});
window.__game = { BUILD, P, C, TEMPLATES, smap, scenario: (k, o) => runScenario(k, o), get F() { return F; }, get v() { return v; }, get flags() { return F.flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return F.ship; }, press, keys, get ignited() { return F.ignited; }, get warp() { return F.effWarp(); }, launch, goBuild, get design() { return design; }, setDesign: d => setDesign(cloneDesign(d)), get SG() { return SG; }, get camMode() { return camMode; }, get mapZoom() { return mapZoom; }, get academy() { return academy; }, fx, get fxState() { return lastFx; }, get fxMs() { return fxMs; }, setCam: (d, yaw, pitch, aim) => { camDist = d; if (aim !== undefined) camAim = aim; if (yaw !== undefined) camYaw = yaw; if (pitch !== undefined) camPitch = pitch; }, setFx, get verdictWorker() { return !!verdictWorker; }, syncStages };
