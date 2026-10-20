// Ideal rocket-equation Δv and payload solver for vehicles/catalog.js. See spec:vehicles-model for the rationale.
// Model (EST): LEO needs LEO_DV_INERTIAL of ideal Δv (orbital speed + gravity/drag/steering losses) minus the
// eastward Earth-rotation credit at the site latitude; first-stage Isp = SL + FIRST_W·(vac−SL); the fairing drops
// when the upper stage lights; each stage holds back its recovery reserve (that propellant is carried, not burned).
import { ENGINES } from './catalog.js';
import { G0 } from '../physics/constants.js';
export const LEO_DV_INERTIAL = 9300, EQ_ROT = 465.1, FIRST_W = 0.7;
export const leoDv = v => LEO_DV_INERTIAL - EQ_ROT * Math.cos(v.lat * Math.PI / 180);
function stageIsp(st, first) {
  let thr = 0, flow = 0;
  for (const [id, n] of Object.entries(st.engines)) {
    const e = ENGINES[id], tv = (st.tVacOverride || e.tVac) * n, isl = st.ispOverride?.[0] || e.ispSl, iv = st.ispOverride?.[1] || e.ispVac;
    thr += tv; flow += tv / (first && isl ? isl + FIRST_W * (iv - isl) : iv);
  }
  return thr / flow;
}
export function deltaV(v, payload, reserve = []) {
  const S = v.stages, last = S.length - 1;
  let m = S.reduce((t, s) => t + s.dry + s.prop, 0) + payload + (v.fairing || 0), dv = 0, coreUsed = 0;
  for (let i = 0; i < S.length; i++) {
    const st = S[i], first = i === 0 || S[i - 1].parallel;
    if (i === last && v.fairing) m -= v.fairing;
    if (st.parallel) {
      const core = S[i + 1].prop * st.coreFrac, burn = st.prop - (reserve[i] || 0);
      const isp = (stageIsp(st, true) * burn + stageIsp(S[i + 1], true) * core) / (burn + core);
      dv += isp * G0 * Math.log(m / (m - burn - core)); m -= st.dry + st.prop + core; coreUsed = core; continue;
    }
    const left = st.prop - coreUsed, burn = left - (reserve[i] || 0); coreUsed = 0;
    dv += stageIsp(st, first) * G0 * Math.log(m / (m - burn)); m -= st.dry + left;
  }
  return dv;
}
export function payloadToLEO(v, reserve = [], target = leoDv(v)) {
  if (deltaV(v, 0, reserve) < target) return 0; let lo = 0, hi = 5e5;
  for (let k = 0; k < 60; k++) { const p = (lo + hi) / 2; deltaV(v, p, reserve) >= target ? (lo = p) : (hi = p); }
  return lo;
}
