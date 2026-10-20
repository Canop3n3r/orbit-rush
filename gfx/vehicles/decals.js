// Livery / decal slots. The public repo ships ONLY generic, original markings (no names, no logos).
// A private brand pack can replace any slot at runtime:  setBrandPack({ 'booster.side': canvasOrImageOrUrl, ... })
// before building vehicles (or call rebuild). Slot ids: booster.side, upper.side, fairing.side, capsule.side,
// ship.side, colossusbooster.side, tower.side, sat.top. Each slot is drawn onto a cylinder strip (or plane) by parts.js.
import * as THREE from 'three/webgpu';
const pack = {}; const texCache = new Map();
export function setBrandPack(p) { Object.assign(pack, p || {}); texCache.clear(); }
export function clearBrandPack() { for (const k in pack) delete pack[k]; texCache.clear(); }
export const SLOTS = ['booster.side', 'upper.side', 'fairing.side', 'capsule.side', 'ship.side', 'colossusbooster.side', 'tower.side', 'sat.top'];
// generic default: a thin double stripe, a chevron mark and a serial-style code (all original)
function generic(slot) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.clearRect(0, 0, 512, 128);
  const dark = /ship|colossusbooster|tower/.test(slot) ? 'rgba(30,30,34,0.85)' : 'rgba(20,24,32,0.9)';
  x.fillStyle = dark; x.fillRect(0, 20, 512, 5); x.fillRect(0, 31, 512, 2);
  x.beginPath(); x.moveTo(30, 100); x.lineTo(60, 50); x.lineTo(90, 100); x.lineTo(76, 100); x.lineTo(60, 72); x.lineTo(44, 100); x.closePath(); x.fill();
  x.font = 'bold 34px monospace'; x.fillText({ 'booster.side': 'B-07', 'upper.side': 'S2-12', 'fairing.side': 'PLF-3', 'capsule.side': 'C-04', 'ship.side': 'V-21', 'colossusbooster.side': 'H-09', 'tower.side': 'T-1', 'sat.top': 'SAT' }[slot] || 'OR', 110, 98);
  return c;
}
export function decalTexture(slot) {
  if (texCache.has(slot)) return texCache.get(slot);
  const src = pack[slot]; let t;
  if (typeof src === 'string') { t = new THREE.TextureLoader().load(src); }
  else t = new THREE.CanvasTexture(src || generic(slot));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(slot, t); return t;
}
