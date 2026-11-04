// f6.5 pre-launch transfer planner (pure maths, no DOM): from the pad, pick the best launch day, time of day and site for a
// transfer to another world, and lay out the burns (parking orbit, departure burn, midcourse correction, arrival burn).
// Patched conics: a porkchop grid (Lambert in the Sun's frame for planets, in Earth's frame for the Moon) finds the cheap
// departure days; then for each day the launch geometry (site, time of day, orbit plane) is searched so the parking orbit
// passes through the burn point at the right moment. The in-flight planner (planFull) re-tunes the burns from the real orbit.
import * as P from '../physics.js?v=f5.9-25';
import { SITES } from '../sites.js?v=f5.9-25';
import { latLonToGame } from '../gfx/earthmap.js?v=f5.9-25';
import { ORBIT_DV } from '../parts.js?v=f5.9-25';
const V = P.V, B = P.BODIES, TAU = Math.PI * 2, D2R = Math.PI / 180, DAY = 86400;
export const PARK_ALT = 200000;      // m: parking orbit altitude
export const ASCENT_S = 540;         // s: liftoff to parking orbit
export const MAX_COAST = 3.2 * 3600; // s: at most about two parking orbits before the departure burn
export const INSERT_ARC = 17 * D2R;  // rad: how far downrange the rocket is when it reaches orbit
export const MID_DV = { moon: 25, planet: 60 }; // m/s: nominal midcourse correction budget
const OBL = 23.43928 * D2R;
const ecl = v => [v[0], Math.cos(OBL) * v[1] + Math.sin(OBL) * v[2], -Math.sin(OBL) * v[1] + Math.cos(OBL) * v[2]];
const eq = v => [v[0], Math.cos(OBL) * v[1] - Math.sin(OBL) * v[2], Math.sin(OBL) * v[1] + Math.cos(OBL) * v[2]];
const Z_ECL = ecl([0, 0, 1]);
const add = V.add, sub = V.sub, sc = V.scale, dot = V.dot, cross = V.cross, len = V.len, nz = V.norm;
const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const mod2pi = a => { a %= TAU; return a < 0 ? a + TAU : a; };
function rotAbout(vv, k, a) { const c = Math.cos(a), s = Math.sin(a); return add(add(sc(vv, c), sc(cross(k, vv), s)), sc(k, dot(k, vv) * (1 - c))); }
// ---------- Earth orientation (real: Earth rotation angle) ----------
// The game's Earth frame has its +x on the main pad (28.6° N, 80.6° W on the map). With the real rotation angle of the day,
// the pad sits at azimuth ERA(t) + PAD_LON about the pole, so launch times of day are the real ones.
export const eraAt = P.eraAt, phaseAt = P.realPhaseAt; // rad; t = s since J2000
// inertial (ecliptic) unit vector of an Earth-fixed game-frame direction ef at time t
export function siteVec(ef, t) { const f = phaseAt(t), c = Math.cos(f), s = Math.sin(f); return nz(ecl([ef[0] * c - ef[1] * s, ef[0] * s + ef[1] * c, ef[2]])); }
// local mean-ish solar hour at longitude lonDeg (map longitude) at time t, from the real Sun direction
export function localHour(lonDeg, t) {
  const sun = eq(sc(P.absState('earth', t).r, -1)), azSun = Math.atan2(sun[1], sun[0]), azSite = eraAt(t) + lonDeg * D2R;
  const h = 12 + wrapPi(azSite - azSun) * 12 / Math.PI; return ((h % 24) + 24) % 24;
}
export const fmtHour = h => { const m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// Lambert (universal variables, one revolution, prograde about +z): the same solution as patched.js lambert(), with early exit (fast enough for a porkchop grid)
export function lambertFast(r1, r2, dt, mu) {
  const R1 = len(r1), R2 = len(r2), cr = cross(r1, r2); let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2)))); if (cr[2] < 0) dth = TAU - dth;
  const A = Math.sin(dth) * Math.sqrt(R1 * R2 / (1 - Math.cos(dth))); if (!isFinite(A) || Math.abs(A) < 1e-9) return null;
  const sm = Math.sqrt(mu);
  const cs = z => { if (z > 1e-6) { const q = Math.sqrt(z); return [(1 - Math.cos(q)) / z, (q - Math.sin(q)) / (q * q * q)]; } if (z < -1e-6) { const q = Math.sqrt(-z); return [(Math.cosh(q) - 1) / -z, (Math.sinh(q) - q) / (q * q * q)]; } return [0.5, 1 / 6]; };
  const yOf = (z, C, S) => R1 + R2 + A * (z * S - 1) / Math.sqrt(C);
  let lo = -4 * Math.PI * Math.PI, hi = 4 * Math.PI * Math.PI; { let g = 0; while (g++ < 400) { const [C, S] = cs(lo); if (yOf(lo, C, S) >= 0) break; lo += 0.1; } }
  for (let i = 0; i < 80 && hi - lo > 1e-9; i++) { const m = (lo + hi) / 2, [C, S] = cs(m), yy = yOf(m, C, S); const f = yy < 0 ? -Infinity : (yy / C) ** 1.5 * S + A * Math.sqrt(yy) - sm * dt; if (!isFinite(f) || f < 0) lo = m; else hi = m; }
  const z = (lo + hi) / 2, [C, S] = cs(z), yy = yOf(z, C, S), f = 1 - yy / R1, g = A * Math.sqrt(yy / mu), gd = 1 - yy / R2;
  return { v1: sc(sub(r2, sc(r1, f)), 1 / g), v2: sc(sub(sc(r2, gd), r1), 1 / g) };
}
// ---------- departure / arrival Δv ----------
export const dvEscape = (vinf, mu, r) => Math.sqrt(vinf * vinf + 2 * mu / r) - Math.sqrt(mu / r); // burn from a circular orbit of radius r
const captureAlt = id => { const b = B[id]; return Math.max(b.atm ? P.atmTop(id) + 100000 : 100000, id === 'moon' ? 100000 : 0, B[id].kind === 'planet' && !b.atm ? 200000 : 0, b.R > 2e7 ? b.R * 2 : 0); };
const hohmannTT = (a1, a2, mu) => Math.PI * Math.sqrt(((a1 + a2) / 2) ** 3 / mu);
const synodic = id => B[id].parent === 'earth' ? 29.53 * DAY : TAU / Math.abs(TAU / B.earth.period - TAU / B[id].period);
export const canPlan = id => id === 'moon' || (B[id] && B[id].parent === 'sun' && id !== 'earth');
// one porkchop point: total transfer Δv (departure + arrival) and the asymptote
function leg(target, td, tf) {
  const rp = B.earth.R + PARK_ALT;
  if (target === 'moon') {
    const m2 = P.relState('moon', td + tf), r2 = m2.r, rU = rotAbout(sc(nz(r2), -rp), Z_ECL, 5 * D2R); // burn point ≈ opposite the arrival point (175° transfer)
    const L = lambertFast(rU, r2, tf, B.earth.mu); if (!L) return null;
    const vinf2 = sub(L.v2, m2.v), rm = B.moon.R + captureAlt('moon');
    const dvDep = len(L.v1) - Math.sqrt(B.earth.mu / rp), dvArr = dvEscape(len(vinf2), B.moon.mu, rm);
    return { dvDep, dvArr, total: dvDep + dvArr, axis: nz(r2), vinfDep: Math.sqrt(Math.max(0, len(L.v1) ** 2 - 2 * B.earth.mu / rp)), vinfArr: len(vinf2), gamma: Math.PI, tf };
  }
  const e = P.absState('earth', td), m = P.absState(target, td + tf), L = lambertFast(e.r, m.r, tf, B.sun.mu); if (!L) return null;
  const vd = sub(L.v1, e.v), va = sub(L.v2, m.v), rm = B[target].R + captureAlt(target), vi = len(vd);
  const dvDep = dvEscape(vi, B.earth.mu, rp), dvArr = dvEscape(len(va), B[target].mu, rm), ecc = 1 + rp * vi * vi / B.earth.mu;
  return { dvDep, dvArr, total: dvDep + dvArr, axis: nz(vd), vinfDep: vi, vinfArr: len(va), gamma: Math.acos(-1 / ecc), tf };
}
// cheapest flight time for a departure day
function bestLeg(target, td) {
  const tt = target === 'moon' ? 4.5 * DAY : hohmannTT(B.earth.a, B[target].a, B.sun.mu); let best = null;
  const lo = target === 'moon' ? 2.5 * DAY : 0.55 * tt, hi = target === 'moon' ? 6.5 * DAY : 1.7 * tt, step = target === 'moon' ? 0.25 * DAY : tt / 28;
  for (let tf = lo; tf <= hi; tf += step) { const l = leg(target, td, tf); if (l && isFinite(l.total) && (!best || l.total < best.total)) best = l; }
  if (best) { // refine around the best flight time
    const s2 = step / 4, c = best.tf; for (let tf = c - step; tf <= c + step; tf += s2) { const l = leg(target, td, tf); if (l && isFinite(l.total) && l.total < best.total) best = l; } }
  return best;
}
// ---------- launch geometry ----------
const effEast = ef => { const s = nz(ef); return [-s[1], s[0], 0]; };
// the best launch (time, plane) from one site for a departure at td along axis a with hyperbola angle gamma
function siteLaunches(site, td, leg1) {
  const ef = site.ef, a = leg1.axis, gamma = leg1.gamma, rp = B.earth.R + PARK_ALT, nOrb = Math.sqrt(B.earth.mu / rp ** 3), vc = Math.sqrt(B.earth.mu / rp), out = [];
  const t1 = td - 600 - ASCENT_S, t0 = td - ASCENT_S - MAX_COAST, STEP = 30; let prev = null;
  const eval1 = tL => {
    const s = siteVec(ef, tL), n0 = cross(a, s), l = len(n0); if (l < 1e-3) return null;
    let n = sc(n0, 1 / l); if (dot(n, Z_ECL) < 0) n = sc(n, -1);
    const pDir = rotAbout(a, n, -gamma), pIns = rotAbout(s, n, INSERT_ARC), al = mod2pi(Math.atan2(dot(cross(pIns, pDir), n), dot(pIns, pDir)));
    const tc = td - tL - ASCENT_S; return { tL, n, s, g: wrapPi(tc * nOrb - al), tc };
  };
  for (let tL = t0; tL <= t1; tL += STEP) {
    const e = eval1(tL); if (!e) { prev = null; continue; }
    if (prev && Math.abs(e.g - prev.g) < 1.5 && prev.g * e.g <= 0 && e.tc > 300) {
      const f = Math.abs(prev.g) / (Math.abs(prev.g) + Math.abs(e.g) + 1e-12), tR = prev.tL + f * STEP, r = eval1(tR); if (!r) { prev = e; continue; }
      const incl = Math.acos(Math.max(-1, Math.min(1, dot(r.n, Z_ECL)))), up = nz(r.s), east = nz(cross(Z_ECL, up)), north = cross(up, east);
      const vdir = cross(r.n, up), az = Math.atan2(dot(vdir, east), dot(vdir, north));
      if (dot(vdir, north) > 0 && az > 0 && az < 1.0 * Math.PI * 0.86 && incl < 100 * D2R) { // north-of-east ascents only (what the ascent guidance flies), not past 155°
        const w = sc(cross(Z_ECL, sc(up, B.earth.R)), P.OMEGA_E), vH = sc(vdir, vc), vEff = len(sub(vH, w)), vBest = vc - P.OMEGA_E * B.earth.R * Math.sqrt(Math.max(0, 1 - dot(up, Z_ECL) ** 2));
        out.push({ tL: r.tL, incl, az, vEff, ascentDv: ORBIT_DV + (vEff - (vc - P.OMEGA_E * B.earth.R)), extra: vEff - vBest, resid: Math.abs(r.g), n: r.n, coast: r.tc }); }
    }
    prev = e;
  }
  return out;
}
export function launchSites() { return (SITES.earth || []).map(s => ({ id: s[0], name: s[1], lat: s[2], lon: s[3], ef: latLonToGame(s[2], s[3]) })); }
// ---------- the planner ----------
// opts: { target, t0 (game clock now, s since J2000), horizonDays, sites, dvAvail (rocket Δv beyond nothing: total design Δv, m/s) }
export function planTransfer(opts) {
  const target = opts.target; if (!canPlan(target)) return { ok: false, why: `${B[target] ? B[target].name : target} is not a transfer target from Earth` };
  const syn = synodic(target), horizon = (opts.horizonDays ? opts.horizonDays * DAY : Math.min(syn * 1.05, 3.2 * 365 * DAY)), tStart = opts.t0 + (opts.leadDays ?? 3) * DAY;
  const step = target === 'moon' ? 0.5 * DAY : Math.max(2, Math.min(6, syn / 160 / DAY)) * DAY, grid = [];
  for (let td = tStart; td <= tStart + horizon; td += step) { const l = bestLeg(target, td); if (l) grid.push({ td, ...l }); }
  if (!grid.length) return { ok: false, why: 'No transfer found' };
  // windows: local minima of the cheapest transfer, at least half a synodic period apart
  const wins = []; for (let i = 0; i < grid.length; i++) { const a = grid[i - 1], b = grid[i], c = grid[i + 1]; if ((!a || b.total <= a.total) && (!c || b.total <= c.total)) wins.push(b); }
  wins.sort((x, y) => x.td - y.td); const kept = []; for (const w of wins) { const last = kept[kept.length - 1]; if (last && w.td - last.td < syn * 0.5) { if (w.total < last.total) kept[kept.length - 1] = w; } else kept.push(w); }
  const best = kept.reduce((m, w) => (w.total < m.total ? w : m), kept[0]), first = kept.find(w => w.total <= best.total * 1.12 + 50) || best;
  const sites = opts.sites || launchSites(), midDv = target === 'moon' ? MID_DV.moon : MID_DV.planet;
  // fine search around the chosen window for the best (day, site, time of day)
  let pick = null; const span = target === 'moon' ? 14 : 8, fine = 0.25;
  for (let dd = -span; dd <= span; dd += fine) { const td = first.td + dd * DAY; if (td < tStart) continue; const l = bestLeg(target, td); if (!l) continue;
    for (const site of sites) for (const c of siteLaunches(site, td, l)) {
      const J = c.ascentDv + l.total + midDv + 2 * (td - tStart) / DAY; if (!pick || J < pick.J) pick = { J, td, leg: l, site, c }; } }
  if (!pick) return { ok: false, why: 'No launch geometry found' };
  const { leg: L, site, c } = pick, td = pick.td, tLaunch = c.tL, arr = td + L.tf, hour = localHour(site.lon, tLaunch);
  const burns = [
    { key: 'tmi', name: target === 'moon' ? 'Trans-lunar burn' : 'Departure burn', t: td, dv: L.dvDep, note: `from the ${(PARK_ALT / 1000).toFixed(0)} km parking orbit` },
    { key: 'mid', name: 'Midcourse correction', t: td + (target === 'moon' ? 1 : 20) * DAY, dv: midDv, note: 'small tweak to aim at the target' },
    { key: 'cap', name: 'Arrival burn', t: arr, dv: L.dvArr, note: `capture into orbit around ${B[target].name}` }];
  const transferDv = L.dvDep + midDv + L.dvArr, required = c.ascentDv + transferDv;
  return { ok: true, target, targetName: B[target].name, kind: target === 'moon' ? 'moon' : 'planet', synodic: syn,
    launch: { t: tLaunch, date: P.dateFromT(tLaunch), site: site.id, siteName: site.name, lat: site.lat, lon: site.lon, localHour: hour, incl: c.incl / D2R, azimuth: c.az / D2R, coast: c.coast, resid: c.resid },
    park: { alt: PARK_ALT, period: TAU * Math.sqrt((B.earth.R + PARK_ALT) ** 3 / B.earth.mu) }, burns, departT: td, arriveT: arr, flightTime: L.tf,
    vinfDep: L.vinfDep, vinfArr: L.vinfArr, c3: L.vinfDep ** 2, dvDep: L.dvDep, dvMid: midDv, dvCap: L.dvArr, transferDv, ascentDv: c.ascentDv, required,
    windows: kept.map(w => ({ t: w.td, date: P.dateFromT(w.td), dv: w.total })), porkchop: grid.map(g => ({ t: g.td, dv: g.total })) };
}
// plain verdict for the player: can this rocket do it?
export function verdict(plan, dvAvail) {
  if (!plan || !plan.ok) return { level: 'none', ratio: 0, text: '' };
  const ratio = dvAvail / plan.required, spare = dvAvail - plan.required;
  if (!(dvAvail > 0)) return { level: 'none', ratio, spare, text: '' };
  if (ratio >= 1.15) return { level: 'ok', ratio, spare, text: 'Your rocket can do it, with room to spare.' };
  if (ratio >= 1.0) return { level: 'tight', ratio, spare, text: 'Your rocket can just do it. Fly cleanly: there is little margin.' };
  return { level: 'no', ratio, spare, text: 'Your rocket cannot do this on its own: it comes up short on fuel.' };
}
