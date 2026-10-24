// AUTO guidance at full scale and the booster landing autopilot.
// AUTO ascent: vertical rise, pitch kick, gravity turn that stays near air-relative prograde while the
// dynamic pressure is high (Max-Q throttling), a pitch program toward the horizontal, then coast to
// apoapsis and a circularization burn. Phases on v.guid: ascent -> coast -> circ -> done.
import { R_E, MU_E, KARMAN } from './constants.js?v=f5.8j';
import { add, sub, scale, dot, cross, len, norm, clamp } from './vec.js?v=f5.8j';
import { elements, timeToAp } from './kepler.js?v=f5.8j';
import { airVel, stepPoint, muOf, radOf } from './dynamics.js?v=f5.8j';
import { massOf } from './vehicle.js?v=f5.8j';
import { thermalOf } from './thermal.js?v=f5.8j';
import { atmosphere } from './atmosphere.js?v=f5.8j';
import { cd0 } from './aero.js?v=f5.8j';
import { hoverslamSolve } from './hoverslam.js?v=f5.8j';
import { sampleAscent } from '../timelines/ascent.js?v=f5.8j';
import { BODIES, atmTop } from './solar.js?v=f5.8j';
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
// f5.4 off-Earth ascent (sandbox launch from any world): climb-rate hold up to a low circular orbit above the
// atmosphere (or terrain), coast to apoapsis, circularize. Targets scale with the body.
export function offTargets(id) { const b = BODIES[id], floor = b.atm ? atmTop(id) : Math.max(5000, b.R * 0.005);
  const pe = Math.max(floor + 5000, b.atm ? 0 : 15000), ap = pe + Math.max(5000, pe * 0.1); return { floor, pe, ap }; }
function offGuide(v) {
  const f = localFrame(v), b = BODIES[v.body], r = len(v.r), h = r - b.R, o = elements(v.r, v.v, muOf(v), b.R), vr = dot(v.v, f.up), T = offTargets(v.body);
  const s = v.stages[v.cur], m = massOf(v) * 1000, g = muOf(v) / (r * r), tMax = s && s.eng ? s.eng.tv * 1000 * s.n : 0;
  const va = airVel(v), qPa = v.tel ? v.tel.q : 0;
  let ph = v.guid || 'ascent';
  if (o.pe >= T.pe && o.e < 1) ph = 'done';
  else if (ph === 'done') ph = 'ascent';
  if (ph === 'ascent' && o.ap >= T.ap) ph = 'coast';
  if (ph === 'coast') { const tAp = timeToAp(v.r, v.v, muOf(v)), tb = burnTimeFor(v, circBurn(v).dv); if (o.ap < T.ap - Math.max(2000, T.ap * 0.05) && vr > 0 && h < T.floor) ph = 'ascent'; else if (vr < 0 || tAp <= tb * 0.5 + 3) ph = 'circ'; }
  v.guid = ph; let pitch, thr = 1;
  if (ph === 'ascent') {
    if (h < Math.min(1500, T.pe * 0.05) && len(va) < 60) pitch = 0.02;
    else { const vh = len(add(v.v, scale(f.up, -vr))), gEff = Math.max(g - vh * vh / r, 0.05 * g), vrCap = Math.sqrt(2 * gEff * Math.max(T.ap - h, 0));
      const want = Math.min(vrCap, Math.max(30, Math.sqrt(2 * g * Math.max(T.ap - h, 0)) * 0.6)); pitch = holdPitch(v, f, want, 0.06, 0.999);
      if (qPa > 15000) pitch = clamp(pitch, pitchOfVec(va, f) - 0.1, pitchOfVec(va, f) + 0.1); }
    if (tMax > 0) thr = Math.min(1, G_LIMIT * 9.80665 * m / tMax, Math.max(qCap(qPa, 0.4), 1.3 * g * m / tMax));
  } else if (ph === 'coast' || ph === 'done') { pitch = pitchOfVec(v.v, f); thr = 0; }
  else { pitch = holdPitch(v, f, 0, 0.05); if (tMax > 0) thr = Math.min(1, G_LIMIT * 9.80665 * m / tMax); }
  pitch = clamp(pitch, 0, Math.PI * 0.75);
  return { dir: dirOfPitch(pitch, f), throttle: thr, phase: ph, pitch };
}
export const HOT_K = 0.8; // fx-ng: share of a part's skin limit that makes the ascent climb out of the air
export const GLIDE = { on: true, k: 0.15, c: 0.5, margin: 1.45, hMax: 150000 }; // f5.7d: weak-upper climb profile (see ascent)
export const LOFT = { twr: 1.3, a: 120, b: 0.018, h1: 90000, taper: 25000 }; // fx-ng: low-TWR first-stage climb-rate floor (m/s = a + b·h)
export function autoGuide(v) {
  if (v.body && v.body !== 'earth') return offGuide(v);
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
  if (o.pe >= TARGET_PE && h > KARMAN) ph = ph === 'circ' && o.ap < TARGET_AP - 8000 ? 'raise' : ph === 'raise' ? 'raise' : 'done'; // fx-site: circularized low → raise Ap to the target
  else if (ph === 'done') ph = o.ap >= TARGET_AP - 3000 ? 'coast' : 'ascent';
  // fx-site: a weak upper stage that topped out at the target apoapsis too slow sinks while it circularizes and can end up
  // circular BELOW the target perigee (~150 km); its perigee can't pass its own altitude, so it used to burn on to an escape
  // orbit (Ap ~40,000 km from the higher-latitude pads). Once it is in orbit there, raise the apoapsis and circularize again.
  if (ph === 'circ' && h > KARMAN + 20000 && o.pe >= Math.min(TARGET_PE, h - 3000)) ph = o.ap < TARGET_AP - 8000 ? 'raise' : 'done';
  if (ph === 'raise' && o.ap >= TARGET_AP) ph = 'coast';
  // direct insertion (v.direct): the upper stage burns straight through to orbit (one long burn, no coast-then-circularize),
  // as the real two-stage flights do; SECO lands at insertion instead of after a half-orbit coast
  if (v.direct && v.cur > 0 && ph === 'ascent' && h > KARMAN - 20000 && o.ap >= TARGET_AP - 1000) ph = 'insert';
  if (ph === 'insert' && o.ap < TARGET_AP - 20000 && o.pe < 0) ph = 'ascent';
  if (!v.direct && ph === 'insert') ph = 'ascent';
  if (ph === 'ascent' && h > 5000 && o.ap >= TARGET_AP - 1000) { // coast only if the circularization burn fits before apoapsis
    const tAp = timeToAp(v.r, v.v), tb = burnTimeFor(v, circBurn(v).dv);
    if (tb * 0.5 + 15 < tAp) ph = 'coast';
  }
  if (ph === 'coast') {
    const tb = burnTimeFor(v, circBurn(v).dv), tAp = timeToAp(v.r, v.v);
    if (h < KARMAN - 5000 && o.ap < TARGET_AP - 3000) ph = 'ascent';
    else if ((vr < 0 && h > TARGET_AP - 15000) || tAp <= tb * 0.5 + 5) ph = 'circ';
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
        const lowSag = v.cur > 0 && vr < 0 && h < 120000, cosMax = qPa < 1000 && v.cur > 0 && !lowSag ? 0.75 : 0.999; // f5.6u (QA P1 re-AUTO): a weak upper stage sinking below 120 km may pitch up to hold altitude (it fell back into the air after a manual detour)
        // f4: a vacuum upper stage past the target apoapsis may sag (down to ~160 km) instead of hovering against gravity
        const weak = v.cur > 0 && s && s.eng && s.eng.tv * 1000 * s.n < 1.1 * g * m, sag = weak && qPa < 1000 && o.ap >= TARGET_AP - 1000 ? -0.6 * Math.sqrt(2 * gEff * Math.max(h - (TARGET_PE + 10000), 0)) : 0;
        pitch = Math.min(pitch, holdPitch(v, f, sag || Math.min(g * tFloor, vrCap), 0.06, cosMax));
        if (qPa < 5000) pitch = Math.max(pitch, holdPitch(v, f, sag || vrCap, 0.06));
        if (weak && qPa < 1000 && o.ap >= TARGET_AP - 1000) pitch = holdPitch(v, f, sag, 0.06); // lofted hand-back: may pitch below the horizon to stop the climb (f4)
        if (weak && qPa < 1000 && h > 40000 && GLIDE.on && !v.noGlide && v.cur === v.stages.length - 1) { // f5.7d (QA f5.6x AUTO lob 184 → 108 km): a weak upper stage aims to top out at the target apoapsis about when it reaches orbital speed (gravity minus centrifugal fades to 0 over the burn), instead of topping out early and falling back ~80 km with the engine lit
          const dvLeft = Math.max(0, Math.sqrt(muOf(v) / r) - vh), ve = s.eng.ispVac * 9.80665, mK = m, dvS = s.fuel > 0 ? ve * Math.log(mK / Math.max(1, mK - s.fuel * 1000)) : 0, tbL = Math.max(10, burnTimeFor(v, dvLeft)), vrDes = Math.min(vrCap * GLIDE.c, (TARGET_AP - h) / tbL + GLIDE.k * gEff * tbL);
          if (dvS > dvLeft * GLIDE.margin && (v._glide || h < GLIDE.hMax)) { v._glide = true; pitch = holdPitch(v, f, vrDes, 0.06); } } // f5.7h: margin 1.45 so re-AUTO after a navball detour (QA: 169 → 154 km) still glides; it must start below hMax (a third stage lit at 175 km keeps the classic profile) // only with Δv to spare: the gentler climb costs some gravity loss (Deltoid-3 / GTO stages run tight)
      }
    }
    // heavy pitch program: side boosters (radial stage) lift the whole stack at TWR ~1.1-1.4, so a plain gravity turn droops
    // flat inside the atmosphere and the dynamic pressure runs away (Max-Q failure ~16 km). Hold a climb-rate floor instead
    // so the boosters separate steep and high, like the real three-core flights.
    // the lone core after side-booster sep keeps the floor (tapering out by 50 km) so it climbs out of the dense air before turning
    if (v.stages[0] && v.stages[0].radial && spAir >= 70 && h < 50000) pitch = Math.min(pitch, holdPitch(v, f, (120 + h * 0.012) * clamp((50000 - h) / 15000, 0, 1), 0.08));
    // fx-ng: a low-TWR single-core first stage that keeps a landing reserve (New Glendale: TWR ~1.26, 67 t) stages early, so it lofts like the heavies: a climb-rate floor
    // keeps it out of the dense air so it separates high (~78 km at ~2 km/s), not flat at 40 km with the fairing cooking
    if (v._twr0 === undefined && v.cur === 0) { const s0 = v.stages[0]; v._twr0 = s0 && s0.eng ? s0.eng.tv * 1000 * s0.n / (m * g) : 9; }
    if (!(v.stages[0] && v.stages[0].radial) && v.stages[0] && v.stages[0].reserve > 0 && v._twr0 < LOFT.twr && spAir >= 70 && h < LOFT.h1) pitch = Math.min(pitch, holdPitch(v, f, (LOFT.a + h * LOFT.b) * clamp((LOFT.h1 - h) / LOFT.taper, 0, 1), 0.08));
    // fx-ng fairing/payload heating check: if any part still aboard passes HOT_K of its skin limit on the way up, climb out of the air
    if (spAir >= 70 && h < 100000) { let hot = 0; for (let j = v.cur; j < v.stages.length; j++) for (const p of v.stages[j].parts) if (p.Ts > 0) hot = Math.max(hot, p.Ts / thermalOf(p).Tmax);
      if (hot > HOT_K) pitch = Math.min(pitch, holdPitch(v, f, 300 + 4000 * (hot - HOT_K), 0.08)); }
    const tMax = s && s.eng ? s.eng.tv * 1000 * s.n : 0;
    thr = Math.max(qCap(qPa, v.qFloor ?? 0.4), tMax > 0 ? Math.min(1, 1.3 * g * m / tMax) : 1);
    if (tMax > 0) thr = Math.min(thr, G_LIMIT * 9.80665 * m / tMax); // g-limit: throttle back near burnout
    // optional data table (timelines/ascent.js): stage-1 pitch/throttle vs time since liftoff (v.ascentMet), additive
    const tab = v.ascentTable && v.cur === 0 && v.ascentMet != null ? sampleAscent(v.ascentTable, v.ascentMet) : null;
    if (tab) { pitch = tab.pitch; thr = tMax > 0 ? Math.min(tab.throttle, G_LIMIT * 9.80665 * m / tMax) : tab.throttle; }
  } else if (ph === 'insert') { // hold the climb toward the insertion altitude while building horizontal speed
    const hT = (TARGET_AP + TARGET_PE) / 2, vrDes = clamp((hT - h) / 80, -150, 150);
    pitch = holdPitch(v, f, vrDes, 0.05); thr = 1;
    const tMax = s && s.eng ? s.eng.tv * 1000 * s.n : 0; if (tMax > 0) thr = Math.min(1, G_LIMIT * 9.80665 * m / tMax);
  } else if (ph === 'coast' || ph === 'done') { pitch = pgIn; thr = 0; }
  else if (ph === 'raise') { pitch = pgIn; thr = 1; } // fx-site: prograde apoapsis raise from a low circular orbit
  else { pitch = holdPitch(v, f, 0, 0.05); thr = 1; }
  const lim2 = qPa > 15000 ? 0.08 : qPa > 3000 ? 0.2 : qPa > 500 ? 0.5 : 1.4;
  // heavy: the q-limited prograde clamp may tilt UP a little more (never down) while the climb is under the floor
  const heavyUp = ph === 'ascent' && v.stages[0] && v.stages[0].radial && h < 50000 && vr < 120 + h * 0.012 ? 0.2 : 0;
  pitch = clamp(pitch, pgAir - lim2 - heavyUp, pgAir + lim2);
  pitch = clamp(pitch, 0, Math.PI * 0.75);
  return { dir: dirOfPitch(pitch, f), throttle: thr, phase: ph, pitch };
}
// ---------- booster (3-DOF) autopilot: live-state entry burn → aero coast → hoverslam ----------
// Entry burn: every 0.5 s a cheap drag-only coast prediction from the live state gives the peak dynamic pressure and
// peak (Sutton–Graves) heating still ahead; the 3-engine burn runs only while either would exceed its safe limit
// (with a 10% margin), so a nominal path may skip it and a steep / fast / off-target one gets just enough.
export const ENTRY_Q_MAX = 35;        // kPa peak dynamic pressure down to ENTRY_FLOOR (below it the drag-limited fall is the same either way)
export const ENTRY_START = 62000;     // m: the entry burn may begin below this (real boosters light ~70 km on the way down)
export const ENTRY_FLOOR = 20000;     // m: the entry corridor the burn protects
export const ENTRY_QDOT_MAX = 1.0e5;  // W/m² peak stagnation heating (≈ the 1.7 km/s @ 30 km burn-up line, with margin)
export const sgHeat = (rho, V) => 1.74e-4 * Math.sqrt(Math.max(rho, 0)) * V * V * V;
export function predictEntryPeaks(b, dtMax = 1) {
  const c = { ...b, r: [...b.r], v: [...b.v], stages: b.stages.map(s => ({ ...s })), throttle: 0 };
  let q = 0, qdot = 0, v30 = 0;
  for (let i = 0; i < 1500; i++) {
    const h = len(c.r) - R_E; if (h < ENTRY_FLOOR) break;
    const va = airVel(c, c.r, c.v); c.dir = scale(va, -1 / Math.max(len(va), 1));
    if (stepPoint(c, h > 40000 ? dtMax : 0.25)) break;
    const hh = len(c.r) - R_E, rho = atmosphere(Math.max(hh, 0)).rho, V = len(airVel(c, c.r, c.v));
    q = Math.max(q, 0.5 * rho * V * V / 1000); qdot = Math.max(qdot, sgHeat(rho, V)); if (hh < 30000 && !v30) v30 = V;
  }
  return { q, qdot, v30 };
}
export function boosterAutopilot(b, dtHint = 0.02) {
  const up = norm(b.r), h = len(b.r) - R_E, va = airVel(b, b.r, b.v), sp = len(va), vr = dot(va, up);
  const s = b.stages[0], g = muOf(b) / dot(b.r, b.r), deck = b.deck ?? 0;
  if (!b.manual) b.dir = sp > 2 ? scale(va, -1 / sp) : up;
  // f4 RTLS boostback: burn back along the ground track until the ballistic impact sits on the landing zone
  if (b.rtls && !b.bbDone && !b.manual && b.tgtR && s.fuel > 0 && h > 15000) {
    const keep = s.dry * (Math.exp(1300 / (s.eng.ispVac * 9.80665)) - 1); // entry + landing budget
    b._bT = (b._bT ?? 0) - dtHint;
    if (b._bT <= 0) { b._bT = 0.3; const im = predictImpact(b);
      if (im) { const e = sub(b.tgtAt ? b.tgtAt(im.t) : b.tgtR, im.r), u2 = norm(im.r), eh = sub(e, scale(u2, dot(e, u2))), E = len(eh);
        b._bbV = E > 1 ? scale(eh, 1 / E) : b._bbV; b.impErr = E;
        if (E < 80 || (b._bbE != null && E > b._bbE + 30)) b.bbDone = true; b._bbE = E; } }
    if (s.fuel <= keep) b.bbDone = true;
    if (!b.bbDone && b._bbV) { b.n = Math.min(3, b.nMax); b.throttle = Math.min(1, Math.max(0.08, (b._bbE ?? 1e4) / 8000)); b.dir = norm(add(b._bbV, scale(up, 0.08))); b.phase = 'boostback'; b.boostback = (b.boostback || 0) + dtHint; return; }
  }
  if (vr > 0 || s.fuel <= 0) { b.throttle = 0; if (b.tgtR) b.fin = null; b.phase = s.fuel <= 0 ? 'no fuel' : 'coast'; return; }
  // f4 terminal guidance toward b.tgtR (ECI point on the surface/deck, set by flight.js every step)
  const tg = b.tgtR ? horizErr(b, up) : null; b.tgtErr = tg ? len(tg.d) : null;
  if (tg && h < 30000 && !b._hs) { // grid-fin glide (f4.1: RTLS steers from the end of the entry burn): steer the predicted impact onto the target
    b._gT = (b._gT ?? 0) - dtHint;
    if (b._gT <= 0) { b._gT = 0.4; const im = predictImpact(b); if (im) { const e = sub(b.tgtAt ? b.tgtAt(im.t) : b.tgtR, im.r), eh = sub(e, scale(up, dot(e, up))); b._finV = scale(eh, 1 / Math.max(b.rtls ? 1700 : 2500, len(eh))); b.impErr = len(eh); } }
    b.fin = b._finV || null;
  } else if (b.tgtR) b.fin = null;
  // (1) entry burn, decided from the live predicted peaks
  const eStart = (() => { const sE = b.stages[0]; return (b.nMax ?? 3) >= 3 && sE.eng && 3 * sE.eng.tv * 1000 / ((sE.dry + sE.fuel) * 1000) > 2.5 * g ? ENTRY_START : 90000; })(); // a weak (low-TWR) entry burn needs the whole window; the 3-engine (F9-class) entry burn starts at the real ~62 km, a 2-engine catch booster keeps the wide window (its divert needs it)
  if (!b.entryDone && h < eStart && h > 25000 && (vr < (b.rtls ? -500 : -150) || b.entryBurned)) { // once lit, the entry burn runs until the predicted peaks are safe (no on/off chatter at the gate) // f4: an RTLS booster falls almost straight down; start once it is really falling (no hover chatter)
    b._eT = (b._eT ?? 0) - dtHint;
    if (b._eT <= 0) { b._eT = 0.5; const pk = predictEntryPeaks(b); b.entryPeak = pk;
      b._eNeed = pk.q > ENTRY_Q_MAX * 0.9 || pk.qdot > ENTRY_QDOT_MAX * 0.9; }
    const sE = b.stages[0], mE = (sE.dry + sE.fuel) * 1000, aE = sE.eng.tv * 1000 / mE, gE = muOf(b) / dot(b.r, b.r);
    const keep = sE.dry * (Math.exp(Math.max(0, 1.6 * Math.sqrt(2 * gE * 0) + 600) / (sE.eng.ispSl * 9.80665)) - 1); // ~600 m/s landing-burn budget
    if (b._eNeed && sE.fuel > keep * (b.rtls ? 2.8 : 1.1) && b.rtls && b.tgtR && !b.manual) { // f4 RTLS: steer the entry burn so the impact stays on the landing zone
      b._ieT = (b._ieT ?? 0) - dtHint;
      if (b._ieT <= 0) { b._ieT = 0.5; const im = predictImpact(b); if (im) { const e = sub(b.tgtAt ? b.tgtAt(im.t) : b.tgtR, im.r), u2 = norm(im.r), eh = sub(e, scale(u2, dot(e, u2))), E = len(eh); b.impErr = E; b._ieV = E > 1 ? scale(eh, Math.min(0.4, E / 4000) / E) : null; } }
      if (b._ieV) b.dir = norm(add(b.dir, b._ieV));
    }
    if (b._eNeed && sE.fuel > keep * (b.rtls ? 2.8 : 1.1)) { b.n = Math.min(3, b.nMax); b.throttle = 1; b.phase = 'entry burn'; b.entryBurned = (b.entryBurned || 0) + dtHint; return; }
    if (b.entryBurned) b.entryDone = true;
  }
  if (h <= 25000) b.entryDone = true;
  // (3) hoverslam, recomputed every frame
  const atm = atmosphere(Math.max(h, 0)), pr = Math.min(1, atm.p / 101325), m = (s.dry + s.fuel) * 1000 + (b.extra || 0) * 1000;
  const isp = s.eng.ispVac - (s.eng.ispVac - s.eng.ispSl) * pr, T1 = s.eng.tv * 1000 * isp / s.eng.ispVac;
  const qd = 0.5 * atm.rho * sp * sp, aDrag = qd * (b.cdA || 0) * cd0(sp / atm.a) / m * 0.5; // count half the current drag: it fades as the burn slows the booster
  const vDown = vr < 0 ? (b.tgtR && !b.manual ? -vr : sp) : 0, hp = h - deck; // retro thrust kills the whole air-relative velocity
  const NL = Math.min(3, b.nMax || 1);
  const pick = n => hoverslamSolve({ h: hp, vDown, m, Tmax: T1 * n, thrMin: 0.4, g, aDrag, burning: !!b._hs, lit: b.ignAlt != null });
  let n = b._hs ? b.n : 1, sol = pick(n);
  if (!b._hs && (sol.lowTWR || sol.dStop > 0.8 * hp) && b.nMax > 1) { const s3 = pick(NL); if (s3.ignite || sol.lowTWR) { n = NL; sol = s3; } }
  // late in a 3-engine burn drop to the centre engine once one engine can finish it at ≤ THR_AIM
  if (b._hs && (b.nMax || 1) > n && sol.aReq > sol.aMax * 0.95) { n = Math.min(b.nMax, n + 2); sol = pick(n); } // fx-2: a burn that runs out of margin lights more engines (heavy boosters landed hard at 14 m/s)
  if (b._hs && n > 1) { const s1 = hoverslamSolve({ h: hp, vDown, m, Tmax: T1, thrMin: 0.4, g, aDrag, burning: true, lit: true }); if (s1.aReq < s1.aMax * 0.85) { n = 1; sol = s1; } }
  // landing-burn timing: the solve above only counts (half) today's drag, so high up in thin air it would light far too early
  // (rideshare RTLS lit at ~30 km). Look ahead along a drag-only fall and wait for the altitude where the solve, fed the
  // predicted state, first asks for ignition (refreshed every 0.5 s; skipped once lit, near the ground or under manual control).
  if (!sol.ignite) b._hIgn = null; // stale look-ahead: recompute when the solve next asks for ignition
  if (!b._hs && b.ignAlt == null && sol.ignite && !b.manual && (hp > 3000 || (b._hIgn != null && b.nMax >= 3))) { // below 3 km a held look-ahead still hands over to the 3-engine burn it assumed // only the high, thin-air ignitions; the last 3 km stay with the solve
    b._lT = (b._lT ?? 0) - dtHint;
    if (b._lT <= 0 || b._hIgn == null) { b._lT = 0.5; b._hIgn = predictIgnAlt(b, NL, T1, m, deck); }
    if (b._hIgn != null && hp > Math.max(3000, b._hIgn + Math.max(vDown, 50) * 0.6)) sol = { ...sol, ignite: false, throttle: 0, tIgn: (hp - b._hIgn) / Math.max(vDown, 50) };
    else if (b._hIgn != null && b.nMax > 1) { n = NL; sol = pick(n); } // the look-ahead assumed the 3-engine burn
  }
  b.hs = sol; b.burnIn = sol.ignite ? 0 : sol.tIgn; b.lowTWR = sol.lowTWR; if (sol.legs) b.legs = true;
  if (sol.ignite && sol.throttle > 0 && (b.entryDone || h < 25000)) {
    if (!b._hs) { b._hs = true; if (b.ignAlt == null) { b.ignAlt = hp; b.ignV = vDown; } }
    b.landing = true; b.n = n; b.throttle = sol.throttle; b.phase = sol.lowTWR ? 'controlled descent (low TWR)' : 'landing burn';
    if (tg && !b.manual && sp > 2) { // divert: ZEM/ZEV lateral acceleration, folded into the thrust direction (tilt ≤ 20°)
      const tgo = Math.max(1.5, (b.rtls ? 1.3 : 2) * Math.max(hp, 1) / Math.max(vDown, 3)), vh = sub(va, scale(up, dot(va, up)));
      const aH = sub(scale(tg.d, 6 / (tgo * tgo)), scale(vh, 4 / tgo)), aT = Math.max(1, T1 * n * b.throttle / m), k = Math.min(len(aH) / aT, hp < 400 ? 0.12 : b.rtls ? 0.5 : 0.36);
      const retro = scale(va, -1 / sp), hd = len(aH) > 1e-6 ? scale(aH, k / len(aH)) : [0, 0, 0]; b.dir = norm(add(retro, hd)); }
  } else { b._hs = false; b.n = 1; b.throttle = 0; b.phase = b.ignAlt != null && hp < 5 ? 'touchdown' : (h > 25000 ? 'coast' : 'grid-fin glide'); }
}
function predictIgnAlt(b, n, T1, m, deck) { // highest point of the drag-only fall from which a retro burn (n engines, 85 %) WITH the drag below still stops by the ground
  const clone = x => ({ ...x, r: [...x.r], v: [...x.v], stages: x.stages.map(s => ({ ...s })) });
  const c = clone(b); c.throttle = 0; let last = null;
  const stops = st => { const p = clone(st); p.n = n; p.throttle = 0.8;
    for (let k = 0; k < 600; k++) { const up = norm(p.r), va = airVel(p, p.r, p.v), sp = len(va), hp = len(p.r) - R_E - deck;
      if (dot(va, up) > -3 || sp < 5) return hp > 30; if (hp < 30) return false; p.dir = scale(va, -1 / sp); if (stepPoint(p, hp > 3000 ? 0.25 : 0.1)) return false; }
    return false; };
  for (let i = 0, k = 0; i < 2000; i++) {
    const up = norm(c.r), va = airVel(c, c.r, c.v), sp = len(va), hp = len(c.r) - R_E - deck; if (hp < 200) return last;
    c.dir = scale(va, -1 / Math.max(sp, 1));
    if (dot(va, up) < 0 && (k++ % 4 === 0)) { if (!stops(c)) return last ?? hp; last = hp; }
    if (stepPoint(c, hp > 15000 ? 1 : 0.25)) return last;
  }
  return null;
}
function horizErr(b, up) { const e = sub(b.tgtR, b.r); return { d: sub(e, scale(up, dot(e, up))) }; }
// Ballistic impact (drag, no thrust). Returns { r (ECI), t (clock at impact) } or null.
export function predictImpact(b) {
  const c = { ...b, r: [...b.r], v: [...b.v], stages: b.stages.map(s => ({ ...s })), throttle: 0 };
  for (let i = 0; i < 6000; i++) { const h = len(c.r) - R_E, dt = h > 30000 ? 0.5 : 0.2; if (stepPoint(c, dt)) return { r: c.r, t: c.clock }; }
  return null;
}
