// Aerodynamics of a slender rocket (body axis = +Y, nose up).
// Drag:  D = 0.5 * rho * V^2 * Cd(M, alpha) * A        (A = body cross-section)
// Normal force (lift on body and fins), Barrowman-style: each component i has a slope CNa_i (per rad)
// and acts at its station y_i; N = q * A * sum(CNa_i) * sin(a)|cos(a)| + crossflow (q A K sin^2 a).
// Center of pressure = force-weighted station; aero torque = (CoP - CoM) x N. Fins aft => CoP behind the
// CoM => restoring torque (weathervane stable). CoP ahead of the CoM => the rocket flips.
import { clamp } from './vec.js?v=f5.1c';
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
// Ideal-gas stagnation (total) temperature of air brought to rest at the nose: T0 = T (1 + (gamma-1)/2 M^2).
export const stagnationTempIdeal = (T, M) => T * (1 + 0.2 * M * M);
// ---------- rarefied flow ----------
// Mean free path of air (m) from density: lambda = lambda0 * rho0 / rho (66 nm at sea level).
export const meanFreePath = rho => (rho > 0 ? 6.63e-8 * 1.225 / rho : Infinity);
// Knudsen number Kn = lambda / L for a body (or nose) of size L. Continuum below ~0.01, free-molecular above ~10.
export const knudsen = (rho, L) => meanFreePath(rho) / Math.max(L, 0.05);
// Weight of the free-molecular regime: 0 in continuum flow, 1 in free-molecular flow, log-linear in between.
export const rarefaction = Kn => clamp((Math.log10(Math.max(Kn, 1e-12)) + 2) / 3, 0, 1);
export const flowRegime = Kn => (Kn < 0.01 ? 'continuum' : Kn < 10 ? 'transitional' : 'free-molecular');
// Effective stagnation temperature (K). Above ~2,500 K air dissociates (O2, then N2) and soaks up energy, so a
// real shock layer tops out near 7,000-8,000 K at orbital speed instead of the ideal ~30,000 K. In rarefied
// flow there is no continuum shock layer at all: the value falls back to the ambient (kinetic) temperature.
export function stagnationTemp(T, M, w = 0) {
  const T0 = stagnationTempIdeal(T, M), Tc = 2500, dT = 5500;
  const real = T0 <= Tc ? T0 : Tc + (T0 - Tc) / (1 + (T0 - Tc) / dT);
  return real * (1 - w) + T * w;
}
// Sutton–Graves convective stagnation-point heat flux (W/m^2) for Earth air; rn = nose radius (m).
// q = k sqrt(rho / rn) V^3 with k = 1.7415e-4 (SI). Continuum (cold-wall) value.
export const SUTTON_GRAVES_K = 1.7415e-4;
export const suttonGraves = (rho, V, rn) => SUTTON_GRAVES_K * Math.sqrt(Math.max(rho, 0) / Math.max(rn, 0.05)) * V * V * V;
// Free-molecular limit: every molecule hitting the nose dumps (accommodation alpha) its kinetic energy:
// q = alpha * 0.5 * rho * V^3. This caps the continuum formula in the thin upper thermosphere.
export const freeMolecularFlux = (rho, V, alpha = 0.9) => alpha * 0.5 * Math.max(rho, 0) * V * V * V;
// Stagnation heat flux bridged from continuum (Sutton–Graves) to free-molecular flow by the Knudsen number.
export function heatFlux(rho, V, rn) {
  if (!(rho > 0) || !(V > 0)) return 0;
  const qc = suttonGraves(rho, V, rn), qf = freeMolecularFlux(rho, V), w = rarefaction(knudsen(rho, rn));
  return Math.min(qc, qf) * w + qc * (1 - w);
}
// Drag coefficient of a blunt base / heat shield flying first (capsule reentry): ~0.9 subsonic, ~1.4 hypersonic.
export function bluntCd(M) { if (M < 0.8) return 0.9; if (M < 1.5) return 0.9 + 0.5 * (M - 0.8) / 0.7; return 1.4; }
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
