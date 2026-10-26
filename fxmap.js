// Orbit Rush effects mappings: telemetry (v.tel) → effect intensities, shapes and colours. Pure functions with
// no rendering, so the tests can check them (tests/heat.mjs) and fx.js just draws what they say.
const clamp01 = x => Math.max(0, Math.min(1, x));
export const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
// Relative humidity (0..1) over the tropical launch site: humid low air, drying out with height, gone above
// the tropopause (~16 km at the equator). Non-increasing with altitude.
export const humidity = alt => 0.85 * Math.exp(-Math.max(alt, 0) / 9000) * (1 - smooth(11000, 16000, alt));
// Condensation ("vapor cone") around Mach 1: the air expanding over the shoulder cools below its dew point.
// Needs humid air and dynamic pressure; strongest just under Mach 1, gone by ~Mach 1.3.
// Monotonic: non-decreasing in q and in humidity; rises with Mach up to 0.97, falls past 1.05.
export function vaporCone(M, q, alt) {
  const band = smooth(0.86, 0.97, M) * (1 - smooth(1.08, 1.25, M)); // f1: only in the transonic band (~Mach 0.9-1.2)
  return clamp01(band * (q / (q + 12000)) * humidity(alt) * 3);
}
// Mach angle (rad): half-angle of the shock cone, asin(1/M). Subsonic: no shock (pi/2).
export const machAngle = M => (M > 1 ? Math.asin(1 / M) : Math.PI / 2);
// Shock cone strength: appears through Mach 1-1.6 and grows with dynamic pressure. Non-decreasing in M and q.
export const shockStrength = (M, q) => smooth(1.0, 1.6, M) * (q / (q + 8000));
// Compressed-air glow in the shock layer at hypersonic speed (the air is heated by the compression).
// Non-decreasing in M and q.
export const compressionGlow = (M, q) => smooth(2.5, 9, M) * (q / (q + 15000));
// Bow-shock standoff for a blunt nose of radius rn (Billig: delta/rn ~ 0.143 exp(3.24/M^2)).
export const shockStandoff = (M, rn) => (M > 1 ? 0.143 * rn * Math.exp(3.24 / (M * M)) : 0);
// Reentry plasma sheath intensity from the stagnation heat flux (W/m^2), log-scaled: faint at ~20 kW/m²,
// full at ~1 MW/m². Strictly increasing in between, non-decreasing everywhere.
export const plasmaIntensity = heat => smooth(4.3, 6.0, Math.log10(Math.max(heat, 1)));
// Plasma colour from the stagnation temperature: orange (~1,800 K) → yellow → white → violet (~7,000 K).
const STOPS = [[0, [1.0, 0.42, 0.08]], [0.35, [1.0, 0.78, 0.4]], [0.65, [1.0, 0.95, 0.92]], [1, [0.72, 0.58, 1.0]]];
export function plasmaColor(Tstag) {
  const t = clamp01((Tstag - 1500) / 5500);
  for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
    const [t0, a] = STOPS[i - 1], [t1, b] = STOPS[i], f = (t - t0) / (t1 - t0);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }
  return STOPS[STOPS.length - 1][1];
}
// Ablation trail: embers and smoke from the ablator, from the ablation rate (kg/s) and the heat flux.
export const ablationRate = (mdot, heat) => clamp01(Math.max(smooth(0, 0.4, mdot), smooth(2e5, 8e5, heat) * 0.4));
// Skin incandescence from temperature: starts at the Draper point (~800 K), white-hot by ~2,000 K.
export const skinGlow = T => smooth(780, 2000, T);
// Engine plume vs ambient pressure. The nozzle exit pressure pe is fixed by the nozzle, so as the ambient
// pressure pa drops with altitude the jet is underexpanded and balloons out: width ~ sqrt(pe/pa).
// Shock diamonds show while the plume is still near ambient pressure (low altitude). width/length are
// non-increasing in pa.
export function plumeShape(pa, throttle = 1, pe = 70000) {
  const ratio = pe / Math.max(pa, 1);
  const width = Math.max(0.85, Math.min(9, Math.sqrt(ratio)));
  const length = (0.6 + 0.4 * throttle) * (1 + 0.55 * Math.log10(1 + Math.min(ratio, 1e6)) * 0.5);
  const diamonds = smooth(12000, 55000, pa) * clamp01(throttle * 1.2);
  return { width, length, diamonds, ratio };
}
// Airflow streak particles: visible in dense, fast air. Non-decreasing in q.
// f1: nothing visible in plain subsonic flight (the Mach 0.5 "specks"); streaks start with compressibility (~Mach 0.85).
// fx-3: and they fade out above ~28 km (the white streaks hung on to ~48 km in thin air)
export const flowStreaks = (q, M, alt = 0) => smooth(300, 9000, q) * smooth(0.8, 1.0, M) * (1 - smooth(22000, 32000, alt));
// f1 layered plume look vs ambient pressure pa (Pa) and throttle: lengths/widths in units of the nozzle radius.
// Sea level: a tight, long, bright column with shock diamonds. As the air thins it opens into a wide bell
// ("jellyfish") that is huge and faint in vacuum. vac is 0 at sea level, 1 in vacuum (non-increasing in pa).
export function plumeLook(pa, throttle = 1) {
  const sh = plumeShape(pa, throttle), vac = 1 - smooth(600, 40000, pa), t = clamp01(throttle);
  const len = (10 + 14 * t) * (1 - 0.3 * vac); // fx-5 (QA f5.6w): in thin air the jet gets shorter and fuller, not a thin needle               // column length (× nozzle radius)
  const coreW = 0.9 + 0.8 * vac, glowW = 1.6 + 0.4 * vac; // fx-5 (QA f5.6w): narrower vacuum glow (the maroon fan)    // inner core / outer glow widths
  const bellW = 1 + (Math.min(2.4, sh.width) - 1) * 0.85 * smooth(0.05, 0.6, vac); // expanded bell rim
  return { len, coreW, glowW, bellW, bell: smooth(0.05, 0.5, vac) * (0.08 + 0.17 * t), // fx-5: a faint bell, not a translucent fan/cone wider than the stage
    vac, diamonds: sh.diamonds, bright: 0.55 + 0.45 * t, smoke: clamp01(pa / 101325) };
}
// Effects quality presets (fx.js): particle counts and which layers draw.
export const QUALITY = {
  low:  { flowCPU: 350,  flowGPU: 2500,  vapor: true, shock: true, plasmaShell: false, wake: true, diamonds: false, ablate: 2 },
  med:  { flowCPU: 1000, flowGPU: 6000,  vapor: true, shock: true, plasmaShell: true,  wake: true, diamonds: true,  ablate: 4 },
  high: { flowCPU: 2200, flowGPU: 10000, vapor: true, shock: true, plasmaShell: true,  wake: true, diamonds: true,  ablate: 7 },
};
export const QUALITY_ORDER = ['low', 'med', 'high'];
// Everything the renderer needs for one frame, from telemetry.
export function fxState(tel) {
  if (!tel) return null;
  const M = tel.machShown === null || tel.machShown === undefined ? 0 : tel.mach, q = tel.q || 0;
  return {
    flow: flowStreaks(q, M, tel.alt || 0), vapor: vaporCone(M, q, tel.alt), shock: shockStrength(M, q), glow: compressionGlow(M, q),
    machAngle: machAngle(M), plasma: plasmaIntensity(tel.heat || 0), plasmaColor: plasmaColor(tel.Tstag || 0),
    ablate: ablationRate(tel.ablating || 0, tel.heat || 0), plume: plumeShape(tel.p || 0, tel.thrust > 0 ? 1 : 0), M, q,
  };
}
// fx-1 (QA f5.5d): gates and shaping for the flight visuals.
// Plasma sheath: only on a real reentry (descending) or a very hot ascent, never as a faint dome on a normal climb.
// fx-7 (QA f5.6x): the plasma bow/wake/shell only on a descent (or a truly hot ascent): a Mach-5 climb at 48 km drew a maroon wedge from the nose wider than the stage
export const plasmaGate = (pl, vUp) => (vUp === undefined || vUp < 0 ? 1 : smooth(0.75, 1.0, pl));
export const sheathAlpha = (pl, vUp) => (vUp < 0 ? smooth(0.08, 0.5, pl) : smooth(0.75, 1.0, pl) * 0.6);
// Hull heat halo: off until the skin really glows.
export const haloAlpha = k => smooth(0.12, 0.6, k);
// Flame puff particles behind the nozzle: dense air only (ambient pressure ratio p); none in near-vacuum.
export const flamePuffs = p => smooth(0.12, 0.4, p);
// Smooth plume flicker (sum of slow sines, ±4%) instead of per-frame Math.random() strobing.
export const plumeFlicker = (t, seed = 0) => 1 + 0.025 * Math.sin(t * 7.1 + seed) + 0.015 * Math.sin(t * 12.7 + seed * 1.7);
// Nozzle glow sprite scale when the plume length is clamped (just after separation): fades with the flame.
export const glowScaleK = (len, full) => clamp01((len / Math.max(full, 1e-6) - 0.05) / 0.6);
// Liftoff ground cloud size multiplier (was ×2 with a 60 m/s burst): bounded, only near the pad.
export const groundSmokeK = h => (h < 60 ? 1.25 : 1);
// fx-1 (the owner's phone video: pitch-black booster): fill-light floors so a hull in its own shadow (space, booster
// pane looking into the sun) still reads. day 0..1, k = space factor 0..1, sunK = 1 in sunlight, phone adds a bit.
export function fillLight(day, k, sunK, phone = false) {
  const hemi = Math.max(phone ? 0.5 : 0.4, (0.25 + 0.75 * day) * (1 - k * 0.75));
  const env = Math.max(phone ? 0.45 : 0.35, (0.35 + 0.65 * day) * (1 - 0.6 * k) * (0.3 + 0.7 * sunK));
  return { hemi, env };
}

// fx-4: plume shells fade by |n·v|^k at their silhouettes (fun/plumemat.js runs this on the GPU)
export const SOFT_K = { glow: 2.2, plume: 1.4, bell: 2.6, core: 0.8 };
export const edgeFade = (nDotV, k) => Math.pow(Math.min(1, Math.abs(nDotV)), k);

// plume-soft-1 (QA f5.8r/v): the vacuum plume is one soft flaring shell, not a hard cone with a starburst.
//   radialK: facing fade exponent (edges dissolve)   axialK: alpha falls to 0 at the far end (length falloff)   ramp: fraction of the length it fades in over at the nozzle rim
//   flare: exit radius -> far-end radius   hard: 0 = nothing draws as a hard edge
export const VAC_PLUME = { radialK: 2.4, axialK: 1.6, ramp: 0.05, flare: 1.9, hard: 0 };
// how far into vacuum-mode rendering a plume is (0 = sea-level cones, 1 = the soft vacuum shell) from the plumeLook vac factor
export const vacBlend = vac => smooth(0.2, 0.75, vac);
// above the atmosphere the exhaust gets wider and fainter: altK 0 at 40 km .. 1 at 120 km
export const vacAlt = h => smooth(40000, 120000, h);
export const vacWidth = (altK, thrustK = 1) => (1 + 1.2 * altK) * Math.min(1.4, Math.max(0.8, thrustK));
export const vacOpacity = (altK, bright = 1, k = 1) => Math.min(0.8, 0.62 * bright * Math.min(1.2, k) * (1 - 0.6 * altK));
// Exhaust smoke caps (Heron Heavy S2 filled the screen): particle width and growth are bounded and the smoke thins out with height. h in metres.
export const smokeWidthCap = h => (h < 1500 ? 1e9 : 8 + 22 * (1 - smooth(3000, 25000, h)));
export const smokeFade = h => 1 - smooth(14000, 40000, h);
