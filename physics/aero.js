// Aerodynamics of a slender rocket (body axis = +Y, nose up).
// Drag:  D = 0.5 * rho * V^2 * Cd(M, alpha) * A        (A = body cross-section)
// Normal force (lift on body and fins), Barrowman-style: each component i has a slope CNa_i (per rad)
// and acts at its station y_i; N = q * A * sum(CNa_i) * sin(a)|cos(a)| + crossflow (q A K sin^2 a).
// Center of pressure = force-weighted station; aero torque = (CoP - CoM) x N. Fins aft => CoP behind the
// CoM => restoring torque (weathervane stable). CoP ahead of the CoM => the rocket flips.
import { clamp } from './vec.js?v=pv2';
// Zero-lift drag coefficient vs Mach: flat subsonic, transonic drag rise to a peak just above Mach 1,
// then a supersonic/hypersonic falloff.
export function cd0(M) {
  if (M < 0.6) return 0.30;
  if (M < 1.05) { const t = (M - 0.6) / 0.45, s = t * t * (3 - 2 * t); return 0.30 + 0.42 * s; }
  if (M < 1.25) return 0.72;
  return 0.25 + 0.47 * Math.pow(1.25 / M, 1.5);
}
// Supersonic fins lose lift slope roughly like 1/sqrt(M^2 - 1) (clamped so it stays sane near Mach 1).
export const finMachFactor = M => (M <= 1.2 ? 1 : clamp(1 / Math.sqrt(M * M - 1) * 1.5, 0.35, 1));
// Stagnation (total) temperature of the air brought to rest at the nose: T0 = T (1 + (gamma-1)/2 M^2).
export const stagnationTemp = (T, M) => T * (1 + 0.2 * M * M);
// Sutton–Graves convective stagnation-point heat flux (W/m^2) for Earth air; rn = nose radius (m).
export const heatFlux = (rho, V, rn) => 1.7415e-4 * Math.sqrt(Math.max(rho, 0) / Math.max(rn, 0.05)) * V * V * V;
// Normal-force components and center of pressure for a stack geometry `g` at Mach M (see vehicle.js).
export function normalModel(g, M) {
  const ff = finMachFactor(M), comps = [{ cna: g.cnaNose, y: g.yNose }];
  if (g.cnaFins > 0) comps.push({ cna: g.cnaFins * ff, y: g.yFins });
  const cna = comps.reduce((s, c) => s + c.cna, 0), ycp = comps.reduce((s, c) => s + c.cna * c.y, 0) / cna;
  return { comps, cna, ycp };
}
// Center of pressure at small angle of attack (and the crossflow-weighted one at alpha).
export function centerOfPressure(g, M, alpha = 0.02) {
  const nm = normalModel(g, M), sa = Math.sin(alpha), ca = Math.abs(Math.cos(alpha));
  const lin = nm.cna * sa * ca, cross = g.crossK * sa * sa;
  return (nm.ycp * lin + g.yBody * cross) / Math.max(lin + cross, 1e-9);
}
