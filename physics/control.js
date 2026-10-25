// Attitude control: SAS modes and a rate-limited "point at a direction" controller shared by SAS, AUTO
// and the tests. Output is a body-frame torque command (N·m) that dynamics.js splits between reaction
// wheels, engine gimbal and RCS. Body axes: +Y nose, +Z heading/"belly" (east on the pad), +X = Y x Z.
// Pitch = about X (W tips the nose toward +Z), roll = about Y, yaw = about Z.
import { R_E } from './constants.js?v=f5.9-3';
import { sub, scale, dot, cross, len, norm, qrot, qinv, clamp } from './vec.js?v=f5.9-3';
import { authority, airVel, engineOut, radOf, atmAt } from './dynamics.js?v=f5.9-3';
import { stackGeom, massProps } from './vehicle.js?v=f5.9-3';
import { atmosphere } from './atmosphere.js?v=f5.9-3';
export const SAS_MODES = ['off', 'stab', 'prograde', 'retrograde', 'radial', 'antiradial', 'normal', 'antinormal', 'node'];
export const SAS_LABEL = { off: 'OFF', stab: 'STABILITY', prograde: 'PROGRADE', retrograde: 'RETROGRADE', radial: 'RADIAL OUT', antiradial: 'RADIAL IN', normal: 'NORMAL', antinormal: 'ANTI-NORMAL', node: 'MANEUVER', target: 'TARGET', antitarget: 'ANTI-TARGET' };
// Prograde reference: air-relative below 40 km (what the airflow sees), inertial (orbital) above.
export function progradeOf(v) { const h = len(v.r) - radOf(v), vel = h < 40000 ? airVel(v) : v.v; return len(vel) > 1 ? norm(vel) : norm(v.r); }
export function sasDir(v, mode) {
  const pg = progradeOf(v), up = norm(v.r), nrm = norm(cross(v.r, v.v));
  const rad = norm(sub(up, scale(pg, dot(up, pg))));
  switch (mode) {
    case 'prograde': return pg; case 'retrograde': return scale(pg, -1);
    case 'radial': return rad; case 'antiradial': return scale(rad, -1);
    case 'normal': return nrm; case 'antinormal': return scale(nrm, -1);
    case 'stab': return v.sasHold || qrot(v.q, [0, 1, 0]);
    case 'node': return v.nodeDir || v.sasHold || qrot(v.q, [0, 1, 0]);
    case 'target': return v.targetDir || v.sasHold || qrot(v.q, [0, 1, 0]);
    case 'antitarget': return v.targetDir ? scale(v.targetDir, -1) : v.sasHold || qrot(v.q, [0, 1, 0]);
  }
  return null;
}
// Torque that turns the nose toward world direction `dir` (rate-limited, braking with ~50% authority) and
// damps roll. Returns [tx, ty, tz] in body N·m.
export const CARRY = 0.14; // rad (8°): the most the nose may coast after the pilot takes over an AUTO turn in progress
export function steerTorque(v, dir, ctx) {
  const { mp, auth } = ctx, I = [mp.Ixx, mp.Iyy, mp.Ixx];
  const b = qrot(v.q, [0, 1, 0]), ax = cross(b, dir), s = len(ax), ang = Math.atan2(s, dot(b, dir));
  const e = s > 1e-9 ? qinv(v.q, scale(ax, ang / s)) : (dot(b, dir) < 0 ? [Math.PI, 0, 0] : [0, 0, 0]);
  const wMax = v.wMax || 0.5, out = [0, 0, 0];
  for (const k of [0, 2]) {
    const amax = auth[k] / I[k], ek = e[k], aw = ctx.g.rw * 1000 / I[k], cap = ctx.auto ? Math.max(0.05, Math.sqrt(2 * aw * CARRY)) : Infinity, wdes = Math.sign(ek) * Math.min(wMax, Math.sqrt(2 * 0.5 * amax * Math.abs(ek)), cap, 2.5 * Math.abs(ek)); /* f5.8y (QA f5.8w P2): AUTO never spins the nose faster than the reaction wheels ALONE could stop in CARRY rad. The gimbal's authority is proportional to thrust, so when the pilot takes over and drops the throttle the swing used to coast e/2 (17-30°) at the upper stage's ~0.08 rad/s²; now it coasts <= ~8° */
    out[k] = clamp(I[k] * (wdes - v.w[k]) * 4, -auth[k], auth[k]);
  }
  out[1] = clamp(I[1] * (0 - v.w[1]) * 4, -auth[1], auth[1]);
  return out;
}
// Combine pilot input (v.input: pitch/yaw/roll in -1..1), AUTO steering (v.steerDir) and SAS into v.cmdTorque.
export const SETTLE_W = 0.02; // rad/s: below this STABILITY freezes the nose it is pointing at
export function updateControl(v) {
  const g = stackGeom(v), mp = massProps(v, g), T = engineOut(v, atmAt(v, len(v.r) - radOf(v)).p).T, auth = authority(v, g, mp, T), ctx = { g, mp, auth };
  const inp = v.input || { pitch: 0, yaw: 0, roll: 0 }, manual = [inp.pitch, inp.roll, inp.yaw];
  let tau = [0, 0, 0];
  const target = v.steerDir || (v.sas && v.sas !== 'off' ? sasDir(v, v.sas) : null);
  // f5.8t (QA f5.8r P1): STABILITY taken over while the nose is still swinging (AUTO's upper-stage pitch-over at ~60 km spins ~0.3 rad/s) used to freeze the CURRENT nose as the target and
  // then overshoot it by w²/2a (+46° → −48°). Now it first kills the rotation and holds the attitude it stops at, so a later throttle drag never chases a stale target.
  const settling = !v.steerDir && v.sas === 'stab' && !v.holdAtt && !v.sasHold && v.w && Math.hypot(v.w[0], v.w[1], v.w[2]) > SETTLE_W;
  const hold = !v.steerDir && v.sas === 'stab' && v.holdAtt ? v.holdAtt : null; // f5.6h: trackball navball target attitude (nose + roll)
  if (hold) { tau = steerTorque(v, hold.n, ctx); const I1 = mp.Iyy, a1 = auth[1] / I1, nose = qrot(v.q, [0, 1, 0]), e1 = rollError(nose, qrot(v.q, [0, 0, -1]), hold.t);
    const wd = Math.sign(e1) * Math.min(v.wMax || 0.5, Math.sqrt(2 * 0.5 * a1 * Math.abs(e1)), 2.5 * Math.abs(e1)); tau[1] = clamp(I1 * (wd - v.w[1]) * 4, -auth[1], auth[1]); }
  else if (settling) { const I = [mp.Ixx, mp.Iyy, mp.Ixx]; tau = [0, 1, 2].map(k => clamp(I[k] * (0 - v.w[k]) * 4, -auth[k], auth[k])); }
  else if (target) tau = steerTorque(v, target, v.steerDir && v.cur > 0 && v.cur === v.stages.length - 1 && len(v.r) - radOf(v) > 45000 ? { ...ctx, auto: true } : ctx);
  else if (v.sas === 'off') tau = [0, 0, 0];
  for (let k = 0; k < 3; k++) if (manual[k]) tau[k] = manual[k] * auth[k];
  if (manual.some(Boolean) && v.w) { const I = [mp.Ixx, mp.Iyy, mp.Ixx]; // f5.6g (QA): axes you are not commanding hold still (D yawed AND rolled −78°)
    for (let k = 0; k < 3; k++) if (!manual[k]) tau[k] = Math.max(-auth[k], Math.min(auth[k], I[k] * (0 - v.w[k]) * 4)); }
  if (manual.some(Boolean)) { v.sasHold = null; v.holdAtt = null; } else if (v.steerDir) { v.sasHold = null; /* f5.8o (QA f5.8n P1): AUTO flying = no stale hold; on takeover STABILITY captures the CURRENT nose, so adding throttle never swings the rocket back to the launch attitude */ } else if (v.sas === 'stab' && !v.sasHold && !settling) v.sasHold = qrot(v.q, [0, 1, 0]);
  v.cmdTorque = tau; v.auth = auth;
  return tau;
}
// f5.6h: signed roll angle (rad, right-hand about the nose) from the current ship top to the target top
export function rollError(nose, top, tgtTop) { const k = dot(tgtTop, nose), tp = norm(sub(tgtTop, scale(nose, k))); return Math.atan2(dot(cross(top, tp), nose), dot(top, tp)); }
