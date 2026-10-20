// The solar system at real scale: the Sun, 8 planets, major moons, Pluto/Charon.
// Planets: JPL "Keplerian elements for approximate positions of the major planets" (Standish, Table 1,
// valid 1800–2050 AD), J2000 ecliptic, with linear rates per Julian century. Earth uses the Earth–Moon
// barycentre elements minus the Moon's share. Moons: mean elements (a, e, i, node, argument of
// periapsis, mean anomaly at J2000) relative to the parent's equator (the Moon: to the ecliptic, with its
// 18.6-year nodal regression and 8.85-year apsidal precession). Physical data: IAU WGCCRE 2015 radii,
// GM (JPL DE440 values), pole RA/Dec and prime-meridian rate W(t).
// Frames: ECL = heliocentric J2000 ecliptic (the map/world frame). Each body has an inertial
// "equatorial" frame (z = its spin pole); a craft's state is always kept in its SOI body's frame, so the
// Earth frame is the same ECI frame the rest of physics/ has always used (z = Earth's pole, spin about z).
import { R_E, MU_E, OMEGA_E } from './constants.js?v=f5.1c';
const D2R = Math.PI / 180, DAY = 86400, CENT = 36525 * DAY, AU = 1.495978707e11, OBL = 23.43928 * D2R;
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // J2000.0 = 2000-01-01 12:00 TT (≈ UTC + 64 s; ignored)
export { AU };
const KM = 1000, GMk = x => x * 1e9; // km^3/s^2 -> m^3/s^2
// ---------- small 3x3 helpers (row-major arrays of 9) ----------
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mtv = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const cols = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]; // matrix with columns x,y,z
const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nz = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const M3 = { mv, mtv, cols };
// equatorial (ICRF) -> ecliptic J2000
const eq2ecl = v => [v[0], Math.cos(OBL) * v[1] + Math.sin(OBL) * v[2], -Math.sin(OBL) * v[1] + Math.cos(OBL) * v[2]];
export const eqToEcl = eq2ecl;
// ---------- atmosphere models for non-Earth bodies: exponential in density with a scale height ----------
// rho0 (kg/m^3) at the reference surface (1 bar level for the giants), H (m), T (K), Rg (J/kg/K), gamma.
const ATM = {
  venus: { rho0: 65, H: 15900, T: 737, Rg: 188.9, gamma: 1.29, top: 250000, gas: 'CO₂' },
  mars: { rho0: 0.020, H: 11100, T: 210, Rg: 188.9, gamma: 1.29, top: 150000, gas: 'CO₂' },
  titan: { rho0: 5.3, H: 21000, T: 94, Rg: 296.8, gamma: 1.4, top: 700000, gas: 'N₂' },
  jupiter: { rho0: 0.16, H: 27000, T: 165, Rg: 3745, gamma: 1.43, top: 1000000, gas: 'H₂/He', deep: true },
  saturn: { rho0: 0.19, H: 59500, T: 134, Rg: 3892, gamma: 1.43, top: 1500000, gas: 'H₂/He', deep: true },
  uranus: { rho0: 0.42, H: 27700, T: 76, Rg: 3615, gamma: 1.43, top: 1000000, gas: 'H₂/He/CH₄', deep: true },
  neptune: { rho0: 0.45, H: 19700, T: 72, Rg: 3615, gamma: 1.43, top: 1000000, gas: 'H₂/He/CH₄', deep: true },
};
export function expAtmosphere(m, z) {
  if (z >= m.top) return { T: m.T, p: 0, rho: 0, a: Math.sqrt(m.gamma * m.Rg * m.T), layer: 'vacuum' };
  const rho = m.rho0 * Math.exp(-z / m.H), T = m.T;
  return { T, p: rho * m.Rg * T, rho, a: Math.sqrt(m.gamma * m.Rg * T), layer: z < 0 ? 'deep atmosphere' : m.gas + ' atmosphere' };
}
// ---------- the bodies ----------
// planets: [a AU, e, I°, L°, ϖ°, Ω°] and rates per century (Standish Table 1)
const JPL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};
// id: [name, parent, R km, GM km^3/s^2, pole RA°, pole Dec°, W0°, Wdot °/day, colour, kind]
const PHYS = {
  sun: ['Sun', null, 695700, 1.32712440041e11, 286.13, 63.87, 84.176, 14.1844, 0xfff1c0, 'star'],
  mercury: ['Mercury', 'sun', 2439.7, 22031.868551, 281.0103, 61.4155, 329.5988, 6.1385108, 0x9a948c, 'planet'],
  venus: ['Venus', 'sun', 6051.8, 324858.592, 272.76, 67.16, 160.20, -1.4813688, 0xe6c88a, 'planet'],
  earth: ['Earth', 'sun', 6378.137, 398600.435507, 0, 90, 0, 360.9856235, 0x4a8cd8, 'planet'],
  moon: ['Moon', 'earth', 1737.4, 4902.800118, 269.9949, 66.5392, 38.3213, 13.17635815, 0xb8b4ac, 'moon'],
  mars: ['Mars', 'sun', 3396.19, 42828.375816, 317.68143, 52.88650, 176.630, 350.89198226, 0xc8643c, 'planet'],
  phobos: ['Phobos', 'mars', 11.08, 0.0007087, 317.68, 52.90, 35.06, 1128.8445850, 0x8a7d70, 'moon'],
  deimos: ['Deimos', 'mars', 6.2, 0.0000962, 316.65, 53.52, 79.41, 285.1618970, 0x9a8c7c, 'moon'],
  jupiter: ['Jupiter', 'sun', 71492, 126686531.9, 268.056595, 64.495303, 284.95, 870.5360000, 0xd8b48a, 'planet'],
  io: ['Io', 'jupiter', 1821.6, 5959.9155, 268.05, 64.50, 200.39, 203.4889538, 0xe8d26a, 'moon'],
  europa: ['Europa', 'jupiter', 1560.8, 3202.7121, 268.08, 64.51, 36.022, 101.3747235, 0xd8cfc0, 'moon'],
  ganymede: ['Ganymede', 'jupiter', 2634.1, 9887.8328, 268.20, 64.57, 44.064, 50.3176081, 0xa89c8c, 'moon'],
  callisto: ['Callisto', 'jupiter', 2410.3, 7179.2834, 268.72, 64.83, 259.51, 21.5710715, 0x6e665c, 'moon'],
  saturn: ['Saturn', 'sun', 60268, 37931206.2, 40.589, 83.537, 38.90, 810.7939024, 0xe6d29c, 'planet'],
  enceladus: ['Enceladus', 'saturn', 252.1, 7.2110, 40.66, 83.52, 6.32, 262.7318996, 0xf4f4f4, 'moon'],
  titan: ['Titan', 'saturn', 2574.73, 8978.1383, 39.4827, 83.4279, 186.5855, 22.5769768, 0xd6a64a, 'moon'],
  uranus: ['Uranus', 'sun', 25559, 5793950.6, 257.311, -15.175, 203.81, -501.1600928, 0x9ad8e0, 'planet'],
  neptune: ['Neptune', 'sun', 24764, 6835099.5, 299.36, 43.46, 249.978, 541.1397757, 0x4a6ad8, 'planet'],
  triton: ['Triton', 'neptune', 1353.4, 1428.495, 299.36, 41.17, 296.53, -61.2572637, 0xc8bcb4, 'moon'],
  pluto: ['Pluto', 'sun', 1188.3, 869.6138, 132.993, -6.163, 302.695, 56.3625225, 0xc8a888, 'dwarf'],
  charon: ['Charon', 'pluto', 606, 105.8799, 132.993, -6.163, 122.695, 56.3625225, 0x9a9490, 'moon'],
};
// moons: [a km, e, i°, Ω°, ω°, M0° at J2000, reference: 'eq' (parent equator) | 'ecl']
const MOONS = {
  phobos: [9376, 0.0151, 1.075, 207.78, 150.06, 91.06, 'eq'], deimos: [23458, 0.0002, 1.788, 24.53, 290.50, 296.23, 'eq'],
  io: [421800, 0.0041, 0.036, 43.98, 84.13, 342.02, 'eq'], europa: [671100, 0.0094, 0.466, 219.11, 88.97, 171.02, 'eq'],
  ganymede: [1070400, 0.0013, 0.177, 63.55, 192.42, 317.54, 'eq'], callisto: [1882700, 0.0074, 0.192, 298.85, 52.64, 181.41, 'eq'],
  enceladus: [238040, 0.0047, 0.009, 169.5, 211.9, 197.0, 'eq'], titan: [1221870, 0.0288, 0.306, 28.06, 180.53, 163.31, 'eq'],
  triton: [354759, 0.000016, 156.865, 177.61, 66.83, 352.26, 'eq'], charon: [19596, 0.0002, 0.08, 223.05, 146.11, 131.07, 'eq'],
};
export const BODIES = {};
for (const [id, p] of Object.entries(PHYS)) {
  const [name, parent, Rkm, gm, ra, dec, W0, Wd, color, kind] = p;
  BODIES[id] = { id, name, parent, R: Rkm * KM, mu: GMk(gm), poleRA: ra, poleDec: dec, W0, Wd, color, kind, children: [], atm: ATM[id] || null,
    omega: Wd * D2R / DAY, // rad/s (negative = retrograde spin)
    tilt: 0, soi: Infinity };
}
// Earth keeps the exact constants the rest of the game uses (WGS84 R, the same GM and sidereal rate)
Object.assign(BODIES.earth, { R: R_E, mu: MU_E, omega: OMEGA_E, atm: 'ussa76' });
for (const b of Object.values(BODIES)) if (b.parent) BODIES[b.parent].children.push(b.id);
export const BODY_IDS = Object.keys(BODIES);
// ---------- frames ----------
// Body inertial frame (columns = its axes in ECL). z = spin pole; x = ascending node of the body's equator on
// the ICRF equator (IAU convention). Earth: x = the J2000 equinox rotated by EARTH_PHI (a fixed angle chosen at
// game start so the launch site starts the day in mid-morning; still an inertial frame with z = the pole).
let EARTH_PHI = 0;
export function setEarthPhase(phi) { EARTH_PHI = phi; frameCache.clear(); }
export const earthPhase = () => EARTH_PHI;
const frameCache = new Map();
export function frameOf(id) {
  if (id === 'sun') return [1, 0, 0, 0, 1, 0, 0, 0, 1]; // the Sun's frame is ECL itself (heliocentric orbits are ecliptic-referenced)
  let F = frameCache.get(id); if (F) return F;
  const b = BODIES[id], a = b.poleRA * D2R, d = b.poleDec * D2R;
  let zq = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)], xq = [-Math.sin(a), Math.cos(a), 0];
  if (id === 'earth') { zq = [0, 0, 1]; xq = [Math.cos(EARTH_PHI), Math.sin(EARTH_PHI), 0]; }
  const z = eq2ecl(zq), x = eq2ecl(xq), y = cr(z, x);
  F = cols(x, y, z); frameCache.set(id, F); return F;
}
// axial tilt = angle between the spin pole and the orbit normal
// ---------- Kepler elements → state ----------
function solveE(M, e) { let E = e < 0.8 ? M : Math.PI; for (let i = 0; i < 30; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-13) break; } return E; }
// state from (a m, e, i, Ω, ω, M rad, mu) in the reference frame of the elements
export function stateFromElements(a, e, i, O, w, M, mu) {
  const E = solveE(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), e), cE = Math.cos(E), sE = Math.sin(E), fac = Math.sqrt(1 - e * e);
  const xp = a * (cE - e), yp = a * fac * sE, r = a * (1 - e * cE), n = Math.sqrt(mu / (a * a * a)), vxp = -a * n * sE / (1 - e * cE), vyp = a * n * fac * cE / (1 - e * cE);
  const cO = Math.cos(O), sO = Math.sin(O), cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i);
  const P = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si], Q = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  void r; return { r: add(sc(P, xp), sc(Q, yp)), v: add(sc(P, vxp), sc(Q, vyp)) };
}
const MOON_FRAC = 1 / (1 + 81.30056); // Moon's share of the Earth–Moon barycentre offset
function moonEcl(t) { // geocentric Moon in ECL from mean elements with precessing node and perigee
  const T = t / CENT, L = (218.3164477 + 481267.88123421 * T) * D2R, pi = (83.3532465 + 4069.0137287 * T) * D2R, O = (125.0445479 - 1934.1362891 * T) * D2R;
  return stateFromElements(384748 * KM, 0.0549, 5.145 * D2R, O, pi - O, L - pi, BODIES.earth.mu + BODIES.moon.mu);
}
function planetEcl(id, t) { // heliocentric ECL state (EMB for Earth before the correction)
  const [e0, r] = JPL[id], T = t / CENT, el = e0.map((x, k) => x + r[k] * T);
  const a = el[0] * AU, e = el[1], I = el[2] * D2R, L = el[3] * D2R, wb = el[4] * D2R, O = el[5] * D2R;
  return stateFromElements(a, e, I, O, wb - O, L - wb, BODIES.sun.mu);
}
// State of body `id` relative to its parent, in the PARENT's inertial frame, at t seconds after J2000.
export function relState(id, t) {
  const b = BODIES[id];
  if (!b.parent) return { r: [0, 0, 0], v: [0, 0, 0] };
  if (b.parent === 'sun') {
    const s = planetEcl(id, t);
    if (id === 'earth') { const m = moonEcl(t); return { r: sub(s.r, sc(m.r, MOON_FRAC)), v: sub(s.v, sc(m.v, MOON_FRAC)) }; }
    return s;
  }
  if (id === 'moon') { const m = moonEcl(t), F = frameOf('earth'); return { r: mtv(F, m.r), v: mtv(F, m.v) }; }
  const [aK, e, i, O, w, M0] = MOONS[id], mu = BODIES[b.parent].mu + b.mu, a = aK * KM, n = Math.sqrt(mu / (a * a * a));
  return stateFromElements(a, e, i * D2R, O * D2R, w * D2R, M0 * D2R + n * t, mu);
}
// Heliocentric ECL state of a body.
export function absState(id, t) {
  const b = BODIES[id]; if (!b.parent) return { r: [0, 0, 0], v: [0, 0, 0] };
  const p = absState(b.parent, t), s = relState(id, t), F = frameOf(b.parent);
  return { r: add(p.r, mv(F, s.r)), v: add(p.v, mv(F, s.v)) };
}
// ---------- spheres of influence (Laplace): r = a (m/M)^(2/5) ----------
for (const b of Object.values(BODIES)) if (b.parent) {
  const s = relState(b.id, 0), P = BODIES[b.parent], a = JPL[b.id] ? JPL[b.id][0][0] * AU : b.id === 'moon' ? 384748 * KM : MOONS[b.id][0] * KM;
  b.a = a; b.soi = a * Math.pow(b.mu / P.mu, 0.4);
  const h = nz(mv(frameOf(b.parent), cr(s.r, s.v))), pole = mv(frameOf(b.id), [0, 0, 1]);
  b.tilt = Math.acos(Math.max(-1, Math.min(1, h[0] * pole[0] + h[1] * pole[1] + h[2] * pole[2]))) / D2R;
  b.period = 2 * Math.PI * Math.sqrt(a ** 3 / (P.mu + b.mu));
}
BODIES.sun.soi = Infinity;
// ---------- frame transfers for patched conics ----------
// craft state (r, v) in body `from`'s frame → frame of its parent (adds the body's state); and the inverse.
export function toParent(from, r, v, t) {
  const b = BODIES[from], s = relState(from, t), Fb = frameOf(from), Fp = frameOf(b.parent);
  return { r: add(mtv(Fp, mv(Fb, r)), s.r), v: add(mtv(Fp, mv(Fb, v)), s.v), body: b.parent };
}
export function toChild(child, r, v, t) {
  const b = BODIES[child], s = relState(child, t), Fb = frameOf(child), Fp = frameOf(b.parent);
  return { r: mtv(Fb, mv(Fp, sub(r, s.r))), v: mtv(Fb, mv(Fp, sub(v, s.v))), body: child };
}
// Express a state given in body `from`'s frame in body `to`'s frame (any two bodies), via ECL.
export function transfer(from, to, r, v, t) {
  if (from === to) return { r: [...r], v: [...v], body: to };
  const A = absState(from, t), B = absState(to, t), Fa = frameOf(from), Fb = frameOf(to);
  const rE = add(A.r, mv(Fa, r)), vE = add(A.v, mv(Fa, v));
  return { r: mtv(Fb, sub(rE, B.r)), v: mtv(Fb, sub(vE, B.v)), body: to };
}
// Which SOI does a craft at (r, v) in body `id`'s frame belong to? Returns a body id (same if unchanged).
export function soiOf(id, r, t) {
  const b = BODIES[id], d = Math.hypot(r[0], r[1], r[2]);
  if (b.parent && d > b.soi) return b.parent;
  for (const c of b.children) { const s = relState(c, t), cb = BODIES[c]; if (Math.hypot(r[0] - s.r[0], r[1] - s.r[1], r[2] - s.r[2]) < cb.soi) return c; }
  return id;
}
// Atmosphere of a body at altitude z (Earth → null: callers use USSA76).
export const bodyAtm = (id, z) => { const m = BODIES[id].atm; return m && m !== 'ussa76' ? expAtmosphere(m, z) : null; };
export const atmTop = id => { const m = BODIES[id].atm; return m === 'ussa76' ? 1000000 : m ? m.top : 0; };
// Body-fixed rotation angle (rad) of a body about its pole at time t (IAU W(t)); Earth uses the game's own
// sidereal angle from launch instead (flight clock), so this is only for drawing the other bodies.
export const spinAngle = (id, t) => ((BODIES[id].W0 + BODIES[id].Wd * t / DAY) % 360) * D2R;
// game time ↔ calendar
export const tFromDate = ms => (ms - J2000_MS) / 1000;
export const dateFromT = t => new Date(J2000_MS + t * 1000);
// Sun direction (unit, in body `id`'s frame) at time t, for lighting and the Earth start phase.
export function sunDir(id, t) { const s = absState(id, t), F = frameOf(id); return nz(mtv(F, sc(s.r, -1))); }
