// Per-part heating: a two-node (skin + interior) thermal model for every part in the stack.
//   skin:     cA dTs/dt = f q_s (T0 - Ts)/(T0 - 300) - eps sigma (Ts^4 - Tenv^4) - k (Ts - Ti)
//   interior: cI dTi/dt = k (Ts - Ti)                                    ("heat soak" into the structure)
// q_s is the stagnation-point heat flux (Sutton–Graves, bridged to free-molecular flow; aero.js) at the
// leading end of the stack. f is how much of it a part sees: the leading face (nose cone, or the heat shield
// when flying base-first) takes most of it, the sides see a little plus a crossflow term that grows with the
// angle of attack (the windward side), and parts in the wake of a wider shield are sheltered.
// The (T0 - Ts) factor is the hot-wall correction: a skin can't get hotter than the stagnation temperature,
// and convection cools a hot skin once the air is slow. Ablators hold their skin at the char temperature and
// burn away instead (heat of ablation Habl, J/kg) until the ablator mass is gone.
// A part whose skin passes Tmax fails. Units: K, W/m^2, J/(m^2 K), kg.
export const SIGMA = 5.670374419e-8;
export const T_SPACE = 250;  // K: effective radiative sink (Earth + deep space average)
// Defaults per part kind (overridden by a part's `heat` block in parts.js).
export const THERMAL_DEFAULTS = {
  pod:      { Tmax: 900, cA: 9000, eps: 0.7, k: 30, Tin: 520 },
  payload:  { Tmax: 700, cA: 8000, eps: 0.6, k: 30 },
  fairing:  { Tmax: 1150, cA: 9000, eps: 0.8, k: 5 },
  tank:     { Tmax: 850, cA: 8000, eps: 0.6, k: 30 },
  engine:   { Tmax: 1800, cA: 15000, eps: 0.8, k: 20 },
  decoupler:{ Tmax: 900, cA: 8000, eps: 0.6, k: 30 },
  rcs:      { Tmax: 900, cA: 8000, eps: 0.6, k: 30 },
  fins:     { Tmax: 1050, cA: 10000, eps: 0.7, k: 30 },
  chute:    { Tmax: 1000, cA: 9000, eps: 0.7, k: 20 },
  shield:   { Tmax: 1900, cA: 20000, eps: 0.88, k: 1.5 },
};
export const thermalOf = p => ({ ...(THERMAL_DEFAULTS[p.kind] || THERMAL_DEFAULTS.tank), ...(p.heat || {}) });
// Fraction of the stagnation heat flux each part receives, given the airflow in the body frame.
// list: stack parts bottom → top ({ kind, d, ... }); flowBody: unit wind direction in body axes (air moving
// past the craft; [0,-1,0] = flying nose-first). Returns an array of factors (same order as list).
export function exposure(list, flowBody) {
  const n = list.length, out = new Array(n).fill(0); if (!n) return out;
  const fa = flowBody[1], ca = Math.min(1, Math.abs(fa)), sa2 = Math.max(0, 1 - ca * ca);
  const stack = []; for (let i = 0; i < n; i++) if (list[i].kind !== 'fins') stack.push(i);
  if (!stack.length) stack.push(0);
  const lead = fa < 0 ? stack[stack.length - 1] : stack[0], L = list[lead];
  const shelter = L.kind === 'shield' && ca > 0.8 ? 0.25 + (1 - ca) * 3 : 1; // wake behind a wider heat shield
  for (let i = 0; i < n; i++) {
    const p = list[i];
    if (i === lead) out[i] = 0.75 * ca + 0.3 * sa2;
    else {
      let f = (p.kind === 'fins' ? 0.12 : 0.05) + 0.35 * sa2;   // sides: skin friction + windward crossflow
      if (L.d >= p.d - 0.05) f *= Math.min(1, shelter);
      out[i] = f;
    }
  }
  return out;
}
// Leading-end nose radius (m) for the stagnation heat flux: the nose when flying nose-first, the base
// (heat shield: a big blunt radius; engines: about one metre) when flying base-first.
export function leadingRadius(g, flowBody) {
  if (flowBody[1] < 0) return g.rn;
  return g.rnTail || 1;
}
// Initialise thermal state on every part of a vehicle (T in K). Idempotent.
export function initThermal(v, T = 300) {
  for (const s of v.stages) for (const p of s.parts) {
    if (p.Ts === undefined) { p.Ts = T; p.Ti = T; }
    if (p.abl === undefined) { const th = thermalOf(p); p.abl = th.abl || 0; p.abl0 = p.abl; }
  }
}
// Advance the thermal state of the attached stack by dt. qs: stagnation heat flux (W/m^2) at the leading end,
// T0: effective stagnation temperature (K), Tamb: ambient air temperature (K, radiative/convective sink when in
// air), rho: density. Returns { fail: part | null, hottest, maxFrac, ablating (kg/s), qIn (W/m^2 on the hottest) }.
export function stepThermal(v, g, qs, T0, Tamb, rho, flowBody, dt) {
  const parts = g.thermalList, fx = exposure(parts, flowBody);
  const Tenv = rho > 1e-6 ? Math.max(T_SPACE, Tamb) : T_SPACE, Thw = Math.max(T0, Tamb);
  let fail = null, failIn = false, hottest = null, maxFrac = 0, abl = 0;
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i], p = e.p, th = e.th, f = fx[i];
    // hot-wall convection: positive while Ts < T0, cooling once the skin is hotter than the recovery temperature
    const den = Math.max(Thw - 300, 60), qConv = qs * f * (Thw - p.Ts) / den;
    // a slow, dense airflow also cools (or warms) the skin toward the air temperature (natural/forced convection)
    const qAir = rho > 1e-4 ? 8 * Math.min(1, rho / 1.225) ** 0.5 * (Tamb - p.Ts) : 0;
    const qRad = th.eps * SIGMA * (p.Ts ** 4 - Tenv ** 4), qSoak = th.k * (p.Ts - p.Ti);
    let net = qConv + qAir - qRad - qSoak, Ts = p.Ts + net / th.cA * dt;
    if (th.Tabl && p.abl > 0 && Ts > th.Tabl) {
      // ablation: heat above the char temperature goes into burning the ablator away
      const area = Math.PI * e.d * e.d / 4, excess = (Ts - th.Tabl) * th.cA / dt; // W/m^2
      const dm = Math.min(p.abl * 1000, excess * area / th.Habl * dt);
      p.abl = Math.max(0, p.abl - dm / 1000); abl += dm / dt; Ts = th.Tabl;
    }
    // sub-stepping guard: never overshoot past radiative equilibrium in one step
    p.Ts = Math.max(Math.min(Ts, Math.max(p.Ts, Thw, Tamb) + 5), 3);
    p.Ti += th.k * (p.Ts - p.Ti) / (th.cA * 5) * dt;
    const frac = p.Ts / th.Tmax;
    if (frac > maxFrac) { maxFrac = frac; hottest = e; }
    if (!fail && p.Ts > th.Tmax) fail = e;
    if (!fail && th.Tin && p.Ti > th.Tin) { fail = e; failIn = true; }
  }
  return { fail, failIn, hottest, maxFrac, ablating: abl, exposure: fx };
}
// Summary for the HUD / effects: hottest parts, shield and ablator state.
export function thermalSummary(g) {
  const rows = g.thermalList.map(e => ({ id: e.p.id, kind: e.p.kind, T: e.p.Ts, Ti: e.p.Ti, Tmax: e.th.Tmax, frac: e.p.Ts / e.th.Tmax, abl: e.p.abl0 ? e.p.abl / e.p.abl0 : null }));
  rows.sort((a, b) => b.frac - a.frac);
  const sh = g.thermalList.find(e => e.p.kind === 'shield');
  return { rows, shield: sh ? { id: sh.p.id, T: sh.p.Ts, Tmax: sh.th.Tmax, abl: sh.p.abl0 ? sh.p.abl / sh.p.abl0 : null } : null };
}
