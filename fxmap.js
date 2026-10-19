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
  const band = smooth(0.82, 0.97, M) * (1 - smooth(1.05, 1.32, M));
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
export const flowStreaks = (q, M) => smooth(300, 9000, q) * (0.55 + 0.45 * smooth(0.3, 1.2, M));
// Effects quality presets (fx.js): particle counts and which layers draw.
export const QUALITY = {
  low:  { flowCPU: 350,  flowGPU: 2500,  vapor: true, shock: true, plasmaShell: false, wake: true, diamonds: false, ablate: 2 },
  med:  { flowCPU: 1000, flowGPU: 6000,  vapor: true, shock: true, plasmaShell: true,  wake: true, diamonds: true,  ablate: 4 },
  high: { flowCPU: 2200, flowGPU: 16000, vapor: true, shock: true, plasmaShell: true,  wake: true, diamonds: true,  ablate: 7 },
};
export const QUALITY_ORDER = ['low', 'med', 'high'];
// Everything the renderer needs for one frame, from telemetry.
export function fxState(tel) {
  if (!tel) return null;
  const M = tel.machShown === null || tel.machShown === undefined ? 0 : tel.mach, q = tel.q || 0;
  return {
    flow: flowStreaks(q, M), vapor: vaporCone(M, q, tel.alt), shock: shockStrength(M, q), glow: compressionGlow(M, q),
    machAngle: machAngle(M), plasma: plasmaIntensity(tel.heat || 0), plasmaColor: plasmaColor(tel.Tstag || 0),
    ablate: ablationRate(tel.ablating || 0, tel.heat || 0), plume: plumeShape(tel.p || 0, tel.thrust > 0 ? 1 : 0), M, q,
  };
}
