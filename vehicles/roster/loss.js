// Ascent loss model for roster vehicles (data-only; not wired into the game).
// Roster data units: masses kg, thrust kN, Isp s, burn s; values trace to neutral spec ids (resolved outside this repo); est lists
// ESTIMATE fields. Stage group: 0 = lit at liftoff, higher = lit when the previous group is spent.
// Two paths (spec:loss-model#v3):
// - published loss set (gravity, drag, steering from one published table): rocket equation via sim() with gravity off.
// - otherwise fly(): a 2-D point-mass ascent whose gravity and turning losses come out of the physics; the payload is the
//   largest one for which ANY trajectory in a fixed family reaches the source orbit. Never fitted to a payload.
// sim() keeps the old 1-D imposed-profile model (K, STEER) for the published path and for comparison.
export const G0 = 9.80665, MU = 3.986004418e14, RE = 6378137, VEQ = 465.1;
export const K = 6.75, DRAG_C = 1.8e6, STEER = 100; // all spec:loss-model (EST); STEER only for a published set without a steering figure
export const TOL = 0.15; // model spread justified in spec:loss-model#tolerance
export const vPerigee = (hp, ha) => { const rp = RE + hp * 1e3, ra = RE + ha * 1e3; return Math.sqrt(MU * (2 / rp - 2 / (rp + ra))); };
const ispOf = (engines, E, key) => { let t = 0, f = 0; for (const [id, n] of Object.entries(engines)) { const e = E[id]; const isp = key === 'sl' && e.ispSl > 0 ? e.ispSl : e.ispVac; t += n * e.tVac; f += n * e.tVac / isp; } return t / f; };
export function sim(v, E, P, vt, v0, { nograv = false, steer = true, dt = 0.25 } = {}) {
  const S = v.stages.map(s => ({ ...s, left: s.prop, mdot: s.prop / s.burn, sl: ispOf(s.engines, E, 'sl'), vac: ispOf(s.engines, E, 'vac'), g: s.group }));
  const maxg = Math.max(...S.map(s => s.g)); const fair = v.fairing || 0;
  let m = S.reduce((a, s) => a + s.prop + s.dry, 0) + P + fair, vel = v0, t = 0, grp = 0, gl = 0, sl = 0, fairOn = true;
  for (;;) {
    const act = S.filter(s => s.g <= grp && s.left > 1e-6);
    if (!act.length) { if (grp >= maxg) return { ok: vel >= vt, m, gl, sl }; grp++; if (fairOn) { m -= fair; fairOn = false; } continue; }
    let T = 0;
    for (const s of act) { const isp = s.g === 0 ? s.vac - (s.vac - s.sl) * Math.exp(-t / 45) : s.vac; T += Math.min(s.mdot, s.left / dt) * isp * G0; }
    const f = Math.min(Math.max((vel - v0) / (vt - v0), 0), 1), vert = vel < v0 + 60, gam = vert ? Math.PI / 2 : Math.PI / 2 * (1 - f) ** K;
    const geff = nograv ? 0 : G0 * Math.max(1 - vel * vel / ((RE + 150e3) * G0), 0), a = T / m;
    // turning (steering) loss, physics: following γ(v) needs a normal acceleration v·dγ/dt + g_eff·cosγ (gravity alone turns the
    // path down at g_eff·cosγ/v). Thrust supplies it by pitching off the velocity by α; the loss is a·(1 − cosα).
    let ca = 1;
    if (steer && !vert && a > 0) {
      const dgdv = -Math.PI / 2 * K * (1 - f) ** (K - 1) / (vt - v0), gc = (nograv ? G0 * Math.max(1 - vel * vel / ((RE + 150e3) * G0), 0) : geff) * Math.cos(gam);
      for (let i = 0; i < 4; i++) { const vdot = a * ca - geff * Math.sin(gam), sa = Math.min(Math.abs(vel * dgdv * vdot + gc) / a, 1); ca = Math.sqrt(1 - sa * sa); }
    }
    vel += (a * ca - geff * Math.sin(gam)) * dt; gl += geff * Math.sin(gam) * dt; sl += a * (1 - ca) * dt;
    for (const s of act) { const b = Math.min(s.mdot * dt, s.left); s.left -= b; m -= b; if (s.left <= 1e-6 && !s.dropped) { s.left = 0; m -= s.dry; s.dropped = true; } }
    t += dt;
  }
}
// 2-D point-mass ascent (polar plane, inertial, spherical gravity). Stages lit by group as above; group-0 stages fly a gravity
// turn along the air-relative velocity after a vertical rise to 60 m/s and an instantaneous kick of δ; later groups steer at
// β(τ) = β0·(1 − τ) above the local horizontal (τ = fraction of the upper burn time used). δ and β0 are trajectory
// choices searched per payload (best of a fixed grid): the model asks "can ANY such trajectory reach the source orbit?",
// so gravity and turning losses come out of the physics instead of an imposed profile. Drag: the area/m0 Δv (DRAG_C, EST)
// applied along the velocity over the first DRAG_T s (EST). Success: perigee ≥ hp and apogee ≥ ha of the source orbit.
export const DRAG_T = 120, GT_ALT = 45000, PARK = 120000; // PARK m: lowest transfer perigee for a restart (EST) // m: gravity turn below, linear-tangent steering above (EST)
// trajectory grid (gamebot-specs/roster-gaps): kick 0.25–15° step 0.25°, β0 −20–85° step 2.5°, gravity-turn ceiling 30/45/60 km
const KICKS = Array.from({ length: 60 }, (_, i) => (i + 1) * 0.25 * Math.PI / 180), BETAS = Array.from({ length: 43 }, (_, i) => (-20 + 2.5 * i) * Math.PI / 180), GTS = [30000, 45000, 60000];
export function fly(v, E, P, orbit, v0, drag, kick, beta0, gtAlt = GT_ALT, dt = 0.5) {
  const S = v.stages.map(s => ({ ...s, left: s.prop, mdot: s.prop / s.burn, sl: ispOf(s.engines, E, 'sl'), vac: ispOf(s.engines, E, 'vac'), g: s.group }));
  const maxg = Math.max(...S.map(s => s.g)), fair = v.fairing || 0, rpT = RE + orbit.hp * 1e3, raT = RE + orbit.ha * 1e3;
  let upT = 0, tu0 = null;
  let m = S.reduce((a, s) => a + s.prop + s.dry, 0) + P + fair, r = RE, vr = 0, vh = v0, t = 0, tu = 0, grp = 0, kicked = false, coasted = false, gl = 0, sl = 0, ideal = 0;
  for (;;) {
    const act = S.filter(s => s.g <= grp && s.left > 1e-6 && t >= (s.igniteAt || 0)); // igniteAt (s, sourced sequence): air-lit strap-ons
    if (!act.length && S.some(s => s.g <= grp && s.left > 1e-6)) { const g = MU / (r * r); vr += (vh * vh / r - g) * dt; vh -= vr * vh / r * dt; r += vr * dt; gl += g * dt; t += dt; continue; } // coasting to a timed ignition
    if (!act.length) { if (grp >= maxg) return { ok: false, gl, sl }; grp++; if (fair) { m -= fair * (grp === 1); } continue; }
    let T = 0; for (const s of act) { const isp = s.g === 0 ? s.vac - (s.vac - s.sl) * Math.exp(-t / 45) : s.vac; T += Math.min(s.mdot, s.left / dt) * isp * G0; }
    const a = T / m, g = MU / (r * r), wa = vh - v0 * r / RE, sp = Math.hypot(vr, wa);
    let ur, uh; // thrust direction (radial, horizontal)
    if (grp === 0 && r - RE < gtAlt) {
      if (sp < 60 || !kicked) { ur = 1; uh = 0; if (sp >= 60) { kicked = true; const vv = sp; vr = vv * Math.cos(kick); vh = vv * Math.sin(kick) + v0 * r / RE; } }
      else { ur = vr / sp; uh = wa / sp; }
    } else {
      if (tu0 === null) { tu0 = t; upT = S.reduce((a, s) => a + s.left / s.mdot * (s.g <= grp ? 1 : 0), 0) + S.filter(s => s.g > grp).reduce((a, s) => a + s.burn, 0); } // remaining burn time (overlapping groups counted once by their longest stage EST)
      const b = coasted ? 0 : Math.atan(Math.tan(beta0) * (1 - Math.min(tu / upT, 1))); ur = Math.sin(b); uh = Math.cos(b); tu += dt; }
    const vi = Math.hypot(vr, vh), dr = t < DRAG_T ? drag / DRAG_T : 0;
    const ar = a * ur - g + vh * vh / r - dr * vr / vi, ah = a * uh - vr * vh / r - dr * vh / vi;
    gl += g * (vr / vi) * dt; sl += a * (1 - (ur * vr + uh * vh) / vi) * dt; ideal += a * dt;
    r += vr * dt; vr += ar * dt; vh += ah * dt; t += dt;
    if (r < RE - 1) return { ok: false, gl, sl };
    for (const s of act) { const bb = Math.min(s.mdot * dt, s.left); s.left -= bb; m -= bb; if (s.left <= 1e-6) s.left = 0; }
    for (const s of S) if (s.left === 0 && !s.dropped && t >= (s.jettisonAt || 0)) { m -= s.dry; s.dropped = true; } // jettisonAt (s, sourced sequence): spent strap-ons carried until jettison
    if (tu0 !== null) { // orbit check
      const en = (vr * vr + vh * vh) / 2 - MU / r, hh = r * vh; if (en < 0) { const sma = -MU / (2 * en), e = Math.sqrt(Math.max(0, 1 + 2 * en * hh * hh / (MU * MU)));
        const rp = sma * (1 - e), ra = sma * (1 + e);
        if (rp >= rpT && ra >= raT) return { ok: true, gl, sl, ideal, t };
        // restartable final stage (sourced `restart` flag + restartSrc): cut off once the apogee reaches the target (and is
        // above PARK, EST), coast to apogee (Kepler, exact), then burn again prograde-horizontal there, integrated as a finite
        // burn so its gravity/steering losses are counted. The cut-off orbit may be suborbital: coast-then-burn, as flown.
        const last = S[S.length - 1];
        if (last.restart && !coasted && act.length === 1 && act[0] === last && ra >= RE + PARK && ra >= raT && ra >= rpT) {
          coasted = true; r = ra; vr = 0; vh = hh / ra; continue;
        } }
    }
  }
}
// best trajectory on the grid: a combo is bisected only if it beats the current best payload
export function best(v, E, orbit, v0, drag) {
  let b = null;
  for (const g of GTS) for (const k of KICKS) for (const be of BETAS) {
    const P0 = b ? b.P + 1 : 0; if (!fly(v, E, P0, orbit, v0, drag, k, be, g).ok) continue;
    let lo = P0, hi = Math.max(2 * P0, 1000); while (fly(v, E, hi, orbit, v0, drag, k, be, g).ok) { lo = hi; hi *= 2; }
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (fly(v, E, m, orbit, v0, drag, k, be, g).ok) lo = m; else hi = m; }
    b = { P: lo, k, be, g };
  }
  return b && { ...fly(v, E, b.P, orbit, v0, drag, b.k, b.be, b.g), P: b.P, kick: b.k, beta: b.be, gtAlt: b.g };
}
export function modelPayload(v, E, mode, opt = {}) {
  if (mode.stagesUsed) v = { ...v, stages: v.stages.slice(0, mode.stagesUsed) }; // reference figure for the lower stages only
  const { hp, ha, inc } = mode.orbit, vt = vPerigee(hp, ha), v0 = VEQ * Math.cos(inc * Math.PI / 180);
  const m0 = v.stages.reduce((a, s) => a + s.prop + s.dry, 0) + (v.fairing || 0) + mode.payload;
  const pub = opt.physics ? null : v.publishedLoss, drag = pub ? pub.drag : DRAG_C * v.area / m0, extra = mode.orbitMass ? v.stages[v.stages.length - 1].dry : 0;
  if (pub) { // published gravity, drag and steering figures (rocket equation only)
    const target = vt + drag + pub.grav + (pub.steer ?? STEER), o = { nograv: true, steer: false };
    if (!sim(v, E, 0, target, v0, o).ok) return { payload: 0, drag };
    let lo = 0, hi = 500000; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (sim(v, E, mid, target, v0, o).ok) lo = mid; else hi = mid; }
    return { payload: lo + extra, drag, gl: pub.grav, steer: pub.steer ?? STEER };
  }
  const r = best(v, E, mode.orbit, v0, drag); if (!r) return { payload: 0, drag };
  const lo = r.P;
  return { payload: lo + extra, drag, gl: r.gl, steer: r.sl, kick: r.kick * 180 / Math.PI, beta: r.beta * 180 / Math.PI };
}
