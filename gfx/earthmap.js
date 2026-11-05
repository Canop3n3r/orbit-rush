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
// sites-on-land-1: the shaped cape coast, shared by the ground tile (main.js), the globe (gfx.js) and the tests. The 1k mask paints
// the whole cape as one coastal texel, so the coast is shaped here: metres EAST of the heritage pad as a function of metres NORTH of it.
// The real shoreline runs NNW-SSE (it is ~1.4 km east of the heritage pad and ~1.3 km east of the north coast pad, 5 km further south),
// so it moves ~0.5 m east per metre south. (The old shape was a fixed line 1.5 km east of the heritage pad, which put the north
// coast pad ~1.1 km out at sea inside an 800 m land disc.)
export const COAST = { e0: 1400, k: -0.5, nMax: 20000, wiggle: 300, zone: 30000 };
export const coastEastM = nM => COAST.e0 + COAST.k * Math.max(-COAST.nMax, Math.min(COAST.nMax, nM));
// site land apron: radius (m) of guaranteed land around a site's pad in the ground tile, and the edge wobble/blend widths
export const siteLand = S => { const g = (S && S.layout || []).find(o => o.k === 'ground'), l = (S && S.land) || {};
  return { r: l.r || Math.max(800, g ? Math.min(g.r || 0, 1600) + 200 : 800), sand: !!l.sand, wob: l.wob ?? 0.18, edge: l.edge || 300 }; };
// sites-on-land-2: the pad meets the sampled terrain instead of stamping a land disc on open ocean.
// water is the map mask (0 land .. 1 sea), dist metres from the pad, reach the wobbled apron radius.
// An island (the atoll) feathers a shore into the sea. Everywhere else, deep water stays water — placement
// has to put the pad on land — and only a damp coastal sample under the pad is pulled dry.
export function groundBlend(water, dist, reach, edge, island) {
  if (island) {
    const inner = reach * 0.55, span = Math.max(1, reach - inner);
    const t = dist <= inner ? 1 : Math.min(1, Math.max(0, (reach - dist) / span)), s = t * t * (3 - 2 * t);
    return { water: water * (1 - s), tint: s };
  }
  const t = edge > 0 ? Math.min(1, Math.max(0, (reach - dist) / edge)) : (dist < reach ? 1 : 0), s = t * t * (3 - 2 * t);
  if (s <= 0 || water <= 0.35 || water >= 0.72) return { water, tint: 0 };
  return { water: water * (1 - s * (0.72 - water) / 0.37), tint: 0 };
}
// bilinear sample of a grayscale equirectangular mask (same lon/lat mapping as sampleEarth). px = { W, H, data }
export function sampleGray(px, lat, lon) {
  const W = px.W, H = px.H, a = px.data;
  let u = (lon / 360 + 0.5) % 1; if (u < 0) u += 1;
  const v = 0.5 - lat / 180, fx = u * W - 0.5, fy = Math.min(H - 1.001, Math.max(0, v * H - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (x, y) => a[(Math.min(H - 1, Math.max(0, y)) * W + ((x % W) + W) % W)];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}
