// Campaign save/load: versioned, localStorage-compatible JSON. Validation is structural (schema) and
// semantic: the stored money / reputation / unlocks must equal a replay of the stored flight history, flight
// numbers must be 1..n, every flight must have been affordable and on an unlocked vehicle, scores are bounded,
// and unlocks follow table order. A checksum catches accidental corruption (it is not a secret: the replay
// check is what makes edits pointless). Older versions go through MIGRATIONS before validation.
import { CONTRACTS } from './career.js';
import { replay } from './state.js';
export const SAVE_KEY = 'orbitrush.campaign', VERSION = 2, MAX_SCORE = 100000, MAX_BYTES = 512 * 1024, MAX_FLIGHTS = 5000;
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const body = c => JSON.stringify({ money: c.money, rep: c.rep, unlocked: c.unlocked, done: c.done, flights: c.flights });
// v1 (pre-reputation prototype): { v:1, money, flights:[{mission, ok, score}] } -> v2 (numbered flights, rep, unlocks)
export const MIGRATIONS = {
  1: d => { const flights = (d.flights || []).map((f, i) => ({ n: i + 1, mission: f.mission, vehicle: null, ok: !!f.ok, score: f.score | 0 }));
    const c = replay(flights); return { v: 2, career: c, sum: fnv(body(c)) }; },
};
export function serialize(c) { return JSON.stringify({ format: SAVE_KEY, v: VERSION, career: c, sum: fnv(body(c)) }); }
export function validateCareer(c) {
  const err = [], isInt = x => Number.isInteger(x);
  if (!c || typeof c !== 'object') return ['career missing'];
  if (!isInt(c.money) || c.money < 0) err.push('money must be a non-negative integer');
  if (!isInt(c.rep) || c.rep < 0) err.push('rep must be a non-negative integer');
  if (!Array.isArray(c.unlocked) || !Array.isArray(c.flights) || typeof c.done !== 'object' || !c.done) err.push('bad shape');
  if (err.length) return err;
  c.flights.forEach((f, i) => { if (!f || f.n !== i + 1) err.push(`flight ${i + 1}: bad number`); if (!f || typeof f.mission !== 'string') err.push(`flight ${i + 1}: unknown mission`);
    if (!f || !Object.hasOwn(CONTRACTS, f.mission)) err.push(`flight ${i + 1}: not a contract`);
    if (!f || !isInt(f.score) || f.score < 0 || f.score > MAX_SCORE) err.push(`flight ${i + 1}: bad score`); if (!f || typeof f.ok !== 'boolean') err.push(`flight ${i + 1}: bad ok`); });
  if (err.length) return err;
  let r; try { r = replay(c.flights); } catch (e) { return ['history not replayable: ' + e.message]; }
  if (r.money !== c.money) err.push('money does not match the flight history');
  if (r.rep !== c.rep) err.push('reputation does not match the flight history');
  if (JSON.stringify(r.unlocked) !== JSON.stringify(c.unlocked)) err.push('unlocks out of order or not earned');
  if (JSON.stringify(r.done) !== JSON.stringify(c.done)) err.push('completed contracts do not match the history');
  c.flights.forEach((f, i) => { if (JSON.stringify(f) !== JSON.stringify(r.flights[i])) err.push(`flight ${i + 1}: does not match the replay (vehicle / stipend)`); });
  return err;
}
// Whitelist: keep only known career / flight fields (unknown keys, junk and prototype tricks are dropped).
const FLIGHT_KEYS = ['n', 'mission', 'vehicle', 'ok', 'score', 'stipend'];
export function sanitize(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const pick = (o, ks) => { const r = {}; for (const k of ks) if (Object.hasOwn(o, k)) r[k] = o[k]; return r; };
  const done = {}; if (c.done && typeof c.done === 'object' && !Array.isArray(c.done)) for (const k of Object.keys(c.done)) if (Object.hasOwn(CONTRACTS, k)) done[k] = c.done[k]; else return null;
  if (!Array.isArray(c.flights) || c.flights.length > MAX_FLIGHTS || !Array.isArray(c.unlocked) || c.unlocked.length > 32) return null;
  return { money: c.money, rep: c.rep, unlocked: c.unlocked.filter(x => typeof x === 'string'), done,
    flights: c.flights.map(f => (f && typeof f === 'object' ? pick(f, FLIGHT_KEYS) : f)) };
}
// Returns { ok, career, err, migrated }. Never throws on bad input (corrupt / hostile strings).
export function load(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { ok: false, err: ['save too large or not text'] };
  let d; try { d = JSON.parse(text); } catch (e) { return { ok: false, err: ['not JSON'] }; }
  if (!d || typeof d !== 'object') return { ok: false, err: ['not an object'] };
  let migrated = false;
  for (let guard = 0; d.v !== VERSION && guard < 10; guard++) { const mg = MIGRATIONS[d.v]; if (!mg) return { ok: false, err: ['unknown version ' + d.v] };
    try { d = mg(d); migrated = true; } catch (e) { return { ok: false, err: ['migration failed: ' + e.message] }; } }
  if (!migrated && d.format !== SAVE_KEY) return { ok: false, err: ['wrong format'] };
  const career = sanitize(d.career); if (!career) return { ok: false, err: ['bad career shape'] };
  const err = validateCareer(career); if (err.length) return { ok: false, err };
  if (d.sum !== fnv(body(career))) return { ok: false, err: ['checksum mismatch'] };
  return { ok: true, career, migrated };
}
export const saveTo = (store, c) => { try { store.setItem(SAVE_KEY, serialize(c)); return true; } catch (e) { return false; } };
export const loadFrom = store => { let t = null; try { t = store.getItem(SAVE_KEY); } catch (e) { return { ok: false, err: ['storage unavailable'] }; } return t == null ? { ok: false, err: ['no save'] } : load(t); };
