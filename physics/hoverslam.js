// Hoverslam ("suicide burn") solver shared by every auto landing (booster return, upper stage, landers on any body).
// Pure function of the live state: altitude above the pad/terrain, descent speed, mass, the thrust the engines give
// at the current ambient pressure, the throttle range, local gravity and the current drag deceleration.
// The burn starts as late as possible such that, flown at THR_AIM (headroom to correct), speed reaches ~0 at h = 0.
// Recomputed every frame; the throttle is the exact constant deceleration still needed, so the error never builds.
export const THR_AIM = 0.88;     // plan the burn at 88% so ±12% is left to correct
export const TOUCH_V = 1.0;      // m/s aimed at touchdown (legs take it; never hover)
export const LEG_T = 5;          // s before touchdown the legs go down
export function hoverslamSolve({ h, vDown, m, Tmax, thrMin = 0.4, g, aDrag = 0, burning = false, lit = false }) {
  const aMax = Tmax / Math.max(m, 1), v = Math.max(vDown, 0), hh = Math.max(h, 0.01);
  const twr = aMax / g, lowTWR = aMax * THR_AIM <= g * 1.08, noLand = aMax <= g * 1.01;
  const aim = lowTWR ? 0.98 : THR_AIM;
  const net = Math.max(aim * aMax + aDrag - g, 0.05);       // deceleration the planned burn gives
  const dStop = (v * v - TOUCH_V * TOUCH_V) / (2 * net);     // distance it needs
  const tBurn = Math.max(v - TOUCH_V, 0) / net;
  const tIgn = v > 0.5 ? (hh - dStop) / v : Infinity;        // time until it must light (≈, at current speed)
  const hAim = Math.max(hh - 0.6, 0.05);                       // be at TOUCH_V 0.6 m up, then hold it to contact
  const aReq = v > TOUCH_V ? (v * v - TOUCH_V * TOUCH_V) / (2 * hAim) + g - aDrag : g - aDrag + (v - TOUCH_V) * 4;
  let throttle = aMax > 0 ? aReq / aMax : 0;
  const ignite = burning || tIgn <= 0 || throttle >= aim || (lit && throttle >= thrMin); // once lit, relight at min throttle
  if (!ignite) throttle = 0;
  else if (v < 0.3 || hh < 0.03) throttle = 0;                  // touchdown: cut, never hover
  else if (throttle < thrMin * 0.95 && hh > 3) { throttle = 0; return { aMax, twr, lowTWR, noLand, aReq, dStop, tBurn, tIgn, tGo: tIgn + tBurn, ignite: false, throttle, legs: tIgn + tBurn < LEG_T || hh < 400 }; } // below min throttle: coast and relight later, never hover
  else throttle = Math.min(1, Math.max(thrMin, throttle));
  return { aMax, twr, lowTWR, noLand, aReq, dStop, tBurn, tIgn, tGo: tIgn + tBurn, ignite, throttle, legs: tIgn + tBurn < LEG_T || hh < 400 };
}
// Ideal ignition altitude for the record (constant-throttle THR_AIM, no drag change): used by tests and the replay card.
export const idealIgnAlt = (v, aMax, g, aDrag = 0) => (v * v - TOUCH_V * TOUCH_V) / (2 * Math.max(THR_AIM * aMax + aDrag - g, 0.05));
