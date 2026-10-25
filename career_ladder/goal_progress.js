// How close a flight is to its goal, 0..1 (for the goal marker). snap: { maxAlt?, ap?, pe? } in metres.
const fin = x => typeof x === 'number' && !Number.isNaN(x);
const part = (x, target) => (fin(x) && target > 0 ? Math.min(1, Math.max(0, x / target)) : 0);
export function goalProgress(goal, snap) {
  if (!goal || !snap) return 0;
  if (goal.kind === 'height') return part(snap.maxAlt, goal.altM);
  if (goal.kind === 'orbit') return part(snap.pe, goal.pe);
  if (goal.kind === 'target') return Math.min(part(snap.pe, goal.pe), part(snap.ap, goal.ap));
  return 0;
}
