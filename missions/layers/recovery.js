// Pure booster-recovery layer for stages flight.js does not fly back itself (radial side boosters, a core
// stage above stage 0). At separation the stage snapshot (flight.js 'drop' hook, P.makeBooster) is flown
// headlessly with flight.js landingCheck (the same auto entry + hoverslam profile the droneship booster uses).
// RTLS adds an impulsive boostback (rocket equation on the stage's own propellant) aimed at the pad.
// Simplification noted for Game bot: the boostback is impulsive, and the side boosters fly as one body.
import * as P from '../../physics.js?v=f2';
import { landingCheck } from '../../flight.js?v=f2';
const V = P.V, G0 = 9.80665;
export const padAt = (padEf, clock, rot = true) => V.rotZ(V.scale(padEf, P.R), rot ? P.OMEGA_E * clock : 0);
const surf = (a, b) => P.R * Math.acos(Math.max(-1, Math.min(1, V.dot(V.norm(a), V.norm(b)))));
export function droneship(b) { const lc = landingCheck(b); return { mode: 'droneship', lands: !!lc.lands, speed: lc.speed, fuelLeft: lc.fuelLeft }; }
export function rtls(b, padEf) {
  const s = b.stages[0], isp = (s.eng && (s.eng.ispSl || s.eng.ispVac)) || 290, up = V.norm(b.r), vh = V.sub(b.v, V.scale(up, V.dot(b.v, up)));
  const dir = V.norm(vh), spd = V.len(vh);
  const fly = k => { // k: new horizontal speed as a fraction of the old one (negative = flying back)
    const dvv = V.scale(dir, (k - 1) * spd), dv = V.len(dvv), m = s.dry + s.fuel, used = m * (1 - Math.exp(-dv / (isp * G0)));
    if (used >= s.fuel - 0.3) return { ok: false, err: Infinity };
    const bb = { ...b, v: V.add(b.v, dvv), stages: [{ ...s, fuel: s.fuel - used }] }, lc = landingCheck(bb);
    if (!lc.r) return { ok: false, err: Infinity, lc };
    const pad = padAt(padEf, lc.clock, b.earthRot !== false), miss = V.sub(lc.r, pad);
    return { ok: true, lc, dist: surf(lc.r, pad), err: V.dot(miss, dir), used };
  };
  let lo = -1.2, hi = 1, best = null;
  for (let i = 0; i < 16; i++) { const k = (lo + hi) / 2, r = fly(k); if (!r.ok) { lo = k; continue; } if (!best || r.dist < best.dist) best = { ...r, k }; if (r.err > 0) hi = k; else lo = k; }
  if (!best) return { mode: 'rtls', lands: false, distM: Infinity };
  return { mode: 'rtls', lands: !!best.lc.lands, distM: best.dist, speed: best.lc.speed, boostbackT: best.used };
}
