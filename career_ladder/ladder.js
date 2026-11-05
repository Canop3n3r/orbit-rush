// Career ladder: the whole roster, oldest first, one built-in goal per rocket size class. Pure data + functions.
import { ORDER, META, launchPrice } from '../data/ladder_meta.js';
// Goals by size class. Altitudes in metres above the surface, as the flight HUD reports them.
//   height: highest altitude reached (maxAlt) >= altM        orbit: periapsis >= pe (stable, above the air)
//   target: Ap >= ap AND Pe >= pe (an escape orbit has Ap = Infinity and counts)
export const GOALS = {
  light:  { id: 'space',  kind: 'height', altM: 100000, label: 'Reach space' },
  small:  { id: 'orbit',  kind: 'orbit', pe: 120000, label: 'Reach orbit' },
  medium: { id: 'high',   kind: 'target', ap: 400000, pe: 300000, label: 'Orbit 400 km' },
  heavy:  { id: 'gto',    kind: 'target', ap: 35786000, pe: 180000, label: 'Reach GTO' },
  super:  { id: 'lunar',  kind: 'target', ap: 380000000, pe: 180000, label: 'Fly to the Moon' },
};
export const goalOf = id => GOALS[(META[id] || {}).cls] || null;
const fin = x => typeof x === 'number' && !Number.isNaN(x);
// snap: { maxAlt?, ap?, pe? } in metres; missing / NaN readings never meet a goal
export function goalMet(goal, snap) {
  if (!goal || !snap) return false;
  if (goal.kind === 'height') return fin(snap.maxAlt) && snap.maxAlt >= goal.altM;
  if (goal.kind === 'orbit') return fin(snap.pe) && fin(snap.ap) && snap.pe >= goal.pe && snap.ap >= snap.pe;
  if (goal.kind === 'target') return fin(snap.pe) && fin(snap.ap) && snap.pe >= goal.pe && snap.ap >= goal.ap;
  return false;
}
// one row per rocket, oldest first: { id, rank, year, cls, goal }. Price is looked up live (priceOf) so a launch-cost source can be swapped in.
export const LADDER = ORDER.map((id, rank) => ({ id, rank, year: META[id].year, cls: META[id].cls, goal: goalOf(id) }));
export const priceOf = launchPrice; // $K, integer
export const rankOf = id => ORDER.indexOf(id);
export const rowOf = id => LADDER[rankOf(id)] || null;
export const STARTERS = ORDER.slice(0, 2); // a new career owns the oldest two rockets
