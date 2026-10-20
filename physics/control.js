// Attitude control: SAS modes and a rate-limited "point at a direction" controller shared by SAS, AUTO
// and the tests. Output is a body-frame torque command (N·m) that dynamics.js splits between reaction
// wheels, engine gimbal and RCS. Body axes: +Y nose, +Z heading/"belly" (east on the pad), +X = Y x Z.
// Pitch = about X (W tips the nose toward +Z), roll = about Y, yaw = about Z.
import { R_E } from './constants.js?v=f5.1a';
import { sub, scale, dot, cross, len, norm, qrot, qinv, clamp } from './vec.js?v=f5.1a';
import { authority, airVel, engineOut, radOf, atmAt } from './dynamics.js?v=f5.1a';
import { stackGeom, massProps } from './vehicle.js?v=f5.1a';
import { atmosphere } from './atmosphere.js?v=f5.1a';
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
export function steerTorque(v, dir, ctx) {
  const { mp, auth } = ctx, I = [mp.Ixx, mp.Iyy, mp.Ixx];
  const b = qrot(v.q, [0, 1, 0]), ax = cross(b, dir), s = len(ax), ang = Math.atan2(s, dot(b, dir));
  const e = s > 1e-9 ? qinv(v.q, scale(ax, ang / s)) : (dot(b, dir) < 0 ? [Math.PI, 0, 0] : [0, 0, 0]);
  const wMax = v.wMax || 0.5, out = [0, 0, 0];
  for (const k of [0, 2]) {
    const amax = auth[k] / I[k], ek = e[k], wdes = Math.sign(ek) * Math.min(wMax, Math.sqrt(2 * 0.5 * amax * Math.abs(ek)), 2.5 * Math.abs(ek));
    out[k] = clamp(I[k] * (wdes - v.w[k]) * 4, -auth[k], auth[k]);
  }
  out[1] = clamp(I[1] * (0 - v.w[1]) * 4, -auth[1], auth[1]);
  return out;
}
// Combine pilot input (v.input: pitch/yaw/roll in -1..1), AUTO steering (v.steerDir) and SAS into v.cmdTorque.
export function updateControl(v) {
  const g = stackGeom(v), mp = massProps(v, g), T = engineOut(v, atmAt(v, len(v.r) - radOf(v)).p).T, auth = authority(v, g, mp, T), ctx = { g, mp, auth };
  const inp = v.input || { pitch: 0, yaw: 0, roll: 0 }, manual = [inp.pitch, inp.roll, inp.yaw];
  let tau = [0, 0, 0];
  const target = v.steerDir || (v.sas && v.sas !== 'off' ? sasDir(v, v.sas) : null);
  if (target) tau = steerTorque(v, target, ctx);
  else if (v.sas === 'off') tau = [0, 0, 0];
  for (let k = 0; k < 3; k++) if (manual[k]) tau[k] = manual[k] * auth[k];
  if (manual.some(Boolean)) v.sasHold = null; else if (v.sas === 'stab' && !v.sasHold) v.sasHold = qrot(v.q, [0, 1, 0]);
  v.cmdTorque = tau; v.auth = auth;
  return tau;
}
