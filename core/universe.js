// One universe: one clock, a vessel registry, and one versioned JSON save.
// Storage is injected ({ getItem, setItem }): the browser store in the game, a Map-like object
// in tests. This module never touches the page and never deletes the legacy keys.
//
// Save key: orbitrush.universe. The version lives inside the JSON (v: 3), so migrations do not
// need a new key. v1 was a flat fleet-style record { id, name, body, t, r, v, sas, throttle }.
// v2 is the vessel record from ARCHITECTURE.md (orbit, parts, control, nodes) plus the clock.
// v3 is that record with a part tree: empty parts are filled from legacy.veh stages when those
// stages exist. Legacy keys on the vessel and in the store are kept.
//
// Legacy import reads fun/world.js (`orbitrush.world.v1`) and the quicksave in main.js
// (`orbitrush.quicksave.v1`) when the universe key is absent. Those keys are left byte-for-byte.
// The live game still writes them; nothing here is wired into the UI.

import { Clock, PHYSICS_WARP_MAX } from './clock.js';
import { Vessel } from './vessel.js';
import { treeFromLegacyVehicle } from './stage.js';

export const SAVE_KEY = 'orbitrush.universe';
export const VERSION = 3;
export const LEGACY_KEYS = {
  world: 'orbitrush.world.v1',
  quicksave: 'orbitrush.quicksave.v1',
};

const finite = (x, fallback) => {
  const n = +x;
  return Number.isFinite(n) ? n : fallback;
};
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

function partsOf(rec) {
  if (Array.isArray(rec.parts) && rec.parts.length) return rec.parts;
  const built = treeFromLegacyVehicle(rec.legacy && rec.legacy.veh);
  const parts = built.toJSON();
  return parts.length ? parts : [];
}
function vesselFrom(rec, id) {
  return new Vessel({ ...rec, id, parts: partsOf(rec) });
}

// v1 flat record → v2 vessel. A requested warp above the physics cap implies rails.
function migrateV1(d) {
  const warp = d.warp == null ? 1 : finite(d.warp, 1);
  return {
    v: 2,
    ut: Math.max(0, finite(d.ut, 0)),
    warp,
    warpMode: d.warpMode === 'rails' || d.warpMode === 'physics' ? d.warpMode : (warp > PHYSICS_WARP_MAX ? 'rails' : 'physics'),
    activeId: d.activeId ?? null,
    seq: finite(d.seq, 0),
    vessels: (Array.isArray(d.vessels) ? d.vessels : []).map(o => vesselFrom({
      ...o,
      situation: o.situation || 'orbiting',
      orbit: o.orbit || { epoch: finite(o.t, 0), r: o.r, v: o.v },
      control: o.control || { sas: o.sas || 'off', throttle: finite(o.throttle, 0) },
    }, o.id)),
  };
}

// v2 vessels keep every key they had. Parts are filled from legacy.veh.stages when the list is empty.
function migrateV2(d) {
  return {
    v: 3,
    ut: Math.max(0, finite(d.ut, 0)),
    warp: d.warp == null ? 1 : finite(d.warp, 1),
    warpMode: d.warpMode === 'rails' || d.warpMode === 'physics' ? d.warpMode : 'physics',
    activeId: d.activeId ?? null,
    seq: finite(d.seq, 0),
    vessels: (Array.isArray(d.vessels) ? d.vessels : []).map(v => {
      if (!v || typeof v !== 'object') return v;
      const parts = Array.isArray(v.parts) && v.parts.length ? v.parts : treeFromLegacyVehicle(v.legacy && v.legacy.veh).toJSON();
      return { ...v, parts };
    }),
  };
}

const MIGRATIONS = { 1: migrateV1, 2: migrateV2 };

// Walk a parsed save up to VERSION. Throws on a version we do not know how to move forward.
export function migrate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not a save');
  let d = data;
  for (let guard = 0; d.v !== VERSION; guard++) {
    if (guard > 10) throw new Error('unknown version ' + d.v);
    const step = MIGRATIONS[d.v];
    if (!step) throw new Error('unknown version ' + d.v);
    d = step(d);
  }
  return d;
}

function noteSeq(u, id) {
  const m = /^v(\d+)$/.exec(id || '');
  if (m) u.seq = Math.max(u.seq, +m[1]);
}

export class Universe {
  constructor(opts = {}) {
    this.clock = opts.clock instanceof Clock ? opts.clock : new Clock({ ut: opts.ut ?? 0, warp: opts.warp ?? 1, mode: opts.mode || opts.warpMode || 'physics' });
    this.vessels = new Map();
    this.activeId = null;
    this.seq = 0;
  }
  get active() { return this.activeId ? this.vessels.get(this.activeId) || null : null; }
  get(id) { return this.vessels.get(id) || null; }
  addVessel(rec) {
    const id = rec && rec.id ? rec.id : 'v' + (++this.seq);
    if (this.vessels.has(id)) throw new Error('duplicate vessel ' + id);
    noteSeq(this, id);
    const vessel = vesselFrom(rec || {}, id);
    this.vessels.set(id, vessel);
    return vessel;
  }
  remove(id) {
    if (!this.vessels.has(id)) return false;
    this.vessels.delete(id);
    if (this.activeId === id) this.activeId = null;
    return true;
  }
  setActive(id) {
    if (id == null) { this.activeId = null; return true; }
    if (!this.vessels.has(id)) return false;
    this.activeId = id;
    return true;
  }
  advance(realSeconds) { return this.clock.advance(realSeconds); }
  toJSON() {
    return {
      v: VERSION,
      ut: this.clock.ut,
      warp: this.clock.warp,
      warpMode: this.clock.mode,
      activeId: this.activeId,
      seq: this.seq,
      vessels: [...this.vessels.values()].map(v => (v && v.toJSON ? v.toJSON() : clone(v))),
    };
  }
  // Write only SAVE_KEY. Legacy keys are not removed and not rewritten.
  save(store) {
    try { store.setItem(SAVE_KEY, JSON.stringify(this.toJSON())); return true; }
    catch (e) { return false; }
  }
  static fromJSON(data) {
    const d = data && data.v === VERSION ? data : migrate(data);
    const u = new Universe({ clock: new Clock({ ut: d.ut, warp: d.warp, mode: d.warpMode || 'physics' }) });
    u.seq = finite(d.seq, 0);
    for (const rec of d.vessels || []) {
      if (!rec || !rec.id) continue;
      u.vessels.set(rec.id, vesselFrom(rec, rec.id));
      noteSeq(u, rec.id);
    }
    u.activeId = d.activeId && u.vessels.has(d.activeId) ? d.activeId : null;
    return u;
  }
  static load(store) {
    const got = readRaw(store, SAVE_KEY);
    if (got.bad || (got.text != null && (got.data == null || typeof got.data !== 'object' || Array.isArray(got.data)))) {
      throw new Error('universe save is not JSON');
    }
    if (got.data) return Universe.fromJSON(migrate(got.data));
    return importLegacy(store);
  }
}

function readRaw(store, key) {
  let text = null;
  try { text = store.getItem(key); } catch (e) { return { text: null, data: null, bad: false }; }
  if (text == null || text === '') return { text: null, data: null, bad: false };
  try { return { text, data: JSON.parse(text), bad: false }; }
  catch (e) { return { text, data: null, bad: true }; }
}

function situationFromFlight(f, veh) {
  if (f && f.flags && f.flags.dead) return 'destroyed';
  if (f && f.parked) return 'landed';
  if ((veh && veh.clamped) || (f && f.ignited === false)) return 'prelaunch';
  if (f && f.flags && f.flags.orbit) return 'orbiting';
  return 'flying';
}
function situationFromFleet(o) {
  if (!o) return 'orbiting';
  if (o.lost || o.boosterState === 'lost') return 'destroyed';
  if (o.boosterState === 'landed') return 'landed';
  if (o.keep || o.returning || o.boosterState === 'flying') return 'flying';
  return 'orbiting';
}

// Read the world list and the quicksave into a v2 universe. Does not write either key.
function importLegacy(store) {
  const world = readRaw(store, LEGACY_KEYS.world);
  const quick = readRaw(store, LEGACY_KEYS.quicksave);
  const u = new Universe();
  const objs = world.data && Array.isArray(world.data.objs) ? world.data.objs : [];
  const q = quick.data && typeof quick.data === 'object' && !Array.isArray(quick.data) ? quick.data : null;
  const fleet = q && q.fleet && Array.isArray(q.fleet.list) ? q.fleet : null;
  const linked = new Set();
  let latest = 0;

  if (fleet) {
    for (const o of fleet.list) {
      if (!o || !o.id || !Array.isArray(o.r) || !Array.isArray(o.v)) continue;
      if (o.worldId) linked.add(o.worldId);
      const active = o.id === fleet.activeId;
      const live = active && q.veh && Array.isArray(q.veh.r) && Array.isArray(q.veh.v) ? q.veh : null;
      const epoch = active && Number.isFinite(+q.tAbs) ? +q.tAbs : finite(o.t, 0);
      if (Number.isFinite(+o.t)) latest = Math.max(latest, +o.t);
      if (Number.isFinite(epoch)) latest = Math.max(latest, epoch);
      const nodes = active && q.f && Array.isArray(q.f.nodes) ? q.f.nodes
        : (o.ctx && Array.isArray(o.ctx.nodes) ? o.ctx.nodes : []);
      const src = live || o.veh || null;
      u.addVessel({
        id: o.id,
        name: o.name || (active && q.design && q.design.name) || 'Vessel',
        situation: active ? situationFromFlight(q.f, live || o.veh) : situationFromFleet(o),
        body: (active && q.body) || o.body || 'earth',
        r: live ? live.r : o.r,
        v: live ? live.v : o.v,
        t: epoch,
        control: {
          sas: (src && src.sas) || 'stab',
          throttle: src && src.throttle != null ? finite(src.throttle, 0) : 0,
        },
        nodes,
        legacy: {
          source: 'fleet',
          type: o.type ?? null,
          worldId: o.worldId ?? null,
          origin: !!o.origin,
          separated: !!o.separated,
          q: o.q || null,
          w: o.w || null,
          power: o.power !== false,
          veh: src,
          design: active ? (q.design || null) : null,
          flight: active ? (q.f || null) : null,
        },
      });
    }
    if (fleet.activeId && u.vessels.has(fleet.activeId)) u.activeId = fleet.activeId;
    u.seq = Math.max(u.seq, finite(fleet.seq, 0));
  } else if (q && q.veh && typeof q.veh === 'object') {
    const veh = q.veh;
    const epoch = finite(q.tAbs, 0);
    latest = Math.max(latest, epoch);
    const vessel = u.addVessel({
      id: 'v1',
      name: (q.design && q.design.name) || 'Rocket',
      situation: situationFromFlight(q.f, veh),
      body: q.body || 'earth',
      r: veh.r, v: veh.v, t: epoch,
      control: { sas: veh.sas || 'stab', throttle: finite(veh.throttle, 0) },
      nodes: q.f && Array.isArray(q.f.nodes) ? q.f.nodes : [],
      legacy: { source: 'quicksave', design: q.design || null, veh, flight: q.f || null },
    });
    u.activeId = vessel.id;
  }

  for (const o of objs) {
    if (!o || o.id == null || linked.has(o.id)) continue;
    if (!Array.isArray(o.r) || !Array.isArray(o.v)) continue;
    if (Number.isFinite(+o.t)) latest = Math.max(latest, +o.t);
    const id = u.vessels.has(o.id) ? 'w:' + o.id : o.id;
    u.addVessel({
      id,
      name: o.name || o.kind || 'Payload',
      situation: 'orbiting',
      body: o.body || 'earth',
      r: o.r, v: o.v, t: finite(o.t, 0),
      control: { sas: 'off', throttle: 0 },
      nodes: [],
      legacy: {
        source: 'world',
        worldId: o.id,
        kind: o.kind ?? null,
        group: o.group ?? null,
        model: o.model ?? null,
        mission: o.mission ?? null,
        craft: o.craft ?? null,
        earthAssumed: !o.body,
        m: o.m ?? null,
        elec: o.elec ?? null,
      },
    });
  }

  const ut = q && Number.isFinite(+q.tAbs) ? Math.max(0, +q.tAbs) : Math.max(0, latest);
  u.clock = new Clock({ ut, warp: 1, mode: 'physics' });
  if (world.data && world.data.seq) u.seq = Math.max(u.seq, finite(world.data.seq, 0));
  return u;
}
