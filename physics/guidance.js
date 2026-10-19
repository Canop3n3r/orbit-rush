// AUTO guidance at full scale and the booster landing autopilot.
// AUTO ascent: vertical rise, pitch kick, gravity turn that stays near air-relative prograde while the
// dynamic pressure is high (Max-Q throttling), a pitch program toward the horizontal, then coast to
// apoapsis and a circularization burn. Phases on v.guid: ascent -> coast -> circ -> done.
import { R_E, MU_E, KARMAN } from './constants.js?v=pv2';
import { add, scale, dot, cross, len, norm, clamp } from './vec.js?v=pv2';
import { elements, timeToAp } from './kepler.js?v=pv2';
import { airVel, stepPoint } from './dynamics.js?v=pv2';
import { massOf } from './vehicle.js?v=pv2';
export const TARGET_AP = 185000;   // m: AUTO ascent cuts off once apoapsis reaches this
export const TARGET_PE = 150000;   // m: AUTO circularizes until periapsis is above this
export const ORBIT_PE = 130000;    // m: periapsis needed to count as a (lasting) orbit
export const INSERT_ALT = 178000; // m: altitude the vacuum insertion guidance levels off at
export const FAIRING_ALT = 100000; // m: fairing jettisons at the Kármán line, where heating and drag are negligible
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
  const o = elements(v.r, v.v); if (!isFinite(o.ra)) return { dv: 0, tb: 0 };
  const dv = Math.max(0, Math.sqrt(MU_E / o.ra) - o.hm / o.ra), a = thrustAccel(v);
  return { dv, tb: a > 0 ? dv / a : Infinity };
}
function holdPitch(v, f, vrDes, k, cosMax = 0.999) {
  const r = len(v.r), vr = dot(v.v, f.up), vh = len(add(v.v, scale(f.up, -vr))), aT = thrustAccel(v) * Math.max(v.throttle || 1, 0.3), g = MU_E / (r * r);
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
export const qCap = qPa => clamp(1 - (qPa - 28000) / 8000, 0.4, 1);
// Returns { dir (world unit vector), throttle, phase }.
export function autoGuide(v) {
  const f = localFrame(v), r = len(v.r), h = r - R_E, o = elements(v.r, v.v), vr = dot(v.v, f.up);
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
  const s = v.stages[v.cur], m = massOf(v) * 1000, g = MU_E / (r * r);
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
    thr = Math.max(qCap(qPa), tMax > 0 ? Math.min(1, 1.3 * g * m / tMax) : 1);
    if (tMax > 0) thr = Math.min(thr, G_LIMIT * 9.80665 * m / tMax); // g-limit: throttle back near burnout
  } else if (ph === 'coast' || ph === 'done') { pitch = pgIn; thr = 0; }
  else { pitch = holdPitch(v, f, 0, 0.05); thr = 1; }
  const lim2 = qPa > 15000 ? 0.08 : qPa > 3000 ? 0.2 : qPa > 500 ? 0.5 : 1.4;
  pitch = clamp(pitch, pgAir - lim2, pgAir + lim2);
  pitch = clamp(pitch, 0, Math.PI * 0.75);
  return { dir: dirOfPitch(pitch, f), throttle: thr, phase: ph, pitch };
}
// ---------- booster (3-DOF) autopilot: entry burn, then a throttled landing burn ----------
export function boosterAutopilot(b) {
  const up = norm(b.r), h = len(b.r) - R_E, va = airVel(b, b.r, b.v), sp = len(va), vr = dot(va, up);
  const s = b.stages[0], g = MU_E / dot(b.r, b.r);
  if (!b.manual) b.dir = sp > 2 ? scale(va, -1 / sp) : up;
  if (vr > 0 || s.fuel <= 0) { b.throttle = 0; b.phase = s.fuel <= 0 ? 'no fuel' : 'coast'; return; }
  if (h < 70000 && h > 30000 && sp > 1100 && !b.landing && !b.entryDone) { b.n = Math.min(3, b.nMax); b.throttle = 1; b.phase = 'entry burn'; return; }
  if (sp <= 1000 || h <= 30000) b.entryDone = true;
  const m = (s.dry + s.fuel) * 1000, a1 = s.eng.tv * 1000 * s.eng.ispSl / s.eng.ispVac / m;
  const vdes = Math.sqrt(2 * 0.6 * Math.max(a1 - g, 0.5) * Math.max(h - 4, 0)) + 1.5; // zero at deck height (3 m) + 1 m
  if (h < 40000 && sp > vdes) {
    b.landing = true; b.phase = 'landing burn';
    b.n = sp > vdes + 120 && h > 1200 ? Math.min(3, b.nMax) : 1;
    b.throttle = clamp((g + 0.6 * Math.max(a1 - g, 0.5) + (sp - vdes) * 2) / (a1 * b.n), 0, 1);
  } else { b.n = 1; b.throttle = 0; b.phase = 'falling'; }
}
// Ballistic impact (drag, no thrust). Returns { r (ECI), t (clock at impact) } or null.
export function predictImpact(b) {
  const c = { ...b, r: [...b.r], v: [...b.v], stages: b.stages.map(s => ({ ...s })), throttle: 0 };
  for (let i = 0; i < 6000; i++) { const h = len(c.r) - R_E, dt = h > 30000 ? 0.5 : 0.2; if (stepPoint(c, dt)) return { r: c.r, t: c.clock }; }
  return null;
}
