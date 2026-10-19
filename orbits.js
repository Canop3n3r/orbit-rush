// Orbit Rush orbital mechanics: Kepler propagation ("on rails"), patched-conic SOI handoff between the home
// planet and Lumen, trajectory prediction for the map, maneuver nodes, transfer/capture planning, and the
// Lumen landing autopilot. No DOM: shared by flight.js, main.js and the tests.
import { R, MU, ATM, G0, MOON, moonState, bodyAt, massOf } from './physics.js?v=mm1';
const hyp = Math.hypot;

// ---------- two-body elements and universal-variable Kepler propagation ----------
export function elements(rx, ry, vx, vy, mu) {
  const r = hyp(rx, ry), v2 = vx * vx + vy * vy, E = v2 / 2 - mu / r, h = rx * vy - ry * vx, rv = rx * vx + ry * vy;
  const ex = ((v2 - mu / r) * rx - rv * vx) / mu, ey = ((v2 - mu / r) * ry - rv * vy) / mu, e = hyp(ex, ey);
  const p = h * h / mu, a = -mu / (2 * E), rp = p / (1 + e);
  const ra = E < 0 ? a * (1 + e) : Infinity, T = E < 0 ? 2 * Math.PI * Math.sqrt(a * a * a / mu) : Infinity;
  return { e, ex, ey, p, a, E, h, rp, ra, T, r, vr: rv / r };
}
export function relElements(st) { const b = bodyAt(st.soi, st.t); const el = elements(st.x - b.x, st.y - b.y, st.vx - b.vx, st.vy - b.vy, b.mu); el.pe = el.rp - b.R; el.ap = el.ra - b.R; el.body = b; return el; }
function stumpC(z) { if (z > 1e-6) { const s = Math.sqrt(z); return (1 - Math.cos(s)) / z; } if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.cosh(s) - 1) / -z; } return 0.5 - z / 24 + z * z / 720; }
function stumpS(z) { if (z > 1e-6) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); } if (z < -1e-6) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); } return 1 / 6 - z / 120 + z * z / 5040; }
// Exact two-body propagation of a relative state by dt (elliptic, parabolic and hyperbolic). Returns [x, y, vx, vy].
export function kepler(rx, ry, vx, vy, mu, dt) {
  if (!dt) return [rx, ry, vx, vy];
  const r0 = hyp(rx, ry), v02 = vx * vx + vy * vy, rv = rx * vx + ry * vy, vr0 = rv / r0, alpha = 2 / r0 - v02 / mu, sm = Math.sqrt(mu);
  if (alpha > 1e-12) { const T = 2 * Math.PI / Math.sqrt(mu * alpha * alpha * alpha); if (Math.abs(dt) > T) dt %= T; if (!dt) return [rx, ry, vx, vy]; }
  let chi;
  if (alpha > 1e-12) chi = sm * dt * alpha;
  else if (alpha < -1e-12) { const a = 1 / alpha, sg = Math.sign(dt); chi = sg * Math.sqrt(-a) * Math.log((-2 * mu * alpha * dt) / (rv + sg * Math.sqrt(-mu * a) * (1 - r0 * alpha))); if (!isFinite(chi)) chi = sm * dt / r0; }
  else chi = sm * dt / r0;
  for (let i = 0; i < 80; i++) {
    const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
    const F = r0 * vr0 / sm * chi * chi * C + (1 - alpha * r0) * chi * chi * chi * S + r0 * chi - sm * dt;
    const dF = r0 * vr0 / sm * chi * (1 - z * S) + (1 - alpha * r0) * chi * chi * C + r0;
    let d = F / dF; if (!isFinite(d)) break;
    if (Math.abs(d) > Math.abs(chi) + 1e3) d = Math.sign(d) * (Math.abs(chi) + 1e3) * 0.5; // damp wild steps
    chi -= d; if (Math.abs(d) < 1e-10 * Math.max(1, Math.abs(chi))) break;
  }
  const z = alpha * chi * chi, C = stumpC(z), S = stumpS(z);
  const f = 1 - chi * chi / r0 * C, g = dt - chi * chi * chi * S / sm;
  const nx = f * rx + g * vx, ny = f * ry + g * vy, r = hyp(nx, ny);
  const fd = sm / (r * r0) * (z * chi * S - chi), gd = 1 - chi * chi / r * C;
  const out = [nx, ny, fd * rx + gd * vx, fd * ry + gd * vy];
  if (out.every(isFinite)) return out;
  // numeric fallback (should not happen): RK4 two-body
  let s = [rx, ry, vx, vy]; const n = Math.max(10, Math.ceil(Math.abs(dt) / 2)), hh = dt / n;
  const fdr = q => { const rr = hyp(q[0], q[1]), k = -mu / (rr * rr * rr); return [q[2], q[3], k * q[0], k * q[1]]; };
  for (let i = 0; i < n; i++) { const k1 = fdr(s), k2 = fdr(s.map((x, j) => x + k1[j] * hh / 2)), k3 = fdr(s.map((x, j) => x + k2[j] * hh / 2)), k4 = fdr(s.map((x, j) => x + k3[j] * hh)); s = s.map((x, j) => x + hh / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); }
  return s;
}

// ---------- patched-conic rails ----------
// A rails state: { x, y, vx, vy, t, soi } in planet-centred inertial coordinates; t is the flight clock (s).
export const stateOf = v => ({ x: v.x, y: v.y, vx: v.vx, vy: v.vy, t: v.clock || 0, soi: v.soi || 'planet' });
export function propagate(st, dt) {
  const b0 = bodyAt(st.soi, st.t), b1 = bodyAt(st.soi, st.t + dt);
  const [x, y, vx, vy] = kepler(st.x - b0.x, st.y - b0.y, st.vx - b0.vx, st.vy - b0.vy, b0.mu, dt);
  return { x: x + b1.x, y: y + b1.y, vx: vx + b1.vx, vy: vy + b1.vy, t: st.t + dt, soi: st.soi };
}
const moonDist = st => { const m = moonState(st.t); return hyp(st.x - m.x, st.y - m.y); };
// Event functions: each crosses from + to − when the event happens.
function events(st, far) {
  if (st.soi === 'moon') { const d = moonDist(st); return [['soi-out', MOON.SOI - d], ['impact', d - MOON.R]]; }
  const r = hyp(st.x, st.y), ev = [['soi-in', moonDist(st) - MOON.SOI], ['atm', r - R - ATM], ['impact', r - R]];
  if (far) ev.push(['far', far - r]);
  return ev;
}
function rates(st) { // upper bounds on how fast each event function can change (m/s)
  const b = bodyAt(st.soi, st.t), vrel = hyp(st.vx - b.vx, st.vy - b.vy);
  if (st.soi === 'moon') return [vrel + 30, vrel + 30];
  const m = moonState(st.t), vm = hyp(st.vx - m.vx, st.vy - m.vy), v = hyp(st.vx, st.vy);
  return [vm + 60, v + 30, v + 30, v + 30];
}
// Coast on rails for up to dtTotal, stopping exactly at the first SOI change / atmosphere entry / impact.
// opts.hMax(st) caps the chunk (for smooth map samples), opts.onSample(st) sees each chunk end,
// opts.far: stop when the craft gets this far from the planet. Returns { st, event, dt }.
export function railsAdvance(st0, dtTotal, opts = {}) {
  let st = st0, done = 0;
  while (dtTotal - done > 1e-9) {
    const ev0 = events(st, opts.far), rt = rates(st);
    let h = dtTotal - done;
    ev0.forEach(([, g], i) => { if (g > 0) h = Math.min(h, Math.max(opts.hMin || 0.5, 0.5 * g / rt[i])); });
    if (opts.hMax) h = Math.min(h, Math.max(0.5, opts.hMax(st)));
    const st1 = propagate(st, h), ev1 = events(st1, opts.far);
    const hit = ev0.map(([, g], i) => g > 0 && ev1[i][1] <= 0);
    if (hit.some(Boolean)) {
      let lo = 0, hi = h, sHi = st1;
      for (let k = 0; k < 48 && hi - lo > 1e-4; k++) {
        const mid = (lo + hi) / 2, sm = propagate(st, mid), em = events(sm, opts.far);
        if (em.some(([, g], i) => hit[i] && g <= 0)) { hi = mid; sHi = sm; } else lo = mid;
      }
      const eh = events(sHi, opts.far), idx = eh.findIndex(([, g], i) => hit[i] && g <= 0);
      const name = eh[idx][0];
      if (name === 'soi-in') sHi = { ...sHi, soi: 'moon' }; else if (name === 'soi-out') sHi = { ...sHi, soi: 'planet' };
      if (opts.onSample) opts.onSample(sHi);
      return { st: sHi, event: name, dt: done + hi };
    }
    st = st1; done += h; if (opts.onSample) opts.onSample(st);
  }
  return { st, event: null, dt: done };
}
// Full patched-conic state at absolute time t (follows SOI changes; stops early at impact/atmosphere).
export function stateAt(st, t) {
  let s = st;
  for (let i = 0; i < 8 && t - s.t > 1e-9; i++) { const r = railsAdvance(s, t - s.t); s = r.st; if (r.event === 'impact' || r.event === 'atm') break; }
  return s;
}

// ---------- maneuver nodes ----------
// node = { t, pro, rad }: delta-v (m/s) along prograde and radial-out of the body the craft is in at time t.
export function nodeFrame(st) {
  const b = bodyAt(st.soi, st.t), rx = st.x - b.x, ry = st.y - b.y, vx = st.vx - b.vx, vy = st.vy - b.vy, sp = hyp(vx, vy) || 1;
  const px = vx / sp, py = vy / sp, r = hyp(rx, ry); let qx = rx / r, qy = ry / r; const d = qx * px + qy * py;
  qx -= d * px; qy -= d * py; const q = hyp(qx, qy) || 1;
  return { px, py, qx: qx / q, qy: qy / q };
}
export function nodeVector(st, node) { const f = nodeFrame(st); return [f.px * node.pro + f.qx * node.rad, f.py * node.pro + f.qy * node.rad]; }
export const nodeDv = node => hyp(node.pro, node.rad);
// Vacuum delta-v left in the vehicle, and the time to burn dv with the current and later stages.
export function dvLeft(v) {
  let m = massOf(v), dv = 0;
  for (let i = v.cur; i < v.stages.length; i++) { const s = v.stages[i]; if (s.fuel > 0 && s.eng.tv > 0) dv += s.eng.ispVac * G0 * Math.log(m / (m - s.fuel)); m -= s.dry + s.fuel; }
  return dv;
}
export function burnTime(v, dv) {
  let m = massOf(v), t = 0, left = dv;
  for (let i = v.cur; i < v.stages.length && left > 0; i++) {
    const s = v.stages[i]; if (!(s.fuel > 0 && s.eng.tv > 0)) { m -= s.dry + s.fuel; continue; }
    const ve = s.eng.ispVac * G0, mdot = s.eng.tv * s.n / ve, dvS = ve * Math.log(m / (m - s.fuel));
    if (left <= dvS) { t += m * (1 - Math.exp(-left / ve)) / mdot; left = 0; break; }
    t += s.fuel / mdot; left -= dvS; m -= s.dry + s.fuel;
  }
  return left > 0 ? Infinity : t;
}

// ---------- trajectory prediction (for the map, warp and the planners) ----------
// Returns { segs, encounter, ca, node } where each seg = { soi, t0, t1, end, pts: [{t, x, y, rx, ry}], pe, ap, post }.
// pts carry absolute positions and positions relative to the seg's body; pe/ap are set when reached inside the seg.
export function predict(st0, opts = {}) {
  const node = opts.node, maxSegs = opts.maxSegs || 5, far = opts.far || MOON.A * 2.2;
  const segs = []; let st = { ...st0 }, nodeDone = !node || node.t < st0.t, encounter = null, ca = null, nodeInfo = null;
  const tCap = st0.t + (opts.tMax || 2.5e6);
  for (let k = 0; k < maxSegs && st.t < tCap; k++) {
    const el = relElements(st), b0 = el.body;
    let limit = isFinite(el.T) && el.T > 0 ? st.t + el.T * (opts.revs || 1) : tCap;
    if (st.soi === 'planet' && !isFinite(el.T)) limit = tCap;
    if (!nodeDone && node.t > st.t) limit = Math.max(limit, node.t);
    let stopAtNode = !nodeDone && node.t >= st.t && node.t <= limit;
    const seg = { soi: st.soi, t0: st.t, t1: st.t, end: 'horizon', pts: [], post: nodeDone && !!node, el };
    const push = s => { const b = bodyAt(seg.soi, s.t); seg.pts.push({ t: s.t, x: s.x, y: s.y, rx: s.x - b.x, ry: s.y - b.y, st: s }); };
    push(st);
    const hMax = s => { const b = bodyAt(s.soi, s.t), r = hyp(s.x - b.x, s.y - b.y), sp = hyp(s.vx - b.vx, s.vy - b.vy) || 1; return 0.035 * r / sp; };
    const res = railsAdvance(st, (stopAtNode ? node.t : limit) - st.t, { hMax, far: st.soi === 'planet' ? far : 0, onSample: push });
    st = res.st; seg.t1 = st.t; seg.end = res.event || (stopAtNode ? 'node' : 'horizon');
    if (res.event === 'soi-in' || res.event === 'soi-out') { seg.end = res.event; seg.pts[seg.pts.length - 1].soiEdge = true; }
    // interior extrema → Pe / Ap markers of this seg's body
    let iMin = 0, iMax = 0; seg.pts.forEach((p, i) => { const r = hyp(p.rx, p.ry); if (r < hyp(seg.pts[iMin].rx, seg.pts[iMin].ry)) iMin = i; if (r > hyp(seg.pts[iMax].rx, seg.pts[iMax].ry)) iMax = i; });
    const N = seg.pts.length, refine = (i, sgn) => { // golden-section on radius between neighbours
      const a0 = seg.pts[Math.max(0, i - 1)].st, t1 = seg.pts[Math.min(N - 1, i + 1)].t; let lo = a0.t, hi = t1;
      const f = t => { const s = propagate({ ...a0, soi: seg.soi }, t - a0.t), b = bodyAt(seg.soi, s.t); return sgn * hyp(s.x - b.x, s.y - b.y); };
      for (let j = 0; j < 40; j++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
      const s = propagate({ ...a0, soi: seg.soi }, (lo + hi) / 2 - a0.t), b = bodyAt(seg.soi, s.t); return { t: s.t, x: s.x, y: s.y, rx: s.x - b.x, ry: s.y - b.y, alt: hyp(s.x - b.x, s.y - b.y) - b.R };
    };
    if (iMin > 0 && iMin < N - 1) seg.pe = refine(iMin, 1);
    if (iMax > 0 && iMax < N - 1 && isFinite(el.ra)) seg.ap = refine(iMax, -1);
    if (seg.soi === 'moon') {
      if (!encounter) {
        const elm = relElements(seg.pts[0].st);
        encounter = { t: seg.t0, peAlt: seg.pe ? seg.pe.alt : (elm.vr < 0 ? elm.pe : hyp(seg.pts[0].rx, seg.pts[0].ry) - MOON.R), peT: seg.pe ? seg.pe.t : seg.t0, impact: seg.end === 'impact', seg: segs.length };
      }
    } else if (!encounter) { // closest approach to Lumen along this planet seg
      let best = Infinity, bi = -1; seg.pts.forEach((p, i) => { const m = moonState(p.t), d = hyp(p.x - m.x, p.y - m.y); if (d < best) { best = d; bi = i; } });
      if (bi >= 0 && hyp(seg.pts[bi].x, seg.pts[bi].y) > MOON.A * 0.3) {
        const a0 = seg.pts[Math.max(0, bi - 1)].st; let lo = a0.t, hi = seg.pts[Math.min(N - 1, bi + 1)].t;
        const f = t => { const s = propagate(a0, t - a0.t), m = moonState(t); return hyp(s.x - m.x, s.y - m.y); };
        for (let j = 0; j < 40; j++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (f(m1) < f(m2)) hi = m2; else lo = m1; }
        const tc = (lo + hi) / 2, s = propagate(a0, tc - a0.t), m = moonState(tc), d = hyp(s.x - m.x, s.y - m.y);
        if (!ca || d < ca.d) ca = { d, t: tc, x: s.x, y: s.y, mx: m.x, my: m.y };
      }
    }
    segs.push(seg);
    if (seg.end === 'node') {
      const dv = nodeVector(st, node); nodeInfo = { t: st.t, st: { ...st }, dvx: dv[0], dvy: dv[1], seg: segs.length - 1 };
      st = { ...st, vx: st.vx + dv[0], vy: st.vy + dv[1] }; nodeDone = true; continue;
    }
    if (seg.end === 'impact' || seg.end === 'atm' || seg.end === 'far' || seg.end === 'horizon') {
      if (seg.end === 'horizon' && !nodeDone) continue;
      break;
    }
  }
  return { segs, encounter, ca, node: nodeInfo };
}
// Where the craft will be at the node, and the node's inertial delta-v vector.
export function nodeState(st, node) { const s = stateAt(st, node.t); return { st: s, dv: nodeVector(s, node) }; }

// ---------- planners ----------
// A prograde node from a planet orbit that sets up a Lumen encounter with periapsis near peAlt (m).
export function planTransfer(st, opts = {}) {
  if (st.soi !== 'planet') return null;
  const el = relElements(st); if (!isFinite(el.T) || el.pe < ATM) return null;
  const target = opts.peAlt ?? 30000, T = el.T, t0 = st.t + (opts.lead ?? 120);
  const dvFor = t => { const s = stateAt(st, t), r = hyp(s.x, s.y), vNeed = Math.sqrt(MU * (2 / r - 2 / (r + MOON.A))); return { s, dv: vNeed - hyp(s.vx, s.vy) }; };
  const cost = (t, dv) => { const p = predict(st, { node: { t, pro: dv, rad: 0 }, maxSegs: 3 }); const e = p.encounter; return e ? Math.abs(e.peAlt - target) + (e.peAlt < 5000 ? 2e5 : 0) : 1e7 + (p.ca ? p.ca.d : 1e7); };
  let best = null;
  for (let k = 0; k < 90; k++) { const t = t0 + k * T / 90, { dv } = dvFor(t); const c = cost(t, dv); if (!best || c < best.c) best = { t, dv, c }; }
  if (!best || best.c >= 1e7) { // no encounter on the coarse grid: try a little more delta-v
    for (const extra of [15, 30, -15]) for (let k = 0; k < 90; k++) { const t = t0 + k * T / 90, { dv } = dvFor(t); const c = cost(t, dv + extra); if (!best || c < best.c) best = { t, dv: dv + extra, c }; }
  }
  if (!best) return null;
  let stepT = T / 180, stepV = 4;
  for (let it = 0; it < 40 && best.c > 500; it++) {
    let moved = false;
    for (const [dt, dd] of [[stepT, 0], [-stepT, 0], [0, stepV], [0, -stepV]]) { const t = Math.max(t0, best.t + dt), dv = best.dv + dd, c = cost(t, dv); if (c < best.c) { best = { t, dv, c }; moved = true; } }
    if (!moved) { stepT /= 2; stepV /= 2; }
  }
  return best.c < 1e7 ? { t: best.t, pro: best.dv, rad: 0, cost: best.c } : null;
}
// A retrograde node at Lumen periapsis that circularizes there (needs a predicted encounter).
export function planCapture(st, opts = {}) {
  const p = predict(st, { maxSegs: 3 }), e = p.encounter; if (!e || e.peAlt < 0) return null;
  const s = stateAt(st, e.peT); if (s.soi !== 'moon') return null;
  const b = bodyAt('moon', s.t), r = hyp(s.x - b.x, s.y - b.y), sp = hyp(s.vx - b.vx, s.vy - b.vy);
  const vC = Math.sqrt(MOON.MU / r) * (opts.ecc ? Math.sqrt(1 + opts.ecc) : 1);
  return { t: e.peT, pro: -(sp - vC), rad: 0 };
}
// Circularize at the next apoapsis (or periapsis) of the current body.
export function planCircularize(st, at = 'ap') {
  const p = predict(st, { maxSegs: 1 }), seg = p.segs[0], pt = seg && seg[at]; if (!pt) return null;
  const s = stateAt(st, pt.t), b = bodyAt(s.soi, s.t), r = hyp(s.x - b.x, s.y - b.y), sp = hyp(s.vx - b.vx, s.vy - b.vy);
  return { t: pt.t, pro: Math.sqrt(b.mu / r) - sp, rad: 0 };
}

// ---------- Lumen landing autopilot ----------
// Deorbit (retrograde until the path meets the surface), then a throttled retrograde "suicide burn" that
// follows a safe descent-speed profile and touches down slowly and upright. Returns { ang, throttle, phase }.
export const LAND_SPEED = 6; // m/s: touchdown limit on Lumen
export function landerGuide(v) {
  const m = moonState(v.clock || 0), rx = v.x - m.x, ry = v.y - m.y, r = hyp(rx, ry), h = r - MOON.R;
  const vx = v.vx - m.vx, vy = v.vy - m.vy, sp = hyp(vx, vy), up = Math.atan2(ry, rx), vr = (rx * vx + ry * vy) / r;
  const st = v.stages[v.cur], aMax = st && st.fuel > 0 ? st.eng.tv * st.n / massOf(v) : 0, g = MOON.MU / (r * r);
  const retro = sp > 1.5 ? Math.atan2(-vy, -vx) : up;
  if (aMax <= 0) return { ang: retro, throttle: 0, phase: 'no fuel' };
  const el = elements(rx, ry, vx, vy, MOON.MU), pe = el.rp - MOON.R;
  if (pe > -2000 && h > 3000) return { ang: retro, throttle: 1, phase: 'deorbit' };
  const aNet = Math.max(aMax * 0.55 - g, 0.15);
  const vdes = Math.sqrt(2 * aNet * Math.max(h - 3, 0)) + 1.2;
  if (h < 40 && sp < 4) { // final: upright, hold ~1.5 m/s down
    const thr = Math.max(0, Math.min(1, (g + (-vr - 1.5) * 2) / aMax));
    return { ang: up + Math.max(-0.3, Math.min(0.3, Math.atan2(-((vx * -ry + vy * rx) / r), 10))), throttle: thr, phase: 'touchdown' };
  }
  if (sp > vdes || vr > 5 && h < 2000) {
    const thr = Math.max(0, Math.min(1, (g + (sp - vdes) * 2) / aMax));
    return { ang: retro, throttle: thr, phase: 'landing burn' };
  }
  return { ang: retro, throttle: 0, phase: 'descent' };
}
