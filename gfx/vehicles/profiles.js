// Pure lathe profiles (no three.js import, so tests/vehicles_art.mjs can check them in node).
// Every profile is a list of [radius, y] from the base (largest radius) UP to the tip, so tips point +Y.
// Tangent ogive of base radius r and length L: r(y) = sqrt(rho^2 - y^2) + r - rho, rho = (r^2 + L^2) / 2r
// (y measured from the ogive base), so r(0) = r and r(L) = 0.
export function ogive(r, L, y0 = 0, n = 18, tip = 0.06) {
  const rho = (r * r + L * L) / (2 * r), out = [];
  for (let i = 0; i <= n; i++) { const yy = (i / n) * L; out.push([Math.max(0, Math.sqrt(Math.max(0, rho * rho - yy * yy)) + r - rho), y0 + yy]); }
  // blunt spherical tip: replace the last point with a small cap
  const capR = tip * r; let k = out.findIndex(p => p[0] <= capR); if (k < 1) k = out.length - 1;
  const [, yc] = out[k], cap = []; for (let j = 0; j <= 4; j++) { const a = (j / 4) * Math.PI / 2; cap.push([capR * Math.cos(a), yc + capR * Math.sin(a) * 0.6]); }
  return out.slice(0, k).concat(cap);
}
// payload fairing: boattail from the adapter radius, straight barrel, tangent ogive — one continuous profile
// bt = boattail length: a smooth S-curve from the adapter radius rBase out to the full fairing radius r
export function fairing(r, cyl, L, y0 = 0, rBase = r * 0.88, n = 18, bt = 0.6) {
  const out = [[0, y0]]; for (let i = 0; i <= 6; i++) { const t = i / 6, s = t * t * (3 - 2 * t); out.push([rBase + (r - rBase) * s, y0 + bt * t]); }
  out.push([r, y0 + bt + cyl]);
  for (const p of ogive(r, L, y0 + bt + cyl, n)) if (p[1] > y0 + bt + cyl) out.push(p);
  return out;
}
// crew capsule: heat-shield rim, sidewall cone, shoulder, domed nose cap (base radius r, starts at y0)
export function capsule(r, y0 = 0) {
  return [[0, y0], [r * 0.98, y0], [r, y0 + 0.25], [r * 0.95, y0 + 0.6], [r * 0.6, y0 + 3.0], [r * 0.54, y0 + 3.2], [r * 0.5, y0 + 3.35], [r * 0.47, y0 + 3.6], [r * 0.38, y0 + 3.8], [r * 0.22, y0 + 3.95], [0, y0 + 4.0]];
}
// heron-9 payload fairing (specs sheet: 5.2 m dia x ~13.1 m, on the 3.66 m stage): boattail + barrel + ogive
export const HERON_FAIRING = { r: 2.6, rBase: 1.83, bt: 1.2, cyl: 5.2, nose: 6.7 };
// all nose/fairing profiles used by the models (tests check each one)
export const NOSES = {
  'heron-9.fairing': () => fairing(HERON_FAIRING.r, HERON_FAIRING.cyl, HERON_FAIRING.nose, 0, HERON_FAIRING.rBase, 18, HERON_FAIRING.bt),
  'heron-heavy.sidenose': () => ogive(1.83, 6.2),
  'sparrow-1.fairing': () => fairing(0.75, 0.3, 1.65, 0, 0.66),
  'heron-9-crew.capsule': () => capsule(1.85),
  'titan.shipnose': () => ogive(4.5, 16, 0, 18, 0.12),
};
