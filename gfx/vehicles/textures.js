// Procedural, original textures for the vehicle models (no external assets, no logos). Small canvases (<=512 px).
import * as THREE from 'three/webgpu';
const cache = new Map();
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function fin(c, { srgb = true, rep = [1, 1] } = {}) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t; }
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
// white paint over aluminium-lithium: panel seams, weld rings, faint stringers; soot: 0..1 strength of the
// engine-soot gradient toward v=0 (bottom of the cylinder UV), 'top' adds a light soot band at the top
export function paint({ soot = 0, sootTop = 0, base = '#eeeeea', rings = 6, seed = 3 } = {}) {
  return once(`paint${soot}${sootTop}${base}${rings}`, () => {
    const [c, x] = canvas(256, 512), r = rng(seed);
    x.fillStyle = base; x.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 1200; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.025})`; x.fillRect(r() * 256, r() * 512, 2 + r() * 6, 1 + r() * 3); }
    x.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 1; i < rings; i++) x.fillRect(0, (i / rings) * 512, 256, 2);
    x.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 16; i++) x.fillRect(i * 16, 0, 1, 512);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 8, 256, 1); // raceway shadow line hint
    if (soot > 0) { const g = x.createLinearGradient(0, 512, 0, 512 * (1 - 0.85 * soot)); g.addColorStop(0, `rgba(38,35,32,${Math.min(1, 1.0 * soot)})`); g.addColorStop(0.3, `rgba(70,66,62,${0.85 * soot})`); g.addColorStop(0.65, `rgba(105,100,95,${0.5 * soot})`); g.addColorStop(1, 'rgba(60,50,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      for (let i = 0; i < 140; i++) { const X = r() * 256, L = 60 + r() * 330 * soot; const s = x.createLinearGradient(0, 512, 0, 512 - L); s.addColorStop(0, `rgba(20,16,12,${0.45 * soot})`); s.addColorStop(1, 'rgba(20,16,12,0)'); x.fillStyle = s; x.fillRect(X, 512 - L, 2 + r() * 5, L); } }
    if (sootTop > 0) { const g = x.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, `rgba(40,34,28,${0.6 * sootTop})`); g.addColorStop(1, 'rgba(40,34,28,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 90); }
    return fin(c);
  });
}
// carbon composite (interstage, legs, fairing base): twill weave
export function carbon() { return once('carbon', () => { const [c, x] = canvas(128, 128); x.fillStyle = '#141414'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const l = ((i + j) % 4 < 2) ? 34 : 22; x.fillStyle = `rgb(${l},${l},${l + 2})`; x.fillRect(i * 8 + 1, j * 8 + 1, 6, 6); }
  return fin(c, { rep: [8, 8] }); }); }
// stainless steel (giant steel vehicles): brushed streaks + weld rings + slight heat staining
export function steelSkin(seed = 5) { return once('steel' + seed, () => { const [c, x] = canvas(256, 512), r = rng(seed); x.fillStyle = '#a9adb2'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2500; i++) { const l = 160 + r() * 60; x.fillStyle = `rgba(${l},${l},${l + 4},0.35)`; x.fillRect(r() * 256, r() * 512, 1, 6 + r() * 30); }
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(60,52,44,0.55)'; x.fillRect(0, i * 64, 256, 2); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, i * 64 + 2, 256, 1); x.fillStyle = 'rgba(60,52,44,0.3)'; x.fillRect((i * 97) % 256, i * 64, 2, 64); }
  for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * 256, r() * 512, 0, r() * 256, r() * 512, 20 + r() * 50); g.addColorStop(0, 'rgba(150,120,80,0.12)'); g.addColorStop(1, 'rgba(150,120,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512); }
  return fin(c); }); }
// hexagonal heat-shield tiles (left half of the U range is tiled, right half bare steel shows through: alpha)
export function hexTiles() { return once('hex', () => { const [c, x] = canvas(512, 512), r = rng(9); x.clearRect(0, 0, 512, 512);
  const s = 9, h = s * Math.sqrt(3);
  for (let j = -1; j < 512 / h + 1; j++) for (let i = -1; i < 512 / (s * 1.5) + 1; i++) { const cx = i * s * 1.5, cy = j * h + (i % 2 ? h / 2 : 0); const l = 42 + r() * 20;
    x.fillStyle = `rgb(${l},${l},${l + 3})`; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * (s - 0.8), cy + Math.sin(a) * (s - 0.8)); } x.fill(); }
  return fin(c); }); }
// grid fin lattice (alpha-tested): square cells at 45°
export function gridFin() { return once('grid', () => { const [c, x] = canvas(128, 128); x.clearRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 3;
  for (let i = -128; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); x.beginPath(); x.moveTo(i, 128); x.lineTo(i + 128, 0); x.stroke(); }
  x.lineWidth = 8; x.strokeRect(0, 0, 128, 128); return fin(c, { srgb: false }); }); }
// regeneratively cooled bell: fine vertical tubes; ext=true adds a radiatively cooled extension with heat tint
// toward the exit (v=0 is the exit when built by bellGeometry)
export function bell(ext = false) { return once('bell' + ext, () => { const [c, x] = canvas(256, 256); const g = x.createLinearGradient(0, 256, 0, 0);
  if (ext) { g.addColorStop(0, '#3a3540'); g.addColorStop(0.25, '#5a4a6a'); g.addColorStop(0.45, '#7a6a52'); g.addColorStop(0.62, '#8a6d48'); g.addColorStop(0.7, '#5d5148'); g.addColorStop(1, '#4a3a30'); }
  else { g.addColorStop(0, '#5a4234'); g.addColorStop(0.5, '#8a6448'); g.addColorStop(1, '#4a3a30'); }
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) { x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(i, ext ? 70 : 0, 1, 256); }
  x.fillStyle = 'rgba(0,0,0,0.45)'; for (const y of [12, 70, 190]) x.fillRect(0, y, 256, 3);
  return fin(c); }); }
// glass-like dark windows / solar cells
export function solarCells() { return once('solar', () => { const [c, x] = canvas(256, 128); x.fillStyle = '#0d1630'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#2a3c6a'; x.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); } for (let j = 0; j <= 128; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(256, j); x.stroke(); } return fin(c); }); }
// frost bands (alpha) for a cryogenic tank barrel: v = 0 bottom .. 1 top; bands = [[v0, v1], ...]
export function frost(bands = [[0.04, 0.5], [0.56, 0.86]]) { return once('frost' + bands, () => { const [c, x] = canvas(256, 1024), r = rng(11); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 1024);
  // fine, even cryo frost: soft-edged bands, many thin vertical runs (no coarse dark blotches)
  for (const [a, b] of bands) { const y0 = 1024 * (1 - b), y1 = 1024 * (1 - a), g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.06, 'rgba(255,255,255,0.62)'); g.addColorStop(0.94, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, y0, 256, y1 - y0); }
  for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`; x.fillRect(r() * 256, r() * 1024, 1, 4 + r() * 20); }
  for (let i = 0; i < 1200; i++) { x.fillStyle = `rgba(255,255,255,${r() * 0.15})`; x.fillRect(r() * 256, r() * 1024, 1, 1 + r() * 3); }
  const t = fin(c, { srgb: false }); t.wrapT = THREE.ClampToEdgeWrapping; return t; }); }
// engine skirt: dark grey with soot streaks and panel bolts
export function skirt() { return once('skirt', () => { const [c, x] = canvas(256, 128), r = rng(4); const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, '#1a1816'); g.addColorStop(1, '#4a4a4c'); x.fillStyle = g; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(i * 32, 0, 2, 128); } for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(10,8,6,${r() * 0.4})`; x.fillRect(r() * 256, 60 + r() * 68, 2 + r() * 6, r() * 60); } return fin(c); }); }
// octaweb heat-shield blanket: quilted dark grey
export function blanket() { return once('blanket', () => { const [c, x] = canvas(128, 128); x.fillStyle = '#2b2a28'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(0,0,0,0.6)'; for (let i = 0; i < 128; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); } x.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 128; i += 12) for (let j = 0; j < 128; j += 12) x.fillRect(i + 3, j + 3, 5, 5); return fin(c, { rep: [3, 3] }); }); }
export function clearCache() { cache.clear(); }
