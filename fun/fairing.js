// fx-1: fairing halves at jettison. Pure kinematics (tested in tests/fx_fix.mjs) + a three.js builder.
export const HALF_LIFE = 30; // s, then the halves are removed
// side = +1 / -1. lat: metres sideways from the rocket axis; ang: outward hinge angle (rad); back: metres behind
// the jettison point in the rocket frame (the rocket keeps accelerating, the shells don't, so they fall away).
export function halfPose(t, side) {
  if (t <= 0) return { lat: 0, ang: 0, back: 0, gone: false };
  const lat = side * (2.2 * t + 0.6 * Math.min(t, 2) ** 2), ang = side * Math.min(2.6, 0.7 * t + 0.25 * t * t);
  return { lat, ang, back: 0, gone: t > HALF_LIFE };
}
// Two half shells (half cylinder + half nose cone), open side facing each other. dims in metres:
// { r, body, cone }. Each half's origin is at its base centre so it pivots outward from the base ring.
export function buildHalves(THREE, dims, mat) {
  const { r, body, cone } = dims, out = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group(), t0 = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, body, 24, 1, true, t0, Math.PI), mat); cyl.position.y = body / 2; g.add(cyl);
    if (cone > 0) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r, cone, 24, 1, true, t0, Math.PI), mat); c.position.y = body + cone / 2; g.add(c); }
    g.userData.side = side; out.push(g);
  }
  return out;
}
