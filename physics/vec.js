// Small 3-vector and quaternion helpers on plain arrays. Vectors [x, y, z]; quaternions [w, x, y, z]
// (unit quaternion q rotates body-frame vectors into the inertial frame: v_world = q * v_body * q^-1).
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const addS = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const qmul = (a, b) => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0]];
export const qconj = q => [q[0], -q[1], -q[2], -q[3]];
export const qnorm = q => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
export function qrot(q, v) { // rotate body vector v into world
  const [w, x, y, z] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
}
export const qinv = (q, v) => qrot(qconj(q), v); // world vector into body
export function qAxisAngle(axis, ang) { const a = norm(axis), s = Math.sin(ang / 2); return [Math.cos(ang / 2), a[0] * s, a[1] * s, a[2] * s]; }
// Shortest rotation taking unit vector a onto unit vector b.
export function qFromTo(a, b) {
  const d = dot(a, b);
  if (d < -0.999999) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); return qAxisAngle(ax, Math.PI); }
  const c = cross(a, b); return qnorm([1 + d, c[0], c[1], c[2]]);
}
// Rotation about the z axis (Earth's spin axis) by angle a.
export const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Quaternion of the rotation whose columns are the body axes bx, by, bz expressed in world coordinates.
// The axes must be a right-handed orthonormal set (bx × by = bz); a left-handed set is a reflection and has
// no rotation quaternion (that mistake once laid the launch pad on its side).
export function qFromBasis(bx, by, bz) {
  const m00 = bx[0], m10 = bx[1], m20 = bx[2], m01 = by[0], m11 = by[1], m21 = by[2], m02 = bz[0], m12 = bz[1], m22 = bz[2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); q = [0.25 / s, (m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s]; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [(m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s]; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s]; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s]; }
  return qnorm(q);
}
