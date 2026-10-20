// AUTO guidance at full scale and the booster landing autopilot.
// AUTO ascent: vertical rise, pitch kick, gravity turn that stays near air-relative prograde while the
// dynamic pressure is high (Max-Q throttling), a pitch program toward the horizontal, then coast to
// apoapsis and a circularization burn. Phases on v.guid: ascent -> coast -> circ -> done.
import { R_E, MU_E, KARMAN } from './constants.js?v=f3';
import { add, sub, scale, dot, cross, len, norm, clamp } from './vec.js?v=f3';
import { elements, timeToAp } from './kepler.js?v=f3';
import { airVel, stepPoint, muOf, radOf } from './dynamics.js?v=f3';
import { massOf } from './vehicle.js?v=f3';
import { atmosphere } from './atmosphere.js?v=f3';
import { cd0 } from './aero.js?v=f3';
import { hoverslamSolve } from './hoverslam.js?v=f3';
import { sampleAscent } from '../timelines/ascent.js?v=f4';
export const TARGET_AP = 185000;   // m: AUTO ascent cuts off once apoapsis reaches this
export const TARGET_PE = 150000;   // m: AUTO circularizes until periapsis is above this
export const ORBIT_PE = 130000;    // m: periapsis needed to count as a (lasting) orbit
export const FAIRING_ALT = 100000; // m: the fairing can go above the Kármán line…
export const FAIRING_QDOT = 1135;   // W/m^2: …once the heating on the bare payload would be under ~1.1 kW/m² (the real-world rule)
export const FAIRING_ALT_MAX = 140000; // m: …and always by this altitude
const wrapA = x => Math.atan2(Math.sin(x), Math.cos(x));
export const eastOf = r => { const up = norm(r), e = cross([0, 0, 1], up); return len(e) > 1e-6 ? norm(e) : [0, 1, 0]; };
// Local frame for the trajectory plane: up (radial) and the horizontal direction of travel.
export function localFrame(v) {
  const up = norm(v.r), vh = add(v.v, scale(up, -dot(v.v, up)));
  return { up, hd: len(vh) > 30 ? norm(vh) : eastOf(v.r) };
}
export const pitchOfVec = (vec, f) => Math.atan2(dot(vec, f.hd), dot(vec, f.up)); // from vertical, toward hd
export const dirOfPitch = (p, f) => norm(add(scale(f.up, Math.cos(p)), scale(f.hd, Math.sin(p))));
export const thrustAccel = v => { const s = v.stages[v.cur]; return s && s.fuel > 0 && s.eng ? s.eng.tv * 1000 * s.n / (massOf(v) * 1000) : 0; };
export function circBurn(v) {
  const o = elements(v.r, v.v, muOf(v), radOf(v)); if (!isFinite(o.ra)) return { dv: 0, tb: 0 };
  const dv = Math.max(0, Math.sqrt(muOf(v) / o.ra) - o.hm / o.ra), a = thrustAccel(v);
  return { dv, tb: a > 0 ? dv / a : Infinity };
}
function holdPitch(v, f, vrDes, k, cosMax = 0.999) {
  const r = len(v.r), vr = dot(v.v, f.up), vh = len(add(v.v, scale(f.up, -vr))), aT = thrustAccel(v) * Math.max(v.throttle || 1, 0.3), g = muOf(v) / (r * r);
  if (aT <= 0) return Math.PI / 2;
  return Math.acos(clamp((g - vh * vh / r + (vrDes - vr) * k) / aT, -0.3, cosMax));
}
export const G_LIMIT = 4.5; // g: AUTO throttles down to keep acceleration under this
// Time to burn dv with the current and later stages (vacuum; Infinity if the fuel is not there).
export function burnTimeFor(v, dv) {
  let m = massOf(v) * 1000, t = 0, left = dv;
  for (let i = v.cur; i < v.stages.length && left > 0; i++) {
    const s = v.stages[i]; if (!(s.fuel > 0 && s.eng && s.eng.tv > 0)) { m -= (s.dry + s.fuel) * 1000; continue; }
    const ve = s.eng.ispVac * 9.80665, mdot = s.eng.tv * 1000 * s.n / ve, mf = s.fuel * 1000, dvS = ve * Math.log(m / (m - mf));
    if (left <= dvS) return t + m * (1 - Math.exp(-left / ve)) / mdot;
    t += mf / mdot; left -= dvS; m -= (s.dry + s.fuel) * 1000;
  }
  return left > 0 ? t * 1.5 + 300 : t;
}
export const qCap = (qPa, floor = 0.4) => clamp(1 - (qPa - 28000) / 8000, floor, 1); // floor: optional per-vehicle v.qFloor (additive)
// Returns { dir (world unit vector), throttle, phase }.
// Launch heading for a target inclination (v.incl, deg): rotating-frame azimuth from the current latitude.
export function azimuthHd(v) {
  const up = norm(v.r), east = eastOf(v.r), north = cross(up, east), lat = Math.asin(clamp(up[2], -1, 1)), i = v.incl * Math.PI / 180;
  const sA = clamp(Math.cos(i) / Math.max(1e-6, Math.cos(lat)), -1, 1), A = Math.asin(sA), vEq = v.earthRot === false ? 0 : 465.1 * Math.cos(lat);
  const Ar = Math.atan2(7800 * Math.sin(A) - vEq, 7800 * Math.cos(A)); return norm(add(scale(north, Math.cos(Ar)), scale(east, Math.sin(Ar))));
}
export function autoGuide(v) {
  const f = localFrame(v);
  if (v.incl && (v.guid || 'ascent') === 'ascent' && len(v.r) - R_E < 120000) { // fly the launch azimuth, blending into the velocity heading high up
    const az = azimuthHd(v), up = f.up, vh = add(v.v, scale(up, -dot(v.v, up))), k = clamp((len(vh) - 2500) / 4500, 0, 1);
    f.hd = len(vh) > 30 ? norm(add(scale(az, 1 - k), scale(norm(vh), k))) : az;
  }
  const r = len(v.r), h = r - R_E, o = elements(v.r, v.v), vr = dot(v.v, f.up);
  const va = airVel(v), spAir = len(va), qPa = v.tel ? v.tel.q : 0;
  const pgAir = spAir > 5 ? pitchOfVec(va, f) : 0, pgIn = pitchOfVec(v.v, f);
  const blend = clamp((h - 40000) / 30000, 0, 1), pg = pgAir + wrapA(pgIn - pgAir) * blend;
  let ph = v.guid || 'ascent';
  if (o.pe >= TARGET_PE && h > KARMAN) ph = 'done';
  else if (ph === 'done') ph = o.ap >= TARGET_AP - 3000 ? 'coast' : 'ascent';
  if (ph === 'ascent' && h > 5000 && o.ap >= TARGET_AP - 1000) { // coast only if the circularization burn fits before apoapsis
    const tAp = timeToAp(v.r, v.v), tb = burnTimeFor(v, circBurn(v).dv);
    if (tb * 0.5 + 15 < tAp) ph = 'coast';
  }
  if (ph === 'coast') {
    const tb = burnTimeFor(v, circBurn(v).dv), tAp = timeToAp(v.r, v.v);
    if (h < KARMAN - 5000 && o.ap < TARGET_AP - 3000) ph = 'ascent';
    else if (vr < 0 || tAp <= tb * 0.5 + 5) ph = 'circ';
  }
  v.guid = ph;
  let pitch, thr;
  const s = v.stages[v.cur], m = massOf(v) * 1000, g = muOf(v) / (r * r);
  if (ph === 'ascent') {
    if (spAir < 70) pitch = clamp((h - 150) / 4000, 0, 0.04);
    else {
      // gravity-turn pitch program, kept close to air-relative prograde while the dynamic pressure is high
      // low-TWR rockets turn more slowly (a gravity turn droops faster when thrust barely beats weight)
      const st0 = v.stages[v.cur], twr = st0 && st0.eng ? st0.eng.tv * 1000 * st0.n / (massOf(v) * 1000 * g) : 1;
      const H = 95000 * clamp((2.2) / twr, 1, 3);
      const prog = Math.min(1.5, Math.sqrt(Math.max(h - 500, 0) / H) * Math.PI / 2);
      // pitching over (down) is limited tightly at high Q; pitching back up (to stop a droop) a little less
      const lim = qPa > 20000 ? 0.03 : qPa > 5000 ? 0.06 : qPa > 1000 ? 0.12 : 0.35, limUp = Math.max(lim, qPa > 20000 ? 0.06 : 0.1);
      pitch = pg + clamp(wrapA(prog - pg), -limUp, lim);
      if (h > 2000) {
        // floor: keep a minimum time-to-apoapsis (don't flatten out early, important for low-TWR upper stages)
        const tFloor = Math.max(0, Math.min(60, 15 + h / 1500, (TARGET_AP - h) / 1500));
        // cap: never climb faster than what coasts up to the target apoapsis (no lofting)
        const vh = len(add(v.v, scale(f.up, -vr))), gEff = Math.max(g - vh * vh / r, 0.5), vrCap = Math.sqrt(2 * gEff * Math.max(TARGET_AP - h, 0));
        // in vacuum a weak upper stage that can't hold the floor still leans downrange (building speed beats hovering)
        const cosMax = qPa < 1000 && v.cur > 0 ? 0.75 : 0.999;
        pitch = Math.min(pitch, holdPitch(v, f, Math.min(g * tFloor, vrCap), 0.06, cosMax));
        if (qPa < 5000) pitch = Math.max(pitch, holdPitch(v, f, vrCap, 0.06));
      }
    }
    const tMax = s && s.eng ? s.eng.tv * 1000 * s.n : 0;
    thr = Math.max(qCap(qPa, v.qFloor ?? 0.4), tMax > 0 ? Math.min(1, 1.3 * g * m / tMax) : 1);
    if (tMax > 0) thr = Math.min(thr, G_LIMIT * 9.80665 * m / tMax); // g-limit: throttle back near burnout
    // optional data table (timelines/ascent.js): stage-1 pitch/throttle vs time since liftoff (v.ascentMet), additive
    const tab = v.ascentTable && v.cur === 0 && v.ascentMet != null ? sampleAscent(v.ascentTable, v.ascentMet) : null;
    if (tab) { pitch = tab.pitch; thr = tMax > 0 ? Math.min(tab.throttle, G_LIMIT * 9.80665 * m / tMax) : tab.throttle; }
  } else if (ph === 'coast' || ph === 'done') { pitch = pgIn; thr = 0; }
  else { pitch = holdPitch(v, f, 0, 0.05); thr = 1; }
  const lim2 = qPa > 15000 ? 0.08 : qPa > 3000 ? 0.2 : qPa > 500 ? 0.5 : 1.4;
  pitch = clamp(pitch, pgAir - lim2, pgAir + lim2);
  pitch = clamp(pitch, 0, Math.PI * 0.75);
  return { dir: dirOfPitch(pitch, f), throttle: thr, phase: ph, pitch };
}
// ---------- booster (3-DOF) autopilot: live-state entry burn → aero coast → hoverslam ----------
// Entry burn: every 0.5 s a cheap drag-only coast prediction from the live state gives the peak dynamic pressure and
// peak (Sutton–Graves) heating still ahead; the 3-engine burn runs only while either would exceed its safe limit
// (with a 10% margin), so a nominal path may skip it and a steep / fast / off-target one gets just enough.
export const ENTRY_Q_MAX = 35;        // kPa peak dynamic pressure down to ENTRY_FLOOR (below it the drag-limited fall is the same either way)
export const ENTRY_FLOOR = 20000;     // m: the entry corridor the burn protects
export const ENTRY_QDOT_MAX = 1.0e5;  // W/m² peak stagnation heating (≈ the 1.7 km/s @ 30 km burn-up line, with margin)
export const sgHeat = (rho, V) => 1.74e-4 * Math.sqrt(Math.max(rho, 0)) * V * V * V;
export function predictEntryPeaks(b, dtMax = 1) {
  const c = { ...b, r: [...b.r], v: [...b.v], stages: b.stages.map(s => ({ ...s })), throttle: 0 };
  let q = 0, qdot = 0;
  for (let i = 0; i < 1500; i++) {
    const h = len(c.r) - R_E; if (h < ENTRY_FLOOR) break;
    const va = airVel(c, c.r, c.v); c.dir = scale(va, -1 / Math.max(len(va), 1));
    if (stepPoint(c, h > 40000 ? dtMax : 0.25)) break;
    const hh = len(c.r) - R_E, rho = atmosphere(Math.max(hh, 0)).rho, V = len(airVel(c, c.r, c.v));
    q = Math.max(q, 0.5 * rho * V * V / 1000); qdot = Math.max(qdot, sgHeat(rho, V));
  }
  return { q, qdot };
}
export function boosterAutopilot(b, dtHint = 0.02) {
  const up = norm(b.r), h = len(b.r) - R_E, va = airVel(b, b.r, b.v), sp = len(va), vr = dot(va, up);
  const s = b.stages[0], g = muOf(b) / dot(b.r, b.r), deck = b.deck ?? 0;
  if (!b.manual) b.dir = sp > 2 ? scale(va, -1 / sp) : up;
  if (vr > 0 || s.fuel <= 0) { b.throttle = 0; if (b.tgtR) b.fin = null; b.phase = s.fuel <= 0 ? 'no fuel' : 'coast'; return; }
  // f4 terminal guidance toward b.tgtR (ECI point on the surface/deck, set by flight.js every step)
  const tg = b.tgtR ? horizErr(b, up) : null; b.tgtErr = tg ? len(tg.d) : null;
  if (tg && h < 30000 && !b._hs) { // grid-fin glide: steer the predicted impact onto the target
    b._gT = (b._gT ?? 0) - dtHint;
    if (b._gT <= 0) { b._gT = 0.4; const im = predictImpact(b); if (im) { const e = sub(b.tgtAt ? b.tgtAt(im.t) : b.tgtR, im.r), eh = sub(e, scale(up, dot(e, up))); b._finV = scale(eh, 1 / Math.max(2500, len(eh))); b.impErr = len(eh); } }
    b.fin = b._finV || null;
  } else if (b.tgtR) b.fin = null;
  // (1) entry burn, decided from the live predicted peaks
  if (!b.entryDone && h < 90000 && h > 25000 && vr < -150) {
    b._eT = (b._eT ?? 0) - dtHint;
    if (b._eT <= 0) { b._eT = 0.5; const pk = predictEntryPeaks(b); b.entryPeak = pk;
      b._eNeed = pk.q > ENTRY_Q_MAX * 0.9 || pk.qdot > ENTRY_QDOT_MAX * 0.9; }
    const sE = b.stages[0], mE = (sE.dry + sE.fuel) * 1000, aE = sE.eng.tv * 1000 / mE, gE = muOf(b) / dot(b.r, b.r);
    const keep = sE.dry * (Math.exp(Math.max(0, 1.6 * Math.sqrt(2 * gE * 0) + 600) / (sE.eng.ispSl * 9.80665)) - 1); // ~600 m/s landing-burn budget
    if (b._eNeed && sE.fuel > keep * 1.1) { b.n = Math.min(3, b.nMax); b.throttle = 1; b.phase = 'entry burn'; b.entryBurned = (b.entryBurned || 0) + dtHint; return; }
    if (b.entryBurned) b.entryDone = true;
  }
  if (h <= 25000) b.entryDone = true;
  // (3) hoverslam, recomputed every frame
  const atm = atmosphere(Math.max(h, 0)), pr = Math.min(1, atm.p / 101325), m = (s.dry + s.fuel) * 1000 + (b.extra || 0) * 1000;
  const isp = s.eng.ispVac - (s.eng.ispVac - s.eng.ispSl) * pr, T1 = s.eng.tv * 1000 * isp / s.eng.ispVac;
  const qd = 0.5 * atm.rho * sp * sp, aDrag = qd * (b.cdA || 0) * cd0(sp / atm.a) / m * 0.5; // count half the current drag: it fades as the burn slows the booster
  const vDown = vr < 0 ? (b.tgtR && !b.manual ? -vr : sp) : 0, hp = h - deck; // retro thrust kills the whole air-relative velocity
  const pick = n => hoverslamSolve({ h: hp, vDown, m, Tmax: T1 * n, thrMin: 0.4, g, aDrag, burning: !!b._hs, lit: b.ignAlt != null });
  let n = b._hs ? b.n : 1, sol = pick(n);
  if (!b._hs && (sol.lowTWR || sol.dStop > 0.8 * hp) && b.nMax > 1) { const s3 = pick(Math.min(3, b.nMax)); if (s3.ignite || sol.lowTWR) { n = Math.min(3, b.nMax); sol = s3; } }
  // late in a 3-engine burn drop to the centre engine once one engine can finish it at ≤ THR_AIM
  if (b._hs && n > 1) { const s1 = hoverslamSolve({ h: hp, vDown, m, Tmax: T1, thrMin: 0.4, g, aDrag, burning: true, lit: true }); if (s1.aReq < s1.aMax * 0.85) { n = 1; sol = s1; } }
  b.hs = sol; b.burnIn = sol.ignite ? 0 : sol.tIgn; b.lowTWR = sol.lowTWR; if (sol.legs) b.legs = true;
  if (sol.ignite && sol.throttle > 0 && (b.entryDone || h < 25000)) {
    if (!b._hs) { b._hs = true; if (b.ignAlt == null) { b.ignAlt = hp; b.ignV = vDown; } }
    b.landing = true; b.n = n; b.throttle = sol.throttle; b.phase = sol.lowTWR ? 'controlled descent (low TWR)' : 'landing burn';
    if (tg && !b.manual && sp > 2) { // divert: ZEM/ZEV lateral acceleration, folded into the thrust direction (tilt ≤ 20°)
      const tgo = Math.max(1.5, 2 * Math.max(hp, 1) / Math.max(vDown, 3)), vh = sub(va, scale(up, dot(va, up)));
      const aH = sub(scale(tg.d, 6 / (tgo * tgo)), scale(vh, 4 / tgo)), aT = Math.max(1, T1 * n * b.throttle / m), k = Math.min(len(aH) / aT, 0.36);
      const retro = scale(va, -1 / sp), hd = len(aH) > 1e-6 ? scale(aH, k / len(aH)) : [0, 0, 0]; b.dir = norm(add(retro, hd)); }
  } else { b._hs = false; b.n = 1; b.throttle = 0; b.phase = b.ignAlt != null && hp < 5 ? 'touchdown' : (h > 25000 ? 'coast' : 'grid-fin glide'); }
}
function horizErr(b, up) { const e = sub(b.tgtR, b.r); return { d: sub(e, scale(up, dot(e, up))) }; }
// Ballistic impact (drag, no thrust). Returns { r (ECI), t (clock at impact) } or null.
export function predictImpact(b) {
  const c = { ...b, r: [...b.r], v: [...b.v], stages: b.stages.map(s => ({ ...s })), throttle: 0 };
  for (let i = 0; i < 6000; i++) { const h = len(c.r) - R_E, dt = h > 30000 ? 0.5 : 0.2; if (stepPoint(c, dt)) return { r: c.r, t: c.clock }; }
  return null;
}
