// Two-body orbital mechanics in 3D: orbital elements from a state vector, apoapsis/periapsis, time to
// apoapsis, and exact universal-variable Kepler propagation (used "on rails" for high time warp).
import { MU_E, R_E } from './constants.js?v=f5.3b2';
import { dot, cross, len, scale, sub } from './vec.js?v=f5.3b2';
// Elements of the orbit of state (r, v) around a body with parameter mu (default Earth).
export function elements(r, v, mu = MU_E, Rb = R_E) {
  const rm = len(r), v2 = dot(v, v), E = v2 / 2 - mu / rm, h = cross(r, v), hm = len(h), rv = dot(r, v);
  const ev = scale(sub(scale(r, v2 - mu / rm), scale(v, rv)), 1 / mu), e = len(ev);
  const p = hm * hm / mu, a = -mu / (2 * E), rp = p / (1 + e), ra = E < 0 ? a * (1 + e) : Infinity;
  const T = E < 0 ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity, inc = Math.acos(Math.max(-1, Math.min(1, h[2] / (hm || 1))));
  return { e, ev, a, E, h, hm, p, rp, ra, T, inc, ap: ra - Rb, pe: rp - Rb, r: rm, vr: rv / rm };
}
// Time (s) until the next apoapsis; Infinity if not bound or circular.
export function timeToAp(r, v, mu = MU_E) {
  const o = elements(r, v, mu); if (!isFinite(o.a) || o.e < 1e-6) return Infinity;
  const cosNu = Math.max(-1, Math.min(1, dot(o.ev, r) / (o.e * o.r))); let nu = Math.acos(cosNu); if (o.vr < 0) nu = 2 * Math.PI - nu;
  const Ean = 2 * Math.atan(Math.sqrt((1 - o.e) / (1 + o.e)) * Math.tan(nu / 2)), M = Ean - o.e * Math.sin(Ean), n = Math.sqrt(mu / (o.a ** 3));
  const T = 2 * Math.PI / n, t = (Math.PI - M) / n; return ((t % T) + T) % T;
}
function stumpC(z) { if (z > 1e-6) { const s = Math.sqrt(z); return (1 - Math.cos(s)) / z; } if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.cosh(s) - 1) / -z; } return 0.5 - z / 24 + z * z / 720; }
function stumpS(z) { if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); } if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); } return 1 / 6 - z / 120 + z * z / 5040; }
// Exact two-body propagation by dt (elliptic, parabolic, hyperbolic). Returns { r, v }.
export function propagate(r0v, v0v, dt, mu = MU_E) {
  if (!dt) return { r: [...r0v], v: [...v0v] };
  const r0 = len(r0v), v02 = dot(v0v, v0v), rv = dot(r0v, v0v), vr0 = rv / r0, alpha = 2 / r0 - v02 / mu, sm = Math.sqrt(mu);
  if (alpha > 1e-12) { const T = 2 * Math.PI / Math.sqrt(mu * alpha ** 3); if (Math.abs(dt) > T) dt %= T; if (!dt) return { r: [...r0v], v: [...v0v] }; }
  let chi;
  if (alpha > 1e-12) chi = sm * dt * alpha;
  else if (alpha < -1e-12) { const a = 1 / alpha, sg = Math.sign(dt); chi = sg * Math.sqrt(-a) * Math.log((-2 * mu * alpha * dt) / (rv + sg * Math.sqrt(-mu * a) * (1 - r0 * alpha))); if (!isFinite(chi)) chi = sm * dt / r0; }
  else chi = sm * dt / r0;
  for (let i = 0; i < 80; i++) {
    const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
    const F = r0 * vr0 / sm * chi * chi * C + (1 - alpha * r0) * chi ** 3 * S + r0 * chi - sm * dt;
    const dF = r0 * vr0 / sm * chi * (1 - z * S) + (1 - alpha * r0) * chi * chi * C + r0;
    let d = F / dF; if (!isFinite(d)) break;
    if (Math.abs(d) > Math.abs(chi) + 1e3) d = Math.sign(d) * (Math.abs(chi) + 1e3) * 0.5;
    chi -= d; if (Math.abs(d) < 1e-10 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
  const f = 1 - chi * chi / r0 * C, g = dt - chi ** 3 * S / sm;
  const r = [f * r0v[0] + g * v0v[0], f * r0v[1] + g * v0v[1], f * r0v[2] + g * v0v[2]], rm = len(r);
  const fd = sm / (rm * r0) * (z * chi * S - chi), gd = 1 - chi * chi / rm * C;
  return { r, v: [fd * r0v[0] + gd * v0v[0], fd * r0v[1] + gd * v0v[1], fd * r0v[2] + gd * v0v[2]] };
}
// Sample the orbit as world points (for the map line): n points over one period, or a hyperbolic arc.
export function orbitPoints(r, v, n = 256, mu = MU_E, maxR = R_E * 12) {
  const o = elements(r, v, mu), out = [];
  const span = isFinite(o.T) ? o.T : 4 * 3600;
  for (let i = 0; i <= n; i++) { const s = propagate(r, v, span * i / n - (isFinite(o.T) ? 0 : span / 2), mu); if (len(s.r) < maxR) out.push(s.r); }
  return out;
}
