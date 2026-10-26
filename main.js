import * as THREE from 'three/webgpu';
import { migrateSave } from './vehicles/id_aliases.js?v=f5.9-6';
import { uniform } from 'three/tsl';
import * as P from './physics.js?v=f5.9-6';
import { Flight, PRESETS, SIM_SPEED, WARPS, QALPHA_MAX, shipPos, chuteLimits, SAFE_TOUCHDOWN, fmtDur } from './flight.js?v=f5.9-6';
import * as C from './physics/patched.js?v=f5.9-6';
import { loadMissions } from './missions/catalog.js';
import { missionDesign, applyMission, missionSession, missionHooks, missionFlightOpts, evaluate as evalOp, missionName as opName } from './missions/runner.js';
import { CAREER, CONTRACTS, missionOf } from './missions/campaign/career.js';
var sbSite = loadSite(); // f5.4 sandbox launch site (null = the classic career pad)
var opsList = [], opSess = null, opHooks = null, opFlightOpts = null, opContract = null; // f4 career/ops state (var: used by showPreview at boot)
import { loadBrand, applyBrandDom, B as brandB, vehicleName as brandVName, missionName as brandMName, label as brandLabel } from './brand/index.js?v=f5.9-6';
import { createCareerUI } from './fun/career-ui.js?v=f5.9-6';
import { SITE_NAMES, LADDER, rungLocked } from './fun/ladder.js?v=f5.9-6';
import { createSolarMap } from './solarmap.js?v=f5.9-6';
import { PARTS, TEMPLATES, designStats, validate, cloneDesign, buildVehicle, aeroBalance } from './parts.js?v=f5.9-6';
import { FX } from './fx.js?v=f5.9-6';
import { createAcademy } from './academy-ui.js?v=f5.9-6';
import { createMobile, isTouch } from './mobile.js?v=f5.9-6';
import { localize } from './wording.js?v=f5.9-6';
import { loadSettings, saveSettings, makeTranslator, fmtDist, fmtSpeed } from './settings.js?v=f5.9-6';
import { createQoL, dvTableHTML } from './qol-ui.js?v=f5.9-6';
const TOUCH = isTouch();
let PROG = PR.load(localStorage), fun = null; // f1 progress (localStorage) and the fun-layer UI (created further down)
// Milestone Q settings: key remap, sensitivity, units, overlays (settings.js; saved in localStorage)
let SET = loadSettings(localStorage), translate = makeTranslator(SET);
const fmtS = mps => fmtSpeed(mps, SET.units); UN.bindUnits(() => SET.units); // f5.7q (owner): every HUD/pane/card reads the Units setting
import { QUALITY, QUALITY_ORDER, plumeShape, plumeLook, skinGlow, sheathAlpha, haloAlpha, flamePuffs, plumeFlicker, glowScaleK, groundSmokeK, fillLight, VAC_PLUME, vacBlend, vacAlt, vacWidth, vacOpacity, smokeWidthCap, smokeFade } from './fxmap.js?v=f5.9-6';
import { halfPose, buildHalves, sepShells } from './fun/fairing.js?v=f5.9-6';
import { guardToasts } from './fun/toastzone.js?v=f5.9-6';
import * as GX from './gfx/gfx.js?v=f5.9-6';
import { Director, MISSIONS, hopAuto, isHopper } from './fun/director.js?v=f5.9-6';
import * as PR from './fun/progress.js?v=f5.9-6';
import * as WORLD from './fun/world.js?v=f5.9-6';
import { stageEngines, coreInfo, nozzles, nozzleR, vehicleOf, LOOK as PLOOK } from './fun/exhaust.js?v=f5.9-6';
import { ATLAS, nearestPoi } from './fun/lore.js?v=f5.9-6';
import { createAudio } from './fun/audio.js?v=f5.9-6';
import { createMusic } from './fun/music.js?v=f5.9-6';
import { createCompact } from './fun/compact.js?v=f5.9-6';
import { attachNavStick, aoaLimit, limitToPrograde, frameOf } from './fun/navstick.js?v=f5.9-6';
import { softPlumeMaterial, vacPlumeMaterial, SOFT_K } from './fun/plumemat.js?v=f5.9-6';
import { thrustScale, plumeLayout } from './fun/plumetable.js?v=f5.9-6';
import { plumeDims, styleFor, vacFactors } from './gfx/plume_style.js?v=f5.9-6'; // QA plume pass: exhaust style per propellant + size from the engine
import { NOZZLES } from './gfx/vehicles/nozzles.js?v=f5.9-6';
import * as UN from './fun/units.js?v=f5.9-6';
import { createPlainHud, apsisLine, stageDvs, fmtHeight, MPH, landAid } from './fun/plainhud.js?v=f5.9-6';
import { createHome } from './fun/home.js?v=f5.9-6';
import { SHOWROOM, MODEL_OF, RETIRED, DEFAULT_ID, bars as showBars, missionLabel } from './fun/showroom.js?v=f5.9-6';
import { frameRocket, SHOWROOM_PAD } from './gfx/showroom_frame.js?v=f5.9-6';
import { createFunUI } from './fun/ui.js?v=f5.9-6';
import { buildLOD as heroLOD, prewarm as heroPrewarm, takeWarm, HOUSE_SETS, VEHICLES as ART, ART_NAMES, dispose as heroDispose, release as heroRelease, setPayload as heroSetPayload, buildPayload } from './gfx/vehicles/vehicles.js?v=f5.9-6';
import { payloadKindFor } from './gfx/vehicles/payload_kinds.js?v=f5.9-6';
import { craftTypeFor, typeOf as craftTypeOf, kindOfType, CRAFT_TYPES, PROPULSION as CRAFT_PROP } from './data/craft_types.js?v=f5.9-6'; // f6.2: craft types, switching between vessels
import { buildCraftStages, buildStageModel, PLUME_OF } from './gfx/vehicles/craft_models.js?v=f5.9-6';
import { createVesselUI } from './fun/vesselui.js?v=f5.9-6';
import { dropPlan, pickBase, modelGroups } from './fun/stagemap.js?v=f5.9-6';
import { STAGE_KEYS, HEIGHTS } from './gfx/vehicles/stage_keys.js?v=f5.9-6';
import { dimsOf } from './vehicles/dims.js?v=f5.9-6';
import { EXTRA_STACKS } from './fun/showroom.js?v=f5.9-6';
import { specFor, specDesign, payloadT, specStages } from './fun/specstack.js?v=f5.9-6';
import { qualifying, launchPlan, autoNote, cardChoice } from './fun/mispick.js?v=f5.9-6';
import { pickerHTML, baseFor, roleFor, CLASS_OF, filterPicker, SHORT as SHORT_HOUSE } from './fun/picker.js?v=f5.9-6';
import { createClouds as w1Clouds, cloudUniforms as w1CU } from './gfx/world/clouds.js?v=w1';
import { worldTier } from './gfx/world/tiers.js?v=w1';
import { WS as W1_WS } from './gfx/world/common.js?v=w1';
import { surfaceUniforms as w1SU, moonSurfaceMaterial as w1Moon, marsSurfaceMaterial as w1Mars } from './gfx/world/surfaces.js?v=w1';
import { createPlanetLOD } from './gfx/planetlod.js?v=f5.9-6';
import { createSitePicker, loadSite, siteLabel } from './fun/sitepicker.js?v=f5.9-6';
import { siteOpts, artFor, SITES as SB_SITES } from './sites.js?v=f5.9-6';
import { buildSiteLOD, placeSite, disposeSite, setSiteNight } from './gfx/sites/kit.js?v=f5.9-6';
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
const BAKE_C = new THREE.Color(parseInt((location.search.match(/[?&]bg=([0-9a-f]{6})/) || [0, '14233b'])[1], 16)); /* f5.8g: ?bg= lighter backdrop for metal liveries (they mirror it) */ if (/[?&]bake\b/.test(location.search)) window.__bake = true;
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
let swingArm, padConcM = null, padConc0 = null, padShow = false;
function buildLaunchComplex() {
  const g = new THREE.Group();
  const conc = new THREE.Mesh(new THREE.CylinderGeometry(32, 36, 4, 40), new THREE.MeshStandardMaterial({ map: (() => { const t = GX.concreteTexture(); t.repeat.set(4, 4); return t; })(), roughness: 0.92 })); conc.position.y = PAD_Z - 2; g.add(conc); padConcM = conc.material; padConc0 = { color: conc.material.color.getHex(), roughness: conc.material.roughness, env: conc.material.envMapIntensity };
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
const PAD_EF = [1, 0, 0], PAD_Z = 0.4, DECK = 3, PAD_LAND_COS = Math.cos(2500 / 6378137), PAD_COAST_COS = Math.cos(30000 / 6378137);
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
  if (bodyG.visible && bodyCur && bodyCur !== 'sun') { let L = bodyLODs[bodyCur]; if (!L) { L = bodyLODs[bodyCur] = createPlanetLOD({ radius: P.BODIES[bodyCur].R - 60, material: bodyMaterialOf(bodyCur), tier: LOD_TIER, uvM: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2)).invert() }); bodyG.add(L.group); }
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
// flight-ground-1: the Moon and Mars drew a 512 px procedural crater canvas tinted one colour (no real map, no close-up
// detail). Now every body with a licensed map uses it, and the Moon/Mars use the world-1 surface materials (map + distance-
// faded regolith/dune detail normals + Mars dust haze), UVs from the surface direction so chunks, sphere and ground disc agree.
const BODY_MATS = {}, bodyU = {};
function bodyMaterialOf(id) {
  if (BODY_MATS[id]) return BODY_MATS[id];
  W1_WS.value = 0.001; let m; const wt = worldTier(gfxQ, TOUCH) === 'low' ? 'low' : gfxQ === 'high' ? 'high' : 'med';
  if (id === 'moon' || id === 'mars') { const t = GX.tex(id, gfxQ); t.anisotropy = TOUCH ? 4 : 8; const U = bodyU[id] = w1SU({ R: P.BODIES[id].R / 1000 });
    U.rot.value.set(1, 0, 0, 0, 0, 1, 0, -1, 0); // game bodies are Z-up (bodyGeo.rotateX(PI/2)); the map is Y-up
    m = id === 'moon' ? w1Moon({ moon: t }, wt, U) : w1Mars({ mars: t }, wt, U); }
  else if (GX.BODY_TEX[id] && id !== 'sun') { m = new THREE.MeshStandardMaterial({ map: GX.tex(GX.BODY_TEX[id], gfxQ), roughness: 0.95, metalness: 0 }); m.map.anisotropy = TOUCH ? 4 : 8; }
  else m = bodyMat;
  return BODY_MATS[id] = m;
}
const bodyGround = new THREE.Mesh(new THREE.CircleGeometry(8000, 64), bodyMat); bodyGround.visible = false; scene.add(bodyGround);
const _bAbs = (id, t) => { let r = [0, 0, 0]; for (let b = id; b && P.BODIES[b] && P.BODIES[b].parent; b = P.BODIES[b].parent) r = V.add(r, P.relState(b, t).r); return r; };
let bodyCur = null;
function placeBodies(O, th) { // returns false when the current SOI is the Earth (old path)
  const id = F && F.body || 'earth';
  if (id === 'earth') { bodyG.visible = bodyGround.visible = false; earth.visible = true; return false; }
  const b = P.BODIES[id]; if (bodyCur !== id) { bodyCur = id; bodyMat.color.set(BODY_COL[id] || '#999'); bodyMat.emissive.set(id === 'sun' ? '#ffb040' : '#000'); bodyMat.emissiveIntensity = id === 'sun' ? 2 : 0; bodySph.material = bodyGround.material = bodyMaterialOf(id);
    // arriving at a new world: tip the chase camera so its limb is in frame (the player can still drag)
  }
  if (id !== 'sun' && camMode === 'chase' && performance.now() - camUserT > 8000) { const dep = Math.acos(Math.min(1, b.R / Math.max(b.R, V.len(O)))), want = Math.min(1.3, Math.max(0.12, dep - 0.12)); const nw = performance.now(), dt = Math.min(0.5, (nw - (placeBodies.t || nw)) / 1000); camPitch += (want - camPitch) * (1 - Math.exp(-dt * 2)); }
  placeBodies.t = performance.now();
  const Rb = b.R; bodySph.scale.setScalar(Rb - 60); bodyG.position.set(-O[0], -O[1], -O[2]); bodyG.visible = true;
  const e = V.sub(_bAbs('earth', F.tAbs), _bAbs(id, F.tAbs)); earth.position.set(e[0] - O[0], e[1] - O[1], e[2] - O[2]); earth.rotation.z = th; earth.visible = V.len(e) > Rb * 2;
  { const U = bodyU[id]; if (U) { U.center.value.set(-O[0], -O[1], -O[2]).multiplyScalar(0.001); U.sunDir.value.copy(sunDirV); if (F && F.alt < 200 && state !== 'map') { const l = V.len(O); U.site.value.set(O[0] / l, O[1] / l, O[2] / l); } /* flight-ground-2: flatten relief under the pad the craft stands on */ } }
  const alt = V.len(O) - Rb; bodyGround.visible = alt < 30000 && alt > -500;
  if (bodyGround.visible) { const u = V.norm(O); bodyGround.position.set(u[0] * Rb - O[0], u[1] * Rb - O[1], u[2] * Rb - O[2]); bodyGround.lookAt(bodyGround.position.x + u[0], bodyGround.position.y + u[1], bodyGround.position.z + u[2]); }
  siteHolder.rotation.z = P.omegaOf(F.v) * (F.v.clock || 0); // the art complex turns with the world
  if (offPad) { offPad.visible = !!(F.sandbox && alt < 60000 && !siteArt.objMain); if (offPad.visible) { const w = P.omegaOf(F.v) * (F.v.clock || 0), sp = V.rotZ(V.scale(F.siteEf, Rb), w), u = V.norm(sp);
    offPad.position.set(sp[0] - O[0], sp[1] - O[1], sp[2] - O[2]); offPad.lookAt(offPad.position.x + u[0], offPad.position.y + u[1], offPad.position.z + u[2]); } }
  return true;
}
// f5.4: basic pad for sandbox launches off Earth (slab + flame trench ring + 4 lights), z-up so lookAt points it along the local vertical
const siteHolder = new THREE.Group(); bodyG.add(siteHolder); // f5.4: off-Earth art complexes live in the body-fixed frame
// f5.4 space centers (gfx/sites, Rocket Art): the picked site's complex at its real coordinates (Earth: in the Earth group; elsewhere: body frame).
// Earth presets at the cape also show Landing Zone One. Unpicked (career) keeps the classic pad complex.
const siteArt = { key: '', obj: [], data: {} };
const loadSiteArt = id => siteArt.data[id] ? Promise.resolve(siteArt.data[id]) : import('./gfx/sites/site_' + id + '.js?v=f5.9-6').then(m => (siteArt.data[id] = m.SITE));
// f5.4k (QA 4): a site whose main pad is a catch tower (gulf-port) has the tower at its origin and the launch mount ~35 m off
// along +Z, 18 m up. Shift the art so the mount sits under the rocket, and remember the tower so the Home camera arcs away from it.
function padOfs(S) { const c = (S.layout || []).find(o => o.k === 'catch' && o.at && !o.at[0] && !o.at[1]); if (!c) return null;
  const w = c.w || 12, zc = w / 2 + (c.arm || 35) * 0.85; return [0, -18, -zc]; }
function siteTower() { const L = siteArt.objMain, S = L && siteArt.S; if (!L || !L.visible || !padOfs(S)) return null; return L.localToWorld(new THREE.Vector3(0, 40, 0)); }
// f5.4j: site lights (they start on) follow the local sun: on below about -4° elevation, off above -2° (hysteresis, no flicker)
function siteNight(el) { for (const L of siteArt.obj) { if (!L.parent) continue; const was = L.userData.night;
  const on = was == null ? el < -4 : was ? el < -2 : el < -4; if (on !== was) { L.userData.night = on; setSiteNight(L, on); } L.userData.sunEl = el; } }
function syncSiteArt() { const s = sbSite && !opFlightOpts && F && F.sandbox ? sbSite : null, key = s ? [s.body, s.id, s.lat, s.lon].join(':') : '';
  if (key === siteArt.key) return; siteArt.key = key; for (const o of siteArt.obj) disposeSite(o); siteArt.obj = []; siteArt.objMain = null;
  if (padCx) padCx.visible = !(s && s.body === 'earth');
  if (!s) return; const art = artFor(s), ids = [art]; const pre = (SB_SITES[s.body] || []).find(x => x[0] === s.id); if (pre && pre[5]) ids.push('lz1');
  Promise.all(ids.map(loadSiteArt)).then(list => { if (key !== siteArt.key) return; list.forEach((S0, i) => {
    const own = i > 0 || (art !== 'generic' && S0.body === s.body), S = own ? S0 : { ...S0, body: s.body, lat: s.lat, lon: s.lon }, Rb = s.body === 'earth' ? R : P.BODIES[s.body].R;
    const L = buildSiteLOD(S, { phone: TOUCH }); placeSite(L, S, Rb); const po = !i && padOfs(S); if (po) { L.translateX(po[0]); L.translateY(po[1]); L.translateZ(po[2]); } (s.body === 'earth' ? earth : siteHolder).add(L); siteArt.obj.push(L); if (!i) { siteArt.objMain = L; siteArt.S = S; } }); }).catch(e => console.warn('site art', e)); }
const offPad = (() => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.85 }), d = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9 });
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(40, 44, 1.6, 40), m); slab.rotation.x = Math.PI / 2; g.add(slab);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 1.2, 8, 32), d); ring.position.z = 0.85; g.add(ring);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.6, mast = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 22, 8), m); mast.rotation.x = Math.PI / 2; mast.position.set(Math.cos(a) * 34, Math.sin(a) * 34, 11); g.add(mast);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); lamp.position.set(Math.cos(a) * 34, Math.sin(a) * 34, 22.5); g.add(lamp); }
  g.visible = false; scene.add(g); return g; })();
const ATMO_R = R + 110000, atmoMat = GX.atmoMaterial({ R, Ra: ATMO_R });
const atmo = new THREE.Mesh(new THREE.SphereGeometry(ATMO_R, 128, 64), atmoMat); atmo.frustumCulled = false; scene.add(atmo); // scene-level: placed at the Earth centre each frame
const mwTex = GX.tex('milkyway', gfxQ); const stars = new THREE.Mesh(new THREE.SphereGeometry(1e8, 48, 24), new THREE.MeshBasicMaterial({ map: mwTex, color: new THREE.Color(1.3, 1.3, 1.4), side: THREE.BackSide, transparent: true, depthWrite: false })); stars.rotation.set(1.1, 0.4, 0.2); stars.renderOrder = -10; // f1: sky first, so it never paints over the plume and other transparent effects
scene.add(stars);
// f6.4: the far plane and the sky sphere follow the farthest drawn body. The sky sphere was a fixed 1e8 m (100,000 km): once a
// planet's surface was further than that from the camera (an escape or lunar trajectory) the sphere was NEARER than the planet,
// the depth test passed, and the Milky Way painted over it (dark, see-through globe) while the later-drawn clouds still showed.
// Now far = 2e9 m, or 1.6x the farthest body edge rounded up to a power of two (so it rarely changes), and the sky sits at 0.9*far.
const FAR_MIN = 2e9, STARS_R = 1e8, _fw = new THREE.Vector3();
function fitFar() {
  let need = 0; const id = (F && F.body) || 'earth';
  if (earth.visible) { earth.getWorldPosition(_fw); need = Math.max(need, _fw.distanceTo(camera.position) + R); }
  if (bodyG.visible && id !== 'earth') { const b = P.BODIES[id]; need = Math.max(need, camera.position.distanceTo(bodyG.position) + (b ? b.R : 0)); }
  const far = FAR_MIN * Math.pow(2, Math.max(0, Math.ceil(Math.log2(need * 1.6 / FAR_MIN))));
  if (far !== camera.far) { camera.far = far; camera.updateProjectionMatrix(); }
  stars.scale.setScalar(far * 0.9 / STARS_R);
}
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
  tileGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4), 4)); // flight-ground-3: rgb + water mask in .a (the separate 'wat' attribute never re-uploaded after a rebuild: the shader read 0 = all land)
  tileGeo.setAttribute('wat', new THREE.BufferAttribute(new Float32Array(n), 1)); // f5: water mask (0 land .. 1 sea) drives colour + specular
  for (let j = 0; j < TNS; j++) idx.push(0, 1 + j, 1 + (j + 1) % TNS);
  for (let i = 0; i < TNR - 1; i++) for (let j = 0; j < TNS; j++) { const a = 1 + i * TNS + j, b = 1 + i * TNS + (j + 1) % TNS, c = a + TNS, d = b + TNS; idx.push(a, c, b, b, c, d); }
  tileGeo.setIndex(idx);
  const nrm = new Float32Array(n * 3); for (let k = 0; k < n; k++) nrm[k * 3 + 1] = 1; tileGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); } // normals exist before the first compile
const TILE_TIER = worldTier(gfxQ, TOUCH) === 'low' ? 'low' : gfxQ === 'high' ? 'high' : 'med';
const tile = new THREE.Mesh(tileGeo, GX.tileMaterial(sunPos, TILE_TIER)); tile.frustumCulled = false; earth.add(tile);
// f5.9 terrain: the same geometry again with the fading (blended) material, drawn instead of `tile` above GX.TILE_FADE.swap metres (both exist at start so compileAsync warms both)
const tileF = new THREE.Mesh(tileGeo, GX.tileMaterial(sunPos, TILE_TIER, true)); tileF.frustumCulled = false; tileF.renderOrder = -1; earth.add(tileF);
let tileForceOff = false; // test hook (__game.tileOff)
let tileC = null, earthPx = null; GX.earthPixels(gfxQ).then(px => { earthPx = px; tileC = null; padLandColor(); });
const tileRGBA = [0, 0, 0, 0], GLOBE_SAG = 600, smooth01 = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
// f5.9 terrain: the land colour of the surrounding map (inland Florida, 40-80 km west of the pad), so the pad's shaped coast/scrub is the SAME ground as its neighbours, not a dark patch
let padLand = null; function padLandColor() { if (padLand || !earthPx) return padLand; const o = [0, 0, 0, 0], a = [0, 0, 0]; let n = 0; for (const [s, nn2] of [[40000, 0], [60000, 15000], [80000, -15000], [55000, -25000], [70000, 25000]]) { const w = s / R, x = nn2 / R, d = V.norm([Math.cos(w), -Math.sin(w), x]); GX.sampleEarth(earthPx, d, o); if (o[3] < 0.5) { a[0] += o[0]; a[1] += o[1]; a[2] += o[2]; n++; } } padLand = n ? [a[0] / n, a[1] / n, a[2] / n] : [0.03, 0.043, 0.02]; GX.padLandU.value.set(padLand[0], padLand[1], padLand[2]); return padLand; }
function updateTile(ef) {
  const siteE = typeof F !== 'undefined' && F && F.homeBody === 'earth' && F.siteEf ? F.siteEf : null; // flight-ground-3: sandbox Earth sites
  if (tileC && V.dot(tileC, ef) > Math.cos(25000 / R) && updateTile.site === siteE) return; updateTile.site = siteE;
  const c = V.norm(ef), e = P.eastOf(c), nn = V.cross(c, e), pos = tileGeo.attributes.position.array, col = tileGeo.attributes.color.array, wat = tileGeo.attributes.wat.array, rgb = [0, 0, 0];
  tileC = c; tile.position.set(c[0] * R, c[1] * R, c[2] * R); tileF.position.copy(tile.position);
  const put = (k, th, ph) => {
    const s = Math.sin(th), cm1 = -2 * Math.sin(th / 2) ** 2, dx = Math.cos(ph) * s, dy = Math.sin(ph) * s;
    const off = [c[0] * cm1 + e[0] * dx + nn[0] * dy, c[1] * cm1 + e[1] * dx + nn[1] * dy, c[2] * cm1 + e[2] * dx + nn[2] * dy];
    const dd = V.norm(V.add(c, off)), drop = GLOBE_SAG * smooth01((th * R - 60000) / 90000); // f5.9 terrain: the globe sphere sits GLOBE_SAG below true sea level, so settle the tile onto it over its outer 90 km: no cliff at the rim
    pos[k * 3] = off[0] * R - dd[0] * drop; pos[k * 3 + 1] = off[1] * R - dd[1] * drop; pos[k * 3 + 2] = off[2] * R - dd[2] * drop;
    if (earthPx) { GX.sampleEarth(earthPx, dd, tileRGBA); if (dd[0] > PAD_COAST_COS) { /* flight-ground-2: the 1k mask's ~40 km coastal texel made the pad an island on a beige-grey smear; shape a real coast instead: land (scrub) to the west, a beach, open sea ~1.5 km east of the pad */
        const eM = dd[1] * R, nM = dd[2] * R, coast = 1500 + 900 * (fbm(nM * 0.00025, 3.1, 7.7) - 0.5) * 2 + 0.25 * Math.max(0, nM) * 0.12, wC = Math.min(1, Math.max(0, (eM - coast) / 300 + 0.5)), blend = 1 - smooth01((Math.acos(Math.min(1, dd[0])) * R - 6000) / 24000); // f5.9: smooth 6->30 km fade (was a linear 5->30 km ramp)
        const beach = Math.max(0, 1 - Math.abs(eM - coast + 120) / 160), scrub = 0.85 + 0.3 * fbm(eM * 0.002, nM * 0.002, 2.2), pl = padLandColor() || [0.03, 0.043, 0.02], k0 = 1 / 0.043 * pl[1];
        const lr = pl[0] * scrub + beach * 0.07 * k0, lg = pl[1] * scrub + beach * 0.06 * k0, lb = pl[2] * scrub + beach * 0.045 * k0;
        if (wC < 0.5) { tileRGBA[0] += (lr - tileRGBA[0]) * blend; tileRGBA[1] += (lg - tileRGBA[1]) * blend; tileRGBA[2] += (lb - tileRGBA[2]) * blend; }
        tileRGBA[3] += (wC * 0.9 + (wC > 0.5 ? 0.1 : 0) - tileRGBA[3]) * blend; }
      if (siteE) { const dS = Math.acos(Math.min(1, V.dot(dd, siteE))) * R, lk = Math.min(1, Math.max(0, (800 - dS) / 300)); /* the pad complex stands on land: a ~0.5-0.8 km land/scrub apron, then the map's own coast */
        if (lk > 0) { const sc = 0.85 + 0.3 * fbm(dd[0] * 3000, dd[1] * 3000, dd[2] * 3000); { const pl = padLandColor() || [0.03, 0.043, 0.02]; tileRGBA[0] += (pl[0] * sc - tileRGBA[0]) * lk; tileRGBA[1] += (pl[1] * sc - tileRGBA[1]) * lk; tileRGBA[2] += (pl[2] * sc - tileRGBA[2]) * lk; } tileRGBA[3] *= 1 - lk; } } const f = (0.8 + 0.4 * fbm(dd[0] * 2400, dd[1] * 2400, dd[2] * 2400)) * 2.4, w = tileRGBA[3]; // licensed day map + fine variation on land
      col[k * 4] = tileRGBA[0] * (w > 0.5 ? 1 : f); col[k * 4 + 1] = tileRGBA[1] * (w > 0.5 ? 1 : f); col[k * 4 + 2] = tileRGBA[2] * (w > 0.5 ? 1 : f); wat[k] = w; col[k * 4 + 3] = w; }
    else { planetColor(dd, rgb, true); col[k * 4] = (rgb[0] / 255) ** 2.2; col[k * 4 + 1] = (rgb[1] / 255) ** 2.2; col[k * 4 + 2] = (rgb[2] / 255) ** 2.2; col[k * 4 + 3] = 0; }
  };
  put(0, 0, 0);
  for (let i = 0; i < TNR; i++) { const th = TILE_R / R * ((i + 1) / TNR) ** 1.8; for (let j = 0; j < TNS; j++) put(1 + i * TNS + j, th, 2 * Math.PI * j / TNS); }
  tileGeo.attributes.position.needsUpdate = true; tileGeo.attributes.color.needsUpdate = true; tileGeo.attributes.wat.needsUpdate = true; tileGeo.computeVertexNormals();
}
const padCx = onSurface(buildLaunchComplex(), PAD_EF, 0) || null; // f5.1: the showroom keeps the tower behind the rocket

// ---------- rocket meshes: one THREE.Group per stage, sized from the same part geometry the physics uses ----------
const M = {
  white: new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25, ...(GX.GFX[gfxQ].normalMaps ? { normalMap: GX.panelNormal(), normalScale: new THREE.Vector2(0.6, 0.6) } : {}) }),
  black: new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.62, metalness: 0.2 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 0.28, metalness: 1.0 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.5, metalness: 0.5 }),
  plume: softPlumeMaterial({ color: 0xffb066, opacity: 0.85, k: SOFT_K.plume }), // fx-4: soft-edged shells (fun/plumemat.js)
  plumeGlow: softPlumeMaterial({ color: 0xff7a2a, opacity: 0.25, k: SOFT_K.glow }),
  plumeBell: softPlumeMaterial({ color: 0xffb27a, opacity: 0, k: SOFT_K.bell, vertexColors: true }),
  plumeVac: vacPlumeMaterial({ color: 0xc4d8ff }), // plume-soft-1: the soft vacuum shell
  plumeSprite: new THREE.SpriteMaterial({ map: GX.softGlowTexture(), color: new THREE.Color(5, 3.2, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeCore: softPlumeMaterial({ color: 0xbfe0ff, opacity: 0.9, k: SOFT_K.core }), // fx-5: soft core too (thin hard 'needles' on far boosters)
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
// f5.3 exhaust: one material set per propellant (fun/exhaust.js LOOK): kerolox orange + soot, methalox blue-violet,
// hydrolox near-clear with Mach diamonds, hypergolic pale orange, solid bright with heavy smoke
const PLUME_MATS = {};
function plumeMats(prop = 'kerolox') { if (PLUME_MATS[prop]) return PLUME_MATS[prop]; const L = styleFor(prop), c = m => { const x = m.clone(); x.userData = { ...m.userData, cached: true }; return x; };
  const o = { plume: c(M.plume), plumeGlow: c(M.plumeGlow), plumeCore: c(M.plumeCore), plumeBell: c(M.plumeBell), plumeSprite: c(M.plumeSprite), plumeVac: c(M.plumeVac), diamond: c(M.diamond), look: L, prop };
  o.plume.color.setHex(L.plume); o.plumeGlow.color.setHex(L.glow); o.plumeCore.color.setHex(L.core); o.plumeBell.color.setHex(L.bell); o.plumeSprite.color.setRGB(...L.sprite); o.plumeVac.color.setHex(L.bell); if (prop === 'hydrolox') o.diamond.color.setHex(0xe8f0ff);
  return (PLUME_MATS[prop] = o); }
let VAC_GEO = null; // one unit flaring shell shared by every plume (radius 1 at the bell exit, VAC_PLUME.flare at the far end, y 0 .. -1; uv.y 0 .. 1 downstream)
const vacGeo = () => VAC_GEO || (VAC_GEO = (() => { const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.97 + (VAC_PLUME.flare - 0.97) * Math.pow(t, 0.75), -t)); } return new THREE.LatheGeometry(pts, 40); })());
function makePlume(w, prop = 'kerolox', lite = false) { // f1 layered exhaust: outer glow, mid flame, hot core, vacuum bell, shock diamonds, nozzle glow
  const PM = plumeMats(prop), g = new THREE.Group(), cone = (rw, mat, seg = 24) => { const m = new THREE.Mesh(new THREE.ConeGeometry(rw, 1, seg, 1, true), mat); m.rotation.x = Math.PI; m.position.y = -0.5; g.add(m); return m; };
  if (lite) { const outer = cone(w, PM.plume, 12), core = cone(w * 0.5, PM.plumeCore, 8), vacm = new THREE.Mesh(vacGeo(), PM.plumeVac), noz = new THREE.Sprite(PM.plumeSprite); vacm.visible = false; vacm.renderOrder = 2; g.add(vacm); noz.position.y = -0.3; g.add(noz); g.userData = { w, outer, core, vacm, noz, lite: true, mats: PM }; g.visible = false; return g; }
  const glow = cone(w, PM.plumeGlow), outer = cone(w, PM.plume), core = cone(w * 0.5, PM.plumeCore, 16);
  // underexpanded bell: a lathe that flares from the nozzle rim into a wide, soft "jellyfish" (scaled by plumeLook().bellW)
  const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(w * (0.9 + Math.sin(t * Math.PI * 0.62) * 1.0 + t * 0.15), -t)); }
  const bg = new THREE.LatheGeometry(pts, 32), pa = bg.attributes.position, col = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) { const k = Math.pow(1 + pa.getY(i), 1.6); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; } // additive: fades to nothing at the rim
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const bell = new THREE.Mesh(bg, PM.plumeBell); g.add(bell);
  const dia = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(w * 0.32, 12, 8), PM.diamond); m.scale.y = 0.45; dia.add(m); }
  const vacm = new THREE.Mesh(vacGeo(), PM.plumeVac); vacm.visible = false; vacm.renderOrder = 2; g.add(vacm); // plume-soft-1
  const noz = new THREE.Sprite(PM.plumeSprite); noz.position.y = -0.3; g.add(noz);
  g.add(dia); g.userData = { dia, w, glow, outer, core, bell, vacm, noz, mats: PM, env: 1 };
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
let rgModel = null;
function makeRocketGroups(design) {
  const vv = buildVehicle(design), out = []; rgModel = design.model || null;
  vv.stages.forEach((s, si) => {
    if (s.radial) { const cs = vv.stages.find(x => !x.radial), coreR = cs ? Math.max(1.25, ...cs.parts.filter(p => p.kind !== 'fins' && p.kind !== 'fairing' && p.d > 0).map(p => p.d / 2)) : 1.25; out.push(makeRadialGroup(s, si, coreR)); return; } // fx-1: boosters sit on the real core radius
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
    // f5.3: one plume per engine at its nozzle (engines-1 count/layout/propellant); the centre plume carries the merged glow/bell
    const ei = stageEngines(design.model, out.filter(x => !x.userData.radial).length, s.parts), nz = ei.n > 1 ? nozzles(ei, rMax) : [];
    let plume; const pd = plumeDims({ prop: ei.prop, tKN: ei.tKN, n: Math.max(1, ei.n), vacuumOnly: ei.vacuumOnly, stageD: 2 * rMax }); // plume size from the engine (gfx/plume_style.js), not from the stage radius
    if (nz.length > 1) { const rn = nozzleR(ei.n, rMax), cen = nz.findIndex(p => Math.hypot(p[0], p[1]) < 0.05 * rMax);
      plume = makePlume(rn, ei.prop); plume.userData.env = rMax / rn; plume.userData.noCore = cen < 0; g.add(plume);
      plume.userData.extra = nz.filter((p, i) => i !== cen).map(p => { const e = makePlume(rn, ei.prop, true); e.position.set(p[0], 0, p[1]); g.add(e); return e; });
    } else { plume = makePlume(Math.max(0.15, nEng > 1 ? rMax * 0.95 : pd.rn * 1.1), ei.prop); g.add(plume); }
    plume.userData.lenM = pd.len; plume.userData.prop = ei.prop; plume.userData.nEng = Math.max(1, nz.length); plume.userData.vac = !!ei.vacuumOnly; plume.userData.ts = thrustScale(ei.tKN || 1000); // unit 3: vacuum-nozzle + thrust-scaled plume (fun/plumetable.js)
    let legs = null;
    if (si === 0) {
      legs = new THREE.Group();
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35), M.black); const a = i * Math.PI / 2 + 0.78; l.position.set(Math.cos(a) * (rMax + 2), 2.2, Math.sin(a) * (rMax + 2)); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); legs.add(l); }
      legs.visible = false; g.add(legs);
    }
    g.userData = { h: y, plume, legs, fair, fairH: fair ? 1.6 * fp.d : 0, hot, stage: si, payY: payloadY };
    g.traverse(o => { if (o.geometry) o.geometry.userData.own = true; }); // f5.2.2: created for this stack only (materials stay shared M.*)
    out.push(g);
  });
  return out;
}
// f6.2: the stage groups of a piloted craft (same contract as makeRocketGroups: h, plume, hot, stage), from its own physics vehicle
function makeCraftGroups(vv) {
  const T0 = craftTypeOf(vv.craft.type), stg = buildCraftStages(vv, buildPayload, 'hi'), out = [], prop = PLUME_OF[T0.prop] || 'hypergolic';
  vv.stages.forEach((s, si) => {
    const g = new THREE.Group(), m = stg[Math.min(si, stg.length - 1)], eng = s.parts.find(q => q.kind === 'engine'), rN = Math.max(0.08, (eng ? eng.d : T0.d * 0.3) * 0.32);
    g.add(m.group); const plume = makePlume(rN, prop); g.add(plume);
    Object.assign(plume.userData, { prop, nEng: 1, vac: true, ts: T0.prop === 'ion' ? 0.25 : T0.prop === 'coldgas' ? 0.2 : T0.prop === 'monoprop' ? 0.35 : 0.6 });
    g.userData = { h: s.parts.reduce((t, q) => t + q.h, 0), plume, legs: null, fair: null, fairH: 0, hot: [], stage: si, payY: null };
    g.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.userData.own = true; });
    out.push(g); });
  return out;
}
// Radial boosters: k copies of the booster column around the core, from the core's bottom up (no stack height)
const RADCOLS = new WeakMap(); RADCOLS.rB = new WeakMap();
function makeRadialGroup(s, si, coreR = 1.25) {
  const g = new THREE.Group(), k = s.radial, cols = []; let rB = 0.9;
  for (let j = 0; j < k; j++) {
    const a = j / k * Math.PI * 2 + (k === 2 ? 0 : Math.PI / 4), c = new THREE.Group(); let y = 0; // fx-1: a pair rides on ±x like the Heavy art
    for (const p of s.parts) {
      const r = (p.dr || 1.8) / 2; rB = Math.max(rB, r);
      if (p.kind === 'engine') bells(c, Math.max(1, Math.round((p.n || k) / k)), y, p.h, r);
      else if (p.kind === 'tank') { cyl(r, r, p.h, M.white, y, c); cyl(r + 0.02, r + 0.02, Math.min(1, p.h * 0.1), M.black, y + p.h * 0.45, c); }
      y += p.h;
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(rB, rB * 2.4, 24), M.white); nose.position.y = y + rB * 1.2; c.add(nose);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), M.black); strut.position.set(-(rB + 0.2), y * 0.8, 0); c.add(strut);
    const R0 = coreR + rB + 0.08; c.position.set(Math.cos(a) * R0, 0, Math.sin(a) * R0); c.rotation.y = -a; g.add(c); cols.push(c);
  }
  // fx-1 (QA: no flame on the Heavy side boosters): one plume per engine of each side booster (engines-1 count / k), at the column
  const ei = stageEngines(rgModel, 0, s.parts, true, k), rp = ei.prop, nz = ei.n > 1 ? nozzles(ei, rB) : [[0, 0]], rn = ei.n > 1 ? nozzleR(ei.n, rB) : Math.max(0.3, rB * 0.9), pdR = plumeDims({ prop: rp, tKN: ei.tKN, n: Math.max(1, ei.n), vacuumOnly: ei.vacuumOnly, stageD: 2 * rB });
  let plume = null; const extra = [], colP = [];
  cols.forEach((c, ci) => { const list = []; nz.forEach((q, qi) => { const full = !plume, pl = makePlume(rn, rp, !full); pl.position.set(c.position.x + q[0], 0, c.position.z + q[1]); g.add(pl); if (full) { plume = pl; plume.userData.env = ei.n > 1 ? rB / rn : 1; } else extra.push(pl); list.push({ pl, q }); }); colP.push(list); });
  plume.userData.lenM = pdR.len; plume.userData.prop = rp; plume.userData.extra = extra; plume.userData.nEng = nz.length * k;
  g.userData = { h: 0, plume, legs: null, fair: null, fairH: 0, hot: [], stage: si, radial: k }; RADCOLS.set(g, colP); RADCOLS.rB.set(g, rB); // WeakMap: clone() JSON-copies userData
  return g;
}
// fx-1: once the art model is in, put the side-booster plumes under the art's side boosters (stages side0, side1, ...)
function alignRadialPlumes() {
  const rg = SG.find(g => g.userData.radial); if (!rg || !hero) return; const st = (hero.userData.hi || hero).userData.stages || {}, sides = Object.keys(st).filter(x => /^side\d/.test(x)).sort();
  const colP = RADCOLS.get(rg); if (!colP || sides.length !== colP.length) return;
  const p0 = rocketG.position.clone(), q0 = rocketG.quaternion.clone(); rocketG.position.set(0, 0, 0); rocketG.quaternion.identity(); rocketG.updateMatrixWorld(true);
  const inv = rg.matrixWorld.clone().invert();
  sides.forEach((k, ci) => { const b = new THREE.Box3().setFromObject(st[k]); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    const sz = b.getSize(new THREE.Vector3()), kq = Math.max(1, Math.min(2.2, Math.min(sz.x, sz.z) / 2 / (RADCOLS.rB.get(rg) || 0.9)));
    for (const { pl, q } of colP[ci]) pl.position.set(c.x + q[0] * kq, 0, c.z + q[1] * kq); });
  rocketG.position.copy(p0); rocketG.quaternion.copy(q0); rocketG.updateMatrixWorld(true);
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
const funAudio = createAudio(() => ac ? { ac, master, fbus, sbus } : null), funMusic = createMusic(() => ac ? { ac, mbus } : null); // f6.3: music has its own bus (volume + toggle in Settings), flight sounds go fbus -> dbus (camera distance / thin air) -> sbus (effects volume) -> master
let ac, rumble, rumbleF, rumbleSrc, crack, crackSrc, master, fbus, sbus, dbus, mbus; // f5.8y: every flight sound (rumble, wind, explosions) runs through fbus, so leaving the flight screen can fade them all at once
function noiseBuf(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; }
function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; } ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); funAudio.apply(); // f3: since f1 the master gain was wired to itself, so nothing reached the speakers
  sbus = ac.createGain(); sbus.connect(master); dbus = ac.createGain(); dbus.connect(sbus); fbus = ac.createGain(); fbus.connect(dbus); mbus = ac.createGain(); mbus.gain.value = 0; mbus.connect(master); applyAudioSettings();
  startFlightAudio();
}
// f5.8y (owner: "whatever sound was playing when a rocket ends its flight keeps playing into the menu"): the engine rumble and the wind roar are LOOPS; they were only retargeted by the flight tick, so when the
// flight screen went away (Home, Build, pause, end card) their last gain stayed. Now: stopFlightLoops fades and stops both loop sources; silenceFlight also fades the bus so an explosion tail never reaches a menu.
function startFlightAudio() {
  if (!ac || !fbus) return; const t = ac.currentTime; fbus.gain.cancelScheduledValues(t); fbus.gain.setValueAtTime(fbus.gain.value, t); fbus.gain.linearRampToValueAtTime(1, t + 0.05); funAudio.startLoops();
  if (rumbleSrc) return; const src = ac.createBufferSource(); src.buffer = noiseBuf(3); src.loop = true; rumbleSrc = src;
  rumbleF = ac.createBiquadFilter(); rumbleF.type = 'lowpass'; rumbleF.frequency.value = 300;
  rumble = ac.createGain(); rumble.gain.value = 0; src.connect(rumbleF).connect(rumble).connect(fbus); src.start();
  const cs = ac.createBufferSource(), cf = ac.createBiquadFilter(); cs.buffer = crackleBuf(2.5); cs.loop = true; cf.type = 'highpass'; cf.frequency.value = 900; crack = ac.createGain(); crack.gain.value = 0; cs.connect(cf).connect(crack).connect(fbus); cs.start(); crackSrc = cs; // f6.3: crackle texture on top of the rumble
}
// f6.3: rocket crackle: a looped buffer of sharp random pops (a few clustered into bursts) with a quick decay; the engine tick scales it with thrust
function crackleBuf(sec) { const sr = ac.sampleRate, b = ac.createBuffer(1, Math.floor(sr * sec), sr), d = b.getChannelData(0), n = Math.floor(sec * 170); for (let k = 0; k < n; k++) { const at = (Math.random() * (d.length - 700)) | 0, a = Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? -1 : 1), len = 40 + Math.random() * 260, rep = Math.random() < 0.25 ? 3 : 1; for (let r = 0; r < rep; r++) for (let j = 0; j < len && at + j + r * 90 < d.length; j++) d[at + j + r * 90] += a * Math.exp(-j / (len * 0.25)) * (j % 3 ? 0.7 : 1); } let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); for (let i = 0; i < d.length; i++) d[i] /= pk || 1; return b; }
function stopFlightLoops(fade = 0.3) {
  funAudio.stopLoops(fade); if (ac && crackSrc) { const cs = crackSrc, cg = crack, t = ac.currentTime; crackSrc = null; crack = null; try { cg.gain.cancelScheduledValues(t); cg.gain.setValueAtTime(cg.gain.value, t); cg.gain.linearRampToValueAtTime(0, t + fade); cs.stop(t + fade + 0.05); cs.onended = () => { try { cs.disconnect(); cg.disconnect(); } catch (e) { } }; } catch (e) { try { cs.stop(); } catch (e2) { } } }
  if (!ac || !rumbleSrc) return; const s = rumbleSrc, g = rumble, t = ac.currentTime; rumbleSrc = null; rumble = null; rumbleF = null;
  try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fade); s.stop(t + fade + 0.05); s.onended = () => { try { s.disconnect(); g.disconnect(); } catch (e) { } }; } catch (e) { try { s.stop(); } catch (e2) { } }
}
function silenceFlight(fade = 0.3) { stopFlightLoops(fade); if (!ac || !fbus) return; const t = ac.currentTime; fbus.gain.cancelScheduledValues(t); fbus.gain.setValueAtTime(fbus.gain.value, t); fbus.gain.linearRampToValueAtTime(0, t + fade); }
// f3: unlock on the first gesture anywhere (iOS needs resume() inside the touch handler) and resume after the tab comes back
for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, () => { if (!ac || ac.state !== 'running') initAudio(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (!ac) return; if (document.hidden) { if (ac.state === 'running') ac.suspend().catch(() => {}); } else if (ac.state !== 'running') ac.resume().catch(() => {}); }); // f6.3: nothing plays (menu beat included) while the tab is in the background
// f6.3: music follows the screen: menu beat on Home / picker / pause / end card, space score above the atmosphere, silence in the lower air (the engine is the music there)
const audioMix = { dist: 0, distK: 1, vacK: 1 }; let spaceMusic = false;
function musicMode() {
  if (state !== 'flight' || paused) return ['menu', 1]; const end = $('end'); if (end && !end.classList.contains('hidden')) return ['menu', 1];
  if (!F || !F.flags || F.flags.dead || F.flags.landed || F.flags.recovered) return [null, 0];
  const b = P.BODIES[F.body] || {}, alt = F.body === 'earth' || b.atm ? F.alt : 1e9, lvl = Math.max(0, Math.min(1, (alt - 52000) / 20000)); // fades in from ~52 km to full at ~72 km
  spaceMusic = alt > (spaceMusic ? 52000 : 56000); return spaceMusic ? ['space', Math.max(0.15, lvl)] : [null, 0];
}
function musicTick() { if (!ac) return; const [k, lv] = musicMode(); funMusic.set(k, lv); }
function applyAudioSettings() { if (!ac) return; if (sbus) sbus.gain.value = Math.max(0, Math.min(1, SET.sfxVol == null ? 1 : SET.sfxVol)); funMusic.configure({ enabled: SET.musicOn !== false, volume: SET.musicVol == null ? 0.5 : SET.musicVol }); }
function burst(vol, dur, freq) {
  if (!ac) return; const s = ac.createBufferSource(); s.buffer = noiseBuf(dur); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f).connect(g).connect(fbus || master); s.start();
}
function beep(f = 880) { if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25); o.connect(g).connect(sbus || master); o.start(); o.stop(ac.currentTime + 0.3); }
// ---------- hangar: part-based builder ----------
let design = cloneDesign(TEMPLATES[0]);
// f4: camera distance that fits a stack of length L into `frac` of the screen height (fov-aware, slim rockets fill the frame)
function fitDist(L, frac) { const vf = (camera.fov || 50) * Math.PI / 180; return Math.max(18, L / frac / (2 * Math.tan(vf / 2))); }
function setDesign(d) { design = d; refreshBuild(); } // f5.9-0: the hangar / Build screen is gone; a rocket pick just loads its design for the pad
function refreshBuild() { if (state === 'build') showPreview(); } // f5.9-0: was the builder refresh (stage list, Δv table, verdict worker, saved designs); only the pad preview is left
const qol = createQoL({ settings: () => SET, onSettings: s => { SET = s; translate = makeTranslator(SET); applyAudioSettings(); if (typeof smap !== 'undefined' && smap.conic !== SET.conic) smap.setConic(SET.conic); if (state === 'build') refreshBuild(); },
  resume: () => setPause(false), quicksave: () => quicksave(), quickload: () => quickload(), revertLaunch: () => revertLaunch(), hangar: () => { setPause(false); goBuild(); }, quickInfo,
  dvTable: () => dvTableHTML(state === 'flight' ? craftDv() : designStats(design).total, state !== 'flight') });
// ---------- game state ----------
let state = 'build', F, v, booster, booster2 = null, shipVis2 = null, rocketG, SG = [], camMode, gen = 0;
let viewId = null, vesselUI = null; const fleetVis = new Map(); // f6.2: the craft being looked at (VIEW), the craft list, the art of every craft you are not flying
const debris = [];
// fx-1 (QA D2): the fairing splits into two visible half shells that hinge open and fall away (fun/fairing.js)
const fairHalves = [];
function fairShells() { const heroShells = []; if (hero) for (const lv of hero.levels || [{ object: hero }]) { const st = (lv.object.userData && lv.object.userData.stages) || {};
    for (const k of ['payload', 'fairing']) if (st[k] && st[k].visible) heroShells.push(st[k]); }
  const f = SG.length && SG[SG.length - 1].userData.fair; // the physics shell only counts without a hero model (a ship has no shell: no ghost halves)
  return sepShells({ hero: !!hero, heroShells, physShell: f && f.visible && f.parent && f.parent.visible ? f : null }); }
function spawnFairHalves() {
  if (!rocketG || state !== 'flight') return; const cand = fairShells(); heroFairing(false); heroFairing2(false); const shells = cand.filter(o => !o.visible || (!hero && o === (SG.length && SG[SG.length - 1].userData.fair))); if (!shells.length) return; // only the shells the jettison really hides
  const p0 = rocketG.position.clone(), q0 = rocketG.quaternion.clone(); rocketG.position.set(0, 0, 0); rocketG.quaternion.identity(); rocketG.updateMatrixWorld(true);
  const box = new THREE.Box3(); for (const o of shells) { const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty() && (box.isEmpty() || b.getSize(new THREE.Vector3()).y > 0.5)) box.union(b); }
  rocketG.position.copy(p0); rocketG.quaternion.copy(q0); rocketG.updateMatrixWorld(true); if (box.isEmpty()) return;
  const sz = box.getSize(new THREE.Vector3()), r = Math.max(0.4, Math.max(sz.x, sz.z) / 2), cone = Math.min(sz.y * 0.4, r * 2.6), body = Math.max(0.5, sz.y - cone);
  const mat = M.white.clone(); mat.side = THREE.DoubleSide; mat.userData = { ...mat.userData };
  const nose = P.noseOf(v), at = V.addS(V.sub(v.r, V.scale(nose, v.tel.ycom)), nose, box.min.y);
  for (const h of buildHalves(THREE, { r, body, cone }, mat)) { h.quaternion.copy(q0); scene.add(h); fairHalves.push({ g: h, r: at.slice(), v: v.v.slice(), q0: q0.clone(), t: 0, mat }); }
}
const _fhq = new THREE.Quaternion(), _fhx = new THREE.Vector3(1, 0, 0), _fhz = new THREE.Vector3();
function fairTick(dt, O) {
  bayTick(dt);
  for (let k = fairHalves.length - 1; k >= 0; k--) { const f = fairHalves[k]; f.t += dt; const ps = halfPose(f.t, f.g.userData.side);
    if (ps.gone || state !== 'flight') { scene.remove(f.g); f.g.traverse(o => o.geometry && o.geometry.dispose()); f.mat.dispose(); fairHalves.splice(k, 1); continue; }
    const gr = V.scale(V.norm(f.r), -((P.BODIES[F.body] && P.BODIES[F.body].mu) || P.MU_E) / Math.max(1, V.dot(f.r, f.r))); f.v = V.addS(f.v, gr, dt); f.r = V.addS(f.r, f.v, dt); // ballistic shells (no thrust): the rocket pulls away
    _fhz.set(0, 0, 1).applyQuaternion(f.q0); const lat = [_fhz.x * ps.lat, _fhz.y * ps.lat, _fhz.z * ps.lat];
    setRel(f.g, V.add(f.r, lat), O); _fhq.setFromAxisAngle(_fhx, ps.ang); f.g.quaternion.copy(f.q0).multiply(_fhq); }
}
const keys = {};
function later(fn, ms) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }
let shipVis = null;
const ER_KEY = 'orbitrush.earthRot';
let earthRot = localStorage.getItem(ER_KEY) !== '0';
const INC_KEY = 'orbitrush.incl', EPOCH = params.get('epoch') && isFinite(Date.parse(params.get('epoch'))) ? Date.parse(params.get('epoch')) : Date.now();
let launchIncl = Math.max(0, Math.min(180, +(params.get('incl') ?? localStorage.getItem(INC_KEY) ?? 0) || 0));
// f5.4: airless or thin-air worlds (Moon, Mars < 10 kPa): no exhaust smoke, condensation or pad steam
function thinAir() { if (!F || F.body === 'earth') return false; const b = P.BODIES[F.body]; if (!b.atm) return true; try { const a = P.atmAt(F.v, 0); return !(a && a.p > 10000); } catch (e) { return true; } }
function siteVel(b) { const w = b.earthRot === false ? 0 : F && F.body && F.body !== 'earth' ? P.BODIES[F.body].omega : P.OMEGA_E; /* f5.4: the air/ground turns with the current world */ return [-w * b.r[1], w * b.r[0], 0]; }
const hooks = {
  toast: (m, c) => toast(m, c),
  sound: (k, f) => { if (k === 'ignite') { burst(0.6, 1.2, 500); if (F.alt < 200) ignitionClouds(v); } else if (k === 'beep') beep(f); else if (k === 'orbit') { beep(1320); setTimeout(() => beep(1760), 200); } else if (k === 'landed') { beep(1500); setTimeout(() => beep(1900), 180); if (F.alt < 3000) touchdownDust(v); } },
  stage: (b, parts) => { const g = detachStage(b.stageIndex ?? 0); booster = b; booster2 = null;
    if (parts && parts[1]) { const [mA, mB] = splitSideMesh(g); parts[0].mesh = mA; parts[1].mesh = mB; booster2 = parts[1]; } else b.mesh = g; // f4.2: one mesh per side booster
    stagingDrama(v.r, v.v, P.noseOf(v)); },
  drop: d => { if (opHooks) try { opHooks.drop(d); } catch (e) {} d.mesh = detachStage(d.stageIndex); d.t = 0; d.spin = [rnd(0.6), rnd(0.6)]; debris.push(d); stagingDrama(v.r, v.v, P.noseOf(v)); },
  ship: s => { if (s.lz) { if (s.name === 'LZ-2') shipVis2 = makeLZ(s); else shipVis = makeLZ(s); return; } shipVis = makeShip(s); }, // RTLS: the landing zone is the pad area, no droneship
  shipMoved: s => shipVis && onSurface(shipVis, s.ef, 0),
  jettison: () => { try { spawnFairHalves(); } catch (e) { console.warn('[Orbit Rush] fairing halves', e); } heroFairing(false); heroFairing2(false); const f = SG[SG.length - 1].userData.fair; if (f) f.visible = false; /* fx-1: no white puffs in vacuum at fairing sep (the halves show it) */ beep(990); },
  // keys held for the booster must not leak into the upper stage (and vice versa) when control switches
  boosterControl: manual => { for (const k in keys) keys[k] = false; if (split.on && !split.full) { /* f5.6g: in split each pane keeps its own view */ } else if (manual) { camMode = 'booster'; camDist = 160; camUserT = -1e9; } else camMode = 'chase'; $('tProg').classList.toggle('on', F.autoOn); },
  boosterLost: (b, moving) => { explode(b.r, moving ? b.v : siteVel(b), false); b.mesh.visible = false; b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  boosterLanded: b => { b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  fail: () => { explode(v.r, v.v, true, true); rocketG.visible = false; slowMo = 2.5; },
  release: rec => onRelease(rec), // f5.2.3 payload lifecycle
  vesselSwitched: () => onVesselSwitched(), vesselParked: o => onVesselParked(o), // f6.2: the craft you fly changed
  vesselLost: o => { explode(v.r, v.v, false, true); onVesselRemoved(o); }, vesselGone: o => onVesselRemoved(o), vesselDeployed: () => { smapSats.c = null; vesselUI && vesselUI.draw(); },
  payloadAt: () => heroPayloadAt(), // rockets-pass-1: the model's own payload is the one that leaves, from where it sits
  deorbited: () => { explode(v.r, v.v, false, true); rocketG.visible = false; },
  soi: (from, to) => { if (!PROG.visited.includes(to)) { PROG.visited.push(to); PR.save(localStorage, PROG); fun.reveal(to); } else fun.call('🪐', 'Entering ' + P.BODIES[to].name + ' space', '#9cc3ff'); },
  chute: st => { if (st === 'failed') for (let k = 0; k < 30; k++) smoke.spawn(V.sub(v.r, V.scale(P.noseOf(v), -stackL() * 0.5)), jit(v.v, 12), 2, 1, 4, 0xff7a3c, null, 0.6); },
  recovered: () => { const up = V.norm(v.r); for (let k = 0; k < 60; k++) smoke.spawn(v.r, V.add(siteVel(v), V.add(V.scale(up, 4 + Math.random() * 10), [rnd(10), rnd(10), rnd(10)])), 2 + Math.random() * 2, 2, 9, 0xeaf4ff, null, 0.9); },
  end: (ms, cond) => later(() => { if (!F.flags.dead && !F.flags.deorbited) { updateEndFlightBtn(); return; } /* f5.6 (owner): reaching orbit / landing / any goal never ends the flight or pops a card; only destruction does (or the player picks Home) */ if (opSess && !F.flags.dead) return; if (!F.flags.dead && !F.released && F.payloadPart() && F.alt > 100000 && F.body === 'earth') { updateEndFlightBtn(); return; } /* f5.4 (QA D4): a payload in orbit waits for 🛰 RELEASE, then ■ End flight shows the card */ if (cond()) { // QA f5a.2: an ops contract owns its ending (no card at orbit mid-contract)
    if (academy && academy.active) academy.onEnd(); else showEnd(); } }, ms),
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
    const pl = k.userData.plume; if (pl) { // fx-6: keep every engine flame under THIS column (was: one lone nozzle flame, a thin needle at boostback)
      const all = [pl, ...(pl.userData.extra || [])], mine = all.filter(e => { const q = ax ? e.position.z : e.position.x; return Math.abs(q) >= mx * 0.3 && Math.sign(q) === sgn; });
      for (const e of all) if (!mine.includes(e)) { e.visible = false; e.userData = { ...e.userData, dead: true }; }
      for (const e of mine) { if (ax) e.position.z += off; else e.position.x += off; }
      if (!mine.includes(pl) && mine.length) { const e0 = mine.shift(); pl.position.copy(e0.position); e0.visible = false; e0.userData = { ...e0.userData, dead: true }; pl.visible = true; pl.userData = { ...pl.userData, dead: false }; } // the full plume (glow, bell, diamonds) moves to this column's first nozzle
      pl.userData = { ...pl.userData, extra: mine.filter(e => e !== pl), nEng: mine.length + (mine.includes(pl) ? 0 : 1) }; }
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
function freeGroup(g) { // f5.2.2: frees only what this part stack created (userData.own) and nothing still drawn elsewhere; the hero subtree is skipped (released by attachHero)
  const live = new Set(); scene.traverse(o => { if (o.geometry) live.add(o.geometry); for (const m of [].concat(o.material || [])) live.add(m); });
  const walk = o => { if (o === hero || o.userData.hero) return; const geo = o.geometry; if (geo && geo.userData.own && !live.has(geo)) { geo.userData.own = false; geo.dispose(); }
    for (const mt of [].concat(o.material || [])) if (mt.userData && mt.userData.own && !live.has(mt)) { mt.userData.own = false; if (mt.map && mt.map.userData.own) mt.map.dispose(); mt.dispose(); }
    for (const c of o.children) walk(c); }; walk(g); }
function showPreview() {
  if (rocketG) { scene.remove(rocketG); freeGroup(rocketG); } // f5.2.1: the old part-stack meshes were never freed (GPU buffers grew ~30 geometries per rocket swap)
  rocketG = new THREE.Group(); SG = design.parts.length ? makeRocketGroups(design) : []; for (const g of SG) g.traverse(o => { if (o.geometry) o.geometry.userData.own = true; }); // f5.2.2: the part stack (incl. radial copies, chutes) owns these
  let y = 0; for (const g of SG) { g.position.y = y; y += g.userData.h; rocketG.add(g); } scene.add(rocketG);
  F = new Flight(validate(design).ok ? design : TEMPLATES[0], hooks, { padZ: PAD_Z, earthRot, incl: launchIncl, epoch: EPOCH, ...(opFlightOpts || {}), ...(!opFlightOpts && sbSite && !(typeof academy !== 'undefined' && academy.active) ? siteOpts(sbSite, GX.latLonToGame) : {}) }); v = F.v;
  try { F.alt0 = Math.max(0, P.altOf(F.v)); } catch (e) { F.alt0 = 0; } // f5.8f (QA P1): the HUD reads altitude above the launch base (≈0 on the pad), not the stack's centre above sea level
  F.craftHint = craftHintNow(); try { F.seedFleet(WORLD.sats(WORLD.load(localStorage)), w => w.craft || kindTypeOf(w)); } catch (e) { console.warn('[Orbit Rush] fleet', e); }
  syncSiteArt(); // f5.4: the picked site's space center
  rocketG.add(comMark, copMark, cotMark);
  fx.attach(rocketG); chuteVis = makeChutes(); rocketG.add(chuteVis);
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
  applyPaint(design); if (SG[0]) addDecal(SG[0], design);
  attachHero();
}
// f4 model swap: the hero model stands in for the part meshes (same stack height); part groups keep plumes/staging logic
// showroom framing input: the REAL model's bounds in the rocket frame (hero model if one stands in, else the visible stage parts);
// pad hardware parented to the rocket and hidden part meshes (invisible ancestors) are left out
function rocketBounds() {
  const roots = hero ? [hero] : SG, box = new THREE.Box3(), tb = new THREE.Box3(); rocketG.updateMatrixWorld(true);
  const shown = o => { for (let p = o; p && p !== rocketG; p = p.parent) if (!p.visible) return false; return true; };
  for (const r of roots) r.traverse(o => { if (!o.isMesh || !shown(o) || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); box.union(tb); });
  return box.isEmpty() ? null : box;
}
function showFree(land) { // the UI-covered fractions of the screen: the home card + nav (portrait: below; landscape: right column)
  const c = document.getElementById('hCard'), n = document.getElementById('hNav'); let top = innerHeight, left = innerWidth;
  for (const e of [c, n, document.getElementById('hGal')]) if (e && e.offsetParent !== null) { const r = e.getBoundingClientRect(); if (r.height > 0) { top = Math.min(top, r.top); left = Math.min(left, r.left); } }
  return land ? { right: Math.min(0.5, Math.max(0, 1 - left / innerWidth)) } : { bottom: Math.min(0.45, Math.max(0, 1 - top / innerHeight)) };
}
const ART_ALIAS = { 'titan-ss-v3': 'colossus-v3', 'titan-ss-v4': 'colossus-v4' }; // art model ids renamed by the public-name audit (catalog ids unchanged)
let hero = null;
const HERO_READY = new Map(), HERO_WARM = new Set();
function prewarmHeavy() { // rockets-3: build the heavy hero LODs in idle slices while the player sits in the home/hangar
  const ids = ['heron-heavy', 'colossus-v3', 'colossus-v4'].filter(id => !HERO_READY.has(id + (TOUCH ? ':p' : '')));
  const W = heroPrewarm(ids, { phone: TOUCH });
  for (const id of ids) { const k = id + (TOUCH ? ':p' : ''), p = W.get(k); if (!p || HERO_WARM.has(k)) continue; HERO_WARM.add(k); p.then(l => { if (HERO_WARM.has(k)) { HERO_READY.set(k, l); HERO_WARM.delete(k); W.delete(k); } }).catch(() => HERO_WARM.delete(k)); } }
function attachHero() { showFrame = null; // re-frame from the new model at once
  if (hero) { const old = hero; hero = null; heroRelease(old, renderer, scene, camera).catch(() => heroDispose(old)); } // rockets-3: leak-safe swap
  if (!design.model || !SG.length) return;
  if (ART_ALIAS[design.model]) design.model = ART_ALIAS[design.model]; // saved designs from before the art public-name audit
  const wk = design.model + (TOUCH ? ':p' : ''); // rockets-3: heavy models are prewarmed at the hangar; take a finished one if ready
  try { hero = HERO_READY.get(wk) || heroLOD(design.model, { phone: TOUCH }); HERO_READY.delete(wk); if (HERO_WARM.has(wk)) { takeWarm(design.model, { phone: TOUCH }); HERO_WARM.delete(wk); } } catch (e) { console.warn('[Orbit Rush] hero model', e); hero = null; return; }
  let L = 0; try { L = P.stackGeom(v).L; } catch (e) {} if (!(L > 0)) for (const g of SG) L += g.userData.h; const hH = new THREE.Box3().setFromObject(hero.userData.hi || hero).getSize(new THREE.Vector3()).y || L;
  const dm = dimsOf(design.model), sy = L / hH; // sizes-1: the physics stack is already the real height (parts.js fitDims); xz fixes the model's body width
  hero.scale.set(sy * (dm ? dm.xz : 1), sy, sy * (dm ? dm.xz : 1)); rocketG.add(hero); heroKind = null; bayK = 0; bayTarget = 0; heroSyncPayload(); heroBayApply(); // rockets-pass-1: payload under the shell from t=0
  for (const g of SG) g.traverse(o => { if (o.isMesh && !isPlumeChild(o, g)) o.visible = false; });
  try { alignRadialPlumes(); } catch (e) { console.warn('[Orbit Rush] radial plumes', e); }
  try { alignCorePlumes(); } catch (e) { console.warn('[Orbit Rush] core plumes', e); }
}
// rockets-pass-1 unit 3: once the art model is in, each core stage's plumes follow ITS bells (count, position, size), not a formula
// (gfx/vehicles/nozzles.js is generated from the models; tools/gen_nozzles.cjs). Stages the model has no bells for keep the data layout.
function alignCorePlumes() {
  const NZ = hero && NOZZLES[design.model]; if (!NZ) return; const st = (hero.userData.hi || hero).userData.stages || {}, mg = modelGroups(Object.keys(st)), keys = [...mg.core.flat(), ...mg.top], k = hero.scale.x; let ci = 0;
  for (const g of SG) { if (g.userData.radial) continue; const ci0 = Math.min(ci++, keys.length - 1), key = keys[ci0], L = plumeLayout((NZ[key] && NZ[key].length ? NZ[key] : NZ.orbiter) || [], k), old = g.userData.plume; // a core with no bells of its own (the truck's tank): the engines ride on the orbiter
    if (!L || !old) continue;
    const inf = vehicleOf(design.model) ? coreInfo(design.model, ci0, keys.length) : null, prop = inf ? inf.prop : old.userData.prop, vac = inf ? inf.vacuumOnly : old.userData.vac, ts = inf ? thrustScale(inf.tKN || 1000) : old.userData.ts, vis = old.visible; // roster data when the model has it, else keep the part-based guess
    for (const e of [...(old.userData.extra || []), old]) g.remove(e); // (geometries are shared between plumes: not disposed)
    const pd = plumeDims({ prop, tKN: inf && inf.tKN > 0 ? inf.tKN * Math.max(1, inf.n) / Math.max(1, L.n) : 0, n: L.n, exitR: L.rn, vacuumOnly: vac || L.vac, stageD: 2 * L.ext }); // per-bell thrust when the roster lists fewer engines than the model has bells
    const ey = (NZ[key] && NZ[key].length ? L.y * hero.scale.y - g.position.y : 0); // plume-soft-1: the plume starts at the bell exit (stage-local height), not at the stage's base
    let plume; if (L.n > 1) { plume = makePlume(L.rn, prop); plume.userData.env = Math.max(1, L.ext / L.rn); plume.userData.noCore = L.cen < 0; plume.position.y = ey; g.add(plume);
      plume.userData.extra = L.pts.filter((p, i) => i !== L.cen).map(p => { const e = makePlume(L.rn, prop, true); e.position.set(p[0], ey, p[1]); g.add(e); return e; }); }
    else { plume = makePlume(Math.max(0.15, L.rn * 1.1), prop); plume.position.y = ey; g.add(plume); }
    Object.assign(plume.userData, { prop, vac: vac || L.vac, ts, nEng: L.n, lenM: pd.len }); plume.visible = vis; g.userData.plume = plume; }
}
function parallelCore() { const vv = vehicleOf(design.model); return !!(vv && vv.stages && vv.stages.some(x => x.parallel)); }
function isPlumeChild(o, g) { const pl = g.userData.plume, ex = (pl && pl.userData.extra) || []; for (let p = o; p && p !== g; p = p.parent) if (p === pl || ex.includes(p)) return true; return false; }
function heroPiece(i) { // a copy of the dropped hero stage rides on the detached part group (debris / booster cam)
  if (!hero || !hero.userData.hi) return null; const st = hero.userData.hi.userData.stages || {};
  const keys = heroPlan(st)[i] || []; const grp = new THREE.Group(); // f5.1h: generic stage map (fun/stagemap.js)
  let y0 = 0; for (let j = 0; j < i; j++) y0 += SG[j].userData.h;
  for (const k of keys) if (st[k]) { const c = st[k].clone(); grp.add(c); }
  if (!grp.children.length) return null; grp.scale.copy(hero.scale); grp.position.y = -y0; return grp;
}
function heroFairing(on) { if (!hero) return; heroBay(!on); heroSyncPayload(); for (const lv of hero.levels || [{ object: hero }]) { const ud = lv.object.userData || {}, st = ud.stages || {}; if (st.payload && !ud.fixedNose) st.payload.visible = on; } }
// rockets-pass-1: the payload is a real mesh on the model from t=0 (under the shell, or in a ship's bay) and the one RELEASE sends away
const heroLevels = () => hero ? (hero.levels || [{ object: hero }]).map(l => l.object) : [];
let heroKind = null, bayK = 0, bayTarget = 0; // heroKind: the payload look built into the hero; bayK: ship bay opening 0..1
const craftInfo = () => ({ missionId: opSess && opSess.m && opSess.m.id, partIds: (design.parts || []).map(p => p.id), hasSpec: !!design.spec, model: design.model || design.name, constellation: isConstellation() });
// f6.2: the launcher decides the craft it deploys (data/craft_types.js); the model under the fairing is that craft's model
function payloadKind() { try { const info = craftInfo(), k = payloadKindFor(info); return k ? kindOfType(craftTypeFor({ ...info, kind: k })) : k; } catch (e) { return 'comsat'; } }
function craftHintNow() { try { const info = craftInfo(); return { ...info, kind: payloadKindFor(info), house: design.model || design.name }; } catch (e) { return {}; } }
function heroSyncPayload() { // the mission (and so the payload look) may only be known after the hero was built: rebuild it while the shell still hides it
  if (F && F.fleet) F.craftHint = craftHintNow();
  if (!hero) return; const k = payloadKind(); if (k === heroKind) return; heroKind = k;
  for (const o of heroLevels()) { try { heroSetPayload(o, o.userData.id || design.model, k, o.userData.detail || 'hi'); } catch (e) { console.warn('[Orbit Rush] hero payload', e); } } }
function heroBay(open) { bayTarget = open ? 1 : 0; if (!open) bayK = 0; heroBayApply(); }
function heroBayApply() { for (const o of heroLevels()) if (o.userData.bayExpose) o.userData.bayExpose(bayK); }
function bayTick(dt) { if (bayK === bayTarget) return; bayK += Math.sign(bayTarget - bayK) * Math.min(Math.abs(bayTarget - bayK), dt / 2.5); heroBayApply(); }
function heroTakePayload() { // detach the model's own payload mesh: the SAME object flies on as the released payload (no new mesh appears)
  if (!hero) return null; let src = null; rocketG.updateMatrixWorld(true);
  for (const o of heroLevels()) { const s = (o.userData.stages || {}).sat; if (!s) continue; if (!src) src = s; else s.visible = false; } // lower LODs just hide theirs
  if (!src || !src.parent) return null;
  const ws = src.getWorldScale(new THREE.Vector3()), wq = src.getWorldQuaternion(new THREE.Quaternion()), outer = new THREE.Group(); outer.name = 'released-payload';
  src.parent.remove(src); src.visible = true; src.position.set(0, -(src.userData.cy || 0) * ws.y, 0); src.quaternion.identity(); src.scale.copy(ws); outer.add(src); outer.quaternion.copy(wq); return { outer, src, q0: wq }; }
function heroPayloadAt() { // where the model's payload sits: metres along the nose axis from the stack's centre of mass, and its sideways offset in the inertial frame
  if (!hero) return null; const o = heroLevels()[0], s = o && (o.userData.stages || {}).sat; if (!s || !s.parent || !v.tel || !isFinite(v.tel.ycom)) return null;
  const cy = (s.userData.cy || 0) * s.scale.y, y = hero.position.y + hero.scale.y * (s.position.y + cy), lat = new THREE.Vector3(hero.scale.x * s.position.x, 0, hero.scale.z * s.position.z).applyQuaternion(rocketG.quaternion);
  return { along: y - v.tel.ycom, lat: [lat.x, lat.y, lat.z] }; } // the hero 'payload' group is the fairing shell
// f5.1h staging audit: which model groups leave with each physics stage (was hard-coded booster/upper)
function heroPlan(st) { return dropPlan(Object.keys(st), v.stages).plan; }
function heroFairing2(on) { if (!hero) return; for (const lv of hero.levels || [{ object: hero }]) { const st = (lv.object.userData && lv.object.userData.stages) || {}; if (st.fairing) st.fairing.visible = on; } } // f5.1h: Originals art names its shell 'fairing'
function heroStage(cur) { // hide the stages already dropped, on every LOD level (rockets-2 @15b1836)
  if (!hero) return; { let y0 = 0; for (let j = 0; j < cur && j < SG.length; j++) if (!SG[j].userData.radial) y0 += SG[j].userData.h; hero.position.y = -y0; } // f4: the stack drops with the stages, like the part groups
  for (const lv of hero.levels || [{ object: hero }]) { const st = (lv.object.userData && lv.object.userData.stages) || {}; const gone = heroPlan(st);
    for (let j = 0; j < gone.length; j++) for (const k of gone[j]) if (st[k]) st[k].visible = j >= cur; }
}
// f1 paint shop + decals: the shared hull/accent materials take the design's paint; a canvas decal (symbol + name)
// is wrapped on the first stage
function applyPaint(d) { const pt = PR.PAINTS[d.paint] || PR.PAINTS.classic; M.white.color.setHex(pt.body); M.black.color.setHex(pt.accent); }
function addDecal(g, d) {
  const sym = PR.DECALS[d.decal] || '', name = (d.name || '').slice(0, 18); if (!sym && !name) return;
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); const pt = PR.PAINTS[d.paint] || PR.PAINTS.classic;
  x.fillStyle = '#' + pt.accent.toString(16).padStart(6, '0'); x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${sym} ${name.toUpperCase()}`.trim(), 256, 66);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.userData.own = true;
  // f4.1b: wrap the decal on the hull at its own height (the whole group's box includes fins/legs → a floating ring)
  const h = g.userData.h, yd = h * 0.62; g.updateMatrixWorld(true); const gi = new THREE.Matrix4().copy(g.matrixWorld).invert(); let r = 1e9;
  g.traverse(o => { if (!o.isMesh || isPlumeChild(o, g)) return; const b = new THREE.Box3().setFromObject(o).applyMatrix4(gi); if (b.min.y <= yd && b.max.y >= yd) { const hw = Math.min(b.max.x - b.min.x, b.max.z - b.min.z) / 2; if (hw > 0.3) r = Math.min(r, hw); } });
  if (!(r < 1e8)) { const bb = new THREE.Box3().setFromObject(g); r = Math.max(0.6, (bb.max.x - bb.min.x) / 2 - 0.1); }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, Math.min(6, h * 0.3), 32, 1, true, -Math.PI * 0.5, Math.PI), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false })); m.material.userData.own = true; m.geometry.userData.own = true; // f5.2.1: freed with its group
  m.rotation.y = Math.PI / 2; m.position.y = yd; m.renderOrder = 3; g.add(m);
}
// Re-stack the visible stage groups from v.cur (used after F.placeInOrbit in the ?scenario=orbit start)
function syncStages() {
  for (let j = 0; j < v.cur && j < SG.length; j++) SG[j].visible = false; heroStage(v.cur);
  let y = 0; for (let j = v.cur; j < SG.length; j++) { SG[j].position.y = y; y += SG[j].userData.h; }
  const f = SG.length && SG[SG.length - 1].userData.fair; if (f && v.fairing <= 0) f.visible = false; if (v.fairing <= 0) heroFairing2(false); if (v.fairing <= 0) heroFairing(false);
}

// ---- f6.2 craft in space: switching the vessel you fly, and drawing the others where they are -----------------------------------
const kindTypeOf = w => craftTypeFor({ model: w.model, constellation: w.group === 'constellation', house: w.model });
function viewPos() { if (!viewId || !F || !F.fleet || camMode !== 'chase' || state !== 'flight') return null; const o = F.fleet.get(viewId); if (!o || o.id === F.fleet.activeId) { viewId = null; return null; }
  try { return F.fleet.stateAt(o, F.tAbs).r; } catch (e) { viewId = null; return null; } }
function setView(id) { const o = id && F.fleet.get(id); if (o && o.id !== F.fleet.activeId) { viewId = id; const T = craftTypeOf(o.type); camDist = Math.max(4, Math.min(120, (o.type === 'stage' ? 30 : T.h * 3.2 + 4))); camUserT = -1e9; camMode = 'chase'; toast('Viewing ' + o.name + '. Tap VIEW again to look back at your craft', '#9cc3ff'); }
  else { if (viewId) camDist = v && v.craft ? Math.max(4, v.tel.L * 3.2 + 4) : Math.max(30, Math.min(160, stackL() * 2.6 + 20)); viewId = null; } if (vesselUI) vesselUI.draw(); }
function clearFleetVis() { for (const e of fleetVis.values()) { scene.remove(e.g); e.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); } fleetVis.clear(); }
function fleetModel(o) {
  const T = craftTypeOf(o.type); let inner;
  if (o.type === 'stage' || T.special) { const veh = o.veh && o.veh.stages ? o.veh : { stages: [{ parts: [{ kind: 'tank', h: 8, d: 2.4 }, { kind: 'engine', h: 1.5, d: 1.4 }] }] }; const m = buildStageModel(veh, Math.min(veh.cur || 0, veh.stages.length - 1)); inner = m.group; inner.position.y = -m.h / 2; }
  else { inner = buildPayload(T.gfx, { detail: 'lo', r: T.d / 2 * 1.25, h: T.h }); inner.position.y = -inner.userData.cy * inner.scale.y; }
  const g = new THREE.Group(); g.add(inner); return g; }
const _fq = new THREE.Quaternion(), _fa = new THREE.Vector3();
function updateFleetVis(O) {
  if (!F || !F.fleet || state !== 'flight') return; const t = F.tAbs, live = new Set();
  for (const o of F.fleet.others()) {
    if (satVis && satVis.rec.vesselId === o.id) continue; if ((o.body || 'earth') !== F.body) continue;
    let st; try { st = F.fleet.stateAt(o, t); } catch (e) { continue; } live.add(o.id);
    let e = fleetVis.get(o.id); const d = Math.hypot(st.r[0] - O[0], st.r[1] - O[1], st.r[2] - O[2]);
    if (d > 4e5) { if (e) e.g.visible = false; continue; }
    if (!e || e.type !== o.type) { if (e) scene.remove(e.g); try { e = { g: fleetModel(o), type: o.type }; } catch (err) { console.warn('[Orbit Rush] craft model', err); continue; } fleetVis.set(o.id, e); scene.add(e.g); }
    e.g.visible = true; setRel(e.g, st.r, O);
    if (o.q) toQ(o.q, e.g.quaternion); else { const n = V.norm(st.v); _fa.set(n[0], n[1], n[2]); e.g.quaternion.setFromUnitVectors(Y_AXIS, _fa); }
    if (o.w && V.len(o.w) > 1e-6 && o.power === false) { const a = V.len(o.w) * (t - o.t); _fa.set(o.w[0], o.w[1], o.w[2]).normalize(); _fq.setFromAxisAngle(_fa, a); e.g.quaternion.multiply(_fq); } }
  for (const [id, e] of fleetVis) if (!live.has(id)) { scene.remove(e.g); e.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); fleetVis.delete(id); } }
function hideReleasedPayloadArt() { // a custom stack with no model: the payload part's box would reappear on the rocket once the payload has left
  if (!F.released || hero || !SG.length) return; const g = SG[SG.length - 1], y0 = g.userData.payY; if (y0 == null) return;
  for (const c of g.children) if (c.isMesh && !isPlumeChild(c, g) && c.position.y >= y0) c.visible = false; if (g.userData.fair) g.userData.fair.visible = false; }
function rebuildVesselArt() { // the vessel you fly changed: draw it (the rocket from its design, or the craft from its own vehicle)
  if (rocketG) { scene.remove(rocketG); freeGroup(rocketG); }
  if (v.craft && hero) { const old = hero; hero = null; heroRelease(old, renderer, scene, camera).catch(() => heroDispose(old)); }
  rocketG = new THREE.Group(); SG = v.craft ? makeCraftGroups(v) : (design.parts.length ? makeRocketGroups(design) : []);
  for (const g of SG) g.traverse(o => { if (o.geometry) o.geometry.userData.own = true; });
  let y = 0; for (const g of SG) { g.position.y = y; y += g.userData.h; rocketG.add(g); } scene.add(rocketG);
  rocketG.add(comMark, copMark, cotMark); fx.attach(rocketG); chuteVis = makeChutes(); rocketG.add(chuteVis);
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
  if (!v.craft) { applyPaint(design); if (SG[0]) addDecal(SG[0], design); attachHero(); syncStages(); if (F.released) { heroFairing(false); heroFairing2(false); hideReleasedPayloadArt(); } }
  else for (let j = 0; j < v.cur && j < SG.length; j++) SG[j].visible = false; }
function onVesselSwitched() {
  v = F.v; viewId = null; smapSats.c = null; for (const k in keys) keys[k] = false;
  try { rebuildVesselArt(); } catch (e) { console.warn('[Orbit Rush] vessel art', e); }
  camMode = camMode === 'map' ? 'map' : 'chase'; camUserT = -1e9; camDist = v.craft ? Math.max(4, Math.min(60, stackL() * 3.2 + 4)) : Math.max(30, Math.min(160, stackL() * 2.6 + 20)); camYaw = 0.5; camPitch = 0.12;
  $('tProg').classList.toggle('on', F.autoOn); updateEndFlightBtn(); if (vesselUI) vesselUI.draw(); syncCraftBtn(); }
function onVesselParked(o) { // the craft you left keeps its orbit in the saved world, so it is still there next flight
  smapSats.c = null; if (!o || !o.worldId) return;
  try { const w = WORLD.load(localStorage), a = w.objs.find(x => x.id === o.worldId); if (a) { a.r = o.r.slice(); a.v = o.v.slice(); a.t = o.t; a.craft = o.type; WORLD.save(localStorage, w); } } catch (e) { } }
function onVesselRemoved(o) { smapSats.c = null; const e = fleetVis.get(o.id); if (e) { scene.remove(e.g); fleetVis.delete(o.id); } if (viewId === o.id) viewId = null;
  if (o.worldId) try { const w = WORLD.load(localStorage); w.objs = w.objs.filter(x => x.id !== o.worldId); WORLD.save(localStorage, w); } catch (e2) { } if (vesselUI) vesselUI.draw(); syncCraftBtn(); }
function syncCraftBtn() { const b = $('craftBtn'); if (!b) return; const n = F && F.fleet ? F.fleet.list.length : 0, on = state === 'flight' && !!F && F.ignited && n > 1; b.classList.toggle('hidden', !on); if (on) { const c = v.craft; b.textContent = `CRAFT ${n} ([ ])`; b.title = c ? `You fly ${c.name}. Switch craft, view it, or power it on or off` : 'Switch to a craft left in space'; } }
let chuteVis = null;
// f5.2.3 payload lifecycle: the released payload is its own object (saved to the world list, drawn here until the flight ends)
let satVis = null; const smapSats = { c: null, t: 0 };
const CONSTELLATION_SATS = 21; // missions/constellation-batch.js dispense count
const OFFWORLD_PAY = { moon: 20, mars: 40, venus: 60 }; // $M for reaching orbit from a launch site on another world
const DEST_PAY = { orbit: 10, hop: 5, moon: 60, mars: 100, venus: 50 }; // f5.4 (QA A4): $M per mission destination
const isConstellation = () => /^heron|^swift/.test(design.model || design.name || '') || (opSess && opSess.m && opSess.m.id === 'constellation-batch');
function payloadName() { const W0 = WORLD.load(localStorage), c = isConstellation(), n = (c ? WORLD.count(W0, 'constellation') : W0.objs.length) + 1, of = opSess && opSess.m && opSess.m.id === 'constellation-batch' ? ' of ' + CONSTELLATION_SATS : ''; return (c ? 'Constellation sat' : (design.name || 'Payload')) + ' #' + n + of; } // f5.4 (QA A4): '#n of 21' on the batch contract
function onRelease(rec) {
  const o = WORLD.add(localStorage, { ...rec, name: payloadName(), group: isConstellation() ? 'constellation' : 'other', model: design.model || null, mission: director ? director.id : null });
  rec.saved = o; try { F.linkReleased(rec); } catch (e) { } if (o) fun.call('🛰', `${o.name} deployed · ${WORLD.count(WORLD.load(localStorage))} in orbit`, '#7dffb0');
  if (satVis) freeSat(); heroSyncPayload(); const tk = heroTakePayload(); let g, sat, q0 = null;
  if (tk) { g = tk.outer; sat = tk.src; q0 = tk.q0; } else { sat = buildPayload(payloadKind() || 'comsat', { detail: 'hi', r: 1.0, h: 3.0 }); g = new THREE.Group(); sat.position.y = -sat.userData.cy * sat.scale.y; g.add(sat); } // no hero model (custom design): the same payload builder
  scene.add(g); satVis = { g, sat, rec, t: 0, q0 }; updateEndFlightBtn(); }
// f5.4k: after RELEASE the chase camera frames the sat and the stage together (aim at their midpoint, pull back to fit both)
// for as long as they are close enough to read as a separation (< 600 m), then eases back to the stage
let relMix = 0; const relMid = new THREE.Vector3();
function relFrameCam(rdt, focus) {
  const on = !!satVis && focus === v && state === 'flight' && camMode === 'chase' && !F.ended, sep = on ? satVis.g.position.distanceTo(tgtV) : 1e9, use = on && sep < 600;
  relMix += ((use ? 1 : 0) - relMix) * Math.min(1, rdt * 1.5); if (relMix < 0.002 || !satVis) { relMix = use ? relMix : 0; if (!satVis) return; }
  relMid.copy(tgtV).lerp(satVis.g.position, 0.5); tgtV.lerp(relMid, relMix);
  const fit = (sep * 0.5 + 12) / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5) / Math.min(1, Math.max(0.45, camera.aspect)) * 1.25;
  if (use && performance.now() - camUserT > 8000) camDist += (Math.max(camDist, fit) - camDist) * Math.min(1, rdt * 2) * relMix;
}
function relFrame() { if (!satVis) return null; const W = innerWidth, H = innerHeight, b = $('relBtn'), br = b && !b.classList.contains('hidden') ? b.getBoundingClientRect() : null;
  const pj = p => { const q = p.clone().project(camera), x = (q.x + 1) / 2 * W, y = (1 - q.y) / 2 * H; return { x: Math.round(x), y: Math.round(y), on: q.z < 1 && x > 0 && x < W && y > 0 && y < H }; };
  const sat = pj(satVis.g.position), stage = pj(new THREE.Vector3(0, 0, 0)), pad = 24;
  const under = !!br && [sat, stage].some(p => p.x > br.left - pad && p.x < br.right + pad && p.y > br.top - pad && p.y < br.bottom + pad);
  return { sat, stage, under, sep: +satVis.g.position.length().toFixed(1), dist: +camDist.toFixed(1), btn: br && { l: Math.round(br.left), t: Math.round(br.top), r: Math.round(br.right), b: Math.round(br.bottom) } }; }
function freeSat() { if (!satVis) return; scene.remove(satVis.g); satVis.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); satVis = null; } // payload / kit materials are shared and cached: never disposed here
const _satQ = new THREE.Quaternion();
function updateSat(O, pdt) { if (!satVis) return; if (F.fleet && satVis.rec.vesselId && F.fleet.activeId === satVis.rec.vesselId) { freeSat(); return; } /* f6.2: you now fly that payload */ const s = WORLD.stateAt(satVis.rec, F.tAbs); setRel(satVis.g, s.r, O); satVis.t += pdt;
  if (satVis.q0) { const k = Math.min(1, satVis.t / 10), e = k * k * (3 - 2 * k), n = V.norm(s.r); _satQ.setFromUnitVectors(Y_AXIS, dv3.set(n[0], n[1], n[2])); satVis.g.quaternion.copy(satVis.q0).slerp(_satQ, e); } else dirQ(satVis.g, V.norm(s.r)); // keeps the stage's attitude at release, then eases to nadir
  const d = satVis.sat && satVis.sat.userData.deploy; if (d) d.call(satVis.sat.userData, (satVis.t - 1.2) / 4); } // arrays unfold after the springs have pushed it clear
function updateEndFlightBtn() { let b = $('relBtn'); if (!b) { b = document.createElement('button'); b.id = 'relBtn'; document.body.appendChild(b);
    b.onclick = e => { e.currentTarget.blur(); if (F.released) { if (!F.ended) showEnd(); } else F.releasePayload(); updateEndFlightBtn(); }; }
  const on = state === 'flight' && !F.ended && !F.flags.dead && (F.canRelease() || !!F.released);
  b.classList.toggle('hidden', !on); if (on) { b.textContent = F.released ? '■ End flight' : '🛰 RELEASE'; b.title = F.released ? 'End the flight: everything deployed stays in orbit' : 'Release the payload (or press STAGE)'; b.classList.toggle('rel', !F.released); b.classList.toggle('done', !!F.released); } }
function reset() {
  try { if (F && F.fleet && F.v && F.v.craft) F.parkActive(); } catch (e) { } clearFleetVis(); viewId = null; // f6.2: leaving a flight parks the craft you fly (its orbit is saved)
  gen++; freeSat();
  if (booster && booster.mesh) scene.remove(booster.mesh);
  for (const d of debris) scene.remove(d.mesh); debris.length = 0; for (const f of fairHalves) scene.remove(f.g); fairHalves.length = 0;
  if (shipVis) earth.remove(shipVis); if (shipVis2) earth.remove(shipVis2); shipVis2 = null; if (booster2 && booster2.mesh) scene.remove(booster2.mesh); booster2 = null;
  shipVis = null; booster = null; camMode = 'chase'; try { director = null; replay = null; slowMo = 0; recBuf.length = 0; for (const k in seen) delete seen[k]; dirPhase = ''; } catch (e) { }
  try { split.rec.length = 0; split.done = 0; split.closed = false; split.replay = null; split.full = null; } catch (e) { } if (typeof smap !== 'undefined') smap.reset();
  camDist = Math.min(fitDist(stackL(), 0.6), 420); /* f5.8f (QA P1): real sizes — a 120 m super-heavy needs ~210 m to fit (the old 140 m cap cut the nose off) */ camYaw = 0.5; camPitch = 0.12; mapZoom = 2.8; camAim = 0.5; // f4 pad framing
  fire.clear(); smoke.clear(); for (const k in keys) keys[k] = false;
  if (swingArm) swingArm.rotation.y = 0;
  $('end').classList.add('hidden'); $('toasts').innerHTML = '';
  showPreview();
}
const hudAlt = v => Math.max(0, P.altOf(v) - ((F && F.v === v && F.alt0) || 0));
function launch() { academy.hideFirst && academy.hideFirst(); { const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); } // f5.7e: a new flight starts with ☰ closed
  if (typeof home !== 'undefined' && home && home.on) home.show(false);
  initAudio(); startFlightAudio(); reset(); state = 'flight'; mobile.buzzed = false;
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
  $('hud').classList.remove('hidden');
  mobile.show(true); $('ignite').innerHTML = TOUCH ? '<b>AUTO</b> (optional), then <b>STAGE</b>' : 'Press <b>SPACE</b> to stage &amp; go · <b>F</b> = AUTO'; $('ignite').classList.remove('hidden'); // f5.5b
}
function goBuild() {
  try { plain.update({ on: false }); } catch (e) { } // f5.6c: no flight HUD in the Hangar
  if (fun) fun.hideNav();
  silenceFlight(0.3); reset(); state = 'build'; // f5.8y: nothing from the flight keeps playing in Home
  $('hud').classList.add('hidden'); mobile.show(false); $('ignite').classList.add('hidden');
  if (typeof home !== 'undefined' && home) home.show(true);
  refreshBuild();
}
const clampCamPitch = p => Math.max(F && F.alt < 2000 ? -0.15 : -1.2, Math.min(1.2, p)); // f5.6f (QA cam)
let showFrame = null, showFrameT = 0, showT = 0, camUserT = -1e9, camDist = 90, camYaw = 0.5, camPitch = 0.12, mapZoom = 2.8, camAim = 0.45;
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
const smap = createSolarMap({ renderer, getF: () => F, getSats: () => { const now = Date.now(); if (!smapSats.c || now - smapSats.t > 2000) { smapSats.c = F && F.fleet && F.fleet.list.length > 1 ? F.fleet.others().map(o => ({ id: o.id, name: o.name, r: o.r, v: o.v, t: o.t, body: o.body || 'earth' })) : WORLD.sats(WORLD.load(localStorage)); smapSats.t = now; } return smapSats.c; }, // f6.2: every craft in the fleet (the one you fly is drawn as the craft) toast: (m, c) => toast(m, c), touch: TOUCH, gfxQ, settings: SET,
  dvTable: () => dvTableHTML(craftDv(), false),
  burn: { throttle: u => setThrottleTouch(u), stage: () => press('Space'), sas: () => { if (state === 'flight') { if (v.auto) F.takeOverUpper(); F.setSAS('node'); } } },
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
$('creditsClose').onclick = () => $('credits').classList.add('hidden');
reset(); refreshBuild();
$('againBtn').onclick = () => goBuild(); // f3: the result card's Home goes back to the showroom
$('relaunchBtn').onclick = () => launch();
new MutationObserver(() => { const on = !$('end').classList.contains('hidden'); document.body.classList.toggle('endOn', on); if (on) { try { mobile.closeMenu && mobile.closeMenu(); } catch (e) { } const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); document.body.classList.remove('menuOn'); } }) /* f5.6x (QA f5.6w P1): the end card closes ☰ at every size */.observe($('end'), { attributes: true, attributeFilter: ['class'] });
{ // QA f5.1c P1: the flight HUD hides whenever any menu is up (Missions hub, Atlas, Settings, pause, career, home tabs)
  let mq = 0; const menuCheck = () => { mq = 0; const on = !!document.querySelector('.modal:not(.hidden):not(#end), #careerM:not(.hidden)') || (document.body.classList.contains('home') && !document.body.classList.contains('endOn'));
    if (document.body.classList.contains('menuOn') !== on) document.body.classList.toggle('menuOn', on); };
  new MutationObserver(() => { if (!mq) mq = requestAnimationFrame(menuCheck); }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  window.__menuCheck = menuCheck; }
$('contBtn').onclick = () => { startFlightAudio(); $('end').classList.add('hidden'); document.body.classList.remove('endOn'); F.unfinish(); F.endQueued = true; };
function shareText() { const sc = F.score(); return `🚀 I scored ${sc.toLocaleString()} in Orbit Rush${F.flags.orbit ? ' — reached a full-scale orbit' : ''}${F.flags.boosterBonus ? ' and landed the booster' : ''}${F.flags.recovered ? ' and brought the capsule home' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');
function toast(msg, color = '#7dffa6') { msg = localize(msg, TOUCH); if (msg === $('hint').textContent || [...$('toasts').children].some(c => c.textContent === msg)) return;  const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

// ---------- pause, quicksave / quickload, revert (Milestone Q) ----------
let paused = false;
const QS_KEY = 'orbitrush.quicksave.v1';
function setPause(on) { if (state !== 'flight') on = false; if (!!on !== !!paused) { if (on) silenceFlight(0.15); else if (!$('end') || $('end').classList.contains('hidden')) startFlightAudio(); } /* f5.8y: no engine / wind loop under the pause menu */ paused = !!on; if (paused) { const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); try { mobile.closeMenu(); } catch (e) { } document.body.classList.remove('menuOn'); } /* f5.7e (QA f5.7c P2): one menu at a time */ qol.pause(paused); if (paused) { for (const k in keys) keys[k] = false; } }
function quicksave() {
  if (state !== 'flight' || F.flags.dead) { toast('Nothing to save', '#ffb35c'); return false; }
  if (F.rails && F.warpI > 0) F.setWarp(0, true);
  try { const s = F.snapshot(); localStorage.setItem(QS_KEY, JSON.stringify(s)); toast('💾 Quicksaved' + (booster && booster.state === 'flying' ? ' (the booster in flight is not saved)' : ''), '#9cc3ff'); return true; } catch (e) { toast('Quicksave failed: ' + e.message, '#ff6262'); return false; }
}
function quickInfo() { try { const s = JSON.parse(localStorage.getItem(QS_KEY)); if (!s) return ''; return `${s.design.name || 'rocket'} · ${P.BODIES[s.body].name} · ${new Date(s.at).toLocaleTimeString()}`; } catch (e) { return ''; } }
function quickload() {
  let s = null; try { s = migrateSave(JSON.parse(localStorage.getItem(QS_KEY))); } catch (e) { s = null; }
  if (!s) { toast('No quicksave (F5 saves)', '#ffb35c'); return false; }
  setPause(false); startFlightAudio(); design = cloneDesign(s.design); reset(); state = 'flight';
  F.loadSnapshot(s); v = F.v; syncStages();
  for (const g of SG) for (const hp of g.userData.hot) hp.part = v.stages[g.userData.stage] && v.stages[g.userData.stage].parts[hp.pi];
  if (F.parked || P.altOf(v) > 100000) camDist = Math.max(30, Math.min(90, stackL() * 2.6 + 20));
  document.activeElement && document.activeElement.blur();
  $('hud').classList.remove('hidden'); mobile.show(true); $('ignite').classList.toggle('hidden', F.ignited);
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
  const cur = Math.min(F.warpI, mi); $('wDn').disabled = cur <= 0 && !F.autoWarp; $('wUp').disabled = false; $('wUp').classList.toggle('atMax', cur >= mi); /* QA f5.8p: at the cap ▶▶ stays tappable so warpStep shows the 'Max warp ×N: why' toast (disabled = silent on touch) */
  { const pad = !F.ignited || (F.v && F.v.clamped), slow = cur > 0 || !!F.autoWarp; $('wDn').hidden = pad || !slow; $('wUp').hidden = pad; $('wVal').hidden = pad || !(W > 1 || F.autoWarp); const x = W > 1 ? '×' + W : ''; if ($('wUp').dataset.x !== x) $('wUp').dataset.x = x; } // f5.8g (QA P2): one warp rule at every size — ▶▶ (with ×N), ◀◀ only while warping, none on the pad
  $('wDn').title = `Slower (,) · now ×${W}`; $('wUp').title = cur >= mi ? `Max warp ×${m}${why ? ' — ' + why : ''}` : `Faster (T) → ×${WARPS[cur + 1]} · now ×${W}`;
  const t = $('wVal'); const txt = (F.autoWarp ? '⏩ ' : '') + '×' + W; if (t.textContent !== txt) t.textContent = txt; document.body.classList.toggle('warp1', W === 1 && !F.autoWarp); t.title = `Time warp ×${W}${W > 1 ? ' — tap for ×1' : ''}`; t.classList.toggle('on', W > 1); }
$('wDn').onclick = e => { e.currentTarget.blur(); initAudio(); warpStep(-1); };
$('wUp').onclick = e => { e.currentTarget.blur(); initAudio(); warpStep(1); };
$('wVal').onclick = e => { e.currentTarget.blur(); warpReset(); };
function exitMap() { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); camMode = split.full === 'b' || flyingBooster() ? 'booster' : 'chase'; } // f5.6c: back to the view you left (split + its focus survive the map)
renderer.domElement.addEventListener('pointerdown', () => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); }, true);
function stageFlash(r) { // f5.6c (owner video): every STAGE tap answers: a flash on the button and a one-line toast
  for (const id of ['mStage', 'dStage']) { const b = $(id); if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); if (!b._fl) { b._fl = 1; b.addEventListener('animationend', () => b.classList.remove('flash')); } } } /* f5.8m: the flash is one-shot, the class never lingers */
  if (r === 'stage') toast('Stage ' + v.cur + ' separated', '#ffd23a'); else if (r === 'none') toast('Nothing left to stage', '#9cc3ff'); else if (r === 'debounce') toast('Staged', '#ffd23a');
}
function abortFlight() { // f5.6d (QA P0 #2): basic ABORT: engines off, AUTO off, drop every booster stage, chutes armed
  if (!F.ignited || F.flags.dead) { toast('Nothing to abort', '#9cc3ff'); return; }
  try { F.setAuto(false, true); F.setExec && F.setExec(false); } catch (e) { } v.ut = 0; v.throttle = 0;
  let n = 0; try { while (v.cur < F.last && n < 8) { F.stage(); n++; } } catch (e) { }
  try { F.deployChute(); } catch (e) { } toast('⛔ ABORT — engines cut' + (n ? ', ' + n + ' stage' + (n > 1 ? 's' : '') + ' dropped' : '') + ', chutes armed', '#ff6262');
}
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'Escape') { if (photoOn) { fun.photo.toggle(); return; } setPause(!paused); return; }
  if (code === 'Tab') { fun.toggleEngineer(); return; }
  if (code === 'Quote') { fun.photo.toggle(); return; }
  if (code === 'F5') { quicksave(); return; }
  if (code === 'F9') { quickload(); return; }
  if (code === 'Backquote') { SET.camStyle = 'free'; saveSettings(localStorage, SET); toast('Camera: horizon up (the locked style is retired)', '#9cc3ff'); return; } // f5.6n (QA): no LOCKED toast after LOCKED was retired
  if (code === 'Backslash') { SET.overlay = !SET.overlay; saveSettings(localStorage, SET); toast(SET.overlay ? 'CoM / CoP / CoT markers on' : 'Markers off', '#9cc3ff'); return; }
  if (code === 'KeyR') { goBuild(); return; }
  if (code === 'KeyU') { cycleFx(); return; }
  if (code === 'Slash') { academy.toggleLearn(); return; }
  if (code === 'KeyM') { if (camMode === 'map') exitMap(); else camMode = 'map'; return; }
  if (code === 'KeyT') { warpStep(1); return; }
  if (code === 'Comma') { warpStep(-1); return; }
  if (code === 'KeyG') { if (F.canWarpToAp() || !F.flags.orbit && F.body === 'earth') F.startAutoWarp(); else smap.warpNext(); return; }
  if (code === 'Period') { smap.warpNext(); return; }
  if (code === 'Digit9') { if (F.exec && opSess) { toast('AUTO is flying the contract burns', '#9cc3ff'); return; } if (F.exec) { F.setExec(false); toast('Maneuver execution off', '#9cc3ff'); } else F.setExec(true); return; }
  if (code === 'KeyY') { F.toggleBooster(); return; }
  if (code === 'KeyB') { if (booster && booster.state === 'flying') { camMode = camMode === 'booster' ? 'chase' : 'booster'; if (camMode === 'booster') { camDist = 160; camUserT = -1e9; } } else toast('No booster in flight', '#ffb35c'); return; }
  if (F.flags.dead) return;
  if (flyingBooster()) { // controls go to the booster
    const b = booster;
    if (code === 'KeyZ') b.ut = 1; if (code === 'KeyX') b.ut = 0;
    if (code === 'KeyF') { b.retro = !b.retro; toast(b.retro ? 'Holding retrograde' : 'Manual tilt', '#9cc3ff'); }
    return;
  }
  if (code === 'BracketRight' || code === 'BracketLeft') { F.cycleVessel(code === 'BracketRight' ? 1 : -1); return; } // f6.2: switch the craft you fly
  if (code === 'Minus') { F.togglePower(); return; }
  if (code === 'Equal') { if (vesselUI) { if (!vesselUI.isOpen() && F.fleet.list.length < 2) toast('Only one craft in space: release a payload first', '#ffb35c'); else vesselUI.toggle(); } return; }
  if (code === 'KeyO') { if (F.ret) F.cancelReturn(); else F.deorbit(); return; }
  if (code === 'KeyP') { F.deployChute(); return; }
  if (code === 'Backspace') { abortFlight(); return; }
  if (F.ret && F.ret.auto && ['KeyZ', 'KeyX'].includes(code)) F.setAuto(false);
  if (v.auto && ['KeyZ', 'KeyX', 'KeyF'].includes(code)) { F.takeOverUpper(); if (code === 'KeyF') return; }
  let res;
  if (code === 'Space') { const r = res = F.stagePress(); if (r === 'ignite') $('ignite').classList.add('hidden'); stageFlash(r); }
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
{ const b = document.createElement('button'); b.id = 'pauseBtn'; b.textContent = TOUCH ? '⏸' : '⏸ (Esc)'; b.title = 'Pause menu: quicksave/load, revert, settings'; b.onclick = e => { e.currentTarget.blur(); setPause(true); }; $('ctl').prepend(b); }
$('apBtn').onclick = e => { e.currentTarget.blur(); press('KeyG'); };
$('flyBtn').onclick = e => { e.currentTarget.blur(); press('KeyY'); };
$('sasBtn').onclick = e => { e.currentTarget.blur(); const i = P.SAS_MODES.indexOf(v.sas); F.setSAS(P.SAS_MODES[(i + 1) % P.SAS_MODES.length]); };
$('rcsBtn').onclick = e => { e.currentTarget.blur(); press('KeyC'); };
$('learnBtn').onclick = e => { e.currentTarget.blur(); academy.toggleLearn(); };
$('deoBtn').onclick = e => { e.currentTarget.blur(); press('KeyO'); };
$('chuteBtn').onclick = e => { e.currentTarget.blur(); press('KeyP'); };
vesselUI = createVesselUI({ getF: () => F, UN, onView: id => setView(id), getView: () => viewId }); // f6.2: the craft list
$('craftBtn').onclick = e => { e.currentTarget.blur(); vesselUI.toggle(); };
{ const mb = document.getElementById('mapMore'); if (mb) { const b = document.createElement('button'); b.dataset.a = 'vessels'; b.textContent = 'Craft list'; b.title = 'Switch to, view or power any craft in space (=)'; b.addEventListener('click', () => vesselUI.toggle()); mb.appendChild(b); } }
const zoomLim = d => Math.min(5000, Math.max(v && v.craft ? 2 : 20, d)); // a cubesat is a third of a metre long: let the camera come close
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') return; camUserT = performance.now(); if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * (1 + e.deltaY * 0.001))); else camDist = zoomLim(camDist * (1 + e.deltaY * 0.001 * SET.sens.zoom)); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointercancel', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId) || camMode === 'map') return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { camUserT = performance.now(); const k = SET.sens.cam; camYaw -= (e.clientX - px) * 0.006 * k; camPitch = clampCamPitch(camPitch + (e.clientY - py) * 0.004 * k); }
  else if (pts.size === 2) { let o; for (const [id, q] of pts) if (id !== e.pointerId) o = q; const d0 = Math.hypot(px - o[0], py - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); const f = d0 / Math.max(d1, 1); if (camMode === 'map') mapZoom = Math.min(12, Math.max(1.2, mapZoom * f)); else camDist = zoomLim(camDist * f); }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
});
const k1 = (a, b) => (keys[a] ? 1 : 0) - (keys[b] ? 1 : 0);
function readControls(rdt) {
  if (flyingBooster()) {
    const b = booster;
    if (keys.ShiftLeft || keys.ShiftRight || keys.ArrowUp) b.ut = Math.min(1, b.ut + rdt * 1.2);
    if (keys.ControlLeft || keys.ControlRight || keys.ArrowDown) b.ut = Math.max(0, b.ut - rdt * 1.2);
    b.input = { pitch: k1('KeyS', 'KeyW') - mobile.input.pitch, yaw: k1('KeyA', 'KeyD') + mobile.input.yaw }; // f5.6f: checked — with flight.js's −pitch about north this gives W = nose toward east, the same as the rocket (the sign flip is in the integrator, not the result)
    if (b.input.pitch || b.input.yaw) b.retro = false;
    return;
  }
  if (F.flags.dead) return;
  const mi0 = mobile.input, ks = SET.sens.stick, mi = { pitch: mi0.pitch * ks * 1.6, yaw: mi0.yaw * ks * 1.6, roll: mi0.roll * 1.4 } /* f5.6d (QA): touch steering had too little authority */, cl = x => Math.max(-1, Math.min(1, x));
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
  if (v.holdAtt && v.tel && !v.clamped) { const lim = limitToPrograde(v.holdAtt.n, P.progradeOf(v), aoaLimit(v.tel.q || 0, QALPHA_MAX)); if (lim.limited) { v.holdAtt = { n: lim.n, t: v.holdAtt.t }; v.sasHold = lim.n; } } // f5.6h: the held target follows prograde while Q is high
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
  { const hG = V.len(pos) - P.BODIES[F.body].R; if (hG < 300) { // fx-3: ground impact: dirt column, dust skirt, a lingering black smoke pillar
    const w = F.body === 'earth' ? siteVel({ r: pos }) : [0, 0, 0], e = P.eastOf(pos), n = V.cross(up, e), K = TOUCH ? 0.6 : 1;
    for (let i = 0; i < 40 * K; i++) { const a = Math.random() * 6.283, d = V.add(V.scale(e, Math.cos(a)), V.scale(n, Math.sin(a))); smoke.spawn(V.addS(pos, d, 4), V.add(w, V.add(V.scale(d, 25 + Math.random() * 35), V.scale(up, 2 + Math.random() * 6))), 5 + Math.random() * 4, 8, 22 + Math.random() * 14, 0x8a7458, 0x6b5a46, 0.4); }
    for (let i = 0; i < 30 * K; i++) smoke.spawn(V.add(pos, [rnd(6), rnd(6), rnd(6)]), V.add(w, V.add(V.scale(up, 30 + Math.random() * 50), [rnd(10), rnd(10), rnd(10)])), 3 + Math.random() * 3, 6, 18, 0x6e5a42, null, 0.7);
    for (let k = 0; k < 6; k++) later(() => { for (let i = 0; i < 6 * K; i++) smoke.spawn(V.add(pos, [rnd(5), rnd(5), rnd(5)]), V.add(w, V.add(V.scale(up, 12 + Math.random() * 10), [rnd(3), rnd(3), rnd(3)])), 8 + Math.random() * 6, 10, 40, 0x1c1c1c, 0x3a3a3a, 0.5); for (let i = 0; i < 6; i++) fire.spawn(pos, V.add(w, V.add(V.scale(up, 8 + Math.random() * 10), [rnd(6), rnd(6), rnd(6)])), 0.6 + Math.random() * 0.8, 3, 8, 0xffb060, 0x401000, 1.4); }, 600 * k + 400);
    scorchAt(pos, big ? 34 : 20); } }
  shake(Math.min(2.5, (big ? 3 : 1.5) * 120 / Math.max(60, dist)), big ? 1.6 : 0.8);
  if (main) fun.call('💥', 'UNPLANNED DISASSEMBLY', '#ff8a5c', true);
}
const scorchTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 6, 64, 64, 63); gr.addColorStop(0, 'rgba(10,8,6,0.95)'); gr.addColorStop(0.6, 'rgba(25,20,15,0.6)'); gr.addColorStop(1, 'rgba(30,25,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
let scorch = null; // fx-3: one blackened crater mark at the last ground impact
function scorchAt(pos, size) { if (!scorch) { scorch = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); scorch.frustumCulled = false; scene.add(scorch); }
  const up = V.norm(pos); scorch.userData.r = V.scale(up, P.BODIES[F.body].R + 0.4); scorch.scale.setScalar(size * 2); scorch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(up[0], up[1], up[2])); scorch.visible = true; }
function updateChunks(dt, O) {
  if (scorch && scorch.visible) { if (F.body === 'earth') scorch.userData.r = V.addS(scorch.userData.r, siteVel({ r: scorch.userData.r }), dt); const r = scorch.userData.r; scorch.position.set(r[0] - O[0], r[1] - O[1], r[2] - O[2]); }
  for (const c of chunks) { if (c.life <= 0) { if (c.m.visible) c.m.visible = false; continue; }
    c.life -= dt; const r = V.len(c.r), g = -P.BODIES[F.body].mu / (r * r), up = V.scale(c.r, 1 / r), h = r - P.BODIES[F.body].R;
    c.v = V.add(c.v, V.scale(up, g * dt)); if (h < 40000) c.v = V.add(c.v, V.scale(V.sub(c.v, F.body === 'earth' ? siteVel({ r: c.r }) : [0, 0, 0]), -0.25 * dt));
    c.r = V.add(c.r, V.scale(c.v, dt)); if (h < 0) { const R0 = P.BODIES[F.body].R, gv = F.body === 'earth' ? siteVel({ r: c.r }) : [0, 0, 0], rv = V.sub(c.v, gv), vr = V.dot(rv, up); c.r = V.scale(up, R0 + 0.3); c.v = V.add(gv, V.scale(V.sub(rv, V.scale(up, vr * 1.4)), 0.45)); c.w = V.scale(c.w, 0.5); // fx-3: debris bounces and tumbles to rest (was: vanished at the ground)
      if (-vr > 6 && Math.random() < 0.6) smoke.spawn(c.r, V.scale(up, 3), 2, 2, 7, 0x8a7458, null, 0.5); if (V.len(V.sub(c.v, gv)) < 2) { c.v = gv; c.w = [0, 0, 0]; } }
    c.m.position.set(c.r[0] - O[0], c.r[1] - O[1], c.r[2] - O[2]); c.m.rotation.x += c.w[0] * dt; c.m.rotation.y += c.w[1] * dt; c.m.rotation.z += c.w[2] * dt;
    if (c.smk && Math.random() < 0.5) smoke.spawn(c.r, c.v, 1.5, 1, 5, 0x333333, null, 1); }
}
let endMin = false, stageWant = false, stageWantAt = 0;
function showEnd() {
  if (F.ended) return; const score = F.finish();
  const flags = F.flags, o = F.orbitSnap ? F.orbitSnap.o : P.orbitOf(v), ok = (flags.orbit || !!(F.homeBody && F.homeBody !== 'earth' && (F.goals[F.homeBody] || {}).orbit)) && !flags.dead;
  const out = recordFlight(score);
  if (flags.dead || flags.recovered || flags.stranded || F.flags.landed) stopFlightLoops(0.5); // f5.8y: a finished flight stops its engine / wind loops now; the explosion one-shot plays out
  const landedOn = Object.entries(F.goals || {}).find(([, g]) => g.landed);
  $('endTitle').innerHTML = flags.dead ? fun.boomCard(flags.cause) : landedOn ? `🏳️ Landed on the ${P.BODIES[landedOn[0]].name}!` : flags.recovered ? '🪂 Orbit and home!' : flags.dead ? (/burned up|overheated/.test(flags.dead) ? '🔥 Burned up' : '💥 Rapid Unscheduled Disassembly') : ok ? '🛰️ Orbit achieved!' : flags.stranded ? '🪂 Out of fuel — suborbital' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  if (flags.recovered) lines.push(`<span class="good">✔ Recovered — touchdown at ${UN.spd(flags.touchdown)} · peak heating ${(F.maxHeat / 1000).toFixed(0)} kW/m² · peak skin ${F.maxTskin.toFixed(0)} K · ${F.maxGret.toFixed(1)} g on entry</span>`);
  if (flags.stranded && !flags.dead) lines.push(`<span class="warn">${F.advice()}</span>`);
  lines.push(`Max altitude: ${UN.big(flags.maxAlt || 0)} · Max-Q (ascent): ${(F.maxQ / 1000).toFixed(1)} kPa${F.maxQEntry > 1000 ? ` · entry peak q ${(F.maxQEntry / 1000).toFixed(1)} kPa` : ''} · max ${F.maxG.toFixed(1)} g · Δv used ${UN.dv(F.dvUsed)}`);
  if (F.released) { const sv = F.released.saved, W0 = WORLD.load(localStorage); lines.unshift(sv ? `<b class="good">🛰 ${sv.name} delivered · Pe ${UN.big(F.released.pe)} · ${WORLD.count(W0, 'constellation')} in the constellation, ${WORLD.count(W0)} in orbit</b>` : `<b class="warn">🛰 Payload released too low: it will re-enter</b>`); }
  if (flags.deorbited) lines.push(`<span class="good">✔ Spent stage de-orbited (${flags.deorbited})</span>`); else if (F.released && !flags.recovered) lines.push('<span class="warn">Spent stage left in orbit as debris</span>');
  if (flags.space) lines.push(`<span class="good">✔ Reached space (Kármán line, ${UN.big(100000)})</span>`);
  { const hb = F.homeBody, g = hb && hb !== 'earth' && (F.goals[hb] || {}).orbit; if (g && !flags.dead) { const o2 = P.orbitOf(v); lines.unshift(`<b class="good">🛰️ In orbit around ${P.BODIES[hb].name} · Ap ${UN.bigS(o2.ap)} / Pe ${UN.big(o2.pe)}</b>`); } }
  if (flags.orbit && !landedOn) lines.push(`<span class="good">✔ Orbit — Ap ${isFinite(o.ap) ? UN.big(o.ap) : 'escape'} / Pe ${UN.big(o.pe)} · period ${isFinite(o.T) ? (o.T / 60).toFixed(1) + ' min' : '—'}</span>`);
  if (flags.booster) lines.push(flags.boosterBonus ? `<span class="good">✔ Booster ${flags.booster} (+${flags.boosterBonus})</span>` : `<span class="warn">✘ Booster ${flags.booster}</span>`);
  else if (booster && booster.state === 'flying') lines.push('Booster still descending…');
  { const fb = F.flagsB; if (fb && fb.booster) lines.push(fb.boosterBonus ? `<span class="good">✔ Booster B ${fb.booster} (+${fb.boosterBonus})</span>` : `<span class="warn">✘ Booster B ${fb.booster}</span>`); }
  lines.push(`Rocket: ${design.name || 'Custom'} — ${v.stages.length} stages, ${UN.dv(F.stats.total)} · payload ×${v.mult}`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  if (director && director.result) lines.unshift(`<b class="${director.ok ? 'good' : 'warn'}">${MISSIONS[director.id].icon} ${director.result}</b>`);
  // f3: compact result card: headline result, score and medal up top; the stats wall folds into "Details"
  const extra = fun.endExtras(out, true), sc = lines.pop(), head = [], rest = [];
  for (const l of lines) (/class="(bad|warn)"|^<b class=/.test(l) && head.length < 3 ? head : rest).push(l);
  let stars = director && director.result && !director.ok ? 0 : { gold: 3, silver: 2, bronze: 1 }[out && out.medal] || (ok || (director && director.ok) ? 1 : 0); // a missed mission earns no stars
  if (!stars && design.sub && flags.space && !director) stars = 1; // f5.1h (QA): Pip's job is to touch space
  const noStars = isHopper(design); if (noStars) stars = 0; // fx-3: hops are free flight, no star rating
  if (!stars) extra.medal = ''; // f5.1h (QA): the ⋯ sheet never shows a medal the card's stars do not
  $('endBody').innerHTML = /* f5.8m (owner): no stars in the sim */ head.join('<br>') + `<div class="endScore">${sc}${extra.medal || ''}</div>` 
    + `<details class="endMore"><summary>Flight details</summary>${rest.join('<br>')}</details>`; /* f5.8w (QA f5.8v P2): no achievement / unlock wall on the end card (86% of the height at 1280) */
  $('replayBtn').classList.toggle('hidden', !(flags.dead && recBuf.length > 30));
  $('contBtn').classList.toggle('hidden', !!flags.dead || !!flags.stranded);
  $('shareBtn').textContent = 'Share score';
  // f5 lean end card (playtest ui_ideal_path #14 budget): ONE line + ↻ Retry + ▶ Next + ⋯; everything else lives in the ⋯ sheet
  { const L = out && out.ladder, starTxt = '';
    const what = design.sub && flags.space && !director ? 'Touched space ✓' : flags.dead ? 'Crashed' : F.released && F.released.saved && !director ? 'Delivered · ' + F.released.saved.name : landedOn ? 'Landed · ' + P.BODIES[landedOn[0]].name : director && director.result && director.m && director.m.target ? director.result.replace(/!$/, '') : flags.orbit ? (apKm => Number.isFinite(apKm) && apKm > 0 ? `Orbit · ${UN.big(apKm * 1000)}` : `Escape · ${P.BODIES[F.body].name}`)(((F.orbitSnap ? F.orbitSnap.o : o).ap || 0) / 1000) : UN.dist(flags.maxAlt || 0);
    const earn = false && L && (L.cash || L.sci) ? ` <span class="eLine">+$${L.cash}M${L.sci ? ' 🔬' + L.sci : ''}</span>` : '';
    $('endTitle').innerHTML = `${what}${earn}`;
    { /* f5.8m (owner): no missions/stars. Crash/strand: Retry + Home. Clean orbit/landing: Keep flying + Home (Retry only under ⋯) */
      const bad = !!flags.dead || !!flags.stranded; $('relaunchBtn').classList.toggle('noRetry', !bad); $('relaunchBtn').classList.toggle('big', bad); $('contBtn').classList.toggle('big', !bad); $('contBtn').textContent = 'Keep flying'; $('againBtn').textContent = '⌂ Home'; }
    { /* f5.8o (QA f5.8n): a short cause line from the real crash state, in a fixed slot under the title */
      let cl = $('endCause'); if (!cl) { cl = document.createElement('div'); cl.id = 'endCause'; $('endTitle').after(cl); }
      const d = String(flags.dead || ''), c = flags.cause, m = d.match(/([\d.]+) m\/s/), sp = m ? UN.spd(+m[1]) : null, tilt = (d.match(/(\d+)° from upright/) || [])[1];
      cl.textContent = !d ? '' : c === 'impact' || c === 'ground' ? (/never cleared/.test(d) ? 'Never cleared the tower' : sp ? `Hit the ground at ${sp}${/no parachutes/.test(d) ? ', no parachutes' : /failed/.test(d) ? ', parachutes failed' : tilt ? `, ${tilt}° off upright` : ''}` : 'Hit the ground') : c === 'tumble' ? 'Out of control' : c === 'breakup' ? 'Broke up under aero load' : c === 'burnup' || /burn|overheat/i.test(d) ? 'Burned up from heat' : d.charAt(0).toUpperCase() + d.slice(1, 48); }
    let mb = $('endMoreBtn'); if (!mb) { mb = document.createElement('button'); mb.id = 'endMoreBtn'; mb.textContent = '⋯'; mb.title = 'Details: score, Share, Retry'; mb.setAttribute('aria-label', 'Flight details'); $('contBtn').after(mb); mb.onclick = () => $('end').classList.toggle('more'); }
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
  const plume = group.userData.plume; const on = veh.thrust > (veh.craft ? 1e-7 : 0.01); // a cold-gas or ion craft pushes with milli-newtons
  plume.visible = on; const ex = plume.userData.extra; if (ex) for (const e of ex) e.visible = on;
  if (!on || dt <= 0) return;
  const h = V.len(veh.r) - R, p = P.pressureRatio(h), thr = veh.throttle;
  // underexpanded jet (fxmap.plumeShape): the plume widens ~sqrt(pe/pa) as the ambient pressure drops
  const ps = plumeShape(p * 101325, thr), pl = plumeLook(p * 101325, thr), ud = plume.userData, w0 = ud.w, fl = plumeFlicker(performance.now() / 1000, group.id || 0); // fx-1: smooth flicker (no per-frame random strobe)
  const PM = ud.mats || plumeMats('kerolox'), LK = PM.look, env = ud.env || 1, vf = vacFactors(LK, pl.vac); // QA plume pass: length from the engine (ud.lenM, gfx/plume_style.js), shortened and dimmed per propellant in vacuum
  let len = ud.lenM ? ud.lenM * (pl.len / 24) * vf.len * fl : pl.len * w0 * fl * Math.sqrt(env) * Math.sqrt(ud.ts || 1); const len0 = len, szK = ud.lenM ? Math.min(2, Math.max(0.45, Math.sqrt(ud.lenM / 30))) : 1;
  if (veh === v && booster && booster.state === 'flying' && performance.now() - WV.pulse < 6000) { const gap = V.len(V.sub(v.r, booster.r)) * 0.55; if (gap < len) len = Math.max(1.5, gap); } // f5.6c (owner video): the upper-stage plume never pokes through the booster just after separation
  plume.scale.set(1, 1, 1); const gk = glowScaleK(len, len0); // fx-1: the nozzle glow sprite fades with a clamped flame (no lone flat 2D sprite) // f5.3: the engines' jets merge into one column as long as the whole base would make
  const setL = (m, wk, lk = 1) => { m.scale.set(wk, len * lk, wk); m.position.y = -len * lk / 2; };
  const wd = LK.wid || 1, applyTo = P0 => { const u = P0.userData; if (u.lite) { setL(u.outer, (1.7 + 0.4 * pl.vac) * wd, 1); setL(u.core, pl.coreW * Math.sqrt(wd), 0.45 + 0.05 * fl); u.noz.scale.setScalar(w0 * (3 + 2 * thr) * fl * gk * LK.glow); return; }
    setL(u.glow, pl.glowW * 1.15 * fl * Math.sqrt(env) * wd, 0.85); setL(u.outer, (1.7 + 0.4 * pl.vac) * wd, 1); setL(u.core, pl.coreW * Math.sqrt(wd), 0.45 + 0.05 * fl);
    u.outer.visible = u.core.visible = !u.noCore;
    u.bell.visible = pl.bell > 0.02; u.bell.scale.set(pl.bellW * env * (ud.vac ? 1.35 : 1) * vf.bellW, len * 0.45 * Math.sqrt(env), pl.bellW * env * (ud.vac ? 1.35 : 1) * vf.bellW); u.noz.scale.setScalar(w0 * (3 + 2 * thr) * fl * gk * LK.glow * (u.noCore ? 0 : 1)); };
  applyTo(plume); if (ex) for (const e of ex) applyTo(e);
  const hiF = 1 - 0.92 * Math.min(1, Math.max(0, (h - 25000) / 15000)); // f4: above ~40 km the vacuum plume is just a faint glow
  const kk = LK.k * vf.k; PM.plume.opacity = Math.min(1, 0.72 * fl * pl.bright * (1 - 0.45 * pl.vac) * hiF * kk); PM.plumeGlow.opacity = Math.min(1, 0.42 * pl.bright * fl * hiF * kk * (1 - 0.9 * pl.vac)); PM.plume.opacity *= 1 - 0.8 * pl.vac; // fx-1: no dark-red/maroon cone in vacuum: a clean core + soft bell PM.plumeCore.opacity = Math.min(1, 0.87 * fl * (0.35 + 0.65 * hiF) * Math.max(0.5, kk));
  PM.plumeCore.opacity = 0.9 * fl * Math.min(1, Math.max(0.15, LK.k * vf.k ** 0.5)); // the hot core follows the propellant (a hydrolox core is a faint pale-blue thread, a solid's is white-hot)
  PM.plumeBell.opacity = 0.5 * pl.bell * fl * Math.max(0.3, hiF) * Math.max(0.6, kk) * (LK.k < 0.5 ? 1 : 0.6); PM.plumeSprite.opacity = Math.min(1, 0.9 * pl.bright * (0.4 + 0.6 * hiF) * Math.max(0.6, kk));
  { const vk = vacBlend(pl.vac), ck = 1 - vk, altK = vacAlt(h), vm = ud.vacm; // plume-soft-1: in thin air the cones hand over to one soft flaring shell that starts at the bell exit, widens and fades with altitude
    PM.plume.opacity *= ck; PM.plumeGlow.opacity *= ck; PM.plumeCore.opacity *= ck; PM.plumeBell.opacity *= ck; PM.plumeSprite.opacity *= 1 - 0.55 * vk;
    PM.plumeVac.opacity = vk > 0.01 ? vacOpacity(altK, pl.bright * fl, LK.k) * vk : 0;
    const vshow = P0 => { const u = P0.userData, m = u.vacm; if (!m) return; const on = vk > 0.01; m.visible = on; const cones = ck > 0.02; if (u.outer) u.outer.visible = u.core.visible = cones && !u.noCore; if (u.glow) u.glow.visible = cones; if (u.bell) u.bell.visible = u.bell.visible && ck > 0.02;
      if (on) { const wv = u.w * vacWidth(altK, Math.sqrt(u.ts || 1)) * Math.sqrt(u.env || 1), lv = len * (1.25 + 0.7 * altK) * (u.noCore ? 0.8 : 1); m.scale.set(wv, lv, wv); } };
    vshow(plume); if (ex) for (const e of ex) vshow(e); }
  const dia = ud.dia; dia.visible = QUALITY[fx.q].diamonds && ps.diamonds > 0.02;
  if (dia.visible) { PM.diamond.opacity = Math.min(1, ps.diamonds * 0.7 * fl * LK.dia * (ud.vac ? 0.35 : 1));
    dia.children.forEach((m, i) => { m.position.y = -(1.1 + i * 1.35) * w0 * (1 + 0.2 * thr); m.scale.set(1 - i * 0.12, 0.6, 1 - i * 0.12); }); }
  // continuous, thick, billowing exhaust column: puffs laid along the path since last frame (no gaps at 500 m/s),
  // warm and lit near the flame, drifting with the wind, thinning out as the air does
  // f3: one clean continuous trail straight behind the nozzle: hot and engine-lit at the flame, white condensation in
  // dense humid low air when transonic or at high thrust, widening and fading with altitude. No random kicks, no spiral.
  const sm = Math.min(1, pl.smoke * LK.smoke) * (0.35 + 0.65 * smokeFade(h)), wCap = smokeWidthCap(h), tr = group.userData.trail || (group.userData.trail = { last: null });
  const Mach = veh.tel && veh.tel.mach || 0, hum = Math.max(0, 1 - h / 12000), cond = hum * Math.min(1, Math.max(Mach > 0.7 ? (Mach - 0.7) / 0.4 : 0, thr > 0.6 ? (thr - 0.6) * 1.5 : 0) * (Mach < 2.2 ? 1 : 0.3));
  const vacW = thinAir(); // f5.4: airless worlds (Moon...): no exhaust smoke/condensation, just the flame
  if (sm > 0.03 && h < 40000 && !vacW) { // f4.1: no smoke/condensation above 40 km
    const vAir = V.sub(veh.v, siteVel(veh)), sp0 = V.len(vAir), back = sp0 > 30 ? V.scale(vAir, -1 / sp0) : V.scale(dir, -1);
    const at = V.addS(bottom, back, len * 0.5), lw = tr.last && V.addS(tr.last, siteVel(veh), dt), last = lw && V.len(V.sub(at, lw)) < 400 ? lw : V.addS(at, vAir, -dt); // the previous point rode the rotating air for dt (else: a sawtooth/corkscrew)
    const seg = V.sub(at, last), dist = V.len(seg), wid = Math.min(wCap, (3 + 5 * sm) * (1 + h / 9000) * (1 + 0.6 * cond) * (LK.smoke > 2 ? 1.6 : 1) * Math.min(2, Math.sqrt(env)) * szK), N = Math.min(TOUCH ? 10 : 18, Math.ceil(dist / Math.max(1.5, wid * 0.45)) + 1), sz = Math.min(wCap * 1.5, Math.max(wid, dist / N * 1.6)); // plume-soft-1: bounded size, so one stage's smoke cannot fill the screen
    tr.rate = (tr.rate || 60) * 0.9 + 0.1 * N / Math.max(dt / SIM_SPEED, 1e-3); const lifeK = Math.min(1, smoke.n * 0.85 / (tr.rate * 9));
    const wind = siteVel(veh), ground = h < 60 ? 1 : 0, soot = LK.soot && cond <= 0.3, cA = cond > 0.3 ? 0xf6f8fb : soot ? 0x9a9690 : 0xe4e6ea, cB = cond > 0.3 ? 0xdfe6ee : soot ? 0x6e6a66 : 0xb9bfc8; // kerolox: sooty grey
    for (let i = 0; i < N; i++) { const pos = V.addS(V.addS(last, seg, (i + 0.5) / N), wind, -dt); // pre-step: update() moves it by vel·dt this same frame
      const vel = ground ? V.add(wind, [rnd(25), rnd(25), rnd(25)]) : wind; // fx-1: calmer liftoff cloud
      smoke.spawn(pos, vel, Math.max(1.5, (4 + 3 * cond) * (0.6 + 0.4 * sm) * lifeK * (1 - Math.min(0.6, h / 60000))), sz, wid * (2.6 + 1.4 * cond) * (ground ? groundSmokeK(h) : 1), cond > 0.3 ? cA : 0xffe4c4, cB, 0.35 * (0.45 + 0.55 * smokeFade(h))); }
  }
  tr.last = sm > 0.03 && h < 40000 && !vacW ? (() => { const va = V.sub(veh.v, siteVel(veh)), s0 = V.len(va); return V.addS(bottom, s0 > 30 ? V.scale(va, -1 / s0) : V.scale(dir, -1), len * 0.5); })() : null;
  const n = h < 40000 && !(F && F.body !== 'earth' && !P.BODIES[F.body].atm) ? Math.round(Math.min(6, Math.ceil(dt * 120)) * flamePuffs(p) * (LK.puff ?? 1)) : 0; /* fx-1: no flame puffs in thin air / vacuum (the white puffs) */ /* f5.4d: airless worlds: the plume mesh is the glow, no flame puffs */ // f4.1: in vacuum the plume mesh is the glow; no flame particles (they read as dotted puffs)
  for (let i = 0; i < n; i++) {
    const sp = 60 + Math.random() * 40, spread = 6 + (1 - p) * 30;
    const fv = jit(V.addS(veh.v, dir, -sp), spread); fire.spawn(V.addS(V.addS(V.addS(bottom, dir, -2), fv, -dt), dir, -sp * dt * i / n), fv, /* f4.1: fully pre-step (update() moves it fv·dt this frame) — else it leads the nozzle by up to v·dt */ 0.25 + Math.random() * 0.25, 2.5 * szK, 6 + (1 - p) * 10, 0xffd9a0, 0x200800, 2);
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
  return `\n<b data-l="node">NODE</b  >  Δv ${UN.dv(dv)} · burn ${fmtDur(P.burnTimeFor(v, dv))} · ${n.started ? '<span class="warn">BURNING</span>' : dt > 0 ? `start in ${fmtDur(dt)}` : '<span class="warn">BURN NOW</span>'}${F.exec ? ' · AUTO' : ''}`.replace('</b  >', '</b>');
}
let tgtCache = { t: 0, s: '' };
function hudTarget() {
  const tg = F.target; if (!tg) return ''; const now = performance.now();
  if (now - tgtCache.t > 500) { tgtCache.t = now; const ts = P.transfer(tg, F.body, [0, 0, 0], [0, 0, 0], F.tAbs), d = V.len(V.sub(v.r, ts.r)), rv = V.len(V.sub(v.v, ts.v));
    let ca = ''; try { const pr = C.predict(F.body, v.r, v.v, F.tAbs, { nodes: F.nodes, maxPatches: 4, samples: 2 }), c = C.closestApproach(pr, tg); ca = c.inside ? ` · encounter Pe ${fmtD(c.alt)}` : isFinite(c.d) ? ` · CA ${fmtD(c.d)} in ${fmtDur(c.t - F.tAbs)}` : ''; } catch (e) { }
    tgtCache.s = `\n<b data-l="tgt">TGT</b>   ${P.BODIES[tg].name} · ${fmtD(d)} · rel ${UN.dv(rv)}${ca}`; }
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
  const fair = v.fairing > 0 ? (flags.fairing ? 'fairing jettisoned' : `fairing on (drops above ${UN.big(P.FAIRING_ALT)} at q̇ < 1.1 kW/m²)`) : '';
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
    const bh = Math.max(0, V.len(b.r) - R), bu = V.norm(b.r), bvr = V.dot(b.v, bu), bva = P.airVel(b, b.r, b.v), bsp = V.len(bva);
    const ship = F.ship, sp0 = ship ? shipPos(ship, b.clock, b.earthRot !== false) : null;
    if (ship && (bh < 3000 || (predT += 0.1) > 0.5)) { predT = 0; const ip = bh < 3000 ? null : P.predictImpact(b); const at = ip ? ip.r : b.r, sAt = ip ? shipPos(ship, ip.t, b.earthRot !== false) : sp0;
      const d = V.sub(V.norm(sAt), V.norm(at)); b.miss = V.dot(d, P.eastOf(at)) * R; b.missN = V.dot(d, V.cross(V.norm(at), P.eastOf(at))) * R; }
    const bd = ship ? (b.miss ?? 0) : 0, bn = b.missN || 0, tilt = Math.acos(Math.max(-1, Math.min(1, V.dot(b.dir, bu)))) * DEG;
    const dirS = !ship ? '' : Math.hypot(bd, bn) < 15 ? 'ON TARGET ✔' : `miss ${fmtD(Math.hypot(bd, bn))} — ship is ${bd > 0 ? 'EAST →' : '← WEST'}`;
    const bt = `BOOSTER ${b.manual ? '(YOU)' : '(auto)'}\nALT   ${fmtD(bh)}\nV/S   ${UN.dv(bvr)}   air ${UN.spd(bsp)}  M${(b.mach || 0).toFixed(1)}\nSHIP  ${dirS}\nTILT  ${tilt.toFixed(0)}°  THR ${(b.throttle * 100).toFixed(0)}% ×${b.n}\nFUEL  ${b.stages[0].fuel.toFixed(2)} t  ${b.phase}`;
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
    mobile.render({ hasChute: hasChutes(), canHome: !!(F && F.ignited && F.alt < 1000) /* f5.7k: Return to pad only below ~1 km */, alt: fmtD(hudAlt(v)), spd: fmtS(V.len(v.v)), ap: apS0(), pe: peS0(), mqL: dense ? 'MACH·Q' : hot ? 'HEAT' : 'V/S',
      mq: dense ? `${(tel.machShown ?? tel.mach).toFixed(1)}/${(tel.q / 1000).toFixed(0)}kPa` : hot ? `${fmtN(tel.heat / 1000)} kW/m²` : UN.vs(V.dot(v.v, V.norm(v.r))),
      mqC: tel.q > 30000 || tel.heat > 3e5 ? 'warn' : '', fuel: fu, score: F.score().toLocaleString(), thr: mobile.thrDragging() ? (cv.ut ?? cv.throttle ?? 0) : (cv.throttle || cv.ut || 0),
      fleet: !!(F.fleet && F.fleet.list.length > 1 && F.ignited), auto: F.autoOn, chute: hasChute && F.flags.liftoff && P.altOf(v) < 60000 && V.dot(v.v, V.norm(v.r)) < 0, home: F.ret ? 'CANCEL HOME' : 'HOME', booster: !!(F.booster && F.booster.state === 'flying') || !!(booster2 && booster2.state === 'flying'),
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
  syncCraftBtn();
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
  const fs = fx.update(rdt, { tel, L: g.L, d: g.d, shoulderY, cam: camBody, on, vUp: V.dot(v.v, V.norm(v.r)) - V.dot(siteVel(v), V.norm(v.r)) }, renderer); lastFx = fs;
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
// f5.6 (owner): no Academy / welcome card
renderer.setAnimationLoop(() => {
  GX.oceanTime.value = performance.now() / 1000; // flight-ground-2: ocean wave clock
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
    if (!director && F.ignited && F.autoOn && !F.flags.dead && isHopper(design)) director = hopAuto(F, { say: msg => fun.call('🦗', msg, '#ffe9b0') }); // fx-1 (QA B5): AUTO on a hopper = hop & land
    if (director && director.active && director.m.hop && F.extAuto && !F.autoOn) director.takeOver(); // AUTO switched off: the player flies
    if (director && director.active) { director.tick(rdt); directorCam(rdt); }
    if (director && !director.active && director.result && !director._carded && !F.ended) { director._carded = 1; const d0 = director; // QA f5a.2: every director ending (Mars/Venus capture, flyby, miss) stops warp and gets a result card
      try { F.setWarp(0); } catch (e) { } later(() => { if (director === d0 && !F.ended) { try { F.setWarp(0); } catch (e) { } camMode = 'chase'; showEnd(); } }, 2500); }
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
  const vwR = viewPos(); // f6.2: VIEW another craft: the camera looks at it, the one you fly stays in control
  const O = vwR || (focus === v ? v.r : booster.r);
  if (!placeBodies(O, th)) { earth.position.set(-O[0], -O[1], -O[2]); earth.rotation.z = th; }
  if (W1) { earth.updateMatrixWorld(); W1.frame(rdt > 0 && pdt > rdt * 4.01 ? 0 : pdt, camera); } // clouds drift on sim time, frozen above 4x warp
  const tilesOn = !!(window.__tiles && window.__tiles.stats && window.__tiles.stats.on); // private Google tiles own the ground while they show (the LOD globe hid them)
  if (tilesOn) earthLOD.group.visible = false; else { if (window.__tiles) earthLOD.group.visible = true; lodFrame(); }
  { const op = state === 'flight' && !!F && !F.ignited; if (op !== document.body.classList.contains('onPad')) document.body.classList.toggle('onPad', op); } // f5.7j: pad state for CSS (ABORT unlit)
  { const ao = state === 'flight' && !!(F && F.autoOn) && !(director && director.active === false && false); if (ao !== document.body.classList.contains('autoOn')) document.body.classList.toggle('autoOn', ao); } { const io = state === 'flight' && !!(F && F.flags.orbit); if (io !== document.body.classList.contains('inOrbit')) document.body.classList.toggle('inOrbit', io); const dead = state === 'flight' && !!F && !!F.flags.dead /* f5.8u (QA f5.8r P3): nothing to stage on the crash frame */, want = dead || state === 'flight' && !!F && F.ignited && !(F.v && F.v.cur < F.last) && !(!F.released && !!F.payloadPart()); /* f5.8o (owner): STAGE stays lit from liftoff while a stage remains OR the payload is unreleased; calm grey only after RELEASE with nothing left */ /* f5.8n: ONE condition: lit while a payload is unreleased or a stage remains (not gated on tower/altitude, which made it flicker at ~141 m); 0.3 s debounce */
    const nowT = performance.now(); if (want !== stageWant) { stageWant = want; stageWantAt = nowT; } const ns = (want !== document.body.classList.contains('noStage') && (!want || dead || nowT - stageWantAt > 300 || state !== 'flight')) ? want : document.body.classList.contains('noStage'); if (ns !== document.body.classList.contains('noStage')) document.body.classList.toggle('noStage', ns); { const lf = state === 'flight' && !!F && !!F.ignited; if (lf !== document.body.classList.contains('lifted')) document.body.classList.toggle('lifted', lf); } } // f5.6x: STAGE goes dark with nothing left to stage // f5.6u: orbit drops ABORT / throttle on phones // f5: manual controls hide while AUTO flies
  setRel(rocketG, base, O); toQ(v.q, rocketG.quaternion);
  worldVis(base, O, nose);
  if (state === 'flight' && !F.flags.dead && SG[v.cur]) emit(v, SG[v.cur], pdt, base, nose);
  else for (let j = v.cur; j < SG.length; j++) SG[j].userData.plume.visible = false;
  { const lg = v.cur === 0 && SG[0] && SG[0].userData.legs; if (lg) { const on = state === 'flight' && (!!v.legs || !!F.flags.landed); if (lg.visible !== on) { lg.visible = on; lg.traverse(o => { if (o.isMesh) o.visible = on; }); } } } // fx-2: landing legs on the flying rocket (hop)
  if (state === 'flight' && !F.flags.dead && SG[v.cur] && SG[v.cur].userData.radial && SG[v.cur + 1] && parallelCore()) emit(v, SG[v.cur + 1], pdt, base, nose); // fx-1: Heavy core lights with its side boosters (Vehicle Specs: parallel stage)
  const ovl = (SET.overlay && state === 'flight' && !F.flags.dead && camMode !== 'map');
  comMark.visible = copMark.visible = ovl; cotMark.visible = ovl && !!(v.stages[v.cur] && v.stages[v.cur].eng && v.stages[v.cur].eng.tv > 0);
  if (ovl) { const yB = 0; comMark.position.set(0, tel.ycom, 0); copMark.position.set(0, P.centerOfPressure(P.stackGeom(v), state === 'build' ? 0.5 : Math.max(0.3, tel.mach || 0.5)), 0); cotMark.position.set(0, yB, 0);
    const sc = Math.max(1, stackL() / 40); comMark.scale.setScalar(sc); copMark.scale.setScalar(sc); cotMark.scale.setScalar(sc); }
  for (let k = debris.length - 1; k >= 0; k--) { // spent upper stages tumble away and are removed after a while
    const d = debris[k]; d.throttle = 0; let left = pdt; while (left > 0 && !d.gone) { const dt = Math.min(0.25, left); left -= dt; if (P.stepPoint(d, dt)) d.gone = true; }
    d.t += pdt; d.dir = V.norm(V.qrot(V.qAxisAngle(V.norm(d.r), pdt * 0.3), V.qrot(V.qAxisAngle(P.eastOf(d.r), pdt * 0.2), d.dir)));
    setRel(d.mesh, d.r, O); dirQ(d.mesh, d.dir);
    if (d.gone || d.t > 120) { scene.remove(d.mesh); debris.splice(k, 1); }
  }
  fairTick(pdt, O); updateSat(O, pdt); updateFleetVis(O); if ((F.met | 0) !== (updateEndFlightBtn.k | 0)) { updateEndFlightBtn.k = F.met; updateEndFlightBtn(); }
  for (const bq of [booster, booster2]) if (bq && bq.mesh && bq.mesh.visible) { // f4.2: each side booster
    setRel(bq.mesh, bq.r, O); dirQ(bq.mesh, bq.dir);
    const bh = V.len(bq.r) - R, legs = bq.mesh.userData.legs; if (legs) legs.visible = bq.state === 'landed' || (bq.state === 'flying' && (bq.legs || bh < 600));
    if (bq.state === 'flying') emit(bq, bq.mesh, pdt, bq.r, bq.dir); else bq.mesh.userData.plume.visible = false;
  }
  // ground tile follows the focus (Earth-fixed coordinates)
  const fr = V.len(O), h = fr - R, isMap = camMode === 'map';
  { const ta = GX.tileAltAlpha(h); GX.tileFadeU.value.set(Math.max(0, h), ta, 0, 0); const on = !isMap && ta > 0.002 && !tileForceOff, fd = h >= GX.TILE_FADE.swap; tile.visible = on && !fd; tileF.visible = on && fd; } // f5.9 terrain: dissolves 14→62 km (was a hard cut at 80 km)
  if (tile.visible || tileF.visible) updateTile(V.rotZ(O, -th));
  // camera
  U.set(O[0] / fr, O[1] / fr, O[2] / fr); const ea = P.eastOf(O); E.set(ea[0], ea[1], ea[2]); N.crossVectors(U, E);
  hemi.position.copy(U);
  if (isMap) {
    const cu = new THREE.Vector3(U.x, U.y, 0); if (cu.lengthSq() < 1e-6) cu.set(0, 1, 0);
    camera.position.set(-O[0], -O[1], -O[2] + R * mapZoom); camera.up.set(0, 1, 0); camera.lookAt(-O[0], -O[1], -O[2]); // f5.6f (QA cam): map up = fixed ecliptic north, no roll as you orbit
  } else {
    if (vwR) tgtV.set(0, 0, 0); else if (focus === v) tgtV.set(nose[0], nose[1], nose[2]).multiplyScalar(stackL() * camAim - tel.ycom);
    else tgtV.set(booster.dir[0], booster.dir[1], booster.dir[2]).multiplyScalar(15);
    if (focus !== v && camDist > 400) camDist = 400; // f5.6f (QA cam): booster cam never frames from km away
    if (focus === v && !vwR && state === 'flight' && camMode === 'chase') { // f4.1: chase distance follows the rocket's size (never a dot); eases back after a user zoom
      const Ls = stackL(), cr = !!v.craft, want = cr ? Math.max(4, Math.min(60, Ls * 3.2 + 4)) : Math.max(30, Math.min(160, Ls * 2.6 + 20)), maxD = cr ? Math.max(60, Ls * 30 + 40) : Math.max(80, Ls * 9 + 60);
      if (camDist > maxD) camDist += (maxD - camDist) * Math.min(1, rdt * 1.5); // f5.6f: ease (no ~70 m jump at staging) if (performance.now() - camUserT > 8000) camDist += (want - camDist) * Math.min(1, rdt * 0.8);
    }
    relFrameCam(rdt, focus);
    if (false && SET.camStyle === 'locked' && focus === v && state === 'flight') { // f5.6f (QA cam): LOCKED retired (it rolled the horizon) // locked: the camera turns with the craft (its axes, nose up on screen)
      const ax = V.qrot(v.q, [1, 0, 0]), az = V.qrot(v.q, [0, 0, 1]);
      offV.set(ax[0], ax[1], ax[2]).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(dv3.set(az[0], az[1], az[2]), Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(dv3.set(nose[0], nose[1], nose[2]), Math.sin(camPitch));
      camera.position.copy(tgtV).addScaledVector(offV, camDist); camera.up.set(nose[0], nose[1], nose[2]); camera.lookAt(tgtV);
    } else {
    camPitch = clampCamPitch(camPitch); // f5.6f: −0.15…1.2 rad near the ground, ±1.2 above (up = local radial never meets the view axis)
    offV.copy(N).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(E, Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(U, Math.sin(camPitch));
    camera.position.copy(tgtV).addScaledVector(offV, camDist); { const bR = (P.BODIES[F && F.body] || {}).R || R, ca = dv3.set(camera.position.x + O[0], camera.position.y + O[1], camera.position.z + O[2]).length() - bR; if (ca < 5) camera.position.addScaledVector(U, 5 - ca); } camera.up.copy(U); camera.lookAt(tgtV); } // f5.6f: camera never under the ground (≥ 5 m)
  }
  groundCam(O, th, base, nose, rdt);
  if (rocketG) { const t0 = performance.now(); updateFX(rdt, pdt, base, nose, isMap); fxMs += (performance.now() - t0 - fxMs) * 0.05; }
  mapLine.visible = isMap && state === 'flight'; marker.visible = bMarker.visible = isMap;
  if (isMap) {
    updateOrbitLine(O); setRel(marker, v.r, O); marker.scale.setScalar(R * mapZoom * 0.006);
    if (booster && booster.state === 'flying') { setRel(bMarker, booster.r, O); bMarker.scale.setScalar(R * mapZoom * 0.005); } else bMarker.visible = false;
  }
  if (window.__camHook) window.__camHook(camera); // shot/test tools aim the camera after the chase camera is placed
  fitFar(); stars.position.copy(camera.position);
  // f1u2: O / v.r are relative to the current SOI body, but the sky, fog and Earth atmosphere assume Earth. Away from
  // Earth, |O| − R_earth went negative in low lunar orbit → daytime sky + fog density e^(−h/8000) ≫ 1: a flat colour wash.
  const hs = skyAlt(h), k = Math.min(1, Math.max(0, hs / 70000));
  const lit = updateSun(O, U, hs, k, isMap); // sun direction, eclipse, sky colour, scattering, lights
  stars.material.opacity = isMap ? 1 : Math.min(1, Math.max(0, k * 1.4 - 0.3) + (1 - lit.day) * (1 - k) * 0.8);
  updateCine(rdt, F && F.body !== 'earth' ? F.alt : h, isMap); // f5.4: Earth-relative h is hugely negative on other worlds (camera shake blew up)
  updateChunks(pdt, O);
  fire.update(pdt, O, camera.quaternion, wE); smoke.update(pdt, O, camera.quaternion, wE);
  musicTick(); // f6.3: menu beat / space score follow the screen and the altitude
  if (ac && dbus) { // f6.3: camera distance + thin air for every flight sound: the vehicle camera stays loud, a ground camera loses the rocket fast, vacuum leaves only a faint low rumble
    const camD = camera.position.distanceTo(tgtV), p0 = P.pressureRatio(h), distK = camMode === 'map' ? 0.35 : GCAM.act ? 1 / (1 + Math.pow(camD / 600, 1.5)) : 1 / (1 + Math.max(0, camD - 250) / 2500), vacK = 0.1 + 0.9 * Math.sqrt(Math.min(1, p0 * 3));
    dbus.gain.setTargetAtTime(distK * vacK, ac.currentTime, 0.15); audioMix.dist = camD; audioMix.distK = distK; audioMix.vacK = vacK; }
  if (rumble && rumbleF) {
    const watchB = booster && booster.state === 'flying' && camMode === 'booster';
    const thK = state === 'flight' ? (watchB ? booster.thrust : F.flags.dead ? 0 : v.thrust) : 0;
    const p = P.pressureRatio(h);
    rumble.gain.setTargetAtTime(Math.min(0.9, thK / 3000 * (0.25 + 0.75 * p)), ac.currentTime, 0.08);
    rumbleF.frequency.setTargetAtTime(150 + 500 * p, ac.currentTime, 0.2);
    if (crack) crack.gain.setTargetAtTime(Math.min(0.5, thK / 2500 * (0.3 + 0.7 * p) * 0.5), ac.currentTime, 0.08); // f6.3: crackle follows thrust and fades with the air
  }
  if (state === 'flight' && (hudT += rdt) > 0.1) { academy.tick(hudT); hudT = 0; hud(); academy.tick(0); academy.renderLearn(); }
  else if (state === 'build' && academy.active && (hudT += rdt) > 0.25) { academy.tick(hudT); hudT = 0; }
  const showOn = state === 'build' && home && home.on;
  if (padConcM && showOn !== padShow) { padShow = showOn; const P0 = showOn ? { color: SHOWROOM_PAD.color, roughness: SHOWROOM_PAD.roughness, env: SHOWROOM_PAD.envIntensity } : padConc0; // ui-icons: lighter showroom pad so the rocket reads as the hero
    padConcM.color.setHex(P0.color); padConcM.roughness = P0.roughness; padConcM.envMapIntensity = P0.env; }
  if (showOn) { // showroom: slow cinematic turn; ui-icons frameRocket sizes + centres the REAL model from its bounds (70% of the screen, tip below the 48 px safe line) above the card (portrait) or beside it (landscape)
    const land = innerWidth > innerHeight; showT += rdt;
    const stw = rocketG && siteTower();
    if (rocketG && (stw || (padCx && padCx.isObject3D && padCx.visible))) { // f5.1: swing on an arc facing away from the tower (its legs never pass in front of the rocket); f5.4k: or the site's catch tower
      const tw = (stw || padCx.localToWorld(new THREE.Vector3(-10, 40, 0))).sub(rocketG.position), ty = Math.atan2(tw.dot(E), tw.dot(N));
      const want = ty + Math.PI + 0.9 * Math.sin(showT * 0.12); let d = ((want - camYaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; camYaw += d * Math.min(1, rdt * 2); }
    else camYaw += rdt * 0.22;
    if (rocketG && ((showFrameT -= rdt) <= 0 || !showFrame)) { showFrameT = 0.25;
      const p0 = rocketG.position.clone(), q0 = rocketG.quaternion.clone(); rocketG.position.set(0, 0, 0); rocketG.quaternion.identity(); rocketG.updateMatrixWorld(true); // rocket frame: base at 0, nose +Y (hero matrices must follow)
      try { const bx = hero ? null : rocketBounds(); showFrame = (hero || bx) ? frameRocket({ ...(hero ? { object: hero } : { bounds: bx }), fovDeg: camera.fov, aspect: camera.aspect, screenH: innerHeight, free: showFree(land), yaw: 0, elev: 0.08 }) : null; } catch (e) { showFrame = null; }
      rocketG.position.copy(p0); rocketG.quaternion.copy(q0); rocketG.updateMatrixWorld(true); window.__showDbg = { f: showFrame, L: stackL() }; }
    if (showFrame) { const Lh = stackL() || 40, se = Math.sin(0.08); camDist = showFrame.dist * Math.hypot(1, se); camPitch = Math.atan(se); camAim = showFrame.aim[1] / Lh;
      camera.setViewOffset(innerWidth, innerHeight, showFrame.viewOffsetX * innerWidth, 0, innerWidth, innerHeight); }
    else { const Lh = v ? P.stackGeom(v).L : 40; camPitch += (0.05 - camPitch) * Math.min(1, rdt); camDist = Math.max(40, Lh * (land ? 1.6 : 1.75)); camAim = 0.5; camera.setViewOffset(innerWidth, innerHeight, land ? innerWidth * 0.2 : 0, land ? 0 : innerHeight * 0.17, innerWidth, innerHeight); } }
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  const mapOn = state === 'flight' && camMode === 'map';
  if (smap.state.on !== mapOn) { // f3: any modal steps aside while the map is open (the result card comes back after)
    if (mapOn && !$('end').classList.contains('hidden')) { $('end').classList.add('hidden'); endMin = true; } else if (!mapOn && endMin) { endMin = false; if (F.ended) $('end').classList.remove('hidden'); }
    if (mapOn) document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    smap.show(mapOn); document.body.classList.toggle('mapOn', mapOn); }
  updateSplit(rdt);
  if (state === 'flight' && split.on && !split.full) /* f5.7m: Heavy too */ { if (camera.view && camera.view.enabled) camera.clearViewOffset(); } // f5.7j (QA f5.7i P1): the upper stage keeps the single-view framing in split (same pointing in every layout) // f5.7i: the upper stage sits centred below/right of the booster PiP
  else if (state === 'flight' && split.on && !split.full) { const R2 = paneRect(); if (splitPortrait()) camera.setViewOffset(innerWidth, innerHeight, 0, booster2 ? innerHeight / 2 - ctlTop() / 6 : innerHeight * 0.25, innerWidth, innerHeight); else camera.setViewOffset(innerWidth, innerHeight, innerWidth * 0.25, 0, innerWidth, innerHeight); }
  if (mapOn) { smap.update(rdt); mapPost.render(); }
  else { post.render(); renderSplit(O); }
  if (snapReq) { const f = snapReq; snapReq = null; savePhoto(f); }
  if (state === 'build' && snapAnim > 0 && rocketG) { snapAnim = Math.max(0, snapAnim - rdt * 3); const k = 1 + Math.sin(snapAnim * Math.PI) * 0.06; rocketG.scale.set(k, 1 / k, k); }
});


// ---------- f1 split-screen staging: upper stage and returning booster, both in full physics ----------
// The booster pane renders the same scene a second time with its own camera (scissored, no bloom, flow
// particles off = the Low look). Tap a pane to make it full screen; ⇄ switches control between the craft.
const cam2 = new THREE.PerspectiveCamera(55, 1, 0.5, 2e9), SPLIT_KEY = 'orbitrush.split';
const split = { on: false, full: null, done: 0, rec: [], replay: null, enabled: localStorage.getItem(SPLIT_KEY) !== '0', yaw: 1.35, pitch: 0.25, dist: 90, userT: -1e9, frame: 0 };
{ const d = document.createElement('div'); d.id = 'split'; d.className = 'hidden';
  d.innerHTML = '<div id="spPane"><div class="spCard spStrip" id="spCardB"><div class="spL" id="spHud"></div><canvas class="spBall" id="spBallB" width="96" height="96"></canvas><div class="spR" id="spHudR"></div></div><div class="spBtns"><button id="spCtl" title="Switch control">⇄ CONTROL</button><button id="spFull" title="Full screen">⤢</button><button id="spClose" title="Close the booster view">✕</button></div></div><div id="spMain"><div class="spBtns" id="spBtnsU"><button id="spCtlU" title="Switch control">⇄ CONTROL</button><button id="spFullU" title="Focus the upper stage">⤢</button><button id="spCloseU" title="Close the split view">✕</button></div><div class="spCard spStrip" id="spCardU"><div class="spL" id="spHud1"></div><canvas class="spBall" id="spBallU" width="96" height="96"></canvas><div class="spR" id="spHud1R"></div></div></div>';
  document.body.appendChild(d);
  { const p2 = document.createElement('div'); p2.id = 'spPane2'; p2.className = 'hidden'; p2.innerHTML = '<div class="spCard spStrip" id="spCardB2"><div class="spL" id="spHud2"></div><canvas class="spBall" id="spBallB2" width="96" height="96"></canvas><div class="spR" id="spHud2R"></div></div>'; d.appendChild(p2); } // f4.2: booster B pane
  $('spFull').onclick = e => { e.stopPropagation(); split.full = split.full === 'b' ? null : 'b'; camMode = split.full === 'b' ? 'booster' : 'chase'; if (split.full === 'b') camDist = 90; }; // f5.3: frame the whole booster
  // f4: the booster pane has its own camera: drag orbits, pinch / wheel zooms, a tap (no drag) toggles full screen
  const pp = $('spPane'), pts = new Map(); let moved = 0, pinch0 = 0, d0 = 90;
  pp.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; pp.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); d0 = split.dist; } e.stopPropagation(); });
  pp.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch0 > 0) split.dist = Math.max(25, Math.min(1500, d0 * pinch0 / Math.max(d, 1))); moved = 99; }
    else { moved += Math.abs(dx) + Math.abs(dy); split.yaw -= dx * 0.008; split.pitch = Math.max(-0.4, Math.min(1.3, split.pitch + dy * 0.006)); split.userT = performance.now(); } e.stopPropagation(); });
  const up = e => { if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0;
    if (!pts.size && moved < 8) { if (split.full) { split.full = null; camMode = 'chase'; } else { split.full = 'b'; camMode = 'booster'; camDist = 90; } } e.stopPropagation(); };
  pp.addEventListener('pointerup', up); pp.addEventListener('pointercancel', up);
  pp.addEventListener('wheel', e => { split.dist = Math.max(25, Math.min(1500, split.dist * Math.exp(e.deltaY * 0.001))); e.preventDefault(); e.stopPropagation(); }, { passive: false });
  $('spMain').onclick = () => { if (split.full) { split.full = null; camMode = 'chase'; } };
  $('spFullU').onclick = e => { e.stopPropagation(); split.full = split.full === 'u' ? null : 'u'; camMode = 'chase'; }; // f5.3: focus the upper stage (keeps its own card)
  $('spCtl').onclick = e => { e.stopPropagation(); if (booster && booster.state === 'flying' && F.ship && booster.stages[0].fuel > 0) F.toggleBooster(); else toast('The booster is on autopilot', '#9cc3ff'); };
  $('spClose').onclick = e => { e.stopPropagation(); split.closed = true; };
  $('spCloseU').onclick = $('spClose').onclick; $('spCtlU').onclick = $('spCtl').onclick; // f5.6h (QA P2): both halves carry the same buttons
  $('spFull').textContent = 'BOOSTER ⤢'; $('spFullU').textContent = 'UPPER ⤢'; // f5.6x: every size // f5.6u (QA P1): phones get one small label per pane; tapping it focuses that pane (⇄ / ✕ are hidden: the pane's ball takes control)
}
const splitPortrait = () => innerHeight > innerWidth;
const hasChutes = () => { try { return !!(F && F.v.stages.some(s => s.parts.some(p => /chute/i.test(p.kind || '')))); } catch (e) { return true; } }; // f5.7i
const _html = {}; function setHTML(id, h) { if (_html[id] !== h) { _html[id] = h; const e = $(id); if (e) e.innerHTML = h; } }
function placeTopStack(on) { // f4.1b: in split, toasts/hints (#topStack, compact #hintS) live in the upper pane, below its card and clear of the pane buttons
  const por = splitPortrait(), land = on && camMode !== 'map', W = innerWidth, card = $('spCardU') || $('spHud1'), cb = card && land ? card.getBoundingClientRect() : null, pTop = innerHeight * (booster2 ? 1 / 3 : 0.5), top = (() => { const pr = pipRect(); return por ? pr.y + pr.h + 10 : 112; })(); // f5.7j: below / beside the booster inset /* f5.6h: the cards moved to bottom strips */ // f4.2 portrait: under the upper card if it fits above the booster pane, else above the card
  for (const id of ['topStack', 'hintS']) { const ts = $(id); if (!ts) continue;
    if (!land) { if (ts.dataset.sp) { ts.style.removeProperty('left'); ts.style.removeProperty('top'); ts.style.removeProperty('max-width'); delete ts.dataset.sp; } continue; }
    ts.dataset.sp = '1'; ts.style.setProperty('left', Math.round(W * (por ? 0.5 :  TOUCH ? 0.62 : 0.5)) + 'px', 'important'); ts.style.setProperty('top', Math.round(top + (id === 'hintS' ? 0 : 40)) + 'px', 'important'); ts.style.setProperty('max-width', Math.round(por ? W - 24 : W * 0.5 - 32) + 'px', 'important'); } }
// f5: portrait touch: the panes end above the stick / throttle / STAGE cluster so the lowest booster pane is never under them
let ctlTopC = { t: 0, v: 0 };
function ctlTop() { const H = innerHeight; if (!TOUCH || !splitPortrait()) return H; const now = performance.now(); if (now - ctlTopC.t < 500) return ctlTopC.v;
  let top = H; for (const id of ['mleft', 'mright']) { const e = document.getElementById(id); if (!e || getComputedStyle(e).display === 'none') continue; const r = e.getBoundingClientRect(); if (r.height > 0) top = Math.min(top, r.top); }
  ctlTopC = { t: now, v: Math.max(H * 0.6, top - 6) }; return ctlTopC.v; }
// f5.7i (QA f5.7g P1, owner): phones fly the upper stage full screen with its HUD cluster; the booster is a picture-in-picture top-left
const pipRect = () => { const W = innerWidth, H = innerHeight, sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0, w = Math.round(Math.min(W * 0.42, H * 0.48, 480)); return { x: TOUCH ? 10 : 12, y: (splitPortrait() ? 64 : TOUCH ? 60 : 64) + sat, w, h: Math.round(w * 0.75) }; }; // f5.8i (QA f5.8h P2): one 4:3 booster inset at every size
function paneRect(i = 0, nb = 1) { if (nb === 1) return pipRect(); const W = innerWidth, H = innerHeight, Hc = ctlTop(); // f4.2: a heavy's two boosters: stacked on the right (landscape) or rows 2-3 (portrait)
  if (nb > 1) return splitPortrait() ? { x: 0, y: Hc / 3 * (i + 1), w: W, h: Hc / 3 } : { x: W * 0.5, y: H * 0.5 * i, w: W * 0.5, h: H * 0.5 };
  return splitPortrait() ? { x: 0, y: H * 0.5, w: W, h: H - H * 0.5, sh: Hc - H * 0.5 } : { x: W * 0.5, y: 0, w: W * 0.5, h: H }; } // f5.6h (QA P2): no dead strip under the panes; sh = where its bottom strip ends (above the thumb controls)
function updateSplit(rdt) {
  const b = booster, flyA = b && b.state === 'flying' && b.mesh && b.mesh.visible !== false, flying = flyA || !!(booster2 && booster2.state === 'flying');
  if (flyA) { split.rec.push({ r: b.r.slice(), dir: b.dir.slice(), thr: b.thrust, n: b.n }); if (split.rec.length > 900) split.rec.shift(); split.done = 0; }
  const want = split.enabled && !split.closed && state === 'flight' && $('end').classList.contains('hidden') && /* f4.2: the end card replaces the split */ camMode !== 'map' && F.body === 'earth' && !photoOn && !replay && !F.flags.dead && b && (flying || split.done < 6);
  if (!flying && b && split.on && b.state !== 'flying' && !(booster2 && booster2.state === 'flying')) /* f5.7e: landed OR crashed/lost (NG burn-up) closes the pane */ { split.replay = null; const nw = performance.now(); if (!split.landT) split.landT = nw; split.done = nw - split.landT > 1200 ? 99 : 0.01; } // f5.7e: wall-clock (slow frames kept the landed pane up on desktop) // f5.6x (QA f5.6w P1): a landed booster closes its pane (back to single view; the BOOSTER LANDED toast says it) — no replay, no sideways landed framing
  else if (!flying && b && split.on) { // lost: hold, then a slow replay of the last seconds, then close
    if (!split.done && split.rec.length > 30) split.replay = { i: Math.max(0, split.rec.length - 240), k: 0 };
    split.done += rdt;
  }
  document.body.classList.toggle('splitOn', !!want); placeTopStack(!!(want && split.full !== 'b')); { const nw = performance.now(); if (!(nw - (guardToasts.t || 0) < 150)) { guardToasts.t = nw; try { guardToasts(); } catch (e) { } } } // fx-1: the one toast line never covers a telemetry card // f5.3: focused halves keep the split HUD (own card, no shared strip)
  if (want !== split.on && !want) for (const id of ['relBtn', 'gcamBtn']) { const el = $(id); if (el && el.dataset.spPin) { for (const k of ['top', 'bottom', 'left', 'right']) el.style.removeProperty(k); delete el.dataset.spPin; } } // f5.6h: unpin when the split closes
  if (flying) split.landT = 0;
  if (!want) document.body.classList.remove('pip');
  if (want !== split.on) { split.on = want; $('split').classList.toggle('hidden', !want); if (!want && camMode !== 'map') { split.full = null; if (camMode === 'booster' && !(b && b.state === 'flying')) camMode = 'chase'; split.replay = null; } }
  if (!split.on) return;
  const nb = 1, R2 = paneRect(0, nb), fb = split.full === 'b'; // f5.6e (QA): two panes max on every screen (Heavy's 2nd booster has no pane)
  $('split').classList.toggle('portrait', splitPortrait()); $('split').classList.toggle('pipM', true); document.body.classList.toggle('pip', split.full !== 'b'); /* f5.7m (QA f5.7j P1): Heron Heavy uses the same inset */  // f5.6u (QA P1): at orbit the phone's upper pane drops its empty card + label
 $('split').classList.toggle('fullB', fb); $('split').classList.toggle('fullU', split.full === 'u'); $('split').classList.toggle('tri', nb > 1);
  { const p2 = $('spPane2'), on2 = nb > 1 && !fb; p2.classList.toggle('hidden', !on2); if (on2) { const r3 = paneRect(1, nb), s2 = p2.style; s2.left = r3.x + 'px'; s2.top = r3.y + 'px'; s2.width = r3.w + 'px'; s2.height = r3.h + 'px'; } }
  layoutSplitCards(nb, fb);
  const st = $('spPane').style; if (fb) { st.left = '0'; st.top = '0'; st.width = '100%'; st.height = '100%'; } else { st.left = R2.x + 'px'; st.top = R2.y + 'px'; st.width = R2.w + 'px'; st.height = R2.h + 'px'; }
  split.frame++; if (b) { // f4.1b: every frame (was every 6th — at low fps the cards lagged by seconds)
    const card = (b, label, hud, ball, rp) => { const bh = V.len(b.r) - R, bu = V.norm(b.r), bva = P.airVel(b, b.r, b.v), vs = V.dot(bva, bu);
      const bf = b.stages[0], bs = V.len(bva), bPh = rp ? '⟲ REPLAY' : b.state === 'landed' ? '✔ LANDED' : b.state !== 'flying' ? '✘ LOST' : b.manual ? '🎮 YOU' : 'AUTO · ' + apPill(b.phase);
      spStrip(hud, label.replace(' · ', ' '), bPh.replace('AUTO · ', ''), /BURN|LANDING/.test(bPh), bs, bh, b, 0, false, b.state === 'landed');
      { const cv = $(ball); if (cv) { const ld = b.state !== 'flying'; if (ld) cv.style.visibility = 'hidden'; else miniBall(cv, b.dir, b.r, bva, b.holdDir && b.manual ? b.holdDir : null); } } }; // f5.7e (QA f5.7c P2): a landed booster has no attitude to show (the '- -' ball on a blocky backdrop)
    const bLab = (i, lz) => { const k = 'AB'[i]; return TOUCH ? 'BOOSTER ' + k : 'BOOSTER ' + k + ' · ' + (lz || 'LZ-' + (i + 1)); }; // f5.6u (QA P1): phones drop the pad name (it clipped)
    card(b, booster2 ? bLab(0, b.lzName) : 'BOOSTER',
      'spHud', 'spBallB', !!split.replay);
    if (booster2) card(booster2,
      bLab(1, booster2.lzName),
      'spHud2', 'spBallB2', false);
    const uu = V.norm(v.r), uva = P.airVel(v, v.r, v.v), uvs = V.dot(v.v, uu), us = v.stages[v.cur], ufp = us && us.fuelMax ? Math.round(100 * us.fuel / us.fuelMax) : 0;
    const uPh = v.auto || F.autoOn ? 'AUTO · ' + ({ ascent: 'ASCENT', coast: 'COAST TO AP', circ: 'ORBIT INSERTION', done: 'IN ORBIT' }[v.guid] || 'ON') : F.flyingBooster() ? 'COASTING · NO PILOT' : '🎮 YOU'; // f5.6c: who is in control
    spStrip('spHud1', 'UPPER', uPh.replace('AUTO · ', ''), v.thrust > 0, P.altOf(v) > 80000 ? V.len(v.v) : V.len(uva), P.altOf(v), v, v.cur, true);
    miniBall($('spBallU'), P.noseOf(v), v.r, P.altOf(v) > 80000 ? v.v : uva, v.holdAtt && v.sas === 'stab' && !v.steerDir ? v.holdAtt.n : null);
  }
}
// f5.3 (owner): identical layout in every half: the card (navball + telemetry) sits at the pane's top-left under one
// button row, the pane buttons at its top-right. Positions are set here (viewport px) so every pane uses one rule.
function upperRect(nb) { const W = innerWidth, H = innerHeight; if (split.full === 'u') return { x: 0, y: 0, w: W, h: H };
  if (nb === 1) return splitPortrait() ? { x: 0, y: 0, w: W, h: H, sh: ctlTop() } : { x: 0, y: 0, w: W - 150, h: H }; // f5.7i: the upper stage owns the screen; its strip ends above (portrait) / left of (landscape) the AUTO/STAGE cluster
  return splitPortrait() ? { x: 0, y: 0, w: W, h: nb > 1 ? ctlTop() / 3 : H * 0.5 } : { x: 0, y: 0, w: W * 0.5, h: H }; }
const SP_INSET = 58;
function placeIn(el, r, corner) { if (!el) return; const s = el.style, sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  s.setProperty('position', 'fixed', 'important'); s.setProperty('bottom', 'auto', 'important');
  if (corner === 'strip') { s.setProperty('left', r.x + 'px', 'important'); s.setProperty('right', 'auto', 'important'); s.setProperty('width', r.w + 'px', 'important'); s.setProperty('top', 'auto', 'important'); const gap = r.sh ? Math.max(0, Math.round(r.h - r.sh)) : 0; s.setProperty('bottom', Math.round(innerHeight - r.y - r.h) + 'px', 'important'); s.setProperty('padding-bottom', (8 + gap) + 'px', 'important'); return; } // f5.6x (QA f5.6w P1): the strip's dark band runs to the pane's bottom (no dead strip behind the thumb controls); its text stays above them // f5.6h: bottom strip spans its pane
  if (corner === 'card') { s.setProperty('left', (r.x + 10) + 'px', 'important'); s.setProperty('right', 'auto', 'important'); s.setProperty('top', (r.y + SP_INSET + (r.y < 1 && r.w < innerWidth - 2 ? 56 : 0) + (r.y < 1 ? sat : 0)) + 'px', 'important'); } // f5.6c: same spot in every half, under the top bar + pane buttons
  else { const under = r.y < 1 ? 56 : 0; /* f5.6h: full-width panes too (portrait ⤢ sat under ☰) */ /* f5.6c: right-edge pane buttons sit under the top bar, never behind it */ s.setProperty('left', 'auto', 'important'); s.setProperty('right', (innerWidth - r.x - r.w + 10) + 'px', 'important'); s.setProperty('top', (r.y + 10 + under + (r.y < 1 ? sat : 0)) + 'px', 'important'); } }
function layoutSplitCards(nb, fb) {
  const full = { x: 0, y: 0, w: innerWidth, h: innerHeight }, rb = fb ? full : paneRect(0, nb);
  placeIn($('spCardU'), upperRect(nb), 'strip'); placeIn($('spBtnsU'), upperRect(nb), 'btns');
  placeIn($('spCardB'), rb, 'strip'); const pb = document.querySelector('#spPane .spBtns'); placeIn(pb, rb, 'btns');
  if (fb && splitPortrait() && pb) { const cb = $('spCardB').getBoundingClientRect(); pb.style.setProperty('right', 'auto', 'important'); pb.style.setProperty('left', '10px', 'important'); pb.style.setProperty('top', Math.round(cb.bottom + 8) + 'px', 'important'); } // f5.3: focused on a phone, the pane buttons sit under the card, clear of the top bar's ☰
  // f5.3: in portrait split, RELEASE (worker A) and GROUND sit at the bottom of the upper half, clear of the booster pane and its card
  const ur = upperRect(nb), pinBottom = (el, side) => { if (!el) return; const st = el.style; if (!(!fb && split.full !== 'u')) { /* f5.6h (QA P2): landscape too: RELEASE / GROUND belong to the upper pane */ if (el.dataset.spPin) { for (const k of ['top', 'bottom', 'left', 'right']) st.removeProperty(k); delete el.dataset.spPin; } return; }
    el.dataset.spPin = '1'; st.setProperty('top', Math.round(ur.y + ur.h - el.offsetHeight - 10 - (($('spCardU') || {}).offsetHeight || 0)) + 'px', 'important'); /* f5.6h: above the upper strip */ st.setProperty('bottom', 'auto', 'important');
    st.setProperty(side, (side === 'left' ? ur.x + 10 : innerWidth - ur.x - ur.w + 10) + 'px', 'important'); st.setProperty(side === 'left' ? 'right' : 'left', 'auto', 'important'); };
  if (false) pinBottom($('gcamBtn'), 'right'); // f5.7j: hidden in the inset layout // f5.7e (QA f5.7c P1): RELEASE is no longer pinned into the split; it has one fixed spot (style.css)
  if (nb > 1) placeIn($('spCardB2'), paneRect(1, nb), 'strip');
}
// f5.6h (owner): each split half gets the same bottom strip: a simple navball centered, mph + altitude on its left,
// Ap / Pe with their T-times and Δv (ft/s) on its right. Nothing sits in the middle of a pane, so the craft stays clear.
function spStrip(id, label, ph, hot, mps, alt, c, cur, upper, landed) { let o = null, tAp = NaN, tPe = NaN; try { o = P.orbitOf(c); tAp = P.timeToApV(c); tPe = C.timeToPe(c.r, c.v, P.muOf(c)); } catch (e) { }
  const pad = upper && (v.clamped || !F.ignited), ap = o ? apsisLine('ap', o, tAp, SIM_SPEED, pad) : { lab: 'Ap', h: '—', t: '' }, pe = o ? apsisLine('pe', o, tPe, SIM_SPEED, pad) : { lab: 'Pe', h: '—', t: '' };
  if (landed) { setHTML(id, `<div class="spT"><b>${label}</b></div>`); setHTML(id + 'R', '<div class="spLand"><b>✔ LANDED</b></div>'); return; } // f5.6z (QA f5.6x): one LANDED, no 0 mph / ALT 0 ft // f5.6u (QA P1): a landed booster has no Ap/Δv worth reading
  setHTML(id, `<div class="spT"><b>${label}</b><span class="pill ${hot ? 'hot' : ''}">${ph}</span></div><div><b>${fmtMph(mps)}</b></div><div><span>ALT</span> <b>${fmtHeight(alt)}</b></div>`);
  setHTML(id + 'R', `<div><span>Ap</span> <b>${ap.h}</b> <i>${ap.t}</i></div><div><span>Pe</span> <b>${pe.h}</b> <i>${pe.t}</i></div><div><span>Δv</span> <b>${craftDvOf(c, cur)}</b></div>`); }
const apPill = ph => { const p = (ph || '').toLowerCase(); return /boost/.test(p) ? 'BOOSTBACK' : /entry/.test(p) ? 'ENTRY BURN' : /landing|controlled/.test(p) ? 'LANDING BURN' : /glide|fin/.test(p) ? 'GRID-FIN GLIDE' : /touch/.test(p) ? 'TOUCHDOWN' : /coast/.test(p) ? 'COAST' : (ph || 'AUTO').toUpperCase(); };
// f4 mini navball: sky/ground split by the nose pitch, roll-free; prograde marker from the velocity
function miniBall(cv, dir, r, vel, ghost = null) {
  if (!cv) return; { const ok = !!(dir && r && vel && dir.every(Number.isFinite) && V.len(vel) > 5); cv.style.visibility = ok ? '' : 'hidden'; if (!ok) return; } /* f5.7i (QA f5.7g P2): no blank '- -' ball without attitude/velocity data */ const c = cv.getContext('2d'), W = cv.width, H = cv.height, R0 = W / 2 - 2, up = V.norm(r), e = P.eastOf(r), n = V.cross(up, e);
  const pit = Math.asin(Math.max(-1, Math.min(1, V.dot(dir, up)))), hy = Math.max(-1, Math.min(1, pit / (Math.PI / 2))) * R0; // f4.1: nose up = horizon drops = more sky (local horizon from r)
  c.clearRect(0, 0, W, H); c.save(); c.beginPath(); c.arc(W / 2, H / 2, R0, 0, 7); c.clip();
  c.fillStyle = '#3d7bd6'; c.fillRect(0, 0, W, H); c.fillStyle = '#8a5a2b'; c.fillRect(0, H / 2 + hy, W, H);
  c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, H / 2 + hy); c.lineTo(W, H / 2 + hy); c.stroke();
  const sp = V.len(vel); if (sp > 5) { const vd = V.scale(vel, 1 / sp), vp = Math.asin(Math.max(-1, Math.min(1, V.dot(vd, up)))), hd = Math.atan2(V.dot(vd, e), V.dot(vd, n)), nd = Math.atan2(V.dot(dir, e), V.dot(dir, n));
    const px = W / 2 + Math.max(-1, Math.min(1, (hd - nd) / 1.2)) * R0 * 0.8, py = H / 2 + (pit - vp) / (Math.PI / 2) * R0;
    c.strokeStyle = '#ffe14d'; c.lineWidth = 2; c.beginPath(); c.arc(px, py, 5, 0, 7); c.stroke(); }
  if (ghost && Math.acos(Math.max(-1, Math.min(1, V.dot(ghost, dir)))) > 0.017) { const gp = Math.asin(Math.max(-1, Math.min(1, V.dot(ghost, up)))), gh = Math.atan2(V.dot(ghost, e), V.dot(ghost, n)), nd = Math.atan2(V.dot(dir, e), V.dot(dir, n)); let dh = gh - nd; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; // f5.6h: ghost of the trackball target
    const gx = W / 2 + Math.max(-1, Math.min(1, dh / 1.2)) * R0 * 0.8, gy = H / 2 - Math.max(-1, Math.min(1, (gp - pit) / (Math.PI / 2))) * R0; c.setLineDash([4, 3]); c.strokeStyle = '#ffffffe0'; c.lineWidth = 2; c.beginPath(); c.moveTo(gx - 12, gy); c.lineTo(gx - 4, gy); c.moveTo(gx + 4, gy); c.lineTo(gx + 12, gy); c.stroke(); c.beginPath(); c.arc(gx, gy, 4, 0, 7); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = '#ffffff70'; c.lineWidth = 1; for (const dg of [-60, -30, 30, 60]) { const yy = H / 2 + hy - dg / 90 * R0; c.beginPath(); c.moveTo(W / 2 - R0 * 0.3, yy); c.lineTo(W / 2 + R0 * 0.3, yy); c.stroke(); } // f5.7j (QA f5.7i P1): a pitch ladder, so a steep ball is never one flat colour
  c.restore(); c.strokeStyle = '#ffd23a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(W / 2 - 14, H / 2 + 6); c.lineTo(W / 2, H / 2 - 4); c.lineTo(W / 2 + 14, H / 2 + 6); c.stroke(); // the nose chevron (was a bare '- -')
  { const pd = Math.round(pit * 57.2958), t = (pd > 0 ? '+' : pd < 0 ? '−' : '') + Math.abs(pd) + '°'; c.font = `700 ${Math.round(W * 0.2)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = '#000a'; c.strokeText(t, W / 2, H / 2 + 10); c.fillStyle = '#fff'; c.fillText(t, W / 2, H / 2 + 10); }
  c.strokeStyle = '#9cc3ff88'; c.beginPath(); c.arc(W / 2, H / 2, R0, 0, 7); c.stroke();
}
function renderSplit(O) {
  const son = !!(split.on && booster); if (document.body.classList.contains('splitOn') !== son) document.body.classList.toggle('splitOn', son); // f4.1: class follows what is drawn
  if (!son || split.full) return; // f5.3: a focused half draws full screen through the main camera
  const bs = splitBs().slice(0, 1); for (let i = 0; i < bs.length; i++) renderPane(bs[i], O, paneRect(i, 1), i); // f5.6e: two panes max
}
// f4.2: the booster panes in split (1, or 2 for a heavy's side pair). Each has its own camera, render target and
// composite quad. The camera's up vector is the booster's local radial, eased like the main camera, so the horizon
// stays level and the ground stays below whatever the booster does (flip, boostback, entry, landing).
const paneSlots = [];
function renderPane(b, O, R2, i) {
  const S = paneSlots[i] || (paneSlots[i] = { cam: i ? new THREE.PerspectiveCamera(55, 1, 0.5, 2e9) : cam2, up: null, look: null, t: 0 });
  const cam = S.cam; let br = b.r, bd = b.dir;
  if (split.replay && i === 0) { const rp = split.replay; rp.k += 0.5; const f = split.rec[Math.min(split.rec.length - 1, rp.i + Math.floor(rp.k))]; if (f) { br = f.r; bd = f.dir; setRel(b.mesh, br, O); dirQ(b.mesh, bd); b.mesh.userData.plume.visible = f.thr > 0.01; } }
  const up = V.norm(br); let e = P.eastOf(br), n = V.cross(up, e);
  { const vh = V.sub(b.v, V.scale(up, V.dot(b.v, up))), hs = V.len(vh); if (S.b !== b) { S.b = b; S.f = null; } if (hs > 20 && !S.f) S.f = V.scale(vh, 1 / hs); /* f5.6f (QA cam): heading captured once at separation; no swing at boostback */ if (S.f) { n = S.f; e = V.cross(n, up); } } // f5.3: frame relative to the booster's heading (eased), no slow auto spin
  const landed = b.state !== 'flying', pz = landed ? Math.max(0.18, split.pitch) : split.pitch; // f4.1: never under the ground
  if (landed) bd = up; // the landed booster stands up: frame its middle, camera upright
  const lift = landed ? 20 : 0, tx = br[0] - O[0] + up[0] * lift, ty = br[1] - O[1] + up[1] * lift, tz = br[2] - O[2] + up[2] * lift, d = split.dist / 90 * boosterFrameDist(b, R2), cp = Math.cos(pz), yaw = split.yaw + (i ? 0.35 : 0);
  const off = V.add(V.add(V.scale(n, Math.cos(yaw) * d * cp), V.scale(e, Math.sin(yaw) * d * cp)), V.scale(up, d * Math.sin(pz)));
  const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (S.t || now)) / 1000)); S.t = now; const kE = 1 - Math.exp(-dt * 4); // same 4/s easing as the chase camera
  const lk = landed ? [0, 0, 0] : V.scale(bd, 15); S.look = S.look ? V.add(S.look, V.scale(V.sub(lk, S.look), kE)) : lk; S.up = S.up ? V.norm(V.add(S.up, V.scale(V.sub(up, S.up), kE))) : up;
  cam.position.set(tx + off[0], ty + off[1], tz + off[2]); cam.up.set(S.up[0], S.up[1], S.up[2]); cam.lookAt(tx + S.look[0], ty + S.look[1], tz + S.look[2]);
  cam.aspect = R2.w / R2.h; cam.far = camera.far; cam.updateProjectionMatrix();
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
// f5.3: the booster fills ~45 % of the pane's short side whatever its length or the pane shape (phone panes are short)
function boosterFrameDist(b, R2) { let L = 40; try { L = Math.max(10, P.stackGeom(b).L || 40); } catch (e) { } return L * 2.14 * R2.h / Math.max(60, Math.min(R2.w, R2.h)); }
// f5.3 (owner): ground spectator camera in AUTO: a fixed tripod ~2 km south-west of the pad, a few metres up, that tracks
// the climbing rocket and zooms (narrows the field of view) so the rocket stays ~1/4 of the screen tall.
const GCAM = { on: false, fov0: 55 };
function groundCam(O, th, base, nose, rdt) {
  const low = !!F && F.alt < 150000 && !F.flags.orbit; // f5.4 (QA G/#8): a tripod can't follow a rocket into orbit (empty sky): off above 150 km
  if (GCAM.on && F && !low) GCAM.on = false;
  const want = GCAM.on && state === 'flight' && !!F && F.autoOn && camMode === 'chase' && F.body === 'earth' && !photoOn && low;
  const b = $('gcamBtn'); if (b) { b.classList.toggle('hidden', !(state === 'flight' && F && F.autoOn && F.body === 'earth' && low)); b.classList.toggle('on', want); }
  if (!want) { if (GCAM.act) { GCAM.act = false; camera.fov = GCAM.fov0; camera.updateProjectionMatrix(); } return; }
  if (!GCAM.act) { GCAM.act = true; GCAM.fov0 = camera.fov; }
  const ef = (v.site && v.site.ef) || [1, 0, 0], e0 = P.eastOf(ef), n0 = V.cross(ef, e0);
  const g = V.add(V.add(V.scale(ef, R + 6), V.scale(n0, -1700)), V.scale(e0, -900)), gw = V.rotZ(g, th);
  const L = stackL() || 40, aim = V.add(base, V.scale(nose, L * 0.5)), rel = V.sub(aim, gw), dist = V.len(rel);
  camera.position.set(gw[0] - O[0], gw[1] - O[1], gw[2] - O[2]); const up = V.norm(gw); camera.up.set(up[0], up[1], up[2]);
  camera.lookAt(aim[0] - O[0], aim[1] - O[1], aim[2] - O[2]);
  const fov = Math.max(0.05, Math.min(50, 2 * Math.atan(L * 1.6 / dist) * 180 / Math.PI)); // rocket ≈ 1/3 of the view height
  camera.fov = fov; camera.updateProjectionMatrix(); // no easing: slow frames must not leave the rocket a dot
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-gcam]'); if (!b) return; const g = $('gcamBtn'); if (g) g.click(); const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); try { mobile.closeMenu(); } catch (er) { } }); // f5.8i: 🎥 Ground cam from ☰
{ const gb = document.createElement('button'); gb.id = 'gcamBtn'; gb.className = 'hidden'; gb.title = 'Ground camera: watch from beside the pad'; gb.textContent = '🎥 GROUND';
  gb.onclick = e => { e.stopPropagation(); e.currentTarget.blur(); GCAM.on = !GCAM.on; if (GCAM.on) { if (split.on) split.full = 'u'; camMode = 'chase'; } toast(GCAM.on ? 'Ground camera: watching from beside the pad' : 'Chase camera', '#9cc3ff'); };
  document.body.appendChild(gb); }
const splitBs = () => [booster, booster2].filter(x => x && x.mesh && (x.state === 'flying' || x.state === 'landed' || x === booster));
// ---------- gx1: sun, sky, scattering, eclipse, plume light; cinematic shake and staging drama ----------
scene.fog = new THREE.FogExp2(0x9cc4ec, 2e-5); const cHaze = new THREE.Color(0xdde8f4);
const skyC = new THREE.Color(), cSky = new THREE.Color(0x3d7fe0), cHor = new THREE.Color(0xff8a3c), cNight = new THREE.Color(0x02040a);
const AIR = { earth: 1, mars: 0.35, venus: 2.5, titan: 1.4 };
// f5.4e: day / dusk sky colours of worlds with air (airless worlds stay black through skyAlt)
const BODY_SKY = { mars: [new THREE.Color(0xc9927a), new THREE.Color(0x6a8fc0)], venus: [new THREE.Color(0xd8b66e), new THREE.Color(0xb07a30)] };
{ const hz = Object.values(P.BODIES).find(b => b.parent === 'saturn' && b.atm); if (hz) BODY_SKY[hz.id] = [new THREE.Color(0xc89a4a), new THREE.Color(0x8a5a20)]; }
function skyAlt(h) { // altitude that drives sky colour + haze: real altitude where there is air, "deep space" otherwise
  const b = F && F.body || 'earth'; if (b === 'earth') return h;
  if (!AIR[b]) return 1e9; const a = F.alt; return isFinite(a) ? Math.max(0, a / AIR[b]) : 1e9;
}
const SUN_DAY = params.get('sun') === 'day' ? 'all' : (() => { try { return localStorage.getItem('or_daylight') !== '0' ? 'offworld' : ''; } catch (e) { return 'offworld'; } })(); // sandbox off-world sites start in daylight unless or_daylight=0
function updateSun(O, U, h, k, isMap) {
  let sd = P.sunDir(F && F.body || 'earth', F.tAbs);
  // flight-ground-3: ?sun=day (tests/shots) or the sandbox 'daylight' setting for off-world sites keeps the Sun ~35° up at the site
  // (from the site's east-south side), so a launch never starts in the dark. The real ephemeris Sun is used otherwise.
  if (SUN_DAY === 'all' || (SUN_DAY === 'offworld' && F && F.body && F.body !== 'earth')) { if (!updateSun.up || (F && F.alt < 200)) updateSun.up = [U.x, U.y, U.z];
    const u = updateSun.up, ax = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], e = V.norm(V.cross(ax, u)), s35 = Math.sin(0.61), c35 = Math.cos(0.61); sd = V.norm([u[0] * s35 + e[0] * c35 + sd[0] * 0.15, u[1] * s35 + e[1] * c35 + sd[1] * 0.15, u[2] * s35 + e[2] * c35 + sd[2] * 0.15]); }
  sunDirV.set(sd[0], sd[1], sd[2]); // flight-ground-2: each world's flight frame is its own (flight.js transfer), so light it with its own Sun direction (was always Earth's)
  sunL.position.copy(sunDirV); sunPos.value.copy(sunDirV).multiplyScalar(1e11);
  // eclipse: does the ray from the craft toward the Sun hit the Earth? (soft edge ~ the atmosphere's thickness)
  const cx = -O[0], cy = -O[1], cz = -O[2], tca = cx * sd[0] + cy * sd[1] + cz * sd[2], d2 = cx * cx + cy * cy + cz * cz - tca * tca;
  const shadow = F && F.body && F.body !== 'earth' ? 0 : tca > 0 ? Math.min(1, Math.max(0, (R + 30000 - Math.sqrt(Math.max(0, d2))) / 60000)) : 0, sunK = 1 - shadow;
  const el = U.x * sd[0] + U.y * sd[1] + U.z * sd[2], tw = F && F.body && BODY_SKY[F.body] ? 0.22 : 0.08 /* dusty air: long twilight skylight */, day = Math.min(1, Math.max(0, (el + tw) / (0.17 + tw))), dusk = Math.max(0, 1 - Math.abs(el - 0.02) / 0.18) * (1 - k);
  siteNight(Math.asin(Math.max(-1, Math.min(1, el))) * 180 / Math.PI); // f5.4j: the craft sits at the site, so its local sun is the site's
  const bs = F && F.body && F.body !== 'earth' ? BODY_SKY[F.body] : null, hs0 = bs && state !== 'flight'; // f5.4e: the sky follows the world; Home shows it in daylight
  skyC.copy(cNight).lerp(bs ? bs[0] : cSky, hs0 ? 1 : day).lerp(bs ? bs[1] : cHor, hs0 ? 0 : dusk * 0.55).multiplyScalar(1 - k);
  scene.background = isMap ? skyC.setRGB(0, 0, 0.01) : skyC;
  if (window.__bake && rocketG) { { const m = location.search.match(/[?&]bakeS=([\d.]+)/); if (m) rocketG.scale.setScalar(+m[1]); } scene.background = BAKE_C; scene.fog.density = 0; for (const c of scene.children) if (!c.isLight) c.visible = c === rocketG; } // f5.8b: thumbnail bake (?bake) — rocket only on a flat key backdrop
  // aerial perspective near the ground: exponential haze in the sky colour, thinning with altitude
  scene.fog.color.copy(skyC).lerp(cHaze, 0.35 * day); scene.fog.density = isMap ? 0 : 2.2e-5 * Math.exp(-h / 4500) * (h < 40000 ? 1 : 0); // f4.1: high up the camera looks down through thin air (no grey slab at 22 km)
  sunL.intensity = 3.0 * sunK; sunL.color.setRGB(1, 0.85 + 0.15 * (1 - dusk), 0.7 + 0.3 * (1 - dusk));
  const nightFill = F && F.body === 'moon' ? 0.9 : F && F.body === 'mars' ? 0.7 : 0.25; /* flight-ground-2: earthshine (Moon) / dusty skylight (Mars) keep a night site readable */
  hemi.intensity = (nightFill + (1 - nightFill) * day) * (1 - k * 0.75); hemi.groundColor.set(F && F.body === 'mars' ? 0x5a3424 : F && F.body === 'moon' ? 0x3a3a3a : 0x334433); hemi.color.set(F && F.body === 'mars' ? 0xd8b090 : 0xcfe3ff); scene.environmentIntensity = (0.35 + 0.65 * day) * (1 - 0.6 * k) * (0.3 + 0.7 * sunK);
  { const fl = fillLight(day, k, sunK, TOUCH); hemi.intensity = Math.max(hemi.intensity, fl.hemi); scene.environmentIntensity = Math.max(scene.environmentIntensity, fl.env); } // fx-1 fill floor kept on top of flight-ground-2's per-world fill
  sunSprite.visible = !isMap && sunK > 0.02; sunSprite.position.copy(camera.position).addScaledVector(sunDirV, 5e7); sunSprite.scale.setScalar(5e7 * (0.12 + 0.1 * k) * (TOUCH ? 0.55 : 0.75)); sunSprite.material.opacity = sunK * (TOUCH ? 0.4 : 0.6); // f5.7e (QA f5.7c P2): softer sun glare (the starburst filled the phone's top third)
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
function ignitionClouds(veh) { if (thinAir()) return; // f5.4: no steam on airless worlds
 // ground steam/dust rolling out of the flame trench and across the pad
  const up = V.norm(veh.r), e = P.eastOf(veh.r), n = V.cross(up, e), base = V.sub(veh.r, V.scale(up, 2)), w = siteVel(veh);
  const N = QUALITY[fx.q].diamonds ? 36 : 18; // fx-1: lighter liftoff steam (was a pad-filling cloud)
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, sp = 25 + Math.random() * 45, dir = V.add(V.scale(e, Math.cos(a)), V.scale(n, Math.sin(a)));
    smoke.spawn(V.addS(base, dir, 6 + Math.random() * 8), V.add(w, V.add(V.scale(dir, sp), V.scale(up, 3 + Math.random() * 8))), 3.5 + Math.random() * 3, 5, 14 + Math.random() * 10, Math.random() < 0.7 ? 0xf2f2f0 : 0xc9bba4, null, 0.35); }
  shake(1.0, 2.5);
}
function touchdownDust(veh) { if (thinAir() && F.body === 'earth') return; // fx-2: a low ring of dust/steam blown out at touchdown
  const up = V.norm(veh.r), e = P.eastOf(veh.r), n = V.cross(up, e), base = V.sub(veh.r, V.scale(up, 1)), w = siteVel(veh), N = TOUCH ? 22 : 40;
  for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, sp = 14 + Math.random() * 22, dir = V.add(V.scale(e, Math.cos(a)), V.scale(n, Math.sin(a)));
    smoke.spawn(V.addS(base, dir, 3 + Math.random() * 4), V.add(w, V.add(V.scale(dir, sp), V.scale(up, 1 + Math.random() * 3))), 2.5 + Math.random() * 2.5, 3, 10 + Math.random() * 8, 0xd9cdb8, 0xb8a990, 0.3); }
  shake(0.4, 0.6); }
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
  startMission: id => startMission(id), startOp: id => startOp(id),  missionOf: id => missionOf(id), ops: () => opsList, opName: m => opName(m), vname: id => brandVName(id), career: () => { const st = careerUI.state, n = careerUI.next(), inLadder = new Set(LADDER_OPS());
    const extra = CAREER.flatMap(t => t.contracts.filter(id => id !== 'practice' && !inLadder.has(id)).map(id => ({ id, model: t.vehicleId })));
    return { cash: st.cash, sci: st.sci, done: Object.keys(st.done).length, of: LADDER.length, next: n ? rungLabel(n) : null, open: () => careerUI.show(true),
      extra, opLock: id => { const e = extra.find(x => x.id === id), sid = e && Object.keys(MODEL_OF).find(k => MODEL_OF[k] === e.model); return sid ? lockWhy('vehicles', sid) : null; } }; }, setPhoto: on => { photoOn = on; if (on) { camDist = Math.max(camDist, 60); } },
  snap: filter => { snapReq = { filter }; },
  tunnelGeom: mach => { const ab = aeroBalance(design, mach); if (!ab) return null; const vv = buildVehicle(design), g = P.stackGeom(vv); const COL = { engine: '#ff9a3c', tank: '#e8e8e8', pod: '#9cc3ff', payload: '#e0b84a', fins: '#555', decoupler: '#333', fairing: '#f4f4f4', shield: '#7a4a2a', chute: '#ff7a3c', rcs: '#8a9099' };
    return { parts: g.list.map(e => ({ y: e.y, h: e.h, d: e.kind === 'fins' ? (e.d || 2) * 1.8 : e.d, col: COL[e.kind] || '#ccc' })), L: g.L, ycom: ab.ycom, ycp: ab.ycp, stable: ab.stable, margin: ab.margin }; },
});
const cx = createCompact({ touch: TOUCH, press: k => press(k), menuState: () => ({ fleet: !!(F && F.fleet && F.fleet.list.length > 1 && F.ignited), booster: !!(F && F.booster && F.booster.state === 'flying'), ret: !!(F && F.ret), chute: hasChutes(), canHome: !!(F && F.ignited && F.alt < 1000) /* f5.7k: Return to pad only below ~1 km */ }), onSpeedTap: () => fun.cycleSpeed(), onMarkers: on => setMarkers(on), onEngTap: () => { mobile.sheet = !document.body.classList.contains('sheet'); document.body.classList.toggle('sheet', mobile.sheet); } });
{ const dm = document.getElementById('dMap'); if (dm) dm.onclick = e => { e.currentTarget.blur(); press('KeyM'); }; }
{ // top-centre stack: callout, hint, toasts never overlap each other
  const st = document.createElement('div'); st.id = 'topStack'; document.body.appendChild(st);
  for (const id of ['hint', 'toasts', 'callout']) { const e = document.getElementById(id); if (e) st.appendChild(e); } }
// f4: recovery missions (missions/*.js) run through the shared runner session; S.task drives a compact HUD prompt
const opsReady = loadMissions().then(l => { opsList = l; return l; }).catch(e => console.warn('[Orbit Rush] missions', e));
loadBrand().then(() => applyBrandDom()).catch(() => {});
// career (PR #9): money / reputation / unlocks, saved in localStorage via the campaign save module
let lastOp = null;
const LADDER_OPS = () => LADDER.filter(c => c.how === 'op').map(c => c.op);
function ctxCareerLock(id) { if (LADDER_OPS().includes(id)) { const c = LADDER.find(x => x.op === id); return careerUI.state.done[c.id] || !careerUI.locked('missions', id) ? null : lockWhy('missions', id); }
  const t = CAREER.find(x => x.contracts.includes(id)), sid = t && Object.keys(MODEL_OF).find(k => MODEL_OF[k] === t.vehicleId); return sid ? lockWhy('vehicles', sid) : null; }
function startOp(contractId, viaLadder) {
  const mid = missionOf(contractId); let m = opsList.find(x => x.id === mid);
  if (!m && !opsList.length) { fun.call('⏳', 'Loading the contract…', '#9cc3ff'); opsReady.then(() => { if (opsList.length) startOp(contractId, viaLadder); }); return; } // QA f5a.2: never drop into Build while missions load
  if (!m) return; lastOp = null;
  if (!viaLadder) { const why = ctxCareerLock(contractId); if (why) { fun.call('🔒', why, '#ffb35c'); return; } } // f5b: one career, gated by the ladder
  opContract = contractId; opHooks = missionHooks(m, () => F); opFlightOpts = missionFlightOpts(m);
  setDesign(missionDesign(m)); launch(); opFlightOpts = null; applyMission(m, F); opSess = missionSession(m).attach(F);
  try { if (!F.ignited) F.stagePress(); F.setAuto(true, true); } catch (e) { } // f5a.2: the toast promises AUTO, so ignite on AUTO like the fly rungs
  fun.call('🎯', opName(m) + ' — AUTO flies the ascent; follow the prompts on orbit', '#ffe9b0', true);
}
function opEnd(why) {
  const S = opSess; if (!S || S._shown) return; S._shown = 1;
  const r = evalOp(S.m, F, S), ok = r.objectives.filter(o => o.pass).length; lastOp = { id: S.m.id, ok: !!r.complete };
  let line = `${opName(S.m)}: ${ok}/${r.objectives.length} objectives · score ${r.score.toLocaleString()}`;
  fun.call(r.complete ? '🏆' : '⚠️', line, r.complete ? '#7dffa6' : '#ffb35c', true); opSess = null; opHooks = null;
  if (F.setExec) try { F.setExec(false); } catch (e) { }
  later(() => { if (!F.ended) showEnd(); }, 1500); // QA f5a.2: finishing the contract records it on the ladder (recordFlight reads lastOp) and shows the card
}
function opTick() {
  const S = opSess, el = document.getElementById('opTask'); if (!S) { if (el) el.hidden = true; return; }
  S.tick(F);
  const tk = S.task; if (tk && tk.kind === 'execute-node' && F.flags.orbit && F.nodes.length && !F.exec && F.setExec) F.setExec(true); // QA f5a.2: career ops fly their nodes on AUTO (the toast promises it)
  if (el && !S.task && !S.done && !S.failed) { el.hidden = false; if (F.flags.orbit && !F.nodes.length) el.hidden = true; else el.innerHTML = `<b>▶</b> ${F.flags.orbit ? 'Next burn' : 'Climb to orbit'} <small>AUTO</small>`; } // f5.3 (QA P3): no 'Lining up' text without a node // QA f5b.3: the contract task shows from liftoff (never a blank gap)
  else if (el) { const t = S.task; el.hidden = !t; if (t) el.innerHTML = t.kind === 'execute-node' ? `<b>▶ Burn ${t.burn}${t.of ? '/' + t.of : ''}</b> ${t.label} <small>${F.nodes.length ? (F.exec ? 'AUTO burns' : TOUCH ? 'MAP ▸ ◆ Node ▸ ▶ Execute' : '9 / ◆ Execute') : ''}</small>` : `<b>▶</b> ${t.label || t.kind}`; }
  if (S.done || S.failed || F.flags.dead) opEnd();
}
function startMission(id, plan) { // f5.1h: no plan -> the mission card (choose a qualifying rocket, AUTO opt-in); never swaps the rocket
  if (!plan) return openMissionCard(id);
  opSess = null; const m = MISSIONS[id];
  setDesign(plan.design); launch(); director = plan.auto ? new Director(F, id, { say: msg => fun.call(m.icon, msg, '#ffe9b0') }) : null;
  if (!plan.auto) { try { F.setAuto(false, true); } catch (e) { } }
  fun.call(m.icon, m.name + ' — ' + autoNote(plan.auto, plan.design.name || 'rocket'), '#ffe9b0', true); camDist = 120; camYaw = 0.9; camPitch = 0.08;
}
const fmtPay = t => !(t > 0) ? '—' : t < 1 ? Math.round(t * 1000) + ' kg' : (t < 10 ? t.toFixed(1).replace(/\.0$/, '') : Math.round(t)) + ' t'; // f5.3: real-spec mission payload label
function houseRows() { const houses = []; for (const [h, ids] of Object.entries(HOUSE_SETS)) if (h !== 'originals') for (const mid of ids) { const b = pickBase(STAGE_KEYS[mid] || [], (ART[mid] && ART[mid].height) || 50); if (SHOW.some(x => x.id === b) && !specFor(mid)) houses.push({ model: mid, name: houseName(mid), base: b }); } return houses; }
const rowLocked = r => !!lockWhy('vehicles', r.base === 'booster-2' ? 'atlas' : r.base);
const curRocket = () => ({ name: design.name || 'Your rocket', model: pickModel || design.model || null, ok: validate(design).ok, sub: !!design.sub });
// f5.2 (QA f5.1h P1): one compact card for missions and career fly rungs. The player's rocket is kept when it qualifies;
// otherwise the recommended one is preselected with a visible line, and the player can tap back. Fly / AUTO are equal, neither preselected.
// f5.4: the unlocked starter orbiter (Needle) for cards where nothing unlocked qualifies
function starterRow() { const r = SHOW.find(x => x.id === 'needle'); return r && !rowLocked({ base: 'needle' }) ? { key: 'o:needle', name: r.name, base: 'needle', model: r.model || null } : null; }
function openRocketCard(title, ch, go) {
  let card = $('misCard'); if (!card) { card = document.createElement('div'); card.id = 'misCard'; document.body.appendChild(card); }
  // f5.4 (QA f5.4b #2): every row gets a key ('h:'+model for house rows) and duplicate rockets show once, so a tap can never look up an undefined row
  const seen = new Set(), list = []; for (const r of ch.list || []) { if (!r) continue; if (r.key == null) r.key = 'h:' + (r.model || r.base || r.name); const nk = String(r.name || r.key).toLowerCase(); if (seen.has(r.key) || seen.has('n:' + nk)) continue; seen.add(r.key); seen.add('n:' + nk); list.push(r); }
  let sel = list.some(r => r.key === ch.sel) ? ch.sel : list.length ? list[0].key : null, more = false; const SHORT = 3;
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const draw = () => { const vis = more ? list : list.slice(0, SHORT); { const sr = list.find(r => r.key === sel); if (sr && !vis.includes(sr)) vis.push(sr); }
    card.innerHTML = `<div class="mcIn"><h3>${title}</h3>${ch.note ? `<p class="mcNote">${esc(ch.note)}</p>` : ''}<div class="mcAct"><button id="mcFly">Fly</button><button id="mcAuto">🤖 AUTO</button><button id="mcX" aria-label="Cancel">✕</button></div>`
      + `<div class="mcList">${vis.map(r => `<button data-k="${esc(r.key)}" class="${r.key === sel ? 'on' : ''}">${r.mine ? '⭐ ' : ''}${esc(r.name)}</button>`).join('')}${!more && list.length > vis.length ? `<button data-more="1" class="mcMore">More rockets (${list.length - vis.length})</button>` : ''}</div></div>`; };
  draw(); card.classList.remove('hidden'); document.body.classList.add('mcOn');
  const shut = () => { card.classList.add('hidden'); document.body.classList.remove('mcOn'); };
  const pick = () => { const r = list.find(x => x.key === sel); if (!r) return null; if (r.mine) return cloneDesign(design); const i = SHOW.findIndex(x => x.id === r.base); if (r.model && specFor(r.model)) return specDesign(specFor(r.model), r.name, r.model); const d = { ...cloneDesign(SHOW[i].design), name: r.name }; if (r.model) d.model = r.model; return d; };
  card.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.more) { more = true; draw(); return; } if (b.dataset.k) { sel = b.dataset.k; draw(); return; }
    if (b.id === 'mcX') { shut(); return; } const d = pick(); if (!d) return; shut(); if (home && home.on) home.show(false); go(d, b.id === 'mcAuto'); };
}
function openMissionCard(id) {
  const m = MISSIONS[id]; if (!m) return;
  openRocketCard(`${m.icon} ${m.name}`, cardChoice(qualifying(id, SHOW, houseRows()), curRocket(), id !== 'hop', rowLocked, starterRow()), (d, auto) => startMission(id, launchPlan(d, auto)));
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
  if (f.orbit && !seen.orbit) seen.orbitT = performance.now(); if (f.orbit) once('orbit', '🛰️', TOUCH ? 'ORBIT!' : 'ORBIT ACHIEVED', '#7dffa6', true); // f5.6u: phones get the one-word banner
  if (booster && booster.state === 'landed' && !(seen.orbitT && performance.now() - seen.orbitT < 4000)) once('bland', '🎯', 'BOOSTER LANDED', '#7dffa6', false); // f5.7e (QA f5.7c P2): small, and never stacked on the orbit banner (waits 4 s)
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
  else if (!F.ignited) obj = '▶ ' + (PR.nextContract(PROG) ? 'Contract: ' + UN.txt(PR.nextContract(PROG).goal) : 'Free flight');
  else if (!f.orbit) obj = P.altOf(v) < 100000 ? 'Climb to space — ' + UN.big(100000) : 'Build speed for orbit (Pe above ' + UN.big(130000) + ')';
  else obj = F.body === 'earth' ? 'In orbit! Open 🎯 Missions or the map (M) to go further' : 'Exploring ' + b.name;
  if (F.parked || f.landed) { const lat = Math.asin(v.r[2] / r) * 180 / Math.PI, lon = Math.atan2(v.r[1], v.r[0]) * 180 / Math.PI, np = nearestPoi(F.body, b.R, lat, lon); if (np) obj += ` · 📍 ${np.poi.name} ${UN.big(np.d)}`; }
  fun.renderPilot({ alt: hudAlt(v), spd: V.len(v.v), stages, objective: obj, prog: director ? director.progress : f.orbit ? 1 : Math.min(1, P.altOf(v) / 140000), orbit2d: o2, bodyR: b.R, bodyCol: BODY_COL[F.body], me: [r, 0], director: !!(director && director.active) });
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
  const hA = haloAlpha(k); WV.halo.visible = hA > 0.01; // fx-1: no faint red sleeve from mild heating
  WV.halo.scale.set(r, g.L * 1.02, r); WV.halo.position.set(0, g.L / 2, 0);
  _hc.setRGB(1, 0.25 + 0.6 * k * k, 0.08 + 0.75 * k * k * k); WV.hm.color.copy(_hc); WV.hm.opacity = 0.55 * hA * flick;
  const fb = v.tel.flowBody, sA = sheathAlpha(pl, V.dot(v.v, V.norm(v.r)) - V.dot(siteVel(v), V.norm(v.r))); WV.sheath.visible = sA > 0.01 && !!fb; // fx-1: no 'maroon dome' ahead of the nose on a climb
  if (WV.sheath.visible) { const d = _wd.set(fb[0], fb[1], fb[2]).applyQuaternion(rocketG.quaternion).normalize(); // flow direction in world space
    const noseW = new THREE.Vector3(0, 1, 0).applyQuaternion(rocketG.quaternion), lead = fb[1] < 0 ? g.L : 0;
    WV.sheath.position.copy(rocketG.position).addScaledVector(noseW, lead).addScaledVector(d, -g.d * 0.15);
    WV.sheath.quaternion.setFromUnitVectors(_wy, d.clone().negate()); const R = g.d * (0.75 + 0.35 * pl); WV.sheath.scale.set(R, R * (1.6 + 2.2 * pl), R);
    WV.sm.color.setRGB(1, 0.45 + 0.4 * pl, 0.3 + 0.6 * pl * pl); WV.sm.opacity = 0.5 * sA * flick; }
  if (document.body.classList.contains('endOn') || (TOUCH && camDist < 40)) { WV.sm.opacity *= 0.3; WV.hm.opacity *= 0.5; } // QA f5b.3: no full-screen orange glow under the end card / close phone camera
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
    const a = $('ctAlt'), s2 = $('ctSpd'), at = fmtKm(P.altOf(v)) + ' ' + UN.bigLab(), st = UN.spd(fun.navOut.sp); if (a.textContent !== at) a.textContent = at; if (s2.textContent !== st) s2.textContent = st; }
  else t.style.opacity = '0';
}
// compact strip: the same speed as the navball (one source), Ap/Pe or the next event, one short hint line
const fmtKm = m => UN.bigS(m); // f5.7q: mi or km per the Units setting (name kept)
// f2: Ap/Pe slot that means something on ascent: below orbit it shows the apoapsis and "SUBORB" (or time to Ap)
function evAp(o) {
  if (!isFinite(o.ap)) return ['AP · PE ' + UN.bigLab(), '—'];
  const orb = isFinite(o.pe) && o.pe > (F.body === 'earth' ? 70000 : F.body === 'mars' || F.body === 'venus' || F.body === 'titan' ? 50000 : 2000), tAp = P.timeToApV(v);
  const k = x => (UN.bigN(x) >= 10 ? Math.round(UN.bigN(x)) : UN.bigN(x).toFixed(1)).toString();
  if (orb) return ['AP · PE ' + UN.bigLab(), k(o.ap) + '/' + k(o.pe)];
  const vr = V.dot(v.v, V.norm(v.r));
  if (vr > 5 && isFinite(tAp) && tAp > 0 && tAp < 3600) return ['AP · T−AP', k(o.ap) + '·' + (tAp < 60 ? Math.round(tAp) + 's' : Math.floor(tAp / 60) + 'm' + String(Math.round(tAp % 60)).padStart(2, '0'))];
  if (isFinite(o.pe) && o.pe > 0) return ['AP · PE ' + UN.bigLab(), k(o.ap) + '/' + k(o.pe)];
  return ['AP ' + UN.bigLab(), k(o.ap)];
}
function engCells() {
  if (!document.body.classList.contains('eng') || state !== 'flight' || !F) return null;
  const tel = v.tel, cs = v.stages[v.cur], cv = flyingBooster() ? booster : v, n0 = x => isFinite(x) ? x : 0;
  return { eMach: n0(tel.machShown ?? tel.mach).toFixed(2), eQ: (n0(tel.q) / 1000).toFixed(1), eG: n0(tel.gload).toFixed(1), eVs: Math.round(UN.dvN(V.dot(v.v, V.norm(v.r)))).toString(),
    eDv: Math.round(UN.dvN(n0(craftDv()))).toLocaleString(), eFuel: cs && cs.fuelMax > 0 ? Math.round(cs.fuel / cs.fuelMax * 100) + '%' : '—', eThr: Math.round(100 * n0(cv.throttle || cv.ut)) + '%', eHeat: (n0(tel.heat) / 1000).toFixed(0) };
}
function stripTick() {
  if (!F || !cx) return;
  const no = fun.navOut, lab = ({ surface: 'SRF', orbit: 'ORB', target: 'TGT' }[no.mode] || 'SRF') + ' ' + UN.spdLab();
  const sp = no.sp, b = F.booster, lc = F.landCue; let evL = 'AP · PE ' + UN.bigLab(), ev = '—';
  if (F.flyingBooster() && b && isFinite(b.burnIn) && b.burnIn > 0.5) { evL = 'BURN T−'; ev = b.burnIn.toFixed(1) + ' s'; }
  else if (lc && !F.flags.landed && lc.burnIn > 0.5 && lc.burnIn < 600 && V.dot(P.airVel(v), V.norm(v.r)) < 0) { evL = 'BURN T−'; ev = lc.burnIn.toFixed(1) + ' s'; }
  else if (F.nodes.length) { evL = 'NODE T−'; ev = fmtDur(Math.max(0, F.nodes[0].t - F.tAbs)); }
  else if (F.ignited || F.flags.orbit || P.altOf(v) > 1000) { const o = P.orbitOf(v); const ea = evAp(o); evL = ea[0]; ev = ea[1]; }
  const o2 = (F.ignited || F.flags.orbit) ? P.orbitOf(v) : null, cs = v.stages[v.cur]; // f5.4 (QA F1): PE, fuel per stage, stage n/N
  const pe = o2 && isFinite(o2.pe) ? (o2.pe < -50000 ? 'SUB' : fmtKm(o2.pe)) : '—', fuel = cs && cs.fuelMax > 0 ? Math.round(cs.fuel / cs.fuelMax * 100) + '%' : '—', stg = (v.cur + 1) + '/' + v.stages.length;
  cx.update({ pe, fuel, stg, alt: fmtKm(hudAlt(v)), spd: UN.spdN(sp) < 1e5 ? Math.round(UN.spdN(sp)).toLocaleString() : (UN.spdN(sp) / 1000).toFixed(0) + 'k', spdL: lab, evL, ev, hint: $('hint').style.display === 'none' ? '' : $('hint').textContent });
  cx.updateEng(engCells());
}
{ const wantB = on => { try { if (!F || !booster || booster.state !== 'flying') return; if (!!booster.manual !== on && (on ? booster.stages[0].fuel > 0 : true)) F.toggleBooster(); } catch (e) { } }; // f5.6g: each pane's ball steers THAT pane's craft
  // f5.6h (owner): trackball navball. The ball turns under the finger; the attitude it puts at center is a target that SAS holds
  const upCur = () => F && v ? { n: P.noseOf(v), t: V.qrot(v.q, [0, 0, -1]) } : null;
  const upHold = G => { if (!F || !v || v.clamped || F.flags.dead || (P.altOf(v) < 60 && V.len(P.airVel(v)) < 5)) return; // sitting on the pad: nothing to steer if (director && director.active) director.takeOver(); if (v.auto) F.takeOverUpper(); if (F.ret && F.ret.auto) F.setAuto(false);
    if (!window.__dragTold) { window.__dragTold = 1; toast('Navball: you drag the sky — drag ⬆ = nose down, ⬇ = nose up', '#9cc3ff'); } // f5.7e (QA f5.7c P2): say which way the drag turns the nose, once
    if (F.autoOn) { F.setAuto(false, true); $('tProg').classList.remove('on'); } const q = (v.tel && v.tel.q) || 0, lim = limitToPrograde(G.n, P.progradeOf(v), aoaLimit(q, QALPHA_MAX)); // f5.6h (QA P1): stay near prograde at high Q
    if (lim.limited) { G = frameOf(lim.n, G.t); if (performance.now() - (upHold.w || 0) > 2500) { upHold.w = performance.now(); toast(`⚠ High Q (${(q / 1000).toFixed(0)} kPa): steering held within ${Math.round(aoaLimit(q, QALPHA_MAX) * 57.3)}° of prograde`, '#ffcf4a'); } }
    if (v.sas !== 'stab') F.setSAS('stab'); v.sasHold = G.n.slice(); v.holdAtt = { n: G.n.slice(), t: G.t.slice() }; };
  const bFrame = (b, d) => { if (!b || !d) return null; const up = V.norm(b.r), k = V.dot(up, d); let t = V.sub(up, V.scale(d, k)); if (V.len(t) < 1e-3) t = P.eastOf(b.r); return { n: d, t: V.norm(t) }; }; // roll-free, like the mini ball
  const ballFor = (el, getB) => el && attachNavStick(el, { roll: false, mirrorX: true, onGrab: () => { const b = getB(); if (b && !b.manual) b.holdDir = null; wantB(true); }, cur: () => { const b = getB(); return b ? bFrame(b, b.dir) : null; }, target: () => { const b = getB(); return b && b.holdDir ? bFrame(b, b.holdDir) : null; },
    onTarget: G => { const b = getB(); if (b && b.state === 'flying' && b.manual) { b.holdDir = G.n.slice(); b.retro = false; } } });
  attachNavStick($('navBall'), { cur: upCur, target: () => v && v.holdAtt, onTarget: upHold, onGrab: () => { wantB(false); if (!localStorage.getItem('or_tbHint')) { try { localStorage.setItem('or_tbHint', '1'); } catch (e) { } toast('Turn the ball: drag the horizon down = nose up · twist = roll', '#9cc3ff'); } } });
  if ($('spBallU')) attachNavStick($('spBallU'), { roll: false, mirrorX: true, onGrab: () => wantB(false), cur: () => v ? bFrame(v, P.noseOf(v)) : null, target: () => v && v.holdAtt ? bFrame(v, v.holdAtt.n) : null, // the mini ball is roll-free: keep the current roll
    onTarget: G => { const t = V.qrot(v.q, [0, 0, -1]), k = V.dot(t, G.n), tt = V.sub(t, V.scale(G.n, k)); upHold({ n: G.n, t: V.len(tt) > 1e-3 ? V.norm(tt) : (v.holdAtt ? v.holdAtt.t : t) }); } });
  ballFor($('spBallB'), () => booster); ballFor($('spBallB2'), () => booster2); }
const fmtMph = m => UN.spd(m), fmtFps = m => UN.vs(m), fmtDv = m => UN.dv(m); // f5.7q: split strips follow the Units setting
const craftDvOf = (c, cur) => { try { const d = stageDvs(c.stages, cur, P.massOf(c)).reduce((a, x) => a + x.dv, 0); return isFinite(d) ? fmtDv(d) : '—'; } catch (e) { return '—'; } };
const plain = createPlainHud();
const dCtl = (() => { if (TOUCH) return null; const d = document.createElement('div'); d.id = 'dCtl'; d.className = 'hidden'; // f5.6d (QA P0 #2): desktop on-screen controls with key caps
  d.innerHTML = '<button id="dAbort" title="Abort (Backspace)">⛔ ABORT</button><div id="dThr" title="Throttle: drag, or Shift/Ctrl, Z full, X cut"><i></i><b>THR</b><u>0%</u></div><button id="dAuto" title="AUTO (F)">AUTO</button><button id="dStage" title="Stage (Space)">STAGE</button>';
  document.body.appendChild(d); const tap = (id, k) => { $(id).onclick = e => { e.currentTarget.blur(); press(k); }; }; tap('dAbort', 'Backspace'); tap('dAuto', 'KeyF'); tap('dStage', 'Space');
  { const th = $('dThr'); th.style.touchAction = 'none'; /* f5.8o (QA f5.8n P1): the gauge owns its pointer: capture it, never let it reach the navball / canvas steering */
    const setY = y => { const r = th.getBoundingClientRect(); setThrottleTouch(Math.max(0, Math.min(1, 1 - (y - r.top) / r.height))); };
    th.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { th.setPointerCapture(e.pointerId); } catch (x) { } th._pid = e.pointerId; setY(e.clientY); });
    th.addEventListener('pointermove', e => { if (th._pid === e.pointerId) { e.stopPropagation(); setY(e.clientY); } });
    const end = e => { if (th._pid === e.pointerId) { th._pid = null; e.stopPropagation(); try { th.releasePointerCapture(e.pointerId); } catch (x) { } } };
    th.addEventListener('pointerup', end); th.addEventListener('pointercancel', end); th.addEventListener('lostpointercapture', end);
    for (const t of ['touchstart', 'touchmove', 'touchend']) th.addEventListener(t, e => { e.stopPropagation(); if (e.cancelable && t !== 'touchend') e.preventDefault(); }, { passive: false }); }
  return d; })();
function dCtlTick() { if (!dCtl) return; const on = state === 'flight' && !!F && camMode !== 'map' && !photoOn && !replay && !$('hud').classList.contains('hidden'); dCtl.classList.toggle('hidden', !on); if (!on) { const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); return; } // f5.6h (QA): the ☰ never stays open over the end card
  if (F.ignited && dCtlTick.ig !== F) { dCtlTick.ig = F; const dm = $('dMenu'); if (dm) dm.classList.add('hidden'); try { mobile.closeMenu(); } catch (e) { } } // f5.7e (QA f5.7c P2): ☰ closes at liftoff (it stayed open from ascent to orbit)
  const t = Math.round(100 * (v.throttle || 0)); $('dThr').querySelector('i').style.height = t + '%'; $('dThr').querySelector('u').textContent = t + '%'; $('dAuto').classList.toggle('on', !!F.autoOn); } // f5.5c (owner): plain telemetry: mph, Ap/Pe with T−/+, Δv per stage
function plainTick() {
  if (F && F.ignited) { const ig = $('ignite'); if (ig && !ig.classList.contains('hidden')) ig.classList.add('hidden'); } // f5.6o (QA): the pad hint goes away at ignition, however you staged
  const on = state === 'flight' && !!F && camMode !== 'map' && !photoOn && !replay && !$('hud').classList.contains('hidden');
  if (!on) { plain.update({ on }); return; }
  const h = hudAlt(v), onPad = v.clamped || !F.ignited, o = P.orbitOf(v);
  let tAp = NaN, tPe = NaN; if (!onPad) { try { tAp = P.timeToApV(v); tPe = C.timeToPe(v.r, v.v, P.muOf(v)); } catch (e) { } }
  const mps = P.altOf(v) < 40000 ? V.len(P.airVel(v, v.r, v.v)) : V.len(v.v); // f5.6e (QA F2): own live source; the navball readout pauses in portrait split
  { const nv = $('nav'), mr = $('mright'), por = TOUCH && innerHeight > innerWidth && (!split.on || document.body.classList.contains('pip')); if (nv) { if (por && mr && mr.offsetHeight) { const r = mr.getBoundingClientRect(), w = nv.offsetWidth || 130; nv.style.setProperty('left', Math.round(innerWidth - 8 - w / 2) + 'px', 'important'); nv.style.setProperty('bottom', Math.round(innerHeight - r.top + 6) + 'px', 'important'); nv.dataset.pp = '1'; }
    else if (nv.dataset.pp) { nv.style.removeProperty('left'); nv.style.removeProperty('bottom'); delete nv.dataset.pp; } } } // f5.6h (QA F3/P1): phone portrait navball sits above the thumb cluster, never under the telemetry card
  let land = null; try { if (F.ignited && F._alt0 == null) F._alt0 = h - v.tel.ycom; if (!onPad && !F.flags.landed && F._alt0 != null) { const up = V.norm(v.r), vs = V.dot(P.airVel(v), up), r = V.len(v.r), g = P.muOf(v) / (r * r), aMax = v.stages[v.cur] && v.stages[v.cur].fuel > 0 ? P.maxThrust(v, P.atmosphere(Math.max(0, h)).p) / (P.massOf(v) * 1000) : 0; land = landAid(h - v.tel.ycom - (F.body === F.homeBody || !F.homeBody ? F._alt0 : 0), vs, aMax, g); } } catch (e) { } // fx-2: manual landing aid
  plain.update({ on, mps, alt: h, ap: apsisLine('ap', o, tAp, SIM_SPEED, onPad), pe: apsisLine('pe', o, tPe, SIM_SPEED, onPad), dv: stageDvs(v.stages, v.cur, P.massOf(v)), land });
}
// Navball glue: ship frame, local horizon, the marker directions and the landing burn cue
let navTgtT = 0, navTgt = null;
function navTick() {
  stripTick(); plainTick(); dCtlTick();
  if (camMode === 'map' || photoOn || !F || (split.on && innerHeight > innerWidth && !document.body.classList.contains('pip'))) { fun.hideNav(); return; }
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
  fun.renderNav({ altAGL: hudAlt(v), inc: (() => { if (!F.ignited || v.clamped) return NaN; const o = P.orbitOf(v); return isFinite(o.inc) ? o.inc * DEG : NaN; })(), alt: P.altOf(v), nose, top, r: v.r, vSurf: vs, vOrb: vo, vTgt, markers: m, throttle: v.throttle || 0, fuel, stage: v.cur + 1, sas: v.sas, cue, cueWarn, hasTarget: !!navTgt, hasNode: !!F.nodes.length, ghost: v.holdAtt && v.sas === 'stab' && !v.steerDir ? v.holdAtt : null });
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
  { const rl = F.released, sv = rl && rl.saved; if (sv) r.delivered = { cash: isConstellation() ? 15 : 25, name: sv.name }; if (f.recovered) r.stageRecovered = { cash: 10 }; r.deorbited = !!f.deorbited; }
  if (director && director.ok && DEST_PAY[director.id]) r.destination = { cash: DEST_PAY[director.id], id: director.id };
  { const hb = F.homeBody; if (!director && hb && hb !== 'earth' && (F.goals[hb] || {}).orbit && !f.dead) r.destination = { cash: OFFWORLD_PAY[hb] || 40, id: hb + '-orbit' }; } // f5.4 (QA f5.4b H): an off-world launch to orbit pays
  if (director && director.result && !director.ok) r.mission = null; // f5.1h (QA): a missed mission earns no medal, so the card and ⋯ agree on 0 stars
  const out = PR.record(PROG, r); PR.save(localStorage, PROG);
  // f5 career ladder: the flown showroom vehicle and any ops contract result ride along
  let op = lastOp; if (opSess) { try { const e = evalOp(opSess.m, F, opSess); op = { id: opSess.m.id, ok: !!e.complete }; } catch (e) { } }
  const sh = SHOW.find(x => x.name === design.name) || (pickModel && home ? SHOW[home.index] : null); // f5.1h: house rockets count as the stack they fly on
  try { out.ladder = careerUI.record({ ...r, missed: !!(director && director.result && !director.ok), vehicle: sh ? sh.id : null, op: op ? op.id : null, opOk: !!(op && op.ok) }); } catch (e) { console.warn('[Orbit Rush] ladder', e); }
  lastOp = null;
  return out;
}
function savePhoto(req) {
  const cv = renderer.domElement, w = cv.width, h = cv.height, c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g = c2.getContext('2d'); g.filter = req.filter || 'none'; g.drawImage(cv, 0, 0);
  g.filter = 'none'; g.font = `${Math.round(h / 40)}px sans-serif`; g.fillStyle = '#ffffffcc'; g.fillText('ORBIT RUSH · ' + (design.name || 'rocket') + ' · ' + P.BODIES[F.body].name, h / 40, h - h / 40);
  c2.toBlob(bl => { if (!bl) return; const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `orbit-rush-${Date.now()}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
  PROG.stats.photos++; const out = PR.record(PROG, { visited: [] }); PROG.stats.flights--; PR.save(localStorage, PROG); for (const a of out.ach) fun.call(a.icon, 'Achievement: ' + a.name, '#7dffa6', true);
  fun.call('📸', 'Photo saved', '#fff'); window.__lastPhoto = { w, h };
}
// ---------- f2h: home = rocket showroom; the hangar is its own "Build" mode ----------
const showDesign = i => ({ ...cloneDesign(SHOW[i].design), name: SHOW[i].name });
// f5.1h: house rocket names: brand pack, then the art set's own names, then a tidy id ('saturnine-v' -> 'Saturnine V')
const houseName = id => { const b = brandVName(id); if (b && b !== id) return b; if (ART_NAMES[id]) return ART_NAMES[id]; return id.split('-').map(w => /^(i|ii|iii|iv|v|vi)$/.test(w) ? w.toUpperCase() : /^[a-z]{1,2}\d*$/.test(w) && w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).join(' '); };
let pickModel = null; // f5.1h: a house rocket picked in the grouped picker rides on SHOW[i]'s part stack
let pickStack = null; // f5.1h: an extra stack (fun/showroom.js EXTRA_STACKS) when no showroom rocket has the model's stage shape
const pickDesign = i => pickModel && specFor(pickModel) ? specDesign(specFor(pickModel), houseName(pickModel), pickModel) : pickModel ? { ...cloneDesign(pickStack ? EXTRA_STACKS[pickStack].design : SHOW[i].design), name: houseName(pickModel), model: pickModel } : showDesign(i); // f4: hero rockets carry their brand name into the hangar/flight
const HOME_KEY = 'orbitrush.homeIdx', SHOW = SHOWROOM.map(r => { const o = { ...r, bars: showBars(r), missionLabel: missionLabel[r.mission] || '' }; if (r.model) Object.defineProperty(o, 'name', { get: () => { const m = ART_ALIAS[r.model] || r.model, b = brandVName(m); return b && b !== m ? b : r.name; }, enumerable: true }); return o; }); // f4: hero-model rockets carry the brand name
// f5 career: vehicles / missions locked until their ladder rung is earned (sandbox: all open)
const rungLabel = c => c.brandKey ? brandMName(c.brandKey, c.name) : c.name;
var careerUI = createCareerUI({ store: localStorage, onPlay: c => playRung(c),
  name: { rung: rungLabel, vehicle: id => (SHOW.find(x => x.id === id) || { name: id }).name, site: id => brandLabel('site.' + id, SITE_NAMES[id] || id),
    part: id => (PARTS[id] || { name: id }).name, mission: id => (MISSIONS[id] || {}).name || brandMName(id, (opsList.find(m => m.id === id) || {}).name || id) } });
function lockWhy(kind, id) { return null; /* f5.6 (owner): it's a sim, every rocket and site is open */ if (!careerUI.locked(kind, id)) return null; const c = careerUI.unlockedBy(kind, id); return '🔒 Locked: earn "' + (c ? rungLabel(c) : '?') + '" in Career (or turn on Sandbox)'; }
const lockedFly = i => { return false; if (sbSite) return false; // f5.4 sandbox: every rocket
   const w = lockWhy('vehicles', SHOW[i].id); if (w) { fun.call('🔒', w.slice(2), '#ffb35c', true); careerUI.show(true); } return !!w; };
function playRung(c) {
  if (home && home.on) home.show(false);
  if (c.how === 'op') return startOp(c.op, true);
  if (c.how === 'mission') return startMission(c.mission);
  const vb = SHOW.find(x => x.id === c.vehicle), q = vb ? [{ key: 'o:' + vb.id, name: vb.name, base: vb.id }, ...houseRows().filter(h => h.base === vb.id).slice(0, 6)] : [];
  const ch = cardChoice(q, curRocket(), c.id !== 'hop' && c.id !== 'karman', rowLocked, starterRow()); if (c.id === 'hop' || c.id === 'karman') { const me = ch.list.find(r => r.mine); if (me && !ch.note) ch.sel = 'mine'; } // f5.2: Fly ▸ / Next use the mission card's rule
  openRocketCard('🎯 ' + rungLabel(c), ch, (d, auto) => { setDesign(d); launch(); try { if (auto) { if (!F.ignited) F.stagePress(); F.setAuto(true, true); } else F.setAuto(false, true); } catch (e) { } fun.call('🎯', rungLabel(c) + ' — ' + autoNote(auto, d.name || 'rocket'), '#ffe9b0', true); });
}
addEventListener('career-change', () => { if (home) home.refresh(); });
var home = createHome({ list: SHOW, hidden: i => RETIRED.has(SHOW[i].id), locked: i => !!lockWhy('vehicles', SHOW[i].id), onCareer: () => careerUI.show(true),
  onSelect: i => { pickModel = null; pickStack = null; setTimeout(() => window.__galMark && window.__galMark(), 0); try { localStorage.setItem(HOME_KEY, String(i)); } catch (e) { } setDesign(showDesign(i)); },
  onFly: i => { if (lockedFly(i)) return; setDesign(pickDesign(i)); home.show(false); launch(); try { F.setAuto(false, true); } catch (e) { } }, // f5.5b (owner): load onto the pad with control; pick AUTO if wanted, STAGE to go. Was QA f5b.3: home FLY = 1 tap to liftoff on AUTO
  onMission: i => { if (lockedFly(i)) return; const w = lockWhy('missions', SHOW[i].mission); if (w) { fun.call('🔒', w.slice(2), '#ffb35c', true); return; } home.show(false); startMission(SHOW[i].mission); },
  onMissions: () => fun.openHub(), onAtlas: () => fun.openAtlas(), onGear: () => $('hGearM').classList.toggle('hidden') });
// f5.4 sandbox: 📍 launch site button on the Home card + picker
// f5.4 (QA f5.4b C1/H): off Earth, a sounding rocket (Pip, Sandpiper) is never the default: pick the starter orbiter
function siteDefault() { try { if (!sbSite || sbSite.body === 'earth' || pickModel || !home) return; const cur = SHOW[home.index]; if (!cur || !(cur.id === 'pip' || cur.id === 'hopper' || cur.check === 'space')) return;
  const i = SHOW.findIndex(x => x.id === 'needle'); if (i >= 0 && !rowLocked({ base: 'needle' })) home.set(i); } catch (e) { } }
function siteBtn(b) { const t = siteLabel(sbSite, P.BODIES), k = t.lastIndexOf(' · '); b.title = '📍 ' + t; b.innerHTML = ''; const a = document.createElement('b'), c = document.createElement('small'); a.textContent = '📍 ' + (k > 0 ? t.slice(0, k) : t); c.textContent = k > 0 ? t.slice(k + 3) : ''; b.append(a, c); } // f5.8b: two lines (pad / body) so phones don't cut it off
const sitePicker = createSitePicker({ BODIES: P.BODIES, onPick: s => { sbSite = s; siteDefault(); const b = $('hSite'); if (b) siteBtn(b); if (state !== 'flight') reset(); } });
{ const b = document.createElement('button'); b.id = 'hSite'; siteBtn(b); b.title = 'Launch from any planet or moon'; b.onclick = e => { e.currentTarget.blur(); sitePicker.show(true); };
  const c = document.querySelector('#hCard .hAct'); if (c) c.insertBefore(b, $('hMis')); } // f5.8: 📍 on the hero bar
{ const g = document.createElement('div'); g.id = 'hGearM'; g.className = 'hidden'; document.body.appendChild(g);
  const mk = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { g.classList.add('hidden'); fn(); }; g.appendChild(b); };
  for (const id of ['gfxSel', 'fxSel']) { const l = $(id) && $(id).closest('label'); if (l) g.appendChild(l); }
  { const sb = document.createElement('button'); sb.id = 'hSound'; const lab = () => { sb.textContent = funAudio.muted ? '🔇 Sound off' : '🔊 Sound on'; const pm = $('pMute'); if (pm) pm.textContent = funAudio.muted ? '🔇' : '🔊'; };
    sb.onclick = () => { initAudio(); funAudio.toggleMute(); lab(); }; lab(); g.appendChild(sb); }
  mk('⚙ All settings', () => qol.openSettings()); mk('Credits', () => $('credits').classList.remove('hidden'));
  document.addEventListener('pointerdown', e => { if (!g.classList.contains('hidden') && !e.target.closest('#hGearM,#hGear')) g.classList.add('hidden'); }, true);
}
{ // f5.1h: grouped rocket picker: Originals first, then one section per launch house; the builder lives behind Sandbox
  const pk = document.createElement('div'); pk.id = 'picker'; pk.className = 'gal'; ($('hGal') || document.body).appendChild(pk); // f5.8 (owner): the picker IS the home gallery
  const render = () => { pk.innerHTML = pickerHTML({ sets: HOUSE_SETS, name: houseName, role: id => (CLASS_OF[baseOf(id)] || 'Super-heavy') + (specFor(id) ? ' · Payload ' + fmtPay(payloadT(id)) : ' · ' + Math.round((ART[id] && ART[id].height) || 50) + ' m'), locked: id => !!lockWhy('vehicles', SHOW[baseIdx(id)].id),
    originals: SHOW.map((r, i) => ({ i, name: r.name, maker: r.house ? (SHORT_HOUSE[r.house] || r.house) : 'Original', locked: !!lockWhy('vehicles', r.id), thumb: r.model || r.id })).filter(o => !RETIRED.has(SHOW[o.i].id)), pinned: {}, flat: true }); if (matchMedia('(min-width:1100px) and (min-height:501px)').matches) pk.querySelectorAll('section.pkR').forEach(sc => sc.querySelectorAll('details.pkRow').forEach((d, i) => { d.open = i < 3; })); /* f5.8g (QA): desktop opens the first 3 companies per region (≤4 screens), the rest fold */ markSel(); }; // f5.8: Featured = the curated home rockets
  const close = () => { markSel(); }; // f5.8: the gallery stays; selecting just updates the hero
  function markSel() { pk.querySelectorAll('.pkC.on').forEach(c => c.classList.remove('on')); const c = pickModel ? pk.querySelector(`.pkC[data-m="${pickModel}"]`) : home && pk.querySelector(`.pkC[data-i="${home.index}"]`); if (c) { c.classList.add('on'); const d = c.closest('details.pkRow'); if (d && !d.open) d.open = true; } }
  window.__galMark = markSel; pk.addEventListener('click', () => setTimeout(markSel, 0)); addEventListener('career-change', () => render());
  const keysOf = id => { try { const st = (ART[id] && STAGE_KEYS[id]) || null; return st || []; } catch (e) { return []; } };
  function baseOf(id) { return pickBase(keysOf(id), (ART[id] && ART[id].height) || 50); }
  function baseIdx(id) { const b = baseOf(id); const k = SHOW.findIndex(x => x.id === (EXTRA_STACKS[b] ? 'atlas' : b)); return Math.max(0, k); }
  window.openPicker = () => { if (!pk.firstChild) render(); const q = $('pkQ'); if (q && !TOUCH) q.focus(); }; render();
  pk.addEventListener('input', e => { if (e.target.id === 'pkQ') { pk.classList.toggle('pkSearch', !!e.target.value.trim()); filterPicker(pk, e.target.value); } });
  pk.addEventListener('click', e => { const t = e.target;
    if (t.closest('#pkClose')) return close();
    if (t.closest('#pkClr')) { const q = $('pkQ'); q.value = ''; pk.classList.remove('pkSearch'); filterPicker(pk, ''); q.focus(); return; }
    { const tb = t.closest('.pkTab'); if (tb) { pk.querySelectorAll('.pkTab').forEach(b => b.classList.toggle('on', b === tb)); pk.querySelectorAll('.pkR').forEach(r => r.classList.toggle('off', r.dataset.rg !== tb.dataset.rg)); return; } }
    const c = t.closest('.pkC'); if (!c) return;
    if (c.dataset.i != null) { close(); home.set(+c.dataset.i); return; }
    if (c.dataset.m) { const id = c.dataset.m, i = baseIdx(id), b = baseOf(id);
      close(); home.set(i, true); pickModel = id; pickStack = EXTRA_STACKS[b] ? b : null; $('hName').textContent = houseName(id); $('hRole').textContent = (specFor(id) ? 'Real specs · ' + specStages(specFor(id)).length + ' stages · Payload ' + fmtPay(payloadT(id)) : 'Flies on the ' + (pickStack ? EXTRA_STACKS[pickStack].name : SHOW[i].name) + ' stack'); setDesign(pickDesign(i)); } });
  /* f5.8: no ▦ All rockets button: the gallery is on Home */

}
{ // f5.4m (QA declutter): Home = ‹ › FLY 🔧 📍 ☰. Rockets, Missions, Atlas, Career and Settings live in the ☰ menu
  const top = document.querySelector('#hTop .hTopR'), act = document.querySelector('#hCard .hAct');
  if (top && !$('hMenuB')) { const mb = document.createElement('button'); mb.id = 'hMenuB'; mb.textContent = '⚙'; mb.title = mb.ariaLabel = 'Settings and more'; top.appendChild(mb);
    const m = document.createElement('div'); m.id = 'hMenu'; m.className = 'hidden'; document.body.appendChild(m);
    for (const [t, id] of [['🪐 Atlas', 'hnAtlas'], ['⚙ Settings', 'hGear']]) { const b = document.createElement('button'); b.textContent = t; b.onclick = () => { m.classList.add('hidden'); const t0 = $(id); if (t0) t0.click(); }; m.appendChild(b); }
    mb.onclick = e => { e.stopPropagation(); m.classList.toggle('hidden'); };
    addEventListener('pointerdown', e => { if (!m.classList.contains('hidden') && !e.target.closest('#hMenu,#hMenuB')) m.classList.add('hidden'); }); } }
setTimeout(prewarmHeavy, 1500);
{ // f5.9-0: ?hangar (old Build deep link) now just opens Home
 const d0 = Math.max(0, SHOW.findIndex(x => x.id === DEFAULT_ID)); let i0 = d0; try { const v = localStorage.getItem(HOME_KEY); if (v !== null && v !== '') i0 = +v; } catch (e) { } if (!(i0 >= 0 && i0 < SHOW.length) || RETIRED.has(SHOW[i0].id)) i0 = d0; home.set(i0); /* fleet-1: retired/unknown saves fall back to Heron-9 */ siteDefault(); home.show(true); }
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
    let g = o; while (g.parent && !live.has(g) && g !== scene) g = g.parent; const onB = !live.has(g) && [booster, booster2].some(bq => bq && bq.mesh && (() => { let x = o; while (x) { if (x === bq.mesh) return true; x = x.parent; } return false; })()), own = live.has(g) || onB; // fx-7: the booster's own flame is measured against the booster, not the upper's engines
    out.plumes.push({ lat: +lat.toFixed(2), own, booster: onB }); if (!own || (!onB && lat > Math.max(1.5, u.w * 2))) out.bad.push({ lat, own }); });
  out.engines = eng.length;
  const sh = fx.shock, vp = fx.vapor; out.shock = sh.visible ? +Math.max(sh.scale.x, sh.scale.y).toFixed(1) : 0; out.vapor = vp.visible ? +Math.max(vp.scale.x, vp.scale.y).toFixed(1) : 0;
  out.flow = fx.flow && fx.flow.mesh.visible; out.L = P.stackGeom(v).L;
  // smoke trail: lateral distance of live puffs from the line through the base along the velocity (a corkscrew = big spread)
  const nose = P.noseOf(v), vh = V.norm(V.sub(v.v, siteVel(v))), base = V.sub(v.r, V.scale(nose, v.tel.ycom)); let n = 0, s2 = 0, mx = 0;
  for (const p of smoke.d) { if (p.life <= 0) continue; const d = [p.x - base[0], p.y - base[1], p.z - base[2]], along = V.dot(d, vh); if (along > 60 || along < -400) continue; const lat = V.len(V.addS(d, vh, -along)); if (p.max - p.life > 2.5) continue; n++; s2 += lat * lat; mx = Math.max(mx, lat); }
  out.smoke = { samp: smoke.d.filter(p => { if (p.life <= 0 || p.max - p.life > 2.5) return false; const al = V.dot([p.x - base[0], p.y - base[1], p.z - base[2]], vh); return al < 60 && al > -400; }).slice(0, 10).map(p => { const d = [p.x - base[0], p.y - base[1], p.z - base[2]], al = V.dot(d, vh); return [+(p.max - p.life).toFixed(1), Math.round(al), Math.round(V.len(V.addS(d, vh, -al)))]; }), n, rms: n ? +Math.sqrt(s2 / n).toFixed(1) : 0, max: +mx.toFixed(1) }; return out;
}
window.__craft = { CRAFT_TYPES };
window.__game = { get SG() { return SG; }, get viewId() { return viewId; }, fleetVis, goHome: () => goBuild(), rocketMarks: () => [comMark.visible, copMark.visible, cotMark.visible], get rocketG() { return rocketG; }, get pad() { return padCx; }, get fairHalves() { return fairHalves; }, get satVis() { return satVis; }, get hero() { return hero; }, flight: () => F, mem: () => { const m = renderer.info.memory || {}; let meshes = 0, geo = new Set(); scene.traverse(o => { if (o.isMesh) { meshes++; geo.add(o.geometry); } }); return { geometries: m.geometries, textures: m.textures, programs: renderer.info.programs ? renderer.info.programs.length : null, meshes, sceneGeo: geo.size, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; }, stageDbg: c => { if (!hero) return { model: design.model || null, stages: v.stages.length, radial: v.stages.map(s => s.radial || 0) }; heroStage(c); const lv = (hero.levels || [{ object: hero }])[0].object, st = (lv.userData && lv.userData.stages) || {}; const r = { model: design.model, stages: v.stages.length, radial: v.stages.map(s => s.radial || 0), hidden: Object.keys(st).filter(k => !st[k].visible), shown: Object.keys(st).filter(k => st[k].visible) }; heroStage(v.cur); return r; }, opDbg: () => ({ on: !!opSess, id: opSess && opSess.m.id, done: opSess && opSess.done, failed: opSess && opSess.failed, task: opSess && opSess.task && opSess.task.kind, lastOp, ended: F.ended, state }), get booster2() { return booster2; }, paneDbg: () => [booster, booster2].filter(Boolean).map((b, i) => { const S = paneSlots[i]; if (!S || !S.dbg || !b.mesh) return null; const cam = S.cam, q = b.mesh.getWorldQuaternion(new THREE.Quaternion()), ny = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const c0 = b.mesh.getWorldPosition(new THREE.Vector3()), p0 = c0.clone().project(cam), p1 = c0.clone().add(ny.clone().multiplyScalar(10)).project(cam), up = V.norm(b.r);
    const cu = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), crt = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    return { id: b.id || 'A', replay: !!(i === 0 && split.replay), state: b.state, phase: b.phase, meshVsDir: +(ny.x * b.dir[0] + ny.y * b.dir[1] + ny.z * b.dir[2]).toFixed(3), dirUp: +V.dot(b.dir, up).toFixed(3), noseScreenUp: +(p1.y - p0.y).toFixed(4), onScreen: Math.abs(p0.x) < 1 && Math.abs(p0.y) < 1 && p0.z < 1, camUpRadial: +(cu.x * up[0] + cu.y * up[1] + cu.z * up[2]).toFixed(3), roll: +(crt.x * up[0] + crt.y * up[1] + crt.z * up[2]).toFixed(3), R2: S.dbg.R2 }; }), dbgLayer: (k, on) => { const o = { atmo, tile, planet, clouds, lod: earthLOD.group }[k]; if (o) { if (on) o.layers.enable(0); else o.layers.disable(0); } if (k === "fog") scene.fog.density = on ? scene.fog.density : 0; return !!o; }, exhaustAudit: () => { // f4.1: live exhaust particles relative to the nozzle plane (along the air-relative velocity; > 0 = ahead)
    const va = V.sub(v.v, siteVel(v)), sp = V.len(va), vh = sp > 1 ? V.scale(va, 1 / sp) : P.noseOf(v), nz = V.sub(v.r, V.scale(P.noseOf(v), P.massProps(v).ycom)); let ahead = 0, maxA = -1e9, n = 0; const dbg = [];
    for (const sys of [fire, smoke]) for (const q of sys.d) { if (q.life <= 0 || Math.hypot(q.x, q.y, q.z) - P.R_E < 300) continue; /* ignore the pad cloud */ const a = V.dot([q.x - nz[0], q.y - nz[1], q.z - nz[2]], vh); if (V.len([q.x - nz[0], q.y - nz[1], q.z - nz[2]]) > 3000) continue; n++; if (a > maxA) maxA = a; if (a > 2) { ahead++; if (dbg.length < 6) dbg.push({ sys: sys === fire ? 'fire' : 'smoke', a: +a.toFixed(0), age: +(q.max - q.life).toFixed(2), c: q.c0 && q.c0.toString(16), d: q.drag, rva: +V.dot([q.vx - v.v[0], q.vy - v.v[1], q.vz - v.v[2]], vh).toFixed(0), an: +V.dot(P.noseOf(v), vh).toFixed(3), r: +V.len([q.x - nz[0], q.y - nz[1], q.z - nz[2]]).toFixed(0) }); } }
    return { n, ahead, maxAhead: n ? +maxA.toFixed(1) : null, alt: Math.round(F.alt), dbg }; }, relFrame: () => relFrame(), mapProbe: id => smap.probe(id), siteSun: () => siteArt.obj.map(L => ({ el: +(L.userData.sunEl || 0).toFixed(1), night: !!L.userData.night, lights: (() => { let n = 0; L.traverse(o => { if (o.isLight && o.visible) n++; }); return n; })() })), audio: () => ({ state: ac ? ac.state : 'none', muted: funAudio.muted, master: master ? master.gain.value : -1, engine: rumble ? rumble.gain.value : -1, bus: fbus ? fbus.gain.value : -1, crack: crackSrc ? 1 : 0, sfx: sbus ? sbus.gain.value : -1, dist: dbus ? dbus.gain.value : -1, mix: audioMix, music: funMusic.probe(), musicNow: musicMode(), loops: (rumbleSrc ? 1 : 0) + funAudio.liveLoops(), dest: !!ac }), plumeAudit, fxHide: on => { fx.root.visible = !on; }, home: () => ({ on: home.on, index: home.index, list: SHOW.map(r => ({ id: r.id, name: r.name, mission: r.mission })) }), homeSet: i => home.set(i), lod: () => ({ tier: LOD_TIER, earth: earthLOD.stats, body: bodyCur && bodyLODs[bodyCur] ? bodyLODs[bodyCur].stats : null, renderer: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles } }), padMarker: (on = true, km = 25) => { let m = earth.getObjectByName('padMarker'); if (!m) { m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff2040, depthTest: false })); m.name = 'padMarker'; m.renderOrder = 99; m.position.set(R + 2000, 0, 0); earth.add(m); } m.scale.setScalar(km * 1000); m.visible = on; earth.updateMatrixWorld(true); const w = m.getWorldPosition(new THREE.Vector3()).sub(earth.position).normalize(); return { lat: GX.PAD_LAT_DEG, lon: GX.PAD_LON_DEG, dir: [w.x, w.y, w.z] }; }, career: () => careerUI, showEnd: () => showEnd(), heatFx: () => ({ ...WV.heat }), bodyVis: () => ({ id: F && F.body, body: bodyG.visible, ground: bodyGround.visible, earth: earth.visible, fog: scene.fog.density, sky: scene.background && scene.background.getHexString ? scene.background.getHexString() : '' }), rocketBox: () => rocketScreenBox(), markers: setMarkers, get markersOn() { return MARK.on; }, fun, PR, get PROG() { return PROG; }, get director() { return director; }, startMission, startReplay, get replay() { return replay; }, explode, split, setGroundCam: on => { GCAM.on = !!on; if (on && split.on) split.full = 'u'; camMode = 'chase'; }, get groundCam() { return GCAM.act; }, splitOn: on => { split.enabled = on; try { localStorage.setItem(SPLIT_KEY, on ? '1' : '0'); } catch (e) { } }, smokeLive: () => smoke.d.filter(p => p.life > 0).length, gfx: { atmo: () => ({ vis: atmo.visible, gain: atmoMat.userData.gain.value, c: atmoMat.userData.center.value.toArray().map(Math.round), pos: atmo.position.toArray().map(Math.round), cam: camera.position.toArray().map(Math.round) }), renderState: () => ({ scene: GX.renderState.scene === scene ? 'flight' : GX.renderState.scene === smap.scene ? 'map' : '?', camera: GX.renderState.camera === camera ? 'flight' : GX.renderState.camera === smap.camera ? 'map' : '?', via: GX.renderState.via }), info: () => ({ q: gfxQ, bloom: post.on, tone: renderer.toneMapping, earthPx: !!earthPx, env: !!scene.environment }), setGfx, shake, flashAt },  BUILD, P, C, TEMPLATES, smap, scenario: (k, o) => runScenario(k, o), get F() { return F; }, get v() { return v; }, get flags() { return F.flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return F.ship; }, press, keys, stickCmd: () => ({ ...mobile.input }), get ignited() { return F.ignited; }, get warp() { return F.effWarp(); }, launch, goBuild, get design() { return design; }, setDesign: d => setDesign(cloneDesign(d)), get SG() { return SG; }, get camMode() { return camMode; }, get camPitch() { return camPitch; }, camInfo: () => { const bR = (P.BODIES[F.body] || {}).R || R, O = shipPos ? null : null; return { pitch: camPitch, dist: camDist, up: camera.up.toArray().map(x => +x.toFixed(3)) }; }, warpStep, warpReset, warpMaxI, exitMap, get mapZoom() { return mapZoom; }, get academy() { return academy; }, fx, get fxState() { return lastFx; }, get fxMs() { return fxMs; }, setCam: (d, yaw, pitch, aim) => { camDist = d; if (aim !== undefined) camAim = aim; if (yaw !== undefined) camYaw = yaw; if (pitch !== undefined) camPitch = pitch; }, setFx, syncStages, quicksave, quickload, revertLaunch, setPause, get paused() { return paused; }, get settings() { return SET; }, qol, craftDv, sitePicker, get sbSite() { return sbSite; } };
window.__game.tileStats = () => { const w = tileGeo.attributes.wat.array, c = tileGeo.attributes.color.array, h = [0, 0, 0, 0, 0]; for (const x of w) h[Math.min(4, Math.max(0, Math.floor(x * 5)))]++; return { hist: h, vis: tile.visible, c0: [c[0], c[1], c[2]], center: tileC, px: !!earthPx, mat: tile.material.type }; };
window.__game.camSet = (y, p, d, a) => { camYaw = y; camPitch = p; if (d) camDist = d; if (a != null) camAim = a; camUserT = performance.now() + 1e9; }; // flight-ground-3: shot tools aim the chase camera
window.__game.tileOff = b => { tileForceOff = !!b; }; window.__game.tileFadeInfo = () => { const h = F ? Math.max(0, F.alt) : 0; return { h, alt: GX.tileAltAlpha(h), rim: GX.tileRimAlpha(h), vis: tile.visible || tileF.visible, fade: tileF.visible }; }; // f5.9 terrain: render A/B + fade numbers for tests/smoke/terrain_blend.cjs
window.__game.scn = { scene, camera, earth, bodyG, stars, get W1() { return W1; }, sunDirV, get bodyCur() { return bodyCur; } }; // f6.4: far-planet smoke hooks
window.__game.paneSlots = () => paneSlots; // f5.6x: shot tools / pane-rect checks
