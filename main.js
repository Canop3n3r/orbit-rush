import * as THREE from 'three/webgpu';
import * as P from './physics.js';
const { R, MU, ATM } = P;
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SIM_SPEED = 2; // game time runs 2x real time; warp multiplies on top
const WARPS = [1, 2, 4, 10, 25, 50];
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
function makeStage1(cfg) {
  const g = new THREE.Group(), h = 10 + cfg.s1fuel * 0.75;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, h, 32), M.white); body.position.y = h / 2 + 1.5; g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.02, RAD + 0.02, 2.5, 32), M.black); band.position.y = h + 0.3; g.add(band);
  const n = cfg.engines;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, rr = n === 1 ? 0 : 1.05;
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.65, 1.6, 16), M.engine); e.position.set(Math.cos(a) * rr, 0.8, Math.sin(a) * rr); g.add(e);
  }
  const plume = makePlume(1.6 + n * 0.25); g.add(plume);
  const legs = new THREE.Group();
  for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 9, 0.35), M.black); const a = i * Math.PI / 2 + 0.78; l.position.set(Math.cos(a) * 3.3, 2.2, Math.sin(a) * 3.3); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); legs.add(l); }
  legs.visible = false; g.add(legs);
  const fins = new THREE.Group();
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.15), M.black); const a = i * Math.PI / 2; f.position.set(Math.cos(a) * (RAD + 0.7), h - 1, Math.sin(a) * (RAD + 0.7)); f.rotation.y = -a; fins.add(f); }
  g.add(fins);
  g.userData = { h: h + 1.5, plume, legs, scale: 1 + n * 0.25 };
  return g;
}
function makePlume(w) {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(w, 1, 24, 1, true), M.plume); outer.rotation.x = Math.PI; outer.position.y = -0.5; g.add(outer);
  const core = new THREE.Mesh(new THREE.ConeGeometry(w * 0.45, 1, 16, 1, true), M.plumeCore); core.rotation.x = Math.PI; core.position.y = -0.5; g.add(core);
  g.visible = false; return g;
}
function makeUpper(cfg) {
  const g = new THREE.Group(), h = 5 + cfg.s2fuel * 0.8;
  const inter = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 2, 32), M.black); inter.position.y = 1; g.add(inter);
  const e = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.1, 2, 16), M.engine); e.position.y = 0.6; g.add(e);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, h, 32), M.white); body.position.y = 2 + h / 2; g.add(body);
  const plume = makePlume(1.4); g.add(plume);
  const fair = new THREE.Group(), pay = P.OPTS.payload[cfg.payload];
  const fh = 5 + pay.m * 0.9;
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(RAD + 0.25, RAD, fh * 0.5, 32), M.white); cyl.position.y = fh * 0.25; fair.add(cyl);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.3, RAD + 0.25, fh * 0.7, 32), M.white); cone.position.y = fh * 0.5 + fh * 0.35; fair.add(cone);
  fair.position.y = 2 + h; g.add(fair);
  const payload = new THREE.Mesh(cfg.payload === 2 ? new THREE.ConeGeometry(1.6, 3, 24) : new THREE.BoxGeometry(2, 1 + pay.m * 0.5, 2), new THREE.MeshStandardMaterial({ color: cfg.payload === 2 ? 0xdddddd : 0xc9a34a, metalness: 0.6, roughness: 0.3 }));
  payload.position.y = 2 + h + 1.6; g.add(payload);
  g.userData = { h: 2 + h + fh * 1.2, plume, fair };
  return g;
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

// ---------- build screen ----------
const cfg = { engines: 3, s1fuel: 25, s2fuel: 6, payload: 1 };
const labels = { engines: v => v + '×', s1fuel: v => v + ' t', s2fuel: v => v + ' t', payload: (v, i) => P.OPTS.payload[i].name };
document.querySelectorAll('.opts').forEach(el => {
  const k = el.dataset.k;
  P.OPTS[k].forEach((v, i) => {
    const b = document.createElement('button'); b.textContent = labels[k](v, i);
    const val = k === 'payload' ? i : v; b.onclick = () => { cfg[k] = val; refreshBuild(); }; b.dataset.v = val; el.appendChild(b);
  });
});
function refreshBuild() {
  document.querySelectorAll('.opts').forEach(el => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v === cfg[el.dataset.k])));
  const s = P.rocketStats(cfg);
  const twrC = s.twr < 1 ? 'bad' : s.twr < 1.2 ? 'warn' : 'good', dvC = s.total < 3600 ? 'bad' : s.total < 4200 ? 'warn' : 'good';
  $('stats').innerHTML = `Liftoff mass ${s.mass.toFixed(1)} t<br>Liftoff TWR <span class="${twrC}">${s.twr.toFixed(2)}</span>${s.twr < 1 ? ' — too heavy to lift off!' : ''}<br>Δv  S1 ${s.dv[0].toFixed(0)} + S2 ${s.dv[1].toFixed(0)} = <span class="${dvC}">${s.total.toFixed(0)} m/s</span><br><span style="opacity:.7">Orbit needs ~3,600 m/s. Extra Δv = fuel to land the booster.</span>`;
  if (state === 'build') showPreview();
}

// ---------- game state ----------
let state = 'build', v, booster, rocketG, s1G, upG, warpI, met, maxQ, progHold, camMode, flags, score, ship, endShown, pendingEnd, autoWarp, gen = 0, ignited, liftoffT, upperTakeover;
const dyn = []; // world entries created during a flight (droneship, ocean) — removed on reset
const keys = {};
function later(fn, ms) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }
function showPreview() {
  if (rocketG) scene.remove(rocketG);
  rocketG = new THREE.Group(); s1G = makeStage1(cfg); upG = makeUpper(cfg); upG.position.y = s1G.userData.h; rocketG.add(s1G, upG); scene.add(rocketG);
  v = P.buildRocket(cfg); v.y = R + PAD_Z; v.ut = 0;
}
function reset() {
  gen++;
  if (booster && booster.mesh) scene.remove(booster.mesh);
  for (const w of dyn) { scene.remove(w.obj); const i = world.indexOf(w); if (i >= 0) world.splice(i, 1); }
  dyn.length = 0; ship = null; booster = null;
  met = 0; maxQ = 0; progHold = false; warpI = 0; camMode = 'chase'; endShown = false; pendingEnd = false; autoWarp = false; ignited = false; liftoffT = 0; upperTakeover = false;
  camDist = 70; camYaw = 0.5; camPitch = 0.12; mapZoom = 2.8;
  flags = { liftoff: 0, maxq: 0, space: 0, orbit: 0, booster: '', boosterBonus: 0, dead: '', fairing: 0, maxAlt: 0, stranded: 0, cutoff: 0 };
  score = 0; fire.clear(); smoke.clear(); for (const k in keys) keys[k] = false;
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
$('contBtn').onclick = () => $('end').classList.add('hidden');
function shareText() { return `🚀 I scored ${score.toLocaleString()} in Orbit Rush${flags.orbit ? ' — reached orbit' : ''}${flags.boosterBonus ? ' and landed the booster' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');
function toast(msg, color = '#7dffa6') { const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); while ($('toasts').children.length > 3) $('toasts').firstChild.remove(); }

// ---------- input ----------
const flyingBooster = () => booster && booster.state === 'flying' && booster.manual;
function canStage() { return ignited && !v.clamped && met - liftoffT > 3 && P.altOf(v) > 150; }
function setWarp(i, quiet) { warpI = Math.max(0, Math.min(WARPS.length - 1, i)); if (!quiet) toast('Time warp ×' + WARPS[warpI], '#9cc3ff'); }
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'KeyR') { goBuild(); return; }
  if (code === 'KeyM') { camMode = camMode === 'map' ? (flyingBooster() ? 'booster' : 'chase') : 'map'; return; }
  if (code === 'KeyT') { autoWarp = false; setWarp(warpI + 1 >= WARPS.length ? 0 : warpI + 1); return; }
  if (code === 'Comma') { autoWarp = false; setWarp(warpI - 1); return; }
  if (code === 'KeyG') { startAutoWarp(); return; }
  if (code === 'KeyL') { toggleBoosterControl(); return; }
  if (code === 'KeyB') { if (booster && booster.state === 'flying') camMode = camMode === 'booster' ? 'chase' : 'booster'; else toast('No booster in flight', '#ffb35c'); return; }
  if (flags.dead) return;
  if (flyingBooster()) { // controls go to the booster
    const b = booster;
    if (code === 'KeyZ') b.ut = 1; if (code === 'KeyX') b.ut = 0;
    if (code === 'KeyF') { b.retro = !b.retro; toast(b.retro ? 'Holding retrograde' : 'Manual tilt', '#9cc3ff'); }
    return;
  }
  if (v.auto && ['KeyZ', 'KeyX', 'KeyF', 'Space'].includes(code)) takeOverUpper();
  if (code === 'Space') doStage();
  if (code === 'KeyZ') v.ut = 1;
  if (code === 'KeyX') v.ut = 0;
  if (code === 'KeyF') { progHold = !progHold; toast(progHold ? 'AUTO on: gravity turn, Max-Q throttle, auto cutoff' : 'Manual steering', '#9cc3ff'); }
  $('tProg').classList.toggle('on', progHold);
}
function takeOverUpper() { if (v.auto) { v.auto = false; v.ut = v.throttle; toast('You have the upper stage', '#9cc3ff'); } }
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

// ---------- flight logic ----------
function doStage() {
  if (!ignited) { ignited = true; v.ut = 1; burst(0.6, 1.2, 500); toast('IGNITION', '#ffb35c'); $('ignite').classList.add('hidden'); return; }
  if (v.cur === 0) {
    if (!canStage()) { toast('Clear the tower first!', '#ffb35c'); return; }
    const bh = P.altOf(v);
    booster = P.makeBooster(v); booster.mesh = s1G; booster.ut = 0; booster.manual = false; booster.maxH = bh; booster.stagedAlt = bh;
    rocketG.remove(s1G); scene.add(s1G); s1G.userData.plume.visible = false;
    v.cur = 1; upG.position.y = 0; burst(0.5, 0.6, 1500); beep(660);
    const fuel = booster.stages[0].fuel;
    if (fuel > 0.3 && bh > 2000) {
      const a = P.predictImpact(booster); if (a !== null) ship = makeShip(a);
      toast(`STAGE SEP — booster has ${fuel.toFixed(1)} t. Press L to fly it!`, '#fff');
    } else toast(bh <= 2000 ? 'STAGE SEP — too low for booster recovery' : 'STAGE SEP — booster is dry', '#fff');
    for (let i = 0; i < 25; i++) smoke.spawn(v.x, v.y, 0, v.vx + (Math.random() - 0.5) * 20, v.vy + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 1.5, 2, 8, 0xdddddd, null, 0.5);
  } else if (v.fairing > 0 && P.altOf(v) > 30000) jettison();
}
function toggleBoosterControl() {
  const b = booster;
  if (!b || b.state !== 'flying') { toast('No booster in flight', '#ffb35c'); return; }
  if (!ship || b.stages[0].fuel <= 0) { toast('This booster can\'t be recovered', '#ffb35c'); return; }
  b.manual = !b.manual;
  if (b.manual) { b.ut = 0; b.retro = true; v.auto = !flags.dead; autoWarp = false; camMode = 'booster'; camDist = 140; toast('YOU HAVE THE BOOSTER — upper stage on autopilot', '#ffd23a'); }
  else { camMode = 'chase'; toast('Booster on auto-land (smaller bonus)', '#9cc3ff'); }
}
function jettison() { v.fairing = 0; upG.userData.fair.visible = false; flags.fairing = 1; toast('Fairing separation', '#9cc3ff'); beep(990); }
function explode(x, y, vx, vy, big) {
  burst(big ? 1.2 : 0.7, 2.5, 700);
  for (let i = 0; i < (big ? 220 : 120); i++) {
    const a = Math.random() * 6.283, b = Math.random() * 3.14, s = Math.random() * (big ? 70 : 45);
    fire.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * Math.sin(b) * s, vy * 0.3 + Math.sin(a) * Math.sin(b) * s, Math.cos(b) * s, 0.6 + Math.random() * 1.4, 4, 14, 0xfff0b0, 0x401000, 1.2);
    if (i % 2) smoke.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * s * 0.5, vy * 0.3 + Math.sin(a) * s * 0.5, (Math.random() - 0.5) * s, 4 + Math.random() * 4, 6, 26, 0x2b2b2b, null, 0.8);
  }
}
function fail(reason) {
  if (flags.dead) return; flags.dead = reason; explode(v.x, v.y, v.vx, v.vy, true); rocketG.visible = false; v.throttle = v.ut = 0; autoWarp = false; warpI = 0;
  toast('RUD — ' + reason, '#ff6262'); later(() => showEnd(), 2800);
}
function addScore() {
  let s = 0; const o = P.orbitOf(v), mult = P.OPTS.payload[cfg.payload].mult;
  s += Math.min(flags.maxAlt || 0, ATM) / 100;
  if (flags.space) s += 1000;
  if (flags.orbit) { s += 3000; if (isFinite(o.ap)) s += Math.max(0, 1500 - Math.abs(o.ap - o.pe) / 40); s += (v.stages[1].fuel / v.stages[1].fuelMax) * 800; }
  s *= mult;
  s += flags.boosterBonus;
  if (flags.dead) s *= 0.5;
  score = Math.round(s); return score;
}
function showEnd() {
  if (endShown) return; endShown = true; addScore(); warpI = 0; autoWarp = false;
  const o = P.orbitOf(v), ok = flags.orbit && !flags.dead;
  $('endTitle').innerHTML = flags.dead ? '💥 Rapid Unscheduled Disassembly' : ok ? '🛰️ Orbit achieved!' : flags.stranded ? '🪂 Out of fuel — suborbital' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  if (flags.stranded && !flags.dead) lines.push(`<span class="warn">Ran out of fuel before orbit (Pe ${(o.pe / 1000).toFixed(0)} km). Needs more Δv or a flatter climb.</span>`);
  lines.push(`Max altitude: ${((flags.maxAlt || 0) / 1000).toFixed(1)} km`, `Max-Q: ${maxQ.toFixed(1)} kPa`);
  if (flags.space) lines.push('<span class="good">✔ Reached space (70 km)</span>');
  if (flags.orbit) lines.push(`<span class="good">✔ Orbit — Ap ${isFinite(o.ap) ? (o.ap / 1000).toFixed(0) + ' km' : 'escape'} / Pe ${(o.pe / 1000).toFixed(0)} km</span>`);
  if (flags.booster) lines.push(flags.boosterBonus ? `<span class="good">✔ Booster ${flags.booster} (+${flags.boosterBonus})</span>` : `<span class="warn">✘ Booster ${flags.booster}</span>`);
  lines.push(`Payload: ${P.OPTS.payload[cfg.payload].name} (×${P.OPTS.payload[cfg.payload].mult})`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  $('endBody').innerHTML = lines.join('<br>');
  $('contBtn').classList.toggle('hidden', !!flags.dead || !!flags.stranded);
  $('end').classList.remove('hidden');
}
function startAutoWarp() {
  const h = P.altOf(v), vr = (v.x * v.vx + v.y * v.vy) / (h + R);
  if (flyingBooster()) { toast('Land the booster first!', '#ffb35c'); return; }
  if (v.thrust > 0 || vr <= 20 || h < 15000) { toast('Warp to Ap: coast upward first (engines off, above 15 km)', '#ffb35c'); return; }
  autoWarp = true; toast('Warping to apoapsis…', '#9cc3ff');
}
function steerToward(veh, tgt, rate, dt) { const d = wrap(tgt - veh.ang); veh.ang += Math.max(-rate * dt, Math.min(rate * dt, d)); }

function landBooster(b, sp) {
  const r = Math.hypot(b.x, b.y), up = Math.atan2(b.y, b.x), tilt = Math.abs(wrap(b.ang - up));
  const dist = ship ? R * Math.abs(wrap(up - ship.ang)) : 1e9;
  b.vx = b.vy = 0; b.throttle = 0; b.mesh.userData.plume.visible = false;
  if (b.maxH < 2000) { b.state = 'lost'; flags.booster = 'lost (staged too low)'; explode(b.x, b.y, 0, 0); b.mesh.visible = false; return; }
  if (b.manual) {
    if (sp < 8 && tilt < 0.25 && dist < 35) {
      b.state = 'landed'; flags.boosterBonus = 2500 + Math.round((35 - dist) * 25) + Math.round((8 - sp) * 80);
      flags.booster = `landed by hand — ${dist.toFixed(1)} m off center at ${sp.toFixed(1)} m/s`; toast(`🎯 YOU LANDED IT! +${flags.boosterBonus}`, '#7dffa6'); beep(1500); setTimeout(() => beep(1900), 180);
    } else { b.state = 'lost'; flags.booster = sp < 8 && dist >= 35 ? `missed the droneship by ${(dist - 35).toFixed(0)} m` : sp < 8 ? 'tipped over (too tilted)' : `crashed at ${sp.toFixed(0)} m/s`; explode(b.x, b.y, 0, 0); b.mesh.visible = false; toast('Booster lost — ' + flags.booster, '#ff6262'); }
  } else if (sp < 10) { b.state = 'landed'; flags.boosterBonus = 1000; flags.booster = 'auto-landed on the droneship'; toast('🎯 BOOSTER AUTO-LANDED +1000', '#7dffa6'); beep(1500); }
  else { b.state = 'lost'; flags.booster = `crashed at ${sp.toFixed(0)} m/s (needed more fuel)`; explode(b.x, b.y, 0, 0); b.mesh.visible = false; toast('Booster lost', '#ff6262'); }
  if (b.state === 'landed') { const k = (R + (dist < 40 ? DECK : 0)) / r; b.x *= k; b.y *= k; b.ang = up; }
  if (camMode === 'booster') later(() => { if (camMode === 'booster') camMode = 'chase'; }, 3000);
}

function simStep(dt) {
  if (!flags.dead) {
    const h0 = P.altOf(v);
    // steering & throttle for the rocket
    if (v.auto) P.upperAutopilot(v);
    else if (ignited) {
      if (progHold && !v.clamped) {
        steerToward(v, P.assistAngle(v), 0.8, dt);
        const o = P.orbitOf(v);
        if (o.pe > P.TARGET_PE && h0 > ATM && v.ut > 0) { v.ut = 0; if (!flags.cutoff) { flags.cutoff = 1; toast('AUTO cutoff — orbit reached', '#7dffa6'); } }
        v.throttle = Math.min(v.ut, P.autoThrottle(v));
      } else v.throttle = v.ut;
    } else v.throttle = 0;
    const st = v.stages[v.cur];
    const e = P.stepVehicle(v, dt);
    const h = P.altOf(v);
    if (v.q > maxQ) maxQ = v.q;
    if (e === 'ground') { fail(met - liftoffT < 8 ? 'never cleared the tower' : 'hit the ground'); }
    else {
      if (v.q > 80) fail('over-pressure (Max-Q too high)');
      else if (v.q > 15 && v.aoa > 0.26) fail('aerodynamic breakup — turned too hard');
      if (!v.clamped && !flags.liftoff) { flags.liftoff = 1; liftoffT = met; toast('LIFTOFF!', '#fff'); }
      if (v.clamped && ignited && v.throttle > 0.95) { flags.padTime = (flags.padTime || 0) + dt; if (flags.padTime > 6 || (st && st.fuel <= 0)) fail('too heavy to lift off (TWR < 1)'); }
      flags.maxAlt = Math.max(flags.maxAlt, h);
      if (!flags.maxq && maxQ > 8 && v.q < maxQ * 0.8) { flags.maxq = 1; toast('Max-Q passed', '#9cc3ff'); }
      if (!flags.space && h > ATM) { flags.space = 1; toast('🌌 SPACE! +1000', '#b98cff'); beep(1200); }
      if (!flags.fairing && v.cur === 1 && h > 45000) jettison();
      const o = P.orbitOf(v);
      if (h > ATM && !flags.orbit && o.pe > ATM) { flags.orbit = 1; toast('🛰️ ORBIT ACHIEVED! +3000', '#7dffa6'); beep(1320); setTimeout(() => beep(1760), 200); }
      // stranded: out of fuel in the last stage without orbit -> fast-forward to the outcome
      if (!flags.orbit && !flags.stranded && v.cur === 1 && v.stages[1].fuel <= 0) { flags.stranded = 1; toast('Out of fuel — suborbital', '#ffb35c'); later(() => { if (!flags.orbit) showEnd(); }, 2500); }
    }
  }
  if (booster && booster.state === 'flying') {
    const b = booster, bh0 = P.altOf(b);
    if (b.manual) {
      if (b.retro && Math.hypot(b.vx, b.vy) > 3) steerToward(b, Math.atan2(-b.vy, -b.vx), 1.2, dt);
      b.throttle = b.stages[0].fuel > 0 ? b.ut : 0; b.n = bh0 > 12000 ? Math.min(3, b.nMax) : 1;
      b.phase = b.throttle > 0 ? 'burning' : 'falling';
    } else P.boosterAutopilot(b);
    const e = P.stepVehicle(b, dt);
    const bh = P.altOf(b), sp = Math.hypot(b.vx, b.vy); b.maxH = Math.max(b.maxH, bh);
    if (bh < 25000 && sp > 1400 && b.x * b.vx + b.y * b.vy < 0) { b.state = 'lost'; flags.booster = 'burned up on reentry (do an entry burn)'; explode(b.x, b.y, b.vx, b.vy); b.mesh.visible = false; toast('Booster burned up', '#ff6262'); }
    if (ship && !b.manual && bh < 9000 && !ship.moved) { ship.setAngle(Math.atan2(b.y, b.x) - 0.0005); ship.moved = true; }
    if (bh < 3000) b.mesh.userData.legs.visible = true;
    if (b.state === 'flying') {
      const nearShip = ship && R * Math.abs(wrap(Math.atan2(b.y, b.x) - ship.ang)) < 40;
      if (e === 'ground' || (nearShip && bh < DECK)) landBooster(b, sp);
    }
  }
  met += dt;
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
function effWarp() {
  let w = WARPS[warpI]; const h = P.altOf(v);
  if (h < ATM && v.thrust > 0) w = Math.min(w, 4);
  if (booster && booster.state === 'flying' && P.altOf(booster) < 40000) w = Math.min(w, booster.manual ? 1 : 4);
  if (!ignited || flags.dead) w = 1;
  return w;
}
let hudT = 0, predT = 0;
function hud() {
  const h = P.altOf(v), r = h + R, sp = Math.hypot(v.vx, v.vy), vr = (v.x * v.vx + v.y * v.vy) / r;
  const o = P.orbitOf(v), up = Math.atan2(v.y, v.x);
  const pitch = wrap(up - v.ang) * 180 / Math.PI;
  const onPad = v.clamped || (h < 300 && sp < 60);
  const apS = onPad ? '—' : !isFinite(o.ap) ? 'escape' : fmtD(o.ap), peS = onPad ? '—' : o.pe < -R * 0.5 ? '(in planet)' : fmtD(o.pe);
  const qc = v.q > 45 ? 'bad' : v.q > 25 ? 'warn' : '';
  const W = effWarp();
  let t = `T+ ${fmtT(met)}\nALT   ${fmtD(h)}\nSPD   ${sp.toFixed(0)} m/s\nV/S   ${vr.toFixed(0)} m/s\nAp    ${apS}\nPe    <span class="${o.pe > ATM ? 'good' : ''}">${peS}</span>\nPITCH ${pitch.toFixed(1)}° from vertical${v.auto ? ' [AUTOPILOT]' : progHold ? ' [AUTO]' : ''}\nQ     <span class="${qc}">${v.q.toFixed(1)} kPa</span>  max ${maxQ.toFixed(1)}\nSTAGE ${v.cur + 1}/2  ${flags.fairing ? '' : 'fairing on'}`;
  const b = booster;
  let bd = 0;
  if (b && b.state === 'flying') {
    const bu = Math.atan2(b.y, b.x), bvr = (b.x * b.vx + b.y * b.vy) / Math.hypot(b.x, b.y), bvh = (b.x * b.vy - b.y * b.vx) / Math.hypot(b.x, b.y);
    const direct = ship ? R * wrap(ship.ang - bu) : 0;
    if (ship && (P.altOf(b) < 3000 || (predT += 0.1) > 0.5)) { predT = 0; const ia = P.altOf(b) < 3000 ? null : P.predictImpact(b); b.miss = ia === null ? direct : R * wrap(ship.ang - ia); }
    bd = ship ? (b.miss ?? direct) : 0; const tilt = wrap(bu - b.ang) * 180 / Math.PI;
    const dirS = !ship ? '' : Math.abs(bd) < 15 ? 'ON TARGET ✔' : `miss ${fmtD(Math.abs(bd))} — ship is ${bd < 0 ? 'EAST →' : '← WEST'}`;
    const bt = `BOOSTER ${b.manual ? '(YOU)' : '(auto)'}\nALT   ${fmtD(P.altOf(b))}\nV/S   ${bvr.toFixed(0)} m/s   H ${(-bvh).toFixed(0)} m/s\nSHIP  ${dirS}\nTILT  ${tilt.toFixed(0)}°  THR ${(b.throttle * 100).toFixed(0)}%\nFUEL  ${b.stages[0].fuel.toFixed(2)} t  ${b.phase}`;
    t = b.manual ? bt + `\n\nUPPER ${fmtD(h)} Ap ${apS} Pe ${peS}` : t + '\n' + bt.split('\n').slice(0, 2).join('  ');
  } else if (b) t += `\nBOOSTER ${b.state}`;
  $('tele').innerHTML = t;
  const ctlV = flyingBooster() ? b : v;
  $('thrBar').style.height = (ctlV.throttle || 0) * 100 + '%';
  $('f1Bar').style.height = (flyingBooster() ? b.stages[0].fuel / b.stages[0].fuelMax : v.cur === 0 ? v.stages[0].fuel / v.stages[0].fuelMax : 0) * 100 + '%';
  $('f2Bar').style.height = v.stages[1].fuel / v.stages[1].fuelMax * 100 + '%';
  $('score').textContent = 'SCORE ' + addScore().toLocaleString();
  $('warpBtn').textContent = `WARP ×${W * SIM_SPEED / 2 >= 1 ? W : W}${autoWarp ? ' (auto)' : ''}${W < WARPS[warpI] ? ' (limited)' : ''}`;
  const canAp = !flags.dead && !flyingBooster() && v.thrust <= 0 && vr > 20 && h > 15000 && !flags.orbit;
  $('apBtn').classList.toggle('hidden', !canAp || autoWarp);
  $('flyBtn').classList.toggle('hidden', !(b && b.state === 'flying' && ship && b.stages[0].fuel > 0));
  $('flyBtn').textContent = b && b.manual ? 'AUTO-LAND BOOSTER (L)' : 'FLY BOOSTER (L)';
  // hints
  const engineOn = v.thrust > 0, s1 = v.stages[0], s2 = v.stages[1], fuelLeft = v.cur === 0 ? s1.fuel + s2.fuel : s2.fuel;
  let hint = '';
  if (flags.dead) hint = 'Press R to go back to the hangar';
  else if (flyingBooster()) {
    const bh = P.altOf(b), bsp = Math.hypot(b.vx, b.vy);
    if (b.stages[0].fuel <= 0) hint = 'Out of fuel… brace!';
    else if (bh > 25000 && bsp > 1150) hint = 'ENTRY BURN: F = hold retrograde, Z = full throttle until under 1,100 m/s';
    else if (bh > 4000) hint = Math.abs(bd) > 150 ? `Predicted miss ${fmtD(Math.abs(bd))}: tilt ${bd < 0 ? 'D (east)' : 'A (west)'} + small throttle` : 'On target! Coast (X), hold retrograde (F), landing burn at ~3 km';
    else hint = 'LANDING BURN: W/S throttle to ~5 m/s at touchdown. Keep it upright (F)';
  }
  else if (!ignited) hint = '';
  else if (v.clamped) hint = 'Not enough thrust… lighten the rocket';
  else if (v.auto) hint = 'Upper stage on autopilot — press Z/X/F/Space to take over';
  else if (!progHold && h < 8000 && sp < 400) hint = 'Press F for AUTO (gravity turn), or steer east yourself with D';
  else if (qc && engineOn && !progHold) hint = 'HIGH Q — throttle down (S)';
  else if (v.cur === 0 && s1.fuel <= 0) hint = 'Booster empty — SPACE to stage!';
  else if (v.cur === 0 && h > 15000) hint = 'SPACE to stage — leave a few tonnes in the booster to land it';
  else if (fuelLeft <= 0 && !flags.orbit) hint = 'Out of fuel — suborbital';
  else if (flags.orbit) hint = engineOn ? 'In orbit! Cut throttle (X)' : b && b.state === 'flying' ? 'Orbit! Watch the booster: B · fly it: L' : 'Orbit achieved 🛰️';
  else if (engineOn && isFinite(o.ap) && o.ap > 80000 && h < ATM - 5000 && !progHold) hint = 'Ap is high enough — cut throttle (X) and coast';
  else if (!engineOn && h < ATM && vr > 0) hint = h > 15000 ? 'Coasting — press "Warp to Ap" (G)' : 'Coasting…';
  else if (h > ATM - 3000 || (!engineOn && vr <= 20)) hint = vr > 60 && !engineOn ? 'Warp to Ap (G), then burn prograde' : engineOn ? 'Burn until Pe > 70 km' : 'Burn now! F then Z (full throttle)';
  else if (engineOn && progHold) hint = 'AUTO flying the gravity turn — stage when the booster is low';
  else if (progHold && v.ut > 0 && !engineOn && fuelLeft > 0) hint = vr > 20 && h > 15000 ? 'AUTO coasting to apoapsis — press G to warp there' : 'AUTO will burn at apoapsis';
  $('hint').textContent = hint; $('hint').style.display = hint ? '' : 'none';
  $('ignite').classList.toggle('hidden', ignited || state !== 'flight');
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
    } else if (!flags.dead) {
      const anyKey = keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
      if (anyKey && v.auto) takeOverUpper();
      if (keys.KeyW || keys.ShiftLeft || keys.ArrowUp) v.ut = Math.min(1, v.ut + rdt * 0.8);
      if (keys.KeyS || keys.ControlLeft || keys.ArrowDown) v.ut = Math.max(0, v.ut - rdt * 0.8);
      if (!v.clamped) {
        if (keys.KeyA || keys.ArrowLeft) { v.ang += rate; if (progHold) { progHold = false; $('tProg').classList.remove('on'); } }
        if (keys.KeyD || keys.ArrowRight) { v.ang -= rate; if (progHold) { progHold = false; $('tProg').classList.remove('on'); } }
      }
    }
    if (autoWarp) {
      const h = P.altOf(v), r = h + R, vr = (v.x * v.vx + v.y * v.vy) / r, g = MU / (r * r), tAp = vr / g;
      if (v.thrust > 0 || flags.dead || flyingBooster()) autoWarp = false;
      else if (tAp < 8) { autoWarp = false; setWarp(0, true); toast('At apoapsis — BURN! (F + Z)', '#ffd23a'); beep(1000); }
      else setWarp(tAp > 120 ? 5 : tAp > 50 ? 4 : tAp > 20 ? 3 : 2, true);
    }
    const W = effWarp(), simDt = rdt * SIM_SPEED * W;
    const step = W > 4 ? 1 / 30 : 1 / 120, N = Math.ceil(simDt / step);
    for (let i = 0; i < N; i++) simStep(simDt / N);
    pdt = simDt;
    if (!endShown && !pendingEnd && !flags.dead && flags.orbit && (!booster || booster.state !== 'flying') && v.thrust <= 0) { pendingEnd = true; later(() => { if (!endShown && !flags.dead) showEnd(); }, 2500); }
    if (swingArm && ignited && swingArm.rotation.y < 1.4) swingArm.rotation.y += rdt * 0.8;
  }
  // focus / floating origin
  const focus = (camMode === 'booster' && booster && (booster.state === 'flying' || booster.state === 'landed')) ? booster : v;
  const ox = focus.x, oy = focus.y;
  for (const w of world) w.obj.position.set(w.x - ox, w.y - oy, 0);
  rocketG.position.set(v.x - ox, v.y - oy, 0); rocketG.rotation.z = v.ang - Math.PI / 2;
  if (state === 'flight' && !flags.dead) emit(v, v.cur === 0 ? s1G : upG, pdt);
  else { s1G.userData.plume.visible = false; upG.userData.plume.visible = false; }
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
    tgtV.set(Math.cos(focus.ang), Math.sin(focus.ang), 0).multiplyScalar(focus === v ? 18 : 15);
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
    const th = state === 'flight' ? (watchB ? booster.thrust : flags.dead ? 0 : v.thrust) : 0;
    const p = P.pressure(h);
    rumble.gain.setTargetAtTime(Math.min(0.9, th / 300 * (0.25 + 0.75 * p)), ac.currentTime, 0.08);
    rumbleF.frequency.setTargetAtTime(150 + 500 * p, ac.currentTime, 0.2);
  }
  if (state === 'flight' && (hudT += rdt) > 0.1) { hudT = 0; hud(); }
  if (state === 'build') camYaw += rdt * 0.15;
  renderer.render(scene, camera);
});
window.__game = { get v() { return v; }, get flags() { return flags; }, get state() { return state; }, isGPU, gpuReason, get booster() { return booster; }, get ship() { return ship; }, press, get ignited() { return ignited; }, get warp() { return effWarp(); } };
