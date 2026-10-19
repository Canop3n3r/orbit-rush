// 6-degree-of-freedom rigid-body flight dynamics in the Earth-centred inertial (ECI) frame.
// State: position r, velocity v (m, m/s), attitude quaternion q (body → ECI), angular velocity w (body, rad/s).
// Forces: inverse-square gravity, engine thrust (Isp and thrust interpolated by ambient pressure, gimballed),
// drag 0.5 rho V^2 Cd(M) A, body+fin normal force at the centre of pressure, RCS. Torques: aero (CoP vs CoM)
// plus aerodynamic damping, engine gimbal, reaction wheels, RCS. Integrated with fixed-step RK4.
// Each step leaves v.tel (telemetry) for the HUD, the lessons and the effects system.
import { R_E, MU_E, OMEGA_E, G0, P0 } from './constants.js?v=q1';
import { add, sub, scale, dot, cross, len, norm, qmul, qnorm, qrot, qinv, rotZ, qAxisAngle, clamp } from './vec.js?v=q1';
import { atmosphere } from './atmosphere.js?v=q1';
import { cd0, normalModel, stagnationTemp, heatFlux, bluntCd, knudsen, rarefaction, flowRegime } from './aero.js?v=q1';
import { stepThermal, leadingRadius, initThermal } from './thermal.js?v=q1';
import { stackGeom, massProps } from './vehicle.js?v=q1';
import { propagate } from './kepler.js?v=q1';
import { BODIES, bodyAtm } from './solar.js?v=q1';
// The craft's SOI body (patched conics): v.body is a body id (default Earth). Gravity, radius, spin and
// atmosphere all come from it; for Earth these are exactly the constants used before the solar system.
export const bodyOf = v => BODIES[(v && v.body) || 'earth'];
export const muOf = v => (v && v.body && v.body !== 'earth' ? BODIES[v.body].mu : MU_E);
export const radOf = v => (v && v.body && v.body !== 'earth' ? BODIES[v.body].R : R_E);
export const omegaOf = v => (v.earthRot === false ? 0 : v.body && v.body !== 'earth' ? BODIES[v.body].omega : OMEGA_E);
const VAC = Object.freeze({ T: 3, p: 0, rho: 0, a: 300, layer: 'vacuum' });
export const atmAt = (v, z) => (!v.body || v.body === 'earth' ? atmosphere(z) : bodyAtm(v.body, z) || VAC);
export const altOf = v => len(v.r) - radOf(v);
export const upOf = v => norm(v.r);
export const noseOf = v => qrot(v.q, [0, 1, 0]);
export const airVel = (v, r = v.r, vel = v.v) => { const w = omegaOf(v); return [vel[0] + w * r[1], vel[1] - w * r[0], vel[2]]; };
// Launch site / Earth-fixed point at time t: rotates with the Earth.
export function siteAt(v, t) {
  const th = omegaOf(v) * t, s = v.site, r = rotZ(scale(s.ef, radOf(v) + s.lift), th), w = omegaOf(v);
  return { r, v: [-w * r[1], w * r[0], 0], q: qmul(qAxisAngle([0, 0, 1], th), s.q0) };
}
// Engine thrust (N) and mass flow (kg/s) of the current stage at ambient pressure p.
export function engineOut(v, p) {
  const s = v.stages[v.cur]; if (!s || s.fuel <= 0 || !(v.throttle > 0) || !s.eng || s.eng.tv <= 0) return { T: 0, mdot: 0, isp: 0 };
  const pr = Math.min(1, p / P0), Tvac = s.eng.tv * 1000 * s.n * v.throttle, isp = s.eng.ispVac - (s.eng.ispVac - s.eng.ispSl) * pr;
  return { T: Tvac * isp / s.eng.ispVac, mdot: Tvac / (s.eng.ispVac * G0), isp };
}
// Full-throttle thrust (N) of the active stage at ambient pressure p (Pa), whatever the current throttle.
export const maxThrust = (v, p) => engineOut({ ...v, throttle: 1 }, p).T;
// Maximum control torque per body axis [pitch (x), roll (y), yaw (z)] in N·m from wheels, gimbal and RCS.
export function authority(v, g, mp, T) {
  const s = v.stages[v.cur], rw = g.rw * 1000, gim = s && s.eng && s.eng.gimbal ? T * Math.sin(s.eng.gimbal) * Math.max(mp.ycom, 0.5) : 0;
  const rc = v.rcsOn && g.rcs && v.rcsFuel > 0 ? g.rcs.F * 1000 * 2 : 0;
  const rcLat = rc * Math.max(Math.abs(g.rcs ? g.rcs.y - mp.ycom : 0), 1), rcRoll = rc * g.d / 2;
  return [rw + gim + rcLat, rw + rcRoll, rw + gim + rcLat];
}
// Split a commanded body torque between wheels, gimbal and RCS. Returns { tau, fLat (body lateral thrust, N), rcsUse (N) }.
function allocate(v, g, mp, T, cmd) {
  const s = v.stages[v.cur], rw = g.rw * 1000; const tau = [0, 0, 0]; let rem = [...cmd];
  for (let k = 0; k < 3; k++) { tau[k] = clamp(rem[k], -rw, rw); rem[k] -= tau[k]; }
  let fx = 0, fz = 0;
  if (T > 0 && s && s.eng && s.eng.gimbal) {
    const arm = Math.max(mp.ycom, 0.5), fmax = T * Math.sin(s.eng.gimbal);
    fx = rem[2] / arm; fz = -rem[0] / arm; const f = Math.hypot(fx, fz); if (f > fmax) { fx *= fmax / f; fz *= fmax / f; }
    tau[0] += -arm * fz; tau[2] += arm * fx; rem[0] -= -arm * fz; rem[2] -= arm * fx;
  }
  let rcsUse = 0;
  if (v.rcsOn && g.rcs && v.rcsFuel > 0) {
    const F = g.rcs.F * 1000 * 2, lat = F * Math.max(Math.abs(g.rcs.y - mp.ycom), 1), roll = F * g.d / 2, mx = [lat, roll, lat];
    for (let k = 0; k < 3; k++) { const t = clamp(rem[k], -mx[k], mx[k]); tau[k] += t; rcsUse += Math.abs(t) / mx[k] * F; }
  }
  return { tau, fLat: [fx, 0, fz], rcsUse };
}
// Aerodynamic force (world, N) and torque (body, N·m) plus flow data, for a state.
export function aeroAt(v, g, mp, r, vel, q, w) {
  const alt = len(r) - radOf(v), atm = atmAt(v, alt), va = airVel(v, r, vel), V = len(va);
  const out = { F: [0, 0, 0], tau: [0, 0, 0], atm, V, mach: V / atm.a, qd: 0.5 * atm.rho * V * V, alpha: 0, cd: 0, cn: 0, ycp: g.yNose, flowBody: [0, -1, 0], alt };
  if (atm.rho <= 0 || V < 0.5) return out;
  const u = scale(va, 1 / V), b = qrot(q, [0, 1, 0]), cosA = clamp(dot(b, u), -1, 1), alpha = Math.acos(cosA), sa = Math.sin(alpha), ca = Math.abs(cosA);
  const M = out.mach, qd = out.qd, A = g.A;
  // axial drag: the nose shape flying nose-first, the blunt base / heat shield flying base-first (capsule
  // reentry), blended toward the free-molecular Cd ~2 in the rarefied upper thermosphere
  const wb = clamp(-cosA, 0, 1), cdAx = cd0(M) * g.cdShape * (1 - wb) + bluntCd(M) * g.tailCd * wb;
  const wr = rarefaction(knudsen(atm.rho, g.L));
  const cd = (cdAx + g.finCd + 0.5 * sa * sa) * (1 - wr) + 2.0 * wr;
  let F = scale(u, -qd * A * cd);
  const nm = normalModel(g, M), cnL = nm.cna * sa * ca, cnX = g.crossK * sa * sa, cn = cnL + cnX;
  const ycp = cn > 1e-9 ? (nm.ycp * cnL + g.yBody * cnX) / cn : nm.ycp;
  const wind = scale(u, -1), wp = sub(wind, scale(b, dot(wind, b))), wpl = len(wp);
  let tau = [0, 0, 0];
  if (wpl > 1e-9 && cn > 0) {
    const N = scale(wp, qd * A * cn / wpl); F = add(F, N);
    const Nb = qinv(q, N); tau = cross([0, ycp - mp.ycom, 0], Nb);
  }
  // aerodynamic pitch/yaw damping: each lifting component sees extra local AoA (w x arm)/V
  let kd = 0; for (const c of nm.comps) kd += c.cna * (c.y - mp.ycom) ** 2; kd += g.crossK * 0.15 * (g.L * g.L / 12);
  const damp = 0.5 * atm.rho * V * A * kd;
  tau = [tau[0] - damp * w[0], tau[1] - 0.02 * qd * A * g.d * w[1] * g.d / (2 * V), tau[2] - damp * w[2]];
  // parachutes: drag CdA (m^2) applied at the canister on top of the stack, so the canopy pulls the craft
  // base-first (heat shield down) and damps its swinging like a pendulum
  const cdaC = v.chuteCdA || 0;
  if (cdaC > 0 && g.chute) {
    const Fc = scale(u, -qd * cdaC), arm = g.chute.y - mp.ycom; F = add(F, Fc);
    const tc = cross([0, arm, 0], qinv(q, Fc)), dc = qd * cdaC * arm * arm / V;
    tau = [tau[0] + tc[0] - dc * w[0], tau[1] + tc[1] - 0.2 * dc * w[1], tau[2] + tc[2] - dc * w[2]];
  }
  Object.assign(out, { F, tau, alpha, cd, cn, ycp, flowBody: qinv(q, wind) });
  return out;
}
// One fixed step of the 6-DOF model. Uses v.throttle, v.cmdTorque (body N·m), v.trans (RCS translation,
// body, -1..1), v.rcsOn. Returns null or 'ground'.
export function stepVehicle(v, dt) {
  const t = v.clock || 0, g = stackGeom(v), mp = massProps(v, g), m = mp.m;
  const mu = muOf(v), Rb = radOf(v), atm0 = atmAt(v, len(v.r) - Rb), eo = engineOut(v, atm0.p), T = eo.T;
  const al = allocate(v, g, mp, T, v.cmdTorque || [0, 0, 0]);
  const tr = v.trans || [0, 0, 0], rcsF = v.rcsOn && g.rcs && v.rcsFuel > 0 ? g.rcs.F * 1000 * 2 : 0;
  const fT = [al.fLat[0] + tr[0] * rcsF, Math.sqrt(Math.max(0, T * T - al.fLat[0] ** 2 - al.fLat[2] ** 2)) + tr[1] * rcsF, al.fLat[2] + tr[2] * rcsF];
  const rcsUse = al.rcsUse + (Math.abs(tr[0]) + Math.abs(tr[1]) + Math.abs(tr[2])) * rcsF;
  const I = [mp.Ixx, mp.Iyy, mp.Ixx];
  if (v.clamped) {
    const up = norm(v.r), fUp = dot(qrot(v.q, fT), up), wgt = m * mu / dot(v.r, v.r);
    if (fUp <= wgt) { const s = siteAt(v, t + dt); v.r = s.r; v.v = s.v; v.q = s.q; v.w = [0, 0, 0]; v.clock = t + dt; burn(v, eo, rcsUse, dt, g); tele(v, g, mp, aeroAt(v, g, mp, v.r, v.v, v.q, v.w), T, eo, [0, 0, 0]); return null; }
    v.clamped = false;
  }
  let a0 = null;
  const deriv = (r, vel, q, w) => {
    const rm = len(r), aero = aeroAt(v, g, mp, r, vel, q, w);
    const Fw = add(qrot(q, fT), aero.F), acc = add(scale(r, -mu / (rm * rm * rm)), scale(Fw, 1 / m));
    const tau = add(al.tau, aero.tau), Iw = [I[0] * w[0], I[1] * w[1], I[2] * w[2]], gyro = cross(w, Iw);
    const dw = [(tau[0] - gyro[0]) / I[0], (tau[1] - gyro[1]) / I[1], (tau[2] - gyro[2]) / I[2]];
    const dq = qmul(q, [0, w[0], w[1], w[2]]).map(x => x * 0.5);
    if (!a0) a0 = { aero, ng: scale(Fw, 1 / m) };
    return [vel, acc, dq, dw];
  };
  const S = [v.r, v.v, v.q, v.w], k1 = deriv(...S);
  const mk = (k, h) => S.map((s, i) => s.map((x, j) => x + k[i][j] * h));
  const k2 = deriv(...mk(k1, dt / 2)), k3 = deriv(...mk(k2, dt / 2)), k4 = deriv(...mk(k3, dt));
  const nx = S.map((s, i) => s.map((x, j) => x + dt / 6 * (k1[i][j] + 2 * k2[i][j] + 2 * k3[i][j] + k4[i][j])));
  v.r = nx[0]; v.v = nx[1]; v.q = qnorm(nx[2]); v.w = nx[3]; v.clock = t + dt;
  burn(v, eo, rcsUse, dt, g);
  tele(v, g, mp, a0.aero, T, eo, a0.ng);
  heat(v, g, dt);
  if (len(v.r) < Rb) return 'ground';
  return null;
}
function burn(v, eo, rcsUse, dt, g) {
  const s = v.stages[v.cur]; if (s && eo.mdot > 0) s.fuel = Math.max(0, s.fuel - eo.mdot * dt / 1000);
  if (rcsUse > 0 && g.rcs) v.rcsFuel = Math.max(0, v.rcsFuel - rcsUse / (g.rcs.isp * G0) * dt / 1000);
}
// Telemetry exposed per frame (HUD, lessons, effects): Mach, dynamic pressure, AoA, g-load, stagnation
// temperature, stagnation heat flux, flow direction in the body frame, CoM/CoP stations, atmosphere.
// Rarefied flow: Kn is the Knudsen number at the leading end (mean free path / nose radius); in the
// thermosphere there is no continuum shock layer, so Tstag falls back toward the air temperature and the HUD
// stops quoting a Mach number (machShown = null). Tstag is also capped for dissociating air (aero.js).
function tele(v, g, mp, ae, T, eo, ng) {
  const st = ae.atm, rnL = leadingRadius(g, ae.flowBody), Kn = knudsen(st.rho, rnL), wr = rarefaction(Kn);
  v.thrust = T / 1000; v.qk = ae.qd / 1000; v.aoa = ae.alpha;
  const prev = v.tel || {};
  v.tel = { alt: ae.alt, mach: ae.mach, machShown: st.rho > 0 && wr < 0.5 ? ae.mach : null, q: ae.qd, aoa: ae.alpha, gload: len(ng) / G0, rho: st.rho, p: st.p, T: st.T, a: st.a, layer: st.layer,
    Kn, regime: st.rho > 0 ? flowRegime(Kn) : 'vacuum', rarefied: wr, rnLead: rnL,
    Tstag: st.rho > 0 ? stagnationTemp(st.T, ae.mach, wr) : st.T, heat: heatFlux(st.rho, ae.V, rnL), flowBody: ae.flowBody, vAir: ae.V, ycom: mp.ycom, ycp: ae.ycp, L: g.L, cd: ae.cd, cn: ae.cn,
    thrust: T, isp: eo.isp, mass: mp.m, Tskin: prev.Tskin || 300, hotFrac: prev.hotFrac || 0, hot: prev.hot || null, ablating: 0, chuteCdA: v.chuteCdA || 0 };
}
// Per-part heating (thermal.js) after each step. Leaves v.therm (failure, hottest part) for flight.js.
function heat(v, g, dt) {
  if (!(dt > 0)) return;
  initThermal(v);
  const t = v.tel, r = stepThermal(v, g, t.heat, t.Tstag, t.T, t.rho, t.flowBody, dt);
  v.therm = r; t.ablating = r.ablating; t.hotFrac = r.maxFrac;
  t.hot = r.hottest ? { id: r.hottest.p.id, kind: r.hottest.p.kind, T: r.hottest.p.Ts, Tmax: r.hottest.th.Tmax } : null;
  t.Tskin = r.hottest ? r.hottest.p.Ts : 300;
}
// "On rails": exact Kepler coast (no drag, no thrust), attitude frozen. For high time warp outside the air.
export function railsStep(v, dt) {
  const s = propagate(v.r, v.v, dt, muOf(v)); v.r = s.r; v.v = s.v; v.w = [0, 0, 0]; v.clock = (v.clock || 0) + dt; v.thrust = 0;
  if (v.tel) { v.tel.alt = len(v.r) - radOf(v); v.tel.q = 0; v.tel.mach = 0; v.tel.machShown = null; v.tel.gload = 0; v.tel.heat = 0; v.tel.ablating = 0; }
  // skins relax radiatively toward the ~300 K equilibrium of a sunlit/shadowed orbit while on rails
  const k = Math.exp(-dt / 300);
  for (let i = v.cur; i < v.stages.length; i++) for (const p of v.stages[i].parts) if (p.Ts !== undefined) { p.Ts = 300 + (p.Ts - 300) * k; p.Ti = 300 + (p.Ti - 300) * k; }
}
// ---------- 3-DOF point mass (spent boosters and debris): drag with Cd(M), ideal attitude ----------
export function stepPoint(b, dt) {
  const rm = len(b.r), alt = rm - radOf(b), atm = atmAt(b, alt), va = airVel(b, b.r, b.v), V = len(va);
  const s = b.stages[0]; let T = 0;
  if (s && b.throttle > 0 && s.fuel > 0) {
    const pr = Math.min(1, atm.p / P0), Tvac = s.eng.tv * 1000 * b.n * b.throttle, isp = s.eng.ispVac - (s.eng.ispVac - s.eng.ispSl) * pr;
    T = Tvac * isp / s.eng.ispVac; s.fuel = Math.max(0, s.fuel - Tvac / (s.eng.ispVac * G0) * dt / 1000);
  }
  b.thrust = T / 1000;
  const m = (s ? s.dry + s.fuel : 1) * 1000 + (b.extra || 0) * 1000;
  const M = V / atm.a, qd = 0.5 * atm.rho * V * V; b.qk = qd / 1000; b.mach = M;
  let acc = scale(b.r, -muOf(b) / (rm * rm * rm));
  if (T > 0) acc = add(acc, scale(b.dir, T / m));
  if (V > 0.5 && atm.rho > 0) acc = add(acc, scale(va, -qd * b.cdA * cd0(M) / 0.5 / m / V * 0.5));
  b.v = add(b.v, scale(acc, dt)); b.r = add(b.r, scale(b.v, dt)); b.clock = (b.clock || 0) + dt;
  return len(b.r) < radOf(b) ? 'ground' : null;
}
