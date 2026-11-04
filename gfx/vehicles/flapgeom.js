// legs-fins-1: ship flap geometry (pure, node-testable). Forward flaps: small, tapered, swept, high on the nose. Aft flaps: large, squared off.
// Each flap's root hinge line is laid ON the hull surface (the nose ogive included), so a flap pivoting about it stays flush from 0 to 90 deg.
// FLAP_ROOT: hinge (root) span per kind. Shapes are [x out from the hinge, y along the hinge] in metres; the root edge is x = 0 (on the hinge line).
export const FLAP_SHAPE = {
  f: [[0, 0], [2.6, 0.4], [3.3, 2.0], [2.2, 4.4], [1.2, 5.2], [0.5, 3.9], [0, 3.0]],                   // tapered, swept forward past a short root (the nose curves too fast for a long straight hinge)
  a: [[0, 0], [5.0, 0], [5.25, 0.25], [5.25, 11.5], [5.0, 11.8], [0, 11.8]],                   // squared off: full span to the tip
};
export const FLAP_ROOT = { f: 3.0, a: 11.8 };
/** ship hull radius at height y: cylinder r up to yN (nose base), then a tangent ogive of length L (same formula as profiles.ogive) */
export function shipHullR(y, { r, yN, L }) {
  if (y <= yN) return r; const yy = Math.min(y - yN, L), rho = (r * r + L * L) / (2 * r); return Math.max(0, Math.sqrt(Math.max(0, rho * rho - yy * yy)) + r - rho);
}
/** hinge placement for a flap whose root spans y0..y0+h: start point radius and the tilt (rad, toward the axis) that keep the hinge line
 *  on the hull: the chord between the hull points at both ends, pushed out by half the sagitta so the worst gap is split either side. */
export function flapHinge(y0, h, ship) {
  const r0 = shipHullR(y0, ship), r1 = shipHullR(y0 + h, ship), len = Math.hypot(h, r1 - r0), tilt = Math.asin((r0 - r1) / len);
  let sag = 0; for (let i = 1; i < 20; i++) { const u = i / 20, y = y0 + u * h; sag = Math.max(sag, shipHullR(y, ship) - (r0 + (r1 - r0) * u)); }
  return { rad: r0 + sag / 2, tilt, len, r0, r1 };
}
/** points along a hinge line in the ship frame (side +1 at +x; -1 mirrored), for tests */
export function hingeLine(y0, h, ship, side = 1, n = 20) {
  const H = flapHinge(y0, h, ship), out = []; for (let i = 0; i <= n; i++) { const s = (i / n) * H.len; out.push([side * (H.rad - Math.sin(H.tilt) * s), y0 + Math.cos(H.tilt) * s, 0]); } return out;
}
