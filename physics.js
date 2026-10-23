// Orbit Rush physics v2 — one import point for the game, the tests and the lessons.
// Full-scale Earth (WGS84 radius, real GM, optional rotation), U.S. Standard Atmosphere 1976, Mach-dependent
// aerodynamics with centre of pressure vs centre of mass, 6-DOF rigid-body dynamics (RK4), Kepler rails.
// Modules (physics/): constants, vec, atmosphere, aero, kepler, vehicle, dynamics, control, guidance, thermal.
export * from './physics/constants.js?v=f5.8a';
export * from './physics/atmosphere.js?v=f5.8a';
export * from './physics/aero.js?v=f5.8a';
export * from './physics/kepler.js?v=f5.8a';
export * from './physics/vehicle.js?v=f5.8a';
export * from './physics/dynamics.js?v=f5.8a';
export * from './physics/control.js?v=f5.8a';
export * from './physics/guidance.js?v=f5.8a';
export * from './physics/hoverslam.js?v=f5.8a';
export * from './physics/thermal.js?v=f5.8a';
export * as V from './physics/vec.js?v=f5.8a';
import { R_E, MU_E, KARMAN } from './physics/constants.js?v=f5.8a';
import { elements, timeToAp as tta } from './physics/kepler.js?v=f5.8a';
import { qrot, qFromTo, qmul, qAxisAngle, norm, cross, dot, sub, scale, qFromBasis } from './physics/vec.js?v=f5.8a';
import { eastOf as eastOf_ } from './physics/guidance.js?v=f5.8a';
// Local surface frame at Earth-fixed direction ef: right-handed (north = up × east), so a y-up model placed
// with this rotation stands along the local vertical with +Z east. Returns { north, up, east, q }.
export function surfaceFrame(ef) { const up = norm(ef), east = eastOf_(up), north = cross(up, east); return { north, up, east, q: qFromBasis(north, up, east) }; }
import { massProps } from './physics/vehicle.js?v=f5.8a';
import { muOf, radOf } from './physics/dynamics.js?v=f5.8a';
export * from './physics/solar.js?v=f5.8a';
export const R = R_E, MU = MU_E, ATM = KARMAN;
export const orbitOf = v => elements(v.r, v.v, muOf(v), radOf(v));
export const timeToApV = v => tta(v.r, v.v, muOf(v));
// Pad attitude: nose up, body +Z (heading) east, so W pitches the nose toward the east.
export function padAttitude(ef) {
  const up = norm(ef), east = norm(cross([0, 0, 1], up));
  const q1 = qFromTo([0, 1, 0], up), z1 = qrot(q1, [0, 0, 1]);
  const ang = Math.atan2(dot(cross(z1, east), up), dot(z1, east));
  return qmul(qAxisAngle(up, ang), q1);
}
// Spent stage → 3-DOF point mass (booster or debris). Its reference point r is the stage's bottom (engine
// exit), so "altitude" means the height of the engines/legs above the ground or deck.
export function makeBooster(v) {
  const s = v.stages[v.cur], nose = qrot(v.q, [0, 1, 0]), ycom = massProps(v).ycom;
  return { r: sub(v.r, scale(nose, ycom)), v: [...v.v], dir: nose, throttle: 0, clock: v.clock || 0, earthRot: v.earthRot,
    stages: [{ ...s, parts: s.parts }], cur: 0, cdA: Math.PI * 2.5 * 2.5 / 4 * 2.5 * Math.max(1, (v.specArea || 0) / 10.5), nMax: s.n, n: 1, phase: 'coast', state: 'flying', qk: 0 };
}
