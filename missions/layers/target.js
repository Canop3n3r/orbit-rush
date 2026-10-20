// Pure target-object layer: a passive spacecraft (station, depot, tanker) on a Kepler orbit around Earth,
// plus the rendezvous planner (phasing via a Lambert search, then closing approaches) and relative-state
// gates. No DOM, no flight.js edits: it only reads Flight state and hands flight.js ordinary nodes.
import * as P from '../../physics.js?v=f2';
import * as C from '../../physics/patched.js?v=f2';
const V = P.V;
// Target placed in the ship's orbital plane, `leadDeg` ahead, on a circular orbit at `altM`.
export function makeTarget(F, { altM, leadDeg = 40, id = 'station' }) {
  const v = F.v, h = V.norm(V.cross(v.r, v.v)), u = V.norm(v.r), r = P.R + altM, a = leadDeg * Math.PI / 180;
  const w = V.norm(V.cross(h, u)), dir = V.add(V.scale(u, Math.cos(a)), V.scale(w, Math.sin(a)));
  const vt = V.scale(V.norm(V.cross(h, dir)), Math.sqrt(P.MU / r));
  return { id, t0: F.tAbs, r0: V.scale(dir, r), v0: vt, altM };
}
export const targetAt = (T, t) => P.propagate(T.r0, T.v0, t - T.t0, P.MU);
export function relState(F, T) {
  const s = targetAt(T, F.tAbs), dr = V.sub(F.v.r, s.r), dv = V.sub(F.v.v, s.v), range = V.len(dr);
  return { range, relV: V.len(dv), closing: range > 0 ? -V.dot(dr, dv) / range : 0, s };
}
// Node from an inertial Δv vector applied at time t (state propagated on the current orbit).
export function nodeFromVector(F, t, dv) {
  const s = P.propagate(F.v.r, F.v.v, t - F.tAbs, P.MU), f = C.nodeFrame(s.r, s.v);
  return { t, pro: V.dot(dv, f.pro), nrm: V.dot(dv, f.nrm), rad: V.dot(dv, f.rad) };
}
// Intercept: Lambert search over departure delay and flight time; returns { n1, tArr, dv1, dv2 }.
export function planIntercept(F, T, { dMin = 240, dMax, tfMin, tfMax, steps = 40 } = {}) {
  const per = 2 * Math.PI * Math.sqrt(Math.pow(V.len(F.v.r), 3) / P.MU); dMax ??= per * 1.5; tfMin ??= per * 0.3; tfMax ??= per * 0.6;
  let best = null;
  for (let i = 0; i <= steps; i++) for (let j = 0; j <= 12; j++) {
    const td = F.tAbs + dMin + (dMax - dMin) * i / steps, tf = tfMin + (tfMax - tfMin) * j / 12;
    const s = P.propagate(F.v.r, F.v.v, td - F.tAbs, P.MU), e = targetAt(T, td + tf), L = C.lambert(s.r, e.r, tf, P.MU); if (!L) continue;
    const dv1 = V.len(V.sub(L.v1, s.v)), dv2 = V.len(V.sub(e.v, L.v2)), c = dv1 + dv2;
    if (!isFinite(c)) continue; if (!best || c < best.c) best = { c, td, tf, dvv: V.sub(L.v1, s.v), dv1, dv2 };
  }
  if (!best) return null;
  return { n1: nodeFromVector(F, best.td, best.dvv), tArr: best.td + best.tf, dv1: best.dv1, dv2: best.dv2 };
}
// Velocity-match node at time t (kill relative velocity at the arrival point).
export function matchNode(F, T, t) { const s = P.propagate(F.v.r, F.v.v, t - F.tAbs, P.MU), e = targetAt(T, t); return nodeFromVector(F, t, V.sub(e.v, s.v)); }
