import * as THREE from 'three/webgpu';
import * as P from './physics.js';
const { R, MU, ATM } = P;
const $ = id => document.getElementById(id);
const SIM_SPEED = 2; // game time runs 2x real time; T adds warp on top
const WARPS = [1, 2, 4, 8];

// ---------- renderer ----------
const renderer = new THREE.WebGPURenderer({ antialias: true, logarithmicDepthBuffer: true, forceWebGL: new URLSearchParams(location.search).has('webgl') });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
await renderer.init();
const isGPU = !!renderer.backend.isWebGPUBackend;
$('badge').textContent = isGPU ? '⚡ WebGPU' : 'WebGL2';
if (isGPU) $('badge').classList.add('gpu');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ab8ff);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 4e7);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x334433, 1.0));
const sunL = new THREE.DirectionalLight(0xffffff, 2.4); sunL.position.set(0.6, 0.7, 0.9); scene.add(sunL);

// ---------- procedural textures ----------
function hash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v), L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}
function fbm(x, y, z) { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 5; i++) { a += amp * vnoise(x * f, y * f, z * f); f *= 2.1; amp *= 0.5; } return a; }
function planetTexture() {
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
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
  for (let i = 0; i < 4000; i++) { const b = Math.random() ** 3; c.fillStyle = `rgba(${200 + 55 * Math.random()},${210 + 45 * Math.random()},255,${0.3 + b * 0.7})`; const s = b > 0.9 ? 2 : 1; c.fillRect(Math.random() * 2048, Math.random() * 1024, s, s); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- world (positions are planet-centred, rendered relative to a floating origin) ----------
const world = []; // {obj, x, y}
function place(obj, x, y) { world.push({ obj, x, y }); scene.add(obj); return obj; }
const planetGeo = new THREE.SphereGeometry(R, 512, 256); planetGeo.rotateX(Math.PI / 2);
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
function patch(angle, color, size) {
  const g = new THREE.CircleGeometry(size, 64); g.rotateX(-Math.PI / 2);
  return surfaceObj(angle, new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 1 })), 0.02);
}
const PAD_ANG = Math.PI / 2;
patch(PAD_ANG, 0x4f6b3a, 60000);
patch(PAD_ANG + 0.02, 0x1d4f8a, 40000).position; // coastline/ocean east of pad
{ // launch complex
  const g = new THREE.Group();
  const conc = new THREE.Mesh(new THREE.CylinderGeometry(30, 34, 3, 32), new THREE.MeshStandardMaterial({ color: 0x8a8a88 })); conc.position.y = -1.4; g.add(conc);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 70, 4), new THREE.MeshStandardMaterial({ color: 0x9a3b2a, roughness: 0.6 })); tower.position.set(-9, 35, 0); g.add(tower);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 2), tower.material); arm.position.set(-5, 50, 0); g.add(arm);
  for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 30), new THREE.MeshStandardMaterial({ color: 0xcccccc })); l.position.set(Math.cos(i) * 25, 15, Math.sin(i) * 25); g.add(l); }
  surfaceObj(PAD_ANG, g, 0.05);
}

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

// ---------- particles (instanced camera-facing quads; works on WebGPU and WebGL) ----------
const softTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
class Particles {
  constructor(n, additive) {
    this.n = n; this.i = 0; this.d = Array.from({ length: n }, () => ({ life: 0 }));
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: softTex, transparent: true, depthWrite: false, opacity: additive ? 1 : 0.7, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }), n);
    this.mesh.frustumCulled = false; this.c = new THREE.Color(); this.c2 = new THREE.Color(); this.m = new THREE.Matrix4(); this.p = new THREE.Vector3(); this.s = new THREE.Vector3();
    for (let i = 0; i < n; i++) { this.mesh.setColorAt(i, this.c.set(0)); this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0)); }
    scene.add(this.mesh);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, drag) {
    const p = this.d[this.i]; this.i = (this.i + 1) % this.n;
    Object.assign(p, { x, y, z, vx, vy, vz, life, max: life, s0, s1, c0, c1, drag });
  }
  update(dt, ox, oy, q) {
    for (let i = 0; i < this.n; i++) {
      const p = this.d[i];
      if (p.life <= 0) { this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); continue; }
      p.life -= dt; const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - Math.max(p.life, 0) / p.max, s = p.s0 + (p.s1 - p.s0) * t;
      const fade = p.c1 === null ? (t > 0.7 ? (1 - t) / 0.3 : 1) : 1;
      this.p.set(p.x - ox, p.y - oy, p.z); this.s.setScalar(s * fade);
      this.m.compose(this.p, q, this.s); this.mesh.setMatrixAt(i, this.m);
      if (p.c1 !== null) { this.c.setHex(p.c0); this.c.lerp(this.c2.setHex(p.c1), t); } else this.c.setHex(p.c0);
      this.mesh.setColorAt(i, this.c);
    }
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true;
  }
}
const fire = new Particles(700, true), smoke = new Particles(900, false);

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
let state = 'build', v, booster = null, rocketG, s1G, upG, warpI = 0, met = 0, maxQ = 0, progHold = false, camMode = 'chase';
let pendingEnd = false, flags, score, ship = null, endShown = false, stagedAt = null, mapLine;
const keys = {};
function showPreview() {
  if (rocketG) scene.remove(rocketG);
  rocketG = new THREE.Group(); s1G = makeStage1(cfg); upG = makeUpper(cfg); upG.position.y = s1G.userData.h; rocketG.add(s1G, upG); scene.add(rocketG);
  v = P.buildRocket(cfg);
}
function reset() {
  for (const b of [booster]) if (b && b.mesh) scene.remove(b.mesh);
  if (ship) { scene.remove(ship.obj); world.splice(world.indexOf(ship), 1); ship = null; }
  booster = null; met = 0; maxQ = 0; progHold = false; warpI = 0; camMode = 'chase'; endShown = false; pendingEnd = false; stagedAt = null;
  flags = { liftoff: 0, maxq: 0, space: 0, orbit: 0, booster: '', dead: '', fairing: 0 };
  score = 0; fire.d.forEach(p => p.life = 0); smoke.d.forEach(p => p.life = 0);
  showPreview();
}
reset(); refreshBuild();
$('launchBtn').onclick = () => { initAudio(); reset(); state = 'flight'; $('build').classList.add('hidden'); $('hud').classList.remove('hidden'); if (matchMedia('(pointer:coarse)').matches) $('touch').classList.remove('hidden'); toast('Press SPACE (or STAGE) to ignite', '#fff'); };
$('againBtn').onclick = () => { $('end').classList.add('hidden'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); state = 'build'; reset(); refreshBuild(); };
$('contBtn').onclick = () => { $('end').classList.add('hidden'); };
function shareText() { return `🚀 I scored ${score.toLocaleString()} in Orbit Rush${flags.orbit ? ' — reached orbit' : ''}${flags.booster === 'landed' ? ' and landed the booster' : ''}! Can you beat it?`; }
$('shareBtn').onclick = async () => { const t = shareText(), url = location.href.split('?')[0]; try { if (navigator.share) await navigator.share({ text: t, url }); else { await navigator.clipboard.writeText(t + ' ' + url); $('shareBtn').textContent = 'Copied!'; } } catch (e) { } };
$('xBtn').onclick = () => open('https://x.com/intent/post?text=' + encodeURIComponent(shareText()) + '&url=' + encodeURIComponent(location.href.split('?')[0]), '_blank');

function toast(msg, color = '#7dffa6') { const d = document.createElement('div'); d.textContent = msg; d.style.color = color; $('toasts').appendChild(d); setTimeout(() => d.remove(), 3000); }

// ---------- input ----------
function press(code) {
  if (state !== 'flight') return;
  initAudio();
  if (code === 'Space') doStage();
  if (code === 'KeyZ') v.throttle = 1;
  if (code === 'KeyX') v.throttle = 0;
  if (code === 'KeyF') { progHold = !progHold; toast(progHold ? 'AUTO-TURN on (gravity turn → prograde)' : 'Manual steering', '#9cc3ff'); }
  if (code === 'KeyM') camMode = camMode === 'map' ? 'chase' : 'map';
  if (code === 'KeyB') { if (booster && booster.state === 'flying') camMode = camMode === 'booster' ? 'chase' : 'booster'; else toast('No booster in flight', '#ffb35c'); }
  if (code === 'KeyT') { warpI = (warpI + 1) % WARPS.length; toast('Time warp ' + WARPS[warpI] + '×', '#9cc3ff'); }
  if (code === 'KeyR') $('againBtn').onclick();
  $('tProg').classList.toggle('on', progHold);
}
addEventListener('keydown', e => { if (e.repeat) return; keys[e.code] = true; press(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k, t = b.dataset.t;
  b.addEventListener('pointerdown', e => { e.preventDefault(); if (k) keys[k] = true; if (t) press(t); });
  const up = () => { if (k) keys[k] = false; }; b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
let camDist = 70, camYaw = 0.5, camPitch = 0.12, mapZoom = 2.8, drag = null;
renderer.domElement.addEventListener('wheel', e => { if (camMode === 'map') mapZoom = Math.min(8, Math.max(1.25, mapZoom * (1 + e.deltaY * 0.001))); else camDist = Math.min(3000, Math.max(20, camDist * (1 + e.deltaY * 0.001))); }, { passive: true });
const pts = new Map();
renderer.domElement.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); });
addEventListener('pointerup', e => pts.delete(e.pointerId));
addEventListener('pointermove', e => {
  if (!pts.has(e.pointerId)) return; const [px, py] = pts.get(e.pointerId);
  if (pts.size === 1) { camYaw -= (e.clientX - px) * 0.006; camPitch = Math.max(-1.2, Math.min(1.4, camPitch + (e.clientY - py) * 0.004)); }
  else if (pts.size === 2) { const o = [...pts.values()].find((_, i) => [...pts.keys()][i] !== e.pointerId); const d0 = Math.hypot(px - o[0], py - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); const f = d0 / Math.max(d1, 1); if (camMode === 'map') mapZoom = Math.min(8, Math.max(1.25, mapZoom * f)); else camDist = Math.min(3000, Math.max(20, camDist * f)); }
  pts.set(e.pointerId, [e.clientX, e.clientY]);
});

// ---------- flight logic ----------
function doStage() {
  if (v.clamped && v.throttle === 0) { v.throttle = 1; burst(0.6, 1.2, 500); toast('IGNITION', '#ffb35c'); return; }
  if (v.cur === 0 && !v.clamped) {
    booster = P.makeBooster(v); booster.mesh = s1G; rocketG.remove(s1G); scene.add(s1G); s1G.userData.plume.visible = false;
    v.cur = 1; upG.position.y = 0; stagedAt = met; burst(0.5, 0.6, 1500); beep(660);
    toast(booster.stages[0].fuel > 0.3 ? `STAGE SEP — booster has ${booster.stages[0].fuel.toFixed(1)} t to land` : 'STAGE SEP — booster is dry', '#fff');
    for (let i = 0; i < 30; i++) smoke.spawn(v.x, v.y, 0, v.vx + (Math.random() - 0.5) * 20, v.vy + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 1.5, 2, 8, 0xdddddd, null, 0.5);
  } else if (v.fairing > 0 && v.cur === 1 && P.altOf(v) > 30000) jettison();
}
function jettison() { v.fairing = 0; upG.userData.fair.visible = false; flags.fairing = 1; toast('Fairing separation', '#9cc3ff'); beep(990); }
function explode(x, y, vx, vy, big) {
  burst(big ? 1.2 : 0.7, 2.5, 700);
  for (let i = 0; i < (big ? 260 : 140); i++) {
    const a = Math.random() * 6.283, b = Math.random() * 3.14, s = Math.random() * (big ? 70 : 45);
    fire.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * Math.sin(b) * s, vy * 0.3 + Math.sin(a) * Math.sin(b) * s, Math.cos(b) * s, 0.6 + Math.random() * 1.4, 4, 14, 0xfff0b0, 0x401000, 1.2);
    if (i % 2) smoke.spawn(x, y, 0, vx * 0.3 + Math.cos(a) * s * 0.5, vy * 0.3 + Math.sin(a) * s * 0.5, (Math.random() - 0.5) * s, 4 + Math.random() * 4, 6, 30, 0x2b2b2b, null, 0.8);
  }
}
function fail(reason) {
  if (flags.dead) return; flags.dead = reason; explode(v.x, v.y, v.vx, v.vy, true); rocketG.visible = false; v.throttle = 0;
  toast('RUD — ' + reason, '#ff6262'); setTimeout(() => showEnd(), 2800);
}
function addScore() {
  let s = 0; const o = P.orbitOf(v), mult = P.OPTS.payload[cfg.payload].mult;
  const h = P.altOf(v);
  s += Math.min(flags.maxAlt || 0, ATM) / 100; // up to 700 for altitude
  if (flags.space) s += 1000;
  if (flags.orbit) { s += 3000; s += Math.max(0, 1500 - Math.abs(o.ap - o.pe) / 40); s += (v.stages[1].fuel / v.stages[1].fuelMax) * 800; }
  s *= mult;
  if (flags.booster === 'landed') s += 2500;
  if (flags.dead) s *= 0.5;
  score = Math.round(s); return score;
}
function showEnd() {
  if (endShown) return; endShown = true; addScore(); warpI = 0;
  const o = P.orbitOf(v), ok = flags.orbit && !flags.dead;
  $('endTitle').innerHTML = flags.dead ? '💥 Rapid Unscheduled Disassembly' : ok ? '🛰️ Orbit achieved!' : '🪂 Mission over';
  const lines = [];
  if (flags.dead) lines.push(`<span class="bad">Cause: ${flags.dead}</span>`);
  lines.push(`Max altitude: ${((flags.maxAlt || 0) / 1000).toFixed(1)} km`, `Max-Q: ${maxQ.toFixed(1)} kPa`);
  if (flags.space) lines.push('<span class="good">✔ Reached space (70 km)</span>');
  if (flags.orbit) lines.push(`<span class="good">✔ Orbit — Ap ${(o.ap / 1000).toFixed(0)} km / Pe ${(o.pe / 1000).toFixed(0)} km</span>`);
  lines.push(flags.booster === 'landed' ? '<span class="good">✔ Booster landed on the droneship (+2500)</span>' : flags.booster ? `<span class="warn">✘ Booster ${flags.booster}</span>` : '');
  lines.push(`Payload: ${P.OPTS.payload[cfg.payload].name} (×${P.OPTS.payload[cfg.payload].mult})`, `<b style="font-size:20px">SCORE ${score.toLocaleString()}</b>`);
  $('endBody').innerHTML = lines.filter(Boolean).join('<br>');
  $('contBtn').classList.toggle('hidden', !!flags.dead);
  $('end').classList.remove('hidden');
}

function simStep(dt) {
  const h = P.altOf(v);
  if (!flags.dead) {
    const st = v.stages[v.cur];
    const e = P.stepVehicle(v, dt);
    if (v.q > maxQ) maxQ = v.q;
    if (e === 'ground') { if (!flags.dead) fail(met < 5 ? 'never cleared the tower' : 'hit the ground'); return; }
    if (v.q > 80) fail('over-pressure (Max-Q too high)');
    else if (v.q > 15 && v.aoa > 0.26) fail('aerodynamic breakup — turned too hard');
    if (!v.clamped && !flags.liftoff) { flags.liftoff = 1; toast('LIFTOFF!', '#fff'); }
    if (v.clamped && v.throttle > 0 && st && st.fuel <= 0) fail('never lifted off (TWR < 1)');
    flags.maxAlt = Math.max(flags.maxAlt || 0, h);
    if (!flags.maxq && maxQ > 8 && v.q < maxQ * 0.8) { flags.maxq = 1; toast('Max-Q passed', '#9cc3ff'); }
    if (!flags.space && h > ATM) { flags.space = 1; toast('🌌 SPACE! +1000', '#b98cff'); beep(1200); }
    if (!flags.fairing && v.cur === 1 && h > 45000) jettison();
    if (h > ATM && !flags.orbit) { const o = P.orbitOf(v); if (o.pe > ATM) { flags.orbit = 1; toast('🛰️ ORBIT ACHIEVED! +3000', '#7dffa6'); beep(1320); setTimeout(() => beep(1760), 200); } }
  }
  if (booster && booster.state === 'flying') {
    const b = booster; P.boosterAutopilot(b); const e = P.stepVehicle(b, dt);
    const bh = P.altOf(b), sp = Math.hypot(b.vx, b.vy);
    if (bh < 25000 && sp > 1400 && b.x * b.vx + b.y * b.vy < 0) { b.state = 'lost'; flags.booster = 'burned up on reentry'; explode(b.x, b.y, b.vx, b.vy); b.mesh.visible = false; toast('Booster burned up', '#ff6262'); }
    if (bh < 9000 && !ship) { const a = Math.atan2(b.y, b.x) - 0.001; ship = makeShip(a); }
    if (bh < 3000) b.mesh.userData.legs.visible = true;
    if (e === 'ground') {
      if (sp < 10) { b.state = 'landed'; flags.booster = 'landed'; const r = Math.hypot(b.x, b.y); b.x *= R / r; b.y *= R / r; b.vx = b.vy = 0; b.throttle = 0; toast('🎯 BOOSTER LANDED! +2500', '#7dffa6'); beep(1500); }
      else { b.state = 'lost'; flags.booster = `crashed at ${sp.toFixed(0)} m/s (needed more fuel)`; explode(b.x, b.y, 0, 0); b.mesh.visible = false; toast('Booster lost', '#ff6262'); }
      if (camMode === 'booster') setTimeout(() => camMode = 'chase', 2500);
    }
  }
  met += dt;
}
function makeShip(a) {
  patch(a, 0x184a80, 30000);
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 34), new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.8 })); hull.position.y = -2; g.add(hull);
  const x1 = new THREE.Mesh(new THREE.BoxGeometry(30, 0.2, 2), new THREE.MeshBasicMaterial({ color: 0xffd23a })); x1.rotation.y = 0.6; x1.position.y = 0.05; g.add(x1);
  const x2 = x1.clone(); x2.rotation.y = -0.6; g.add(x2);
  surfaceObj(a, g, 0.03); return world[world.length - 1];
}

function emit(vehicle, group, dt) {
  const plume = group.userData.plume; const on = vehicle.thrust > 0.01;
  plume.visible = on; if (!on) return;
  const h = P.altOf(vehicle), p = P.pressure(h), thr = vehicle.throttle;
  const len = (8 + 14 * thr) * (1 + (1 - p) * 1.5), wid = 1 + (1 - p) * 1.2;
  plume.scale.set(wid, len, wid); plume.children[0].material.opacity = 0.5 + 0.4 * Math.random();
  const nx = Math.cos(vehicle.ang), ny = Math.sin(vehicle.ang);
  const n = Math.min(10, Math.ceil(dt * 240));
  for (let i = 0; i < n; i++) {
    const sp = 60 + Math.random() * 40, spread = 6 + (1 - p) * 30;
    fire.spawn(vehicle.x - nx * 2, vehicle.y - ny * 2, (Math.random() - 0.5) * 1.5,
      vehicle.vx - nx * sp + (Math.random() - 0.5) * spread, vehicle.vy - ny * sp + (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread,
      0.25 + Math.random() * 0.25, 2.5, 6 + (1 - p) * 10, 0xffd9a0, 0x200800, 2);
    if (p > 0.05 && Math.random() < 0.6 * p + 0.2) {
      const gk = h < 60 ? 1 : 0; // ground deflection cloud at pad
      smoke.spawn(vehicle.x - nx * 6, vehicle.y - ny * 6, (Math.random() - 0.5) * 3,
        vehicle.vx * 0.15 - nx * 30 * (1 - gk) + gk * (Math.random() - 0.5) * 80, vehicle.vy * 0.15 - ny * 30 * (1 - gk), (Math.random() - 0.5) * (8 + gk * 80),
        3 + Math.random() * 5 * p, 4, 18 + 20 * gk, p > 0.5 ? 0xe6e6e6 : 0xbfc6d0, null, 0.6);
    }
  }
}

// ---------- orbit line for map ----------
const lineGeo = new THREE.BufferGeometry(); const LN = 256; lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LN * 3), 3));
mapLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x7dffa6, depthTest: false, transparent: true })); mapLine.renderOrder = 10; (0); mapLine.frustumCulled = false; scene.add(mapLine);
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
let hudT = 0;
function hud() {
  const h = P.altOf(v), r = h + R, sp = Math.hypot(v.vx, v.vy), vr = (v.x * v.vx + v.y * v.vy) / r;
  const o = P.orbitOf(v), up = Math.atan2(v.y, v.x);
  const pitch = Math.atan2(Math.sin(up - v.ang), Math.cos(up - v.ang)) * 180 / Math.PI;
  const apS = !isFinite(o.ap) ? 'escape!' : h < 200 && sp < 50 ? '—' : fmtD(o.ap), peS = h < 200 && sp < 50 ? '—' : fmtD(Math.max(o.pe, -R));
  const qc = v.q > 45 ? 'bad' : v.q > 25 ? 'warn' : '';
  $('tele').innerHTML = `T+ ${fmtT(met)}   ×${(SIM_SPEED * WARPS[warpI])} speed\nALT   ${fmtD(h)}\nSPD   ${sp.toFixed(0)} m/s\nV/S   ${vr.toFixed(0)} m/s\nAp    ${apS}\nPe    <span class="${o.pe > ATM ? 'good' : ''}">${peS}</span>\nPITCH ${pitch.toFixed(1)}° from vertical${progHold ? ' [AUTO]' : ''}\nQ     <span class="${qc}">${v.q.toFixed(1)} kPa</span>  max ${maxQ.toFixed(1)}\nSTAGE ${v.cur + 1}/2  ${flags.fairing ? '' : 'fairing on'}` +
    (booster && booster.state === 'flying' ? `\nBOOSTER ${fmtD(P.altOf(booster))} ${Math.hypot(booster.vx, booster.vy).toFixed(0)} m/s\n        ${booster.phase} (${booster.stages[0].fuel.toFixed(1)} t)` : booster ? `\nBOOSTER ${booster.state}` : '');
  $('thrBar').style.height = v.throttle * 100 + '%';
  $('f1Bar').style.height = (v.cur === 0 ? v.stages[0].fuel / v.stages[0].fuelMax * 100 : 0) + '%';
  $('f2Bar').style.height = v.stages[1].fuel / v.stages[1].fuelMax * 100 + '%';
  $('score').textContent = 'SCORE ' + addScore().toLocaleString();
  let hint = '';
  if (flags.dead) hint = 'Press R to try again';
  else if (v.clamped && v.throttle === 0) hint = 'SPACE / STAGE to ignite';
  else if (v.clamped) hint = 'Not enough thrust… lighten the rocket';
  else if (!progHold && h < 8000 && sp < 400) hint = 'Press F for AUTO-TURN, or steer east yourself with D';
  else if (qc && v.throttle > 0.5) hint = 'HIGH Q — throttle down (S)';
  else if (v.cur === 0 && v.stages[0].fuel <= 0) hint = 'Booster empty — SPACE to stage!';
  else if (v.cur === 0 && h > 15000) hint = 'Stage (SPACE) with some fuel left to land the booster';
  else if (!flags.orbit && v.throttle > 0 && o.ap > 80000 && h < ATM - 5000) hint = 'Ap is high enough — cut throttle (X) and coast';
  else if (!flags.orbit && v.throttle === 0 && h < ATM) hint = 'Coasting to space… T for time warp';
  else if (!flags.orbit && h > ATM) hint = vr > 60 ? 'Coast to Ap (T to warp), then burn prograde' : (progHold ? 'Burn now! Full throttle (Z) until Pe > 70 km' : 'Burn prograde now! F then Z');
  else if (flags.orbit && v.throttle > 0) hint = 'In orbit! Cut throttle (X) to save fuel';
  else if (flags.orbit && booster && booster.state === 'flying') hint = 'Press B to watch the booster land · M for map';
  $('hint').textContent = hint; $('hint').style.display = hint ? '' : 'none';
}
const fmtT = s => { const m = Math.floor(s / 60), ss = Math.floor(s % 60); return `${m}:${String(ss).padStart(2, '0')}`; };

// ---------- main loop ----------
let last = performance.now();
const tmpQ = new THREE.Quaternion();
renderer.setAnimationLoop(() => {
  const now = performance.now(), rdt = Math.min(0.1, (now - last) / 1000); last = now;
  if (state === 'flight') {
    // controls
    const rate = 0.45 * rdt;
    if (keys.KeyW || keys.ShiftLeft) v.throttle = Math.min(1, v.throttle + rdt * 0.8);
    if (keys.KeyS || keys.ControlLeft) v.throttle = Math.max(0, v.throttle - rdt * 0.8);
    if (!v.clamped && !flags.dead) {
      if (keys.KeyA || keys.ArrowLeft) { v.ang += rate; progHold = false; }
      if (keys.KeyD || keys.ArrowRight) { v.ang -= rate; progHold = false; }
      if (progHold) {
        const tgt = P.assistAngle(v), d = Math.atan2(Math.sin(tgt - v.ang), Math.cos(tgt - v.ang));
        v.ang += Math.max(-rate * 2, Math.min(rate * 2, d));
      }
    }
    if (keys.ArrowUp) v.throttle = Math.min(1, v.throttle + rdt * 0.8);
    if (keys.ArrowDown) v.throttle = Math.max(0, v.throttle - rdt * 0.8);
    const simDt = rdt * SIM_SPEED * WARPS[warpI], N = Math.ceil(simDt / (1 / 120));
    for (let i = 0; i < N; i++) simStep(simDt / N);
    if (!endShown && !flags.dead && flags.orbit && (!booster || booster.state !== 'flying') && v.throttle === 0 && !pendingEnd) { pendingEnd = true; setTimeout(() => { if (!endShown && !flags.dead && state === 'flight') showEnd(); }, 2500); }
    if (!endShown && !flags.dead && flags.liftoff && v.stages[1].fuel <= 0 && v.cur === 1 && !flags.orbit && P.altOf(v) < 20000 && (v.x * v.vx + v.y * v.vy) < 0) { /* falling back */ }
  }
  // focus / floating origin
  const focus = camMode === 'booster' && booster && booster.state === 'flying' ? booster : v;
  const ox = focus.x, oy = focus.y;
  for (const w of world) w.obj.position.set(w.x - ox, w.y - oy, 0);
  rocketG.position.set(v.x - ox, v.y - oy, 0); rocketG.rotation.z = v.ang - Math.PI / 2;
  if (state === 'flight' && !flags.dead) emit(v, v.cur === 0 ? s1G : upG, rdt);
  else { s1G.userData.plume.visible = false; upG.userData.plume.visible = false; }
  if (booster && booster.mesh.visible) {
    booster.mesh.position.set(booster.x - ox, booster.y - oy, 0); booster.mesh.rotation.z = booster.ang - Math.PI / 2;
    if (booster.state === 'flying') { const nb = booster.n; booster.mesh.userData.plume.visible = booster.thrust > 0; if (booster.thrust > 0) emit(booster, booster.mesh, rdt); }
    else booster.mesh.userData.plume.visible = false;
  }
  // camera
  const fr = Math.hypot(ox, oy), ux = ox / fr, uy = oy / fr, h = fr - R;
  const U = new THREE.Vector3(ux, uy, 0), E = new THREE.Vector3(uy, -ux, 0), Z = new THREE.Vector3(0, 0, 1);
  const isMap = camMode === 'map';
  if (isMap) {
    camera.position.set(-ox, -oy, R * mapZoom); camera.up.set(0, 1, 0); camera.lookAt(-ox, -oy, 0);
  } else {
    const tgtH = focus === v ? 18 : 15;
    const tgt = U.clone().multiplyScalar(0).add(new THREE.Vector3(Math.cos(focus.ang), Math.sin(focus.ang), 0).multiplyScalar(tgtH));
    const off = Z.clone().multiplyScalar(Math.cos(camYaw) * Math.cos(camPitch)).addScaledVector(E, Math.sin(camYaw) * Math.cos(camPitch)).addScaledVector(U, Math.sin(camPitch));
    camera.position.copy(tgt).addScaledVector(off, camDist); camera.up.copy(U); camera.lookAt(tgt);
  }
  mapLine.visible = isMap && state === 'flight'; marker.visible = bMarker.visible = isMap;
  if (isMap) { updateOrbitLine(ox, oy); marker.position.set(v.x - ox, v.y - oy, 0); marker.scale.setScalar(R * mapZoom * 0.006); if (booster && booster.state === 'flying') { bMarker.position.set(booster.x - ox, booster.y - oy, 0); bMarker.scale.setScalar(R * mapZoom * 0.005); } else bMarker.visible = false; }
  stars.position.copy(camera.position);
  // sky colour by altitude
  const k = Math.min(1, Math.max(0, h / 45000));
  scene.background.setRGB(0.48 * (1 - k) ** 2, 0.72 * (1 - k) ** 1.6, 1.0 * (1 - k) ** 1.2);
  if (isMap) scene.background.setRGB(0, 0, 0.01);
  stars.material.opacity = isMap ? 1 : Math.min(1, k * 1.3);
  atmo.material.opacity = isMap ? 0.12 : 0.22 * (1 - k * 0.3);
  fire.update(rdt * (state === 'flight' ? SIM_SPEED * WARPS[warpI] : 1) , ox, oy, camera.quaternion);
  smoke.update(rdt * (state === 'flight' ? SIM_SPEED * WARPS[warpI] : 1) , ox, oy, camera.quaternion);
  // audio
  if (rumble) {
    const anyThrust = state === 'flight' && !flags.dead ? v.thrust / 300 + (booster && booster.state === 'flying' && camMode === 'booster' ? booster.thrust / 300 : 0) : 0;
    const p = P.pressure(h);
    rumble.gain.setTargetAtTime(Math.min(0.9, anyThrust * (0.25 + 0.75 * p)), ac.currentTime, 0.08);
    rumbleF.frequency.setTargetAtTime(150 + 500 * p, ac.currentTime, 0.2);
  }
  if (state === 'flight' && (hudT += rdt) > 0.1) { hudT = 0; hud(); }
  if (state === 'build') { camYaw += rdt * 0.15; }
  renderer.render(scene, camera);
});
window.__game = { get v() { return v; }, get flags() { return flags; }, get state() { return state; }, isGPU, get booster() { return booster; } };
