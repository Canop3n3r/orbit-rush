// Headless career simulation (tests + tuning table): fly the newest owned rocket you can afford to launch, reach its goal at a given AUTO
// share, end the flight, buy every rocket you can afford, repeat until the ladder is finished or the cap is hit.
import { ORDER } from '../data/ladder_meta.js';
import { goalOf } from './ladder.js';
import { createCareer } from './session.js';
import { blank, ownedIds, nextInLine } from './state.js';
import { feeOf, payoutOf } from './economy.js';
const readingFor = id => { const g = goalOf(id); return { maxAlt: g.altM || 200000, ap: g.ap || 300000, pe: g.pe || 150000 }; };
// opts: { auto: 0..1 share of the flight on AUTO, cap: max flights, fail: (n, id) => bool to crash flight n }
export function simulateCareer({ auto = 0, cap = 400, fail = () => false, save = blank() } = {}) {
  const c = createCareer(save), unlocks = [], T = 300; let flightsSince = 0, n = 0;
  while (nextInLine(save) && n < cap) {
    const own = ownedIds(save), id = [...own].reverse().find(r => feeOf(r) <= save.cash) || own[0]; n++; flightsSince++; // best rocket you can afford to launch
    const s = c.startFlight(id); if (!s.ok) return { ok: false, reason: s.reason, flights: n, unlocks, save };
    for (let m = 0; m <= T; m++) c.tick({ met: m, liftedOff: m > 2, autoOn: m < auto * T, vAuto: false });
    if (fail(n, id)) { c.onFlightEvent({ type: 'crash', rocketId: id, met: 100 }); continue; }
    const g = c.onFlightEvent({ type: 'goal', rocketId: id, met: T, ...readingFor(id) });
    c.onFlightEvent({ type: 'recover', rocketId: id, met: T + 60 });
    for (let b = c.buyNext(); b.ok; b = c.buyNext()) { unlocks.push({ id: b.id, flights: flightsSince, rocket: id, paid: g.paid, fee: feeOf(id), cost: b.cost }); flightsSince = 0; }
  }
  return { ok: !nextInLine(save), flights: n, unlocks, save };
}
// tuning rows for the first `n` rungs: what each rocket costs to own, to launch, and pays
export const tuningRows = (n = 12) => ORDER.slice(0, n).map((id, rank) => ({ rank, id, fee: feeOf(id), fail: 3 * feeOf(id), pay: payoutOf(id, 0).total, payAuto: payoutOf(id, 1).total }));
