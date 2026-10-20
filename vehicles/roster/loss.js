// Ascent loss model for roster vehicles (data-only; not wired into the game). Identical file on every roster branch.
// Roster data units: masses kg, thrust kN, Isp s, burn s; values trace to neutral spec ids (resolved outside this repo); est lists
// ESTIMATE fields. Stage group: 0 = lit at liftoff, higher = lit when the previous group is spent.
// Required speed = perigee speed of the source-defined orbit − 465.1·cos(inclination) + drag + steering (+ published gravity loss).
// Gravity loss: published figure where one exists (rocket equation only); otherwise a physics ESTIMATE from each stage's
// mass flow (sourced propellant ÷ sourced burn time), g(1 − v²/rg)·sinγ, γ = 90°·(1 − v/v_target)^K after a vertical
// rise to 60 m/s. K is ONE global constant matched to the two published gravity losses (spec:loss-model#K); it is never
// fitted to a payload. Drag ∝ frontal area / liftoff mass (constant from the two published drag losses); steering 100 m/s EST.
export const G0 = 9.80665, MU = 3.986004418e14, RE = 6378137, VEQ = 465.1;
export const K = 6.75, DRAG_C = 1.8e6, STEER = 100; // all spec:loss-model (EST)
export const TOL = 0.15; // model spread justified in spec:loss-model#tolerance
export const vPerigee = (hp, ha) => { const rp = RE + hp * 1e3, ra = RE + ha * 1e3; return Math.sqrt(MU * (2 / rp - 2 / (rp + ra))); };
const ispOf = (engines, E, key) => { let t = 0, f = 0; for (const [id, n] of Object.entries(engines)) { const e = E[id]; const isp = key === 'sl' && e.ispSl > 0 ? e.ispSl : e.ispVac; t += n * e.tVac; f += n * e.tVac / isp; } return t / f; };
export function sim(v, E, P, vt, v0, { nograv = false, dt = 0.25 } = {}) {
  const S = v.stages.map(s => ({ ...s, left: s.prop, mdot: s.prop / s.burn, sl: ispOf(s.engines, E, 'sl'), vac: ispOf(s.engines, E, 'vac'), g: s.group }));
  const maxg = Math.max(...S.map(s => s.g)); const fair = v.fairing || 0;
  let m = S.reduce((a, s) => a + s.prop + s.dry, 0) + P + fair, vel = v0, t = 0, grp = 0, gl = 0, fairOn = true;
  for (;;) {
    const act = S.filter(s => s.g <= grp && s.left > 1e-6);
    if (!act.length) { if (grp >= maxg) return { ok: vel >= vt, m, gl }; grp++; if (fairOn) { m -= fair; fairOn = false; } continue; }
    let T = 0;
    for (const s of act) { const isp = s.g === 0 ? s.vac - (s.vac - s.sl) * Math.exp(-t / 45) : s.vac; T += Math.min(s.mdot, s.left / dt) * isp * G0; }
    const f = Math.min(Math.max((vel - v0) / (vt - v0), 0), 1), gam = vel < v0 + 60 ? Math.PI / 2 : Math.PI / 2 * (1 - f) ** K;
    const geff = nograv ? 0 : G0 * Math.max(1 - vel * vel / ((RE + 150e3) * G0), 0);
    vel += (T / m - geff * Math.sin(gam)) * dt; gl += geff * Math.sin(gam) * dt;
    for (const s of act) { const b = Math.min(s.mdot * dt, s.left); s.left -= b; m -= b; if (s.left <= 1e-6 && !s.dropped) { s.left = 0; m -= s.dry; s.dropped = true; } }
    t += dt;
  }
}
export function modelPayload(v, E, mode) {
  const { hp, ha, inc } = mode.orbit, vt = vPerigee(hp, ha), v0 = VEQ * Math.cos(inc * Math.PI / 180);
  const m0 = v.stages.reduce((a, s) => a + s.prop + s.dry, 0) + (v.fairing || 0) + mode.payload;
  const drag = v.publishedLoss ? v.publishedLoss.drag : DRAG_C * v.area / m0;
  const nograv = !!v.publishedLoss; const target = vt + drag + STEER + (nograv ? v.publishedLoss.grav : 0);
  if (!sim(v, E, 0, target, v0, { nograv }).ok) return { payload: 0, drag };
  let lo = 0, hi = 500000; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (sim(v, E, mid, target, v0, { nograv }).ok) lo = mid; else hi = mid; }
  const gl = nograv ? v.publishedLoss.grav : sim(v, E, lo, target, v0).gl;
  return { payload: lo + (mode.orbitMass ? v.stages[v.stages.length - 1].dry : 0), drag, gl };
}
