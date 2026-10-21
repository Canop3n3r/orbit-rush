// Δv map (Milestone Q): approximate Δv budgets from Earth's surface to every body, from the real body data
// (patched-conic Hohmann numbers, the same model the planner uses). No DOM.
// Rows: surface → low orbit, ejection from low Earth orbit (LEO) to the target, capture into a low orbit there,
// and low orbit → surface. Values are ideal impulsive burns (plus ascent-loss factors for launches).
import { BODIES, atmTop } from './solar.js?v=f5.4n';
const LEO = 200000, ORBIT_DV = 9400;
export const lowOrbitAlt = id => id === 'earth' ? LEO : Math.max(atmTop(id) * 1.1, Math.min(100000, BODIES[id].R * 0.03), 10000);
const vc = (mu, r) => Math.sqrt(mu / r);
const hyper = (mu, r, vinf) => Math.sqrt(vinf * vinf + 2 * mu / r) - vc(mu, r); // from a circular orbit at r to v∞ (or back)
function hoh(mu, r1, r2) { const a = (r1 + r2) / 2; return { dv1: Math.abs(Math.sqrt(mu * (2 / r1 - 1 / a)) - vc(mu, r1)), dv2: Math.abs(vc(mu, r2) - Math.sqrt(mu * (2 / r2 - 1 / a))), tt: Math.PI * Math.sqrt(a ** 3 / mu) }; }
// Landing / ascent between the surface and low orbit: airless ≈ 1.06 × v_circ (gravity losses); thin air about
// ×1.2; thick atmospheres and the giants are marked (parachutes/aerobraking land; no ascent figure for the giants).
export function surfaceDv(id) {
  const b = BODIES[id]; if (id === 'earth') return { dv: ORBIT_DV, note: 'with air & gravity losses' };
  if (b.kind === 'star' || (b.atm && b.R > 2e7)) return { dv: null, note: 'no surface' };
  const v = vc(b.mu, b.R + lowOrbitAlt(id));
  if (!b.atm) return { dv: v * 1.06, note: 'airless' };
  return { dv: v * (id === 'mars' ? 1.2 : 1.35), note: 'atmosphere: aerobrake & chutes to land' };
}
// The whole map, from LEO. Returns [{ id, name, parent, eject, transfer (s), capture, land, total }].
export function dvMap() {
  const E = BODIES.earth, rL = E.R + LEO, out = [];
  const row = (id, eject, capture, tt) => { const s = surfaceDv(id), land = s.dv; out.push({ id, name: BODIES[id].name, parent: BODIES[id].parent, eject, capture, transfer: tt, land, landNote: s.note, total: eject + capture + (land || 0) }); };
  for (const id of E.children) { const b = BODIES[id], rLow = b.R + lowOrbitAlt(id), h = hoh(E.mu, rL, b.a); row(id, h.dv1, hyper(b.mu, rLow, h.dv2), h.tt); }
  const S = BODIES.sun;
  for (const [id, b] of Object.entries(BODIES)) {
    if (b.parent !== 'sun' || id === 'earth') continue;
    const h = hoh(S.mu, E.a, b.a), rLow = b.R + lowOrbitAlt(id);
    row(id, hyper(E.mu, rL, h.dv1), hyper(b.mu, rLow, h.dv2), h.tt);
    for (const c of b.children) { // moons of other planets: capture at the planet's moon orbit, then into the moon's low orbit
      const m = BODIES[c], vinfP = h.dv2, rM = m.a, toMoon = Math.sqrt(vinfP * vinfP + 2 * b.mu / rM) - vc(b.mu, rM), rLowM = m.R + lowOrbitAlt(c);
      row(c, hyper(E.mu, rL, h.dv1), Math.abs(toMoon) + vc(m.mu, rLowM) * (Math.SQRT2 - 1), h.tt); // + capture from a near-parabolic approach
    }
  }
  return out;
}
export { ORBIT_DV, LEO };
