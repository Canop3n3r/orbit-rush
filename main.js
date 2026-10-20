import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import * as P from './physics.js?v=f5a';
import { Flight, PRESETS, planBuild, assessDesign, SIM_SPEED, WARPS, shipPos, chuteLimits, SAFE_TOUCHDOWN, launchAzimuth, fmtDur } from './flight.js?v=f5a';
import * as C from './physics/patched.js?v=f5a';
import { loadMissions } from './missions/catalog.js';
import { missionDesign, applyMission, missionSession, missionHooks, missionFlightOpts, evaluate as evalOp, missionName as opName } from './missions/runner.js';
import { CAREER, CONTRACTS, missionOf } from './missions/campaign/career.js';
import { newCareer, canFly, applyFlight } from './missions/campaign/state.js';
import { saveTo, loadFrom } from './missions/campaign/save.js';
var opsList = [], opSess = null, opHooks = null, opFlightOpts = null, opContract = null; // f4 career/ops state (var: used by showPreview at boot)
import { loadBrand, applyBrandDom, B as brandB, vehicleName as brandVName, missionName as brandMName, label as brandLabel } from './brand/index.js?v=f5a';
import { createCareerUI } from './fun/career-ui.js?v=f5a';
import { SITE_NAMES } from './fun/ladder.js?v=f5a';
import { createSolarMap } from './solarmap.js?v=f5a';
import { PARTS, TEMPLATES, ORBIT_DV, TANK_DRY, splitStages, designStats, validate, cloneDesign, insertPart, removePart, movePart, setEngines, setSymmetry, swapStages, partMass, buildVehicle, aeroBalance, analyze } from './parts.js?v=f5a';
import { FX } from './fx.js?v=f5a';
import { createAcademy } from './academy-ui.js?v=f5a';
import { createMobile, isTouch } from './mobile.js?v=f5a';
import { localize } from './wording.js?v=f5a';
import { loadSettings, saveSettings, makeTranslator, fmtDist, fmtSpeed, History } from './settings.js?v=f5a';
import { createQoL, dvTableHTML } from './qol-ui.js?v=f5a';
const TOUCH = isTouch();
let PROG = PR.load(localStorage), fun = null; // f1 progress (localStorage) and the fun-layer UI (created further down)
// Milestone Q settings: key remap, sensitivity, units, overlays (settings.js; saved in localStorage)
let SET = loadSettings(localStorage), translate = makeTranslator(SET);
const fmtS = mps => fmtSpeed(mps, SET.units);
import { QUALITY, QUALITY_ORDER, plumeShape, plumeLook, skinGlow } from './fxmap.js?v=f5a';
import * as GX from './gfx/gfx.js?v=f5a';
import { Director, MISSIONS } from './fun/director.js?v=f5a';
import * as PR from './fun/progress.js?v=f5a';
import { ATLAS, nearestPoi } from './fun/lore.js?v=f5a';
import { createAudio } from './fun/audio.js?v=f5a';
import { createCompact } from './fun/compact.js?v=f5a';
import { createHome } from './fun/home.js?v=f5a';
import { SHOWROOM, bars as showBars, missionLabel } from './fun/showroom.js?v=f5a';
import { createFunUI } from './fun/ui.js?v=f5a';
import { buildLOD as heroLOD, prewarm as heroPrewarm, takeWarm } from './gfx/vehicles/vehicles.js?v=f5a';
import { dispose as heroDispose, release as heroRelease } from './gfx/vehicles/kit.js?v=f5a';
import { createClouds as w1Clouds, cloudUniforms as w1CU } from './gfx/world/clouds.js?v=w1';
import { worldTier } from './gfx/world/tiers.js?v=w1';
import { WS as W1_WS } from './gfx/world/common.js?v=w1';
import { createPlanetLOD } from './gfx/planetlod.js?v=f5a';
// Orbit Rush renderer + UI. All physics lives in physics/* (full-scale Earth, 6-DOF); this file only draws it.
// Rendering is camera-relative ("floating origin"): every frame the focused craft sits at the scene origin and
// everything else (the rotating Earth, pad, droneship, debris) is placed at (its ECI position − focus) computed
// in float64, so full-scale coordinates (6.4e6 m) never reach the GPU as large float32 numbers near the camera.
const { R, ATM, V } = P;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
export const BUILD = '2026-10-19-f3';
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
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 2e9);
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
const PAD_EF = [1, 0, 0], PAD_Z = 0.4, DECK = 3, PAD_LAND_COS = Math.cos(2500 / 6378137);
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
const planetGeo = new THREE.SphereGeometry(R - 600, 8, 4); /* f5: placeholder, the planetLOD draws the Earth */ planetGeo.rotateX(Math.PI / 2); planetGeo.applyMatrix4(GX.earthTexMatrix()); // f5: map LC-39A at the pad (+x)
const planet = new THREE.Mesh(planetGeo, GX.earthMaterial(gfxQ, sunPos));
// f5 (B): chunked quadtree terrain replaces the 147k-triangle sphere (same material + map mapping; single cheap sphere from high orbit)
const LOD_TIER = worldTier(gfxQ, TOUCH) === 'low' ? 'low' : gfxQ === 'high' ? 'high' : 'med';
const earthLOD = (() => { const m = GX.earthTexMatrix().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)); return createPlanetLOD({ radius: R - 600, material: planet.material, tier: LOD_TIER, uvM: new THREE.Matrix3().setFromMatrix4(m).invert() }); })();
earth.add(earthLOD.group); planet.visible = false; planet.geometry.dispose();
const bodyLODs = {}, _camL = new THREE.Vector3();
function lodFrame() { // camera position in each visible body's frame -> pick chunks
  if (earth.visible) { earth.updateMatrixWorld(); earthLOD.update(earth.worldToLocal(_camL.copy(camera.position))); }
  if (bodyG.visible && bodyCur && bodyCur !== 'sun') { let L = bodyLODs[bodyCur]; if (!L) { L = bodyLODs[bodyCur] = createPlanetLOD({ radius: P.BODIES[bodyCur].R - 60, material: bodyMat, tier: LOD_TIER, uvM: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2)).invert() }); bodyG.add(L.group); }
    for (const k in bodyLODs) bodyLODs[k].group.visible = k === bodyCur; bodySph.visible = false; bodyG.updateMatrixWorld(); L.update(bodyG.worldToLocal(_camL.copy(camera.position))); }
  else if (bodyCur === 'sun') { bodySph.visible = true; for (const k in bodyLODs) bodyLODs[k].group.visible = false; } }
const cloudGeo = new THREE.SphereGeometry(R + 7000, 192, 96); cloudGeo.rotateX(Math.PI / 2); cloudGeo.applyMatrix4(GX.earthTexMatrix());
const clouds = new THREE.Mesh(cloudGeo, GX.cloudMaterial(gfxQ, sunPos));
// f5: world-1 cloud layer (Art bot) behind the 'world1' quality setting (localStorage or_world1 / ?world1=0|1, default on).
// Tier from worldTier(): phones and low gfx get the 2D layer, desktop med/high the volumetric one. Modules are km; the game is metres.
const W1 = (() => { const q = params.get('world1'); let on = q != null ? q !== '0' : (() => { try { return localStorage.getItem('or_world1') !== '0'; } catch (e) { return true; } })();
  if (!on) return null;
  try { W1_WS.value = 0.001; const U = w1CU({ R: R / 1000 }), tier = worldTier(gfxQ, TOUCH);
    const c = w1Clouds({ weatherTex: GX.tex('earth_clouds', gfxQ, false), tier, R: R / 1000, U });
    const g = new THREE.Group(); g.scale.setScalar(1000); g.add(c.mesh); scene.add(g); clouds.visible = false; clouds.userData.w1 = true;
    const ep = new THREE.Vector3(), cp = { position: new THREE.Vector3(), cam: null, getWorldDirection(v) { return this.cam ? this.cam.getWorldDirection(v) : v.set(0, 0, -1); } }, geoM = GX.earthTexMatrix().multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), fm = new THREE.Matrix4();
    c.mesh.onBeforeRender = (r, sc, cam) => { earth.getWorldPosition(ep); g.position.copy(ep); g.updateMatrixWorld(); U.center.value.copy(ep).multiplyScalar(0.001); };
    return { c, g, U, tier, frame(dt, cam) { earth.getWorldPosition(ep); g.position.copy(ep); U.center.value.copy(ep).multiplyScalar(0.001); c.setSun(sunDirV); fm.extractRotation(earth.matrixWorld).multiply(geoM).invert(); U.frame.value.setFromMatrix4(fm); cp.cam = cam; cp.position.copy(cam.position).multiplyScalar(0.001); c.update(dt, cp);
      // world-2: the rocket punches a hole in the cloud deck during ascent (capsule in km: the module works in km, the game in metres)
      if (c.setOccluder && (W1.occT = (W1.occT || 0) + 1) % 8 === 0) { const low = typeof v !== 'undefined' && v && state === 'flight' && P.altOf(v) < 15000;
        if (low && rocketG) { c.setOccluder(rocketG, rocketG.up); U.capA.value.multiplyScalar(0.001); U.capB.value.multiplyScalar(0.001); } else c.setOccluder(null); }
      // below 50 km the game's own cloud layer (near-camera cloud cells, tuned ground variation) stays; world-1 takes over for high/orbit views
      const hi = cp.position.distanceTo(U.center.value) - U.R.value > 50; g.visible = earth.visible && hi; clouds.visible = !hi; } };
  } catch (e) { console.warn('world1 off', e); return null; } })();
earth.add(clouds);
// f1u2: the flight view only ever drew the Earth, at −O. Away from Earth, O is relative to the SOI body, so the
// Earth sphere sat where the Moon should be (camera inside it in low lunar orbit). Now the current SOI body gets its
// own sphere at −O and the Earth is drawn where it really is.
const bodyTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 256);
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) { const x = rnd() * 512, y = 20 + rnd() * 216, r = Math.pow(rnd(), 3) * 26 + 1.5, l = 150 + rnd() * 90; g.fillStyle = `rgba(${l|0},${l|0},${l|0},${0.25 + rnd() * 0.35})`; g.beginPath(); g.ellipse(x, y, r / Math.max(0.3, Math.sin(y / 256 * Math.PI)) * 0.6, r * 0.6, 0, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t; })();
const bodyG = new THREE.Group(); scene.add(bodyG); bodyG.visible = false;
const bodyMat = new THREE.MeshStandardMaterial({ map: bodyTex, roughness: 0.95, metalness: 0 });
const bodyGeo = new THREE.SphereGeometry(1, 384, 192); bodyGeo.rotateX(Math.PI / 2);
const bodySph = new THREE.Mesh(bodyGeo, bodyMat); bodyG.add(bodySph);
const bodyGround = new THREE.Mesh(new THREE.CircleGeometry(8000, 64), bodyMat); bodyGround.visible = false; scene.add(bodyGround);
const _bAbs = (id, t) => { let r = [0, 0, 0]; for (let b = id; b && P.BODIES[b] && P.BODIES[b].parent; b = P.BODIES[b].parent) r = V.add(r, P.relState(b, t).r); return r; };
let bodyCur = null;
function placeBodies(O, th) { // returns false when the current SOI is the Earth (old path)
  const id = F && F.body || 'earth';
  if (id === 'earth') { bodyG.visible = bodyGround.visible = false; earth.visible = true; return false; }
  const b = P.BODIES[id]; if (bodyCur !== id) { bodyCur = id; bodyMat.color.set(BODY_COL[id] || '#999'); bodyMat.emissive.set(id === 'sun' ? '#ffb040' : '#000'); bodyMat.emissiveIntensity = id === 'sun' ? 2 : 0;
    // arriving at a new world: tip the chase camera so its limb is in frame (the player can still drag)
  }
  if (id !== 'sun' && camMode === 'chase' && performance.now() - camUserT > 8000) { const dep = Math.acos(Math.min(1, b.R / Math.max(b.R, V.len(O)))), want = Math.min(1.3, Math.max(0.12, dep - 0.12)); const nw = performance.now(), dt = Math.min(0.5, (nw - (placeBodies.t || nw)) / 1000); camPitch += (want - camPitch) * (1 - Math.exp(-dt * 2)); }
  placeBodies.t = performance.now();
  const Rb = b.R; bodySph.scale.setScalar(Rb - 60); bodyG.position.set(-O[0], -O[1], -O[2]); bodyG.visible = true;
  const e = V.sub(_bAbs('earth', F.tAbs), _bAbs(id, F.tAbs)); earth.position.set(e[0] - O[0], e[1] - O[1], e[2] - O[2]); earth.rotation.z = th; earth.visible = V.len(e) > Rb * 2;
  const alt = V.len(O) - Rb; bodyGround.visible = alt < 30000 && alt > -500;
  if (bodyGround.visible) { const u = V.norm(O); bodyGround.position.set(u[0] * Rb - O[0], u[1] * Rb - O[1], u[2] * Rb - O[2]); bodyGround.lookAt(bodyGround.position.x + u[0], bodyGround.position.y + u[1], bodyGround.position.z + u[2]); }
  return true;
}
const ATMO_R = R + 110000, atmoMat = GX.atmoMaterial({ R, Ra: ATMO_R });
const atmo = new THREE.Mesh(new THREE.SphereGeometry(ATMO_R, 128, 64), atmoMat); atmo.frustumCulled = false; scene.add(atmo); // scene-level: placed at the Earth centre each frame
const mwTex = GX.tex('milkyway', gfxQ); const stars = new THREE.Mesh(new THREE.SphereGeometry(1e8, 48, 24), new THREE.MeshBasicMaterial({ map: mwTex, color: new THREE.Color(1.3, 1.3, 1.4), side: THREE.BackSide, transparent: true, depthWrite: false })); stars.rotation.set(1.1, 0.4, 0.2); stars.renderOrder = -10; // f1: sky first, so it never paints over the plume and other transparent effects
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
  tileGeo.setAttribute('wat', new THREE.BufferAttribute(new Float32Array(n), 1)); // f5: water mask (0 land .. 1 sea) drives colour + specular
  for (let j = 0; j < TNS; j++) idx.push(0, 1 + j, 1 + (j + 1) % TNS);
  for (let i = 0; i < TNR - 1; i++) for (let j = 0; j < TNS; j++) { const a = 1 + i * TNS + j, b = 1 + i * TNS + (j + 1) % TNS, c = a + TNS, d = b + TNS; idx.push(a, c, b, b, c, d); }
  tileGeo.setIndex(idx);
  const nrm = new Float32Array(n * 3); for (let k = 0; k < n; k++) nrm[k * 3 + 1] = 1; tileGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); } // normals exist before the first compile
const tile = new THREE.Mesh(tileGeo, GX.tileMaterial()); tile.frustumCulled = false; earth.add(tile);
let tileC = null, earthPx = null; GX.earthPixels(gfxQ).then(px => { earthPx = px; tileC = null; });
const tileRGBA = [0, 0, 0, 0];
function updateTile(ef) {
  if (tileC && V.dot(tileC, ef) > Math.cos(25000 / R)) return;
  const c = V.norm(ef), e = P.eastOf(c), nn = V.cross(c, e), pos = tileGeo.attributes.position.array, col = tileGeo.attributes.color.array, wat = tileGeo.attributes.wat.array, rgb = [0, 0, 0];
  tileC = c; tile.position.set(c[0] * R, c[1] * R, c[2] * R);
  const put = (k, th, ph) => {
    const s = Math.sin(th), cm1 = -2 * Math.sin(th / 2) ** 2, dx = Math.cos(ph) * s, dy = Math.sin(ph) * s;
    const off = [c[0] * cm1 + e[0] * dx + nn[0] * dy, c[1] * cm1 + e[1] * dx + nn[1] * dy, c[2] * cm1 + e[2] * dx + nn[2] * dy];
    pos[k * 3] = off[0] * R; pos[k * 3 + 1] = off[1] * R; pos[k * 3 + 2] = off[2] * R;
    const dd = V.norm(V.add(c, off));
    if (earthPx) { GX.sampleEarth(earthPx, dd, tileRGBA); if (dd[0] > PAD_LAND_COS) tileRGBA[3] = Math.min(tileRGBA[3], 0.3); /* f5: the 1k mask's coastal texel at LC-39A is mixed; the pad complex is land */ const f = (0.8 + 0.4 * fbm(dd[0] * 2400, dd[1] * 2400, dd[2] * 2400)) * 2.4, w = tileRGBA[3]; // licensed day map + fine variation on land
      col[k * 3] = tileRGBA[0] * (w > 0.5 ? 1 : f); col[k * 3 + 1] = tileRGBA[1] * (w > 0.5 ? 1 : f); col[k * 3 + 2] = tileRGBA[2] * (w > 0.5 ? 1 : f); wat[k] = w; }
    else { planetColor(dd, rgb, true); col[k * 3] = (rgb[0] / 255) ** 2.2; col[k * 3 + 1] = (rgb[1] / 255) ** 2.2; col[k * 3 + 2] = (rgb[2] / 255) ** 2.2; }
  };
  put(0, 0, 0);
  for (let i = 0; i < TNR; i++) { const th = TILE_R / R * ((i + 1) / TNR) ** 1.8; for (let j = 0; j < TNS; j++) put(1 + i * TNS + j, th, 2 * Math.PI * j / TNS); }
  tileGeo.attributes.position.needsUpdate = true; tileGeo.attributes.color.needsUpdate = true; tileGeo.attributes.wat.needsUpdate = true; tileGeo.computeVertexNormals();
}
onSurface(buildLaunchComplex(), PAD_EF, 0);

// ---------- rocket meshes: one THREE.Group per stage, sized from the same part geometry the physics uses ----------
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, ...(GX.GFX[gfxQ].normalMaps ? { normalMap: GX.panelNormal(), normalScale: new THREE.Vector2(0.6, 0.6) } : {}) }),
  black: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.62, metalness: 0.2 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 0.28, metalness: 1.0 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.5, metalness: 0.5 }),
  plume: new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeGlow: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.25, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeBell: new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffb27a, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeSprite: new THREE.SpriteMaterial({ map: GX.glowTexture(), color: new THREE.Color(5, 3.2, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
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
function makePlume(w) { // f1 layered exhaust: outer glow, mid flame, hot core, vacuum bell, shock diamonds, nozzle glow
  const g = new THREE.Group(), cone = (rw, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.ConeGeometry(rw, 1, seg, 1, true), mat); m.rotation.x = Math.PI; m.position.y = -0.5; g.add(m); return m; };
  const glow = cone(w, M.plumeGlow), outer = cone(w, M.plume), core = cone(w * 0.5, M.plumeCore, 16);
  // underexpanded bell: a lathe that flares from the nozzle rim into a wide, soft "jellyfish" (scaled by plumeLook().bellW)
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(w * (0.9 + Math.sin(t * Math.PI * 0.62) * 1.0 + t * 0.15), -t)); }
  const bg = new THREE.LatheGeometry(pts, 32), pa = bg.attributes.position, col = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) { const k = Math.pow(1 + pa.getY(i), 1.6); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; } // additive: fades to nothing at the rim
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const bell = new THREE.Mesh(bg, M.plumeBell); g.add(bell);
  const dia = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(w * 0.32, 12, 8), M.diamond); m.scale.y = 0.45; dia.add(m); }
  const noz = new THREE.Sprite(M.plumeSprite); noz.position.y = -0.3; g.add(noz);
  g.add(dia); g.userData = { dia, w, glow, outer, core, bell, noz };
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
    this.n = n; this.add = additive; this.i = 0; this.d = Array.from({ length: n }, () => ({ life: 0, shown: false }));
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
      const fade = p.c1 === null || !this.add ? (t > 0.7 ? (1 - t) / 0.3 : 1) : 1;
      this.p.set(p.x - O[0], p.y - O[1], p.z - O[2]); this.s.setScalar(s * fade);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, q, this.s));
      if (p.c1 !== null) { this.c.setHex(p.c0); this.c.lerp(this.c2.setHex(p.c1), t); } else this.c.setHex(p.c0);
      this.mesh.setColorAt(i, this.c);
    }
    if (dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
}
const fire = new Particles(450, true), smoke = new Particles(TOUCH ? 900 : 1600, false);
const rnd = s => (Math.random() - 0.5) * s, jit = (a, s) => [a[0] + rnd(s), a[1] + rnd(s), a[2] + rnd(s)];

// ---------- audio ----------
const funAudio = createAudio(() => ac ? { ac, master } : null);
let ac, rumble, rumbleF, master;
function noiseBuf(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; }
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; } ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); funAudio.apply(); // f3: since f1 the master gain was wired to itself, so nothing reached the speakers
  const src = ac.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true;
  rumbleF = ac.createBiquadFilter(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 300;
  rumble = ac.createGain(); rumble.gain.value = 0; src.connect(rumbleF).connect(rumble).connect(master); src.start();
}
// f3: unlock on the first gesture anywhere (iOS needs resume() inside the touch handler) and resume after the tab comes back
for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, () => { if (!ac || ac.state !== 'running') initAudio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => {}); });
function burst(vol, dur, freq) {
  if (!ac) return; const s = ac.createBufferSource(); s.buffer = noiseBuf(dur); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f).connect(g).connect(master); s.start();
}
function beep(f = 880) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25); o.connect(g).connect(master); o.start(); o.stop(ac.currentTime + 0.3); }
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
const BUILD_OPEN = {};
{ // f4: hangar launch settings fold into one row (phones) so the rocket stays visible above the sheet
  const tr = document.querySelector('#build .trow'), labs = tr ? [...tr.querySelectorAll(':scope > label.chk')] : [];
  if (labs.length) { const d = document.createElement('details'); d.className = 'bset'; d.innerHTML = '<summary>⚙ Launch &amp; graphics settings</summary>'; labs.forEach(l => d.appendChild(l)); tr.insertBefore(d, tr.querySelector('.saved')); if (!(TOUCH && innerWidth < 600)) d.open = true; }
  const lb = document.getElementById('launchBtn'), bp = document.getElementById('build'); if (lb && bp && innerWidth < 600 && innerHeight > innerWidth) { lb.classList.add('stickyLaunch'); bp.appendChild(lb); } }
// f4: camera distance that fits a stack of length L into `frac` of the screen height (fov-aware, slim rockets fill the frame)
function fitDist(L, frac) { const vf = (camera.fov || 50) * Math.PI / 180; return Math.max(18, L / frac / (2 * Math.tan(vf / 2))); }
function buildPalette() {
  const el = $('palette'); el.innerHTML = ''; let lastH = '';
  const phoneB = TOUCH && innerWidth < 600; let grp = el, gi = 0; // f4: collapsible categories (phones start with only the first open)
  for (const [type, head] of TYPE_ORDER) {
    if (head !== lastH) { const h = document.createElement('button'); h.className = 'palH'; h.type = 'button'; h.textContent = head; el.appendChild(h); lastH = head;
      grp = document.createElement('div'); grp.className = 'palG'; el.appendChild(grp);
      const shut = BUILD_OPEN[head] !== undefined ? !BUILD_OPEN[head] : (phoneB && gi > 0); gi++;
      h.classList.toggle('shut', shut); grp.classList.toggle('shut', shut);
      h.onclick = (g => () => { const now = !g.classList.contains('shut'); g.classList.toggle('shut', now); h.classList.toggle('shut', now); BUILD_OPEN[head] = !now; })(grp); }
    for (const [id, d] of Object.entries(PARTS)) if (d.type === type) {
      const t = document.createElement('div'); t.className = 'tile'; t.draggable = true;
      t.innerHTML = `<i style="background:${TYPE_COL[type]}"></i><b>${d.name}</b><small>${partStat(id)}</small>`; qol.attachTip(t, () => partTip(id) + '<div class="sm">Click to add above the selected part, or drag into the stack.</div>', TOUCH);
      t.onclick = () => { if (!dragEaten()) addPart(id); }; touchDrag(t, 'new:' + id); t.ondragstart = e => { e.dataTransfer.setData('text/plain', 'new:' + id); e.dataTransfer.effectAllowed = 'copy'; };
      t.dataset.id = id; if (partLock(id)) { t.classList.add('locked'); t.title = 'Locked — earn it with contracts'; } grp.appendChild(t);
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
// f5: a part is open once either the old contract chain or the career ladder unlocked it (sandbox: all)
function partLock(id) { return PR.partLocked(PROG, id) && (!careerUI || careerUI.locked('parts', id)); }
function addPart(id) { if (partLock(id)) { toast('🔒 Locked — complete contracts in 🎯 Missions to unlock this part', '#ffb35c'); return; } snapAnim = 1; funAudio.ui('snap'); lastAdded = selected < 0 ? design.parts.length : selected; if (selected < 0) setDesign(insertPart(design, id, design.parts.length), true); else { const at = selected; selected = -1; design = insertPart(design, id, at); selected = at + 1; refreshBuild(); } }
function dropAt(data, at) { if (data.startsWith('new:') && partLock(data.slice(4))) { toast('🔒 Locked part', '#ffb35c'); return; } snapAnim = 1; funAudio.ui('snap'); lastAdded = at;
  if (data.startsWith('new:')) { design = insertPart(design, data.slice(4), at); if (selected >= at) selected++; }
  else if (data.startsWith('move:')) { const from = +data.slice(5); const to = from < at ? at - 1 : at; design = movePart(design, from, to); selected = -1; }
  refreshBuild();
}
let lastAdded = -1;
function renderStack(stats) { setTimeout(() => { lastAdded = -1; }, 0);
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
      row.className = 'prow' + (i === lastAdded ? ' snap' : '') + (i === selected ? ' sel' : '') + (d.type === 'decoupler' ? ' dec' : '') + (radK && !d.radial ? ' radial' : ''); row.draggable = true;
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
    ${fun ? fun.paintRow() : ''}
    <div class="ghostH">🔮 Will it fly? <small>AUTO's flight, simulated</small></div><canvas id="ghost" width="460" height="150"></canvas>
    <div id="verdict" class="msg">${val.ok ? 'AUTO test flight: simulating…' : ''}</div><div id="landPlan" class="msg"></div>
    ${aeroLine()}
    <div class="small">Stage 1 TWR is at sea level, upper stages in vacuum. Δv uses mean Isp for stage 1. Full-scale Earth: orbit is ~7.8 km/s plus ~1.5 km/s of gravity, drag and steering losses.</div>`;
  if (fun) fun.wirePaint(ch => { Object.assign(design, ch); refreshBuild(); });
  $('envSel').value = envId; $('envSel').onchange = e => { envId = e.target.value; refreshBuild(); };
  $('dvMapLink').onclick = e => { e.preventDefault(); qol.openDv(); };
  $('launchBtn').disabled = !val.ok; $('launchBtn').textContent = val.ok ? 'ROLL TO PAD ▶' : 'Fix the design to launch';
  clearTimeout(planTimer); const key = JSON.stringify(design.parts);
  if (val.ok) planTimer = setTimeout(() => { // fly the design on AUTO headlessly (Web Worker): verdict + booster-landing advice
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    requestVerdict(design, (a, p) => {
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    $('verdict').innerHTML = `<span class="${a.level}">${a.text}</span>`;
    if ($('ghost') && fun && fun.drawGhost) { fun.drawGhost.t0 = performance.now(); fun.drawGhost($('ghost'), a.track, a.level); }
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
    verdictWorker = new Worker(new URL('./worker.js?v=f5a', import.meta.url), { type: 'module' });
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
let state = 'build', F, v, booster, booster2 = null, shipVis2 = null, rocketG, SG = [], camMode, gen = 0;
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
  stage: (b, parts) => { const g = detachStage(b.stageIndex ?? 0); booster = b; booster2 = null;
    if (parts && parts[1]) { const [mA, mB] = splitSideMesh(g); parts[0].mesh = mA; parts[1].mesh = mB; booster2 = parts[1]; } else b.mesh = g; // f4.2: one mesh per side booster
    stagingDrama(v.r, v.v, P.noseOf(v)); },
  drop: d => { if (opHooks) try { opHooks.drop(d); } catch (e) {} d.mesh = detachStage(d.stageIndex); d.t = 0; d.spin = [rnd(0.6), rnd(0.6)]; debris.push(d); stagingDrama(v.r, v.v, P.noseOf(v)); },
  ship: s => { if (s.lz) { if (s.name === 'LZ-2') shipVis2 = makeLZ(s); else shipVis = makeLZ(s); return; } shipVis = makeShip(s); }, // RTLS: the landing zone is the pad area, no droneship
  shipMoved: s => shipVis && onSurface(shipVis, s.ef, 0),
  jettison: () => { heroFairing(false); const f = SG[SG.length - 1].userData.fair; if (f) { f.visible = false; const p = V.sub(v.r, V.scale(P.noseOf(v), -10)); for (let k = 0; k < 12; k++) smoke.spawn(p, jit(v.v, 15), 1.5, 1, 3, 0xffffff, null, 0.1); } beep(990); },
  // keys held for the booster must not leak into the upper stage (and vice versa) when control switches
  boosterControl: manual => { for (const k in keys) keys[k] = false; if (manual) { camMode = 'booster'; camDist = 160; } else camMode = 'chase'; $('tProg').classList.toggle('on', F.autoOn); },
  boosterLost: (b, moving) => { explode(b.r, moving ? b.v : siteVel(b), false); b.mesh.visible = false; b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  boosterLanded: b => { b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  fail: () => { explode(v.r, v.v, true, true); rocketG.visible = false; slowMo = 2.5; },
  soi: (from, to) => { if (!PROG.visited.includes(to)) { PROG.visited.push(to); PR.save(localStorage, PROG); fun.reveal(to); } else fun.call('🪐', 'Entering ' + P.BODIES[to].name + ' space', '#9cc3ff'); },
  chute: st => { if (st === 'failed') for (let k = 0; k < 30; k++) smoke.spawn(V.sub(v.r, V.scale(P.noseOf(v), -stackL() * 0.5)), jit(v.v, 12), 2, 1, 4, 0xff7a3c, null, 0.6); },
  recovered: () => { const up = V.norm(v.r); for (let k = 0; k < 60; k++) smoke.spawn(v.r, V.add(siteVel(v), V.add(V.scale(up, 4 + Math.random() * 10), [rnd(10), rnd(10), rnd(10)])), 2 + Math.random() * 2, 2, 9, 0xeaf4ff, null, 0.9); },
  end: (ms, cond) => later(() => { if (cond()) { if (academy && academy.active) academy.onEnd(); else showEnd(); } }, ms),
};
// Move a spent stage out of the rocket into the world; the rest of the stack drops down to the new bottom.
// f4.2: the detached side pair is one group (both columns + struts). Make one holder per side booster: a deep copy
// with only that side's meshes visible, re-centred on that column so each sim's r is its own booster's centre.
function splitSideMesh(g) {
  g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), bx = new THREE.Box3(), c = new THREE.Vector3();
  const sideOf = o => { bx.setFromObject(o).applyMatrix4(inv); bx.getCenter(c); return [c.x, c.z]; };
  let ax = 0, mx = 0; g.traverse(o => { if (o.isMesh && !isPlumeChild(o, g)) { const [x, z] = sideOf(o); if (Math.abs(x) > mx) { mx = Math.abs(x); ax = 0; } if (Math.abs(z) > mx) { mx = Math.abs(z); ax = 1; } } });
  const make = (src, sgn, orig) => { const holder = new THREE.Group(), k = src;
    if (orig) { const a = [], b = []; orig.traverse(o => a.push(o)); k.traverse(o => b.push(o)); const map = new Map(a.map((o, i) => [o, b[i]]));
      const fix = x => x && x.isObject3D ? (map.get(x) || x) : Array.isArray(x) ? x.map(fix) : x; // clone() deep-copies userData as JSON: re-link every Object3D reference
      a.forEach((o, i) => { const u = {}; for (const key in o.userData) u[key] = fix(o.userData[key]); b[i].userData = u; }); }
    k.updateMatrixWorld(true); const ki = new THREE.Matrix4().copy(k.matrixWorld).invert(); let off = 0, nOff = 0;
    k.traverse(o => { if (!o.isMesh || isPlumeChild(o, k)) return; bx.setFromObject(o).applyMatrix4(ki); bx.getCenter(c); const q = ax ? c.z : c.x;
      if (Math.abs(q) < mx * 0.3) { o.visible = false; return; } /* struts/core-side bits drop away */ if (Math.sign(q) !== sgn) o.visible = false; else if (o.visible) { off += q; nOff++; } });
    off = nOff ? off / nOff : 0; if (ax) k.position.z = -off; else k.position.x = -off;
    const pl = k.userData.plume; if (pl) { if (ax) pl.position.z += off; else pl.position.x += off; if (pl.userData.extra) { for (const e of pl.userData.extra) e.visible = false; pl.userData = { ...pl.userData, extra: [] }; } } // one plume, under this column
    holder.add(k); holder.userData = k.userData; scene.add(holder); return holder; };
  const gB = g.clone(true); scene.remove(g); const B = make(gB, 1, g), A = make(g, -1, null); return [A, B];
}
function detachStage(i) {
  if (v) WV.seps.push({ r: v.r.slice(), t: performance.now() }); WV.pulse = performance.now();
  const hc = heroPiece(i); heroStage(i + 1); const g = SG[i]; rocketG.remove(g); scene.add(g); if (hc) g.add(hc); g.position.set(0, 0, 0); g.userData.plume.visible = false; for (const e of g.userData.plume.userData.extra || []) e.visible = false; burst(0.5, 0.6, 1500); beep(660);
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
  F = new Flight(validate(design).ok ? design : TEMPLATES[0], hooks, { padZ: PAD_Z, earthRot, incl: launchIncl, epoch: EPOCH, ...(opFlightOpts || {}) }); v = F.v;
  rocketG.add(comMark, copMark, cotMark);
  fx.attach(rocketG); chuteVis = makeChutes(); rocketG.add(chuteVis);
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
  applyPaint(design); if (SG[0]) addDecal(SG[0], design);
  attachHero();
}
// f4 model swap: the hero model stands in for the part meshes (same stack height); part groups keep plumes/staging logic
let hero = null;
const HERO_READY = new Map(), HERO_WARM = new Set();
function prewarmHeavy() { // rockets-3: build the heavy hero LODs in idle slices while the player sits in the home/hangar
  const ids = ['heron-heavy', 'titan-ss-v3', 'titan-ss-v4'].filter(id => !HERO_READY.has(id + (TOUCH ? ':p' : '')));
  const W = heroPrewarm(ids, { phone: TOUCH });
  for (const id of ids) { const k = id + (TOUCH ? ':p' : ''), p = W.get(k); if (!p || HERO_WARM.has(k)) continue; HERO_WARM.add(k); p.then(l => { if (HERO_WARM.has(k)) { HERO_READY.set(k, l); HERO_WARM.delete(k); W.delete(k); } }).catch(() => HERO_WARM.delete(k)); } }
function attachHero() {
  if (hero) { const old = hero; hero = null; heroRelease(old, renderer, scene, camera).catch(() => heroDispose(old)); } // rockets-3: leak-safe swap
  if (!design.model || !SG.length) return;
  const wk = design.model + (TOUCH ? ':p' : ''); // rockets-3: heavy models are prewarmed at the hangar; take a finished one if ready
  try { hero = HERO_READY.get(wk) || heroLOD(design.model, { phone: TOUCH }); HERO_READY.delete(wk); if (HERO_WARM.has(wk)) { takeWarm(design.model, { phone: TOUCH }); HERO_WARM.delete(wk); } } catch (e) { console.warn('[Orbit Rush] hero model', e); hero = null; return; }
  let L = 0; try { L = P.stackGeom(v).L; } catch (e) {} if (!(L > 0)) for (const g of SG) L += g.userData.h; const hH = new THREE.Box3().setFromObject(hero.userData.hi || hero).getSize(new THREE.Vector3()).y || L;
  hero.scale.setScalar(L / hH); rocketG.add(hero);
  for (const g of SG) g.traverse(o => { if (o.isMesh && !isPlumeChild(o, g)) o.visible = false; });
}
function isPlumeChild(o, g) { const pl = g.userData.plume, ex = (pl && pl.userData.extra) || []; for (let p = o; p && p !== g; p = p.parent) if (p === pl || ex.includes(p)) return true; return false; }
function heroPiece(i) { // a copy of the dropped hero stage rides on the detached part group (debris / booster cam)
  if (!hero || !hero.userData.hi) return null; const st = hero.userData.hi.userData.stages || {}, heavy = design.model === 'heron-heavy';
  const keys = (heavy ? [['side0', 'side1', 'struts'], ['booster'], ['upper']] : [['booster'], ['upper']])[i] || []; const grp = new THREE.Group();
  let y0 = 0; for (let j = 0; j < i; j++) y0 += SG[j].userData.h;
  for (const k of keys) if (st[k]) { const c = st[k].clone(); grp.add(c); }
  if (!grp.children.length) return null; grp.scale.copy(hero.scale); grp.position.y = -y0; return grp;
}
function heroFairing(on) { if (!hero) return; for (const lv of hero.levels || [{ object: hero }]) { const st = (lv.object.userData && lv.object.userData.stages) || {}; if (st.payload && !/titan/.test(design.model)) st.payload.visible = on; } } // the hero 'payload' group is the fairing shell
function heroStage(cur) { // hide the stages already dropped, on every LOD level (rockets-2 @15b1836)
  if (!hero) return; { let y0 = 0; for (let j = 0; j < cur && j < SG.length; j++) if (!SG[j].userData.radial) y0 += SG[j].userData.h; hero.position.y = -y0; } // f4: the stack drops with the stages, like the part groups
  const heavy = design.model === 'heron-heavy';
  const gone = heavy ? [['side0', 'side1', 'struts'], ['booster'], ['upper']] : [['booster'], ['upper']];
  for (const lv of hero.levels || [{ object: hero }]) { const st = (lv.object.userData && lv.object.userData.stages) || {};
    for (let j = 0; j < gone.length; j++) for (const k of gone[j]) if (st[k]) st[k].visible = j >= cur; }
}
// f1 paint shop + decals: the shared hull/accent materials take the design's paint; a canvas decal (symbol + name)
// is wrapped on the first stage
function applyPaint(d) { const pt = PR.PAINTS[d.paint] || PR.PAINTS.classic; M.white.color.setHex(pt.body); M.black.color.setHex(pt.accent); }
function addDecal(g, d) {
  const sym = PR.DECALS[d.decal] || '', name = (d.name || '').slice(0, 18); if (!sym && !name) return;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); const pt = PR.PAINTS[d.paint] || PR.PAINTS.classic;
  x.fillStyle = '#' + pt.accent.toString(16).padStart(6, '0'); x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${sym} ${name.toUpperCase()}`.trim(), 256, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // f4.1b: wrap the decal on the hull at its own height (the whole group's box includes fins/legs → a floating ring)
  const h = g.userData.h, yd = h * 0.62; g.updateMatrixWorld(true); const gi = new THREE.Matrix4().copy(g.matrixWorld).invert(); let r = 1e9;
  g.traverse(o => { if (!o.isMesh || isPlumeChild(o, g)) return; const b = new THREE.Box3().setFromObject(o).applyMatrix4(gi); if (b.min.y <= yd && b.max.y >= yd) { const hw = Math.min(b.max.x - b.min.x, b.max.z - b.min.z) / 2; if (hw > 0.3) r = Math.min(r, hw); } });
  if (!(r < 1e8)) { const bb = new THREE.Box3().setFromObject(g); r = Math.max(0.6, (bb.max.x - bb.min.x) / 2 - 0.1); }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, Math.min(6, h * 0.3), 32, 1, true, -Math.PI * 0.5, Math.PI), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false }));
  m.rotation.y = Math.PI / 2; m.position.y = yd; m.renderOrder = 3; g.add(m);
}
// Re-stack the visible stage groups from v.cur (used after F.placeInOrbit in the ?scenario=orbit start)
function syncStages() {
  for (let j = 0; j < v.cur && j < SG.length; j++) SG[j].visible = false; heroStage(v.cur);
  let y = 0; for (let j = v.cur; j < SG.length; j++) { SG[j].position.y = y; y += SG[j].userData.h; }
  const f = SG.length && SG[SG.length - 1].userData.fair; if (f && v.fairing <= 0) f.visible = false; if (v.fairing <= 0) heroFairing(false);
}
let chuteVis = null;
function reset() {
  gen++;
  if (booster && booster.mesh) scene.remove(booster.mesh);
  for (const d of debris) scene.remove(d.mesh); debris.length = 0;
  if (shipVis) earth.remove(shipVis); if (shipVis2) earth.remove(shipVis2); shipVis2 = null; if (booster2 && booster2.mesh) scene.remove(booster2.mesh); booster2 = null;
  shipVis = null; booster = null; camMode = 'chase'; try { director = null; replay = null; slowMo = 0; recBuf.length = 0; for (const k in seen) delete seen[k]; dirPhase = ''; } catch (e) { }
  try { split.rec.length = 0; split.done = 0; split.closed = false; split.replay = null; split.full = null; } catch (e) { } if (typeof smap !== 'undefined') smap.reset();
  camDist = Math.min(fitDist(stackL(), 0.62), 140); camYaw = 0.5; camPitch = 0.12; mapZoom = 2.8; camAim = 0.5; // f4 pad framing
  fire.clear(); smoke.clear(); for (const k in keys) keys[k] = false;
  if (swingArm) swingArm.rotation.y = 0;
  $('end').classList.add('hidden'); $('toasts').innerHTML = '';
  showPreview();
}
function launch() { academy.hideFirst && academy.hideFirst();
  if (typeof home !== 'undefined' && home && home.on) home.show(false);
  initAudio(); reset(); state = 'flight'; mobile.buzzed = false;
  const sc = params.get('scenario');
  if (['moon', 'moonsoi', 'mars', 'solar'].includes(sc) && !launch.busy) { launch.busy = true; try { runScenario(sc); } finally { launch.busy = false; } return; }
  if (sc === 'orbit' || sc === 'reentry') { // dev/test start: the capsule stack parked in orbit (optionally already deorbiting)
    F.placeInOrbit(+(params.get('alt') || 170000)); syncStages(); camDist = 60;
    if (sc === 'reentry') F.deorbit();
  }
  if (academy && academy.active) { // lesson start states (on the pad, mid-air, or in orbit)
    academy.onLaunch(F); syncStages(); const L = stackL(); camDist = F.v.cur > 0 ? Math.max(30, Math.min(90, L * 2.6 + 20)) : Math.min(fitDist(L, 0.62), Math.max(30, L * 2.6 + 20)); camAim = 0.5; // f4 pad framing: whole stack ~62% of the screen
  }
  document.activeElement && document.activeElement.blur();
  $('build').classList.add('hidden'); $('hud').classList.remove('hidden');
  mobile.show(true); if (TOUCH) $('ignite').innerHTML = 'Tap <b>STAGE</b> to ignite';
}
function goBuild() {
  if (fun) fun.hideNav();
  reset(); state = 'build';
  $('hud').classList.add('hidden'); mobile.show(false); $('ignite').classList.add('hidden'); $('build').classList.remove('hidden');
  if (typeof home !== 'undefined' && home && goBuild.toHome !== false) home.show(true);
  refreshBuild();
}
let camUserT = -1e9, camDist = 90, camYaw = 0.5, camPitch = 0.12, mapZoom = 2.8, camAim = 0.45;
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
$('againBtn').onclick = () => { goBuild(); const hb = $('homeBack'); if (hb) hb.click(); }; // f3: the result card's Home goes back to the showroom
$('relaunchBtn').onclick = () => launch();
new MutationObserver(() => { if ($('end').classList.contains('hidden')) document.body.classList.remove('endOn'); }).observe($('end'), { attributes: true, attributeFilter: ['class'] });
$('contBtn').onclick = () => { $('end').classList.add('hidden'); document.body.classList.remove('endOn'); F.unfinish(); F.endQueued = true; };
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
  if (code === 'Escape') { if (photoOn) { fun.photo.toggle(); return; } setPause(!paused); return; }
  if (code === 'Tab') { fun.toggleEngineer(); return; }
  if (code === 'Quote') { fun.photo.toggle(); return; }
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
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') return; camUserT = performance.now(); if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * (1 + e.deltaY * 0.001))); else camDist = zoomLim(camDist * (1 + e.deltaY * 0.001 * SET.sens.zoom)); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointercancel', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId) || camMode === 'map') return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { camUserT = performance.now(); const k = SET.sens.cam; camYaw -= (e.clientX - px) * 0.006 * k; camPitch = Math.max(-1.4, Math.min(1.5, camPitch + (e.clientY - py) * 0.004 * k)); }
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
  if (any && director && director.active) { director.takeOver(); toast('You have control', '#9cc3ff'); }
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
// f1 destruction: flash → fireball → shockwave ring → tumbling debris chunks (pooled) → secondary pops,
// distance-scaled shake and a layered boom (the sound arrives late from far away)
const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 40, 64, 64, 63); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,240,220,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
const chunks = [], CHUNK_N = TOUCH ? 24 : 48;
const chunkGeo = [new THREE.BoxGeometry(1.4, 0.3, 1.1), new THREE.BoxGeometry(0.6, 2.2, 0.6), new THREE.CylinderGeometry(0.7, 0.7, 1.6, 8, 1, true), new THREE.TetrahedronGeometry(0.9)];
for (let i = 0; i < CHUNK_N; i++) { const m = new THREE.Mesh(chunkGeo[i % 4], i % 3 ? M.white : M.black); m.visible = false; m.frustumCulled = false; scene.add(m); chunks.push({ m, life: 0 }); }
let chunkI = 0;
function explode(pos, vel, big, main) {
  const dist = main ? camDist : V.len(V.sub(pos, v.r)) + camDist;
  funAudio.boom(big, dist); burst(big ? 0.5 : 0.3, 1.5, 700);
  flashAt(pos, big ? 90 : 50, [12, 9, 6], 0.5);
  flashAt(pos, big ? 170 : 90, [10, 3.6, 0.8], 1.5); // the fireball: orange, swelling, slower to fade
  for (let i = 0; i < (big ? 36 : 18); i++) smoke.spawn(V.add(pos, [rnd(20), rnd(20), rnd(20)]), V.add(vel, V.add([rnd(25), rnd(25), rnd(25)], V.scale(V.norm(pos), 8 + Math.random() * 12))), 6 + Math.random() * 5, 14, 55 + Math.random() * 30, Math.random() < 0.3 ? 0x5a3a28 : 0x262626, null, 0.6);
  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: new THREE.Color(2, 1.8, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ring.frustumCulled = false;
  ring.userData = { r: pos.slice(), size: big ? 260 : 140, life: 0.9, t: 0 }; scene.add(ring); flashes.push(ring);
  const nF = (big ? 220 : 120) * (TOUCH ? 0.6 : 1) | 0;
  for (let i = 0; i < nF; i++) {
    const a = Math.random() * 6.283, b = Math.random() * 3.14, s = Math.random() * (big ? 70 : 45);
    const dv = [Math.cos(a) * Math.sin(b) * s, Math.sin(a) * Math.sin(b) * s, Math.cos(b) * s];
    fire.spawn(pos, V.add(vel, dv), 0.6 + Math.random() * 1.4, 8, 30, 0xfff0b0, 0x401000, 1.2);
    if (i % 2) smoke.spawn(pos, V.add(vel, V.scale(dv, 0.5)), 4 + Math.random() * 4, 6, 26, 0x2b2b2b, null, 0.8);
  }
  const up = V.norm(pos), nC = big ? (TOUCH ? 14 : 26) : 10;
  for (let i = 0; i < nC; i++) { const c = chunks[chunkI++ % CHUNK_N], dv = [rnd(80), rnd(80), rnd(80)];
    c.r = pos.slice(); c.v = V.add(V.add(vel, dv), V.scale(up, 15 + Math.random() * 30)); c.life = 6 + Math.random() * 6; c.w = [rnd(12), rnd(12), rnd(12)]; c.m.visible = true; c.m.scale.setScalar(0.6 + Math.random() * 1.6); c.smk = Math.random() < 0.5; }
  if (big) for (let k = 1; k <= 3; k++) later(() => { const p2 = V.add(pos, [rnd(30), rnd(30), rnd(30)]); flashAt(p2, 30, [8, 5, 2], 0.3); for (let i = 0; i < 30; i++) fire.spawn(p2, jit(vel, 40), 0.4 + Math.random() * 0.6, 2, 8, 0xffd080, 0x401000, 1.5); funAudio.boom(false, dist + 800); }, 250 * k + Math.random() * 200);
  shake(Math.min(2.5, (big ? 3 : 1.5) * 120 / Math.max(60, dist)), big ? 1.6 : 0.8);
  if (main) fun.call('💥', 'UNPLANNED DISASSEMBLY', '#ff8a5c', true);
}
function updateChunks(dt, O) {
  for (const c of chunks) { if (c.life <= 0) { if (c.m.visible) c.m.visible = false; continue; }
    c.life -= dt; const r = V.len(c.r), g = -P.BODIES[F.body].mu / (r * r), up = V.scale(c.r, 1 / r), h = r - P.BODIES[F.body].R;
    c.v = V.add(c.v, V.scale(up, g * dt)); if (h < 40000) c.v = V.add(c.v, V.scale(V.sub(c.v, F.body === 'earth' ? siteVel({ r: c.r }) : [0, 0, 0]), -0.25 * dt));
    c.r = V.add(c.r, V.scale(c.v, dt)); if (h < 0) { c.life = 0; continue; }
    c.m.position.set(c.r[0] - O[0], c.r[1] - O[1], c.r[2] - O[2]); c.m.rotation.x += c.w[0] * dt; c.m.rotation.y += c.w[1] * dt; c.m.rotation.z += c.w[2] * dt;
    if (c.smk && Math.random() < 0.5) smoke.spawn(c.r, c.v, 1.5, 1, 5, 0x333333, null, 1); }
}
let endMin = false;
function showEnd() {
  if (F.ended) return; const score = F.finish();
  const flags = F.flags, o = F.orbitSnap ? F.orbitSnap.o : P.orbitOf(v), ok = flags.orbit && !flags.dead;
  const out = recordFlight(score);
  const landedOn = Object.entries(F.goals || {}).find(([, g]) => g.landed);
  $('endTitle').innerHTML = flags.dead ? fun.boomCard(flags.cause) : landedOn ? `🏳️ Landed on the ${P.BODIES[landedOn[0]].name}!` : flags.recovered ? '🪂 Orbit and home!' : flags.dead ? (/burned up|overheated/.test(flags.dead) ? '🔥 Burned up' : '💥 Rapid Unscheduled Disassembly') : ok ? '🛰️ Orbit achieved!' : flags.stranded ? '🪂 Out of fuel — suborbital' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  if (flags.recovered) lines.push(`<span class="good">✔ Recovered — touchdown at ${flags.touchdown.toFixed(1)} m/s · peak heating ${(F.maxHeat / 1000).toFixed(0)} kW/m² · peak skin ${F.maxTskin.toFixed(0)} K · ${F.maxGret.toFixed(1)} g on entry</span>`);
  if (flags.stranded && !flags.dead) lines.push(`<span class="warn">${F.advice()}</span>`);
  lines.push(`Max altitude: ${((flags.maxAlt || 0) / 1000).toFixed(1)} km · Max-Q (ascent): ${(F.maxQ / 1000).toFixed(1)} kPa${F.maxQEntry > 1000 ? ` · entry peak q ${(F.maxQEntry / 1000).toFixed(1)} kPa` : ''} · max ${F.maxG.toFixed(1)} g · Δv used ${(F.dvUsed / 1000).toFixed(2)} km/s`);
  if (flags.space) lines.push('<span class="good">✔ Reached space (Kármán line, 100 km)</span>');
  if (flags.orbit && !landedOn) lines.push(`<span class="good">✔ Orbit — Ap ${isFinite(o.ap) ? (o.ap / 1000).toFixed(0) + ' km' : 'escape'} / Pe ${(o.pe / 1000).toFixed(0)} km · period ${isFinite(o.T) ? (o.T / 60).toFixed(1) + ' min' : '—'}</span>`);
  if (flags.booster) lines.push(flags.boosterBonus ? `<span class="good">✔ Booster ${flags.booster} (+${flags.boosterBonus})</span>` : `<span class="warn">✘ Booster ${flags.booster}</span>`);
  else if (booster && booster.state === 'flying') lines.push('Booster still descending…');
  { const fb = F.flagsB; if (fb && fb.booster) lines.push(fb.boosterBonus ? `<span class="good">✔ Booster B ${fb.booster} (+${fb.boosterBonus})</span>` : `<span class="warn">✘ Booster B ${fb.booster}</span>`); }
  lines.push(`Rocket: ${design.name || 'Custom'} — ${v.stages.length} stages, ${F.stats.total.toFixed(0)} m/s · payload ×${v.mult}`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  if (director && director.result) lines.unshift(`<b class="${director.ok ? 'good' : 'warn'}">${MISSIONS[director.id].icon} ${director.result}</b>`);
  // f3: compact result card: headline result, score and medal up top; the stats wall folds into "Details"
  const extra = fun.endExtras(out, true), sc = lines.pop(), head = [], rest = [];
  for (const l of lines) (/class="(bad|warn)"|^<b class=/.test(l) && head.length < 3 ? head : rest).push(l);
  const stars = { gold: 3, silver: 2, bronze: 1 }[out && out.medal] || (ok || (director && director.ok) ? 1 : 0);
  $('endBody').innerHTML = `<div class="endStars" aria-label="${stars} of 3 stars">${'★'.repeat(stars)}<i>${'★'.repeat(3 - stars)}</i></div>` + head.join('<br>') + `<div class="endScore">${sc}${extra.medal || ''}</div>` + (extra.unlocks ? `<div class="endUnl">${extra.unlocks}</div>` : '')
    + `<details class="endMore"><summary>Flight details</summary>${rest.join('<br>')}${extra.more ? '<br>' + extra.more : ''}</details>`;
  if (out && out.ladder) { $('endBody').insertAdjacentHTML('afterbegin', careerUI.resultsHTML(out.ladder)); }
  { let nb = $('nextMisBtn'); if (!nb) { nb = document.createElement('button'); nb.id = 'nextMisBtn'; nb.className = 'big'; $('relaunchBtn').after(nb); nb.onclick = () => { const n = careerUI.next(); $('end').classList.add('hidden'); if (n) playRung(n); else $('againBtn').click(); }; }
    const n = careerUI.next(); nb.textContent = n ? 'Next mission ▸' : 'Career ▸'; nb.title = n ? 'Next contract: ' + rungLabel(n) : 'Career progress'; }
  $('replayBtn').classList.toggle('hidden', !(flags.dead && recBuf.length > 30));
  $('contBtn').classList.toggle('hidden', !!flags.dead || !!flags.stranded);
  $('shareBtn').textContent = 'Share score';
  // f5 lean end card (playtest ui_ideal_path #14 budget): ONE line + ↻ Retry + ▶ Next + ⋯; everything else lives in the ⋯ sheet
  { const L = out && out.ladder, starTxt = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    const what = flags.dead ? 'Crashed' : landedOn ? 'Landed · ' + P.BODIES[landedOn[0]].name : flags.orbit ? `Orbit · ${Math.round(((F.orbitSnap ? F.orbitSnap.o : o).ap || 0) / 1000)} km` : `${Math.round((flags.maxAlt || 0) / 1000)} km`;
    const earn = L && (L.cash || L.sci) ? ` <span class="eLine">+$${L.cash}M${L.sci ? ' 🔬' + L.sci : ''}</span>` : '';
    $('endTitle').innerHTML = `<span class="eStars">${starTxt}</span> ${what}${earn}`;
    const nb = $('nextMisBtn'), n = careerUI.next(); if (nb) nb.innerHTML = n ? `▶ Next<small>${rungLabel(n)}</small>` : '▶ Home';
    let mb = $('endMoreBtn'); if (!mb) { mb = document.createElement('button'); mb.id = 'endMoreBtn'; mb.textContent = '⋯'; mb.title = 'Details: score, Share, Home'; mb.setAttribute('aria-label', 'Flight details'); nb.after(mb); mb.onclick = () => $('end').classList.toggle('more'); }
    $('relaunchBtn').textContent = '↻ Retry'; $('end').classList.add('lean'); $('end').classList.remove('more'); }
  document.body.classList.add('endOn');
  $('end').classList.remove('hidden');
}
function makeLZ(s) { // f4.1 RTLS landing zone: a concrete disc with a ring and cross, 1.6 km from the pad
  const g = new THREE.Group(), cm = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.9 }), wm = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(45, 47, 0.8, 48), cm); pad.position.y = 0; g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(30, 33, 48), wm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.42; g.add(ring);
  for (const r of [0, Math.PI / 2]) { const bar = new THREE.Mesh(new THREE.PlaneGeometry(40, 3), wm); bar.rotation.set(-Math.PI / 2, 0, r); bar.position.y = 0.43; g.add(bar); }
  return onSurface(g, s.ef, 0);
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
  const ps = plumeShape(p * 101325, thr), pl = plumeLook(p * 101325, thr), ud = plume.userData, w0 = ud.w, fl = 0.92 + 0.16 * Math.random();
  const len = pl.len * w0 * fl; plume.scale.set(1, 1, 1);
  const setL = (m, wk, lk = 1) => { m.scale.set(wk, len * lk, wk); m.position.y = -len * lk / 2; };
  const applyTo = P0 => { const u = P0.userData; setL(u.glow, pl.glowW * 1.15 * (0.95 + 0.1 * Math.random()), 0.85); setL(u.outer, 1.7 + 0.4 * pl.vac, 1); setL(u.core, pl.coreW, 0.45 + 0.1 * Math.random());
    u.bell.visible = pl.bell > 0.02; u.bell.scale.set(pl.bellW, len * 0.45, pl.bellW); u.noz.scale.setScalar(w0 * (3 + 2 * thr) * fl); };
  applyTo(plume); if (ex) for (const e of ex) applyTo(e);
  const hiF = 1 - 0.92 * Math.min(1, Math.max(0, (h - 25000) / 15000)); // f4: above ~40 km the vacuum plume is just a faint glow
  M.plume.opacity = (0.55 + 0.35 * Math.random()) * pl.bright * (1 - 0.45 * pl.vac) * hiF; M.plumeGlow.opacity = 0.42 * pl.bright * fl * hiF; M.plumeCore.opacity = (0.75 + 0.25 * Math.random()) * (0.35 + 0.65 * hiF);
  M.plumeBell.opacity = 0.5 * pl.bell * fl * hiF; M.plumeSprite.opacity = 0.9 * pl.bright * (0.4 + 0.6 * hiF);
  const dia = ud.dia; dia.visible = QUALITY[fx.q].diamonds && ps.diamonds > 0.02;
  if (dia.visible) { M.diamond.opacity = ps.diamonds * (0.55 + 0.3 * Math.random());
    dia.children.forEach((m, i) => { m.position.y = -(1.1 + i * 1.35) * w0 * (1 + 0.2 * thr); m.scale.set(1 - i * 0.12, 0.6, 1 - i * 0.12); }); }
  // continuous, thick, billowing exhaust column: puffs laid along the path since last frame (no gaps at 500 m/s),
  // warm and lit near the flame, drifting with the wind, thinning out as the air does
  // f3: one clean continuous trail straight behind the nozzle: hot and engine-lit at the flame, white condensation in
  // dense humid low air when transonic or at high thrust, widening and fading with altitude. No random kicks, no spiral.
  const sm = pl.smoke, tr = group.userData.trail || (group.userData.trail = { last: null });
  const Mach = veh.tel && veh.tel.mach || 0, hum = Math.max(0, 1 - h / 12000), cond = hum * Math.min(1, Math.max(Mach > 0.7 ? (Mach - 0.7) / 0.4 : 0, thr > 0.6 ? (thr - 0.6) * 1.5 : 0) * (Mach < 2.2 ? 1 : 0.3));
  if (sm > 0.03 && h < 40000) { // f4.1: no smoke/condensation above 40 km
    const vAir = V.sub(veh.v, siteVel(veh)), sp0 = V.len(vAir), back = sp0 > 30 ? V.scale(vAir, -1 / sp0) : V.scale(dir, -1);
    const at = V.addS(bottom, back, len * 0.5), lw = tr.last && V.addS(tr.last, siteVel(veh), dt), last = lw && V.len(V.sub(at, lw)) < 400 ? lw : V.addS(at, vAir, -dt); // the previous point rode the rotating air for dt (else: a sawtooth/corkscrew)
    const seg = V.sub(at, last), dist = V.len(seg), wid = (3 + 5 * sm) * (1 + h / 9000) * (1 + 0.6 * cond), N = Math.min(TOUCH ? 10 : 18, Math.ceil(dist / Math.max(1.5, wid * 0.45)) + 1), sz = Math.max(wid, dist / N * 1.6);
    tr.rate = (tr.rate || 60) * 0.9 + 0.1 * N / Math.max(dt / SIM_SPEED, 1e-3); const lifeK = Math.min(1, smoke.n * 0.85 / (tr.rate * 9));
    const wind = siteVel(veh), ground = h < 60 ? 1 : 0, cA = cond > 0.3 ? 0xf6f8fb : 0xe4e6ea, cB = cond > 0.3 ? 0xdfe6ee : 0xb9bfc8;
    for (let i = 0; i < N; i++) { const pos = V.addS(V.addS(last, seg, (i + 0.5) / N), wind, -dt); // pre-step: update() moves it by vel·dt this same frame
      const vel = ground ? V.add(wind, [rnd(60), rnd(60), rnd(60)]) : wind;
      smoke.spawn(pos, vel, Math.max(1.5, (4 + 3 * cond) * (0.6 + 0.4 * sm) * lifeK * (1 - Math.min(0.6, h / 60000))), sz, wid * (2.6 + 1.4 * cond) * (1 + ground), cond > 0.3 ? cA : 0xffe4c4, cB, 0.35); }
  }
  tr.last = sm > 0.03 && h < 40000 ? (() => { const va = V.sub(veh.v, siteVel(veh)), s0 = V.len(va); return V.addS(bottom, s0 > 30 ? V.scale(va, -1 / s0) : V.scale(dir, -1), len * 0.5); })() : null;
  const n = h < 40000 ? Math.min(6, Math.ceil(dt * 120)) : 0; // f4.1: in vacuum the plume mesh is the glow; no flame particles (they read as dotted puffs)
  for (let i = 0; i < n; i++) {
    const sp = 60 + Math.random() * 40, spread = 6 + (1 - p) * 30;
    const fv = jit(V.addS(veh.v, dir, -sp), spread); fire.spawn(V.addS(V.addS(V.addS(bottom, dir, -2), fv, -dt), dir, -sp * dt * i / n), fv, /* f4.1: fully pre-step (update() moves it fv·dt this frame) — else it leads the nozzle by up to v·dt */ 0.25 + Math.random() * 0.25, 2.5, 6 + (1 - p) * 10, 0xffd9a0, 0x200800, 2);
    if (false) {
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
  const hint = (h => director && director.active && /AUTO|stage/i.test(h) ? "" : h)(F.hint()); // f3: no "tap AUTO / stage" coaching while the director flies
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
  if (state === 'flight' && !paused && replay) replayStep(rdt);
  else if (state === 'flight' && !paused && !photoOn) {
    readControls(rdt);
    if (director && director.active) { director.tick(rdt); directorCam(rdt); }
    if (slowMo > 0) slowMo -= rdt;
    pdt = F.advance(rdt * (slowMo > 0 ? 0.22 : 1));
    if (!F.flags.dead) { recBuf.push({ r: v.r.slice(), q: v.q.slice(), vv: v.v.slice(), thr: v.thrust, cur: v.cur }); if (recBuf.length > 720) recBuf.shift(); }
    funTick(rdt); navTick(); opTick();
    if (swingArm && F.ignited && swingArm.rotation.y < 1.4) swingArm.rotation.y += rdt * 0.8;
  }
  const th = v.earthRot === false ? 0 : P.OMEGA_E * (v.clock || 0), wE = v.earthRot === false ? 0 : P.OMEGA_E;
  for (const bb of [booster, booster2]) if (bb && bb.state !== 'flying' && bb.ef) { bb.r = V.rotZ(V.scale(bb.ef, R + bb.lift), th); bb.v = siteVel(bb); }
  // floating origin: the focused craft is at the scene origin
  const focus = (camMode === 'booster' && booster && booster.mesh && booster.mesh.visible) ? booster : v;
  const tel = v.tel, nose = P.noseOf(v), base = V.sub(v.r, V.scale(nose, tel.ycom));
  const O = focus === v ? v.r : booster.r;
  if (!placeBodies(O, th)) { earth.position.set(-O[0], -O[1], -O[2]); earth.rotation.z = th; }
  if (W1) { earth.updateMatrixWorld(); W1.frame(rdt > 0 && pdt > rdt * 4.01 ? 0 : pdt, camera); } // clouds drift on sim time, frozen above 4x warp
  lodFrame();
  { const ao = state === 'flight' && !!(F && F.autoOn) && !(director && director.active === false && false); if (ao !== document.body.classList.contains('autoOn')) document.body.classList.toggle('autoOn', ao); } // f5: manual controls hide while AUTO flies
  setRel(rocketG, base, O); toQ(v.q, rocketG.quaternion);
  worldVis(base, O, nose);
  if (state === 'flight' && !F.flags.dead && SG[v.cur]) emit(v, SG[v.cur], pdt, base, nose);
  else for (let j = v.cur; j < SG.length; j++) SG[j].userData.plume.visible = false;
  const ovl = (state === 'build' && !(home && home.on)) || (SET.overlay && state === 'flight' && !F.flags.dead && camMode !== 'map');
  comMark.visible = copMark.visible = ovl; cotMark.visible = ovl && !!(v.stages[v.cur] && v.stages[v.cur].eng && v.stages[v.cur].eng.tv > 0);
  if (ovl) { const yB = 0; comMark.position.set(0, tel.ycom, 0); copMark.position.set(0, P.centerOfPressure(P.stackGeom(v), state === 'build' ? 0.5 : Math.max(0.3, tel.mach || 0.5)), 0); cotMark.position.set(0, yB, 0);
    const sc = Math.max(1, stackL() / 40); comMark.scale.setScalar(sc); copMark.scale.setScalar(sc); cotMark.scale.setScalar(sc); }
  for (let k = debris.length - 1; k >= 0; k--) { // spent upper stages tumble away and are removed after a while
    const d = debris[k]; d.throttle = 0; let left = pdt; while (left > 0 && !d.gone) { const dt = Math.min(0.25, left); left -= dt; if (P.stepPoint(d, dt)) d.gone = true; }
    d.t += pdt; d.dir = V.norm(V.qrot(V.qAxisAngle(V.norm(d.r), pdt * 0.3), V.qrot(V.qAxisAngle(P.eastOf(d.r), pdt * 0.2), d.dir)));
    setRel(d.mesh, d.r, O); dirQ(d.mesh, d.dir);
    if (d.gone || d.t > 120) { scene.remove(d.mesh); debris.splice(k, 1); }
  }
  for (const bq of [booster, booster2]) if (bq && bq.mesh && bq.mesh.visible) { // f4.2: each side booster
    setRel(bq.mesh, bq.r, O); dirQ(bq.mesh, bq.dir);
    const bh = V.len(bq.r) - R, legs = bq.mesh.userData.legs; if (legs) legs.visible = bq.state === 'landed' || (bq.state === 'flying' && (bq.legs || bh < 600));
    if (bq.state === 'flying') emit(bq, bq.mesh, pdt, bq.r, bq.dir); else bq.mesh.userData.plume.visible = false;
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
    if (focus === v && state === 'flight' && camMode === 'chase') { // f4.1: chase distance follows the rocket's size (never a dot); eases back after a user zoom
      const Ls = stackL(), want = Math.max(30, Math.min(160, Ls * 2.6 + 20)), maxD = Math.max(80, Ls * 9 + 60);
      if (camDist > maxD) camDist = maxD; if (performance.now() - camUserT > 8000) camDist += (want - camDist) * Math.min(1, rdt * 0.8);
    }
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
  // f1u2: O / v.r are relative to the current SOI body, but the sky, fog and Earth atmosphere assume Earth. Away from
  // Earth, |O| − R_earth went negative in low lunar orbit → daytime sky + fog density e^(−h/8000) ≫ 1: a flat colour wash.
  const hs = skyAlt(h), k = Math.min(1, Math.max(0, hs / 70000));
  const lit = updateSun(O, U, hs, k, isMap); // sun direction, eclipse, sky colour, scattering, lights
  stars.material.opacity = isMap ? 1 : Math.min(1, Math.max(0, k * 1.4 - 0.3) + (1 - lit.day) * (1 - k) * 0.8);
  updateCine(rdt, h, isMap);
  updateChunks(pdt, O);
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
  if (state === 'build' && home && home.on) { // showroom: slow cinematic turn, rocket framed above the card (portrait) or beside it (landscape)
    camYaw += rdt * 0.22; camPitch += (0.05 - camPitch) * Math.min(1, rdt); const land = innerWidth > innerHeight, wide = innerWidth >= 900 && innerHeight >= 600;
    const Lh = v ? P.stackGeom(v).L : 40; camDist = Math.max(40, Lh * (land && !wide ? 1.6 : wide ? 1.95 : 1.75)); camAim = 0.5;
    camera.setViewOffset(innerWidth, innerHeight, land && !wide ? innerWidth * 0.2 : 0, land && !wide ? 0 : innerHeight * (wide ? 0.15 : 0.17), innerWidth, innerHeight); }
  else if (state === 'build') { camYaw += rdt * 0.15; const sheet = innerWidth < 600 && innerHeight > innerWidth; // f4: phone portrait: rocket fills the strip above the bottom sheet
    if (sheet) { camAim = 0.5; camDist = fitDist(stackL(), 0.36); camera.setViewOffset(innerWidth, innerHeight, 0, innerHeight * 0.29, innerWidth, innerHeight); }
    else { camDist = Math.max(70, stackL() * 1.9); camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.36, 0, innerWidth, innerHeight); } }
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const mapOn = state === 'flight' && camMode === 'map';
  if (smap.state.on !== mapOn) { // f3: any modal steps aside while the map is open (the result card comes back after)
    if (mapOn && !$('end').classList.contains('hidden')) { $('end').classList.add('hidden'); endMin = true; } else if (!mapOn && endMin) { endMin = false; if (F.ended) $('end').classList.remove('hidden'); }
    if (mapOn) document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    smap.show(mapOn); document.body.classList.toggle('mapOn', mapOn); }
  updateSplit(rdt);
  if (state === 'flight' && split.on && !split.full) { const R2 = paneRect(); if (splitPortrait()) camera.setViewOffset(innerWidth, innerHeight, 0, booster2 ? innerHeight / 2 - ctlTop() / 6 : innerHeight * 0.25, innerWidth, innerHeight); else camera.setViewOffset(innerWidth, innerHeight, innerWidth * 0.25, 0, innerWidth, innerHeight); }
  if (mapOn) { smap.update(rdt); mapPost.render(); }
  else { post.render(); renderSplit(O); }
  if (snapReq) { const f = snapReq; snapReq = null; savePhoto(f); }
  if (state === 'build' && snapAnim > 0 && rocketG) { snapAnim = Math.max(0, snapAnim - rdt * 3); const k = 1 + Math.sin(snapAnim * Math.PI) * 0.06; rocketG.scale.set(k, 1 / k, k); }
});


// ---------- f1 split-screen staging: upper stage and returning booster, both in full physics ----------
// The booster pane renders the same scene a second time with its own camera (scissored, no bloom, flow
// particles off = the Low look). Tap a pane to make it full screen; ⇄ switches control between the craft.
const cam2 = new THREE.PerspectiveCamera(55, 1, 0.5, 2e9), SPLIT_KEY = 'orbitrush.split';
const split = { on: false, full: null, done: 0, rec: [], replay: null, enabled: localStorage.getItem(SPLIT_KEY) !== '0', yaw: 0.9, pitch: 0.25, dist: 90, userT: -1e9, frame: 0 };
{ const d = document.createElement('div'); d.id = 'split'; d.className = 'hidden';
  d.innerHTML = '<div id="spPane"><div class="spCard" id="spCardB"><canvas class="spBall" id="spBallB" width="64" height="64"></canvas><div id="spHud"></div></div><div class="spBtns"><button id="spCtl" title="Switch control">⇄ CONTROL</button><button id="spFull" title="Full screen">⤢</button><button id="spClose" title="Close the booster view">✕</button></div></div><div id="spMain"><div class="spCard" id="spCardU"><canvas class="spBall" id="spBallU" width="64" height="64"></canvas><div id="spHud1"></div></div></div>';
  document.body.appendChild(d);
  { const p2 = document.createElement('div'); p2.id = 'spPane2'; p2.className = 'hidden'; p2.innerHTML = '<div class="spCard" id="spCardB2"><canvas class="spBall" id="spBallB2" width="64" height="64"></canvas><div id="spHud2"></div></div>'; d.appendChild(p2); } // f4.2: booster B pane
  $('spFull').onclick = e => { e.stopPropagation(); split.full = split.full === 'b' ? null : 'b'; camMode = split.full === 'b' ? 'booster' : 'chase'; };
  // f4: the booster pane has its own camera: drag orbits, pinch / wheel zooms, a tap (no drag) toggles full screen
  const pp = $('spPane'), pts = new Map(); let moved = 0, pinch0 = 0, d0 = 90;
  pp.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; pp.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = split.dist; } e.stopPropagation(); });
  pp.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) split.dist = Math.max(25, Math.min(1500, d0 * pinch0 / Math.max(d, 1))); moved = 99; }
    else { moved += Math.abs(dx) + Math.abs(dy); split.yaw -= dx * 0.008; split.pitch = Math.max(-0.4, Math.min(1.3, split.pitch + dy * 0.006)); split.userT = performance.now(); } e.stopPropagation(); });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
    if (!pts.size && moved < 8) { if (split.full) { split.full = null; camMode = 'chase'; } else { split.full = 'b'; camMode = 'booster'; } } e.stopPropagation(); };
  pp.addEventListener('pointerup', up); pp.addEventListener('pointercancel', up);
  pp.addEventListener('wheel', e => { split.dist = Math.max(25, Math.min(1500, split.dist * Math.exp(e.deltaY * 0.001))); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  $('spMain').onclick = () => { if (split.full) { split.full = null; camMode = 'chase'; } };
  $('spCtl').onclick = e => { e.stopPropagation(); if (booster && booster.state === 'flying' && F.ship && booster.stages[0].fuel > 0) F.toggleBooster(); else toast('The booster is on autopilot', '#9cc3ff'); };
  $('spClose').onclick = e => { e.stopPropagation(); split.closed = true; };
}
const splitPortrait = () => innerHeight > innerWidth;
const _html = {}; function setHTML(id, h) { if (_html[id] !== h) { _html[id] = h; const e = $(id); if (e) e.innerHTML = h; } }
function placeTopStack(on) { // f4.1b: in split, toasts/hints (#topStack, compact #hintS) live in the upper pane, below its card and clear of the pane buttons
  const por = splitPortrait(), land = on && camMode !== 'map', W = innerWidth, card = $('spCardU') || $('spHud1'), cb = card && land ? card.getBoundingClientRect() : null, pTop = innerHeight * (booster2 ? 1 / 3 : 0.5), top = cb ? (por ? (cb.bottom + 58 < pTop ? cb.bottom + 8 : Math.max(70, cb.top - 54)) : Math.max(cb.bottom + 10, 112)) : 0; // f4.2 portrait: under the upper card if it fits above the booster pane, else above the card
  for (const id of ['topStack', 'hintS']) { const ts = $(id); if (!ts) continue;
    if (!land) { if (ts.dataset.sp) { ts.style.removeProperty('left'); ts.style.removeProperty('top'); ts.style.removeProperty('max-width'); delete ts.dataset.sp; } continue; }
    ts.dataset.sp = '1'; ts.style.setProperty('left', Math.round(W * (por ? 0.5 : 0.25)) + 'px', 'important'); ts.style.setProperty('top', Math.round(top + (id === 'hintS' ? 0 : 40)) + 'px', 'important'); ts.style.setProperty('max-width', Math.round(por ? W - 24 : W * 0.5 - 32) + 'px', 'important'); } }
// f5: portrait touch: the panes end above the stick / throttle / STAGE cluster so the lowest booster pane is never under them
let ctlTopC = { t: 0, v: 0 };
function ctlTop() { const H = innerHeight; if (!TOUCH || !splitPortrait()) return H; const now = performance.now(); if (now - ctlTopC.t < 500) return ctlTopC.v;
  let top = H; for (const id of ['mleft', 'mright']) { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.height > 0) top = Math.min(top, r.top); }
  ctlTopC = { t: now, v: Math.max(H * 0.6, top - 6) }; return ctlTopC.v; }
function paneRect(i = 0, nb = 1) { const W = innerWidth, H = innerHeight, Hc = ctlTop(); // f4.2: a heavy's two boosters: stacked on the right (landscape) or rows 2-3 (portrait)
  if (nb > 1) return splitPortrait() ? { x: 0, y: Hc / 3 * (i + 1), w: W, h: Hc / 3 } : { x: W * 0.5, y: H * 0.5 * i, w: W * 0.5, h: H * 0.5 };
  return splitPortrait() ? { x: 0, y: H * 0.5, w: W, h: Hc - H * 0.5 } : { x: W * 0.5, y: 0, w: W * 0.5, h: H }; }
function updateSplit(rdt) {
  const b = booster, flyA = b && b.state === 'flying' && b.mesh && b.mesh.visible !== false, flying = flyA || !!(booster2 && booster2.state === 'flying');
  if (flyA) { split.rec.push({ r: b.r.slice(), dir: b.dir.slice(), thr: b.thrust, n: b.n }); if (split.rec.length > 900) split.rec.shift(); split.done = 0; }
  const want = split.enabled && !split.closed && state === 'flight' && $('end').classList.contains('hidden') && /* f4.2: the end card replaces the split */ camMode !== 'map' && F.body === 'earth' && !photoOn && !replay && !F.flags.dead && b && (flying || split.done < 6);
  if (!flying && b && split.on) { // landed or lost: hold, then a slow replay of the last seconds, then close
    if (!split.done && split.rec.length > 30) split.replay = { i: Math.max(0, split.rec.length - 240), k: 0 };
    split.done += rdt;
  }
  document.body.classList.toggle('splitOn', !!(want && split.full !== 'b')); placeTopStack(!!(want && split.full !== 'b'));
  if (want !== split.on) { split.on = want; $('split').classList.toggle('hidden', !want); if (!want) { split.full = null; if (camMode === 'booster' && !(b && b.state === 'flying')) camMode = 'chase'; split.replay = null; } }
  if (!split.on) return;
  const nb = booster2 ? 2 : 1, R2 = paneRect(0, nb), fb = split.full === 'b';
  $('split').classList.toggle('portrait', splitPortrait()); $('split').classList.toggle('fullB', fb); $('split').classList.toggle('tri', nb > 1);
  { const p2 = $('spPane2'), on2 = nb > 1 && !fb; p2.classList.toggle('hidden', !on2); if (on2) { const r3 = paneRect(1, nb), s2 = p2.style; s2.left = r3.x + 'px'; s2.top = r3.y + 'px'; s2.width = r3.w + 'px'; s2.height = r3.h + 'px'; } }
  { const cu = $('spCardU'); if (cu) cu.style.setProperty('bottom', nb > 1 && splitPortrait() && !fb ? (innerHeight - ctlTop() / 3 + 10) + 'px' : '', 'important'); }
  const st = $('spPane').style; if (fb) { st.left = '0'; st.top = '0'; st.width = '100%'; st.height = '100%'; } else { st.left = R2.x + 'px'; st.top = R2.y + 'px'; st.width = R2.w + 'px'; st.height = R2.h + 'px'; }
  split.frame++; if (b) { // f4.1b: every frame (was every 6th — at low fps the cards lagged by seconds)
    const card = (b, label, hud, ball, rp) => { const bh = V.len(b.r) - R, bu = V.norm(b.r), bva = P.airVel(b, b.r, b.v), vs = V.dot(bva, bu);
      const bf = b.stages[0], bs = V.len(bva), bPh = rp ? '⟲ REPLAY' : b.state === 'landed' ? '✔ LANDED' : b.state !== 'flying' ? '✘ LOST' : b.manual ? 'MANUAL' : apPill(b.phase);
      setHTML(hud, `<div class="spT"><b>${label}</b><span class="pill ${/BURN|LANDING/.test(bPh) ? 'hot' : ''}">${bPh}</span></div><div class="spG"><span>ALT</span><b>${fmtD(bh)}</b><span>SPD</span><b>${fmtS(bs)}</b><span>V/S</span><b>${vs >= 0 ? '+' : ''}${vs.toFixed(0)} m/s</b><span>FUEL</span><b>${bf ? bf.fuel.toFixed(1) : 0} t</b></div>`);
      miniBall($(ball), b.dir, b.r, bva); };
    card(b, booster2 ? 'BOOSTER A · ' + (b.lzName || 'LZ-1') : 'BOOSTER', 'spHud', 'spBallB', !!split.replay); if (booster2) card(booster2, 'BOOSTER B · ' + (booster2.lzName || 'LZ-2'), 'spHud2', 'spBallB2', false);
    const uu = V.norm(v.r), uva = P.airVel(v, v.r, v.v), uvs = V.dot(v.v, uu), us = v.stages[v.cur], ufp = us && us.fuelMax ? Math.round(100 * us.fuel / us.fuelMax) : 0;
    const uPh = v.auto || F.autoOn ? ({ ascent: 'ASCENT', coast: 'COAST TO AP', circ: 'ORBIT INSERTION', done: 'IN ORBIT' }[v.guid] || 'AUTO') : 'MANUAL';
    setHTML('spHud1', `<div class="spT"><b>UPPER STAGE</b><span class="pill ${v.thrust > 0 ? 'hot' : ''}">${uPh}</span></div><div class="spG"><span>ALT</span><b>${fmtD(P.altOf(v))}</b><span>SPD</span><b>${fmtS(V.len(v.v))}</b><span>V/S</span><b>${uvs >= 0 ? '+' : ''}${uvs.toFixed(0)} m/s</b><span>FUEL</span><b>${ufp}%</b></div>`);
    miniBall($('spBallU'), P.noseOf(v), v.r, P.altOf(v) > 80000 ? v.v : uva);
  }
}
const apPill = ph => { const p = (ph || '').toLowerCase(); return /boost/.test(p) ? 'BOOSTBACK' : /entry/.test(p) ? 'ENTRY BURN' : /landing|controlled/.test(p) ? 'LANDING BURN' : /glide|fin/.test(p) ? 'GRID-FIN GLIDE' : /touch/.test(p) ? 'TOUCHDOWN' : /coast/.test(p) ? 'COAST' : (ph || 'AUTO').toUpperCase(); };
// f4 mini navball: sky/ground split by the nose pitch, roll-free; prograde marker from the velocity
function miniBall(cv, dir, r, vel) {
  if (!cv) return; const c = cv.getContext('2d'), W = cv.width, H = cv.height, R0 = W / 2 - 2, up = V.norm(r), e = P.eastOf(r), n = V.cross(up, e);
  const pit = Math.asin(Math.max(-1, Math.min(1, V.dot(dir, up)))), hy = Math.max(-1, Math.min(1, pit / (Math.PI / 2))) * R0; // f4.1: nose up = horizon drops = more sky (local horizon from r)
  c.clearRect(0, 0, W, H); c.save(); c.beginPath(); c.arc(W / 2, H / 2, R0, 0, 7); c.clip();
  c.fillStyle = '#3d7bd6'; c.fillRect(0, 0, W, H); c.fillStyle = '#8a5a2b'; c.fillRect(0, H / 2 + hy, W, H);
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, H / 2 + hy); c.lineTo(W, H / 2 + hy); c.stroke();
  const sp = V.len(vel); if (sp > 5) { const vd = V.scale(vel, 1 / sp), vp = Math.asin(Math.max(-1, Math.min(1, V.dot(vd, up)))), hd = Math.atan2(V.dot(vd, e), V.dot(vd, n)), nd = Math.atan2(V.dot(dir, e), V.dot(dir, n));
    const px = W / 2 + Math.max(-1, Math.min(1, (hd - nd) / 1.2)) * R0 * 0.8, py = H / 2 + (pit - vp) / (Math.PI / 2) * R0;
    c.strokeStyle = '#ffe14d'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 5, 0, 7); c.stroke(); }
  c.restore(); c.strokeStyle = '#ffd23a'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2 - 12, H / 2); c.lineTo(W / 2 - 4, H / 2); c.moveTo(W / 2 + 4, H / 2); c.lineTo(W / 2 + 12, H / 2); c.stroke();
  c.strokeStyle = '#9cc3ff88'; c.beginPath(); c.arc(W / 2, H / 2, R0, 0, 7); c.stroke();
}
function renderSplit(O) {
  const son = !!(split.on && split.full !== 'b' && booster); if (document.body.classList.contains('splitOn') !== son) document.body.classList.toggle('splitOn', son); // f4.1: class follows what is drawn
  if (!son) return;
  const bs = splitBs(); for (let i = 0; i < bs.length; i++) renderPane(bs[i], O, paneRect(i, bs.length), i);
}
// f4.2: the booster panes in split (1, or 2 for a heavy's side pair). Each has its own camera, render target and
// composite quad. The camera's up vector is the booster's local radial, eased like the main camera, so the horizon
// stays level and the ground stays below whatever the booster does (flip, boostback, entry, landing).
const paneSlots = [];
function renderPane(b, O, R2, i) {
  const S = paneSlots[i] || (paneSlots[i] = { cam: i ? new THREE.PerspectiveCamera(55, 1, 0.5, 2e9) : cam2, up: null, look: null, t: 0 });
  const cam = S.cam; let br = b.r, bd = b.dir;
  if (split.replay && i === 0) { const rp = split.replay; rp.k += 0.5; const f = split.rec[Math.min(split.rec.length - 1, rp.i + Math.floor(rp.k))]; if (f) { br = f.r; bd = f.dir; setRel(b.mesh, br, O); dirQ(b.mesh, bd); b.mesh.userData.plume.visible = f.thr > 0.01; } }
  const up = V.norm(br), e = P.eastOf(br), n = V.cross(up, e); if (i === 0 && performance.now() - split.userT > 4000) split.yaw += 0.002;
  const landed = b.state !== 'flying', pz = landed ? Math.max(0.18, split.pitch) : split.pitch; // f4.1: never under the ground
  if (landed) bd = up; // the landed booster stands up: frame its middle, camera upright
  const lift = landed ? 20 : 0, tx = br[0] - O[0] + up[0] * lift, ty = br[1] - O[1] + up[1] * lift, tz = br[2] - O[2] + up[2] * lift, d = split.dist, cp = Math.cos(pz), yaw = split.yaw + (i ? 0.35 : 0);
  const off = V.add(V.add(V.scale(n, Math.cos(yaw) * d * cp), V.scale(e, Math.sin(yaw) * d * cp)), V.scale(up, d * Math.sin(pz)));
  const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (S.t || now)) / 1000)); S.t = now; const kE = 1 - Math.exp(-dt * 4); // same 4/s easing as the chase camera
  const lk = landed ? [0, 0, 0] : V.scale(bd, 15); S.look = S.look ? V.add(S.look, V.scale(V.sub(lk, S.look), kE)) : lk; S.up = S.up ? V.norm(V.add(S.up, V.scale(V.sub(up, S.up), kE))) : up;
  cam.position.set(tx + off[0], ty + off[1], tz + off[2]); cam.up.set(S.up[0], S.up[1], S.up[2]); cam.lookAt(tx + S.look[0], ty + S.look[1], tz + S.look[2]);
  cam.aspect = R2.w / R2.h; cam.updateProjectionMatrix();
  const fxV = fx.root ? fx.root.visible : null; if (fx.root) fx.root.visible = false; // Low look in the pane: no flow particles
  const sc = TOUCH ? 0.5 : Math.min(1, renderer.getPixelRatio()), tw = Math.max(16, Math.round(R2.w * sc)), th2 = Math.max(16, Math.round(R2.h * sc));
  if (!S.rt) { S.rt = new THREE.RenderTarget(tw, th2, { samples: TOUCH ? 0 : 4 }); S.qm = new THREE.MeshBasicMaterial({ map: S.rt.texture, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    S.qs = new THREE.Scene(); const qm = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), S.qm); if (renderer.backend && renderer.backend.isWebGPUBackend) qm.scale.y = -1; /* f4.1: WebGPU render-target textures come out flipped */ S.qs.add(qm); S.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); }
  if (S.rt.width !== tw || S.rt.height !== th2) S.rt.setSize(tw, th2);
  renderer.setRenderTarget(S.rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
  const ac0 = renderer.autoClear; renderer.autoClear = false; renderer.setViewport(R2.x, R2.y, R2.w, R2.h);
  renderer.render(S.qs, S.qc); renderer.autoClear = ac0; renderer.setViewport(0, 0, innerWidth, innerHeight);
  if (fx.root && fxV !== null) fx.root.visible = fxV;
  S.dbg = { up: S.up, camUp: [cam.up.x, cam.up.y, cam.up.z], bd, br, cam: [cam.position.x + O[0], cam.position.y + O[1], cam.position.z + O[2]], R2 };
}
const splitBs = () => [booster, booster2].filter(x => x && x.mesh && (x.state === 'flying' || x.state === 'landed' || x === booster));
// ---------- gx1: sun, sky, scattering, eclipse, plume light; cinematic shake and staging drama ----------
scene.fog = new THREE.FogExp2(0x9cc4ec, 2e-5); const cHaze = new THREE.Color(0xdde8f4);
const skyC = new THREE.Color(), cSky = new THREE.Color(0x3d7fe0), cHor = new THREE.Color(0xff8a3c), cNight = new THREE.Color(0x02040a);
const AIR = { earth: 1, mars: 0.35, venus: 2.5, titan: 1.4 };
function skyAlt(h) { // altitude that drives sky colour + haze: real altitude where there is air, "deep space" otherwise
  const b = F && F.body || 'earth'; if (b === 'earth') return h;
  if (!AIR[b]) return 1e9; const a = F.alt; return isFinite(a) ? Math.max(0, a / AIR[b]) : 1e9;
}
function updateSun(O, U, h, k, isMap) {
  const sd = P.sunDir('earth', F.tAbs); sunDirV.set(sd[0], sd[1], sd[2]);
  sunL.position.copy(sunDirV); sunPos.value.copy(sunDirV).multiplyScalar(1e11);
  // eclipse: does the ray from the craft toward the Sun hit the Earth? (soft edge ~ the atmosphere's thickness)
  const cx = -O[0], cy = -O[1], cz = -O[2], tca = cx * sd[0] + cy * sd[1] + cz * sd[2], d2 = cx * cx + cy * cy + cz * cz - tca * tca;
  const shadow = F && F.body && F.body !== 'earth' ? 0 : tca > 0 ? Math.min(1, Math.max(0, (R + 30000 - Math.sqrt(Math.max(0, d2))) / 60000)) : 0, sunK = 1 - shadow;
  const el = U.x * sd[0] + U.y * sd[1] + U.z * sd[2], day = Math.min(1, Math.max(0, (el + 0.08) / 0.25)), dusk = Math.max(0, 1 - Math.abs(el - 0.02) / 0.18) * (1 - k);
  skyC.copy(cNight).lerp(cSky, day).lerp(cHor, dusk * 0.55).multiplyScalar(1 - k);
  scene.background = isMap ? skyC.setRGB(0, 0, 0.01) : skyC;
  // aerial perspective near the ground: exponential haze in the sky colour, thinning with altitude
  scene.fog.color.copy(skyC).lerp(cHaze, 0.35 * day); scene.fog.density = isMap ? 0 : 2.2e-5 * Math.exp(-h / 4500) * (h < 40000 ? 1 : 0); // f4.1: high up the camera looks down through thin air (no grey slab at 22 km)
  sunL.intensity = 3.0 * sunK; sunL.color.setRGB(1, 0.85 + 0.15 * (1 - dusk), 0.7 + 0.3 * (1 - dusk));
  hemi.intensity = (0.25 + 0.75 * day) * (1 - k * 0.75); scene.environmentIntensity = (0.35 + 0.65 * day) * (1 - 0.6 * k) * (0.3 + 0.7 * sunK);
  sunSprite.visible = !isMap && sunK > 0.02; sunSprite.position.copy(camera.position).addScaledVector(sunDirV, 5e7); sunSprite.scale.setScalar(5e7 * (0.12 + 0.1 * k)); sunSprite.material.opacity = sunK;
  const u = atmoMat.userData; atmo.position.set(cx, cy, cz); u.center.value.set(cx, cy, cz); u.sunDir.value.copy(sunDirV); u.Rp.value = R; u.Ra.value = ATMO_R;
  u.gain.value = isMap || (F && F.body && F.body !== 'earth') ? 0 : Math.min(1, Math.max(0, (h - 15000) / 45000)); atmo.visible = u.gain.value > 0.01;
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

// ---------- f1 fun layer glue: missions, pilot HUD, callouts, replay, photo, progress, hangar tests ----------
let director = null, slowMo = 0, replay = null, photoOn = false, snapReq = null, snapAnim = 0, funT = 0, funShown = null;
const recBuf = [], seen = {};
const BODY_COL = { earth: '#4f9cff', moon: '#bdbdbd', mars: '#d2603a', venus: '#e8c27a', mercury: '#a39b8f', jupiter: '#d9b38c', saturn: '#e6d29a', uranus: '#9fe3e8', neptune: '#4d6fe0', sun: '#ffd23a', io: '#e8d05a', europa: '#d8cfc0', ganymede: '#a89c8c', callisto: '#7a6f66', titan: '#e0a050', triton: '#c9d6d9', pluto: '#d8c2a8' };
fun = createFunUI({
  toast, press, audio: funAudio, canvas: renderer.domElement, bodies: () => P.BODIES, bodyColor: id => BODY_COL[id] || '#888',
  setSas: m => { F.setSAS(v.sas === m && m === 'radial' ? 'antiradial' : v.sas === m && m === 'normal' ? 'antinormal' : m); },
  progress: () => PROG, design: () => design, takeOver: () => { if (director && director.active) director.takeOver(); },
  startMission: id => startMission(id), startOp: id => startOp(id), ops: () => opsList, opName: m => opName(m), vname: id => brandVName(id), career: () => { const c = career(); return { c, CAREER, CONTRACTS, canFly, missionOf }; }, setPhoto: on => { photoOn = on; if (on) { camDist = Math.max(camDist, 60); } },
  snap: filter => { snapReq = { filter }; },
  tunnelGeom: mach => { const ab = aeroBalance(design, mach); if (!ab) return null; const vv = buildVehicle(design), g = P.stackGeom(vv); const COL = { engine: '#ff9a3c', tank: '#e8e8e8', pod: '#9cc3ff', payload: '#e0b84a', fins: '#555', decoupler: '#333', fairing: '#f4f4f4', shield: '#7a4a2a', chute: '#ff7a3c', rcs: '#8a9099' };
    return { parts: g.list.map(e => ({ y: e.y, h: e.h, d: e.kind === 'fins' ? (e.d || 2) * 1.8 : e.d, col: COL[e.kind] || '#ccc' })), L: g.L, ycom: ab.ycom, ycp: ab.ycp, stable: ab.stable, margin: ab.margin }; },
});
const cx = createCompact({ touch: TOUCH, onSpeedTap: () => fun.cycleSpeed(), onMarkers: on => setMarkers(on), onEngTap: () => { mobile.sheet = !document.body.classList.contains('sheet'); document.body.classList.toggle('sheet', mobile.sheet); } });
{ const dm = document.getElementById('dMap'); if (dm) dm.onclick = e => { e.currentTarget.blur(); press('KeyM'); }; }
{ // top-centre stack: callout, hint, toasts never overlap each other
  const st = document.createElement('div'); st.id = 'topStack'; document.body.appendChild(st);
  for (const id of ['hint', 'toasts', 'callout']) { const e = document.getElementById(id); if (e) st.appendChild(e); } }
// f4: recovery missions (missions/*.js) run through the shared runner session; S.task drives a compact HUD prompt
loadMissions().then(l => { opsList = l; }).catch(e => console.warn('[Orbit Rush] missions', e));
loadBrand().then(() => applyBrandDom()).catch(() => {});
// career (PR #9): money / reputation / unlocks, saved in localStorage via the campaign save module
function career() { const r = loadFrom(localStorage); return r && r.ok && r.career ? r.career : newCareer(); }
let lastOp = null;
function startOp(contractId, viaLadder) {
  const mid = missionOf(contractId), m = opsList.find(x => x.id === mid); if (!m) return;
  const c = career(), g = canFly(c, contractId); if (!g.ok && !viaLadder) { fun.call('🔒', g.why, '#ffb35c'); return; }
  opContract = contractId; opHooks = missionHooks(m, () => F); opFlightOpts = missionFlightOpts(m);
  setDesign(missionDesign(m)); launch(); opFlightOpts = null; applyMission(m, F); opSess = missionSession(m).attach(F);
  fun.call('🎯', opName(m) + ' — AUTO flies the ascent; follow the prompts on orbit', '#ffe9b0', true);
}
function opEnd(why) {
  const S = opSess; if (!S || S._shown) return; S._shown = 1;
  const r = evalOp(S.m, F, S), ok = r.objectives.filter(o => o.pass).length; lastOp = { id: S.m.id, ok: !!r.complete };
  let line = `${opName(S.m)}: ${ok}/${r.objectives.length} objectives · score ${r.score.toLocaleString()}`;
  try { const c1 = applyFlight(career(), opContract, r); saveTo(localStorage, c1); line += ` · 💰 ${c1.money} · ⭐ ${c1.rep}`; } catch (e) { console.warn('[Orbit Rush] career', e); }
  fun.call(r.complete ? '🏆' : '⚠️', line, r.complete ? '#7dffa6' : '#ffb35c', true); opSess = null; opHooks = null;
}
function opTick() {
  const S = opSess, el = document.getElementById('opTask'); if (!S) { if (el) el.hidden = true; return; }
  S.tick(F);
  if (el) { const t = S.task; el.hidden = !t; if (t) el.innerHTML = t.kind === 'execute-node' ? `<b>▶ Burn ${t.burn}/${t.of}</b> ${t.label} <small>${F.nodes.length ? 'X / ◆ Execute' : ''}</small>` : `<b>▶</b> ${t.label || t.kind}`; }
  if (S.done || S.failed || F.flags.dead) opEnd();
}
function startMission(id) {
  opSess = null;
  const m = MISSIONS[id], t = TEMPLATES.find(x => x.name === m.tpl) || (SHOWROOM.find(x => x.name === m.tpl) || {}).design; if (!t) return;
  setDesign(cloneDesign(t)); launch(); director = new Director(F, id, { say: msg => fun.call(m.icon, msg, '#ffe9b0') });
  fun.call(m.icon, m.name + ' — mission director has the stick', '#ffe9b0', true); camDist = 120; camYaw = 0.9; camPitch = 0.08;
}
let dirPhase = '';
function directorCam(rdt) { // cinematic cameras per mission phase (the player can still drag / zoom)
  const c = director.cam;
  if (director.phase !== dirPhase) { dirPhase = director.phase; if (c === 'map' && camMode !== 'map') camMode = 'map'; else if (c !== 'map' && camMode === 'map' && director.phase !== 'cruise') camMode = 'chase'; }
  if (camMode === 'chase') { const want = c === 'wide' ? Math.max(220, stackL() * 6) : Math.max(70, stackL() * 2.4); camDist += (want - camDist) * Math.min(1, rdt * 0.6); if (c === 'wide') camYaw += rdt * 0.06; }
}
function funTick(rdt) {
  if ((funT += rdt) < 0.1) return; funT = 0;
  const tel = v.tel, f = F.flags, cur = v.cur;
  // punchy callouts on the moments that matter
  const once = (k, icon, txt, col, big) => { if (!seen[k]) { seen[k] = 1; fun.call(icon, txt, col, big); } };
  if (f.liftoff) once('lift', '🚀', 'LIFTOFF', '#fff', true);
  if ((tel.machShown || 0) >= 1 && P.altOf(v) < 40000) once('mach', '〰️', 'SUPERSONIC', '#9cc3ff');
  if (f.maxq) once('maxq', '💨', 'MAX-Q — through the worst of it', '#ffd23a');
  if (seen.cur !== undefined && cur > seen.cur) fun.call('⚡', 'STAGE ' + (cur + 1) + ' — SEPARATION', '#ffd23a'); seen.cur = cur;
  if (f.space) once('space', '🌌', 'SPACE!', '#c9a8ff', true);
  if (f.orbit) once('orbit', '🛰️', 'ORBIT ACHIEVED', '#7dffa6', true);
  if (booster && booster.state === 'landed') once('bland', '🎯', 'BOOSTER LANDED', '#7dffa6', true);
  if (f.recovered) once('home', '🪂', 'WELCOME HOME', '#7dffa6', true);
  if (f.landed) once('land', '🏳️', 'TOUCHDOWN on the ' + P.BODIES[F.body].name, '#7dffa6', true);
  seen.mach = seen.mach; seen.maxMach = Math.max(seen.maxMach || 0, tel.machShown || 0);
  funAudio.wind(F.flags.dead ? 0 : tel.q || 0, tel.machShown || 0);
  // pilot HUD
  const b = P.BODIES[F.body], o = P.orbitOf(v), stages = v.stages.map((st, i) => ({ f: st.fuelMax > 0 ? st.fuel / st.fuelMax : 0, active: i === cur, gone: i < cur }));
  let o2 = []; const r = V.len(v.r), ex = V.scale(v.r, 1 / r), hh = V.cross(v.r, v.v), ey = V.norm(V.cross(hh, v.r));
  if ((funT2 = (funT2 || 0) + 1) % 5 === 0 || !lastO2) { try { const span = isFinite(o.T) ? o.T : 7200; for (let i = 0; i <= 64; i++) { const st = P.propagate(v.r, v.v, span * i / 64, b.mu); o2.push([V.dot(st.r, ex), V.dot(st.r, ey)]); } } catch (e) { o2 = []; } lastO2 = o2; } else o2 = lastO2;
  let obj;
  if (director) obj = (director.active ? '🎬 ' : '') + director.label;
  else if (!F.ignited) obj = '▶ ' + (PR.nextContract(PROG) ? 'Contract: ' + PR.nextContract(PROG).goal : 'Free flight');
  else if (!f.orbit) obj = P.altOf(v) < 100000 ? 'Climb to space — 100 km' : 'Build speed for orbit (Pe above 130 km)';
  else obj = F.body === 'earth' ? 'In orbit! Open 🎯 Missions or the map (M) to go further' : 'Exploring ' + b.name;
  if (F.parked || f.landed) { const lat = Math.asin(v.r[2] / r) * 180 / Math.PI, lon = Math.atan2(v.r[1], v.r[0]) * 180 / Math.PI, np = nearestPoi(F.body, b.R, lat, lon); if (np) obj += ` · 📍 ${np.poi.name} ${(np.d / 1000).toFixed(0)} km`; }
  fun.renderPilot({ alt: P.altOf(v), spd: V.len(v.v), stages, objective: obj, prog: director ? director.progress : f.orbit ? 1 : Math.min(1, P.altOf(v) / 140000), orbit2d: o2, bodyR: b.R, bodyCol: BODY_COL[F.body], me: [r, 0], director: !!(director && director.active) });
}
// ---------- f1u: visuals on the rocket itself (world space), so the HUD can stay thin ----------
const WV = (() => {
  const grp = new THREE.Group(); grp.renderOrder = 5; scene.add(grp);
  const mat = col => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending });
  const arrow = col => { const m = mat(col), g = new THREE.Group(), sh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), m), hd = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 12), m);
    g.add(sh, hd); g.userData = { sh, hd, m }; g.visible = false; grp.add(g); return g; };
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x4ad6ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), ringMat); ring.rotation.x = Math.PI / 2; ring.visible = false;
  const sepGeo = new THREE.RingGeometry(0.8, 1, 48), sepPool = [];
  const tag = document.createElement('div'); tag.id = 'craftTag'; tag.className = 'hidden'; tag.innerHTML = '<i id="ctAlt"></i><i id="ctSpd"></i>'; document.body.appendChild(tag);
  // f2 heat: an additive hull halo (red → orange → white with the heat model) and a bow-shock plasma sheath on reentry
  const hm = new THREE.MeshBasicMaterial({ color: 0xff5020, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide });
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), hm); halo.visible = false;
  const sm = new THREE.MeshBasicMaterial({ color: 0xff9a50, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const sheath = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm); sheath.visible = false; scene.add(sheath);
  return { halo, hm, sheath, sm, heat: { halo: 0, sheath: 0 }, grp, pro: arrow(0x7dffa6), tgt: arrow(0xff6ad5), ring, ringMat, ringOn: -1, seps: [], sepGeo, sepPool, tag, pulse: 0, box: null, boxT: 0 };
})();
const _wq = new THREE.Quaternion(), _wy = new THREE.Vector3(0, 1, 0), _wd = new THREE.Vector3(), _wb = new THREE.Box3(), _wb2 = new THREE.Box3(), _wp = new THREE.Vector3();
function placeArrow(a, d, L, at) { if (!d) { a.visible = false; return; } _wd.set(d[0], d[1], d[2]).normalize(); a.quaternion.setFromUnitVectors(_wy, _wd);
  const len = L * 1.15, w = Math.max(0.6, L / 26), u = a.userData; u.sh.scale.set(w, len, w); u.sh.position.y = len / 2 + L * 0.15; u.hd.scale.set(w, w, w); u.hd.position.y = len + L * 0.15 + 1.5 * w;
  a.position.copy(at); a.visible = true; }
function rocketScreenBox() { // projected bounding box of the craft (CSS px) — used by the tag and the ui_smoke "rocket not covered" check
  if (!rocketG || !rocketG.visible) return null; _wb.makeEmpty(); rocketG.updateMatrixWorld(true); const boxes = []; // f4: project each mesh box (one big AABB balloons when the camera is close and low)
  rocketG.traverseVisible(o => { if (!o.isMesh || o.isPoints || o.isSprite || o.isInstancedMesh) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || m.blending === THREE.AdditiveBlending || (m.transparent && !m.depthWrite)) return;
    for (let p = o; p && p !== rocketG; p = p.parent) if (p.userData && p.userData.isFx) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); _wb2.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); _wb.union(_wb2); boxes.push(_wb2.clone()); });
  if (_wb.isEmpty()) return null;
  const c = renderer.domElement.getBoundingClientRect(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, any = false;
  for (const bx of boxes) for (let i = 0; i < 8; i++) { _wp.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).project(camera); if (_wp.z > 1) continue; any = true;
    const x = c.left + (_wp.x + 1) / 2 * c.width, y = c.top + (1 - _wp.y) / 2 * c.height; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return any ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
// f1u2: the rocket stays clean — the craft tag, arrows and stage/separation rings are an opt-in drawer toggle (off by default)
const MARK = { on: (() => { try { return localStorage.getItem('orbitrush.markers') === '1'; } catch (e) { return false; } })() };
function setMarkers(on) { MARK.on = !!on; try { localStorage.setItem('orbitrush.markers', on ? '1' : '0'); } catch (e) { } const b = $('pMark'); if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
const _hc = new THREE.Color();
function heatVis(L, now) {
  let k = 0; for (let j = v.cur; j < SG.length; j++) for (const hp of SG[j].userData.hot) k = Math.max(k, skinGlow(hp.part && hp.part.Ts || 300));
  k = Math.max(k, Math.min(1, (v.tel.heat || 0) / 6e5)); const pl = lastFx ? Math.min(1, lastFx.plasma || 0) : 0;
  if (WV.halo.parent !== rocketG) rocketG.add(WV.halo);
  const g = P.stackGeom(v), r = g.d / 2 * 1.12 + 0.15, flick = 0.85 + 0.15 * Math.sin(now / 37) * Math.sin(now / 91);
  WV.halo.visible = k > 0.02; WV.halo.scale.set(r, g.L * 1.02, r); WV.halo.position.set(0, g.L / 2, 0);
  _hc.setRGB(1, 0.25 + 0.6 * k * k, 0.08 + 0.75 * k * k * k); WV.hm.color.copy(_hc); WV.hm.opacity = 0.55 * k * flick;
  const fb = v.tel.flowBody; WV.sheath.visible = pl > 0.03 && !!fb;
  if (WV.sheath.visible) { const d = _wd.set(fb[0], fb[1], fb[2]).applyQuaternion(rocketG.quaternion).normalize(); // flow direction in world space
    const noseW = new THREE.Vector3(0, 1, 0).applyQuaternion(rocketG.quaternion), lead = fb[1] < 0 ? g.L : 0;
    WV.sheath.position.copy(rocketG.position).addScaledVector(noseW, lead).addScaledVector(d, -g.d * 0.15);
    WV.sheath.quaternion.setFromUnitVectors(_wy, d.clone().negate()); const R = g.d * (0.75 + 0.35 * pl); WV.sheath.scale.set(R, R * (1.6 + 2.2 * pl), R);
    WV.sm.color.setRGB(1, 0.45 + 0.4 * pl, 0.3 + 0.6 * pl * pl); WV.sm.opacity = 0.5 * pl * flick; }
  WV.heat.halo = WV.halo.visible ? WV.hm.opacity : 0; WV.heat.sheath = WV.sheath.visible ? WV.sm.opacity : 0;
}
function worldVis(base, O, nose) {
  const on = MARK.on && state === 'flight' && F && !F.flags.dead && rocketG.visible && camMode !== 'map' && !photoOn && !replay;
  const now = performance.now(), L = Math.max(10, stackL());
  WV.grp.visible = on; WV.tag.classList.toggle('hidden', !on);
  { const hon = state === 'flight' && F && !F.flags.dead && rocketG.visible && camMode !== 'map' && !replay; if (hon) heatVis(Math.max(10, stackL()), performance.now()); else { WV.halo.visible = false; WV.sheath.visible = false; } }
  if (!on) { WV.ring.visible = false; WV.seps.length = 0; for (const m of WV.sepPool) m.visible = false; return; }
  _wp.copy(rocketG.position).addScaledVector(_wd.set(nose[0], nose[1], nose[2]), (v.tel.ycom || 0));
  const vs = P.airVel(v), sp = V.len(F.flags.orbit || P.altOf(v) > 40000 ? v.v : vs);
  placeArrow(WV.pro, F.ignited && sp > 20 ? (P.altOf(v) > 40000 ? v.v : vs) : null, L, _wp);
  placeArrow(WV.tgt, v.targetDir || null, L * 0.8, _wp);
  // active stage: a soft ring at its top edge, brighter for 2 s after staging
  const g = SG[v.cur]; if (g && WV.ringOn !== v.cur) { WV.ringOn = v.cur; g.add(WV.ring); _wb.setFromObject(g); const r = Math.max(1.5, (_wb.max.x - _wb.min.x) / 2 + 0.25); WV.ring.scale.set(r, r, r * 1.6); WV.ring.position.set(0, g.userData.h, 0); }
  if (g) { WV.ring.visible = SG.length - v.cur > 1; const k = Math.max(0, 1 - (now - WV.pulse) / 2000); WV.ringMat.opacity = 0.12 + 0.25 * k; }
  // separation markers: an expanding ring where each stage let go, fading over 3 s
  WV.seps = WV.seps.filter(m => now - m.t < 3000);
  WV.seps.forEach((m, i) => { let me = WV.sepPool[i]; if (!me) { me = new THREE.Mesh(WV.sepGeo, new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); WV.sepPool[i] = me; WV.grp.add(me); }
    const k = (now - m.t) / 3000; setRel(me, m.r, O); me.lookAt(camera.position); me.scale.setScalar(L * (0.3 + 1.6 * k)); me.material.opacity = 0.35 * (1 - k); me.visible = true; });
  for (let i = WV.seps.length; i < WV.sepPool.length; i++) WV.sepPool[i].visible = false;
  // the speed/altitude tag rides beside the craft
  if (now - WV.boxT > 90) { WV.boxT = now; WV.box = rocketScreenBox(); }
  const bx = WV.box, t = WV.tag;
  let x = null, y = 0; const TW = 92, TH = 38, yc = Math.min(innerHeight * 0.72, Math.max(innerHeight * 0.22, bx ? bx.y + bx.h * 0.35 : 0));
  if (bx && bx.w < innerWidth * 0.9) {
    if (bx.x + bx.w + 12 + TW < innerWidth - 8) { x = bx.x + bx.w + 12; y = yc; } else if (bx.x - 12 - TW > 8) { x = bx.x - 12 - TW; y = yc; }
    else if (bx.y + bx.h + 8 + TH < innerHeight * 0.8) { x = bx.x + bx.w / 2 - TW / 2; y = bx.y + bx.h + 8; } else if (bx.y - 8 - TH > innerHeight * 0.2) { x = bx.x + bx.w / 2 - TW / 2; y = bx.y - 8 - TH; } }
  if (x !== null) { x = Math.max(8, Math.min(innerWidth - TW - 8, x));
    t.style.transform = `translate3d(${Math.round(x)}px,${Math.round(y)}px,0)`; t.style.opacity = '1';
    const a = $('ctAlt'), s2 = $('ctSpd'), at = fmtKm(P.altOf(v)) + ' km', st = Math.round(fun.navOut.sp).toLocaleString() + ' m/s'; if (a.textContent !== at) a.textContent = at; if (s2.textContent !== st) s2.textContent = st; }
  else t.style.opacity = '0';
}
// compact strip: the same speed as the navball (one source), Ap/Pe or the next event, one short hint line
const fmtKm = m => { const k = m / 1000; return Math.abs(k) < 100 ? k.toFixed(1) : Math.abs(k) < 1e5 ? Math.round(k).toLocaleString() : (k / 1e6).toFixed(2) + 'M'; };
// f2: Ap/Pe slot that means something on ascent: below orbit it shows the apoapsis and "SUBORB" (or time to Ap)
function evAp(o) {
  if (!isFinite(o.ap)) return ['AP · PE km', '—'];
  const orb = isFinite(o.pe) && o.pe > (F.body === 'earth' ? 70000 : F.body === 'mars' || F.body === 'venus' || F.body === 'titan' ? 50000 : 2000), tAp = P.timeToApV(v);
  const k = x => (x >= 1e4 ? Math.round(x / 1000) : (x / 1000).toFixed(1)).toString();
  if (orb) return ['AP · PE km', k(o.ap) + '/' + k(o.pe)];
  const vr = V.dot(v.v, V.norm(v.r));
  if (vr > 5 && isFinite(tAp) && tAp > 0 && tAp < 3600) return ['AP km · T−AP', k(o.ap) + '·' + (tAp < 60 ? Math.round(tAp) + 's' : Math.floor(tAp / 60) + 'm' + String(Math.round(tAp % 60)).padStart(2, '0'))];
  if (isFinite(o.pe) && o.pe > 0) return ['AP · PE km', k(o.ap) + '/' + k(o.pe)];
  return ['AP km · SUBORB', k(o.ap)];
}
function engCells() {
  if (!document.body.classList.contains('eng') || state !== 'flight' || !F) return null;
  const tel = v.tel, cs = v.stages[v.cur], cv = flyingBooster() ? booster : v, n0 = x => isFinite(x) ? x : 0;
  return { eMach: n0(tel.machShown ?? tel.mach).toFixed(2), eQ: (n0(tel.q) / 1000).toFixed(1), eG: n0(tel.gload).toFixed(1), eVs: Math.round(V.dot(v.v, V.norm(v.r))).toString(),
    eDv: Math.round(n0(craftDv())).toLocaleString(), eFuel: cs && cs.fuelMax > 0 ? Math.round(cs.fuel / cs.fuelMax * 100) + '%' : '—', eThr: Math.round(100 * n0(cv.throttle || cv.ut)) + '%', eHeat: (n0(tel.heat) / 1000).toFixed(0) };
}
function stripTick() {
  if (!F || !cx) return;
  const no = fun.navOut, lab = { surface: 'SRF m/s', orbit: 'ORB m/s', target: 'TGT m/s' }[no.mode] || 'SRF m/s';
  const sp = no.sp, b = F.booster, lc = F.landCue; let evL = 'AP · PE km', ev = '—';
  if (F.flyingBooster() && b && isFinite(b.burnIn) && b.burnIn > 0.5) { evL = 'BURN T−'; ev = b.burnIn.toFixed(1) + ' s'; }
  else if (lc && !F.flags.landed && lc.burnIn > 0.5 && lc.burnIn < 600 && V.dot(P.airVel(v), V.norm(v.r)) < 0) { evL = 'BURN T−'; ev = lc.burnIn.toFixed(1) + ' s'; }
  else if (F.nodes.length) { evL = 'NODE T−'; ev = fmtDur(Math.max(0, F.nodes[0].t - (v.clock || 0))); }
  else if (F.ignited || F.flags.orbit || P.altOf(v) > 1000) { const o = P.orbitOf(v); const ea = evAp(o); evL = ea[0]; ev = ea[1]; }
  cx.update({ alt: fmtKm(P.altOf(v)), spd: sp < 1e5 ? Math.round(sp).toLocaleString() : (sp / 1000).toFixed(0) + 'k', spdL: lab, evL, ev, hint: $('hint').style.display === 'none' ? '' : $('hint').textContent });
  cx.updateEng(engCells());
}
// Navball glue: ship frame, local horizon, the marker directions and the landing burn cue
let navTgtT = 0, navTgt = null;
function navTick() {
  stripTick();
  if (camMode === 'map' || photoOn || !F || (split.on && innerHeight > innerWidth)) { fun.hideNav(); return; }
  const nose = P.noseOf(v), top = V.qrot(v.q, [0, 0, -1]), vs = P.airVel(v), up = V.norm(v.r), vo = v.v;
  const nrmv = V.len(V.cross(v.r, v.v)) > 1 ? V.norm(V.cross(v.r, v.v)) : null, pg = V.len(vo) > 1 ? V.norm(vo) : up, rad = V.norm(V.sub(up, V.scale(pg, V.dot(up, pg))));
  const now = performance.now();
  if (F.target && now - navTgtT > 250) { navTgtT = now; try { navTgt = P.transfer(F.target, F.body, [0, 0, 0], [0, 0, 0], F.tAbs); } catch (e) { navTgt = null; } } else if (!F.target) navTgt = null;
  const m = { nrm: nrmv, anti: nrmv && V.scale(nrmv, -1), radOut: rad, radIn: V.scale(rad, -1) };
  if (v.nodeDir && F.nodes.length) m.node = v.nodeDir;
  let vTgt = null; if (navTgt) { const d = V.sub(navTgt.r, v.r); if (V.len(d) > 1) { m.tgt = V.norm(d); m.antiTgt = V.scale(m.tgt, -1); v.targetDir = m.tgt; } vTgt = V.sub(v.v, navTgt.v); } else v.targetDir = null;
  const s = v.stages[v.cur], fuel = s && s.fuelMax > 0 ? s.fuel / s.fuelMax : 0;
  // landing burn cue: the booster you fly, or the lander's director solve
  let cue = '', cueWarn = false; const lc = F.landCue, b = F.booster;
  if (F.flyingBooster() && b && isFinite(b.burnIn)) { cue = b.burnIn > 0.5 ? `🔥 Landing burn in T−${b.burnIn.toFixed(1)} s` : b.landing ? 'LANDING BURN' : ''; cueWarn = !!b.lowTWR; }
  else if (lc && !F.flags.landed && P.altOf(v) < 150000 && V.dot(vs, up) < 0) { cue = lc.noLand ? '⚠ TWR too low to land' : lc.burnIn > 0.5 && lc.burnIn < 600 ? `🔥 Burn in T−${lc.burnIn.toFixed(1)} s${lc.lowTWR ? ' · low TWR' : ''}` : lc.burnIn <= 0.5 ? 'HOVERSLAM' : ''; cueWarn = lc.lowTWR || lc.noLand; }
  fun.renderNav({ alt: P.altOf(v), nose, top, r: v.r, vSurf: vs, vOrb: vo, vTgt, markers: m, throttle: v.throttle || 0, fuel, stage: v.cur + 1, sas: v.sas, cue, cueWarn, hasTarget: !!navTgt, hasNode: !!F.nodes.length });
}
let funT2 = 0, lastO2 = null;
function replayStep(rdt) { // instant replay of the last seconds before the explosion, slowed down, orbiting camera
  const rp = replay; rp.k += rdt * 60 * 0.45; const fr = recBuf[Math.floor(rp.k)];
  if (!fr) { v.r = rp.save.r; v.q = rp.save.q; v.v = rp.save.v; rocketG.visible = false; explode(v.r, v.v, true, true); replay = null; later(() => $('end').classList.remove('hidden'), 1800); return; }
  v.r = fr.r; v.q = fr.q; v.v = fr.vv; rocketG.visible = true; camYaw += rdt * 0.25;
  const pl = SG[fr.cur] && SG[fr.cur].userData.plume; for (let j = 0; j < SG.length; j++) { SG[j].visible = j >= fr.cur; if (SG[j].userData.plume) SG[j].userData.plume.visible = j === fr.cur && fr.thr > 0.01; }
}
function startReplay() { if (recBuf.length < 30) return; $('end').classList.add('hidden'); replay = { k: Math.max(0, recBuf.length - 420), save: { r: v.r.slice(), q: v.q.slice(), v: v.v.slice() } }; camDist = Math.max(60, stackL() * 2.5); fun.call('⟲', 'INSTANT REPLAY', '#fff'); }
$('replayBtn').onclick = () => startReplay();
function recordFlight(score) {
  const f = F.flags, top = v.stages[Math.min(F.lastPow, v.stages.length - 1)], visited = ['earth', ...Object.keys(F.goals || {})];
  const landed = Object.entries(F.goals || {}).find(([, g]) => g.landed);
  const r = { maxAlt: f.maxAlt || 0, space: !!f.space, orbit: !!f.orbit, boosterLanded: !!(booster && booster.state === 'landed') || !!(F.flagsB && F.flagsB.boosterBonus), recovered: !!f.recovered, visited, landed: landed ? landed[0] : null,
    dead: f.dead || null, maxMach: seen.maxMach || 0, maxHeat: F.maxHeat || 0, stages: v.stages.length, mass: F.stats ? F.stats.mass : 0, fuelLeft: F.orbitSnap ? F.orbitSnap.fuel : top && top.fuelMax ? top.fuel / top.fuelMax : 0, score, mission: director ? director.id : null };
  const out = PR.record(PROG, r); PR.save(localStorage, PROG);
  // f5 career ladder: the flown showroom vehicle and any ops contract result ride along
  let op = lastOp; if (opSess) { try { const e = evalOp(opSess.m, F, opSess); op = { id: opSess.m.id, ok: !!e.complete }; } catch (e) { } }
  const sh = SHOW.find(x => x.name === design.name);
  try { out.ladder = careerUI.record({ ...r, vehicle: sh ? sh.id : null, op: op ? op.id : null, opOk: !!(op && op.ok) }); } catch (e) { console.warn('[Orbit Rush] ladder', e); }
  return out;
}
function savePhoto(req) {
  const cv = renderer.domElement, w = cv.width, h = cv.height, c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g = c2.getContext('2d'); g.filter = req.filter || 'none'; g.drawImage(cv, 0, 0);
  g.filter = 'none'; g.font = `${Math.round(h / 40)}px sans-serif`; g.fillStyle = '#ffffffcc'; g.fillText('ORBIT RUSH · ' + (design.name || 'rocket') + ' · ' + P.BODIES[F.body].name, h / 40, h - h / 40);
  c2.toBlob(bl => { if (!bl) return; const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `orbit-rush-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  PROG.stats.photos++; const out = PR.record(PROG, { visited: [] }); PROG.stats.flights--; PR.save(localStorage, PROG); for (const a of out.ach) fun.call(a.icon, 'Achievement: ' + a.name, '#7dffa6', true);
  fun.call('📸', 'Photo saved', '#fff'); window.__lastPhoto = { w, h };
}
function testStand() { // static fire: engines lit at full throttle, held down by the clamps
  if (!validate(design).ok) return; launch(); v.holdDown = true; F.stagePress(); v.ut = 1; v.throttle = 1; camDist = Math.max(90, stackL() * 2.6); camYaw = 1.2; camPitch = 0.05;
  fun.call('🔥', 'TEST STAND — static fire', '#ffd23a', true);
  let peak = 0; const g0 = gen, id = setInterval(() => { if (g0 !== gen) { clearInterval(id); return; } peak = Math.max(peak, v.thrust || 0); }, 100);
  later(() => { v.ut = 0; v.throttle = 0; clearInterval(id); const w = buildVehicle(design), m = w.stages.reduce((a, s) => a + s.dry + s.fuel, 0);
    toast(`Static fire done: peak thrust ${(peak / 1000).toFixed(2)} MN vs weight ${(m * 9.80665 / 1000).toFixed(2)} MN → TWR ${(peak / (m * 9.80665)).toFixed(2)}`, '#7dffa6'); }, 9000);
  later(() => { if (state === 'flight') goBuild(); }, 13000);
}
function dropTest() { if (!validate(design).ok) return; launch(); F.placeState({ h: 1500, vUp: 0, vEast: 0, stage: 0, att: 'up', sas: 'stab' }); syncStages(); F.ignited = true; F.flags.liftoff = true; F.met = 20; v.ut = 0; v.throttle = 0; camDist = Math.max(120, stackL() * 3); fun.call('📦', 'DROP TEST — 1.5 km', '#ffd23a', true); }
$('missionsBtn').onclick = () => fun.openHub(); $('atlasBtn').onclick = () => fun.openAtlas();
// ---------- f2h: home = rocket showroom; the hangar is its own "Build" mode ----------
const showDesign = i => ({ ...cloneDesign(SHOW[i].design), name: SHOW[i].name }); // f4: hero rockets carry their brand name into the hangar/flight
const HOME_KEY = 'orbitrush.homeIdx', SHOW = SHOWROOM.map(r => { const o = { ...r, bars: showBars(r), missionLabel: missionLabel[r.mission] || '' }; if (r.model) Object.defineProperty(o, 'name', { get: () => brandVName(r.model), enumerable: true }); return o; }); // f4: hero-model rockets carry the brand name
// f5 career: vehicles / missions locked until their ladder rung is earned (sandbox: all open)
const rungLabel = c => c.brandKey ? brandMName(c.brandKey, c.name) : c.name;
var careerUI = createCareerUI({ store: localStorage, onPlay: c => playRung(c),
  name: { rung: rungLabel, vehicle: id => (SHOW.find(x => x.id === id) || { name: id }).name, site: id => brandLabel('site.' + id, SITE_NAMES[id] || id),
    part: id => (PARTS[id] || { name: id }).name, mission: id => (MISSIONS[id] || {}).name || brandMName(id, (opsList.find(m => m.id === id) || {}).name || id) } });
function lockWhy(kind, id) { if (!careerUI.locked(kind, id)) return null; const c = careerUI.unlockedBy(kind, id); return '🔒 Locked: earn "' + (c ? rungLabel(c) : '?') + '" in Career (or turn on Sandbox)'; }
const lockedFly = i => { const w = lockWhy('vehicles', SHOW[i].id); if (w) { fun.call('🔒', w.slice(2), '#ffb35c', true); careerUI.show(true); } return !!w; };
function playRung(c) {
  if (home && home.on) home.show(false);
  if (c.how === 'op') return startOp(c.op, true);
  if (c.how === 'mission') return startMission(c.mission);
  const i = SHOW.findIndex(x => x.id === c.vehicle); if (i >= 0) setDesign(showDesign(i)); launch();
  try { if (!F.ignited) F.stagePress(); F.setAuto(true, true); } catch (e) { } // f5: 1 tap -> liftoff on AUTO (ui_ideal_path budget)
}
addEventListener('career-change', () => { if (home) home.refresh(); });
var home = createHome({ list: SHOW, locked: i => !!lockWhy('vehicles', SHOW[i].id), onCareer: () => careerUI.show(true),
  onSelect: i => { try { localStorage.setItem(HOME_KEY, String(i)); } catch (e) { } setDesign(showDesign(i)); },
  onFly: i => { if (lockedFly(i)) return; setDesign(showDesign(i)); home.show(false); launch(); },
  onMission: i => { if (lockedFly(i)) return; const w = lockWhy('missions', SHOW[i].mission); if (w) { fun.call('🔒', w.slice(2), '#ffb35c', true); return; } home.show(false); startMission(SHOW[i].mission); },
  onBuild: i => { if (lockedFly(i)) return; goBuild.toHome = false; setDesign(showDesign(i)); home.show(false); refreshBuild(); },
  onMissions: () => fun.openHub(), onAtlas: () => fun.openAtlas(), onGear: () => $('hGearM').classList.toggle('hidden') });
{ const g = document.createElement('div'); g.id = 'hGearM'; g.className = 'hidden'; document.body.appendChild(g);
  const mk = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { g.classList.add('hidden'); fn(); }; g.appendChild(b); };
  for (const id of ['gfxSel', 'fxSel']) { const l = $(id) && $(id).closest('label'); if (l) g.appendChild(l); }
  { const sb = document.createElement('button'); sb.id = 'hSound'; const lab = () => { sb.textContent = funAudio.muted ? '🔇 Sound off' : '🔊 Sound on'; const pm = $('pMute'); if (pm) pm.textContent = funAudio.muted ? '🔇' : '🔊'; };
    sb.onclick = () => { initAudio(); funAudio.toggleMute(); lab(); }; lab(); g.appendChild(sb); }
  mk('⚙ All settings', () => qol.openSettings()); mk('🎓 Lessons (Academy)', () => academy.openMenu()); mk('Credits', () => $('creditsBtn').click());
  document.addEventListener('pointerdown', e => { if (!g.classList.contains('hidden') && !e.target.closest('#hGearM,#hGear')) g.classList.add('hidden'); }, true);
  const back = document.createElement('button'); back.id = 'homeBack'; back.className = 'acad'; back.textContent = '‹ Home'; back.title = 'Back to the rocket showroom';
  back.onclick = () => { goBuild.toHome = true; home.show(true); home.set(home.index); }; const bh = document.querySelector('#build .bhead'); if (bh) bh.prepend(back); }
setTimeout(prewarmHeavy, 1500);
if (!params.has('hangar')) { let i0 = 0; try { i0 = +localStorage.getItem(HOME_KEY) || 0; } catch (e) { } home.set(Math.min(SHOW.length - 1, Math.max(0, i0))); home.show(true); }
$('standBtn').onclick = () => testStand(); $('tunnelBtn').onclick = () => fun.openTunnel(); $('dropBtn').onclick = () => dropTest();
addEventListener('keydown', e => { if (e.code === 'Tab' && state === 'flight') e.preventDefault(); }, true);
refreshBuild();
setInterval(() => { const on = state === 'flight' && !replay; if (on !== funShown) { funShown = on; fun.show(on); } }, 200);
setMarkers(MARK.on);
// f3 plume audit: every visible plume group sits on an engine of a live stage; shock/vapor size; smoke trail lateral spread
function plumeAudit() {
  const out = { plumes: [], engines: 0, bad: [] }, wp = new THREE.Vector3(), we = new THREE.Vector3(), eng = [];
  rocketG.updateMatrixWorld(true); scene.updateMatrixWorld(true);
  for (let j = v.cur; j < SG.length; j++) SG[j].traverse(o => { if (o.isMesh && o.material === M.engine) { o.getWorldPosition(we); eng.push(we.clone()); } });
  const live = new Set(SG.slice(v.cur));
  scene.traverse(o => { const u = o.userData; if (!u || !u.glow || !u.core || !o.visible) return; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    o.getWorldPosition(wp); let dm = 1e9; for (const e of eng) dm = Math.min(dm, Math.hypot(wp.x - e.x, wp.z - e.z, 0) + 0 * e.y); const lat = Math.min(...eng.map(e => { const d = wp.clone().sub(e); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(rocketG.quaternion); return d.sub(ax.multiplyScalar(d.dot(ax))).length(); }));
    let g = o; while (g.parent && !live.has(g) && g !== scene) g = g.parent; const own = live.has(g) || (booster && booster.mesh && (() => { let x = o; while (x) { if (x === booster.mesh) return true; x = x.parent; } return false; })());
    out.plumes.push({ lat: +lat.toFixed(2), own }); if (!own || lat > Math.max(1.5, u.w * 2)) out.bad.push({ lat, own }); });
  out.engines = eng.length;
  const sh = fx.shock, vp = fx.vapor; out.shock = sh.visible ? +Math.max(sh.scale.x, sh.scale.y).toFixed(1) : 0; out.vapor = vp.visible ? +Math.max(vp.scale.x, vp.scale.y).toFixed(1) : 0;
  out.flow = fx.flow && fx.flow.mesh.visible; out.L = P.stackGeom(v).L;
  // smoke trail: lateral distance of live puffs from the line through the base along the velocity (a corkscrew = big spread)
  const nose = P.noseOf(v), vh = V.norm(V.sub(v.v, siteVel(v))), base = V.sub(v.r, V.scale(nose, v.tel.ycom)); let n = 0, s2 = 0, mx = 0;
  for (const p of smoke.d) { if (p.life <= 0) continue; const d = [p.x - base[0], p.y - base[1], p.z - base[2]], along = V.dot(d, vh); if (along > 60 || along < -400) continue; const lat = V.len(V.addS(d, vh, -along)); if (p.max - p.life > 2.5) continue; n++; s2 += lat * lat; mx = Math.max(mx, lat); }
  out.smoke = { samp: smoke.d.filter(p => { if (p.life <= 0 || p.max - p.life > 2.5) return false; const al = V.dot([p.x - base[0], p.y - base[1], p.z - base[2]], vh); return al < 60 && al > -400; }).slice(0, 10).map(p => { const d = [p.x - base[0], p.y - base[1], p.z - base[2]], al = V.dot(d, vh); return [+(p.max - p.life).toFixed(1), Math.round(al), Math.round(V.len(V.addS(d, vh, -al)))]; }), n, rms: n ? +Math.sqrt(s2 / n).toFixed(1) : 0, max: +mx.toFixed(1) }; return out;
}
window.__game = { get booster2() { return booster2; }, paneDbg: () => [booster, booster2].filter(Boolean).map((b, i) => { const S = paneSlots[i]; if (!S || !S.dbg || !b.mesh) return null; const cam = S.cam, q = b.mesh.getWorldQuaternion(new THREE.Quaternion()), ny = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const c0 = b.mesh.getWorldPosition(new THREE.Vector3()), p0 = c0.clone().project(cam), p1 = c0.clone().add(ny.clone().multiplyScalar(10)).project(cam), up = V.norm(b.r);
    const cu = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), crt = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    return { id: b.id || 'A', replay: !!(i === 0 && split.replay), state: b.state, phase: b.phase, meshVsDir: +(ny.x * b.dir[0] + ny.y * b.dir[1] + ny.z * b.dir[2]).toFixed(3), dirUp: +V.dot(b.dir, up).toFixed(3), noseScreenUp: +(p1.y - p0.y).toFixed(4), onScreen: Math.abs(p0.x) < 1 && Math.abs(p0.y) < 1 && p0.z < 1, camUpRadial: +(cu.x * up[0] + cu.y * up[1] + cu.z * up[2]).toFixed(3), roll: +(crt.x * up[0] + crt.y * up[1] + crt.z * up[2]).toFixed(3), R2: S.dbg.R2 }; }), dbgLayer: (k, on) => { const o = { atmo, tile, planet, clouds, lod: earthLOD.group }[k]; if (o) { if (on) o.layers.enable(0); else o.layers.disable(0); } if (k === "fog") scene.fog.density = on ? scene.fog.density : 0; return !!o; }, exhaustAudit: () => { // f4.1: live exhaust particles relative to the nozzle plane (along the air-relative velocity; > 0 = ahead)
    const va = V.sub(v.v, siteVel(v)), sp = V.len(va), vh = sp > 1 ? V.scale(va, 1 / sp) : P.noseOf(v), nz = V.sub(v.r, V.scale(P.noseOf(v), P.massProps(v).ycom)); let ahead = 0, maxA = -1e9, n = 0; const dbg = [];
    for (const sys of [fire, smoke]) for (const q of sys.d) { if (q.life <= 0 || Math.hypot(q.x, q.y, q.z) - P.R_E < 300) continue; /* ignore the pad cloud */ const a = V.dot([q.x - nz[0], q.y - nz[1], q.z - nz[2]], vh); if (V.len([q.x - nz[0], q.y - nz[1], q.z - nz[2]]) > 3000) continue; n++; if (a > maxA) maxA = a; if (a > 2) { ahead++; if (dbg.length < 6) dbg.push({ sys: sys === fire ? 'fire' : 'smoke', a: +a.toFixed(0), age: +(q.max - q.life).toFixed(2), c: q.c0 && q.c0.toString(16), d: q.drag, rva: +V.dot([q.vx - v.v[0], q.vy - v.v[1], q.vz - v.v[2]], vh).toFixed(0), an: +V.dot(P.noseOf(v), vh).toFixed(3), r: +V.len([q.x - nz[0], q.y - nz[1], q.z - nz[2]]).toFixed(0) }); } }
    return { n, ahead, maxAhead: n ? +maxA.toFixed(1) : null, alt: Math.round(F.alt), dbg }; }, audio: () => ({ state: ac ? ac.state : 'none', muted: funAudio.muted, master: master ? master.gain.value : -1, engine: rumble ? rumble.gain.value : -1, dest: !!ac }), plumeAudit, fxHide: on => { fx.root.visible = !on; }, home: () => ({ on: home.on, index: home.index, list: SHOW.map(r => ({ id: r.id, name: r.name, mission: r.mission })) }), homeSet: i => home.set(i), lod: () => ({ tier: LOD_TIER, earth: earthLOD.stats, body: bodyCur && bodyLODs[bodyCur] ? bodyLODs[bodyCur].stats : null, renderer: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles } }), padMarker: (on = true, km = 25) => { let m = earth.getObjectByName('padMarker'); if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff2040, depthTest: false })); m.name = 'padMarker'; m.renderOrder = 99; m.position.set(R + 2000, 0, 0); earth.add(m); } m.scale.setScalar(km * 1000); m.visible = on; earth.updateMatrixWorld(true); const w = m.getWorldPosition(new THREE.Vector3()).sub(earth.position).normalize(); return { lat: GX.PAD_LAT_DEG, lon: GX.PAD_LON_DEG, dir: [w.x, w.y, w.z] }; }, career: () => careerUI, showEnd: () => showEnd(), heatFx: () => ({ ...WV.heat }), bodyVis: () => ({ id: F && F.body, body: bodyG.visible, ground: bodyGround.visible, earth: earth.visible, fog: scene.fog.density, sky: scene.background && scene.background.getHexString ? scene.background.getHexString() : '' }), rocketBox: () => rocketScreenBox(), markers: setMarkers, get markersOn() { return MARK.on; }, fun, PR, get PROG() { return PROG; }, get director() { return director; }, startMission, testStand, dropTest, startReplay, get replay() { return replay; }, explode, split, splitOn: on => { split.enabled = on; try { localStorage.setItem(SPLIT_KEY, on ? '1' : '0'); } catch (e) { } }, smokeLive: () => smoke.d.filter(p => p.life > 0).length, gfx: { atmo: () => ({ vis: atmo.visible, gain: atmoMat.userData.gain.value, c: atmoMat.userData.center.value.toArray().map(Math.round), pos: atmo.position.toArray().map(Math.round), cam: camera.position.toArray().map(Math.round) }), renderState: () => ({ scene: GX.renderState.scene === scene ? 'flight' : GX.renderState.scene === smap.scene ? 'map' : '?', camera: GX.renderState.camera === camera ? 'flight' : GX.renderState.camera === smap.camera ? 'map' : '?', via: GX.renderState.via }), info: () => ({ q: gfxQ, bloom: post.on, tone: renderer.toneMapping, earthPx: !!earthPx, env: !!scene.environment }), setGfx, shake, flashAt },  BUILD, P, C, TEMPLATES, smap, scenario: (k, o) => runScenario(k, o), get F() { return F; }, get v() { return v; }, get flags() { return F.flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return F.ship; }, press, keys, get ignited() { return F.ignited; }, get warp() { return F.effWarp(); }, launch, goBuild, get design() { return design; }, setDesign: d => setDesign(cloneDesign(d)), get SG() { return SG; }, get camMode() { return camMode; }, warpStep, warpReset, warpMaxI, exitMap, get mapZoom() { return mapZoom; }, get academy() { return academy; }, fx, get fxState() { return lastFx; }, get fxMs() { return fxMs; }, setCam: (d, yaw, pitch, aim) => { camDist = d; if (aim !== undefined) camAim = aim; if (yaw !== undefined) camYaw = yaw; if (pitch !== undefined) camPitch = pitch; }, setFx, get verdictWorker() { return !!verdictWorker; }, syncStages, quicksave, quickload, revertLaunch, setPause, get paused() { return paused; }, get settings() { return SET; }, undo, redo, get hist() { return hist; }, qol, partTip, get envId() { return envId; }, setEnv: id => { envId = id; refreshBuild(); }, craftDv };
