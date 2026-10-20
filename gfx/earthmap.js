// Earth map geometry shared by the renderer and the tests (no DOM, no three.js).
// Earth textures are standard equirectangular maps (lon −180…180). The game's Earth-fixed +x is the pad.
// f5: the pad is LC-39A (28.6084° N, 80.6043° W) on the real map. (f1–f4 put it at 0°, 51.5° W — the Amazon mouth —
// which is why every launch "started in South America".) The physics keeps its pad on its own equator (+x, spin
// about +z); the texture spheres are turned by EARTH_TEX_MAT = Ry(lat)·Rz(−lon) so the map's LC-39A sits exactly
// at +x with geographic east along the game's east (+y): Florida under the pad, the Atlantic downrange.
export const PAD_LAT_DEG = 28.6084, PAD_LON_DEG = -80.6043;
export const EARTH_TEX_ROT = -PAD_LON_DEG * Math.PI / 180; // longitude part only (kept for old callers)
const _la = PAD_LAT_DEG * Math.PI / 180, _lo = -PAD_LON_DEG * Math.PI / 180, cl = Math.cos(_la), sl = Math.sin(_la), co = Math.cos(_lo), so = Math.sin(_lo);
// row-major 3x3: game = M · geographic (geographic frame: +z north pole, +x at lon 0, +y at lon 90° E)
export const EARTH_TEX_MAT = [cl * co, -cl * so, sl, so, co, 0, -sl * co, sl * so, cl];
export const geoToGame = g => { const m = EARTH_TEX_MAT; return [m[0] * g[0] + m[1] * g[1] + m[2] * g[2], m[3] * g[0] + m[4] * g[1] + m[5] * g[2], m[6] * g[0] + m[7] * g[1] + m[8] * g[2]]; };
export const gameToGeo = d => { const m = EARTH_TEX_MAT; return [m[0] * d[0] + m[3] * d[1] + m[6] * d[2], m[1] * d[0] + m[4] * d[1] + m[7] * d[2], m[2] * d[0] + m[5] * d[1] + m[8] * d[2]]; };
export const latLonToGame = (lat, lon) => { const a = lat * Math.PI / 180, b = lon * Math.PI / 180; return geoToGame([Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)]); };
// three.js Matrix4 elements (column-major) of the same rotation, for geometry.applyMatrix4 after rotateX(PI/2)
export const EARTH_TEX_M4 = (m => [m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1])(EARTH_TEX_MAT);
// sample day colour (linear 0..1) + water (0..1) at Earth-fixed unit direction d
export function sampleEarth(px, d, out) {
  const g = gameToGeo(d), lon = Math.atan2(g[1], g[0]), lat = Math.asin(Math.max(-1, Math.min(1, g[2])));
  let u = (lon / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1; const vv = 0.5 - lat / Math.PI;
  const fx = u * px.W - 0.5, fy = Math.min(px.H - 1.001, Math.max(0, vv * px.H - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (a, x, y, k) => a[(y * px.W + ((x % px.W) + px.W) % px.W) * 4 + k];
  for (let k = 0; k < 4; k++) { const a = k < 3 ? px.day : px.spec, kk = k < 3 ? k : 0;
    const v = (at(a, x0, y0, kk) * (1 - tx) + at(a, x0 + 1, y0, kk) * tx) * (1 - ty) + (at(a, x0, y0 + 1, kk) * (1 - tx) + at(a, x0 + 1, y0 + 1, kk) * tx) * ty;
    out[k] = k < 3 ? (v / 255) ** 2.2 : v / 255; }
  return out;
}
