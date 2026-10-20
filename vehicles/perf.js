// Ideal (rocket-equation) delta-v and payload solver for vehicles/catalog.js. First stage uses mean of SL/vac Isp.
import { ENGINES } from './catalog.js';
export const G0 = 9.80665;
// First-stage effective Isp = SL + FIRST_W·(vac−SL): most of the burn is above the dense air (EST).
export const FIRST_W = 0.7;
export const LEO_DV = 9300; // m/s ideal Δv to ~200 km LEO incl. losses (EST; repo parts.js uses 9400)
function stageIsp(st, first) {
  let thr = 0, flow = 0;
  for (const [id, n] of Object.entries(st.engines)) {
    const e = ENGINES[id], tv = (st.tVacOverride || e.tVac) * n, isl = st.ispOverride?.[0] || e.ispSl, iv = st.ispOverride?.[1] || e.ispVac;
    const isp = first && isl ? isl + FIRST_W * (iv - isl) : iv; thr += tv; flow += tv / isp;
  }
  return thr / flow;
}
export function deltaV(v, payload = v.payloadLEO) {
  const S = v.stages; let m = S.reduce((t, s) => t + s.dry + s.prop, 0) + payload + (v.fairing || 0), dv = 0, coreUsed = 0;
  for (let i = 0; i < S.length; i++) {
    const st = S[i], first = i === 0 || S[i - 1].parallel;
    if (st.parallel) { const core = S[i + 1].prop * st.coreFrac, burn = st.prop - (st.reserve || 0);
      const isp = (stageIsp(st, true) * burn + stageIsp(S[i + 1], true) * core) / (burn + core);
      dv += isp * G0 * Math.log(m / (m - burn - core)); m -= st.prop + st.dry + core; coreUsed = core; continue; }
    const left = st.prop - coreUsed, burn = left - (st.reserve || 0); coreUsed = 0;
    dv += stageIsp(st, first) * G0 * Math.log(m / (m - burn));
    m -= st.dry + left; // drop the spent stage (incl. landing reserve); fairing rides to orbit (conservative)
  }
  return dv;
}
// Largest payload whose ideal Δv still reaches LEO_DV (bisection).
export function payloadToLEO(v, target = LEO_DV) {
  let lo = 0, hi = 400000; if (deltaV(v, 0) < target) return 0;
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; deltaV(v, m) >= target ? (lo = m) : (hi = m); }
  return lo;
}
export const liftoffMass = v => v.stages.reduce((t, s) => t + s.dry + s.prop, 0) + v.payloadLEO + (v.fairing || 0) + 0;
