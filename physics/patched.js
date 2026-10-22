// Patched conics across the solar system: event times on a conic (SOI exit, SOI entry into a moon/planet,
// reaching an altitude), trajectory prediction through several SOI patches and maneuver nodes, closest
// approach to a target, node frames and burn times, and a transfer planner (Hohmann window + phase angle,
// ejection geometry for interplanetary transfers, then a numerical refinement against the predictor).
import { elements, propagate } from './kepler.js?v=f5.7e';
import { BODIES, relState, transfer, atmTop } from './solar.js?v=f5.7e';
import { RAILS_ALT, G0 } from './constants.js?v=f5.7e';
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nz = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const TAU = 2 * Math.PI;
export const muB = id => BODIES[id].mu, RB = id => BODIES[id].R;
// Lowest altitude at which a coasting craft may stay on rails around a body (top of the air, or 4 km above
// an airless surface so the landing is flown in real physics).
export const railsAltOf = id => (id === 'earth' ? RAILS_ALT : BODIES[id].atm ? atmTop(id) : 4000);
// ---------- time to reach radius rho on the conic (dir +1 outward, -1 inward); Infinity if never ----------
function anomalyNow(o, r) { // true anomaly of the current position
  if (o.e < 1e-9) return 0;
  let nu = Math.acos(Math.max(-1, Math.min(1, dot(o.ev, r) / (o.e * len(r))))); if (o.vr < 0) nu = TAU - nu; return nu;
}
function meanFromTrue(nu, e) {
  if (e < 1) { const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)); return E - e * Math.sin(E); }
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)); return e * Math.sinh(H) - H;
}
export function timeToRadius(r, v, mu, rho, dir) {
  const o = elements(r, v, mu), rm = len(r);
  if (o.e < 1e-7) return Infinity;
  if (dir > 0 && rm >= rho) return o.vr > 0 ? 0 : (o.e < 1 ? timeToRadiusEll(o, r, mu, rho, dir) : Infinity);
  if (dir < 0 && rm <= rho) return o.vr < 0 ? 0 : (o.e < 1 ? timeToRadiusEll(o, r, mu, rho, dir) : Infinity);
  const c = (o.p / rho - 1) / o.e; if (c < -1 || c > 1) return Infinity;
  return o.e < 1 ? timeToRadiusEll(o, r, mu, rho, dir) : timeToRadiusHyp(o, r, mu, rho, dir);
}
function timeToRadiusEll(o, r, mu, rho, dir) {
  const c = (o.p / rho - 1) / o.e; if (c < -1 || c > 1) return Infinity;
  const nuT = dir > 0 ? Math.acos(c) : TAU - Math.acos(c), nu0 = anomalyNow(o, r), n = Math.sqrt(mu / Math.abs(o.a) ** 3);
  let dM = meanFromTrue(nuT, o.e) - meanFromTrue(nu0, o.e); dM = ((dM % TAU) + TAU) % TAU; return dM / n;
}
function timeToRadiusHyp(o, r, mu, rho, dir) {
  const c = (o.p / rho - 1) / o.e; if (c < -1 || c > 1) return Infinity;
  let nu0 = anomalyNow(o, r); if (nu0 > Math.PI) nu0 -= TAU;
  const nuT = dir > 0 ? Math.acos(c) : -Math.acos(c), n = Math.sqrt(mu / Math.abs(o.a) ** 3);
  const dt = (meanFromTrue(nuT, o.e) - meanFromTrue(nu0, o.e)) / n; return dt >= 0 ? dt : Infinity;
}
// ---------- first entry into a child's SOI within `horizon` seconds (marching with a speed bound) ----------
export function childEntry(id, r, v, t, horizon, only) {
  const mu = muB(id), o = elements(r, v, mu), vmaxC = o.e < 1 ? Math.sqrt(mu * (1 + o.e) / Math.max(o.rp, 1)) : Math.sqrt(dot(v, v) + 2 * mu / Math.max(o.rp, 1));
  let best = null;
  for (const c of BODIES[id].children) {
    if (only && !only.includes(c)) continue;
    const cb = BODIES[c], vc = Math.sqrt(mu / cb.a) * 1.1, vmax = vmaxC + vc;
    // quick reject: craft's radial range never reaches the child's orbit band
    if (o.e < 1 && (o.ra < cb.a * 0.9 - cb.soi || o.rp > cb.a * 1.1 + cb.soi)) continue;
    let armed = true, tau = 0, prev = 0, d0 = Infinity, lim = best ? best.dt : horizon;
    for (let k = 0; k < 4000 && tau <= lim; k++) {
      const s = propagate(r, v, tau, mu), cs = relState(c, t + tau), d = len(sub(s.r, cs.r)) - cb.soi;
      if (k === 0 && d <= cb.soi * 1e-3) { armed = false; } // starting on/inside the boundary (just exited): wait until clear
      else if (!armed && d > cb.soi * 1e-3) armed = true;
      if (d <= 0 && armed) { // bisect (prev, tau]
        let lo = prev, hi = tau; for (let j = 0; j < 40; j++) { const m = (lo + hi) / 2, s2 = propagate(r, v, m, mu), c2 = relState(c, t + m); if (len(sub(s2.r, c2.r)) < cb.soi) hi = m; else lo = m; }
        if (!best || hi < best.dt) best = { dt: hi, type: 'soi-enter', to: c }; break;
      }
      prev = tau; d0 = d; tau += Math.max(Math.abs(d) / vmax, armed ? 1 : 60, horizon * 1e-6);
    }
    void d0;
  }
  return best;
}
// ---------- the next event on the current conic ----------
// opts: { stopAlt (m above surface, default rails altitude), nodes: [{t}], lead: seconds before a node }
export function nextEvent(id, r, v, t, horizon, opts = {}) {
  const mu = muB(id), b = BODIES[id], ev = [];
  if (b.parent) { const d = timeToRadius(r, v, mu, b.soi, +1); if (d < Infinity) ev.push({ dt: d, type: 'soi-exit', to: b.parent }); }
  const stop = b.R + (opts.stopAlt ?? railsAltOf(id)), dn = len(r) > stop ? timeToRadius(r, v, mu, stop, -1) : Infinity;
  if (dn < Infinity) ev.push({ dt: dn, type: b.atm ? 'atmosphere' : 'surface', to: id });
  for (const n of opts.nodes || []) { const d = n.t - (opts.lead || 0) - t; if (d >= 0) ev.push({ dt: d, type: 'node', node: n }); }
  ev.sort((a, c) => a.dt - c.dt);
  const lim = Math.min(horizon, ev.length ? ev[0].dt : horizon), ce = childEntry(id, r, v, t, lim, opts.only);
  if (ce && ce.dt <= lim) ev.unshift(ce);
  ev.sort((a, c) => a.dt - c.dt);
  return ev.length && ev[0].dt <= horizon ? ev[0] : null;
}
// ---------- node frame: prograde, normal (orbit normal), radial-out ----------
export function nodeFrame(r, v) { const pro = nz(v), nrm = nz(cross(r, v)), rad = cross(pro, nrm); return { pro, nrm, rad }; } // rad = radial out (pro × nrm)
export const nodeVector = (r, v, n) => { const f = nodeFrame(r, v); return add(add(sc(f.pro, n.pro || 0), sc(f.nrm, n.nrm || 0)), sc(f.rad, n.rad || 0)); };
export const nodeDv = n => Math.hypot(n.pro || 0, n.nrm || 0, n.rad || 0);
// burn time (s) for dv with thrust T (N), mass m0 (kg), Isp (s)
export function burnTime(dv, T, m0, isp) { if (!(T > 0)) return Infinity; const ve = isp * G0; return m0 * ve / T * (1 - Math.exp(-dv / ve)); }
// ---------- prediction across patches ----------
// Returns { patches: [{ body, t0, t1, r0, v0, pts: [[x,y,z] in body frame], end: { type, to } }], end }.
export function predict(id, r, v, t, opts = {}) {
  const patches = [], nodes = [...(opts.nodes || [])].sort((a, b) => a.t - b.t), maxP = opts.maxPatches || 5, nPts = opts.samples || 160;
  let body = id, R = [...r], Vv = [...v], T = t, used = new Set();
  for (let p = 0; p < maxP; p++) {
    const mu = muB(body), o = elements(R, Vv, mu), b = BODIES[body];
    const span = o.e < 1 ? Math.min(o.T, opts.maxSpan || 3e9) : Math.min(b.parent ? (timeToRadius(R, Vv, mu, b.soi, +1) || 1e9) : 3e9, 3e9);
    const pending = nodes.filter(n => !used.has(n) && n.t >= T - 1e-6);
    const horizon = Math.max(span, pending.length ? pending[0].t - T + 1 : 0, 1); // keep coasting to a node beyond one orbit
    const ev = nextEvent(body, R, Vv, T, horizon, { nodes: pending, stopAlt: opts.stopAlt ?? 0, only: opts.only });
    const t1 = ev ? ev.dt : span, pts = [], tDraw = o.e < 1 ? Math.min(t1, o.T) : t1;
    for (let i = 0; i <= nPts; i++) pts.push(propagate(R, Vv, tDraw * i / nPts, mu).r);
    const patch = { body, t0: T, t1: T + t1, r0: R, v0: Vv, pts, o, end: ev ? { type: ev.type, to: ev.to, node: ev.node } : { type: 'loop' } };
    patches.push(patch);
    if (!ev || ev.type === 'surface' || ev.type === 'atmosphere') break;
    const s = propagate(R, Vv, t1, mu); T += t1;
    if (ev.type === 'node') { used.add(ev.node); R = s.r; Vv = add(s.v, nodeVector(s.r, s.v, ev.node)); patch.nodeAt = s.r; continue; }
    const tr = transfer(body, ev.to, s.r, s.v, T); body = ev.to; R = tr.r; Vv = tr.v; patch.exitAt = s.r;
  }
  return { patches, end: patches[patches.length - 1].end };
}
// Closest approach to body `target` along predicted patches (patches around its parent, or inside its SOI).
export function closestApproach(pred, target, tMax = Infinity) {
  let best = { d: Infinity, t: null, relV: 0, inside: false };
  for (const pa of pred.patches) {
    if (pa.t0 > tMax) break;
    if (pa.body === target) { const pe = pa.o.rp; if (pe < best.d) best = { d: pe, t: pa.t0, relV: 0, inside: true, alt: pe - BODIES[target].R }; continue; }
    if (BODIES[target].parent !== pa.body) continue;
    const mu = muB(pa.body), N = 400, dt = (Math.min(pa.t1, tMax) - pa.t0) / N;
    let iBest = 0, dB = Infinity;
    for (let i = 0; i <= N; i++) { const s = propagate(pa.r0, pa.v0, dt * i, mu), c = relState(target, pa.t0 + dt * i), d = len(sub(s.r, c.r)); if (d < dB) { dB = d; iBest = i; } }
    let lo = Math.max(0, iBest - 1) * dt, hi = Math.min(N, iBest + 1) * dt; // golden-section refine
    const f = x => { const s = propagate(pa.r0, pa.v0, x, mu), c = relState(target, pa.t0 + x); return len(sub(s.r, c.r)); };
    for (let k = 0; k < 50; k++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
    const x = (lo + hi) / 2, d = f(x);
    if (d < best.d) { const s = propagate(pa.r0, pa.v0, x, mu), c = relState(target, pa.t0 + x); best = { d, t: pa.t0 + x, relV: len(sub(s.v, c.v)), inside: false, alt: d - BODIES[target].R }; }
  }
  return best;
}
// ---------- transfer planner ----------
const angIn = (a, b, n) => { const x = dot(a, b), y = dot(cross(a, b), n); let t = Math.atan2(y, x); if (t < 0) t += TAU; return t; }; // angle a→b about n
// Hohmann numbers between circular radii r1 → r2 around mu.
export function hohmann(mu, r1, r2) {
  const at = (r1 + r2) / 2, tt = Math.PI * Math.sqrt(at ** 3 / mu), v1 = Math.sqrt(mu / r1), v2 = Math.sqrt(mu / r2);
  const dv1 = v1 * (Math.sqrt(2 * r2 / (r1 + r2)) - 1), dv2 = v2 * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
  const n2 = Math.sqrt(mu / r2 ** 3), phase = Math.PI - n2 * tt; // target lead angle at departure
  return { dv1, dv2, tt, phase: ((phase % TAU) + TAU) % TAU };
}
// Plan from the craft's current orbit (body `id`, state r, v at t) to `target`: a child of `id` (moon) or a
// sibling (another planet). Returns { kind, node, hohmann, phaseNow, phaseReq, wait, ejection } (node: {t, pro, nrm, rad}).
export function planTransfer(id, r, v, t, target) {
  const b = BODIES[id], tb = BODIES[target], mu = b.mu, hN = nz(cross(r, v)), r1 = len(r), n1 = Math.sqrt(mu / r1 ** 3);
  if (tb.parent === id) { // moon transfer from orbit around its planet
    const H = hohmann(mu, r1, tb.a), cs = relState(target, t), pNow = angIn(nz(r), nz(sub(cs.r, sc(hN, dot(cs.r, hN)))), hN), n2 = Math.sqrt(mu / tb.a ** 3);
    let wait = (pNow - H.phase) / (n1 - n2); const syn = TAU / Math.abs(n1 - n2); wait = ((wait % syn) + syn) % syn;
    return { kind: 'moon', syn, hohmann: H, phaseNow: pNow, phaseReq: H.phase, wait, node: { t: t + wait, pro: H.dv1, nrm: 0, rad: 0 }, dvTotal: H.dv1 + H.dv2 };
  }
  if (b.parent && tb.parent === b.parent) { // interplanetary from a parking orbit
    const P = BODIES[b.parent], ps = relState(id, t), ts = relState(target, t), rp1 = len(ps.r), H = hohmann(P.mu, rp1, tb.a);
    const hP = nz(cross(ps.r, ps.v)), pNow = angIn(nz(ps.r), nz(ts.r), hP), np1 = Math.sqrt(P.mu / rp1 ** 3), np2 = Math.sqrt(P.mu / tb.a ** 3);
    let wait = (pNow - H.phase) / (np1 - np2); const syn = TAU / Math.abs(np1 - np2); wait = ((wait % syn) + syn) % syn;
    const vinf = Math.abs(H.dv1), dvEj = Math.sqrt(vinf * vinf + 2 * mu / r1) - Math.sqrt(mu / r1);
    // ejection point: periapsis of the departure hyperbola, ν∞ before the asymptote (= planet velocity ± direction)
    const tw = t + wait, pw = relState(id, tw), Fp = transfer(b.parent, id, [0, 0, 0], pw.v, tw); // planet velocity seen in the planet frame
    let s = nz(sc(Fp.v, -1)); if (H.dv1 < 0) s = sc(s, -1); // Fp.v is the parent's motion relative to the planet: flip
    const e = 1 + r1 * vinf * vinf / mu, nuInf = Math.acos(-1 / e), sP = nz(sub(s, sc(hN, dot(s, hN))));
    const pDir = rotAbout(sP, hN, -nuInf);
    // time after the window at which the craft passes pDir in its (near-circular) parking orbit
    const sw = propagate(r, v, wait, mu), dAng = angIn(nz(sw.r), pDir, hN), tNode = tw + dAng / n1;
    return { kind: 'planet', syn, hohmann: H, phaseNow: pNow, phaseReq: H.phase, wait, vinf, ejection: dvEj, node: { t: tNode, pro: dvEj, nrm: 0, rad: 0 }, dvTotal: dvEj + Math.abs(H.dv2) };
  }
  return null;
}
// Lambert's problem (universal variables, single revolution, prograde): velocities at r1 and r2 for flight
// time dt around mu. Returns { v1, v2 } or null.
export function lambert(r1, r2, dt, mu) {
  const R1 = len(r1), R2 = len(r2), cr12 = cross(r1, r2); let dth = Math.acos(Math.max(-1, Math.min(1, dot(r1, r2) / (R1 * R2)))); if (cr12[2] < 0) dth = TAU - dth;
  const A = Math.sin(dth) * Math.sqrt(R1 * R2 / (1 - Math.cos(dth))); if (!isFinite(A) || Math.abs(A) < 1e-9) return null;
  const C = z => (z > 1e-6 ? (1 - Math.cos(Math.sqrt(z))) / z : z < -1e-6 ? (Math.cosh(Math.sqrt(-z)) - 1) / -z : 0.5);
  const S = z => (z > 1e-6 ? (Math.sqrt(z) - Math.sin(Math.sqrt(z))) / Math.sqrt(z) ** 3 : z < -1e-6 ? (Math.sinh(Math.sqrt(-z)) - Math.sqrt(-z)) / Math.sqrt(-z) ** 3 : 1 / 6);
  const y = z => R1 + R2 + A * (z * S(z) - 1) / Math.sqrt(C(z));
  const F = z => { const yy = y(z); if (yy < 0) return -Infinity; return (yy / C(z)) ** 1.5 * S(z) + A * Math.sqrt(yy) - Math.sqrt(mu) * dt; };
  let lo = -4 * Math.PI * Math.PI, hi = 4 * Math.PI * Math.PI; while (y(lo) < 0) lo += 0.1;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2, f = F(m); if (!isFinite(f) || f < 0) lo = m; else hi = m; }
  const z = (lo + hi) / 2, yy = y(z), f = 1 - yy / R1, g = A * Math.sqrt(yy / mu), gd = 1 - yy / R2;
  return { v1: sc(sub(r2, sc(r1, f)), 1 / g), v2: sc(sub(sc(r2, gd), r1), 1 / g) };
}
// Interplanetary departure from a parking orbit: Lambert-optimal (departure, flight time) near the Hohmann
// window, then the ejection burn on the parking orbit (periapsis of the departure hyperbola).
export function planInterplanetary(id, r, v, t, target, guess) {
  const b = BODIES[id], P = b.parent, mu = b.mu, r1 = len(r), hN = nz(cross(r, v)), n1 = Math.sqrt(mu / r1 ** 3);
  let best = null;
  for (let dd = -30; dd <= 30; dd += 2) for (let df = -50; df <= 50; df += 5) {
    const td = t + guess.wait + dd * 86400, tf = guess.hohmann.tt + df * 86400; if (td < t + 3600) continue;
    const e = relState(id, td), m = relState(target, td + tf), L = lambert(e.r, m.r, tf, BODIES[P].mu); if (!L) continue;
    const vi = len(sub(L.v1, e.v)); if (!best || vi < best.vi) best = { vi, td, tf, vinf: sub(L.v1, e.v) };
  }
  if (!best) return null;
  // v∞ in the planet's frame (inertial frames: a pure rotation of the heliocentric vector)
  const Vh = transfer(P, id, [0, 0, 0], best.vinf, best.td).v, V0 = transfer(P, id, [0, 0, 0], [0, 0, 0], best.td).v, Vi = sub(Vh, V0), s = nz(Vi), vinf = len(Vi);
  // exact ejection: periapsis p on the parking orbit with angle(p, s) = ν∞; hyperbola plane = span(p, s)
  const e = 1 + r1 * vinf * vinf / mu, nuInf = Math.acos(-1 / e), beta = Math.asin(Math.max(-1, Math.min(1, dot(s, hN)))), sP = nz(sub(s, sc(hN, dot(s, hN))));
  const cphi = Math.max(-1, Math.min(1, Math.cos(nuInf) / Math.max(1e-6, Math.cos(beta)))), vp = Math.sqrt(vinf * vinf + 2 * mu / r1), vcirc = Math.sqrt(mu / r1);
  let pick = null;
  for (const sg of [1, -1]) {
    const pDir = rotAbout(sP, hN, -sg * Math.acos(cphi)), nh = nz(cross(pDir, s)), vDir = nz(cross(nh, pDir)), vc = sc(nz(cross(hN, pDir)), vcirc), dv = sub(sc(vDir, vp), vc);
    if (!pick || len(dv) < len(pick.dvv)) pick = { pDir, dvv: dv, vc };
  }
  const sw = propagate(r, v, best.td - t, mu), tNode = best.td + angIn(nz(sw.r), pick.pDir, hN) / n1;
  const at = propagate(r, v, tNode - t, mu), f = nodeFrame(at.r, at.v), dv = pick.dvv;
  return { td: best.td, tf: best.tf, vinf, dla: Math.asin(Math.max(-1, Math.min(1, s[2]))), ejection: len(dv), node: { t: tNode, pro: dot(dv, f.pro), nrm: dot(dv, f.nrm), rad: dot(dv, f.rad) } };
}
function rotAbout(vv, k, a) { const c = Math.cos(a), s = Math.sin(a); return add(add(sc(vv, c), sc(cross(k, vv), s)), sc(k, dot(k, vv) * (1 - c))); }
// Refine a node so the predicted trajectory reaches `target` (minimise closest approach, then aim the
// periapsis at `peAlt` once inside the SOI). Nelder–Mead over (time, prograde, normal).
// Finite burn of `node` with an engine { T (N), m0 (kg), isp (s) }, centred on the node time and following the
// local prograde / normal / radial frame like the flight's node execution. Returns the state at burn end.
export function finiteBurn(id, r, v, t, node, eng) {
  const mu = BODIES[id].mu, ve = eng.isp * G0, dv = nodeDv(node), bt = burnTime(dv, eng.T, eng.m0, eng.isp), t0 = node.t - bt / 2;
  let s = propagate(r, v, t0 - t, mu), R = s.r, Vv = s.v, m = eng.m0, tt = t0; const done = [0, 0, 0], h = Math.max(0.5, bt / 300);
  const acc = (R, Vv, m) => { const f = nodeFrame(R, Vv), L = [node.pro - done[0], (node.nrm || 0) - done[1], (node.rad || 0) - done[2]], Lm = Math.hypot(...L) || 1;
    const dir = nz(add(add(sc(f.pro, L[0] / Lm), sc(f.nrm, L[1] / Lm)), sc(f.rad, L[2] / Lm))), g = sc(R, -mu / len(R) ** 3); return { a: add(g, sc(dir, eng.T / m)), dir, f }; };
  for (let k = 0; k < 4000; k++) {
    const L = [node.pro - done[0], (node.nrm || 0) - done[1], (node.rad || 0) - done[2]], left = Math.hypot(...L), along = L[0] * node.pro + L[1] * (node.nrm || 0) + L[2] * (node.rad || 0);
    if (left < 0.3 || along <= 0) break;
    const step = Math.min(h, left / (eng.T / m) + 1e-3), a1 = acc(R, Vv, m);
    // midpoint integration (good to well under a metre per second over a burn)
    const Rm = add(R, sc(Vv, step / 2)), Vm = add(Vv, sc(a1.a, step / 2)), mm = m - eng.T / ve * step / 2, a2 = acc(Rm, Vm, mm);
    R = add(R, sc(Vm, step)); Vv = add(Vv, sc(a2.a, step)); const dA = sc(a2.dir, eng.T / mm * step);
    done[0] += dot(dA, a2.f.pro); done[1] += dot(dA, a2.f.nrm); done[2] += dot(dA, a2.f.rad); m -= eng.T / ve * step; tt += step;
  }
  return { r: R, v: Vv, t: tt };
}
export function refineNode(id, r, v, t, node, target, opts = {}) {
  const tb = BODIES[target], peAlt = opts.peAlt ?? Math.max(50000, tb.R * 0.1), scaleT = opts.scaleT || 600, scaleV = opts.scaleV || 20;
  const cost = x => {
    const n = { t: node.t + x[0] * scaleT, pro: node.pro + x[1] * scaleV, nrm: (node.nrm || 0) + x[2] * scaleV, rad: (node.rad || 0) + (x[3] || 0) * scaleV };
    if (n.t < (opts.tMin ?? t + 1)) return 1e30;
    let pr; if (opts.burn) { const fb = finiteBurn(id, r, v, t, n, opts.burn); pr = predict(id, fb.r, fb.v, fb.t, { maxPatches: 4, samples: 2, stopAlt: 0 }); }
    else pr = predict(id, r, v, t, { nodes: [n], maxPatches: 4, samples: 2, stopAlt: 0 });
    const ca = closestApproach(pr, target, opts.byT);
    return (ca.inside ? Math.abs(ca.d - (tb.R + peAlt)) : ca.d + tb.soi * 3) + (opts.dvWeight || 0) * Math.hypot(n.pro, n.nrm, n.rad);
  };
  const D = opts.radial ? 4 : 3, E = Array.from({ length: D + 1 }, (_, i) => Array.from({ length: D }, (_, k) => (k === i - 1 ? 1 : 0)));
  let S = E.map(p => ({ p, f: cost(p) }));
  for (let it = 0; it < (opts.iters || 160); it++) {
    S.sort((a, b) => a.f - b.f);
    const c = S[0].p.map((_, k) => S.slice(0, D).reduce((a, q) => a + q.p[k], 0) / D), w = S[D];
    const at = k => c.map((x, i) => x + k * (x - w.p[i]));
    const rP = at(1), fr = cost(rP);
    if (fr < S[0].f) { const eP = at(2), fe = cost(eP); S[D] = fe < fr ? { p: eP, f: fe } : { p: rP, f: fr }; }
    else if (fr < S[D - 1].f) S[D] = { p: rP, f: fr };
    else { const kP = at(-0.5), fk = cost(kP); if (fk < w.f) S[D] = { p: kP, f: fk }; else S = S.map((s, i) => (i ? { p: s.p.map((x, j) => S[0].p[j] + (x - S[0].p[j]) * 0.5), f: cost(s.p.map((x, j) => S[0].p[j] + (x - S[0].p[j]) * 0.5)) } : s)); }
    if (opts.good && S[0].f < opts.good) break;
  }
  S.sort((a, b) => a.f - b.f); const x = S[0].p;
  return { node: { t: node.t + x[0] * scaleT, pro: node.pro + x[1] * scaleV, nrm: (node.nrm || 0) + x[2] * scaleV, rad: (node.rad || 0) + (x[3] || 0) * scaleV }, cost: S[0].f };
}

// Time to the next periapsis on the conic (s); Infinity for a circular orbit.
export function timeToPe(r, v, mu) {
  const o = elements(r, v, mu); if (o.e < 1e-6) return Infinity;
  const cosNu = Math.max(-1, Math.min(1, dot(o.ev, r) / (o.e * o.r))); let nu = Math.acos(cosNu); if (o.vr < 0) nu = TAU - nu;
  if (o.e < 1) { const E = 2 * Math.atan(Math.sqrt((1 - o.e) / (1 + o.e)) * Math.tan(nu / 2)), M = E - o.e * Math.sin(E), n = Math.sqrt(mu / o.a ** 3); return ((TAU - M) % TAU + TAU) % TAU / n; }
  if (o.vr >= 0) return Infinity; const H = 2 * Math.atanh(Math.sqrt((o.e - 1) / (o.e + 1)) * Math.tan(nu / 2)), M = o.e * Math.sinh(H) - H, n = Math.sqrt(mu / (-o.a) ** 3); return -M / n;
}
// Best parking-orbit inclination (deg, to the departure body's equator) for a transfer to `target`:
// the Moon's orbital plane for a lunar transfer, the declination of the outgoing asymptote for a planet.
export function suggestInclination(id, target, t, plan) {
  if (BODIES[target].parent === id) { const s = relState(target, t + (plan ? plan.wait : 0)), h = nz(cross(s.r, s.v)); return Math.acos(Math.max(-1, Math.min(1, h[2]))) * 180 / Math.PI; }
  if (plan && plan.dla !== undefined) return Math.abs(plan.dla) * 180 / Math.PI;
  return 0;
}
// One-call planner for the map's planner panel: Hohmann window and phase angle, the tuned (refined) node
// (the default: usually the cheapest), the Lambert-exact alternative for planets, and the suggested
// parking-orbit inclination for this transfer.
export function planFull(id, r, v, t, target, opts = {}) {
  let pl = planTransfer(id, r, v, t, target); if (!pl) return null;
  const minWait = opts.minWait ?? 900;
  if (pl.node.t - t < minWait) { // too soon to turn and start the burn: the next window
    const mu = BODIES[id].mu, n1 = Math.sqrt(mu / len(r) ** 3), k = Math.ceil((minWait - (pl.node.t - t)) / (TAU / n1));
    pl = pl.kind === 'moon' ? { ...pl, wait: pl.wait + k * TAU / n1, node: { ...pl.node, t: pl.node.t + k * TAU / n1 } } : pl;
  }
  const tb = BODIES[target], peAlt = opts.peAlt ?? (pl.kind === 'moon' ? Math.max(30000, Math.min(100000, tb.R * 0.06)) : Math.max(300000, (tb.atm ? atmTop(target) : 0) + 150000));
  const byT = pl.kind === 'planet' ? pl.node.t + pl.hohmann.tt * 1.3 : undefined;
  const ref = pl.kind === 'moon' ? refineNode(id, r, v, t, pl.node, target, { peAlt, good: 2000 }) : refineNode(id, r, v, t, pl.node, target, { peAlt, scaleT: 900, scaleV: 30, iters: 250, byT });
  if (opts.burn) { // finite-burn aware: re-tune the node so the real (spread-out) burn gives the encounter
    const r2 = refineNode(id, r, v, t, ref.node, target, { peAlt, burn: opts.burn, scaleT: pl.kind === 'moon' ? 60 : 120, scaleV: pl.kind === 'moon' ? 5 : 10, iters: 200, radial: true, good: pl.kind === 'moon' ? 3000 : 20000, byT });
    ref.node = r2.node;
  }
  const exact = pl.kind === 'planet' ? planInterplanetary(id, r, v, t, target, pl) : null;
  let pr; if (opts.burn) { const fb = finiteBurn(id, r, v, t, ref.node, opts.burn); pr = predict(id, fb.r, fb.v, fb.t, { maxPatches: 4 }); } else pr = predict(id, r, v, t, { nodes: [ref.node], maxPatches: 4 });
  const ca = closestApproach(pr, target, byT);
  const incl = suggestInclination(id, target, t, exact || pl);
  return { ...pl, target, peAlt, byT, tuned: ref.node, tunedDv: nodeDv(ref.node), exact: exact ? exact.node : null, exactDv: exact ? nodeDv(exact.node) : null, exactInfo: exact, incl, ca, reaches: !!ca.inside };
}

// Mid-course correction: the cheapest small burn (tried from several start times) that puts periapsis at
// `peAlt` above the target. Used by the planner's "Fix encounter" button and the scripted missions.
export function correctionNode(id, r, v, t, target, opts = {}) {
  const tb = BODIES[target], peAlt = opts.peAlt ?? 100000, tol = opts.tol ?? Math.max(20000, peAlt * 0.5), starts = opts.starts || [1800, 7200, 21600, 43200];
  let best = null;
  for (const dt0 of starts) {
    const rf = refineNode(id, r, v, t, { t: t + dt0, pro: 0, nrm: 0, rad: 0 }, target, { tMin: t + Math.min(...starts) * 0.8, peAlt, scaleT: dt0 * 0.3, scaleV: opts.scaleV || 5, radial: true, iters: opts.iters || 220, dvWeight: opts.dvWeight ?? 1000, byT: opts.byT });
    const pr = predict(id, r, v, t, { nodes: [rf.node], maxPatches: 4 }), ca = closestApproach(pr, target), dv = nodeDv(rf.node);
    const good = ca.inside && Math.abs(ca.d - tb.R - peAlt) < tol;
    if (!best || (good && !best.good) || (good === best.good && dv < best.dv)) best = { node: rf.node, dv, good, alt: ca.alt };
  }
  return best;
}
