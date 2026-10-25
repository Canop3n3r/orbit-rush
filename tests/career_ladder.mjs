// Career ladder (pure logic, no UI): meta, order, goals, economy, AUTO tracker, save, session, simulation.
// Public repo rule: neutral ids only; real names stay out of this file (scan below uses ROT13 strings).
import { readFileSync, readdirSync } from 'node:fs';
import * as C from '../vehicles/catalog.js';
import { META, ORDER, CLASSES } from '../data/ladder_meta.js';
import { LADDER, rankOf, goalOf, goalMet, STARTERS, priceOf } from '../career_ladder/ladder.js';
import * as E from '../career_ladder/economy.js';
import { createCareer } from '../career_ladder/session.js';
import { flightStrip, STRIP_KEYS, goalProgress } from '../career_ladder/strip.js';
import * as S from '../career_ladder/state.js';
import { createAutoTracker, DT_CAP } from '../career_ladder/auto_tracker.js';
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
// ---- 3. AUTO tracker ----
{ const tick = (tr, from, to, f) => { for (let m = from; m <= to; m += 1) tr.sample({ met: m, liftedOff: true, ...f }); };
  let tr = createAutoTracker(); ok(tr.fraction() === 0 && tr.state().total === 0, 'empty tracker: 0 fraction');
  tick(tr, 0, 10, { autoOn: true }); tick(tr, 11, 20, { autoOn: false, vAuto: false });
  ok(Math.abs(tr.fraction() - 0.5) < 1e-9 && tr.state().total === 20, 'half the flight on AUTO = 0.5');
  tr = createAutoTracker(); tick(tr, 0, 10, { vAuto: true }); ok(tr.fraction() === 1, 'v.auto alone counts as AUTO');
  tr = createAutoTracker(); for (let m = 0; m <= 600; m++) tr.sample({ met: m, liftedOff: false, autoOn: false }); tick(tr, 601, 611, { autoOn: true });
  ok(tr.fraction() === 1, 'idling manually on the pad does not dilute the AUTO fraction');
  tr = createAutoTracker(); tr.sample({ met: 0, liftedOff: true, autoOn: true }); tr.sample({ met: 1000, liftedOff: true, autoOn: true });
  ok(tr.state().total === DT_CAP && DT_CAP === 5, 'one huge tick (time warp / stall) counts at most DT_CAP seconds');
  tr = createAutoTracker(); tick(tr, 0, 10, { autoOn: true }); const t0 = tr.state().total; tr.sample({ met: 3, liftedOff: true, autoOn: true });
  ok(tr.state().total === t0, 'met going backwards counts nothing'); tick(tr, 4, 6, { autoOn: true }); ok(tr.state().total === t0 + 3, 'and counting resumes from the new baseline');
  tr.sample(null); tr.sample({ met: NaN, autoOn: true, liftedOff: true }); tr.sample({ met: 'x' }); tr.sample({ met: 50, liftedOff: true, autoOn: true, ended: true });
  ok(tr.state().total === t0 + 3, 'garbage and ended snapshots are ignored');
  tr.reset(); ok(tr.fraction() === 0 && tr.state().total === 0 && tr.state().auto === 0, 'reset zeroes the tracker');
  // revert to last stage: the tracker goes back to what it was when the stage started
  tr = createAutoTracker(); tick(tr, 0, 10, { autoOn: false }); tr.markStage(); tick(tr, 11, 40, { autoOn: true });
  ok(tr.fraction() > 0.7, 'AUTO after the stage mark raises the fraction'); tr.revertToStage();
  ok(tr.state().total === 10 && tr.fraction() === 0, 'revert to stage restores the fraction from the stage start');
  tick(tr, 0, 5, { autoOn: true }); ok(tr.state().total === 15 && Math.abs(tr.fraction() - 5 / 15) < 1e-9, 'counting continues after a stage revert');
  tr = createAutoTracker(); tr.revertToStage(); ok(tr.state().total === 0, 'stage revert with no mark resets to launch'); }
// ---- 4. state + save ----
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };
{ let s = S.blank();
  ok(S.ownedIds(s).join() === STARTERS.join() && s.cash === E.START_CASH && s.v === S.VERSION, 'blank career: oldest two owned, start cash');
  let n = S.nextInLine(s); ok(n && n.id === ORDER[2] && n.price === priceOf(ORDER[2]) && !n.canAfford && n.shortBy === n.price - s.cash, 'next in line shows the third rocket with its price');
  const before = JSON.stringify(s); let b = S.buyNext(s); ok(!b.ok && b.reason === 'short' && JSON.stringify(s) === before, 'cannot buy without the money (nothing changes)');
  s.cash = priceOf(ORDER[2]) + 7; b = S.buyNext(s); ok(b.ok && b.id === ORDER[2] && s.cash === 7 && S.ownedIds(s).length === 3, 'buying takes the price and owns the next rocket');
  ok(S.nextInLine(s).id === ORDER[3], 'unlocks go strictly in ladder order'); s.cash = 1e12; for (let i = 0; i < 200; i++) S.buyNext(s);
  ok(S.isComplete(s) && S.nextInLine(s) === null && !S.buyNext(s).ok && S.buyNext(s).reason === 'complete' && S.ownedIds(s).length === ORDER.length, 'a finished ladder owns everything and buys nothing more'); }
{ const st = mem(), s = S.blank(); s.cash = 12345; s.owned = 9; s.flights = 4; s.wins = { [ORDER[0]]: 3 }; s.fails = 1; ok(S.save(st, s), 'save works');
  const g = S.load(st); ok(g.cash === 12345 && g.owned === 9 && g.flights === 4 && g.wins[ORDER[0]] === 3 && g.fails === 1, 'save round-trips');
  st.setItem(S.KEY, '{bad'); ok(S.load(st).cash === E.START_CASH && S.load(st).owned === 2, 'corrupt save -> fresh career');
  st.setItem(S.KEY, 'null'); ok(S.load(st).owned === 2, 'null save -> fresh career'); ok(S.load({ getItem() { throw new Error('x'); } }).owned === 2, 'storage that throws -> fresh career');
  ok(S.save({ setItem() { throw new Error('full'); } }, s) === false, 'a full storage does not throw'); }
{ const hostile = JSON.parse('{"v":1,"cash":-50,"owned":9999,"flights":-3,"fails":1.5,"wins":{"__proto__":{"x":1},"nope":4,"' + ORDER[1] + '":2,"' + ORDER[2] + '":-1},"active":{"fee":1},"admin":true}');
  const g = S.sanitize(hostile); ok(g && g.cash === 0 && g.owned === ORDER.length && g.flights === 0 && g.fails === 1, 'sanitize clamps cash, owned, counters');
  ok(Object.keys(g).sort().join() === 'cash,fails,flights,owned,stipends,v,wins' , 'whitelist: unknown keys (active, admin) dropped: ' + Object.keys(g));
  ok(JSON.stringify(g.wins) === JSON.stringify({ [ORDER[1]]: 2 }) && ({}).x === undefined, 'wins keep only known ids with sane counts; no prototype pollution');
  ok(S.sanitize({ v: 1, cash: 5, owned: 0 }).owned === 2, 'a career always owns at least the oldest two'); ok(S.sanitize([1]) === null && S.sanitize('x') === null, 'non-objects are rejected');
  ok(S.sanitize({ v: 1, cash: 1e30, owned: 3 }).cash <= S.MAX_CASH, 'cash is capped'); }
{ const v0 = { v: 0, cash: 1.5, owned: [ORDER[0], ORDER[1], ORDER[2], ORDER[3]], flights: 6 };
  const m = S.migrate(v0); ok(m.v === 1 && m.cash === 1500 && m.owned === 4 && m.flights === 6, 'v0 prototype save ($M, id list) migrates to v1 ($K, count)');
  ok(JSON.stringify(S.migrate(S.migrate(v0))) === JSON.stringify(m), 'migration is idempotent'); ok(S.migrate({ v: 99 }) === null && S.migrate(null) === null, 'unknown / future versions are refused');
  const st = mem(); st.setItem(S.KEY, JSON.stringify(v0)); ok(S.load(st).owned === 4 && S.load(st).cash === 1500, 'load migrates old saves'); }
// ---- 5. session: fees, goal pay-once, failure, scrub, revert, stipend ----
const R0 = ORDER[0], R1 = ORDER[1], reading = id => { const g = goalOf(id); return { maxAlt: g.altM || 150000, ap: g.ap || 250000, pe: g.pe || 130000 }; };
const fly = (c, secs, auto) => { for (let m = 0; m <= secs; m++) c.tick({ met: m, liftedOff: m > 2, autoOn: auto, vAuto: false }); };
{ let c = createCareer(S.blank()), cash0 = c.save.cash, fee = E.feeOf(R1);
  let r = c.startFlight(R1); ok(r.ok && r.fee === fee && c.save.cash === cash0 - fee && c.active && c.active.rocketId === R1, 'starting a flight charges the 5% fee');
  ok(!createCareer(S.blank()).startFlight(ORDER[5]).ok && createCareer(S.blank()).startFlight(ORDER[5]).reason === 'locked', 'cannot fly a rocket you do not own');
  fly(c, 100, false); const g = c.onFlightEvent({ type: 'goal', rocketId: R1, met: 100, ...reading(R1) });
  ok(g.ok && g.paid === E.payoutOf(R1, 0).total && g.autoFraction === 0 && c.save.cash === cash0 - fee + g.paid, 'goal pays the full reward at 0% AUTO');
  const cashAfter = c.save.cash, g2 = c.onFlightEvent({ type: 'goal', rocketId: R1, met: 120, ...reading(R1) });
  ok(!g2.ok && g2.reason === 'already-paid' && c.save.cash === cashAfter, 'the goal pays ONCE per flight, then the flight continues');
  const e = c.onFlightEvent({ type: 'end', rocketId: R1, met: 400 }); ok(e.ok && e.outcome === 'success' && c.save.cash === cashAfter && !c.active && c.save.wins[R1] === 1, 'ending after the goal: success, no extra charge, win counted');
  ok(!c.onFlightEvent({ type: 'goal', rocketId: R1, met: 1, ...reading(R1) }).ok, 'no payout without a flight in progress'); }
{ const c = createCareer(S.blank()); c.startFlight(R1); fly(c, 100, false);
  ok(!c.onFlightEvent({ type: 'goal', rocketId: R1, met: 50, maxAlt: 5000, ap: 1, pe: -9e6 }).ok && c.save.cash < S.blank().cash, 'a goal event whose readings do not meet the goal pays nothing');
  ok(!c.onFlightEvent({ type: 'goal', rocketId: R0, met: 50, ...reading(R0) }).ok, 'a goal event for another rocket pays nothing');
  ok(!c.onFlightEvent({ type: 'bogus', rocketId: R1, met: 50 }).ok && !c.onFlightEvent(null).ok, 'unknown events are ignored'); }
{ // AUTO share shrinks the bonus, all-AUTO keeps the base
  const pay = auto => { const c = createCareer(S.blank()); c.startFlight(R1); fly(c, 100, auto); return c.onFlightEvent({ type: 'goal', rocketId: R1, met: 100, ...reading(R1) }); };
  const m = pay(false), a = pay(true); ok(m.paid > a.paid && a.paid === E.payoutOf(R1, 1).total && a.bonus === 0 && a.base > 0 && a.autoFraction > 0.9, 'all-AUTO pays base only, manual pays more');
  const c = createCareer(S.blank()); c.startFlight(R1); for (let k = 0; k <= 100; k++) c.tick({ met: k, liftedOff: k > 0, autoOn: k < 50 });
  const h = c.onFlightEvent({ type: 'goal', rocketId: R1, met: 100, ...reading(R1) }); ok(h.autoFraction > 0.45 && h.autoFraction < 0.55 && h.paid > a.paid && h.paid < m.paid, 'half AUTO pays in between');
  const c2 = createCareer(S.blank()); c2.startFlight(R1); fly(c2, 50, false); const o = c2.onFlightEvent({ type: 'goal', rocketId: R1, met: 50, autoFraction: 1, ...reading(R1) });
  ok(o.autoFraction === 1 && o.paid === a.paid, 'an explicit autoFraction on the event wins over the tracker'); }
{ // failure = 3x fee in total; recover without a goal = abort (1x); scrub on the pad = free
  for (const [type, mult, outcome] of [['crash', 3, 'fail'], ['end', 3, 'fail'], ['recover', 1, 'abort']]) {
    const s = S.blank(); s.cash = 1e6; const c = createCareer(s), fee = E.feeOf(R1); c.startFlight(R1); fly(c, 60, false);
    const r = c.onFlightEvent({ type, rocketId: R1, met: 60 }); ok(r.ok && r.outcome === outcome && c.save.cash === 1e6 - mult * fee && r.charged === mult * fee, `${type} without a goal: ${outcome} costs ${mult}x fee`);
    ok(type === 'recover' || c.save.fails === 1, 'failures are counted'); }
  const s = S.blank(); s.cash = 1e6; const c = createCareer(s); c.startFlight(R1); const r = c.onFlightEvent({ type: 'crash', rocketId: R1, met: 1, liftedOff: false });
  ok(r.outcome === 'scrub' && c.save.cash === 1e6 && r.charged === 0, 'a flight that never left the pad is scrubbed for free');
  const p = S.blank(); p.cash = E.feeOf(R1) + 1; const d = createCareer(p); d.startFlight(R1); fly(d, 60, false); d.onFlightEvent({ type: 'crash', rocketId: R1, met: 60 });
  const dr = d.onFlightEvent({ type: 'crash', rocketId: R1, met: 61 }); ok(!dr.ok, 'a finished flight cannot end twice');
  const q = S.blank(); q.cash = E.feeOf(R1) + 1; const dq = createCareer(q); dq.startFlight(R1); fly(dq, 60, false); const qr = dq.onFlightEvent({ type: 'crash', rocketId: R1, met: 60 });
  ok(qr.charged === E.feeOf(R1) + 1 && dq.save.cash >= 0, 'a failure charge is clamped to the cash you have (never negative)'); }
{ // revert to launch: free, resets the tracker, never loses money
  const s = S.blank(); const c = createCareer(s), cash0 = s.cash; c.startFlight(R1); fly(c, 80, true); ok(c.tracker.fraction() > 0.9, 'tracker is running');
  const r = c.revertToLaunch(); ok(r.ok && r.refund === E.feeOf(R1) && c.save.cash === cash0 && !c.active && c.tracker.fraction() === 0 && c.save.flights === 0, 'revert to launch refunds the fee and resets the AUTO tracker');
  c.startFlight(R1); ok(c.save.cash === cash0 - E.feeOf(R1), 'relaunching after a revert charges the fee once');
  fly(c, 50, false); c.onFlightEvent({ type: 'goal', rocketId: R1, met: 50, ...reading(R1) }); const paid = c.save.cash;
  const r2 = c.revertToLaunch(); ok(r2.ok && r2.refund === 0 && c.save.cash === paid, 'revert after the goal was paid keeps the money and gives no second refund');
  c.startFlight(R1); ok(c.save.cash === paid - E.feeOf(R1), 'and the next attempt pays a fresh fee (no free farming)');
  ok(!createCareer(S.blank()).revertToLaunch().ok, 'nothing to revert with no flight'); }
{ // revert to last stage: free, restores the tracker to the stage start, keeps the goal-paid flag
  const c = createCareer(S.blank()); c.startFlight(R1); fly(c, 30, false); c.markStage(); const cash = c.save.cash;
  for (let m = 31; m <= 90; m++) c.tick({ met: m, liftedOff: true, autoOn: true }); ok(c.tracker.fraction() > 0.5, 'AUTO after the stage mark');
  const r = c.revertToStage(); ok(r.ok && c.save.cash === cash && c.tracker.fraction() === 0 && !!c.active, 'revert to last stage: free, tracker back to the stage start, flight continues');
  c.onFlightEvent({ type: 'goal', rocketId: R1, met: 40, ...reading(R1) }); const paid = c.save.cash; c.revertToStage();
  ok(c.save.cash === paid && !c.onFlightEvent({ type: 'goal', rocketId: R1, met: 41, ...reading(R1) }).ok, 'reverting to a stage never lets the goal pay twice');
  ok(!createCareer(S.blank()).revertToStage().ok, 'no stage revert without a flight'); }
{ // broke -> stipend, no softlock
  const s = S.blank(); s.cash = 0; const c = createCareer(s), cheap = Math.min(E.feeOf(R0), E.feeOf(R1));
  const r = c.startFlight(R0); ok(r.ok && r.stipend > 0 && c.save.stipends === 1, 'broke: a stipend lets you launch'); ok(c.save.cash === E.STIPEND_LAUNCHES * cheap - E.feeOf(R0), 'stipend tops up to 3 launches of the cheapest owned rocket');
  const s2 = S.blank(); s2.cash = 1e6; const c2 = createCareer(s2); c2.startFlight(R0); ok(c2.save.stipends === 0, 'no stipend when you can afford a launch');
  ok(E.stipendFor(0, [R0, R1]) > 0 && E.stipendFor(1e6, [R0, R1]) === 0 && E.stipendFor(0, []) === 0, 'stipendFor');
  const s3 = S.blank(); s3.cash = E.feeOf(R0) + 1; s3.owned = 4; const c3 = createCareer(s3); ok(c3.startFlight(ORDER[3]).reason === 'short', 'cannot afford the big rocket: told short, not stuck (fly a cheaper one)');
  ok(c3.startFlight(R0).ok, 'and the cheaper rocket still launches');
  const s4 = S.blank(); s4.cash = E.feeOf(R1); const c4 = createCareer(s4); c4.startFlight(R1); fly(c4, 30, false); const f4 = c4.onFlightEvent({ type: 'crash', rocketId: R1, met: 30 });
  ok(f4.stipend > 0 && c4.save.cash > 0, 'a failure that empties the account pays the stipend straight away'); }
{ // starting a new flight over an unfinished one: pad = replaced for free, airborne = counted as an end
  const s = S.blank(); s.cash = 1e6; const c = createCareer(s); c.startFlight(R1); c.startFlight(R1); ok(c.save.cash === 1e6 - E.feeOf(R1), 'restarting from the pad does not double-charge');
  fly(c, 40, false); c.startFlight(R0); ok(c.save.cash === 1e6 - E.failChargeOf(R1) - E.feeOf(R0) && c.save.fails === 1, 'starting over an airborne flight forfeits it as a failure'); }
{ const s = S.blank(); s.cash = 5e5; const c = createCareer(s); c.startFlight(R1); fly(c, 30, false); c.onFlightEvent({ type: 'goal', rocketId: R1, met: 30, ...reading(R1) });
  const st = mem(); S.save(st, c.save); ok(S.load(st).cash === c.save.cash, 'session state saves'); ok(!('active' in c.save), 'the live flight is not part of the save'); }
// ---- 6. flight stat strip ----
{ const st = flightStrip({ ap: 412300, pe: 85200, dv: 3420, thrust: 1.2e6, mass: 90000, g: 9.81, accel: 13.1, maxAlt: 412300 });
  ok(st.items.map(i => i.key).join() === 'ap,pe,dv,twr,g,accel' && STRIP_KEYS.join() === 'ap,pe,dv,twr,g,accel', 'strip order: Ap Pe Δv TWR g accel');
  ok(st.items.map(i => i.label).join() === 'Ap,Pe,Δv,TWR,g,Acc' && st.items.every(i => i.label.length <= 3), 'labels are one short word');
  const by = Object.fromEntries(st.items.map(i => [i.key, i])); ok(by.ap.value === 412300 && by.ap.text === '412 km' && by.pe.text === '85.2 km', 'Ap/Pe in km');
  ok(by.dv.text === '3,420 m/s' && by.dv.value === 3420, 'Δv in m/s'); ok(Math.abs(by.twr.value - 1.2e6 / (90000 * 9.81)) < 1e-9 && by.twr.text === '1.36', 'TWR = thrust / (mass x local g)');
  ok(by.g.text === '9.81' && by.accel.text === '13.1', 'g and accel (m/s²)');
  const e = flightStrip({ ap: 1e5, pe: 8e4, thrust: 1e6, mass: 1e5, g: 10 }); ok(Math.abs(e.items.find(i => i.key === 'accel').value - 10) < 1e-9, 'accel falls back to thrust / mass');
  const pad = flightStrip({ onPad: true, ap: 0, pe: -6e6, dv: 9000, thrust: 1e6, mass: 1e5, g: 9.8 }); ok(pad.items[0].text === '—' && pad.items[1].text === '—' && pad.items[2].text === '9,000 m/s', 'on the pad Ap/Pe show a dash, Δv still shows');
  const bad = flightStrip({ ap: Infinity, pe: -5, dv: NaN, thrust: 0, mass: 0, g: 0 }); const bb = Object.fromEntries(bad.items.map(i => [i.key, i]));
  ok(bb.ap.text === 'escape' && bb.pe.text === 'under' && bb.dv.text === '—' && bb.twr.text === '—' && bb.g.text === '—', 'escape / below ground / missing readings never print NaN');
  ok(flightStrip(null).items.every(i => i.text === '—') && flightStrip({}).items.length === 6, 'no flight state: dashes, same six items');
  ok(!JSON.stringify([st, pad, bad]).includes('NaN'), 'no NaN in any text');
  const g = goalOf(ORDER[0]); ok(flightStrip({ maxAlt: 50000 }, g).goal.label === g.label && Math.abs(flightStrip({ maxAlt: 50000 }, g).goal.progress - 0.5) < 1e-9, 'goal marker: label + progress');
  ok(goalProgress(goalOf(ORDER[ORDER.length - 1]), { ap: 1e12, pe: 18e4 }) === 1 && goalProgress({ kind: 'orbit', pe: 120000 }, { ap: 3e5, pe: 60000 }) === 0.5 && goalProgress(g, {}) === 0 && goalProgress(null, {}) === 0, 'goal progress is clamped 0..1'); }
ok(E.fmtMoney(750) === '$750K' && E.fmtMoney(1500) === '$1.5M' && E.fmtMoney(2200000) === '$2.2B' && E.fmtMoney(250000) === '$250M', 'fmtMoney: K / M / B');
console.log(`career_ladder: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
