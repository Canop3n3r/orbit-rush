// Rails state for every unloaded vessel, around any body.
// This wraps physics/kepler, physics/patched and physics/solar. It does not copy their math.
// A jump of any length, including one real second at 1e7× rails warp, is cut at each
// sphere-of-influence crossing and at the surface, then continued in the new frame.
// Legacy world-list objects flagged earthAssumed stay on Earth and use Earth's mu.
// Nothing here imports three or the DOM.

import { propagate, elements } from '../physics/kepler.js?v=f5.9-27';
import { nextEvent, timeToRadius, muB } from '../physics/patched.js?v=f5.9-27';
import { BODIES, transfer, soiOf } from '../physics/solar.js?v=f5.9-27';
import { canTransition } from './vessel.js';

// Surface-relative speed at or below this is a landing. Anything faster is destroyed.
const LAND_SPEED = 8;
const HOLD = new Set(['destroyed', 'prelaunch', 'landed', 'docked']);

const snap = (body, r, v, epoch, situation, impacted) => ({
  body, r: r.slice(), v: v.slice(), epoch, situation, impacted,
});

function surfaceSpeed(body, r, v) {
  const w = (BODIES[body] && BODIES[body].omega) || 0;
  return Math.hypot(v[0] + w * r[1], v[1] - w * r[0], v[2]);
}

function conicSituation(body, r, v) {
  const b = BODIES[body] || BODIES.earth;
  const el = elements(r, v, muB(b.id), b.R);
  if (el.rp < b.R) return 'flying';
  return el.e < 1 ? 'orbiting' : 'escaping';
}

// A craft whose saved state is already inside another SOI belongs to that body.
function adopt(body, r, v, t) {
  for (let k = 0; k < 6; k++) {
    const nb = soiOf(body, r, t);
    if (!nb || nb === body) break;
    const tr = transfer(body, nb, r, v, t);
    body = nb; r = tr.r; v = tr.v;
  }
  return { body, r, v };
}

// nextEvent can miss a crossing on a very long horizon. Find the first time soiOf changes.
function searchSOI(body, r, v, t, horizon) {
  const mu = muB(body);
  let lo = 0, hi = horizon;
  for (let j = 0; j < 52; j++) {
    const mid = (lo + hi) / 2;
    const s = propagate(r, v, mid, mu);
    if (soiOf(body, s.r, t + mid) === body) lo = mid;
    else hi = mid;
  }
  const s = propagate(r, v, hi, mu);
  const nb = soiOf(body, s.r, t + hi) || body;
  if (nb === body) return { body, r: s.r, v: s.v, t: t + horizon, switched: false };
  const tr = transfer(body, nb, s.r, s.v, t + hi);
  return { body: nb, r: tr.r, v: tr.v, t: t + hi, switched: true };
}

function impactSituation(body, r, v) {
  return surfaceSpeed(body, r, v) <= LAND_SPEED ? 'landed' : 'destroyed';
}

// State of one vessel at universal time `ut`, in whatever body's frame it occupies then.
// Does not write the vessel.
export function railsState(vessel, ut) {
  const assumed = !!(vessel.legacy && vessel.legacy.earthAssumed);
  let body = assumed ? 'earth' : (vessel.body || 'earth');
  let r = vessel.orbit.r.slice();
  let v = vessel.orbit.v.slice();
  let t = vessel.orbit.epoch;
  const t1 = +ut;
  if (HOLD.has(vessel.situation) || !(t1 > t)) return snap(body, r, v, t, vessel.situation, false);

  let impacted = false;
  if (assumed) body = 'earth';
  else ({ body, r, v } = adopt(body, r, v, t));
  if (BODIES[body] && Math.hypot(r[0], r[1], r[2]) <= BODIES[body].R) impacted = true;

  for (let k = 0; k < 64 && !impacted && t1 - t > 1e-4; k++) {
    const horizon = t1 - t;
    if (assumed) {
      const hit = timeToRadius(r, v, muB('earth'), BODIES.earth.R, -1);
      if (hit <= horizon) {
        const s = propagate(r, v, Math.max(0, hit), muB('earth'));
        r = s.r; v = s.v; t += Math.max(0, hit); body = 'earth'; impacted = true;
      } else {
        const s = propagate(r, v, horizon, muB('earth'));
        r = s.r; v = s.v; t = t1; body = 'earth';
      }
      break;
    }

    const ev = nextEvent(body, r, v, t, horizon, { stopAlt: 0 });
    if (!ev || !(ev.dt >= 0) || ev.dt > horizon) {
      const s = propagate(r, v, horizon, muB(body));
      const nb = soiOf(body, s.r, t + horizon);
      if (nb && nb !== body) {
        const found = searchSOI(body, r, v, t, horizon);
        if (found.switched) { body = found.body; r = found.r; v = found.v; t = found.t; continue; }
      }
      r = s.r; v = s.v; t = t1;
      break;
    }

    const dt = Math.max(0, ev.dt);
    const s = propagate(r, v, dt, muB(body));
    const tEvent = t + dt;
    if (ev.type === 'soi-enter' || ev.type === 'soi-exit') {
      const tr = transfer(body, ev.to, s.r, s.v, tEvent);
      body = ev.to; r = tr.r; v = tr.v; t = tEvent;
      // A crossing reported at dt 0 would otherwise spin on the boundary.
      if (dt < 1e-3) {
        const nudge = Math.min(1e-2, Math.max(0, t1 - t));
        if (!(nudge > 0)) break;
        const n = propagate(r, v, nudge, muB(body));
        r = n.r; v = n.v; t += nudge;
      }
      continue;
    }
    if (ev.type === 'surface' || ev.type === 'atmosphere') {
      r = s.r; v = s.v; t = tEvent; impacted = true;
      break;
    }
    r = s.r; v = s.v; t = tEvent;
    break;
  }

  const situation = impacted ? impactSituation(body, r, v) : conicSituation(body, r, v);
  return snap(body, r, v, t, situation, impacted);
}

function moveTo(vessel, next) {
  if (!next || vessel.situation === next) return;
  if (canTransition(vessel.situation, next)) { vessel.transition(next); return; }
  if (canTransition(vessel.situation, 'flying') && canTransition('flying', next)) {
    vessel.transition('flying');
    vessel.transition(next);
  }
}

function commit(vessel, st) {
  moveTo(vessel, st.situation);
  vessel.body = st.body;
  vessel.orbit.epoch = st.epoch;
  vessel.orbit.r = st.r.slice();
  vessel.orbit.v = st.v.slice();
}

// Move every vessel that is not under the physics bubble up to the universe clock.
// Physics mode leaves the active vessel where the flight put it. Rails mode coasts that one too.
export function advanceUnloaded(universe) {
  const ut = universe.clock.ut;
  const loaded = universe.clock.mode === 'physics' ? universe.activeId : null;
  const docked = [];
  for (const vessel of universe.vessels.values()) {
    if (loaded && vessel.id === loaded) continue;
    if (vessel.situation === 'docked' && vessel.dockedTo) { docked.push(vessel); continue; }
    commit(vessel, railsState(vessel, ut));
  }
  for (const vessel of docked) {
    const host = universe.get ? universe.get(vessel.dockedTo) : null;
    if (!host || host === vessel) continue;
    vessel.body = host.body;
    vessel.orbit.epoch = host.orbit.epoch;
    vessel.orbit.r = host.orbit.r.slice();
    vessel.orbit.v = host.orbit.v.slice();
  }
  return universe;
}

// Soonest rails event that should drop warp: an SOI change, or the surface.
// Held vessels (pad, landed, docked, destroyed) do not stop the clock.
// A legacy earthAssumed craft stays on Earth's mu and only stops if it meets Earth's surface.
function nextStop(vessel, horizon) {
  if (!vessel || HOLD.has(vessel.situation) || !(horizon > 0)) return null;
  const assumed = !!(vessel.legacy && vessel.legacy.earthAssumed);
  let body = assumed ? 'earth' : (vessel.body || 'earth');
  let r = vessel.orbit.r.slice();
  let v = vessel.orbit.v.slice();
  const t = vessel.orbit.epoch;
  if (assumed) {
    if (Math.hypot(r[0], r[1], r[2]) <= BODIES.earth.R + 1) return { dt: 0, type: 'surface', to: 'earth' };
    const hit = timeToRadius(r, v, muB('earth'), BODIES.earth.R, -1);
    if (hit <= horizon) return { dt: Math.max(0, hit), type: 'surface', to: 'earth' };
    return null;
  }
  const adopted = adopt(body, r, v, t);
  if (adopted.body !== body) return { dt: 0, type: 'soi', to: adopted.body };
  body = adopted.body; r = adopted.r; v = adopted.v;
  const b = BODIES[body];
  if (b && Math.hypot(r[0], r[1], r[2]) <= b.R + 1) return { dt: 0, type: 'surface', to: body };
  const ev = nextEvent(body, r, v, t, horizon, { stopAlt: 0 });
  if (ev && ev.dt >= 0 && ev.dt <= horizon) {
    if (ev.type === 'soi-enter' || ev.type === 'soi-exit') return { dt: ev.dt, type: 'soi', to: ev.to };
    if (ev.type === 'surface' || ev.type === 'atmosphere') return { dt: ev.dt, type: 'surface', to: body };
  }
  const found = searchSOI(body, r, v, t, horizon);
  if (found.switched) return { dt: Math.max(0, found.t - t), type: 'soi', to: found.body };
  return null;
}

// Rails-coast the whole universe by simSeconds, and drop warp to 1× if an SOI change or
// a surface is reached inside that jump. One event per call. Warp is left alone when the
// interval is clear. Returns { moved, stopped, ut }.
export function coast(universe, simSeconds) {
  const want = +simSeconds;
  if (!(want > 0) || !universe || !universe.clock) return { moved: 0, stopped: null, ut: universe && universe.clock ? universe.clock.ut : 0 };
  universe.clock.setMode('rails');
  let best = null;
  for (const vessel of universe.vessels.values()) {
    const ev = nextStop(vessel, want);
    if (!ev) continue;
    if (!best || ev.dt < best.dt) best = { dt: ev.dt, type: ev.type, to: ev.to, id: vessel.id };
  }
  let dt = want;
  let stopped = null;
  if (best) {
    const edge = Math.max(0, best.dt);
    // A sphere-of-influence stop steps one second past the boundary so the handoff commits.
    dt = best.type === 'soi' ? Math.min(want, edge + 1) : Math.min(want, edge);
    if (edge <= 1e-6) dt = Math.min(want, Math.max(dt, Math.min(0.05, want)));
    stopped = { type: best.type, to: best.to, id: best.id };
  }
  const before = universe.clock.ut;
  universe.clock.jump(dt);
  advanceUnloaded(universe);
  if (stopped) universe.clock.setWarp(1);
  return { moved: universe.clock.ut - before, stopped, ut: universe.clock.ut };
}
