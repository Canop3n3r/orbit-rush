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
    if (soot > 0) { const g = x.createLinearGradient(0, 512, 0, 512 * (1 - 0.65 * soot)); g.addColorStop(0, `rgba(28,24,20,${0.92 * soot})`); g.addColorStop(0.45, `rgba(50,42,34,${0.55 * soot})`); g.addColorStop(1, 'rgba(60,50,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512);
      for (let i = 0; i < 90; i++) { const X = r() * 256, L = 40 + r() * 200 * soot; const s = x.createLinearGradient(0, 512, 0, 512 - L); s.addColorStop(0, `rgba(20,16,12,${0.25 * soot})`); s.addColorStop(1, 'rgba(20,16,12,0)'); x.fillStyle = s; x.fillRect(X, 512 - L, 2 + r() * 5, L); } }
    if (sootTop > 0) { const g = x.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, `rgba(40,34,28,${0.6 * sootTop})`); g.addColorStop(1, 'rgba(40,34,28,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 90); }
    return fin(c);
  });
}
// carbon composite (interstage, legs, fairing base): twill weave
export function carbon() { return once('carbon', () => { const [c, x] = canvas(128, 128); x.fillStyle = '#141414'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const l = ((i + j) % 4 < 2) ? 34 : 22; x.fillStyle = `rgb(${l},${l},${l + 2})`; x.fillRect(i * 8 + 1, j * 8 + 1, 6, 6); }
  return fin(c, { rep: [8, 8] }); }); }
// stainless steel (giant steel vehicles): brushed streaks + weld rings + slight heat staining
export function steelSkin(seed = 5) { return once('steel' + seed, () => { const [c, x] = canvas(256, 512), r = rng(seed); x.fillStyle = '#b9bcc0'; x.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 2500; i++) { const l = 160 + r() * 60; x.fillStyle = `rgba(${l},${l},${l + 4},0.35)`; x.fillRect(r() * 256, r() * 512, 1, 6 + r() * 30); }
  x.fillStyle = 'rgba(70,60,50,0.35)'; for (let i = 1; i < 9; i++) x.fillRect(0, i * 57, 256, 2);
  for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * 256, r() * 512, 0, r() * 256, r() * 512, 20 + r() * 50); g.addColorStop(0, 'rgba(150,120,80,0.12)'); g.addColorStop(1, 'rgba(150,120,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 512); }
  return fin(c); }); }
// hexagonal heat-shield tiles (left half of the U range is tiled, right half bare steel shows through: alpha)
export function hexTiles() { return once('hex', () => { const [c, x] = canvas(512, 512), r = rng(9); x.clearRect(0, 0, 512, 512);
  const s = 9, h = s * Math.sqrt(3);
  for (let j = -1; j < 512 / h + 1; j++) for (let i = -1; i < 512 / (s * 1.5) + 1; i++) { const cx = i * s * 1.5, cy = j * h + (i % 2 ? h / 2 : 0); const l = 18 + r() * 14;
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
export function clearCache() { cache.clear(); }
