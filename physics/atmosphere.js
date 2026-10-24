// U.S. Standard Atmosphere 1976.
// 0–86 km: the seven standard layers, defined in geopotential altitude H with a linear temperature
// lapse rate per layer; pressure from the hydrostatic equation, density from the ideal gas law.
// 86–1000 km: the 1976 tabulated thermosphere, interpolated log-linearly (i.e. an exponential fit
// between table points, so density falls with a local scale height). Above 1000 km: vacuum.
import { P0 } from './constants.js?v=f5.8n';
const R_AIR = 287.053, GAMMA = 1.4, G0 = 9.80665, R_GEO = 6356766; // J/(kg K), -, m/s^2, m (USSA76 Earth radius)
// layer bases: geopotential altitude (m), temperature (K), lapse rate (K/m), pressure (Pa)
const LAYERS = [
  [0, 288.15, -0.0065, 101325], [11000, 216.65, 0, 22632.06], [20000, 216.65, 0.001, 5474.889], [32000, 228.65, 0.0028, 868.0187],
  [47000, 270.65, 0, 110.9063], [51000, 270.65, -0.0028, 66.93887], [71000, 214.65, -0.002, 3.956420], [84852, 186.946, 0, 0.3733836]];
// thermosphere table (geometric km, T K, p Pa, rho kg/m^3)
const HI = [[86, 186.87, 0.3734, 6.958e-6], [90, 186.87, 0.1836, 3.416e-6], [100, 195.08, 3.201e-2, 5.604e-7], [110, 240.0, 7.104e-3, 9.708e-8],
  [120, 360.0, 2.538e-3, 2.222e-8], [130, 469.27, 1.251e-3, 8.152e-9], [150, 634.39, 4.542e-4, 2.076e-9], [175, 761.2, 1.770e-4, 6.0e-10], [200, 854.56, 8.474e-5, 2.541e-10],
  [250, 941.33, 2.484e-5, 6.073e-11], [300, 976.01, 8.770e-6, 1.916e-11], [400, 995.83, 1.452e-6, 2.803e-12], [500, 999.24, 3.019e-7, 5.215e-13],
  [600, 999.85, 8.211e-8, 1.137e-13], [800, 999.99, 1.703e-8, 1.170e-14], [1000, 1000, 7.514e-9, 3.561e-15]];
export const geopotential = z => R_GEO * z / (R_GEO + z);
const VAC = Object.freeze({ T: 1000, p: 0, rho: 0, a: 634, layer: 'vacuum' });
// Returns { T (K), p (Pa), rho (kg/m^3), a (speed of sound, m/s), layer }.
export function atmosphere(z) {
  if (z < 0) z = 0;
  if (z >= 1000000) return VAC;
  if (z < 86000) {
    const H = geopotential(z); let i = LAYERS.length - 1; while (i > 0 && H < LAYERS[i][0]) i--;
    const [Hb, Tb, L, pb] = LAYERS[i], T = Tb + L * (H - Hb);
    const p = L === 0 ? pb * Math.exp(-G0 * (H - Hb) / (R_AIR * Tb)) : pb * Math.pow(Tb / T, G0 / (R_AIR * L));
    return { T, p, rho: p / (R_AIR * T), a: Math.sqrt(GAMMA * R_AIR * T), layer: ['troposphere', 'tropopause', 'stratosphere', 'stratosphere', 'stratopause', 'mesosphere', 'mesosphere', 'mesopause'][i] };
  }
  const km = z / 1000; let i = 0; while (i < HI.length - 2 && km > HI[i + 1][0]) i++;
  const a = HI[i], b = HI[i + 1], f = (km - a[0]) / (b[0] - a[0]), lg = (x, y) => Math.exp(Math.log(x) + (Math.log(y) - Math.log(x)) * f);
  const T = a[1] + (b[1] - a[1]) * f;
  return { T, p: lg(a[2], b[2]), rho: lg(a[3], b[3]), a: Math.sqrt(GAMMA * R_AIR * T), layer: z < 100000 ? 'mesosphere/thermosphere' : 'thermosphere' };
}
export const pressureRatio = z => atmosphere(z).p / P0;
