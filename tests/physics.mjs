// Physics v2 tests: full-scale gravity and orbits, the 1976 standard atmosphere, Mach drag, aerodynamic
// stability (CoP vs CoM), 6-DOF rigid-body attitude, Earth rotation, engines, and AUTO to orbit at full scale.
// Run: node tests/physics.mjs   (exits non-zero on failure)
import * as P from '../physics.js?v=f5.1a';
import { TEMPLATES, buildVehicle, aeroBalance, cloneDesign } from '../parts.js?v=f5.1a';
import { simulateAuto, PHYS_DT } from '../flight.js?v=f5.1a';
const { V, R, MU } = P;
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ✔', name, extra); } else { fail++; console.log('  ✘', name, extra); } };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
const DEG = Math.PI / 180;
// A coasting vehicle (no thrust, SAS off) at position r with velocity v; Earth rotation off unless asked.
function coaster(design, r, vel, q, earthRot = false) {
  const v = buildVehicle(design); v.clamped = false; v.earthRot = earthRot; v.r = r; v.v = vel; v.q = q || V.qFromTo([0, 1, 0], V.norm(vel)); v.w = [0, 0, 0];
  v.throttle = 0; v.sas = 'off'; v.cmdTorque = [0, 0, 0]; v.clock = 0; return v;
}
const PROBE = { name: 'probe', parts: [{ id: 'probe' }, { id: 'tank-s' }, { id: 'spark', n: 1 }] };

console.log('1. Gravity and orbits (full-scale Earth)');
{
  ok(P.R_E === 6378137 && P.MU_E === 3.986004418e14, 'WGS84 radius and GM', `R ${P.R_E} m, μ ${P.MU_E}`);
  const g0 = P.gravityAt(0), g400 = P.gravityAt(400000);
  ok(g0 > 9.79 && g0 < 9.83, 'surface gravity ≈ 9.8 m/s²', g0.toFixed(4));
  ok(rel(g400 / g0, (R / (R + 400000)) ** 2) < 1e-12, 'inverse-square falloff', `g(400 km) ${g400.toFixed(3)} m/s²`);
  const a = R + 400000, vc = Math.sqrt(MU / a), Tan = 2 * Math.PI * Math.sqrt(a ** 3 / MU);
  const Tmean = 2 * Math.PI * Math.sqrt((6371000 + 400000) ** 3 / MU);
  ok(Math.abs(Tmean / 60 - 92.4) < 0.05 && Math.abs(Tan / 60 - 92.56) < 0.02, '400 km circular period: 92.4 min over the 6,371 km mean radius, 92.56 min over the WGS84 equator we fly from', `${(Tmean / 60).toFixed(2)} / ${(Tan / 60).toFixed(2)} min, v ${vc.toFixed(0)} m/s`);
  const el = P.orbitOf({ r: [a, 0, 0], v: [0, vc, 0] });
  ok(el.e < 1e-9 && Math.abs(el.ap - 400000) < 1e-3 && Math.abs(el.pe - 400000) < 1e-3, 'Kepler elements of a circular orbit', `e ${el.e.toExponential(1)}`);
  // 6-DOF RK4 integrator: 10 orbits at dt 0.5 s, period from the y = 0 crossings, energy drift
  const v = coaster(PROBE, [a, 0, 0], [0, vc, 0]), E0 = vc * vc / 2 - MU / a; let t = 0, prevY = 0, cross = [], Emax = 0;
  const t0 = Date.now();
  while (cross.length < 10) {
    const y0 = v.r[1]; P.stepVehicle(v, 0.5); t += 0.5;
    if (y0 < 0 && v.r[1] >= 0) cross.push(t - 0.5 + 0.5 * (-y0) / (v.r[1] - y0));
    const E = V.dot(v.v, v.v) / 2 - MU / V.len(v.r); Emax = Math.max(Emax, Math.abs((E - E0) / E0));
  }
  const Tsim = cross[cross.length - 1] / cross.length;
  ok(rel(Tsim, Tan) < 2e-5, 'RK4 orbital period at 400 km matches 2π√(a³/μ)', `${(Tsim / 60).toFixed(3)} min over 10 orbits (${Date.now() - t0} ms)`);
  const ra = V.len(v.r) - R; ok(Math.abs(ra - 400000) < 50 && Emax < 1e-5, 'thin 400 km air barely touches it over 10 orbits', `alt ${(ra / 1000).toFixed(3)} km, |ΔE/E| ${Emax.toExponential(1)}`);
  // energy and angular momentum in vacuum (1,200 km, above the model atmosphere): 30 orbits at dt 1 s
  { const a2 = R + 1200000, v2c = Math.sqrt(MU / a2) * 1.05, u = coaster(PROBE, [a2, 0, 0], [0, v2c * 0.995, v2c * 0.1]);
    const en = () => V.dot(u.v, u.v) / 2 - MU / V.len(u.r), hm = () => V.len(V.cross(u.r, u.v)), E1 = en(), H1 = hm(), T2 = P.orbitOf(u).T; let dE = 0, dH = 0;
    for (let t = 0; t < 30 * T2; t += 1) { P.stepVehicle(u, 1); dE = Math.max(dE, Math.abs(en() / E1 - 1)); dH = Math.max(dH, Math.abs(hm() / H1 - 1)); }
    ok(dE < 1e-9 && dH < 1e-9, 'energy and angular momentum conserved over 30 eccentric orbits (RK4)', `|ΔE/E| ${dE.toExponential(1)}, |ΔH/H| ${dH.toExponential(1)}`); }
  // fixed game step (0.02 s) for one orbit, compared with the exact Kepler rails solution
  const w = coaster(PROBE, [a, 0, 0], [0, vc * 1.01, 0]), kep = P.propagate([a, 0, 0], [0, vc * 1.01, 0], 3000);
  for (let i = 0; i < 3000 / PHYS_DT; i++) P.stepVehicle(w, PHYS_DT);
  ok(V.len(V.sub(w.r, kep.r)) < 5, 'RK4 at the game step agrees with Kepler rails after 50 min', `${V.len(V.sub(w.r, kep.r)).toFixed(3)} m apart`);
  const back = P.propagate(kep.r, kep.v, -3000);
  ok(V.len(V.sub(back.r, [a, 0, 0])) < 0.01, 'rails propagation is reversible', `${V.len(V.sub(back.r, [a, 0, 0])).toExponential(1)} m`);
  const r3 = P.propagate([a, 0, 0], [0, vc * Math.cos(0.5), vc * Math.sin(0.5)], Tan);
  ok(V.len(V.sub(r3.r, [a, 0, 0])) < 0.5, 'inclined orbit returns after one period (3D universal-variable propagation)');
}

console.log('2. U.S. Standard Atmosphere 1976');
{
  const A = P.atmosphere;
  ok(Math.abs(A(0).rho - 1.225) < 0.001 && Math.abs(A(0).p - 101325) < 1 && Math.abs(A(0).T - 288.15) < 0.01, 'sea level: ρ 1.225, p 101325, T 288.15', `ρ ${A(0).rho.toFixed(4)}`);
  ok(Math.abs(A(0).a - 340.3) < 0.2, 'speed of sound at sea level ≈ 340.3 m/s', A(0).a.toFixed(2));
  ok(Math.abs(A(11000).rho - 0.3639) < 0.002 && Math.abs(A(11000).T - 216.77) < 0.1, 'ρ(11 km) ≈ 0.364, T ≈ 216.8 K', `ρ ${A(11000).rho.toFixed(4)}, T ${A(11000).T.toFixed(2)}`);
  ok(rel(A(20000).rho, 0.08891) < 0.01 && rel(A(32000).rho, 0.013555) < 0.01 && rel(A(50000).rho, 1.027e-3) < 0.01, 'ρ at 20, 32, 50 km match the 1976 tables', [20000, 32000, 50000].map(z => A(z).rho.toExponential(3)).join(', '));
  ok(rel(A(86000).rho, 6.958e-6) < 0.02 && rel(A(85999).rho, A(86001).rho) < 0.02, 'continuous at 86 km (layers → thermosphere)', A(86000).rho.toExponential(3));
  ok(rel(A(100000).rho, 5.604e-7) < 0.01, 'Kármán line (100 km) density', A(100000).rho.toExponential(3));
  let mono = true, prev = Infinity; for (let z = 0; z < 1e6; z += 500) { const r = A(z).rho; if (!(r < prev)) mono = false; prev = r; }
  ok(mono && A(2e6).rho === 0, 'density falls monotonically to vacuum');
  ok(A(5000).layer === 'troposphere' && A(25000).layer === 'stratosphere' && A(60000).layer === 'mesosphere', 'layer names');
}

console.log('3. Drag and Mach');
{
  const c = P.cd0;
  ok(rel(c(0.3), 0.3) < 1e-9 && c(1.1) > 2 * c(0.5), 'transonic drag rise (Cd at M1.1 > 2× subsonic)', `Cd ${c(0.5).toFixed(2)} → ${c(1.1).toFixed(2)}`);
  ok(c(3) < c(1.2) && c(6) < c(3), 'supersonic falloff', `M3 ${c(3).toFixed(2)}, M6 ${c(6).toFixed(2)}`);
  let cont = true; for (let M = 0; M < 8; M += 0.001) if (Math.abs(c(M + 0.001) - c(M)) > 0.01) cont = false; ok(cont, 'Cd(M) is continuous');
  // whole-vehicle drag at zero AoA equals ½ρv²·Cd·A with the reported Cd
  const d = TEMPLATES[0], h = 8000, atm = P.atmosphere(h), Vs = 0.8 * atm.a, r = [R + h, 0, 0];
  const v = coaster(d, r, [0, Vs, 0]); P.stepVehicle(v, 0); const g = P.stackGeom(v);
  const ae = P.aeroAt(v, g, P.massProps(v), v.r, v.v, v.q, [0, 0, 0]);
  ok(rel(V.len(ae.F), 0.5 * atm.rho * Vs * Vs * v.tel.cd * g.A) < 1e-6, 'drag = ½ρv²·Cd·A', `${(V.len(ae.F) / 1000).toFixed(1)} kN at M0.8, Cd ${v.tel.cd.toFixed(3)}`);
  ok(rel(v.tel.mach, 0.8) < 1e-9 && rel(v.tel.q, 0.5 * atm.rho * Vs * Vs) < 1e-9, 'telemetry Mach and dynamic pressure');
  // a falling body reaches terminal velocity √(2mg/(ρ·Cd·A))
  const b = { r: [R + 50, 0, 0], v: [0, 0, 0], dir: [1, 0, 0], throttle: 0, earthRot: false, stages: [{ dry: 2, fuel: 0, eng: { tv: 0, ispSl: 1, ispVac: 1 } }], cdA: 10, n: 1 };
  for (let t = 0; t < 120; t += 0.01) { P.stepPoint(b, 0.01); b.r = [R + 50, 0, 0]; } // held at 50 m: velocity settles
  const a50 = P.atmosphere(50), vt = Math.sqrt(2 * 2000 * P.gravityAt(50) / (a50.rho * c(V.len(b.v) / a50.a) * 10));
  ok(rel(V.len(b.v), vt) < 0.002, 'terminal velocity √(2mg/(ρ·Cd·A))', `${V.len(b.v).toFixed(1)} vs ${vt.toFixed(1)} m/s`);
  ok(P.stagnationTemp(250, 0) === 250 && rel(P.stagnationTemp(250, 5), 1500) < 1e-12, 'stagnation temperature T(1 + 0.2M²)');
  ok(rel(P.heatFlux(1e-4, 7000, 1), 1.7415e-4 * 0.01 * 7000 ** 3) < 1e-12, 'Sutton–Graves stagnation heat flux');
}

console.log('4. Aerodynamic stability: CoP behind CoM weathervanes, CoP ahead tumbles');
{
  const stable = cloneDesign(TEMPLATES[0]), unstable = cloneDesign(TEMPLATES[0]); unstable.parts = unstable.parts.filter(p => p.id !== 'fins');
  const ab = aeroBalance(stable), ub = aeroBalance(unstable);
  ok(ab.margin > 1 && ub.margin < 0, 'fins move the CoP behind the CoM', `margin ${ab.margin.toFixed(2)} cal with fins, ${ub.margin.toFixed(2)} cal without`);
  const fly = d => { // coast at Mach 0.9, 9 km, nose 5° off the airflow, controls off
    const h = 9000, Vs = 0.9 * P.atmosphere(h).a, vel = [0, Vs, 0], nose = V.norm([Math.sin(5 * DEG), Math.cos(5 * DEG), 0]);
    const v = coaster(d, [R + h, 0, 0], vel, V.qFromTo([0, 1, 0], nose)); let maxA = 0, lastA = 0;
    for (let t = 0; t < 12; t += PHYS_DT) { P.stepVehicle(v, PHYS_DT); lastA = v.tel.aoa; maxA = Math.max(maxA, lastA); }
    return { maxA: maxA / DEG, lastA: lastA / DEG };
  };
  const s = fly(stable), u = fly(unstable);
  ok(s.maxA < 8 && s.lastA < 5, 'stable rocket weathervanes back toward the airflow (gravity bends the horizontal path a little)', `AoA 5° → max ${s.maxA.toFixed(1)}°, after 12 s ${s.lastA.toFixed(1)}°`);
  ok(u.maxA > 45, 'unstable rocket (no fins) flips', `AoA 5° → ${u.maxA.toFixed(0)}°`);
}

console.log('5. 6-DOF rigid body and controls');
{
  const a = R + 1200000, vc = Math.sqrt(MU / a); // above the air: no aero torque
  const v = coaster(PROBE, [a, 0, 0], [0, vc, 0], [1, 0, 0, 0]); v.w = [0.1, 0, 0];
  const n0 = P.noseOf(v); for (let i = 0; i < 500; i++) P.stepVehicle(v, PHYS_DT);
  const ang = Math.acos(V.dot(n0, P.noseOf(v)));
  ok(Math.abs(ang - 1.0) < 1e-6 && Math.abs(Math.hypot(...V.qnorm(v.q)) - 1) < 1e-12, 'torque-free spin: 0.1 rad/s for 10 s turns the nose 1 rad', ang.toFixed(8));
  const u = coaster(PROBE, [a, 0, 0], [0, vc, 0], [1, 0, 0, 0]); u.sas = 'off'; u.input = { pitch: 1, yaw: 0, roll: 0 };
  P.updateControl(u); const mp = P.massProps(u), want = u.auth[0] / mp.Ixx; P.stepVehicle(u, 0.5);
  ok(rel(u.w[0], want * 0.5) < 0.01 && u.auth[0] > 0, 'reaction-wheel pitch torque: ω = τ/I·t', `${u.w[0].toFixed(4)} rad/s (I ${mp.Ixx.toFixed(0)} kg·m²)`);
  // SAS prograde: point the nose along the orbital velocity
  const s = coaster(PROBE, [a, 0, 0], [0, vc, 0], V.qFromTo([0, 1, 0], [1, 0, 0])); s.sas = 'prograde';
  for (let t = 0; t < 60; t += PHYS_DT) { P.updateControl(s); P.stepVehicle(s, PHYS_DT); }
  const err = Math.acos(Math.min(1, V.dot(P.noseOf(s), V.norm(s.v)))) / DEG;
  ok(err < 1, 'SAS prograde turns a craft 90° onto prograde with its reaction wheels', `${err.toFixed(2)}° off after 60 s`);
  for (const mode of ['retrograde', 'radial', 'normal']) { s.sas = mode; for (let t = 0; t < 60; t += PHYS_DT) { P.updateControl(s); P.stepVehicle(s, PHYS_DT); } const e = Math.acos(Math.min(1, V.dot(P.noseOf(s), P.sasDir(s, mode)))) / DEG; ok(e < 2, `SAS ${mode}`, `${e.toFixed(2)}°`); }
  // RCS translation pushes along the body axis
  const rc = coaster({ name: 'r', parts: [{ id: 'crew' }, { id: 'rcs' }, { id: 'tank-s' }, { id: 'spark', n: 1 }] }, [a, 0, 0], [0, vc, 0], [1, 0, 0, 0]); rc.rcsOn = true; rc.trans = [0, 0, 1];
  const v0 = [...rc.v], m0 = rc.rcsFuel; for (let i = 0; i < 50; i++) { rc.cmdTorque = [0, 0, 0]; P.stepVehicle(rc, PHYS_DT); }
  const dv = V.sub(V.sub(rc.v, v0), V.scale(V.norm(rc.r), -P.gravityAt(1200000) * 1)), along = V.dot(dv, P.V.qrot(rc.q, [0, 0, 1]));
  ok(along > 0.1 && rc.rcsFuel < m0, 'RCS translation (+Z) accelerates along body +Z and uses monoprop', `${along.toFixed(3)} m/s in 1 s, used ${((m0 - rc.rcsFuel) * 1000).toFixed(2)} kg`);
}

console.log('6. Earth rotation, engines');
{
  const v = buildVehicle(TEMPLATES[0]); v.site = { ef: [1, 0, 0], lift: 0, q0: P.padAttitude([1, 0, 0]) }; v.earthRot = true;
  const s = P.siteAt(v, 0); ok(Math.abs(V.len(s.v) - 465.1) < 0.2, 'equatorial pad moves at ωR ≈ 465 m/s', `${V.len(s.v).toFixed(1)} m/s`);
  const s2 = P.siteAt(v, 3600); ok(Math.abs(Math.atan2(s2.r[1], s2.r[0]) - P.OMEGA_E * 3600) < 1e-9, 'pad turns with the Earth (sidereal rate)');
  ok(V.len(P.airVel({ ...v, r: s.r, v: s.v })) < 1e-9, 'air at rest relative to the rotating ground');
  v.throttle = 1; v.cur = 0; const e = v.stages[0].eng;
  const sl = P.engineOut(v, 101325), vac = P.engineOut(v, 0), mid = P.engineOut(v, 101325 / 2);
  ok(rel(sl.isp, e.ispSl) < 1e-12 && rel(vac.isp, e.ispVac) < 1e-12 && rel(mid.isp, (e.ispSl + e.ispVac) / 2) < 1e-12, 'Isp interpolates with ambient pressure', `${sl.isp} → ${vac.isp} s`);
  ok(rel(sl.T / vac.T, e.ispSl / e.ispVac) < 1e-12 && rel(sl.mdot, vac.mdot) < 1e-12, 'thrust scales with Isp at constant mass flow', `${(sl.T / 1e3).toFixed(0)} / ${(vac.T / 1e3).toFixed(0)} kN`);
}

console.log('7. Every template reaches a full-scale orbit on AUTO');
for (const earthRot of [true, false]) for (const t of TEMPLATES) {
  const t0 = Date.now(), r = simulateAuto(t, { earthRot });
  const minH = (() => { if (!r.orbit) return 0; const c = { ...r.F.v, stages: r.F.v.stages.map(s => ({ ...s })) }; return Math.min(...P.orbitPoints(c.r, c.v, 128).map(p => V.len(p) - R)); })();
  ok(r.orbit && r.pe > P.ORBIT_PE && minH > 120000 && r.dvUsed > 8500 && r.dvUsed < 12000, `${t.name}${earthRot ? '' : ' (no Earth rotation)'}`, `Ap ${(r.ap / 1000).toFixed(0)} / Pe ${(r.pe / 1000).toFixed(0)} km, Δv used ${(r.dvUsed / 1000).toFixed(2)} km/s, max ${r.F.maxG.toFixed(1)} g, Max-Q ${(r.F.maxQ / 1000).toFixed(1)} kPa (${Date.now() - t0} ms)`);
}
{ const r = simulateAuto(TEMPLATES[0]); ok(r.dvUsed > 9000 && r.dvUsed < 9800, 'Recommended uses ~9.3–9.5 km/s to orbit (with Earth rotation)', `${(r.dvUsed / 1000).toFixed(2)} km/s`); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
