// Earth map geometry shared by the renderer and the tests (no DOM, no three.js).
// Earth textures are standard equirectangular maps (lon −180…180). The game's Earth-fixed +x is the pad, which we
// put at a real equatorial coast (0°, 51.5° W, near the Amazon mouth: land at the pad, Atlantic downrange).
export const PAD_LON_DEG = -51.5;
export const EARTH_TEX_ROT = -PAD_LON_DEG * Math.PI / 180; // rotate texture spheres about the pole by this
// sample day colour (linear 0..1) + water (0..1) at Earth-fixed unit direction d
export function sampleEarth(px, d, out) {
  const lon = Math.atan2(d[1], d[0]) - EARTH_TEX_ROT, lat = Math.asin(Math.max(-1, Math.min(1, d[2])));
  let u = (lon / (2 * Math.PI) + 0.5) % 1; if (u < 0) u += 1; const vv = 0.5 - lat / Math.PI;
  const fx = u * px.W - 0.5, fy = Math.min(px.H - 1.001, Math.max(0, vv * px.H - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const at = (a, x, y, k) => a[(y * px.W + ((x % px.W) + px.W) % px.W) * 4 + k];
  for (let k = 0; k < 4; k++) { const a = k < 3 ? px.day : px.spec, kk = k < 3 ? k : 0;
    const v = (at(a, x0, y0, kk) * (1 - tx) + at(a, x0 + 1, y0, kk) * tx) * (1 - ty) + (at(a, x0, y0 + 1, kk) * (1 - tx) + at(a, x0 + 1, y0 + 1, kk) * tx) * ty;
    out[k] = k < 3 ? (v / 255) ** 2.2 : v / 255; }
  return out;
}
