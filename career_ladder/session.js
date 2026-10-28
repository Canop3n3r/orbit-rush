// Career session: one object per loaded career. Wraps the save state, the AUTO tracker and the flight in progress.
// Pure logic: no DOM, no flight.js. The host (f5.9 UI worker) calls:
//   career.startFlight(rocketId)  when the player commits to a launch (ignition / Launch button)
//   career.tick(snapshot)         once per frame (snapshot shape: see auto_tracker.js)
//   career.markStage()            at each stage start (for revert to last stage)
//   career.onFlightEvent(ev)      for the events below
//   career.revertToLaunch() / career.revertToStage()   the two revert buttons
//
// onFlightEvent(ev) shape (documented again in career_ladder/API.md):
//   { type: 'goal' | 'end' | 'recover' | 'crash',
//     rocketId: string        catalog id of the rocket being flown (must equal the active flight's rocket)
//     met: number             mission time in s (informational)
//     // type 'goal' only: the readings the host saw when it decided the goal was met, in metres above the surface.
//     // The session re-checks them with goalMet(), so a wrong event pays nothing.
//     maxAlt?: number, ap?: number, pe?: number
//     autoFraction?: number   0..1 override; omitted = the session's own tracker value
//     liftedOff?: boolean     end events: false = never left the pad (scrub: fee refunded). Omitted = the tracker's view
//   }
//   'goal'    pays base + bonus ONCE per flight; the flight keeps going (reaching orbit does not end it)
//   'end'     flight ended (Home, stranded, timeout)   without a paid goal: failed flight, 3x fee in total
//   'crash'   vehicle destroyed                        without a paid goal: failed flight, 3x fee in total
//   'recover' vehicle/capsule brought home safely      without a paid goal: abort, the 1x fee only
//   Any end event after the goal was paid is a plain success: nothing more to pay or charge.
import { goalOf, goalMet } from './ladder.js';
import { feeOf, failChargeOf, payoutOf, stipendFor } from './economy.js';
import { ownedIds, nextInLine, buyNext, MAX_CASH } from './state.js';
import { createAutoTracker } from './auto_tracker.js';
const num = x => typeof x === 'number' && Number.isFinite(x);
export function createCareer(save) {
  const tracker = createAutoTracker(); let active = null;
  const stipend = () => { const n = stipendFor(save.cash, ownedIds(save)); if (n > 0) { save.cash += n; save.stipends++; } return n; };
  const afford = () => { const n = nextInLine(save); return !!n && n.canAfford; };
  function finish(type, ev) { // flight ended without being reverted
    const a = active, lifted = typeof ev.liftedOff === 'boolean' ? ev.liftedOff : a.liftedOff; active = null;
    if (a.goalPaid) return { ok: true, outcome: 'success', charged: 0, stipend: stipend(), canAffordNext: afford() };
    if (!lifted) { save.cash += a.fee; save.flights--; return { ok: true, outcome: 'scrub', charged: 0, refund: a.fee, stipend: 0, canAffordNext: afford() }; }
    if (type === 'recover') return { ok: true, outcome: 'abort', charged: a.fee, stipend: stipend(), canAffordNext: afford() };
    const extra = Math.min(save.cash, failChargeOf(a.rocketId) - a.fee); save.cash -= extra; save.fails++;
    return { ok: true, outcome: 'fail', charged: a.fee + extra, extra, stipend: stipend(), canAffordNext: afford() };
  }
  return {
    save, tracker,
    get active() { return active; },
    startFlight(rocketId) {
      if (!ownedIds(save).includes(rocketId)) return { ok: false, reason: 'locked' };
      if (active) finish('end', { liftedOff: active.liftedOff }); // starting over an unfinished flight: pad = free replace, airborne = failed
      const got = stipend(), fee = feeOf(rocketId);
      if (save.cash < fee) { return { ok: false, reason: 'short', fee, stipend: got }; }
      save.cash -= fee; save.flights++; tracker.reset(); active = { rocketId, fee, goalPaid: false, liftedOff: false };
      return { ok: true, fee, stipend: got, goal: goalOf(rocketId) };
    },
    tick(snap) { tracker.sample(snap); if (active && snap && snap.liftedOff === true) active.liftedOff = true; },
    markStage() { tracker.markStage(); },
    onFlightEvent(ev) {
      if (!ev || typeof ev !== 'object') return { ok: false, reason: 'bad-event' };
      if (!['goal', 'end', 'recover', 'crash'].includes(ev.type)) return { ok: false, reason: 'bad-event' };
      if (!active) return { ok: false, reason: 'no-flight' };
      if (ev.rocketId !== active.rocketId) return { ok: false, reason: 'wrong-rocket' };
      if (ev.type !== 'goal') return finish(ev.type, ev);
      if (active.goalPaid) return { ok: false, reason: 'already-paid' };
      if (!goalMet(goalOf(active.rocketId), ev)) return { ok: false, reason: 'goal-not-met' };
      const af = num(ev.autoFraction) ? ev.autoFraction : tracker.fraction(), p = payoutOf(active.rocketId, af);
      save.cash = Math.min(MAX_CASH, save.cash + p.total); save.wins[active.rocketId] = (save.wins[active.rocketId] || 0) + 1; active.goalPaid = true;
      return { ok: true, paid: p.total, base: p.base, bonus: p.bonus, autoFraction: Math.min(1, Math.max(0, af)), net: p.total - active.fee, canAffordNext: afford() };
    },
    // free "revert to launch": fee refunded (unless this flight's goal already paid), AUTO tracker reset, flight cleared.
    // The host relaunches with startFlight() (which charges one fresh fee).
    revertToLaunch() {
      if (!active) return { ok: false, reason: 'no-flight' };
      const a = active, refund = a.goalPaid ? 0 : a.fee; active = null; save.cash += refund; if (!a.goalPaid) save.flights--; tracker.reset();
      return { ok: true, refund, goalKept: a.goalPaid };
    },
    // free "revert to last stage": no money moves; the AUTO tracker returns to the stage start; the paid flag stays.
    revertToStage() {
      if (!active) return { ok: false, reason: 'no-flight' };
      tracker.revertToStage(); return { ok: true, autoFraction: tracker.fraction() };
    },
    buyNext() { return buyNext(save); },
    canAffordNext: afford,
  };
}
