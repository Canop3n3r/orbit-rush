// The fleet (f6.2): every vessel a flight leaves in space (the rocket stage itself, each released payload, capsules, deployed cubesats)
// is a persistent record with a state vector at an epoch. Nothing is stepped: a vessel you are not flying coasts on a Kepler orbit
// (exact at any time warp) and its position/attitude/battery are computed on demand for any game time. The one vessel you fly is a
// full 6-DOF vehicle (Flight.v); parking it writes it back to its record, taking control rebuilds it from the record.
// No DOM, no three: tests/fleet.mjs runs it under node.
import { propagate, elements } from '../physics/kepler.js?v=f5.8y';
import { BODIES, sunDir, atmTop } from '../physics/solar.js?v=f5.8y';
import { R_E, MU_E } from '../physics/constants.js?v=f5.8y';
import { qmul, qAxisAngle, norm, len, dot, sub, scale } from '../physics/vec.js?v=f5.8y';
import { buildCraftVehicle, typeOf, engineDv } from '../data/craft_types.js?v=f5.8y';

export const DECAY_ALT = 90000;   // m: a parked vessel whose periapsis is below this re-enters within half an orbit and is removed
export const muOfBody = b => (!b || b === 'earth' ? MU_E : BODIES[b].mu);
export const radOfBody = b => (!b || b === 'earth' ? R_E : BODIES[b].R);
const clone = o => JSON.parse(JSON.stringify(o, (k, x) => (k === '_g' || k === '_scr' || k === '_rel' || k === 'tel' || k === 'therm' ? undefined : x)));
const hash = s => { let h = 7; for (const c of String(s || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

export class Fleet {
  constructor() { this.list = []; this.seq = 0; this.activeId = null; }
  add(rec) { const o = { id: 'v' + (++this.seq), name: 'Vessel', type: 'comsat', body: 'earth', q: [1, 0, 0, 0], w: [0, 0, 0], power: true, veh: null, ctx: null, ...rec,
    r: rec.r.slice(), v: rec.v.slice() }; this.list.push(o); return o; }
  get(id) { return this.list.find(o => o.id === id) || null; }
  remove(id) { const i = this.list.findIndex(o => o.id === id); if (i < 0) return false; this.list.splice(i, 1); if (this.activeId === id) this.activeId = null; return true; }
  get active() { return this.get(this.activeId); }
  others() { return this.list.filter(o => o.id !== this.activeId); }
  // state of a parked vessel at game time t: Kepler position/velocity and the attitude it drifts to
  stateAt(o, t) {
    const dt = t - o.t, s = dt ? propagate(o.r, o.v, dt, muOfBody(o.body)) : { r: o.r.slice(), v: o.v.slice() }; let q = o.q;
    const wl = o.w ? len(o.w) : 0; if (wl > 1e-9 && dt) q = qmul(o.q, qAxisAngle(o.w, wl * dt)); // a tumbling vessel keeps turning about its own axis
    return { r: s.r, v: s.v, q };
  }
  orbitOf(o, t) { const s = this.stateAt(o, t), mu = muOfBody(o.body), Rb = radOfBody(o.body), e = elements(s.r, s.v, mu, Rb); return { ap: e.ra - Rb, pe: e.rp - Rb, e: e.e, T: e.T, alt: len(s.r) - Rb, speed: len(s.v), st: s }; }
  // vessels that have come down: remove them (returns the removed records so the caller can say so)
  prune(t) {
    const gone = []; for (const o of [...this.others()]) {
      let k; try { k = this.orbitOf(o, t); } catch (e) { continue; }
      const low = lowAlt(o.body);
      if (k.alt < low || (k.e < 1 && k.pe < low && (t - o.t) > 0.5 * (k.T || 0))) { this.remove(o.id); gone.push(o); } }
    return gone;
  }
}
const lowAlt = b => (!b || b === 'earth' ? DECAY_ALT : BODIES[b].atm ? atmTop(b) : 0); // below this a coasting vessel is in the air (or on the ground) and is gone

// ---- power: sunlight, battery ------------------------------------------------------------------------------------------------
// fraction of the time span the craft is in sunlight (cylindrical Earth shadow), sampled along its Kepler orbit
export function sunlit(body, r, v, t0, dt, samples = 1) {
  const b = body || 'earth', Rb = radOfBody(b), n = Math.max(1, Math.min(48, samples)); let lit = 0;
  for (let i = 0; i < n; i++) { const ti = dt ? (i + 0.5) / n * dt : 0, st = dt ? propagate(r, v, ti, muOfBody(b)).r : r, s = sunDir(b, t0 + ti);
    const along = dot(st, s), perp = len(sub(st, scale(s, along))); if (!(along < 0 && perp < Rb)) lit++; }
  return lit / n;
}
// advance a craft's battery over dt seconds starting at (r, v, t0); throttle is the average engine throttle in the span
export function advanceEnergy(craft, body, r, v, t0, dt, throttle = 0) {
  if (!craft || craft.noPower || !(craft.elecMax > 0) || !(dt > 0)) return craft;
  const n = dt > 60 ? Math.min(48, Math.ceil(dt / 90)) : 1, sun = sunlit(body, r, v, t0, dt, n);
  const gen = craft.solarW * sun, draw = (craft.power && !craft.brown ? craft.idleW + craft.engW * throttle : 0);
  craft.sun = sun; craft.elec = Math.max(0, Math.min(craft.elecMax, craft.elec + (gen - draw) * dt / 3600));
  if (craft.elec <= 0 && gen < draw) craft.brown = true; else if (craft.brown && craft.elec > 0.05 * craft.elecMax) craft.brown = false;
  return craft;
}
export const batteryPct = c => (c && c.elecMax > 0 ? Math.round(100 * c.elec / c.elecMax) : null);

// ---- parking and taking control ------------------------------------------------------------------------------------------------
export function packVehicle(veh) { return clone(veh); }
// a flight vehicle for record o at game time t (clock = t - t0), from its saved vehicle or fresh from its craft type
export function vehicleFor(o, t, t0, earthRot = true) {
  const k = new Fleet().stateAt(o, t); let veh;
  if (o.veh) veh = clone(o.veh);
  else { veh = buildCraftVehicle(o.type, { m: o.m, name: o.name, house: o.house, fuel: o.fuel, mono: o.mono, elec: o.elec }); veh.craft.power = o.power !== false; }
  veh.r = k.r; veh.v = k.v; veh.q = k.q.slice(); veh.w = o.w ? o.w.slice() : [0, 0, 0];
  veh.body = o.body || 'earth'; veh.clock = t - t0; veh.earthRot = earthRot; veh.clamped = false; veh.throttle = 0; veh.ut = 0; veh.auto = false; veh.steerDir = null; veh.input = { pitch: 0, yaw: 0, roll: 0 }; veh.trans = [0, 0, 0]; veh._g = null;
  if (!veh.craft) delete veh.craft; else if (o.power !== undefined) veh.craft.power = o.power;
  if (veh.craft && o.veh) advanceEnergy(veh.craft, veh.body, o.r, o.v, o.t, t - o.t, 0);
  return veh;
}
// A tumbling rate for an unpowered vessel (deterministic from its id): rad/s about a body axis
export const tumbleOf = id => { const h = hash(id), a = ((h % 628) / 100), m = 0.012 + (h % 7) * 0.003; return [m * Math.cos(a), m * 0.4, m * Math.sin(a)]; };

// ---- rows for the vessel list ----------------------------------------------------------------------------------------------------
// One plain row per vessel (the flown vessel from its live vehicle): everything a non-nerd needs to choose one.
export function describeVessel(fleet, o, t, live) {
  const T = typeOf(o.type), active = fleet.activeId === o.id, veh = active && live ? live : o.veh;
  let k = null; try { k = active && live ? { alt: len(live.r) - radOfBody(live.body), speed: len(live.v), ...(() => { const e = elements(live.r, live.v, muOfBody(live.body), radOfBody(live.body)); return { ap: e.ra - radOfBody(live.body), pe: e.rp - radOfBody(live.body), e: e.e, T: e.T }; })() } : fleet.orbitOf(o, t); } catch (e) { k = null; }
  const craft = veh && veh.craft, dv = veh ? engineDv(veh) : estimateDv(o);
  return { id: o.id, name: o.name, type: o.type, cls: T.cls, active, origin: !!o.origin, power: craft ? craft.power !== false : o.power !== false, hasPower: !!(craft ? !craft.noPower : !T.noPower),
    battery: craft ? batteryPct(craft) : null, brown: !!(craft && craft.brown), sun: craft ? craft.sun : null, alt: k ? k.alt : NaN, speed: k ? k.speed : NaN, ap: k ? k.ap : NaN, pe: k ? k.pe : NaN, T: k ? k.T : NaN,
    dv, body: o.body || 'earth', house: o.house || null, carries: craft && craft.carries ? craft.carries : null };
}
function estimateDv(o) { try { return engineDv(buildCraftVehicle(o.type, { m: o.m, fuel: o.fuel, mono: o.mono })); } catch (e) { return 0; } }
export const nearest = (fleet, t, from) => fleet.others().map(o => ({ o, d: len(sub(fleet.stateAt(o, t).r, from)) })).sort((a, b) => a.d - b.d);
