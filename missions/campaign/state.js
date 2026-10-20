// Career state machine (pure). The state is derived ONLY by replaying the flight history from START, so
// money, reputation and unlocks cannot be edited independently of the history (see save.js).
import { CAREER, CONTRACTS, START, MAX_REP, FAIL_REP, REPEAT_REWARD, cheapestCost, tierOfMission } from './career.js';
export const STIPEND_FLOOR = cheapestCost(); // money is topped up to this after a flight leaves you below it
export const newCareer = () => ({ money: START.money, rep: 0, unlocked: CAREER.filter(t => t.unlock.start).map(t => t.vehicleId), done: {}, flights: [] });
const meets = (s, t) => !t.unlock.future && !t.unlock.start && s.rep >= (t.unlock.rep || 0) && (t.unlock.after || []).every(id => s.done[id]);
export function unlockPass(s) { // unlock tiers strictly in table order: a tier only after every earlier one
  for (const t of CAREER) { if (s.unlocked.includes(t.vehicleId)) continue; if (meets(s, t)) s.unlocked.push(t.vehicleId); else break; }
  return s;
}
export function canFly(s, missionId) {
  const c = Object.hasOwn(CONTRACTS, missionId) ? CONTRACTS[missionId] : null, t = c && tierOfMission(missionId);
  if (!c || !t) return { ok: false, why: 'unknown contract' };
  if (!s.unlocked.includes(t.vehicleId)) return { ok: false, why: 'vehicle locked' };
  if (s.money < c.cost) return { ok: false, why: 'not enough money' };
  return { ok: true };
}
// Apply one flown mission. `result` = evaluate()/runMission() output: { complete, score }.
export function applyFlight(s0, missionId, result) {
  const g = canFly(s0, missionId); if (!g.ok) throw new Error('cannot fly ' + missionId + ': ' + g.why);
  const s = structuredClone(s0), c = CONTRACTS[missionId], ok = !!result.complete, score = Math.max(0, Math.round(+result.score || 0));
  const repeat = !c.practice && Object.hasOwn(s.done, missionId);
  s.money -= c.cost;
  if (ok) { s.money += repeat ? Math.round(c.reward * REPEAT_REWARD) : c.reward; if (!repeat) s.rep = Math.min(MAX_REP, s.rep + c.rep); if (!c.practice) s.done[missionId] = Math.max(s.done[missionId] || 0, score); }
  else if (!c.practice) s.rep = Math.max(0, s.rep - FAIL_REP);
  let stipend = 0; if (s.money < STIPEND_FLOOR) { stipend = STIPEND_FLOOR - s.money; s.money = STIPEND_FLOOR; } // bailout: never stuck below the cheapest contract
  s.flights.push({ n: s.flights.length + 1, mission: missionId, vehicle: tierOfMission(missionId).vehicleId, ok, score, ...(stipend ? { stipend } : {}) });
  return unlockPass(s);
}
export const restartCareer = () => newCareer(); // the 'restart career' option (UI confirms, then saveTo(store, restartCareer()))
export const replay = flights => flights.reduce((s, f) => applyFlight(s, f.mission, { complete: f.ok, score: f.score }), newCareer());
export const available = s => CAREER.filter(t => s.unlocked.includes(t.vehicleId)).flatMap(t => t.contracts).filter(id => canFly(s, id).ok);
