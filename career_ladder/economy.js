// Career ladder economy. Money is integer $K (thousands) everywhere; fmtMoney() is for display only.
//
// Tuning (all numbers here, nothing hidden elsewhere):
//   launch fee        5 % of the rocket's price, charged when the flight starts
//   failed flight     3x the fee IN TOTAL (the fee already paid + 2x more, never below $0)
//   success payout    reward(k) = m(k) x price of the rocket AFTER k; m falls linearly 1.8 -> 1.2 up the ladder.
//                     Tying the pay to the next price makes the ladder completable for any price table:
//                     early on one good flight buys the next rocket, later on a flight buys 60-70 % of it.
//   base / bonus      base = 65 % of the reward (all-AUTO flights still get it); bonus = 35 % x (1 - autoFraction)
//   repeats           NO diminishing returns: a rocket pays the same every time, but it pays in proportion to its
//                     own rung, so re-flying an old rocket is always worse than flying the newest (tested), and
//                     unlocks go strictly in ladder order, so farming cannot skip or break the ladder.
//   stipend           when cash < the cheapest owned launch fee, top up to 3 launches of that rocket
import { LADDER, priceOf } from './ladder.js';
export const FEE_RATE = 0.05, FAIL_MULT = 3, BASE_SHARE = 0.65, M_START = 1.8, M_END = 1.2, START_CASH = 200, STIPEND_LAUNCHES = 3;
export const feeOf = id => Math.max(1, Math.round(priceOf(id) * FEE_RATE));
export const failChargeOf = id => FAIL_MULT * feeOf(id);
const rowIndex = id => LADDER.findIndex(r => r.id === id);
// price of the rocket after `id` (the last rung looks one step past the top at the same growth)
export const nextPriceOf = id => { const k = rowIndex(id); if (k < 0) return 0; return k + 1 < LADDER.length ? priceOf(LADDER[k + 1].id) : Math.round(priceOf(id) * 1.11); };
export const multiplierOf = id => { const k = rowIndex(id); return M_START + (M_END - M_START) * (k / (LADDER.length - 1)); };
export const rewardOf = id => (rowIndex(id) < 0 ? 0 : Math.round(multiplierOf(id) * nextPriceOf(id)));
const clamp01 = x => (typeof x === 'number' && !Number.isNaN(x) ? Math.min(1, Math.max(0, x)) : 1); // unreadable = all-AUTO (no bonus)
// { base, bonus, total } in $K for a success at the given AUTO fraction of the flight (0 = all manual, 1 = all AUTO)
export function payoutOf(id, autoFraction) {
  const full = rewardOf(id), base = Math.round(full * BASE_SHARE), bonus = Math.round((full - base) * (1 - clamp01(autoFraction)));
  return { base, bonus, total: base + bonus };
}
// top-up when the player cannot afford the cheapest owned rocket; 0 if not broke
export function stipendFor(cash, owned) {
  if (!owned || !owned.length) return 0;
  const cheapest = Math.min(...owned.map(feeOf)); if (cash >= cheapest) return 0;
  return STIPEND_LAUNCHES * cheapest - Math.max(0, cash);
}
// display: 750 -> $750K, 1500 -> $1.5M, 2200000 -> $2.2B
export const fmtMoney = k => { const t = n => String(+n.toFixed(n >= 100 ? 0 : 1)); return k < 1000 ? '$' + k + 'K' : k < 1e6 ? '$' + t(k / 1000) + 'M' : '$' + t(k / 1e6) + 'B'; };
