// Headless bridge between a universe vessel and today's flight snapshot.
// Fly builds a snapshot the flight view can load. Leave writes that flight back
// onto the vessel. The map reads every other vessel at the universe clock.
// Nothing here touches the page. The flight module tag matches main.js so the
// browser keeps a single Flight.

import { railsState } from '../core/propagator.js?v=f5.9-46';
import { Flight } from '../flight.js?v=f5.9-40';
import { validate, cloneDesign } from '../parts.js?v=f5.9-27';
import { BODIES } from '../physics/solar.js?v=f5.9-27';
import { elements } from '../physics/kepler.js?v=f5.9-27';

const SITUATION_LABEL = {
  prelaunch: 'On the pad',
  landed: 'Landed',
  flying: 'Flying',
  orbiting: 'In orbit',
  escaping: 'Escaping',
  docked: 'Docked',
  destroyed: 'Destroyed',
};

const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

export function bodyName(id) {
  const b = BODIES[id];
  return (b && b.name) || id || 'Earth';
}

export function describeVessel(vessel) {
  return {
    id: vessel.id,
    name: vessel.name,
    body: vessel.body,
    bodyName: bodyName(vessel.body),
    situation: vessel.situation,
    situationLabel: SITUATION_LABEL[vessel.situation] || vessel.situation,
    flyable: vessel.situation !== 'destroyed',
  };
}

function stagesOk(veh) {
  return !!(veh && Array.isArray(veh.stages) && veh.stages.length && veh.stages.every(s => s && Array.isArray(s.parts)));
}

function designFor(vessel) {
  const d = vessel.legacy && vessel.legacy.design;
  if (d && Array.isArray(d.parts) && d.parts.length) {
    try {
      const c = cloneDesign(d);
      c.name = vessel.name || c.name || 'Vessel';
      if (validate(c).ok) return c;
    } catch (e) { /* a saved design that no longer builds falls through to the probe */ }
  }
  return { name: vessel.name || 'Probe', parts: [{ id: 'probe' }, { id: 'tank-s' }, { id: 'spark' }] };
}

function copyStubFuel(flight, veh) {
  if (!veh || !Array.isArray(veh.stages) || !flight.v || !Array.isArray(flight.v.stages)) return;
  flight.v.stages.forEach((s, i) => {
    const f = veh.stages[i] && veh.stages[i].fuel;
    if (Number.isFinite(+f) && s.fuelMax > 0) s.fuel = Math.min(s.fuelMax, Math.max(0, +f));
  });
}

function place(flight, vessel, st) {
  const v = flight.v;
  v.clamped = st.situation === 'prelaunch';
  v.holdDown = false;
  v.body = st.body;
  v.r = st.r.slice();
  v.v = st.v.slice();
  v.clock = 0;
  v.ut = 0;
  v.throttle = vessel.control && Number.isFinite(+vessel.control.throttle) ? +vessel.control.throttle : 0;
  v.sas = (vessel.control && vessel.control.sas) || v.sas || 'stab';
  flight.t0 = st.epoch;
  flight.ignited = st.situation !== 'prelaunch' && st.situation !== 'destroyed';
  flight.ascent = st.situation === 'prelaunch' || st.situation === 'flying';
  flight.parked = st.situation === 'landed' ? { t: st.epoch } : null;
  flight.flags.orbit = st.situation === 'orbiting' ? 1 : 0;
  flight.flags.dead = st.situation === 'destroyed' ? 'destroyed' : '';
  flight.nodes = clone(vessel.nodes || []);
  if (!(st.situation === 'prelaunch')) v.clamped = false;
}

function situationFromSnapshot(snap) {
  const f = snap.f || {}, veh = snap.veh || {};
  if (f.flags && f.flags.dead) return 'destroyed';
  if (f.parked || (f.flags && f.flags.landed)) return 'landed';
  if (veh.clamped || f.ignited === false) return 'prelaunch';
  const body = snap.body || veh.body || 'earth';
  const b = BODIES[body] || BODIES.earth;
  const el = elements(veh.r, veh.v, b.mu, b.R);
  if (el.rp < b.R) return 'flying';
  return el.e < 1 ? 'orbiting' : 'escaping';
}

// { design, snapshot, opts } for today's flight view. The snapshot is loaded with Flight.loadSnapshot.
export function flightSeed(vessel, universe) {
  const st = railsState(vessel, universe.clock.ut);
  const design = designFor(vessel);
  const opts = { body: st.body, t0: st.epoch, earthRot: st.body === 'earth' };
  const flight = new Flight(design, {}, opts);
  const legacy = vessel.legacy || {};
  const saved = legacy.veh;
  let usedSaved = false;
  if (stagesOk(saved) && saved.stages.length === flight.v.stages.length) {
    try {
      const base = flight.snapshot();
      const veh = clone(saved);
      veh.r = st.r.slice();
      veh.v = st.v.slice();
      veh.body = st.body;
      veh.clock = 0;
      veh.clamped = st.situation === 'prelaunch';
      if (vessel.control) {
        if (vessel.control.sas) veh.sas = vessel.control.sas;
        if (Number.isFinite(+vessel.control.throttle)) veh.throttle = +vessel.control.throttle;
      }
      base.veh = veh;
      base.body = st.body;
      base.tAbs = st.epoch;
      base.f.t0 = st.epoch;
      base.f.nodes = clone(vessel.nodes || []);
      base.f.ignited = st.situation !== 'prelaunch' && st.situation !== 'destroyed';
      base.f.parked = st.situation === 'landed' ? ((legacy.flight && legacy.flight.parked) || { t: st.epoch }) : null;
      base.f.ascent = st.situation === 'prelaunch' || st.situation === 'flying';
      base.f.flags = Object.assign({}, base.f.flags, {
        orbit: st.situation === 'orbiting' ? 1 : 0,
        dead: st.situation === 'destroyed' ? 'destroyed' : '',
      });
      flight.loadSnapshot(base);
      usedSaved = true;
    } catch (e) { usedSaved = false; }
  }
  if (!usedSaved) {
    place(flight, vessel, st);
    copyStubFuel(flight, saved);
  }
  return { design: flight.design, snapshot: flight.snapshot(), opts };
}

// Write a flight snapshot back onto the vessel. Does not touch the store; the caller saves.
export function commitFlight(universe, id, snap) {
  const vessel = universe.get(id);
  if (!vessel || !snap || !snap.veh || !Array.isArray(snap.veh.r) || !Array.isArray(snap.veh.v)) return false;
  const veh = snap.veh;
  const f = snap.f || {};
  const tAbs = Number.isFinite(+snap.tAbs) ? +snap.tAbs : universe.clock.ut;
  vessel.body = snap.body || veh.body || vessel.body || 'earth';
  vessel.orbit.epoch = tAbs;
  vessel.orbit.r = veh.r.slice();
  vessel.orbit.v = veh.v.slice();
  vessel.situation = situationFromSnapshot(snap);
  vessel.control.sas = veh.sas || vessel.control.sas;
  vessel.control.throttle = Number.isFinite(+veh.throttle) ? +veh.throttle : 0;
  vessel.nodes = Array.isArray(f.nodes) ? clone(f.nodes) : [];
  const legacy = vessel.legacy && typeof vessel.legacy === 'object' ? clone(vessel.legacy) : {};
  delete legacy.earthAssumed;
  legacy.design = snap.design || legacy.design || null;
  legacy.veh = clone(veh);
  legacy.flight = clone(f);
  vessel.legacy = legacy;
  universe.setActive(id);
  if (tAbs > universe.clock.ut) universe.clock.jump(tAbs - universe.clock.ut);
  universe.clock.setMode('physics');
  universe.clock.setWarp(1);
  return true;
}

function duck(vessel, st) {
  const nodes = clone(vessel.nodes || []);
  return {
    tAbs: st.epoch,
    body: st.body,
    target: null,
    nodes,
    alarms: [],
    flags: { orbit: vessel.situation === 'orbiting' ? 1 : 0 },
    ignited: vessel.situation !== 'prelaunch',
    ended: false,
    parked: vessel.situation === 'landed' ? true : null,
    _imp: null,
    v: { r: st.r.slice(), v: st.v.slice(), body: st.body, clock: 0, thrust: 0, ut: 0, throttle: 0 },
    nodeBurnTime() { return 0; },
    addNode() { return null; },
    removeNode() {},
    setExec() {},
    setSAS() {},
    warpTo() { return false; },
    warpToNode() { return false; },
    warpToSOI() { return false; },
    warpToApsis() { return false; },
    addAlarm() {},
    removeAlarm() {},
    burnModel() { return null; },
    nodeRemaining() { return null; },
    switchTo() { return false; },
  };
}

// What the solar map draws: the focused vessel, and every other one as a satellite.
export function mapView(universe, focusId) {
  const live = [...universe.vessels.values()].filter(v => v.situation !== 'destroyed');
  if (!live.length) return null;
  const focus = live.find(v => v.id === focusId) || live[0];
  const st = railsState(focus, universe.clock.ut);
  const flight = duck(focus, st);
  flight.tAbs = universe.clock.ut;
  const sats = live.filter(v => v.id !== focus.id).map(v => {
    const s = railsState(v, universe.clock.ut);
    return { id: v.id, name: v.name, r: s.r, v: s.v, t: universe.clock.ut, body: s.body };
  });
  return { flight, sats, focusId: focus.id };
}

// A map host with no craft, so an empty station still shows the planets.
export function emptyFlight(universe) {
  const R = BODIES.earth.R;
  const ut = universe.clock.ut;
  return {
    tAbs: ut,
    body: 'earth',
    target: null,
    nodes: [],
    alarms: [],
    flags: {},
    ignited: false,
    ended: false,
    _imp: null,
    v: { r: [R * 3, 0, 0], v: [0, Math.sqrt(BODIES.earth.mu / (R * 3)), 0], body: 'earth', clock: 0, thrust: 0, ut: 0 },
    nodeBurnTime() { return 0; },
    addNode() { return null; },
    removeNode() {},
    setExec() {},
    setSAS() {},
    warpTo() { return false; },
    warpToNode() { return false; },
    warpToSOI() { return false; },
    warpToApsis() { return false; },
    addAlarm() {},
    removeAlarm() {},
    burnModel() { return null; },
    nodeRemaining() { return null; },
    switchTo() { return false; },
  };
}
