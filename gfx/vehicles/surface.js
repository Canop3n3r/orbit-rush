// realism-1: shared procedural surface detail for the staged (Blender) rocket assets. The .glb stages carry vertex colours and no UVs,
// so detail is projected from a per-vertex 'surf' attribute (stage-frame position in metres, baked once at load) with a biplanar X/Z
// projection (rockets are vertical cylinders). All maps are original, generated here from small 256 px canvases (no external assets):
//   panel height  -> normal: weld rings, panel seams, stringer ribs, rivet rows, access-panel outlines
//   grime         -> colour + roughness: soft mottling, streaks running down, scuffs
//   tubes height  -> normal: regenerative-cooling tubes and stiffener rings on engine bells
// Tiers: hi = normal + grime + roughness; mid (phone near) = grime + roughness only (two taps); lo = plain material (no node work).
import * as THREE from 'three/webgpu';
import { texture, attribute, vec2, vec3, float, mix, smoothstep, normalize, normalLocal, transformNormalToView } from 'three/tsl';
export const PANEL_M = 4, BELL_M = 0.8; // metres covered by one texture tile
import { heightToNormal } from './surface_math.js?v=f5.9-20';
export { heightToNormal };
const cache = new Map();
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const S = 256;
function heightCanvas(draw) { const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.fillStyle = 'rgb(128,128,128)'; x.fillRect(0, 0, S, S); draw(x); return x.getImageData(0, 0, S, S).data; }
function dataTex(px, srgb = false) { const t = new THREE.DataTexture(px, S, S, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.userData.cached = true; return t; }
export function panelNormal() { return once('panel', () => { const r = rng(17), h = heightCanvas(x => {
  x.fillStyle = 'rgb(150,150,150)'; for (let i = 0; i < 24; i++) x.fillRect(i * S / 24 + 2, 0, 3, S); // stringer ribs inside the skin show as faint vertical swells
  x.fillStyle = 'rgb(60,60,60)'; for (const y of [0, S / 2]) x.fillRect(0, y, S, 3); // circumferential weld seams (2 per 4 m tile)
  x.fillStyle = 'rgb(175,175,175)'; for (const y of [0, S / 2]) { x.fillRect(0, y + 3, S, 2); x.fillRect(0, y - 2, S, 2); } // weld bead shoulders
  x.fillStyle = 'rgb(80,80,80)'; for (const X of [0]) x.fillRect(X, 0, 2, S); // longitudinal panel seams
  x.fillStyle = 'rgb(190,190,190)'; for (const y of [0, S / 2]) for (let X = 4; X < S; X += 8) { x.fillRect(X, y + 8, 2, 2); x.fillRect(X, y - 9, 2, 2); } // rivet rows
  x.strokeStyle = 'rgb(70,70,70)'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { const X = 10 + r() * (S - 60), Y = 20 + r() * (S - 80); x.strokeRect(X, Y, 18 + r() * 26, 14 + r() * 30); } // access panels
}); return dataTex(heightToNormal(h, S, S)); }); }
export function tubeNormal() { return once('tubes', () => { const h = heightCanvas(x => { for (let X = 0; X < S; X += 4) { const g = x.createLinearGradient(X, 0, X + 4, 0); g.addColorStop(0, 'rgb(70,70,70)'); g.addColorStop(0.5, 'rgb(200,200,200)'); g.addColorStop(1, 'rgb(70,70,70)'); x.fillStyle = g; x.fillRect(X, 0, 4, S); }
  x.fillStyle = 'rgb(230,230,230)'; x.fillRect(0, 60, S, 5); x.fillRect(0, 190, S, 5); }); return dataTex(heightToNormal(h, S, S, 1.8)); }); } // tubes + two stiffener hoops
export function grime() { return once('grime', () => { const c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(29);
  x.fillStyle = 'rgb(240,240,240)'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 220; i++) { const v = 170 + r() * 85, X = r() * S, Y = r() * S, s = 8 + r() * 36, b = x.createRadialGradient(X, Y, 0, X, Y, s); b.addColorStop(0, `rgba(${v},${v},${v},0.3)`); b.addColorStop(1, `rgba(${v},${v},${v},0)`); x.fillStyle = b; x.fillRect(X - s, Y - s, 2 * s, 2 * s); } // soft mottling
  for (let i = 0; i < 70; i++) { const X = r() * S, L = 20 + r() * 140, Y = r() * S, g = x.createLinearGradient(0, Y, 0, Y + L); g.addColorStop(0, 'rgba(120,110,95,0.35)'); g.addColorStop(1, 'rgba(120,110,95,0)'); x.fillStyle = g; x.fillRect(X, Y, 1 + r() * 3, L); } // run-off streaks
  x.strokeStyle = 'rgba(90,90,90,0.4)'; for (let i = 0; i < 40; i++) { x.lineWidth = 0.5 + r(); x.beginPath(); const X = r() * S, Y = r() * S; x.moveTo(X, Y); x.lineTo(X + (r() - 0.5) * 30, Y + (r() - 0.5) * 8); x.stroke(); } // scuffs
  const d = x.getImageData(0, 0, S, S).data; return dataTex(new Uint8ClampedArray(d), true); }); }
// per-vertex stage-frame position (m) + biplanar weights + soot weight (z: 1 first stage, ~0.35 upper stages, 0 payloads, -1 fairings = clean), baked once per cloned geometry
export function bakeSurf(geo, m, soot = 1) { const p = geo.attributes.position, n = geo.attributes.normal, N = p.count, s = new Float32Array(N * 3), w = new Float32Array(N * 3), v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
  for (let i = 0; i < N; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); s.set([v.x, v.y, v.z], i * 3); if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); } else v.set(1, 0, 0); const a = v.x ** 4, b = v.z ** 4, t = a + b || 1; w[i * 3] = a / t; w[i * 3 + 1] = b / t; w[i * 3 + 2] = soot; }
  geo.setAttribute('surf', new THREE.BufferAttribute(s, 3)); geo.setAttribute('surfw', new THREE.BufferAttribute(w, 3)); return geo; }
// kind from the Blender material name: or_hull | or_metal | or_dark | or_tile | or_bell
export const KINDS = { or_hull: { rough: [0, 0.18], dirt: 0.85, soot: 0.6, nrm: 0.8 }, or_metal: { rough: [-0.05, 0.2], dirt: 0.5, soot: 0.3, nrm: 0.35 }, or_dark: { rough: [0, 0.15], dirt: 0.25, soot: 0, nrm: 0.4 }, or_tile: { rough: [0, 0.2], dirt: 0.3, soot: 0, nrm: 0.5 }, or_bell: { rough: [-0.08, 0.12], dirt: 0.4, soot: 0, nrm: 0.9, bell: true } };
export function surfaceMaterial(src, tier) {
  const K = KINDS[src.name]; const base = { color: 0xffffff, vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side };
  if (!K || tier === 'lo') return new THREE.MeshStandardMaterial(base);
  const m = new THREE.MeshStandardNodeMaterial(base), P = attribute('surf', 'vec3'), W = attribute('surfw', 'vec3'), tile = K.bell ? BELL_M : PANEL_M;
  const uvX = vec2(P.z, P.y).div(tile), uvZ = vec2(P.x, P.y).div(tile), G = grime();
  const g = texture(G, uvX).r.mul(W.x).add(texture(G, uvZ).r.mul(W.y)); // 1 clean .. ~0.45 dirty
  const sootK = K.soot ? float(1).sub(smoothstep(float(0.0), float(14.0), P.y).oneMinus().mul(W.z.max(0)).mul(K.soot)).clamp(0.12, 1) : float(1);
  const dirtK = mix(float(K.dirt * 0.3), float(K.dirt), float(-0.5).step(W.z)); // W.z < 0 marks fairings: new, cleaner composite shells (audit #13) // engine-soot gradient up from each stage's base
  const dirt = mix(float(1), g, dirtK).mul(sootK); m.colorNode = vec3(dirt, dirt, dirt);
  m.roughnessNode = float(src.roughness).add(K.rough[0]).add(g.oneMinus().mul(K.rough[1] * 4)).clamp(0.05, 1);
  if (tier === 'hi') { // biplanar bump with an analytic frame (no UVs/tangents on the assets): X plane uv=(z,y) -> tangent +Z, bitangent +Y; Z plane uv=(x,y) -> +X, +Y
    const NT = K.bell ? tubeNormal() : panelNormal(), k = K.nrm, tX = texture(NT, uvX).xy.mul(2).sub(1).mul(k), tZ = texture(NT, uvZ).xy.mul(2).sub(1).mul(k);
    const d = vec3(tZ.x.mul(W.y), tX.y.mul(W.x).add(tZ.y.mul(W.y)), tX.x.mul(W.x));
    m.normalNode = transformNormalToView(normalize(normalLocal.add(d))); }
  m.userData.surface = tier; return m; }
export function clearSurfaceCache() { cache.clear(); }
