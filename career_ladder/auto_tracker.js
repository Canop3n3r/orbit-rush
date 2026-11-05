// AUTO-time tracker: the fraction of the airborne flight spent on AUTO. Pure: it never reads flight.js, the host
// passes one plain snapshot per tick. Snapshot (all fields from flight.js):
//   { met: mission time in s (flight.met), autoOn: flight.autoOn, vAuto: flight.v.auto,
//     liftedOff: true once the rocket has left the pad (e.g. flight.ignited && altitude > 1 m), ended?: flight.ended }
// AUTO = autoOn || vAuto. Only airborne time counts, so idling on the pad cannot dilute the fraction, and a single
// tick counts at most DT_CAP seconds, so a stall or a time-warp jump cannot swing it. A met that runs backwards
// (revert, reload) counts nothing and just moves the baseline.
export const DT_CAP = 5;
export function createAutoTracker() {
  let total = 0, auto = 0, last = null, mark = null;
  const num = x => typeof x === 'number' && Number.isFinite(x);
  return {
    sample(s) {
      if (!s || typeof s !== 'object' || !num(s.met) || s.ended) return;
      const dt = last === null ? 0 : s.met - last; last = s.met;
      if (!(dt > 0) || !s.liftedOff) return;
      const d = Math.min(dt, DT_CAP); total += d; if (s.autoOn || s.vAuto) auto += d;
    },
    fraction: () => (total > 0 ? auto / total : 0),
    state: () => ({ total, auto }),
    reset() { total = 0; auto = 0; last = null; mark = null; },        // revert to launch: a fresh flight
    markStage() { mark = { total, auto }; },                           // call at each stage start
    revertToStage() { total = mark ? mark.total : 0; auto = mark ? mark.auto : 0; last = null; }, // back to the last stage start (launch if none)
  };
}
