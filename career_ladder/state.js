// Career ladder save state: plain JSON-safe object, versioned, whitelisted, injected storage (localStorage in the
// game, a Map-like in tests). Ownership is a COUNT: you own ORDER[0..owned-1], so unlocks are always in ladder order.
// The save is client-side (not tamper-proof); sanitize() only keeps it sane (types, ranges, known ids).
// A flight in progress is NOT saved: its fee is already taken from cash, so a reload mid-flight just forfeits the
// fee (1x), which is always worse than the free revert button.
import { ORDER } from '../data/ladder_meta.js';
import { priceOf } from './ladder.js';
import { START_CASH } from './economy.js';
export const KEY = 'orbitrush.career.ladder', VERSION = 1, MAX_CASH = 1e12, MIN_OWNED = 2;
const int = (x, lo, hi, d) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.floor(x))) : d);
export const blank = () => ({ v: VERSION, cash: START_CASH, owned: MIN_OWNED, flights: 0, wins: {}, fails: 0, stipends: 0 });
export const ownedIds = s => ORDER.slice(0, s.owned);
export const isComplete = s => s.owned >= ORDER.length;
// { id, price, canAfford, shortBy } for the rocket on offer, null when the ladder is finished
export function nextInLine(s) {
  if (isComplete(s)) return null; const id = ORDER[s.owned], price = priceOf(id);
  return { id, price, canAfford: s.cash >= price, shortBy: Math.max(0, price - s.cash) };
}
// unlock the next rocket in line: { ok, id?, cost?, reason? } reason: 'complete' | 'short'
export function buyNext(s) {
  const n = nextInLine(s); if (!n) return { ok: false, reason: 'complete' };
  if (!n.canAfford) return { ok: false, reason: 'short' };
  s.cash -= n.price; s.owned++; return { ok: true, id: n.id, cost: n.price };
}
// old save formats -> current. Returns null for anything unknown or from the future.
// v0 (dev prototype): { v:0, cash in $M (number), owned: [ids in order], flights }  ->  v1: cash in $K, owned count
export const MIGRATIONS = {
  0: d => ({ ...d, v: 1, cash: Math.round((typeof d.cash === 'number' ? d.cash : 0) * 1000), owned: Array.isArray(d.owned) ? d.owned.filter(x => ORDER.includes(x)).length : MIN_OWNED }),
};
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  for (let guard = 0; d.v !== VERSION && guard < 10; guard++) { const m = MIGRATIONS[d.v]; if (!m) return null; d = m(d); }
  return d.v === VERSION ? d : null;
}
// whitelist + clamp; null if it is not an object
export function sanitize(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const wins = {}; if (d.wins && typeof d.wins === 'object' && !Array.isArray(d.wins)) for (const id of ORDER) { const n = Object.keys(d.wins).includes(id) ? int(d.wins[id], 0, 1e6, 0) : 0; if (n > 0) wins[id] = n; }
  return { v: VERSION, cash: int(d.cash, 0, MAX_CASH, START_CASH), owned: int(d.owned, MIN_OWNED, ORDER.length, MIN_OWNED), flights: int(d.flights, 0, 1e7, 0),
    wins, fails: int(d.fails, 0, 1e7, 0), stipends: int(d.stipends, 0, 1e7, 0) };
}
export function load(store) {
  try { const raw = store.getItem(KEY); const s = raw == null ? null : sanitize(migrate(JSON.parse(raw))); return s || blank(); } catch (e) { return blank(); }
}
export function save(store, s) { try { store.setItem(KEY, JSON.stringify(sanitize(s))); return true; } catch (e) { return false; } }
