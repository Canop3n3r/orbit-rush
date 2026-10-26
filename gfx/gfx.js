// Milestone B graphics (gx1): licensed textures (assets/tex, CC BY 4.0 Solar System Scope — see CREDITS.md),
// Earth day/night/clouds/ocean glint + analytic atmospheric scattering, Sun + bloom, Milky Way, HDR tone mapping,
// PBR environment, quality presets (low keeps phones and software GPUs working). No physics here.
import * as THREE from 'three/webgpu';
import { texture, uniform, float, vec3, vec4, normalWorld, positionWorld, cameraPosition, normalize, dot, cross, length, mix, smoothstep, pow, saturate, max, min, exp, select, uv, vertexColor, mx_noise_float, positionLocal, pass, attribute, normalView, positionView, sign } from 'three/tsl';
import { oceanLook, oceanDisplace, oceanTime } from './ocean.js?v=f5.9-6';
export { oceanTime };
import { TILE_FADE } from './tilefade.js?v=f5.9-6';
export { TILE_FADE, tileAlpha, tileAltAlpha, tileRimAlpha } from './tilefade.js?v=f5.9-6';
export const TILE_LAND_GAIN = 2.4; // mean of (0.8+0.4 fbm)*2.4 in main.js updateTile
export const padLandU = uniform(new THREE.Vector3(0.03, 0.043, 0.02)); // linear rgb of the inland ground around the pad (main.js sets it once the map is read)
export const tileFadeU = uniform(new THREE.Vector4(0, 0, 1, 0)); // x: camera altitude (m), y: altitude alpha (main.js sets both every frame)
export { GFX, GFX_ORDER } from './presets.js?v=f5.9-6';
import { GFX } from './presets.js?v=f5.9-6';
import { PAD_LON_DEG, PAD_LAT_DEG, EARTH_TEX_ROT, EARTH_TEX_M4, latLonToGame, sampleEarth } from './earthmap.js?v=f5.9-6';
export { PAD_LON_DEG, PAD_LAT_DEG, EARTH_TEX_ROT, EARTH_TEX_M4, latLonToGame, sampleEarth };
export const earthTexMatrix = () => new THREE.Matrix4().fromArray(EARTH_TEX_M4);
export function softwareGPU() {
  try { const c = document.createElement('canvas'), gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return true;
    const e = gl.getExtension('WEBGL_debug_renderer_info'), r = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return /swiftshader|llvmpipe|software|basic render/i.test(String(r)); } catch (e) { return false; }
}
export function pickGfx(stored, param, touch) {
  if (GFX[param]) return param; if (GFX[stored]) return stored;
  return softwareGPU() ? 'low' : touch ? 'med' : 'high';
}
const loader = new THREE.TextureLoader(), cache = new Map();
export function tex(name, q, srgb = true) {
  const file = name + (name === 'earth_spec' || name === 'saturn_ring' ? '' : GFX[q].tex);
  const key = file + srgb; if (cache.has(key)) return cache.get(key);
  const url = new URL('../assets/tex/' + file + (name === 'saturn_ring' ? '.png' : name === 'earth_spec' ? '_1k.jpg' : '.jpg'), import.meta.url).href;
  const t = loader.load(url); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = THREE.RepeatWrapping; /* f5: planetLOD chunks carry u past 0..1 at the antimeridian */ cache.set(key, t); return t;
}
// image data of the Earth day map (for the high-res ground tile's colours), resolved once loaded
export function earthPixels(q) {
  return new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 1024, 512);
    const s = new Image(); s.onload = () => { const c2 = document.createElement('canvas'); c2.width = 1024; c2.height = 512; const x2 = c2.getContext('2d'); x2.drawImage(s, 0, 0, 1024, 512); res({ day: x.getImageData(0, 0, 1024, 512).data, spec: x2.getImageData(0, 0, 1024, 512).data, W: 1024, H: 512 }); }; s.onerror = () => res(null);
    s.src = new URL('../assets/tex/earth_spec_1k.jpg', import.meta.url).href; }; img.onerror = () => res(null); img.src = new URL('../assets/tex/earth_day_1k.jpg', import.meta.url).href; });
}
// ---------- materials ----------
// f5 (B): one water look for every Earth surface (planetLOD chunks + the 150 km ground tile): the water mask drives
// a clear sea blue, low roughness (sun glint) and a sky-tinted fresnel sheen, so land vs water stays readable at any height
export function waterLook(dayRgb, w, ndl) {
  const Vv = normalize(cameraPosition.sub(positionWorld)), fres = pow(float(1).sub(saturate(dot(normalWorld, Vv))), 3.0), dayK = smoothstep(-0.15, 0.3, ndl);
  const sea = mix(vec3(0.010, 0.045, 0.115), dayRgb.mul(vec3(0.8, 1.0, 1.35)), 0.35);
  return { color: sea, rough: float(0.3), sheen: vec3(0.10, 0.20, 0.38).mul(fres.mul(0.8).add(0.12)).mul(dayK).mul(w) };
}
// sunPos: a vec3 uniform in world space (far away in flight; the Sun mesh position on the map)
export function earthMaterial(q, sunPos) {
  const m = new THREE.MeshStandardNodeMaterial();
  const day0 = texture(tex('earth_day', q)), night = texture(tex('earth_night', q)), spec0 = texture(tex('earth_spec', q, false)).r;
  // f5.9 terrain: the globe shows the SAME launch-site coast/land as the ground tile (main.js updateTile): within 30 km of the pad (smooth 6->30 km fade) the 1k map's
  // coastal texel (which paints the pad as open sea) is replaced by the shaped coast 1.5 km east of the pad and the surrounding inland land colour. Same formulas, same constants.
  const R0 = 6378137, dxm = uv().x.sub(0.27610).mul(2 * Math.PI * R0 * Math.cos(28.6084 * Math.PI / 180)), dym = uv().y.sub(0.65894).mul(Math.PI * R0);
  const padK = float(1).sub(smoothstep(6000.0, 30000.0, dxm.mul(dxm).add(dym.mul(dym)).sqrt())), coast = float(1500).add(max(dym, 0.0).mul(0.03));
  const wC = saturate(dxm.sub(coast).div(300).add(0.5)), tgt = wC.mul(0.9).add(select(wC.greaterThan(0.5), float(0.1), float(0))), landK = padK.mul(select(wC.lessThan(0.5), float(1), float(0)));
  const spec = mix(spec0, tgt, padK), day = { rgb: mix(day0.rgb, padLandU, landK) };
  const L = normalize(sunPos.sub(positionWorld)), ndl = dot(normalWorld, L), Vv = normalize(cameraPosition.sub(positionWorld));
  const fres = pow(float(1).sub(saturate(dot(normalWorld, Vv))), 2.5);
  const dayK = smoothstep(-0.2, 0.35, ndl), nightK = smoothstep(0.1, -0.2, ndl);
  const wl = waterLook(day.rgb, spec, ndl); m.colorNode = mix(day.rgb, wl.color, spec); // f5: shared water look
  m.roughnessNode = mix(float(0.9), wl.rough, spec); m.metalnessNode = float(0.0);
  const haze = vec3(0.28, 0.52, 1.0).mul(pow(fres, 1.8)).mul(dayK).mul(0.55); // aerial perspective toward the limb
  const dusk = vec3(1.0, 0.45, 0.15).mul(fres).mul(smoothstep(-0.25, 0.0, ndl).mul(smoothstep(0.3, 0.0, ndl))).mul(0.6);
  m.emissiveNode = night.rgb.mul(vec3(1.0, 0.8, 0.55)).mul(nightK).mul(1.4).add(haze).add(dusk).add(wl.sheen);
  return m;
}
export function cloudMaterial(q, sunPos) {
  const m = new THREE.MeshStandardNodeMaterial({ transparent: true, depthWrite: false });
  const c = texture(tex('earth_clouds', q, false)).r, L = normalize(sunPos.sub(positionWorld)), ndl = dot(normalWorld, L);
  m.colorNode = mix(vec3(1.0, 0.62, 0.42), vec3(1, 1, 1), smoothstep(-0.05, 0.3, ndl)); m.roughnessNode = float(1); m.metalnessNode = float(0);
  // f4.1b: the cloud map is ~10 km/texel; seen from 10-40 km straight down it magnified into one flat grey slab over
  // the pad. Close up, break it into cumulus-scale cells and thin it, fading to the plain map from ~300 km away.
  const d = length(positionWorld.sub(cameraPosition)), far = smoothstep(60000.0, 300000.0, d), lp = positionLocal.mul(1 / 6000);
  const cell = saturate(mx_noise_float(lp).mul(1.6).add(mx_noise_float(lp.mul(4.0)).mul(0.6)).add(0.05));
  m.opacityNode = c.mul(0.92).mul(mix(cell.mul(0.75), float(1), far));
  return m;
}
// Analytic single-scattering look for an atmosphere shell drawn as a back-face sphere: brightness from how close
// each view ray passes to the planet (peaks just above the limb), coloured by the sun angle at that tangent point
// (blue by day, orange/red at the terminator, dark at night) plus forward scattering toward the Sun.
export function atmoMaterial(o = {}) {
  const center = uniform(new THREE.Vector3()), sunDir = uniform(new THREE.Vector3(1, 0, 0)), Rp = uniform(o.R || 1), Ra = uniform(o.Ra || 1.02), gain = uniform(o.gain ?? 1);
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const Vd = normalize(positionWorld.sub(cameraPosition)), oc = center.sub(cameraPosition);
  // f4.1 root fix (22 km wash-out + 100 km double halo): the closest approach must lie AHEAD of the camera. For rays whose
  // tangent point is behind (tca < 0, e.g. looking up from inside the air) the nearest point is the camera itself; the old
  // code used the line's impact parameter, so upward rays at 22 km read as grazing the limb and the whole sky went white.
  const tca = dot(oc, Vd), bLine = length(cross(Vd, oc)), b = select(tca.greaterThan(0.0), bLine, length(oc));
  const tan = cameraPosition.add(Vd.mul(max(tca, 0.0))), s = dot(normalize(tan.sub(center)), sunDir);
  // exponential falloff with a ~8 km scale height (a thin limb, not a 110 km slab); rays that hit the planet get nothing
  // (no second band drawn across the ground when depth precision is poor)
  const hgt = saturate(b.sub(Rp).div(Ra.sub(Rp))), dens = exp(hgt.mul(-13.0)).mul(smoothstep(Rp.mul(0.99985), Rp.mul(1.00015), b));
  const blue = vec3(...(o.day || [0.32, 0.58, 1.0])), red = vec3(...(o.dusk || [1.0, 0.42, 0.14]));
  const col = mix(red, blue, smoothstep(-0.05, 0.35, s)).mul(smoothstep(-0.32, 0.08, s));
  const fwd = pow(saturate(dot(Vd, sunDir)), 12).mul(vec3(1.0, 0.75, 0.45)).mul(smoothstep(-0.2, 0.1, s));
  m.colorNode = vec4(min(col.add(fwd).mul(dens).mul(gain).mul(1.1), vec3(0.75)), 1); // capped below the bloom threshold: the limb never blooms
  m.userData = { center, sunDir, Rp, Ra, gain };
  return m;
}
// a sun glow sprite texture (original, procedural)
export function glowTexture(size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.06, 'rgba(255,250,235,1)'); g.addColorStop(0.12, 'rgba(255,225,170,0.55)'); g.addColorStop(0.3, 'rgba(255,190,120,0.07)'); g.addColorStop(1, 'rgba(255,170,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  // faint diffraction spikes
  x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,240,220,0.07)'; x.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; x.beginPath(); x.moveTo(size / 2 - Math.cos(a) * size / 2, size / 2 - Math.sin(a) * size / 2); x.lineTo(size / 2 + Math.cos(a) * size / 2, size / 2 + Math.sin(a) * size / 2); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// plume-soft-1: nozzle glow without the hot pin-point and diffraction spikes (a smooth gaussian falloff to nothing at the edge)
export function softGlowTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 8; i++) { const t = i / 8; g.addColorStop(t, `rgba(255,236,205,${(Math.exp(-t * t * 5) * (1 - t * t * t * t)).toFixed(4)})`); }
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// sky panorama for PBR reflections (original, procedural): blue zenith, bright horizon, warm ground, sun spot
export function envTexture() {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3d6fb8'); g.addColorStop(0.45, '#b9d4f0'); g.addColorStop(0.5, '#e8eef2'); g.addColorStop(0.52, '#6f6a58'); g.addColorStop(1, '#2a2a24');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const s = x.createRadialGradient(W * 0.3, H * 0.28, 0, W * 0.3, H * 0.28, 40); s.addColorStop(0, 'rgba(255,255,240,1)'); s.addColorStop(1, 'rgba(255,255,240,0)'); x.fillStyle = s; x.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
// procedural panel/weld normal map for tanks (original): horizontal weld rings + vertical stringers
export function panelNormal() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,255)'; x.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 64) { x.fillStyle = 'rgb(128,100,255)'; x.fillRect(0, y, S, 2); x.fillStyle = 'rgb(128,156,255)'; x.fillRect(0, y + 2, S, 2); }
  for (let i = 0; i < S; i += 32) { x.fillStyle = 'rgb(108,128,255)'; x.fillRect(i, 0, 1, S); x.fillStyle = 'rgb(148,128,255)'; x.fillRect(i + 1, 0, 1, S); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); return t;
}
// concrete albedo + roughness variation (original, procedural): noise, stains, expansion joints
export function concreteTexture() {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), img = x.createImageData(S, S);
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < S * S; i++) { const v = 150 + r() * 26 - 13; img.data[i * 4] = v; img.data[i * 4 + 1] = v - 2; img.data[i * 4 + 2] = v - 6; img.data[i * 4 + 3] = 255; }
  x.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 20 + r() * 60); g.addColorStop(0, 'rgba(60,55,50,0.18)'); g.addColorStop(1, 'rgba(60,55,50,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  x.fillStyle = 'rgba(70,70,70,0.25)'; for (let i = 0; i <= S; i += 128) { x.fillRect(i, 0, 2, S); x.fillRect(0, i, S, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// small procedural body texture for moons without a licensed map (original): tinted noise with craters
export function bodyTexture(color, seed = 1) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), col = new THREE.Color(color);
  let s = seed * 9301 + 49297; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const k = 0.75 + r() * 0.5; x.fillStyle = `rgba(${col.r * 255 * k | 0},${col.g * 255 * k | 0},${col.b * 255 * k | 0},0.35)`; const R = 1 + r() * 10; x.beginPath(); x.arc(r() * W, r() * H, R, 0, 7); x.fill(); }
  for (let i = 0; i < 60; i++) { const X = r() * W, Y = r() * H, R = 1 + r() * 6; x.strokeStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.arc(X, Y, R, 0, 7); x.stroke(); x.strokeStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.arc(X - 0.6, Y - 0.6, R, 0, 7); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export const BODY_TEX = { mercury: 'mercury', venus: 'venus', moon: 'moon', mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune', sun: 'sun' };
// ground-tile detail: break up the vertex colours with two octaves of shader noise (fades with distance)
// flight-ground-2: tileMaterial(sunPos, tier) — speckle fix + ocean waves (gfx/ocean.js). The old mask threshold used the
// km-scale noise terms (±0.3) on the 1k mask's 40 km coastal ramp, so every vertex with a mixed mask became a noise-
// carved dark "scrub" blot in open water: the speckle seen at ~2 km. Now the coastline is the mask's 0.5 contour with a
// small multi-km wobble, and land carved out of the sea is beach/scrub land colour, not a dark slab.
export function tileMaterial(sunPos = uniform(new THREE.Vector3(1e11, 0, 0)), tier = 'med', handoff = false) {
  const m = new THREE.MeshStandardNodeMaterial(); // f3: no vertexColors flag: colorNode already reads the colour attribute (the flag multiplied it in again: vc^2, near-black ground and sea)
  const p = positionLocal, n1 = mx_noise_float(p.mul(0.004)), n2 = mx_noise_float(p.mul(0.05)), n3 = mx_noise_float(p.mul(0.6));
  const d = length(positionWorld), fade = smoothstep(4000.0, 300.0, d);
  const r0 = mx_noise_float(p.mul(0.00006)), r1 = mx_noise_float(p.mul(0.00035)), r2 = mx_noise_float(p.mul(0.0016));
  const k = float(1).add(r0.mul(0.28)).add(r1.mul(0.22)).add(r2.mul(0.14)).add(n1.mul(0.16)).add(n2.mul(0.1)).add(n3.mul(0.12).mul(fade));
  const vc = attribute('color', 'vec4').xyz, tint = mix(vec3(0.82, 1.08, 0.72), vec3(1.12, 0.98, 0.78), saturate(r1.mul(0.9).add(0.5)));
  const w0 = attribute('color', 'vec4').w, w = smoothstep(0.47, 0.53, w0.add(r1.mul(0.05)).add(r2.mul(0.015)));
  const farL = smoothstep(10000.0, 50000.0, length(positionWorld.sub(cameraPosition))), land = mix(vc, vc.mul(tint), saturate(r0.mul(0.6).add(0.55))).mul(k).mul(mix(float(1), float(1 / TILE_LAND_GAIN), farL)); // f5.9: updateTile bakes land x~2.4 (near-field punch); with distance it returns to the map's own albedo = the globe's
  const sea = oceanLook({ vc, w0, w, sunPos, tier });
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('oceandbg') === '7') { m.colorNode = vec3(0, 0, 0); m.emissiveNode = vec3(w0, w, 1); return m; } // test-only: raw mask, shaped mask
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('oceandbg') === '8') { const nw = normalWorld.mul(sign(dot(normalWorld, cameraPosition.sub(positionWorld)).add(1e-4))); m.colorNode = vec3(0, 0, 0); m.emissiveNode = vec3(saturate(dot(nw, normalize(sunPos))), land.x.mul(4), saturate(dot(nw, normalize(positionWorld)))); return m; } // test-only: n.L, land albedo, n.up
  m.colorNode = mix(land, sea.color, w); m.roughnessNode = mix(float(0.95).sub(n2.mul(0.05)), sea.rough, w); m.metalnessNode = float(0);
  const nfv = normalView.mul(sign(dot(normalView, positionView.negate()).add(1e-4))); m.normalNode = mix(nfv, sea.normalView, w); // f3: tile winding gave inward normals -> unlit black ground m.emissiveNode = sea.emissive.mul(w);
  // f5.9 terrain: with distance the tile takes on the globe's aerial perspective + sea sheen (earthMaterial/waterLook: same terms, same constants), so tile and globe agree in brightness where they meet
  { const Vf = normalize(cameraPosition.sub(positionWorld)), nW = normalWorld.mul(sign(dot(normalWorld, Vf).add(1e-4))), ndl = dot(nW, normalize(sunPos.sub(positionWorld))), dayK = smoothstep(-0.2, 0.35, ndl), cv = saturate(dot(nW, Vf));
    const fr = pow(float(1).sub(cv), 2.5), haze = vec3(0.28, 0.52, 1.0).mul(pow(fr, 1.8)).mul(dayK).mul(0.55), dusk = vec3(1.0, 0.45, 0.15).mul(fr).mul(smoothstep(-0.25, 0.0, ndl).mul(smoothstep(0.3, 0.0, ndl))).mul(0.6);
    const sheen = vec3(0.10, 0.20, 0.38).mul(pow(float(1).sub(cv), 3.0).mul(0.8).add(0.12)).mul(dayK).mul(w), far = smoothstep(6000.0, 50000.0, length(positionWorld.sub(cameraPosition)));
    m.emissiveNode = haze.add(dusk).add(sheen).mul(far); }
  const disp = oceanDisplace(w0, tier); if (disp) m.positionNode = disp;
  // f5.9 terrain: fade=true builds the hand-off variant, used above ~TILE_FADE.swap m: it dissolves into the globe by ground range from the nadir and by
  // altitude (tilefade.js). It is a true blend (no dither grain) drawn right after the opaque pass and before clouds/plumes. Below that the opaque variant is used
  // (cheaper: it hides the globe behind it) because the rim is at or beyond the horizon there.
  if (handoff) { const dW = positionWorld.sub(cameraPosition), dh = max(dW.dot(dW).sub(tileFadeU.x.mul(tileFadeU.x)), 0.0).sqrt();
    m.opacityNode = float(1).sub(smoothstep(float(TILE_FADE.r0), float(TILE_FADE.r1), dh)).mul(tileFadeU.y); m.transparent = true; m.depthWrite = true; }
  return m;
}
// post: HDR → bloom → tone map (high preset only; otherwise renderer.render + tone mapping)
// gx1h2: three r172 PostProcessing shares ONE module-level quad + material across all instances, and only rebinds
// its output node when needsUpdate is set. With a flight post and a map post, whichever was built/used last kept
// owning the quad, so after leaving the map the High (bloom) preset kept showing the map pass. Track the owner and
// rebind whenever a different post renders. renderState() reports what the last frame actually drew.
let postOwner = null; export const renderState = { scene: null, camera: null, via: null };
export function makePost(renderer, scene, camera) {
  let post = null, bloomNode = null;
  return {
    async enable(on) {
      if (!on) { if (postOwner === post) postOwner = null; post = null; return; }
      if (post) return;
      try { const { bloom } = await import('three/addons/tsl/display/BloomNode.js');
        const p = new THREE.PostProcessing(renderer), sp = pass(scene, camera), c = sp.getTextureNode('output');
        bloomNode = bloom(c, 0.55, 0.35, 1.25); /* f4.1: threshold above sky/limb HDR levels (only sun, plume, flashes bloom) */ p.outputNode = c.add(bloomNode); post = p; } catch (e) { console.warn('[Orbit Rush] bloom unavailable:', e.message); post = null; }
    },
    get on() { return !!post; },
    set strength(s) { if (bloomNode) bloomNode.strength.value = s; },
    render() { renderState.scene = scene; renderState.camera = camera;
      if (post) { if (postOwner !== post) { post.needsUpdate = true; postOwner = post; } renderState.via = 'post'; post.render(); }
      else { renderState.via = 'direct'; renderer.render(scene, camera); } },
  };
}
