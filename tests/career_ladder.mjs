// Career ladder (pure logic, no UI): meta, order, goals, economy, AUTO tracker, save, session, simulation.
// Public repo rule: neutral ids only; real names stay out of this file (scan below uses ROT13 strings).
import { readFileSync, readdirSync } from 'node:fs';
import * as C from '../vehicles/catalog.js';
import { META, ORDER, CLASSES } from '../data/ladder_meta.js';
import { LADDER, rankOf, goalOf, goalMet, STARTERS, priceOf } from '../career_ladder/ladder.js';
import * as E from '../career_ladder/economy.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

// ---- 1. meta + order ----
const rosterIds = new Set(C.VEHICLES.map(v => v.id));
for (const [k, v] of Object.entries(C)) if (/^ROSTER_/.test(k)) for (const r of v) rosterIds.add(r.id);
ok(rosterIds.size >= 60, 'roster has the expected size: ' + rosterIds.size);
for (const id of rosterIds) ok(META[id] && Number.isInteger(META[id].year) && META[id].year >= 1950 && META[id].year <= 2030 && CLASSES.includes(META[id].cls) && META[id].price > 0, 'meta resolves for ' + id);
for (const id of Object.keys(META)) ok(rosterIds.has(id), 'no stale meta id ' + id);
ok(ORDER.length === rosterIds.size && new Set(ORDER).size === ORDER.length, 'ladder holds every roster id once');
for (let i = 1; i < ORDER.length; i++) ok(META[ORDER[i - 1]].year <= META[ORDER[i]].year, `ladder is year-ordered at ${i}: ${ORDER[i - 1]} -> ${ORDER[i]}`);
for (let i = 1; i < ORDER.length; i++) { const a = META[ORDER[i - 1]], b = META[ORDER[i]]; if (a.year === b.year) ok(CLASSES.indexOf(a.cls) < CLASSES.indexOf(b.cls) || (a.cls === b.cls && a.leo <= b.leo), `same-year tie by class then payload at ${i}`); }
for (let i = 1; i < ORDER.length; i++) ok(META[ORDER[i]].price >= META[ORDER[i - 1]].price, 'prices never fall along the ladder at ' + i);
ok(LADDER.map(r => r.id).join() === ORDER.join() && LADDER.every((r, i) => r.rank === i && rankOf(r.id) === i), 'LADDER rows follow ORDER');
ok(STARTERS.length === 2 && STARTERS[0] === ORDER[0] && STARTERS[1] === ORDER[1], 'a new career owns the oldest two');
ok(META[ORDER[0]].year === Math.min(...Object.values(META).map(m => m.year)), 'oldest rocket first');
// ---- goals ----
for (const r of LADDER) ok(r.goal && r.goal.id && typeof r.goal.label === 'string' && r.goal.label.length <= 24, 'goal with a short label for ' + r.id);
ok(goalOf(ORDER[0]).kind === 'height', 'smallest class gets the height line');
{ const h = goalOf(ORDER[0]), o = { kind: 'orbit', pe: 120000 };
  ok(goalMet(h, { maxAlt: 99999 }) === false && goalMet(h, { maxAlt: 100000 }) === true, 'height line at 100 km');
  ok(goalMet(o, { ap: 250000, pe: 119000 }) === false && goalMet(o, { ap: 250000, pe: 121000 }) === true, 'stable orbit needs Pe above the atmosphere');
  ok(goalMet({ kind: 'target', ap: 400000, pe: 300000 }, { ap: 410000, pe: 305000 }) && !goalMet({ kind: 'target', ap: 400000, pe: 300000 }, { ap: 410000, pe: 100000 }), 'Ap/Pe target');
  ok(goalMet({ kind: 'target', ap: 1e8, pe: 180000 }, { ap: Infinity, pe: 200000 }), 'escape counts as Ap above target');
  ok(!goalMet(o, {}) && !goalMet(o, { ap: NaN, pe: NaN }) && !goalMet(null, { pe: 1e9 }), 'missing or NaN readings never meet a goal'); }
// ---- 2. economy ----
{ const id = ORDER[5], p = priceOf(id);
  ok(E.feeOf(id) === Math.round(p * 0.05), 'launch fee is 5% of the rocket price');
  ok(E.failChargeOf(id) === 3 * E.feeOf(id), 'a failed flight costs 3x the fee in total');
  const full = E.payoutOf(id, 0), auto = E.payoutOf(id, 1), half = E.payoutOf(id, 0.5);
  ok(full.total === E.rewardOf(id) && full.total === full.base + full.bonus, 'payout = base + bonus; manual gets the full reward');
  ok(auto.bonus === 0 && auto.base === full.base && auto.base > 0, 'all-AUTO still gets the base and no bonus');
  ok(half.total < full.total && half.total > auto.total, 'bonus shrinks with the AUTO fraction');
  ok(E.payoutOf(id, 0.25).bonus === Math.round(full.bonus * 0.75), 'bonus scales by (1 - autoFraction)');
  ok(E.payoutOf(id, -3).total === full.total && E.payoutOf(id, 7).total === auto.total, 'AUTO fraction is clamped to 0..1');
  ok(E.payoutOf(id, NaN).total === auto.total && E.payoutOf(id, 'x').total === auto.total, 'unreadable AUTO fraction is treated as all-AUTO'); }
for (const r of LADDER) { const f = E.feeOf(r.id), rw = E.rewardOf(r.id);
  ok(Number.isInteger(f) && f > 0 && Number.isInteger(rw), 'integer money for ' + r.id);
  ok(rw >= 10 * f, 'success pays generously (>= 10x the fee) for ' + r.id);
  ok(E.payoutOf(r.id, 1).total - f > 0, 'even all-AUTO nets money for ' + r.id); }
for (let i = 1; i < LADDER.length; i++) ok(E.rewardOf(LADDER[i].id) > E.rewardOf(LADDER[i - 1].id), 'newer rockets pay more (no reason to farm an old one) at ' + i);
ok(E.fmtMoney(750) === '$750K' && E.fmtMoney(1500) === '$1.5M' && E.fmtMoney(2200000) === '$2.2B' && E.fmtMoney(250000) === '$250M', 'fmtMoney: K / M / B');
console.log(`career_ladder: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
