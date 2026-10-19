import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import * as P from './physics.js?v=gx1h2';
import { Flight, PRESETS, planBuild, assessDesign, SIM_SPEED, WARPS, shipPos, chuteLimits, SAFE_TOUCHDOWN, launchAzimuth, fmtDur } from './flight.js?v=gx1h2';
import * as C from './physics/patched.js?v=gx1h2';
import { createSolarMap } from './solarmap.js?v=gx1h2';
import { PARTS, TEMPLATES, ORBIT_DV, TANK_DRY, splitStages, designStats, validate, cloneDesign, insertPart, removePart, movePart, setEngines, setSymmetry, swapStages, partMass, buildVehicle, aeroBalance, analyze } from './parts.js?v=gx1h2';
import { FX } from './fx.js?v=gx1h2';
import { createAcademy } from './academy-ui.js?v=gx1h2';
import { createMobile, isTouch } from './mobile.js?v=gx1h2';
import { localize } from './wording.js?v=gx1h2';
import { loadSettings, saveSettings, makeTranslator, fmtDist, fmtSpeed, History } from './settings.js?v=gx1h2';
import { createQoL, dvTableHTML } from './qol-ui.js?v=gx1h2';
const TOUCH = isTouch();
// Milestone Q settings: key remap, sensitivity, units, overlays (settings.js; saved in localStorage)
let SET = loadSettings(localStorage), translate = makeTranslator(SET);
const fmtS = mps => fmtSpeed(mps, SET.units);
import { QUALITY, QUALITY_ORDER, plumeShape, skinGlow } from './fxmap.js?v=gx1h2';
import * as GX from './gfx/gfx.js?v=gx1h2';
// Orbit Rush renderer + UI. All physics lives in physics/* (full-scale Earth, 6-DOF); this file only draws it.
// Rendering is camera-relative ("floating origin"): every frame the focused craft sits at the scene origin and
// everything else (the rotating Earth, pad, droneship, debris) is placed at (its ECI position − focus) computed
// in float64, so full-scale coordinates (6.4e6 m) never reach the GPU as large float32 numbers near the camera.
const { R, ATM, V } = P;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
export const BUILD = '2026-10-19-gx1h2';
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
const GFXQ_KEY = 'orbitrush.gfx';
let gfxQ = GX.pickGfx((() => { try { return localStorage.getItem(GFXQ_KEY); } catch (e) { return null; } })(), params.get('gfx'), TOUCH);
renderer.setPixelRatio(Math.min(devicePixelRatio, GX.GFX[gfxQ].pixel));
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; // HDR: sun, plume and bloom above 1.0
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
const sunL = new THREE.DirectionalLight(0xfff4e6, 3.0); sunL.position.set(0.9, 0.35, 0.3); scene.add(sunL);
scene.environment = GX.envTexture(); // PBR reflections (procedural sky panorama)
const sunPos = uniform(new THREE.Vector3(1e11, 0, 0)), sunDirV = new THREE.Vector3(1, 0, 0);
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GX.glowTexture(), color: new THREE.Color(6, 5.4, 4.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
sunSprite.frustumCulled = false; scene.add(sunSprite);
const post = GX.makePost(renderer, scene, camera);
const plumeLight = new THREE.PointLight(0xffa860, 0, 900, 1.6); scene.add(plumeLight); // the exhaust lights the pad, the ground and the smoke


// pad detail (gx1): flame deflector, lightning masts with catenary wires, apron, roads, service buildings, lights
function padExtras(g) {
  const conc = new THREE.MeshStandardMaterial({ map: (() => { const t = GX.concreteTexture(); t.repeat.set(18, 18); return t; })(), roughness: 0.95 });
  const apron = new THREE.Mesh(new THREE.CircleGeometry(150, 64), conc); apron.rotation.x = -Math.PI / 2; apron.position.y = 0.08; g.add(apron);
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.9 });
  for (const [x, z, w, l, ry] of [[0, -420, 9, 560, 0], [-260, -150, 7, 300, 1.2], [230, 120, 7, 260, -0.9]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, l), asphalt); r.position.set(x, 0.05, z); r.rotation.y = ry; g.add(r); }
  const defl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 7, 6, 3, 1), new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.6, metalness: 0.6 })); defl.rotation.set(Math.PI / 2, 0, 0); defl.position.set(0, PAD_Z - 3, 18); g.add(defl);
  const wireM = new THREE.LineBasicMaterial({ color: 0x222222 }), tops = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 70, z = Math.sin(a) * 70;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.1, 110, 8), steel); m.position.set(x, 55, z); g.add(m);
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 0.2) })); lt.position.set(x, 111, z); g.add(lt); tops.push(new THREE.Vector3(x, 110, z)); }
  for (let i = 0; i < 4; i++) { const a = tops[i], b = tops[(i + 1) % 4], pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -18 * 4 * t * (1 - t), 0))); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM)); }
  const bm = new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: 0.8 });
  for (const [x, z, w, h, d] of [[-120, 60, 30, 10, 18], [-150, 95, 16, 7, 12], [130, -110, 24, 14, 24], [60, 140, 40, 6, 14]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bm); b.position.set(x, h / 2, z); g.add(b); }
  const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.4) });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4, l = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 0.4), lampM); l.position.set(Math.cos(a) * 45, 30.5, Math.sin(a) * 45); l.lookAt(0, 20, 0); g.add(l); }
}
// ---------- launch complex (lattice tower, swing arm, mast, tanks) ----------
const steel = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.55, metalness: 0.7 });
let swingArm;
function buildLaunchComplex() {
  const g = new THREE.Group();
  const conc = new THREE.Mesh(new THREE.CylinderGeometry(32, 36, 4, 40), new THREE.MeshStandardMaterial({ map: (() => { const t = GX.concreteTexture(); t.repeat.set(4, 4); return t; })(), roughness: 0.92 })); conc.position.y = PAD_Z - 2; g.add(conc);
  padExtras(g);
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
const planetGeo = new THREE.SphereGeometry(R - 600, 384, 192); planetGeo.rotateX(Math.PI / 2); planetGeo.rotateZ(GX.EARTH_TEX_ROT); // pad at a real equatorial coast
const planet = new THREE.Mesh(planetGeo, GX.earthMaterial(gfxQ, sunPos));
earth.add(planet);
const cloudGeo = new THREE.SphereGeometry(R + 7000, 192, 96); cloudGeo.rotateX(Math.PI / 2); cloudGeo.rotateZ(GX.EARTH_TEX_ROT);
const clouds = new THREE.Mesh(cloudGeo, GX.cloudMaterial(gfxQ, sunPos));
earth.add(clouds);
const ATMO_R = R + 110000, atmoMat = GX.atmoMaterial({ R, Ra: ATMO_R });
const atmo = new THREE.Mesh(new THREE.SphereGeometry(ATMO_R, 128, 64), atmoMat); atmo.frustumCulled = false; scene.add(atmo); // scene-level: placed at the Earth centre each frame
const mwTex = GX.tex('milkyway', gfxQ); const stars = new THREE.Mesh(new THREE.SphereGeometry(1e8, 48, 24), new THREE.MeshBasicMaterial({ map: mwTex, color: new THREE.Color(1.3, 1.3, 1.4), side: THREE.BackSide, transparent: true, depthWrite: false })); stars.rotation.set(1.1, 0.4, 0.2);
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
const tile = new THREE.Mesh(tileGeo, GX.tileMaterial()); tile.frustumCulled = false; earth.add(tile);
let tileC = null, earthPx = null; GX.earthPixels(gfxQ).then(px => { earthPx = px; tileC = null; });
const tileRGBA = [0, 0, 0, 0];
function updateTile(ef) {
  if (tileC && V.dot(tileC, ef) > Math.cos(25000 / R)) return;
  const c = V.norm(ef), e = P.eastOf(c), nn = V.cross(c, e), pos = tileGeo.attributes.position.array, col = tileGeo.attributes.color.array, rgb = [0, 0, 0];
  tileC = c; tile.position.set(c[0] * R, c[1] * R, c[2] * R);
  const put = (k, th, ph) => {
    const s = Math.sin(th), cm1 = -2 * Math.sin(th / 2) ** 2, dx = Math.cos(ph) * s, dy = Math.sin(ph) * s;
    const off = [c[0] * cm1 + e[0] * dx + nn[0] * dy, c[1] * cm1 + e[1] * dx + nn[1] * dy, c[2] * cm1 + e[2] * dx + nn[2] * dy];
    pos[k * 3] = off[0] * R; pos[k * 3 + 1] = off[1] * R; pos[k * 3 + 2] = off[2] * R;
    const dd = V.norm(V.add(c, off));
    if (earthPx) { GX.sampleEarth(earthPx, dd, tileRGBA); const f = (0.8 + 0.4 * fbm(dd[0] * 2400, dd[1] * 2400, dd[2] * 2400)) * 2.4, w = tileRGBA[3]; // licensed day map + fine variation on land
      col[k * 3] = tileRGBA[0] * (w > 0.5 ? 1 : f); col[k * 3 + 1] = tileRGBA[1] * (w > 0.5 ? 1 : f); col[k * 3 + 2] = tileRGBA[2] * (w > 0.5 ? 1 : f); }
    else { planetColor(dd, rgb, true); col[k * 3] = (rgb[0] / 255) ** 2.2; col[k * 3 + 1] = (rgb[1] / 255) ** 2.2; col[k * 3 + 2] = (rgb[2] / 255) ** 2.2; }
  };
  put(0, 0, 0);
  for (let i = 0; i < TNR; i++) { const th = TILE_R / R * ((i + 1) / TNR) ** 1.8; for (let j = 0; j < TNS; j++) put(1 + i * TNS + j, th, 2 * Math.PI * j / TNS); }
  tileGeo.attributes.position.needsUpdate = true; tileGeo.attributes.color.needsUpdate = true; tileGeo.computeVertexNormals();
}
onSurface(buildLaunchComplex(), PAD_EF, 0);

// ---------- rocket meshes: one THREE.Group per stage, sized from the same part geometry the physics uses ----------
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, ...(GX.GFX[gfxQ].normalMaps ? { normalMap: GX.panelNormal(), normalScale: new THREE.Vector2(0.6, 0.6) } : {}) }),
  black: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.62, metalness: 0.2 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 0.28, metalness: 1.0 }),
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
    if (s.radial) { out.push(makeRadialGroup(s, si)); return; }
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
// Radial boosters: k copies of the booster column around the core, from the core's bottom up (no stack height)
function makeRadialGroup(s, si) {
  const g = new THREE.Group(), k = s.radial, cols = []; let rB = 0.9;
  for (let j = 0; j < k; j++) {
    const a = j / k * Math.PI * 2 + Math.PI / 4, c = new THREE.Group(); let y = 0;
    for (const p of s.parts) {
      const r = (p.dr || 1.8) / 2; rB = Math.max(rB, r);
      if (p.kind === 'engine') bells(c, Math.max(1, Math.round((p.n || k) / k)), y, p.h, r);
      else if (p.kind === 'tank') { cyl(r, r, p.h, M.white, y, c); cyl(r + 0.02, r + 0.02, Math.min(1, p.h * 0.1), M.black, y + p.h * 0.45, c); }
      y += p.h;
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(rB, rB * 2.4, 24), M.white); nose.position.y = y + rB * 1.2; c.add(nose);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), M.black); strut.position.set(-(rB + 0.2), y * 0.8, 0); c.add(strut);
    const R0 = 1.25 + rB + 0.08; c.position.set(Math.cos(a) * R0, 0, Math.sin(a) * R0); c.rotation.y = -a; g.add(c); cols.push(c);
  }
  const plume = makePlume(Math.max(0.8, rB * 0.9)); g.add(plume);
  const extra = cols.slice(1).map(c => { const pl = makePlume(Math.max(0.8, rB * 0.9)); pl.position.copy(c.position); g.add(pl); return pl; });
  plume.position.copy(cols[0].position); plume.userData.extra = extra;
  g.userData = { h: 0, plume, legs: null, fair: null, fairH: 0, hot: [], stage: si, radial: k };
  return g;
}
// CoM / CoP markers for the hangar preview (drawn through the hull)
const mk = (c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true })); m.renderOrder = 20; return m; };
const comMark = mk(0xffd23a), copMark = mk(0x38e1ff), cotMark = (() => { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xff4ad8, depthTest: false, transparent: true });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 10), m), a = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 8), m), h = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.6, 12), m);
  a.position.y = -3.5; h.position.y = -7.5; h.rotation.x = Math.PI; [b, a, h].forEach(x => { x.renderOrder = 20; g.add(x); }); return g; })(); // CoT: thrust point + thrust line (exhaust side)
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
  if (d.radial) return `${d.m} t · ×${(p && p.n) || 2} radial symmetry`;
  if (d.type === 'engine') return `${d.tv} kN · Isp ${d.ispSl}/${d.ispVac} s · ${d.m} t`;
  if (d.type === 'tank') return `${d.fuel} t fuel · ${(d.fuel * TANK_DRY).toFixed(1)} t empty`;
  if (d.type === 'shield') return `${d.m} t · max ${d.heat.Tmax.toLocaleString()} K${d.heat.abl ? ' · ablative' : ' · reusable'}`;
  if (d.type === 'chute') return `${d.m} t · drogue + 3 mains`;
  return `${(p ? partMass(p) : d.m).toFixed(1)} t${d.mult ? ' · ×' + d.mult + ' score' : ''}`; };
// rich part tooltip (hover on desktop, ⓘ on touch): every number from the part catalog
function partTip(id, p) {
  const d = PARTS[id], n = (p && p.n) || 1, L = [`<b>${d.name}</b>`, `<span class="sm">${d.desc}</span>`], kv = (k, x) => L.push(`<div class="kv"><span>${k}</span><b>${x}</b></div>`);
  if (d.type === 'engine') { const mdot = d.tv / (d.ispVac * 9.80665); kv('Thrust', `${(d.tv * d.ispSl / d.ispVac).toFixed(0)} kN sea level · ${d.tv} kN vacuum${n > 1 ? ` (×${n})` : ''}`); kv('Isp', `${d.ispSl} s sea level · ${d.ispVac} s vacuum`); kv('Mass', `${d.m} t each`); kv('Propellant flow', `${(mdot * 1000).toFixed(0)} kg/s each`); kv('Gimbal', `${(d.gimbal * 180 / Math.PI).toFixed(0)}°`); kv('TWR alone (Earth, vac)', (d.tv / (d.m * 9.80665)).toFixed(0)); }
  else if (d.type === 'tank') { kv('Propellant', `${d.fuel} t`); kv('Empty', `${(d.fuel * TANK_DRY).toFixed(2)} t`); kv('Size', `${d.h.toFixed(1)} m × ${d.d} m`); if (d.rho) kv('Density', `${d.rho} t/m³`); }
  else if (d.type === 'shield') { kv('Mass', `${d.m} t`); kv('Max temperature', `${d.heat.Tmax} K`); if (d.heat.abl) kv('Ablator', `${d.heat.abl} t, holds ${d.heat.Tabl} K`); }
  else if (d.type === 'chute') { kv('Drogues', `CdA ${d.drogue.cda} m² · < Mach ${d.drogue.machMax}, < ${d.drogue.qMax / 1000} kPa`); kv('Mains', `CdA ${d.main.cda} m² · < ${d.main.vMax} m/s, < ${d.main.qMax / 1000} kPa`); kv('Mass', `${d.m} t`); }
  else if (d.type === 'rcs') { kv('Thrust', `${d.F} kN per axis · Isp ${d.isp} s`); kv('Monopropellant', `${d.mono} t`); kv('Mass', `${d.m} t`); }
  else if (d.type === 'fins') { kv('Lift slope', `CNα ${d.cna} /rad`); kv('Mass', `${d.m} t`); }
  else { kv('Mass', `${d.m} t`); if (d.mult) kv('Score', `×${d.mult}`); if (d.rw) kv('Reaction wheels', `${d.rw} kN·m`); }
  return L.join('');
}
function buildPalette() {
  const el = $('palette'); el.innerHTML = ''; let lastH = '';
  for (const [type, head] of TYPE_ORDER) {
    if (head !== lastH) { const h = document.createElement('div'); h.className = 'palH'; h.textContent = head; el.appendChild(h); lastH = head; }
    for (const [id, d] of Object.entries(PARTS)) if (d.type === type) {
      const t = document.createElement('div'); t.className = 'tile'; t.draggable = true;
      t.innerHTML = `<i style="background:${TYPE_COL[type]}"></i><b>${d.name}</b><small>${partStat(id)}</small>`; qol.attachTip(t, () => partTip(id) + '<div class="sm">Click to add above the selected part, or drag into the stack.</div>', TOUCH);
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
    const radK = stats.analysis.stages[gi].radial;
    hd.innerHTML = `<span>STAGE ${gi + 1}${radK ? ` · RADIAL BOOSTERS ×${radK}` : ''}${gi === 0 ? ' · fires first' : gi === N - 1 ? ' · top' : ''}</span><em>${st.dv.toFixed(0)} m/s · TWR ${st.twr.toFixed(2)}</em>`;
    const up = document.createElement('button'); up.textContent = '⇧'; up.title = 'Move this stage up (fires later)'; up.disabled = gi === N - 1; up.onclick = () => setDesign(swapStages(design, gi, gi + 1));
    const dn = document.createElement('button'); dn.textContent = '⇩'; dn.title = 'Move this stage down (fires sooner)'; dn.disabled = gi === 0; dn.onclick = () => setDesign(swapStages(design, gi, gi - 1));
    hd.append(up, dn); el.appendChild(hd);
    for (const i of groups[gi]) {
      const p = design.parts[i], d = PARTS[p.id], row = document.createElement('div');
      row.className = 'prow' + (i === selected ? ' sel' : '') + (d.type === 'decoupler' ? ' dec' : '') + (radK && !d.radial ? ' radial' : ''); row.draggable = true;
      row.innerHTML = `<i style="background:${TYPE_COL[d.type]}"></i><b>${radK && !d.radial ? `<u class="sym">×${radK}</u> ` : ''}${d.name}</b><small>${partStat(p.id, p)}</small>`;
      if (d.radial) {
        const m = document.createElement('span'); m.className = 'cnt'; m.title = 'Radial symmetry';
        const minus = document.createElement('button'); minus.textContent = '−'; minus.onclick = e => { e.stopPropagation(); setDesign(setSymmetry(design, i, -1), true); };
        const plus = document.createElement('button'); plus.textContent = '+'; plus.onclick = e => { e.stopPropagation(); setDesign(setSymmetry(design, i, 1), true); };
        const nn = document.createElement('u'); nn.textContent = `×${p.n || 2}`; m.append(minus, nn, plus); row.appendChild(m);
      }
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
      qol.attachTip(row, () => partTip(p.id, p), TOUCH);
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
// builder undo / redo (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z, or the ↶ ↷ buttons): every design change is recorded
const hist = new History(150); let histJ = null, histLock = false;
function undo() { const d = hist.undo({ name: design.name, parts: design.parts }); if (!d) { toast('Nothing to undo', '#ffb35c'); return; } histLock = true; setDesign(cloneDesign(d)); histLock = false; }
function redo() { const d = hist.redo({ name: design.name, parts: design.parts }); if (!d) { toast('Nothing to redo', '#ffb35c'); return; } histLock = true; setDesign(cloneDesign(d)); histLock = false; }
// per-body stage Δv / TWR: where the stages are lit
const ENV_BODIES = ['moon', 'mars', 'mercury', 'venus', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'triton', 'pluto'];
let envId = 'earth';
function envOf(id) { if (id === 'earth' || id === 'vac') return id; const b = P.BODIES[id], a = P.bodyAtm(id, 0); return { g: b.mu / (b.R * b.R), p: a ? a.p / 101325 : 0, name: b.name }; }
function refreshBuild() {
  { const j = JSON.stringify({ name: design.name, parts: design.parts }); if (histJ && j !== histJ && !histLock) hist.push(JSON.parse(histJ)); histJ = j;
    if ($('undoBtn')) { $('undoBtn').disabled = !hist.canUndo; $('redoBtn').disabled = !hist.canRedo; } }
  const stats = designStats(design, { env: envOf(envId) }), val = validate(design), statsE = envId === 'earth' ? stats : designStats(design);
  document.querySelectorAll('#presets button[data-p]').forEach(b => b.classList.toggle('on', JSON.stringify(TEMPLATES[+b.dataset.p].parts) === JSON.stringify(design.parts)));
  renderStack(stats);
  const rows = stats.stages.map((st, i) => { const a = stats.analysis.stages[i];
    return `<tr><td>${i + 1}</td><td>${a.engines.join(', ') || '<span class="bad">none</span>'}</td><td>${st.m0.toFixed(1)}→${st.m1.toFixed(1)} t</td><td>${st.dv.toFixed(0)}</td><td class="${st.twr < (i && envId === 'earth' ? 0.3 : 1) ? 'bad' : st.twr < (i && envId === 'earth' ? 0.5 : 1.2) ? 'warn' : ''}">${st.twr.toFixed(2)}${i || envId !== 'earth' ? '' : ' SL'}</td><td>${st.burn.toFixed(0)} s</td></tr>`; }).join('');
  const pct = Math.min(100, statsE.total / (ORBIT_DV * 2) * 100), need = ORBIT_DV / (ORBIT_DV * 2) * 100;
  const dvC = statsE.total < ORBIT_DV ? 'bad' : statsE.total < ORBIT_DV + 600 ? 'warn' : 'good';
  const envSel = `<label class="envSel" title="Stage Δv and TWR as if each stage were lit on this body's surface (its gravity and air pressure)">Δv / TWR at <select id="envSel"><option value="earth">Earth launch (stage 1 sea level)</option><option value="vac">Vacuum (Earth g)</option>${ENV_BODIES.map(id => `<option value="${id}">${P.BODIES[id].name} surface</option>`).join('')}</select></label>`;
  $('readout').innerHTML = `${envSel}<table><tr><th>Stg</th><th>Engines</th><th>Mass wet→dry</th><th>Δv m/s</th><th>TWR${envId === 'earth' ? '' : ' (' + (envId === 'vac' ? 'vac' : P.BODIES[envId].name) + ')'}</th><th>Burn</th></tr>${rows}</table>
    <div class="dvline">Total Δv <b class="${dvC}">${statsE.total.toFixed(0)} m/s</b>${envId !== 'earth' ? ` (${stats.total.toFixed(0)} m/s at ${envId === 'vac' ? 'vacuum' : P.BODIES[envId].name})` : ''} · orbit needs ~${ORBIT_DV.toLocaleString()} · liftoff mass ${stats.mass.toFixed(1)} t · score ×${stats.analysis.mult} · <a href="#" id="dvMapLink">Δv map</a></div>
    <div class="dvbar"><i class="${dvC}" style="width:${pct}%"></i><s style="left:${need}%"></s><em style="left:${need}%">orbit</em></div>
    ${val.errors.map(e => `<div class="msg bad">✘ ${e}</div>`).join('')}${val.warnings.map(e => `<div class="msg warn">⚠ ${e}</div>`).join('')}
    <div id="verdict" class="msg">${val.ok ? 'AUTO test flight: simulating…' : ''}</div><div id="landPlan" class="msg"></div>
    ${aeroLine()}
    <div class="small">Stage 1 TWR is at sea level, upper stages in vacuum. Δv uses mean Isp for stage 1. Full-scale Earth: orbit is ~7.8 km/s plus ~1.5 km/s of gravity, drag and steering losses.</div>`;
  $('envSel').value = envId; $('envSel').onchange = e => { envId = e.target.value; refreshBuild(); };
  $('dvMapLink').onclick = e => { e.preventDefault(); qol.openDv(); };
  $('launchBtn').disabled = !val.ok; $('launchBtn').textContent = val.ok ? 'ROLL TO PAD ▶' : 'Fix the design to launch';
  clearTimeout(planTimer); const key = JSON.stringify(design.parts);
  if (val.ok) planTimer = setTimeout(() => { // fly the design on AUTO headlessly (Web Worker): verdict + booster-landing advice
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    requestVerdict(design, (a, p) => {
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    $('verdict').innerHTML = `<span class="${a.level}">${a.text}</span>`;
    const el = $('landPlan'); const s1 = design && stats.analysis.stages[0];
    if (p.reason === 'single') el.innerHTML = '<span class="small">Single-stage rocket: no booster to land.</span>';
    else if (p.reason === 'radial') el.innerHTML = '<span class="small">Radial boosters are expendable: they drop into the sea.</span>';
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
    verdictWorker = new Worker(new URL('./worker.js?v=gx1h2', import.meta.url), { type: 'module' });
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
const qol = createQoL({ settings: () => SET, onSettings: s => { SET = s; translate = makeTranslator(SET); if (typeof smap !== 'undefined' && smap.conic !== SET.conic) smap.setConic(SET.conic); if (state === 'build') refreshBuild(); },
  resume: () => setPause(false), quicksave: () => quicksave(), quickload: () => quickload(), revertLaunch: () => revertLaunch(), hangar: () => { setPause(false); goBuild(); }, quickInfo,
  dvTable: () => dvTableHTML(state === 'flight' ? craftDv() : designStats(design).total, state !== 'flight') });
buildPalette();
{ const u = document.createElement('button'); u.id = 'undoBtn'; u.textContent = '↶'; u.title = 'Undo (Ctrl+Z)'; u.onclick = () => undo();
  const r = document.createElement('button'); r.id = 'redoBtn'; r.textContent = '↷'; r.title = 'Redo (Ctrl+Y)'; r.onclick = () => redo();
  document.querySelector('.saved').prepend(u, r); }
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
  sound: (k, f) => { if (k === 'ignite') { burst(0.6, 1.2, 500); if (F.alt < 200) ignitionClouds(v); } else if (k === 'beep') beep(f); else if (k === 'orbit') { beep(1320); setTimeout(() => beep(1760), 200); } else if (k === 'landed') { beep(1500); setTimeout(() => beep(1900), 180); } },
  stage: b => { b.mesh = detachStage(0); booster = b; stagingDrama(v.r, v.v, P.noseOf(v)); },
  drop: d => { d.mesh = detachStage(d.stageIndex); d.t = 0; d.spin = [rnd(0.6), rnd(0.6)]; debris.push(d); stagingDrama(v.r, v.v, P.noseOf(v)); },
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
  const g = SG[i]; rocketG.remove(g); scene.add(g); g.position.set(0, 0, 0); g.userData.plume.visible = false; for (const e of g.userData.plume.userData.extra || []) e.visible = false; burst(0.5, 0.6, 1500); beep(660);
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
  rocketG.add(comMark, copMark, cotMark);
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
let mapPost = null;
const smap = createSolarMap({ renderer, getF: () => F, toast: (m, c) => toast(m, c), touch: TOUCH, gfxQ, settings: SET,
  dvTable: () => dvTableHTML(craftDv(), false),
  onChange: (k, x) => { if (k === 'conic') { SET.conic = x; saveSettings(localStorage, SET); } if (k === 'close') exitMap(); if (k === 'exec') $('tProg').classList.remove('on'); } });
mapPost = GX.makePost(renderer, smap.scene, smap.camera);
// graphics quality (gx1): Low keeps phones and software GPUs smooth; High adds bloom + 2K textures. Saved; a change reloads textures.
async function setGfx(q, reload = true) {
  if (!GX.GFX[q]) return; const changedTex = GX.GFX[q].tex !== GX.GFX[gfxQ].tex || GX.GFX[q].normalMaps !== GX.GFX[gfxQ].normalMaps; gfxQ = q;
  try { localStorage.setItem(GFXQ_KEY, q); } catch (e) { }
  $('gfxSel').value = q; renderer.setPixelRatio(Math.min(devicePixelRatio, GX.GFX[q].pixel)); renderer.setSize(innerWidth, innerHeight);
  await post.enable(GX.GFX[q].bloom); await mapPost.enable(GX.GFX[q].bloom);
  if (reload && changedTex) location.reload();
}
$('gfxSel').onchange = e => setGfx(e.target.value);
setGfx(gfxQ, false);
$('creditsBtn').onclick = () => $('credits').classList.remove('hidden');
$('creditsClose').onclick = () => $('credits').classList.add('hidden');
reset(); refreshBuild();
$('launchBtn').onclick = e => { e.currentTarget.blur(); launch(); };
$('againBtn').onclick = () => goBuild();
$('relaunchBtn').onclick = () => launch();
$('contBtn').onclick = () => { $('end').classList.add('hidden'); F.unfinish(); F.endQueued = true; };
function shareText() { const sc = F.score(); return `🚀 I scored ${sc.toLocaleString()} in Orbit Rush${F.flags.orbit ? ' — reached a full-scale orbit' : ''}${F.flags.boosterBonus ? ' and landed the booster' : ''}${F.flags.recovered ? ' and brought the capsule home' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');
function toast(msg, color = '#7dffa6') { msg = localize(msg, TOUCH); if (msg === $('hint').textContent || [...$('toasts').children].some(c => c.textContent === msg)) return;  const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

// ---------- pause, quicksave / quickload, revert (Milestone Q) ----------
let paused = false;
const QS_KEY = 'orbitrush.quicksave.v1';
function setPause(on) { if (state !== 'flight') on = false; paused = !!on; qol.pause(paused); if (paused) { for (const k in keys) keys[k] = false; } }
function quicksave() {
  if (state !== 'flight' || F.flags.dead) { toast('Nothing to save', '#ffb35c'); return false; }
  if (F.rails && F.warpI > 0) F.setWarp(0, true);
  try { const s = F.snapshot(); localStorage.setItem(QS_KEY, JSON.stringify(s)); toast('💾 Quicksaved' + (booster && booster.state === 'flying' ? ' (the booster in flight is not saved)' : ''), '#9cc3ff'); return true; } catch (e) { toast('Quicksave failed: ' + e.message, '#ff6262'); return false; }
}
function quickInfo() { try { const s = JSON.parse(localStorage.getItem(QS_KEY)); if (!s) return ''; return `${s.design.name || 'rocket'} · ${P.BODIES[s.body].name} · ${new Date(s.at).toLocaleTimeString()}`; } catch (e) { return ''; } }
function quickload() {
  let s = null; try { s = JSON.parse(localStorage.getItem(QS_KEY)); } catch (e) { s = null; }
  if (!s) { toast('No quicksave (F5 saves)', '#ffb35c'); return false; }
  setPause(false); design = cloneDesign(s.design); selected = -1; reset(); state = 'flight';
  F.loadSnapshot(s); v = F.v; syncStages();
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
  if (F.parked || P.altOf(v) > 100000) camDist = Math.max(30, Math.min(90, stackL() * 2.6 + 20));
  document.activeElement && document.activeElement.blur();
  $('build').classList.add('hidden'); $('hud').classList.remove('hidden'); mobile.show(true); $('ignite').classList.toggle('hidden', F.ignited);
  toast('📂 Quickloaded', '#9cc3ff'); return true;
}
function revertLaunch() { setPause(false); design = cloneDesign(F.design); launch(); }
function craftDv() { // Δv left in the stages still attached (vacuum Isp)
  let m = P.massOf(v), dv = 0; for (let i = v.cur; i < v.stages.length; i++) { const s = v.stages[i]; if (s.eng && s.eng.tv > 0 && s.fuel > 0) dv += s.eng.ispVac * 9.80665 * Math.log(m / (m - s.fuel)); m -= s.fuel + s.dry; } return dv;
}
// ---------- input ----------
// Throttle Shift/Ctrl (or ↑/↓), Z/X full/cut · W/S pitch, A/D yaw, Q/E roll · C RCS · I/K J/L H/N RCS translate
// 1–7 SAS mode (V toggles SAS) · F AUTO · Space stage · T/, warp · G warp to Ap · M map · B booster cam · Y fly booster · R hangar
const SAS_KEYS = { Digit8: 'node', Digit1: 'stab', Digit2: 'prograde', Digit3: 'retrograde', Digit4: 'radial', Digit5: 'antiradial', Digit6: 'normal', Digit7: 'antinormal', Digit0: 'off' };
const flyingBooster = () => F.flyingBooster();
// hx: on-screen warp arrows (◀◀ ×N ▶▶) share these with T / , ; levels above the current physics/rails limit are refused
function warpMaxI() { const lim = F.warpLimit()[0]; let i = 0; while (i + 1 < WARPS.length && WARPS[i + 1] <= lim) i++; return i; }
function warpStep(d) { if (state !== 'flight' || !F) return false; F.autoWarp = false; const cur = Math.min(F.warpI, warpMaxI()), n = cur + d;
  if (n < 0) return false; if (n > warpMaxI()) { const [m, why] = F.warpLimit(); toast(`Max warp ×${m}${why ? ': ' + why : ''}`, '#ffb35c'); return false; } F.setWarp(n); return true; }
function warpReset() { if (state !== 'flight' || !F) return; F.autoWarp = false; F.setWarp(0); }
function warpBarUpdate() { const b = $('warpBar'); if (!b || !F) return; const mi = warpMaxI(), W = F.effWarp(), [m, why] = F.warpLimit();
  const cur = Math.min(F.warpI, mi); $('wDn').disabled = cur <= 0 && !F.autoWarp; $('wUp').disabled = cur >= mi;
  $('wDn').title = `Slower (,) · now ×${W}`; $('wUp').title = cur >= mi ? `Max warp ×${m}${why ? ' — ' + why : ''}` : `Faster (T) → ×${WARPS[cur + 1]} · now ×${W}`;
  const t = $('wVal'); const txt = (F.autoWarp ? '⏩ ' : '') + '×' + W; if (t.textContent !== txt) t.textContent = txt; t.title = `Time warp ×${W}${W > 1 ? ' — tap for ×1' : ''}`; t.classList.toggle('on', W > 1); }
$('wDn').onclick = e => { e.currentTarget.blur(); initAudio(); warpStep(-1); };
$('wUp').onclick = e => { e.currentTarget.blur(); initAudio(); warpStep(1); };
$('wVal').onclick = e => { e.currentTarget.blur(); warpReset(); };
function exitMap() { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); camMode = flyingBooster() ? 'booster' : 'chase'; }
renderer.domElement.addEventListener('pointerdown', () => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }, true);
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'Escape') { setPause(!paused); return; }
  if (code === 'F5') { quicksave(); return; }
  if (code === 'F9') { quickload(); return; }
  if (code === 'Backquote') { SET.camStyle = SET.camStyle === 'locked' ? 'free' : 'locked'; saveSettings(localStorage, SET); toast(SET.camStyle === 'locked' ? 'Camera: LOCKED to the craft' : 'Camera: FREE (horizon up)', '#9cc3ff'); return; }
  if (code === 'Backslash') { SET.overlay = !SET.overlay; saveSettings(localStorage, SET); toast(SET.overlay ? 'CoM / CoP / CoT markers on' : 'Markers off', '#9cc3ff'); return; }
  if (code === 'KeyR') { goBuild(); return; }
  if (code === 'KeyU') { cycleFx(); return; }
  if (code === 'Slash') { academy.toggleLearn(); return; }
  if (code === 'KeyM') { if (camMode === 'map') exitMap(); else camMode = 'map'; return; }
  if (code === 'KeyT') { warpStep(1); return; }
  if (code === 'Comma') { warpStep(-1); return; }
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
  if (e.target && e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) {
    // hx: a focused text/number field (map node Δv boxes) used to swallow M and Esc, trapping the player in the map
    if (!(state === 'flight' && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyM'))) return;
    e.target.blur(); if (e.code === 'Enter') return;
  }
  if (state === 'build' && (e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) { e.preventDefault(); if (e.code === 'KeyY' || e.shiftKey) redo(); else undo(); return; }
  const code = translate(e.code); if (code === 'F5' || code === 'F9' || e.code === 'F5' || e.code === 'F9') e.preventDefault();
  if (code === null) return;
  if (code === 'F9' && state === 'build' && !e.repeat) { quickload(); return; }
  if (state === 'flight' && camMode === 'map' && smap.key(e.code, e)) return;
  if (code === 'Escape' && state === 'flight') { if (qol.busy) return; if (!paused && camMode === 'map') { exitMap(); return; } setPause(!paused); return; }
  if (code === 'KeyM' && state === 'flight' && paused && camMode === 'map') { setPause(false); exitMap(); return; }
  if (paused) return;
  if (e.repeat) return; keys[code] = true; press(code);
});
addEventListener('keyup', e => { const code = translate(e.code); if (code) keys[code] = false; keys[e.code] = false; if (e.code === 'Space') e.preventDefault(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k, t = b.dataset.t;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (k) keys[k] = true; if (t) press(t); });
  const up = () => { if (k) keys[k] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
$('warpBtn').onclick = e => { e.currentTarget.blur(); press('KeyT'); };
{ const b = document.createElement('button'); b.id = 'pauseBtn'; b.textContent = '⏸ (Esc)'; b.title = 'Pause menu: quicksave/load, revert, settings'; b.onclick = e => { e.currentTarget.blur(); setPause(true); }; $('ctl').prepend(b); }
$('apBtn').onclick = e => { e.currentTarget.blur(); press('KeyG'); };
$('flyBtn').onclick = e => { e.currentTarget.blur(); press('KeyY'); };
$('sasBtn').onclick = e => { e.currentTarget.blur(); const i = P.SAS_MODES.indexOf(v.sas); F.setSAS(P.SAS_MODES[(i + 1) % P.SAS_MODES.length]); };
$('rcsBtn').onclick = e => { e.currentTarget.blur(); press('KeyC'); };
$('learnBtn').onclick = e => { e.currentTarget.blur(); academy.toggleLearn(); };
$('academyBtn').onclick = e => { e.currentTarget.blur(); academy.openMenu(); };
$('deoBtn').onclick = e => { e.currentTarget.blur(); press('KeyO'); };
$('chuteBtn').onclick = e => { e.currentTarget.blur(); press('KeyP'); };
const zoomLim = d => Math.min(5000, Math.max(20, d));
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') return; if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * (1 + e.deltaY * 0.001))); else camDist = zoomLim(camDist * (1 + e.deltaY * 0.001 * SET.sens.zoom)); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointercancel', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId) || camMode === 'map') return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { const k = SET.sens.cam; camYaw -= (e.clientX - px) * 0.006 * k; camPitch = Math.max(-1.4, Math.min(1.5, camPitch + (e.clientY - py) * 0.004 * k)); }
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
  const mi0 = mobile.input, ks = SET.sens.stick, mi = { pitch: mi0.pitch * ks, yaw: mi0.yaw * ks, roll: mi0.roll }, cl = x => Math.max(-1, Math.min(1, x));
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
  plume.visible = on; const ex = plume.userData.extra; if (ex) for (const e of ex) e.visible = on;
  if (!on || dt <= 0) return;
  const h = V.len(veh.r) - R, p = P.pressureRatio(h), thr = veh.throttle;
  // underexpanded jet (fxmap.plumeShape): the plume widens ~sqrt(pe/pa) as the ambient pressure drops
  const ps = plumeShape(p * 101325, thr), len = (8 + 14 * thr) * ps.length, wid = Math.min(4.5, 1 + (ps.width - 1) * 0.45) * (0.6 + 0.4 * thr);
  plume.scale.set(wid, len, wid); plume.children[0].material.opacity = 0.5 + 0.4 * Math.random(); if (ex) for (const e of ex) e.scale.copy(plume.scale);
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
const fmtD = m => fmtDist(m, SET.units);
const fmtT = s => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
const fmtN = (x, d = 0) => x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
let hudT = 0, predT = 0;
function apS0() { const o = P.orbitOf(v), h = P.altOf(v), onPad = v.clamped || (h < 300 && v.tel.vAir < 60); return onPad ? '—' : !isFinite(o.ap) ? 'escape' : fmtD(o.ap); }
function peS0() { const o = P.orbitOf(v), h = P.altOf(v), onPad = v.clamped || (h < 300 && v.tel.vAir < 60); return onPad ? '—' : o.pe < -R * 0.5 ? 'in planet' : fmtD(o.pe); }
let impT = 0;
function impLine() { // ballistic impact prediction with drag, refreshed about once a second
  if ((impT -= 0.1) <= 0) { impT = 1; try { const im = F.ignited && !F.flags.dead && !F.flags.landed && !F.flags.recovered ? F.predictImpact() : null; F._imp = im ? { ...im, body: F.body } : null; } catch (e) { F._imp = null; } }
  const im = F._imp; if (!im || im.body !== F.body) return '';
  return `IMPACT in ${fmtDur(im.t - F.tAbs)} · ${fmtS(im.speed)}${F.body === 'earth' ? ` · ${Math.abs(im.lat).toFixed(1)}°${im.lat >= 0 ? 'N' : 'S'} ${Math.abs(im.lon).toFixed(1)}°${im.lon >= 0 ? 'E' : 'W'}` : ''} (with drag)\n`;
}
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
SPD   ${fmtS(sp)} orbital · ${fmtS(tel.vAir)} air
V/S   ${fmtS(vr)}
Ap    ${apS}${!onPad && v.guid !== 'done' && isFinite(o.ap) && vr > 0 ? `  in ${fmtT(P.timeToApV(v) / SIM_SPEED)}` : ''}
Pe    <span class="${o.pe > P.ORBIT_PE ? 'good' : ''}">${peS}</span>${!onPad && isFinite(o.T) && o.pe > P.KARMAN ? `  · period ${(o.T / 60).toFixed(1)} min` : ''}
MACH  ${tel.q > 1 && tel.machShown != null ? tel.machShown.toFixed(2) : tel.rarefied ? '— (rarefied)' : '—'}   Q <span class="${qc}">${qk.toFixed(1)} kPa</span> (max ${(F.maxQ / 1000).toFixed(1)})
AoA   <span class="${ac}">${tel.q > 1 ? (tel.aoa * DEG).toFixed(1) + '°' : '—'}</span>   G <span class="${gc}">${tel.gload.toFixed(2)}</span> (max ${F.maxG.toFixed(1)})
PITCH ${pitch.toFixed(1)}° from vertical · HDG ${hdg.toFixed(0)}°
SAS   ${P.SAS_LABEL[v.sas]} · RCS ${v.rcsOn ? (hasRCS ? `on ${(v.rcsFuel * 1000).toFixed(0)} kg` : 'on (no ring)') : 'off'}
STAGE ${v.cur + 1}/${v.stages.length}  ${fair}
AIR   ${tel.rho > 1e-9 ? `${tel.T.toFixed(0)} K · ρ ${tel.rho.toExponential(2)} · ${tel.regime || ''}${tel.Kn > 1e-3 ? ` Kn ${tel.Kn.toExponential(1)}` : ''}` : 'vacuum'}
SOI   ${P.BODIES[F.body].name}${F.body !== 'earth' ? '' : ''} · ${new Date(P.dateFromT(F.tAbs)).toISOString().slice(0, 16).replace('T', ' ')} UTC${hudNode()}${hudTarget()}
${impLine()}HEAT  ${tel.heat > 50 ? `T₀ ${fmtN(tel.Tstag)} K · q̇ <span class="${tel.heat > 3e5 ? 'warn' : ''}">${fmtN(tel.heat / 1000, 1)} kW/m²</span>` : '—'}${F.maxHeat > 2e4 ? ` (max ${fmtN(F.maxHeat / 1000, 0)})` : ''}`;
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
    mobile.render({ alt: fmtD(P.altOf(v)), spd: fmtS(V.len(v.v)), ap: apS0(), pe: peS0(), mqL: dense ? 'MACH·Q' : hot ? 'HEAT' : 'V/S',
      mq: dense ? `${(tel.machShown ?? tel.mach).toFixed(1)}/${(tel.q / 1000).toFixed(0)}kPa` : hot ? `${fmtN(tel.heat / 1000)} kW/m²` : `${V.dot(v.v, V.norm(v.r)).toFixed(0)} m/s`,
      mqC: tel.q > 30000 || tel.heat > 3e5 ? 'warn' : '', fuel: fu, score: F.score().toLocaleString(), thr: mobile.thrDragging() ? (cv.ut ?? cv.throttle ?? 0) : (cv.throttle || cv.ut || 0),
      auto: F.autoOn, chute: hasChute && F.flags.liftoff && P.altOf(v) < 60000 && V.dot(v.v, V.norm(v.r)) < 0, home: F.ret ? 'CANCEL HOME' : 'HOME',
      rcs: v.rcsOn, fx: fx.q.toUpperCase(), warp: `${isGPU ? 'WebGPU' : 'WebGL2'} · warp ×${F.effWarp()}`, sas: v.sas, stageReady: false });
    if (F.flags.dead && !mobile.buzzed) { mobile.buzzed = true; mobile.vibrate([120, 60, 220]); }
  }
  $('warpBtn').textContent = F.autoWarp ? `⏩ TO Ap ×${W}${W < WARPS[F.warpI] ? ' (' + wWhy + ')' : ''}` : `WARP ×${W}${W < WARPS[F.warpI] ? ` (max ×${wMax}: ${wWhy})` : ''}`;
  $('apBtn').classList.toggle('hidden', !F.canWarpToAp() || F.autoWarp); warpBarUpdate();
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
  if (slowT > 2 && state === 'flight' && !fxLocked && QUALITY_ORDER.indexOf(fx.q) === 0 && post.on && !params.get('gfx')) { post.enable(false); mapPost.enable(false); slowT = 0; toast('Frame rate low — bloom off', '#ffb35c'); }
  if (slowT > 2 && state === 'flight' && !fxLocked && QUALITY_ORDER.indexOf(fx.q) > 0 && lastFx) { // effects quality first, then resolution
    const q = QUALITY_ORDER[QUALITY_ORDER.indexOf(fx.q) - 1]; setFx(q, false); fxAuto++; slowT = 0; toast('Frame rate low — effects set to ' + q.toUpperCase(), '#ffb35c'); console.info('[Orbit Rush] lowering effects quality to', q);
  } else if (slowT > 2 && pixR > 0.6) { pixR = Math.max(0.6, pixR - 0.25); renderer.setPixelRatio(pixR); slowT = 0; console.info('[Orbit Rush] lowering render resolution to', pixR); }
  if (state === 'flight' && !paused) {
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
  const ovl = state === 'build' || (SET.overlay && state === 'flight' && !F.flags.dead && camMode !== 'map');
  comMark.visible = copMark.visible = ovl; cotMark.visible = ovl && !!(v.stages[v.cur] && v.stages[v.cur].eng && v.stages[v.cur].eng.tv > 0);
  if (ovl) { const yB = 0; comMark.position.set(0, tel.ycom, 0); copMark.position.set(0, P.centerOfPressure(P.stackGeom(v), state === 'build' ? 0.5 : Math.max(0.3, tel.mach || 0.5)), 0); cotMark.position.set(0, yB, 0);
    const sc = Math.max(1, stackL() / 40); comMark.scale.setScalar(sc); copMark.scale.setScalar(sc); cotMark.scale.setScalar(sc); }
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
  tile.visible = !isMap && h < 80000;
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
    if (SET.camStyle === 'locked' && focus === v && state === 'flight') { // locked: the camera turns with the craft (its axes, nose up on screen)
      const ax = V.qrot(v.q, [1, 0, 0]), az = V.qrot(v.q, [0, 0, 1]);
      offV.set(ax[0], ax[1], ax[2]).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(dv3.set(az[0], az[1], az[2]), Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(dv3.set(nose[0], nose[1], nose[2]), Math.sin(camPitch));
      camera.position.copy(tgtV).addScaledVector(offV, camDist); camera.up.set(nose[0], nose[1], nose[2]); camera.lookAt(tgtV);
    } else {
    offV.copy(N).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(E, Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(U, Math.sin(camPitch));
    camera.position.copy(tgtV).addScaledVector(offV, camDist); camera.up.copy(U); camera.lookAt(tgtV); }
  }
  if (rocketG) { const t0 = performance.now(); updateFX(rdt, pdt, base, nose, isMap); fxMs += (performance.now() - t0 - fxMs) * 0.05; }
  mapLine.visible = isMap && state === 'flight'; marker.visible = bMarker.visible = isMap;
  if (isMap) {
    updateOrbitLine(O); setRel(marker, v.r, O); marker.scale.setScalar(R * mapZoom * 0.006);
    if (booster && booster.state === 'flying') { setRel(bMarker, booster.r, O); bMarker.scale.setScalar(R * mapZoom * 0.005); } else bMarker.visible = false;
  }
  stars.position.copy(camera.position);
  const k = Math.min(1, Math.max(0, h / 70000));
  const lit = updateSun(O, U, h, k, isMap); // sun direction, eclipse, sky colour, scattering, lights
  stars.material.opacity = isMap ? 1 : Math.min(1, Math.max(0, k * 1.4 - 0.3) + (1 - lit.day) * (1 - k) * 0.8);
  updateCine(rdt, h, isMap);
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
  if (mapOn) { smap.update(rdt); mapPost.render(); }
  else post.render();
});

// ---------- gx1: sun, sky, scattering, eclipse, plume light; cinematic shake and staging drama ----------
scene.fog = new THREE.FogExp2(0x9cc4ec, 2e-5); const cHaze = new THREE.Color(0xdde8f4);
const skyC = new THREE.Color(), cSky = new THREE.Color(0x3d7fe0), cHor = new THREE.Color(0xff8a3c), cNight = new THREE.Color(0x02040a);
function updateSun(O, U, h, k, isMap) {
  const sd = P.sunDir('earth', F.tAbs); sunDirV.set(sd[0], sd[1], sd[2]);
  sunL.position.copy(sunDirV); sunPos.value.copy(sunDirV).multiplyScalar(1e11);
  // eclipse: does the ray from the craft toward the Sun hit the Earth? (soft edge ~ the atmosphere's thickness)
  const cx = -O[0], cy = -O[1], cz = -O[2], tca = cx * sd[0] + cy * sd[1] + cz * sd[2], d2 = cx * cx + cy * cy + cz * cz - tca * tca;
  const shadow = tca > 0 ? Math.min(1, Math.max(0, (R + 30000 - Math.sqrt(Math.max(0, d2))) / 60000)) : 0, sunK = 1 - shadow;
  const el = U.x * sd[0] + U.y * sd[1] + U.z * sd[2], day = Math.min(1, Math.max(0, (el + 0.08) / 0.25)), dusk = Math.max(0, 1 - Math.abs(el - 0.02) / 0.18) * (1 - k);
  skyC.copy(cNight).lerp(cSky, day).lerp(cHor, dusk * 0.55).multiplyScalar(1 - k);
  scene.background = isMap ? skyC.setRGB(0, 0, 0.01) : skyC;
  // aerial perspective near the ground: exponential haze in the sky colour, thinning with altitude
  scene.fog.color.copy(skyC).lerp(cHaze, 0.35 * day); scene.fog.density = isMap ? 0 : 2.2e-5 * Math.exp(-h / 8000) * (h < 40000 ? 1 : 0);
  sunL.intensity = 3.0 * sunK; sunL.color.setRGB(1, 0.85 + 0.15 * (1 - dusk), 0.7 + 0.3 * (1 - dusk));
  hemi.intensity = (0.25 + 0.75 * day) * (1 - k * 0.75); scene.environmentIntensity = (0.35 + 0.65 * day) * (1 - 0.6 * k) * (0.3 + 0.7 * sunK);
  sunSprite.visible = !isMap && sunK > 0.02; sunSprite.position.copy(camera.position).addScaledVector(sunDirV, 5e7); sunSprite.scale.setScalar(5e7 * (0.12 + 0.1 * k)); sunSprite.material.opacity = sunK;
  const u = atmoMat.userData; atmo.position.set(cx, cy, cz); u.center.value.set(cx, cy, cz); u.sunDir.value.copy(sunDirV); u.Rp.value = R; u.Ra.value = ATMO_R;
  u.gain.value = isMap ? 0 : Math.min(1, Math.max(0, (h - 15000) / 45000)); atmo.visible = u.gain.value > 0.01;
  post.strength = 0.35 + 0.4 * k;
  return { day, sunK, dusk };
}
let shakeT = 0, shakeA = 0; const flashes = [];
const flashTex = GX.glowTexture(128);
function shake(a, t = 0.6) { shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, t); }
function flashAt(r, size, color = [8, 7, 5], life = 0.35) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: new THREE.Color(...color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.frustumCulled = false;
  sp.userData = { r: r.slice(), size, life, t: 0 }; scene.add(sp); flashes.push(sp);
}
function ignitionClouds(veh) { // ground steam/dust rolling out of the flame trench and across the pad
  const up = V.norm(veh.r), e = P.eastOf(veh.r), n = V.cross(up, e), base = V.sub(veh.r, V.scale(up, 2)), w = siteVel(veh);
  const N = QUALITY[fx.q].diamonds ? 70 : 34;
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 45, dir = V.add(V.scale(e, Math.cos(a)), V.scale(n, Math.sin(a)));
    smoke.spawn(V.addS(base, dir, 6 + Math.random() * 8), V.add(w, V.add(V.scale(dir, sp), V.scale(up, 3 + Math.random() * 8))), 5 + Math.random() * 5, 6, 26 + Math.random() * 18, Math.random() < 0.7 ? 0xf2f2f0 : 0xc9bba4, null, 0.35); }
  shake(1.0, 2.5);
}
function stagingDrama(at, vel, up) { // separation flash, sparks, ullage puffs on the upper stage
  flashAt(at, 14);
  for (let i = 0; i < 26; i++) fire.spawn(at, jit(vel, 25), 0.3 + Math.random() * 0.4, 0.4, 0.2, 0xffe2a0, 0x502000, 1.2);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, e1 = P.eastOf(at), side = V.norm(V.cross(up, e1)), dir = V.add(V.scale(e1, Math.cos(a)), V.scale(side, Math.sin(a)));
    const p0 = V.addS(at, up, 4); for (let j = 0; j < 4; j++) smoke.spawn(V.addS(p0, dir, 2), V.add(vel, V.add(V.scale(dir, 12), V.scale(up, -6))), 1.2 + Math.random(), 0.8, 4, 0xffffff, null, 0.05); }
  shake(0.35, 0.5);
}
function updateCine(rdt, h, isMap) {
  for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i], u = f.userData; u.t += rdt; const k = u.t / u.life;
    if (k >= 1) { scene.remove(f); f.material.dispose(); flashes.splice(i, 1); continue; }
    f.position.set(u.r[0] - v.r[0], u.r[1] - v.r[1], u.r[2] - v.r[2]); f.scale.setScalar(u.size * (0.6 + k * 1.6)); f.material.opacity = (1 - k) ** 2; }
  // plume light: lights the pad, ground and smoke near the ground, flickering with the throttle
  const on = state === 'flight' && !F.flags.dead && v.thrust > 0.01 && !isMap;
  plumeLight.intensity = on ? (h < 3000 ? 1 : Math.max(0, 1 - (h - 3000) / 20000)) * Math.min(1, v.thrust / 2000) * 5e3 * (0.85 + 0.3 * Math.random()) : 0;
  if (on) { const nose = P.noseOf(v); plumeLight.position.set(-nose[0] * 12, -nose[1] * 12, -nose[2] * 12); }
  // camera shake: engine rumble near the ground and through max-Q, plus event kicks; scaled by camera distance
  let a = shakeA * (shakeT > 0 ? 1 : 0);
  if (on && state === 'flight') a = Math.max(a, Math.min(1, v.thrust / 6000) * (h < 2000 ? 0.6 * (1 - h / 2000) : 0) + Math.min(0.35, (v.tel.q || 0) / 1e5));
  shakeT = Math.max(0, shakeT - rdt); if (shakeT <= 0) shakeA *= 0.9;
  if (a > 0.002 && !isMap && !SET.noShake) { const s = a * Math.min(1, 60 / Math.max(20, camDist)) * 0.9, t = performance.now() / 1000;
    camera.position.x += Math.sin(t * 47) * s * 0.6; camera.position.y += Math.sin(t * 53 + 1) * s * 0.6; camera.position.z += Math.sin(t * 41 + 2) * s * 0.4;
    camera.rotateZ(Math.sin(t * 37) * s * 0.004); }
}
window.__game = { gfx: { atmo: () => ({ vis: atmo.visible, gain: atmoMat.userData.gain.value, c: atmoMat.userData.center.value.toArray().map(Math.round), pos: atmo.position.toArray().map(Math.round), cam: camera.position.toArray().map(Math.round) }), renderState: () => ({ scene: GX.renderState.scene === scene ? 'flight' : GX.renderState.scene === smap.scene ? 'map' : '?', camera: GX.renderState.camera === camera ? 'flight' : GX.renderState.camera === smap.camera ? 'map' : '?', via: GX.renderState.via }), info: () => ({ q: gfxQ, bloom: post.on, tone: renderer.toneMapping, earthPx: !!earthPx, env: !!scene.environment }), setGfx, shake, flashAt },  BUILD, P, C, TEMPLATES, smap, scenario: (k, o) => runScenario(k, o), get F() { return F; }, get v() { return v; }, get flags() { return F.flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return F.ship; }, press, keys, get ignited() { return F.ignited; }, get warp() { return F.effWarp(); }, launch, goBuild, get design() { return design; }, setDesign: d => setDesign(cloneDesign(d)), get SG() { return SG; }, get camMode() { return camMode; }, warpStep, warpReset, warpMaxI, exitMap, get mapZoom() { return mapZoom; }, get academy() { return academy; }, fx, get fxState() { return lastFx; }, get fxMs() { return fxMs; }, setCam: (d, yaw, pitch, aim) => { camDist = d; if (aim !== undefined) camAim = aim; if (yaw !== undefined) camYaw = yaw; if (pitch !== undefined) camPitch = pitch; }, setFx, get verdictWorker() { return !!verdictWorker; }, syncStages, quicksave, quickload, revertLaunch, setPause, get paused() { return paused; }, get settings() { return SET; }, undo, redo, get hist() { return hist; }, qol, partTip, get envId() { return envId; }, setEnv: id => { envId = id; refreshBuild(); }, craftDv };
