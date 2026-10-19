// Orbit Rush physics: 2D planar flight around a 1:10-scale Earth. Units: m, s, tonnes, kN.
export const R = 600000, G0 = 9.81, MU = G0 * R * R, ATM = 70000, SCALE_H = 5600, RHO0 = 1.225;
export const OPTS = {
  engines: [1, 3, 5],
  s1fuel: [15, 25, 35],
  s2fuel: [3, 6, 9],
  payload: [{ name: 'CubeSat', m: 0.5, mult: 1 }, { name: 'Sat Stack', m: 2.5, mult: 1.5 }, { name: 'Crew Capsule', m: 5, mult: 2 }],
};
export const E1 = { tv: 215, ispSl: 280, ispVac: 310, m: 1.5 };
export const E2 = { tv: 90, ispSl: 200, ispVac: 345, m: 0.6 };

export function buildRocket(cfg) {
  const s1dry = 1 + 0.1 * cfg.s1fuel + cfg.engines * E1.m;
  const s2dry = 0.3 + 0.1 * cfg.s2fuel + E2.m;
  return {
    x: 0, y: R, vx: 0, vy: 0, ang: Math.PI / 2, throttle: 0, clamped: true,
    stages: [
      { dry: s1dry, fuel: cfg.s1fuel, fuelMax: cfg.s1fuel, eng: E1, n: cfg.engines },
      { dry: s2dry, fuel: cfg.s2fuel, fuelMax: cfg.s2fuel, eng: E2, n: 1 },
    ],
    cur: 0, payload: OPTS.payload[cfg.payload].m, fairing: 0.3, cdA: 3, q: 0, aoa: 0,
  };
}
export function massOf(v) {
  let m = v.payload + v.fairing;
  for (let i = v.cur; i < v.stages.length; i++) m += v.stages[i].dry + v.stages[i].fuel;
  return m;
}
export function rocketStats(cfg) {
  const v = buildRocket(cfg); const dv = [];
  let m0 = massOf(v);
  const s1 = v.stages[0], s2 = v.stages[1];
  dv.push(((s1.eng.ispSl + s1.eng.ispVac) / 2) * G0 * Math.log(m0 / (m0 - s1.fuel)));
  const m1 = m0 - s1.dry - s1.fuel;
  dv.push(s2.eng.ispVac * G0 * Math.log(m1 / (m1 - s2.fuel)));
  const twr = (s1.eng.tv * s1.n * s1.eng.ispSl / s1.eng.ispVac) / (m0 * G0);
  return { dv, total: dv[0] + dv[1], twr, mass: m0 };
}
export const pressure = h => (h < ATM ? Math.exp(-h / SCALE_H) : 0);
export const altOf = v => Math.hypot(v.x, v.y) - R;

// Advance one vehicle by dt. Returns null or an event string ('ground').
export function stepVehicle(v, dt) {
  const r = Math.hypot(v.x, v.y), h = r - R, ux = v.x / r, uy = v.y / r;
  const st = v.stages[v.cur];
  let m = massOf(v), thrust = 0;
  if (st && v.throttle > 0 && st.fuel > 0) {
    const p = pressure(h);
    const isp = st.eng.ispVac + (st.eng.ispSl - st.eng.ispVac) * p;
    const tv = st.eng.tv * st.n * v.throttle;
    thrust = tv * isp / st.eng.ispVac;
    st.fuel = Math.max(0, st.fuel - tv / (st.eng.ispVac * G0) * dt);
  }
  v.thrust = thrust;
  const nx = Math.cos(v.ang), ny = Math.sin(v.ang);
  const g = MU / (r * r);
  let ax = thrust / m * nx - g * ux, ay = thrust / m * ny - g * uy;
  const sp = Math.hypot(v.vx, v.vy);
  const rho = h < ATM ? RHO0 * Math.exp(-h / SCALE_H) : 0;
  v.q = 0.5 * rho * sp * sp / 1000; // kPa
  if (sp > 0.01) {
    const fd = v.q * v.cdA; // kN
    ax -= fd / m * v.vx / sp; ay -= fd / m * v.vy / sp;
    v.aoa = sp > 30 ? Math.abs(Math.atan2(Math.sin(v.ang - Math.atan2(v.vy, v.vx)), Math.cos(v.ang - Math.atan2(v.vy, v.vx)))) : 0;
  }
  if (v.clamped) {
    if (ax * ux + ay * uy <= 0) { v.vx = v.vy = 0; return null; }
    v.clamped = false;
  }
  v.vx += ax * dt; v.vy += ay * dt; v.x += v.vx * dt; v.y += v.vy * dt;
  if (Math.hypot(v.x, v.y) < R) return 'ground';
  return null;
}

export function orbitOf(v) {
  const r = Math.hypot(v.x, v.y), v2 = v.vx * v.vx + v.vy * v.vy;
  const E = v2 / 2 - MU / r, hmom = v.x * v.vy - v.y * v.vx;
  const rv = v.x * v.vx + v.y * v.vy;
  const ex = ((v2 - MU / r) * v.x - rv * v.vx) / MU, ey = ((v2 - MU / r) * v.y - rv * v.vy) / MU;
  const e = Math.hypot(ex, ey);
  const p = hmom * hmom / MU;
  const pe = p / (1 + e) - R;
  const ap = e < 1 ? p / (1 - e) - R : Infinity;
  return { e, ex, ey, p, ap, pe, E, a: -MU / (2 * E) };
}

// Simple autonomous booster: entry burn, then a throttled suicide burn onto the droneship.
export function boosterAutopilot(b) {
  const r = Math.hypot(b.x, b.y), h = r - R, ux = b.x / r, uy = b.y / r;
  const vr = b.vx * ux + b.vy * uy, sp = Math.hypot(b.vx, b.vy);
  const st = b.stages[0], g = MU / (r * r);
  b.ang = sp > 2 ? Math.atan2(-b.vy, -b.vx) : Math.atan2(uy, ux);
  if (vr > 0 || st.fuel <= 0) { b.throttle = 0; b.phase = st.fuel <= 0 ? 'no fuel' : 'coast'; return; }
  if (h < 42000 && h > 18000 && sp > 1150 && !b.landing) { b.n = 3 > b.nMax ? b.nMax : 3; b.throttle = 1; b.phase = 'entry burn'; return; }
  b.n = 1;
  const aMax = st.eng.tv * st.eng.ispSl / st.eng.ispVac / massOf(b);
  const vdes = Math.sqrt(2 * 0.6 * Math.max(aMax - g, 0.5) * Math.max(h - 1, 0)) + 1.5;
  if (h < 12000 && sp > vdes) {
    b.landing = true; b.phase = 'landing burn';
    b.throttle = Math.min(1, Math.max(0, (g + (sp - vdes) * 1.5) / aMax));
  } else { b.throttle = 0; b.phase = 'falling'; }
}
export function makeBooster(v) {
  const s = v.stages[0];
  return { x: v.x, y: v.y, vx: v.vx, vy: v.vy, ang: v.ang, throttle: 0, clamped: false,
    stages: [{ ...s }], cur: 0, payload: 0, fairing: 0, cdA: 14, q: 0, nMax: s.n, n: 1, phase: 'coast', state: 'flying' };
}

// Assisted steering (F): pitch program in the lower atmosphere, prograde above. Returns target nose angle.
export function assistAngle(v) {
  const r = Math.hypot(v.x, v.y), h = r - R, up = Math.atan2(v.y, v.x), sp = Math.hypot(v.vx, v.vy);
  const pg = sp > 5 ? Math.atan2(v.vy, v.vx) : up;
  if (h > 45000 || sp > 1800) return pg;
  const pitch = Math.min(1.45, Math.sqrt(Math.max(h - 400, 0) / 60000) * Math.PI / 2);
  const tgt = up - pitch;
  let d = Math.atan2(Math.sin(tgt - pg), Math.cos(tgt - pg));
  d = Math.max(-0.12, Math.min(0.12, d));
  return sp > 40 ? pg + d : tgt;
}
