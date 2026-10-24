// Payload lifecycle (f5.2.3): deployed payloads and debris persist in a saved world list and fly on rails (two-body Kepler
// around Earth). Each record keeps the state vector at its epoch (r, v in the inertial Earth frame, t = Flight.tAbs).
import { propagate, elements } from '../physics/kepler.js?v=f5.8t';
import { R_E, MU_E } from '../physics/constants.js?v=f5.8t';
export const KEY = 'orbitrush.world.v1';
export const DECAY_PE = 120000; // m: below this periapsis an object re-enters within a few orbits; dropped from the list
const blank = () => ({ v: 1, seq: 0, objs: [] });
export function load(store) { try { const s = JSON.parse(store.getItem(KEY) || 'null'); if (s && Array.isArray(s.objs)) return s; } catch (e) {} return blank(); }
export function save(store, s) { try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const orbit = o => { const e = elements(o.r, o.v, MU_E, R_E); return { ap: e.ra - R_E, pe: e.rp - R_E, e: e.e, T: e.T }; };
export function add(store, rec) { const s = load(store); const o = { id: 'o' + (++s.seq), kind: 'sat', ...rec, r: rec.r.slice(), v: rec.v.slice() };
  const k = orbit(o); if (!(k.pe > DECAY_PE) || !(k.e < 1)) return null; s.objs.push(o); save(store, s); return o; }
export function stateAt(o, t) { return propagate(o.r, o.v, t - o.t, MU_E); }
export const sats = s => s.objs.filter(o => o.kind === 'sat');
export const count = (s, group) => sats(s).filter(o => !group || o.group === group).length;
export function clear(store) { save(store, blank()); }
