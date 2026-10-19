import * as THREE from 'three/webgpu';
import * as P from './physics.js?v=pb1';
import { Flight, PRESETS, planBuild, assessDesign, SIM_SPEED, WARPS } from './flight.js?v=pb1';
import { PARTS, TEMPLATES, ORBIT_DV, splitStages, designStats, validate, cloneDesign, insertPart, removePart, movePart, setEngines, swapStages, partMass } from './parts.js?v=pb1';
const { R, MU, ATM } = P;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
export const BUILD = '2026-10-19-pb1';
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));

// ---------- renderer: WebGPU first, WebGL2 fallback with a stated reason ----------
let gpuReason = '';
if (params.has('webgl')) gpuReason = 'forced by ?webgl';
else if (!('gpu' in navigator)) gpuReason = window.isSecureContext ? 'this browser has no WebGPU (navigator.gpu missing)' : 'not a secure (https) context';
else {
  try { const ad = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }); if (!ad) gpuReason = 'no WebGPU adapter (GPU/driver blocklisted)'; }
  catch (e) { gpuReason = 'requestAdapter failed: ' + e.message; }
}
const renderer = new THREE.WebGPURenderer({ antialias: true, logarithmicDepthBuffer: true, forceWebGL: !!gpuReason, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
await renderer.init();
const isGPU = !!renderer.backend.isWebGPUBackend;
if (!isGPU && !gpuReason) gpuReason = 'WebGPU init failed; three.js fell back';
if (isGPU) { $('badge').textContent = '⚡ WebGPU'; $('badge').classList.add('gpu'); console.info('[Orbit Rush] Renderer: WebGPU'); }
else { $('badge').textContent = 'WebGL2 ⓘ'; $('badge').title = 'WebGPU unavailable: ' + gpuReason; console.warn('[Orbit Rush] Using WebGL2 fallback — reason:', gpuReason); }
$('badge').onclick = () => toast(isGPU ? 'Rendering with WebGPU' : 'WebGL2 fallback: ' + gpuReason, '#9cc3ff');
if (renderer.backend.device) renderer.backend.device.lost.then(i => console.warn('[Orbit Rush] WebGPU device lost:', i.message));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ab8ff);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 4e7);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x334433, 1.0));
const sunL = new THREE.DirectionalLight(0xffffff, 2.4); sunL.position.set(0.6, 0.7, 0.9); scene.add(sunL);

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
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 30, 6), steel); l.position.set(Math.cos(a) * 45, 15, Math.sin(a) * 45); g.add(l); }
  surfaceObj(PAD_ANG, g, 0);
}

// ---------- procedural textures ----------
function hash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v), L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}
function fbm(x, y, z) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 4; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.1; amp *= 0.5; } return a; }
function planetTexture() {
  const W = 768, H = 384, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const lon = i / W * Math.PI * 2, lat = (j / H - 0.5) * Math.PI;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const n = fbm(x * 2.2 + 5, y * 2.2, z * 2.2), cl = fbm(x * 5 + 9, y * 5, z * 5);
    let r, g, b; const polar = false;
    if (n > 0.52) { const t = (n - 0.52) * 4; r = 60 + t * 120; g = 110 + t * 60; b = 50 + t * 40; if (n > 0.66) { r = g = b = 150 + t * 40; } }
    else { const t = n / 0.52; r = 10 + t * 20; g = 40 + t * 60; b = 90 + t * 80; }
    if (polar) { r = g = b = 235; }
    if (cl > 0.56) { const c = Math.min(1, (cl - 0.56) * 5); r += (255 - r) * c; g += (255 - g) * c; b += (255 - b) * c; }
    const o = (j * W + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function starTexture() {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const c = cv.getContext('2d');
  c.fillStyle = '#000'; c.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 3000; i++) { const b = Math.random() ** 3; c.fillStyle = `rgba(${200 + 55 * Math.random()},${210 + 45 * Math.random()},255,${0.3 + b * 0.7})`; const s = b > 0.9 ? 2 : 1; c.fillRect(Math.random() * 2048, Math.random() * 1024, s, s); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- world (positions are planet-centred, rendered relative to a floating origin) ----------
const world = []; // {obj, x, y}
function place(obj, x, y) { world.push({ obj, x, y }); scene.add(obj); return obj; }
const planetGeo = new THREE.SphereGeometry(R, 384, 192); planetGeo.rotateX(Math.PI / 2);
const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 0.9 }));
place(planet, 0, 0);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(R + ATM, 128, 64), new THREE.MeshBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.22, side: THREE.BackSide, depthWrite: false }));
place(atmo, 0, 0);
const stars = new THREE.Mesh(new THREE.SphereGeometry(1.5e7, 32, 16), new THREE.MeshBasicMaterial({ map: starTexture(), side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(stars);

function surfaceObj(angle, obj, lift = 0) {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(ux, uy, 0));
  return place(obj, ux * (R + lift), uy * (R + lift));
}
function patch(angle, color, size, lift) { // spherical cap so it hugs the curved surface
  const g = new THREE.SphereGeometry(R + lift, 64, 40, 0, Math.PI * 2, 0, size / R); g.translate(0, -(R + lift), 0);
  return surfaceObj(angle, new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1 })), lift);
}
const PAD_ANG = Math.PI / 2, PAD_Z = 0.4, DECK = 3;
patch(PAD_ANG, 0x4f6b3a, 30000, 0.3);
patch(PAD_ANG - 0.07, 0x1d4f8a, 30000, 0.6); // ocean downrange (east) of the pad
buildLaunchComplex();

// ---------- rocket meshes ----------
const M = {
  white: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.45, metalness: 0.2 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.4 }),
  engine: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3, metalness: 0.9 }),
  plume: new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
  plumeCore: new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};
const RAD = 1.85;
// Build one THREE.Group per stage (flight order) from the design's parts, stacked bottom-up inside each group.
const PART_COL = { sat: 0xc9a34a, probe: 0xb8c4d6, crew: 0xdddddd };
function bells(g, n, y, big, small) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, rr = n === 1 ? 0 : 1.05;
    const e = new THREE.Mesh(new THREE.CylinderGeometry(small ? 0.15 : big ? 0.25 : 0.3, small ? 0.35 : big ? 0.65 : 0.9, small ? 0.9 : 1.6, 16), M.engine);
    e.position.set(Math.cos(a) * rr, y + (small ? 0.45 : 0.8), Math.sin(a) * rr); g.add(e);
  }
}
function makeRocketGroups(design) {
  const groups = splitStages(design), out = [];
  groups.forEach((idx, si) => {
    const g = new THREE.Group(); let y = 0, nEng = 0, payloadY = null, finsAt = [];
    const list = idx.map(i => design.parts[i]).reverse(); // bottom → top
    for (const p of list) {
      const d = PARTS[p.id];
      if (d.type === 'engine') { const n = p.n || 1; bells(g, n, y, p.id === 'thumper', p.id === 'spark'); y += p.id === 'spark' ? 0.9 : 1.6; nEng += n; }
      else if (d.type === 'tank') {
        const h = 1 + d.fuel * 0.75; const body = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, h, 32), M.white); body.position.y = y + h / 2; g.add(body);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.02, RAD + 0.02, Math.min(1.2, h * 0.15), 32), M.black); band.position.y = y + h - Math.min(0.6, h * 0.075); g.add(band);
        if (finsAt.length) { finsAt = []; addFins(g, y + 1.2); }
        y += h;
      } else if (d.type === 'decoupler') { const m = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 0.8, 32), M.black); m.position.y = y + 0.4; g.add(m); y += 0.8; }
      else if (d.type === 'fins') finsAt.push(y);
      else if (d.type === 'pod' || d.type === 'payload') {
        if (payloadY === null) payloadY = y;
        let m, h;
        if (p.id === 'crew') { h = 3.6; m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, RAD, h, 32), new THREE.MeshStandardMaterial({ color: PART_COL.crew, roughness: 0.5, metalness: 0.3 })); }
        else if (p.id === 'probe') { h = 1.2; m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, h, 8), new THREE.MeshStandardMaterial({ color: PART_COL.probe, metalness: 0.6, roughness: 0.3 })); }
        else { h = 2.6; m = new THREE.Mesh(new THREE.BoxGeometry(2.2, h, 2.2), new THREE.MeshStandardMaterial({ color: PART_COL.sat, metalness: 0.6, roughness: 0.3 })); }
        m.position.y = y + h / 2; g.add(m); y += h;
      }
    }
    if (finsAt.length) addFins(g, Math.max(1.2, finsAt[0] + 1.2));
    let fair = null;
    if (si === groups.length - 1 && idx.some(i => design.parts[i].id === 'fairing')) {
      const y0 = payloadY ?? y, fh = Math.max(4, y - y0 + 2.5); fair = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.25, RAD + 0.05, fh * 0.55, 32), M.white); cyl.position.y = fh * 0.275; fair.add(cyl);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, RAD + 0.25, fh * 0.6, 32), M.white); cone.position.y = fh * 0.55 + fh * 0.3; fair.add(cone);
      fair.position.y = y0; g.add(fair); y = Math.max(y, y0 + fh * 1.15);
    }
    const plume = makePlume(si === 0 ? 1.4 + nEng * 0.25 : 1 + Math.min(nEng, 3) * 0.2); g.add(plume);
    let legs = null;
    if (si === 0) {
      legs = new THREE.Group();
      for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35), M.black); const a = i * Math.PI / 2 + 0.78; l.position.set(Math.cos(a) * 3.3, 2.2, Math.sin(a) * 3.3); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); legs.add(l); }
      legs.visible = false; g.add(legs);
    }
    g.userData = { h: y, plume, legs, fair };
    out.push(g);
  });
  return out;
}
function addFins(g, y) {
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.15), M.black); const a = i * Math.PI / 2; f.position.set(Math.cos(a) * (RAD + 0.8), y, Math.sin(a) * (RAD + 0.8)); f.rotation.y = -a; g.add(f); }
}
function makePlume(w) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(w, 1, 24, 1, true), M.plume); outer.rotation.x = Math.PI; outer.position.y = -0.5; g.add(outer);
  const core = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, 1, 16, 1, true), M.plumeCore); core.rotation.x = Math.PI; core.position.y = -0.5; g.add(core);
  g.visible = false; return g;
}

// ---------- particles (instanced camera-facing quads; only live particles are touched each frame) ----------
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
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag) {
    const p = this.d[this.i]; this.i = (this.i + 1) % this.n;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life; p.s0 = s0; p.s1 = s1; p.c0 = c0; p.c1 = c1; p.drag = drag;
  }
  clear() { for (const p of this.d) p.life = 0; }
  update(dt, ox, oy, q) {
    let dirty = false;
    for (let i = 0; i < this.n; i++) {
      const p = this.d[i];
      if (p.life <= 0) { if (p.shown) { p.shown = false; this.mesh.setMatrixAt(i, ZERO); dirty = true; } continue; }
      dirty = true; p.shown = true;
      p.life -= dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - Math.max(p.life, 0) / p.max, s = p.s0 + (p.s1 - p.s0) * t;
      const fade = p.c1 === null ? (t > 0.7 ? (1 - t) / 0.3 : 1) : 1;
      this.p.set(p.x - ox, p.y - oy, p.z); this.s.setScalar(s * fade);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, q, this.s));
      if (p.c1 !== null) { this.c.setHex(p.c0); this.c.lerp(this.c2.setHex(p.c1), t); } else this.c.setHex(p.c0);
      this.mesh.setColorAt(i, this.c);
    }
    if (dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
}
const fire = new Particles(450, true), smoke = new Particles(500, false);

// ---------- audio ----------
let ac, rumble, rumbleF;
function noiseBuf(sec) { const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } return b; }
function initAudio() {
  if (ac) return; ac = new (window.AudioContext || window.webkitAudioContext)();
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
const TYPE_ORDER = [['pod', 'Command'], ['payload', 'Payload'], ['fairing', 'Payload'], ['tank', 'Fuel tanks'], ['engine', 'Engines'], ['decoupler', 'Structure'], ['fins', 'Structure']];
const TYPE_COL = { pod: '#9cc3ff', payload: '#e0b84a', fairing: '#e8e8e8', tank: '#f2f2f2', engine: '#ff9a3c', decoupler: '#888', fins: '#555' };
const partStat = (id, p) => { const d = PARTS[id];
  if (d.type === 'engine') return `${d.tv} kN · Isp ${d.ispSl}/${d.ispVac} s · ${d.m} t`;
  if (d.type === 'tank') return `${d.fuel} t fuel · ${(d.fuel * 0.1).toFixed(1)} t empty`;
  return `${(p ? partMass(p) : d.m).toFixed(1)} t${d.mult ? ' · ×' + d.mult + ' score' : ''}`; };
function buildPalette() {
  const el = $('palette'); el.innerHTML = ''; let lastH = '';
  for (const [type, head] of TYPE_ORDER) {
    if (head !== lastH) { const h = document.createElement('div'); h.className = 'palH'; h.textContent = head; el.appendChild(h); lastH = head; }
    for (const [id, d] of Object.entries(PARTS)) if (d.type === type) {
      const t = document.createElement('div'); t.className = 'tile'; t.draggable = true; t.title = d.desc + ' (click to add above the selected part, or drag into the stack)';
      t.innerHTML = `<i style="background:${TYPE_COL[type]}"></i><b>${d.name}</b><small>${partStat(id)}</small>`;
      t.onclick = () => addPart(id); t.ondragstart = e => { e.dataTransfer.setData('text/plain', 'new:' + id); e.dataTransfer.effectAllowed = 'copy'; };
      t.dataset.id = id; el.appendChild(t);
    }
  }
}
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
      row.onclick = () => { selected = selected === i ? -1 : i; refreshBuild(); };
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
function refreshBuild() {
  const stats = designStats(design), val = validate(design);
  document.querySelectorAll('#presets button[data-p]').forEach(b => b.classList.toggle('on', JSON.stringify(TEMPLATES[+b.dataset.p].parts) === JSON.stringify(design.parts)));
  renderStack(stats);
  const rows = stats.stages.map((st, i) => { const a = stats.analysis.stages[i];
    return `<tr><td>${i + 1}</td><td>${a.engines.join(', ') || '<span class="bad">none</span>'}</td><td>${st.m0.toFixed(1)}→${st.m1.toFixed(1)} t</td><td>${st.dv.toFixed(0)}</td><td class="${st.twr < (i ? 0.45 : 1) ? 'bad' : st.twr < (i ? 0.7 : 1.2) ? 'warn' : ''}">${st.twr.toFixed(2)}${i ? '' : ' SL'}</td><td>${st.burn.toFixed(0)} s</td></tr>`; }).join('');
  const pct = Math.min(100, stats.total / (ORBIT_DV * 2) * 100), need = ORBIT_DV / (ORBIT_DV * 2) * 100;
  const dvC = stats.total < ORBIT_DV ? 'bad' : stats.total < ORBIT_DV + 600 ? 'warn' : 'good';
  $('readout').innerHTML = `<table><tr><th>Stg</th><th>Engines</th><th>Mass wet→dry</th><th>Δv m/s</th><th>TWR</th><th>Burn</th></tr>${rows}</table>
    <div class="dvline">Total Δv <b class="${dvC}">${stats.total.toFixed(0)} m/s</b> · orbit needs ~${ORBIT_DV.toLocaleString()} · liftoff mass ${stats.mass.toFixed(1)} t · score ×${stats.analysis.mult}</div>
    <div class="dvbar"><i class="${dvC}" style="width:${pct}%"></i><s style="left:${need}%"></s><em style="left:${need}%">orbit</em></div>
    ${val.errors.map(e => `<div class="msg bad">✘ ${e}</div>`).join('')}${val.warnings.map(e => `<div class="msg warn">⚠ ${e}</div>`).join('')}
    <div id="verdict" class="msg">${val.ok ? 'AUTO test flight: simulating…' : ''}</div><div id="landPlan" class="msg"></div>
    <div class="small">Stage 1 TWR is at sea level, upper stages in vacuum. Δv uses mean Isp for stage 1.</div>`;
  $('launchBtn').disabled = !val.ok; $('launchBtn').textContent = val.ok ? 'ROLL TO PAD ▶' : 'Fix the design to launch';
  clearTimeout(planTimer); const key = JSON.stringify(design.parts);
  if (val.ok) planTimer = setTimeout(() => { // fly the design on AUTO headlessly: verdict + booster-landing advice
    if (JSON.stringify(design.parts) !== key || !$('verdict')) return;
    const a = assessDesign(design); $('verdict').innerHTML = `<span class="${a.level}">${a.text}</span>`;
    const p = planBuild(design), el = $('landPlan'); const s1 = design && stats.analysis.stages[0];
    if (p.reason === 'single') el.innerHTML = '<span class="small">Single-stage rocket: no booster to land.</span>';
    else if (p.reason) el.innerHTML = '';
    else if (p.minReserve === null) el.innerHTML = '<span class="warn">⚠ Booster landing: this booster can\'t keep enough fuel to land. Add stage-1 fuel or use fewer engines.</span>';
    else if (!p.orbit) el.innerHTML = `<span class="warn">⚠ Booster landing needs ~${p.minReserve.toFixed(1)} t left at staging, but then the upper stages can't reach orbit.</span>`;
    else el.innerHTML = `<span class="good">✔ Booster can land: stage with ≥ ${p.minReserve.toFixed(1)} t left (of ${s1.fuel} t). AUTO alone stages it dry.</span>`;
  }, 250);
  renderSaved();
  if (state === 'build') showPreview();
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
const dyn = []; // world entries created during a flight (droneship, ocean) — removed on reset
const keys = {};
function later(fn, ms) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }
let shipVis = null;
const hooks = {
  toast: (m, c) => toast(m, c),
  sound: (k, f) => { if (k === 'ignite') burst(0.6, 1.2, 500); else if (k === 'beep') beep(f); else if (k === 'orbit') { beep(1320); setTimeout(() => beep(1760), 200); } else if (k === 'landed') { beep(1500); setTimeout(() => beep(1900), 180); } },
  stage: b => { b.mesh = detachStage(0); booster = b; },
  drop: d => { d.mesh = detachStage(d.stageIndex); d.t = 0; debris.push(d); },
  ship: s => { shipVis = makeShip(s.ang); },
  shipMoved: s => shipVis && shipVis.setAngle(s.ang),
  jettison: () => { const f = SG[SG.length - 1].userData.fair; if (f) f.visible = false; beep(990); },
  // keys held for the booster must not leak into the upper stage (and vice versa) when control switches
  boosterControl: manual => { for (const k in keys) keys[k] = false; if (manual) { camMode = 'booster'; camDist = 140; } else camMode = 'chase'; $('tProg').classList.toggle('on', F.autoOn); },
  boosterLost: (b, moving) => { explode(b.x, b.y, moving ? b.vx : 0, moving ? b.vy : 0); b.mesh.visible = false; b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  boosterLanded: b => { b.mesh.userData.plume.visible = false; if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000); },
  fail: () => { explode(v.x, v.y, v.vx, v.vy, true); rocketG.visible = false; },
  end: (ms, cond) => later(() => { if (cond()) showEnd(); }, ms),
};
// Move a spent stage out of the rocket into the world; the rest of the stack drops down to the new bottom.
function detachStage(i) {
  const g = SG[i]; rocketG.remove(g); scene.add(g); g.userData.plume.visible = false; burst(0.5, 0.6, 1500); beep(660);
  let y = 0; for (let j = i + 1; j < SG.length; j++) { SG[j].position.y = y; y += SG[j].userData.h; }
  for (let k = 0; k < 25; k++) smoke.spawn(v.x, v.y, 0, v.vx + (Math.random() - 0.5) * 20, v.vy + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 1.5, 2, 8, 0xdddddd, null, 0.5);
  return g;
}
const stackH = () => { let h = 0; for (let j = (v ? v.cur : 0); j < SG.length; j++) h += SG[j].userData.h; return h; };
function showPreview() {
  if (rocketG) scene.remove(rocketG);
  rocketG = new THREE.Group(); SG = validate(design).ok || design.parts.length ? makeRocketGroups(design) : [];
  let y = 0; for (const g of SG) { g.position.y = y; y += g.userData.h; rocketG.add(g); } scene.add(rocketG);
  F = new Flight(validate(design).ok ? design : TEMPLATES[0], hooks, PAD_Z); v = F.v;
}
function reset() {
  gen++;
  if (booster && booster.mesh) scene.remove(booster.mesh);
  for (const d of debris) scene.remove(d.mesh); debris.length = 0;
  for (const w of dyn) { scene.remove(w.obj); const i = world.indexOf(w); if (i >= 0) world.splice(i, 1); }
  dyn.length = 0; shipVis = null; booster = null; camMode = 'chase';
  camDist = 70; camYaw = 0.5; camPitch = 0.12; mapZoom = 2.8;
  fire.clear(); smoke.clear(); for (const k in keys) keys[k] = false;
  if (swingArm) swingArm.rotation.y = 0;
  $('end').classList.add('hidden'); $('toasts').innerHTML = '';
  showPreview();
}
function launch() {
  initAudio(); reset(); state = 'flight';
  document.activeElement && document.activeElement.blur();
  $('build').classList.add('hidden'); $('hud').classList.remove('hidden');
  if (matchMedia('(pointer:coarse)').matches) $('touch').classList.remove('hidden');
}
function goBuild() {
  reset(); state = 'build';
  $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); $('ignite').classList.add('hidden'); $('build').classList.remove('hidden');
  refreshBuild();
}
let camDist = 70, camYaw = 0.5, camPitch = 0.12, mapZoom = 2.8;
reset(); refreshBuild();
$('launchBtn').onclick = e => { e.currentTarget.blur(); launch(); };
$('againBtn').onclick = () => goBuild();
$('relaunchBtn').onclick = () => launch();
$('contBtn').onclick = () => { $('end').classList.add('hidden'); F.unfinish(); F.endQueued = true; };
function shareText() { const sc = F.score(); return `🚀 I scored ${sc.toLocaleString()} in Orbit Rush${F.flags.orbit ? ' — reached orbit' : ''}${F.flags.boosterBonus ? ' and landed the booster' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');
function toast(msg, color = '#7dffa6') { const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

// ---------- input ----------
const flyingBooster = () => F.flyingBooster();
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'KeyR') { goBuild(); return; }
  if (code === 'KeyM') { camMode = camMode === 'map' ? (flyingBooster() ? 'booster' : 'chase') : 'map'; return; }
  if (code === 'KeyT') { F.autoWarp = false; F.setWarp(F.warpI + 1 >= WARPS.length ? 0 : F.warpI + 1); return; }
  if (code === 'Comma') { F.autoWarp = false; F.setWarp(F.warpI - 1); return; }
  if (code === 'KeyG') { F.startAutoWarp(); return; }
  if (code === 'KeyL') { F.toggleBooster(); return; }
  if (code === 'KeyB') { if (booster && booster.state === 'flying') camMode = camMode === 'booster' ? 'chase' : 'booster'; else toast('No booster in flight', '#ffb35c'); return; }
  if (F.flags.dead) return;
  if (flyingBooster()) { // controls go to the booster
    const b = booster;
    if (code === 'KeyZ') b.ut = 1; if (code === 'KeyX') b.ut = 0;
    if (code === 'KeyF') { b.retro = !b.retro; toast(b.retro ? 'Holding retrograde' : 'Manual tilt', '#9cc3ff'); }
    return;
  }
  if (v.auto && ['KeyZ', 'KeyX', 'KeyF'].includes(code)) { F.takeOverUpper(); if (code === 'KeyF') return; }
  if (code === 'Space') { const r = F.stagePress(); if (r === 'ignite') $('ignite').classList.add('hidden'); }
  if (code === 'KeyZ') v.ut = 1;
  if (code === 'KeyX') { v.ut = 0; F.autoWarp = false; }
  if (code === 'KeyF') F.setAuto(!F.autoOn);
  $('tProg').classList.toggle('on', F.autoOn);
}
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.target && e.target.tagName === 'BUTTON') e.target.blur();
  if (e.repeat) return; keys[e.code] = true; press(e.code);
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Space') e.preventDefault(); });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k, t = b.dataset.t;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (k) keys[k] = true; if (t) press(t); });
  const up = () => { if (k) keys[k] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
$('warpBtn').onclick = e => { e.currentTarget.blur(); press('KeyT'); };
$('apBtn').onclick = e => { e.currentTarget.blur(); press('KeyG'); };
$('flyBtn').onclick = e => { e.currentTarget.blur(); press('KeyL'); };
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') mapZoom = Math.min(8, Math.max(1.25, mapZoom * (1 + e.deltaY * 0.001))); else camDist = Math.min(3000, Math.max(20, camDist * (1 + e.deltaY * 0.001))); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointercancel', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { camYaw -= (e.clientX - px) * 0.006; camPitch = Math.max(-1.2, Math.min(1.4, camPitch + (e.clientY - py) * 0.004)); }
  else if (pts.size === 2) { let o; for (const [id, q] of pts) if (id !== e.pointerId) o = q; const d0 = Math.hypot(px - o[0], py - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); const f = d0 / Math.max(d1, 1); if (camMode === 'map') mapZoom = Math.min(8, Math.max(1.25, mapZoom * f)); else camDist = Math.min(3000, Math.max(20, camDist * f)); }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
});

// ---------- visuals ----------
function explode(x, y, vx, vy, big) {
  burst(big ? 1.2 : 0.7, 2.5, 700);
  for (let i = 0; i < (big ? 220 : 120); i++) {
    const a = Math.random() * 6.283, b = Math.random() * 3.14, s = Math.random() * (big ? 70 : 45);
    fire.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * Math.sin(b) * s, vy * 0.3 + Math.sin(a) * Math.sin(b) * s, Math.cos(b) * s, 0.6 + Math.random() * 1.4, 4, 14, 0xfff0b0, 0x401000, 1.2);
    if (i % 2) smoke.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * s * 0.5, vy * 0.3 + Math.sin(a) * s * 0.5, (Math.random() - 0.5) * s, 4 + Math.random() * 4, 6, 26, 0x2b2b2b, null, 0.8);
  }
}
function showEnd() {
  if (F.ended) return; const score = F.finish();
  const flags = F.flags, o = P.orbitOf(v), ok = flags.orbit && !flags.dead;
  $('endTitle').innerHTML = flags.dead ? '💥 Rapid Unscheduled Disassembly' : ok ? '🛰️ Orbit achieved!' : flags.stranded ? '🪂 Out of fuel — suborbital' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  if (flags.stranded && !flags.dead) lines.push(`<span class="warn">${F.advice()}</span>`);
  lines.push(`Max altitude: ${((flags.maxAlt || 0) / 1000).toFixed(1)} km`, `Max-Q: ${F.maxQ.toFixed(1)} kPa`);
  if (flags.space) lines.push('<span class="good">✔ Reached space (70 km)</span>');
  if (flags.orbit) lines.push(`<span class="good">✔ Orbit — Ap ${isFinite(o.ap) ? (o.ap / 1000).toFixed(0) + ' km' : 'escape'} / Pe ${(o.pe / 1000).toFixed(0)} km</span>`);
  if (flags.booster) lines.push(flags.boosterBonus ? `<span class="good">✔ Booster ${flags.booster} (+${flags.boosterBonus})</span>` : `<span class="warn">✘ Booster ${flags.booster}</span>`);
  else if (booster && booster.state === 'flying') lines.push('Booster still descending…');
  lines.push(`Rocket: ${design.name || 'Custom'} — ${v.stages.length} stages, ${F.stats.total.toFixed(0)} m/s · payload ×${v.mult}`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  $('endBody').innerHTML = lines.join('<br>');
  $('contBtn').classList.toggle('hidden', !!flags.dead || !!flags.stranded);
  $('shareBtn').textContent = 'Share score';
  $('end').classList.remove('hidden');
}
function makeShip(a) {
  patch(a, 0x184a80, 6000, 2); const ocean = world[world.length - 1]; dyn.push(ocean);
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(60, 5, 36), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 })); hull.position.y = DECK - 2.5; g.add(hull);
  const xm = new THREE.MeshBasicMaterial({ color: 0xffd23a });
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(34, 0.2, 2.2), xm); x1.rotation.y = 0.75; x1.position.y = DECK + 0.05; g.add(x1);
  const x2 = x1.clone(); x2.rotation.y = -0.75; g.add(x2);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.6, 6, 40), xm); ring.rotation.x = Math.PI / 2; ring.position.y = DECK + 0.05; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3000, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 1500; g.add(beam);
  surfaceObj(a, g, 0); const entry = world[world.length - 1]; dyn.push(entry);
  const s = { ang: a, moved: false, setAngle(na) {
    s.ang = na; for (const [ent, lift] of [[ocean, 2], [entry, 0]]) { const ux = Math.cos(na), uy = Math.sin(na); ent.x = ux * (R + lift); ent.y = uy * (R + lift); ent.obj.quaternion.setFromUnitVectors(Y_AXIS, new THREE.Vector3(ux, uy, 0)); }
  } };
  return s;
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function emit(vehicle, group, dt) {
  const plume = group.userData.plume; const on = vehicle.thrust > 0.01;
  plume.visible = on; if (!on || dt <= 0) return;
  const h = P.altOf(vehicle), p = P.pressure(h), thr = vehicle.throttle;
  const len = (8 + 14 * thr) * (1 + (1 - p) * 1.5), wid = (1 + (1 - p) * 1.2) * (0.6 + 0.4 * thr);
  plume.scale.set(wid, len, wid); plume.children[0].material.opacity = 0.5 + 0.4 * Math.random();
  const nx = Math.cos(vehicle.ang), ny = Math.sin(vehicle.ang);
  const n = Math.min(6, Math.ceil(dt * 120));
  for (let i = 0; i < n; i++) {
    const sp = 60 + Math.random() * 40, spread = 6 + (1 - p) * 30;
    fire.spawn(vehicle.x - nx * 2, vehicle.y - ny * 2, (Math.random() - 0.5) * 1.5,
      vehicle.vx - nx * sp + (Math.random() - 0.5) * spread, vehicle.vy - ny * sp + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread,
      0.25 + Math.random() * 0.25, 2.5, 6 + (1 - p) * 10, 0xffd9a0, 0x200800, 2);
    if (p > 0.05 && Math.random() < 0.5 * p + 0.15) {
      const gk = h < 60 ? 1 : 0;
      smoke.spawn(vehicle.x - nx * 6, vehicle.y - ny * 6, (Math.random() - 0.5) * 3,
        vehicle.vx * 0.15 - nx * 30 * (1 - gk) + gk * (Math.random() - 0.5) * 70, vehicle.vy * 0.15 - ny * 30 * (1 - gk), (Math.random() - 0.5) * (8 + gk * 70),
        3 + Math.random() * 4 * p, 4, 14 + 14 * gk, p > 0.5 ? 0xe6e6e6 : 0xbfc6d0, null, 0.6);
    }
  }
}


// ---------- orbit line for map ----------
const lineGeo = new THREE.BufferGeometry(); const LN = 256; lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LN * 3), 3));
const mapLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x7dffa6, depthTest: false, transparent: true })); mapLine.renderOrder = 10; mapLine.frustumCulled = false; scene.add(mapLine);
const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff9a3c, depthTest: false, transparent: true })); marker.renderOrder = 11; scene.add(marker);
const bMarker = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9cc3ff, depthTest: false, transparent: true })); bMarker.renderOrder = 11; scene.add(bMarker);
function updateOrbitLine(ox, oy) {
  const o = P.orbitOf(v), w = Math.atan2(o.ey, o.ex), a = lineGeo.attributes.position.array;
  const maxNu = o.e < 1 ? Math.PI : Math.acos(-1 / o.e) * 0.98;
  for (let i = 0; i < LN; i++) {
    const nu = -maxNu + 2 * maxNu * i / (LN - 1); let r = o.p / (1 + o.e * Math.cos(nu));
    if (!(r > 0) || r > 5 * R) r = 5 * R;
    a[i * 3] = r * Math.cos(nu + w) - ox; a[i * 3 + 1] = r * Math.sin(nu + w) - oy; a[i * 3 + 2] = 0;
  }
  lineGeo.attributes.position.needsUpdate = true;
}

// ---------- HUD ----------
const fmtD = m => Math.abs(m) >= 1e5 ? (m / 1000).toFixed(0) + ' km' : Math.abs(m) >= 1000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(0) + ' m';
const fmtT = s => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };
let hudT = 0, predT = 0;
function hud() {
  const flags = F.flags, h = P.altOf(v), r = h + R, sp = Math.hypot(v.vx, v.vy), vr = (v.x * v.vx + v.y * v.vy) / r;
  const o = P.orbitOf(v), up = Math.atan2(v.y, v.x);
  const pitch = wrap(up - v.ang) * 180 / Math.PI;
  const onPad = v.clamped || (h < 300 && sp < 60);
  const apS = onPad ? '—' : !isFinite(o.ap) ? 'escape' : fmtD(o.ap), peS = onPad ? '—' : o.pe < -R * 0.5 ? '(in planet)' : fmtD(o.pe);
  const qc = v.q > 45 ? 'bad' : v.q > 25 ? 'warn' : '';
  const W = F.effWarp(), [wMax, wWhy] = F.warpLimit();
  const clock = !F.ignited ? 'T- HOLD (on pad)' : !flags.liftoff ? 'T- 0:00 IGNITION' : `T+ ${fmtT(F.met)}`;
  const autoTag = v.auto ? ` [AUTOPILOT ${v.guid || ''}]` : F.autoOn ? ` [AUTO ${v.guid || ''}]` : '';
  const fair = flags.fairing ? 'fairing jettisoned' : `fairing on (drops at ${P.FAIRING_ALT / 1000} km)`;
  let t = `${clock}\nALT   ${fmtD(h)}\nSPD   ${sp.toFixed(0)} m/s\nV/S   ${vr.toFixed(0)} m/s\nAp    ${apS}${F.autoOn && !onPad && v.guid !== 'done' && isFinite(o.ap) && vr > 0 ? `  in ${fmtT(P.timeToAp(v) / SIM_SPEED)}` : ''}\nPe    <span class="${o.pe > ATM ? 'good' : ''}">${peS}</span>\nPITCH ${pitch.toFixed(1)}° from vertical${autoTag}\nQ     <span class="${qc}">${v.q.toFixed(1)} kPa</span>  max ${F.maxQ.toFixed(1)}\nSTAGE ${v.cur + 1}/${v.stages.length}  ${fair}`;
  const b = booster;
  let bd = 0;
  if (b && b.state === 'flying') {
    const bu = Math.atan2(b.y, b.x), bvr = (b.x * b.vx + b.y * b.vy) / Math.hypot(b.x, b.y), bvh = (b.x * b.vy - b.y * b.vx) / Math.hypot(b.x, b.y);
    const ship = F.ship, direct = ship ? R * wrap(ship.ang - bu) : 0;
    if (ship && (P.altOf(b) < 3000 || (predT += 0.1) > 0.5)) { predT = 0; const ia = P.altOf(b) < 3000 ? null : P.predictImpact(b); b.miss = ia === null ? direct : R * wrap(ship.ang - ia); }
    bd = ship ? (b.miss ?? direct) : 0; const tilt = wrap(bu - b.ang) * 180 / Math.PI;
    const dirS = !ship ? '' : Math.abs(bd) < 15 ? 'ON TARGET ✔' : `miss ${fmtD(Math.abs(bd))} — ship is ${bd < 0 ? 'EAST →' : '← WEST'}`;
    const bt = `BOOSTER ${b.manual ? '(YOU)' : '(auto)'}\nALT   ${fmtD(P.altOf(b))}\nV/S   ${bvr.toFixed(0)} m/s   H ${(-bvh).toFixed(0)} m/s\nSHIP  ${dirS}\nTILT  ${tilt.toFixed(0)}°  THR ${(b.throttle * 100).toFixed(0)}%\nFUEL  ${b.stages[0].fuel.toFixed(2)} t  ${b.phase}`;
    t = b.manual ? bt + `\n\nUPPER ${fmtD(h)} Ap ${apS} Pe ${peS}${v.auto ? ' [AUTOPILOT ' + (v.guid || '') + ']' : ''}` : t + '\n' + bt.split('\n').slice(0, 2).join('  ');
  } else if (b) t += `\nBOOSTER ${b.state}`;
  $('tele').innerHTML = t;
  const ctlV = flyingBooster() ? b : v, thr = ctlV.throttle || 0;
  if ($('bars').children.length !== v.stages.length + 1) {
    $('bars').innerHTML = '<div class="bar"><span>THR</span><i id="thrBar"></i><b id="thrPct">0%</b></div>' + v.stages.map((_, i) => `<div class="bar fuel"><span>S${i + 1}</span><i id="fBar${i}"></i><b id="fPct${i}">100%</b></div>`).join('');
  }
  $('thrBar').style.height = thr * 100 + '%'; $('thrPct').textContent = Math.round(thr * 100) + '%';
  v.stages.forEach((st, i) => {
    const src = i === 0 && flyingBooster() ? b.stages[0] : st, live = i >= v.cur || (i === 0 && flyingBooster());
    const f = live ? src.fuel / src.fuelMax : 0;
    $('fBar' + i).style.height = f * 100 + '%'; $('fPct' + i).textContent = live ? Math.round(f * 100) + '%' : '—';
    $('fBar' + i).parentElement.classList.toggle('active', i === v.cur && !flyingBooster());
  });
  $('score').textContent = 'SCORE ' + F.score().toLocaleString();
  $('warpBtn').textContent = F.autoWarp ? `⏩ TO Ap ×${W}${W < WARPS[F.warpI] ? ' (' + wWhy + ')' : ''}` : `WARP ×${W}${W < WARPS[F.warpI] ? ` (max ×${wMax}: ${wWhy})` : ''}`;
  $('apBtn').classList.toggle('hidden', !F.canWarpToAp() || F.autoWarp);
  $('flyBtn').classList.toggle('hidden', !(b && b.state === 'flying' && F.ship && b.stages[0].fuel > 0));
  $('flyBtn').textContent = b && b.manual ? 'AUTO-LAND BOOSTER (L)' : 'FLY BOOSTER (L)';
  const hint = F.hint();
  $('hint').textContent = hint; $('hint').style.display = hint ? '' : 'none';
  $('ignite').classList.toggle('hidden', F.ignited || state !== 'flight');
}

// ---------- main loop ----------
let last = performance.now(), slowT = 0, pixR = Math.min(devicePixelRatio, 1.5);
const U = new THREE.Vector3(), E = new THREE.Vector3(), Zv = new THREE.Vector3(0, 0, 1), tgtV = new THREE.Vector3(), offV = new THREE.Vector3();
await renderer.compileAsync(scene, camera).catch(() => {});
$('loading') && $('loading').remove();
renderer.setAnimationLoop(() => {
  const now = performance.now(), rdt = Math.min(0.1, (now - last) / 1000); last = now;
  let pdt = rdt;
  slowT = rdt > 0.045 ? slowT + rdt : Math.max(0, slowT - rdt * 0.5);
  if (slowT > 2 && pixR > 0.6) { pixR = Math.max(0.6, pixR - 0.25); renderer.setPixelRatio(pixR); slowT = 0; console.info('[Orbit Rush] lowering render resolution to', pixR); }
  if (state === 'flight') {
    const rate = 0.45 * rdt;
    if (flyingBooster()) {
      const b = booster;
      if (keys.KeyW || keys.ArrowUp || keys.ShiftLeft) b.ut = Math.min(1, b.ut + rdt * 1.2);
      if (keys.KeyS || keys.ArrowDown || keys.ControlLeft) b.ut = Math.max(0, b.ut - rdt * 1.2);
      if (keys.KeyA || keys.ArrowLeft) { b.ang += rate * 1.5; b.retro = false; }
      if (keys.KeyD || keys.ArrowRight) { b.ang -= rate * 1.5; b.retro = false; }
    } else if (!F.flags.dead) {
      const anyKey = keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
      if (anyKey && v.auto) F.takeOverUpper();
      if (keys.KeyW || keys.ShiftLeft || keys.ArrowUp) v.ut = Math.min(1, v.ut + rdt * 0.8);
      if (keys.KeyS || keys.ControlLeft || keys.ArrowDown) v.ut = Math.max(0, v.ut - rdt * 0.8);
      if (!v.clamped) {
        const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
        if (steer) { v.ang += rate * steer; if (F.autoOn) { F.setAuto(false); $('tProg').classList.remove('on'); } }
      }
    }
    pdt = F.advance(rdt);
    if (swingArm && F.ignited && swingArm.rotation.y < 1.4) swingArm.rotation.y += rdt * 0.8;
  }
  // focus / floating origin
  const focus = (camMode === 'booster' && booster && (booster.state === 'flying' || booster.state === 'landed')) ? booster : v;
  const ox = focus.x, oy = focus.y;
  for (const w of world) w.obj.position.set(w.x - ox, w.y - oy, 0);
  rocketG.position.set(v.x - ox, v.y - oy, 0); rocketG.rotation.z = v.ang - Math.PI / 2;
  if (state === 'flight' && !F.flags.dead && SG[v.cur]) emit(v, SG[v.cur], pdt);
  else for (let j = v.cur; j < SG.length; j++) SG[j].userData.plume.visible = false;
  for (let k = debris.length - 1; k >= 0; k--) { // spent upper stages tumble away and are removed after a while
    const d = debris[k]; d.throttle = 0; let left = pdt; while (left > 0 && !d.gone) { const dt = Math.min(0.25, left); left -= dt; if (P.stepVehicle(d, dt)) d.gone = true; }
    d.ang += pdt * 0.3; d.t += pdt; d.mesh.position.set(d.x - ox, d.y - oy, 0); d.mesh.rotation.z = d.ang - Math.PI / 2;
    if (d.gone || d.t > 120) { scene.remove(d.mesh); debris.splice(k, 1); }
  }
  if (booster && booster.mesh.visible) {
    booster.mesh.position.set(booster.x - ox, booster.y - oy, 0); booster.mesh.rotation.z = booster.ang - Math.PI / 2;
    if (booster.state === 'flying') emit(booster, booster.mesh, pdt); else booster.mesh.userData.plume.visible = false;
  }
  // camera
  const fr = Math.hypot(ox, oy), ux = ox / fr, uy = oy / fr, h = fr - R;
  U.set(ux, uy, 0); E.set(uy, -ux, 0);
  const isMap = camMode === 'map';
  if (isMap) { camera.position.set(-ox, -oy, R * mapZoom); camera.up.set(0, 1, 0); camera.lookAt(-ox, -oy, 0); }
  else {
    tgtV.set(Math.cos(focus.ang), Math.sin(focus.ang), 0).multiplyScalar(focus === v ? Math.max(12, stackH() * 0.45) : 15);
    offV.copy(Zv).multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(E, Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(U, Math.sin(camPitch));
    camera.position.copy(tgtV).addScaledVector(offV, camDist); camera.up.copy(U); camera.lookAt(tgtV);
  }
  mapLine.visible = isMap && state === 'flight'; marker.visible = bMarker.visible = isMap;
  if (isMap) { updateOrbitLine(ox, oy); marker.position.set(v.x - ox, v.y - oy, 0); marker.scale.setScalar(R * mapZoom * 0.006); if (booster && booster.state === 'flying') { bMarker.position.set(booster.x - ox, booster.y - oy, 0); bMarker.scale.setScalar(R * mapZoom * 0.005); } else bMarker.visible = false; }
  stars.position.copy(camera.position);
  const k = Math.min(1, Math.max(0, h / 45000));
  scene.background.setRGB(0.48 * (1 - k) ** 2, 0.72 * (1 - k) ** 1.6, 1.0 * (1 - k) ** 1.2);
  if (isMap) scene.background.setRGB(0, 0, 0.01);
  stars.material.opacity = isMap ? 1 : Math.min(1, Math.max(0, k * 1.4 - 0.3));
  atmo.material.opacity = isMap ? 0.12 : 0.22 * (1 - k * 0.3);
  fire.update(pdt, ox, oy, camera.quaternion); smoke.update(pdt, ox, oy, camera.quaternion);
  if (rumble) {
    const watchB = booster && booster.state === 'flying' && camMode === 'booster';
    const th = state === 'flight' ? (watchB ? booster.thrust : F.flags.dead ? 0 : v.thrust) : 0;
    const p = P.pressure(h);
    rumble.gain.setTargetAtTime(Math.min(0.9, th / 300 * (0.25 + 0.75 * p)), ac.currentTime, 0.08);
    rumbleF.frequency.setTargetAtTime(150 + 500 * p, ac.currentTime, 0.2);
  }
  if (state === 'flight' && (hudT += rdt) > 0.1) { hudT = 0; hud(); }
  if (state === 'build') { camYaw += rdt * 0.15; camDist = Math.max(70, stackH() * 1.9); camera.setViewOffset(innerWidth, innerHeight, -innerWidth * 0.36, 0, innerWidth, innerHeight); }
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  renderer.render(scene, camera);
});
window.__game = { BUILD, get F() { return F; }, get v() { return v; }, get flags() { return F.flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return F.ship; }, press, get ignited() { return F.ignited; }, get warp() { return F.effWarp(); }, launch, goBuild, get design() { return design; }, setDesign: d => setDesign(cloneDesign(d)), get SG() { return SG; } };
