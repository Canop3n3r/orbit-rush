// Mission carousel tile data (UI spec ui_ideal_path_2026-10-20 step 7). Data + pure functions only, no DOM.
// Tile = icon + ≤2-word title + stars + lock; everything wordy (reward range, vehicle family) is in `detail`
// for the long-press sheet. Vehicle names come from vehicles/brand.js at render time; here only neutral ids.
import { CAREER, CONTRACTS, missionOf, tierOfMission } from './career.js';
import { canFly } from './state.js';

// Star thresholds: fraction of the mission's par score (par ≈ the autopilot's clean run, rounded down).
export const STAR_FRACTIONS = [0.25, 0.6, 0.9];
export const TILES = {
  'practice':            { icon: '🎯', title: 'Practice',   par: 8500,  detail: 'Free orbit run for 💰5 that never costs money or reputation.' },
  'first-orbit':         { icon: '🌍', title: 'First Orbit', par: 8500,  detail: 'Reach a round 200 km orbit for 💰35 on the small rocket.' },
  'roadster-helio':      { icon: '☀️', title: 'Sun Orbit',  par: 10000, detail: 'Send a demo payload past Earth into orbit around the Sun for 💰90.' },
  'gto-comsat':          { icon: '📡', title: 'Comsat',     par: 15000, detail: 'Lift a satellite to a geostationary transfer orbit for 💰150.' },
  'constellation-batch': { icon: '✨', title: 'Sat Batch',  par: 15000, detail: 'Deploy a stack of internet satellites into low orbit for 💰40.' },
  'rideshare':           { icon: '🚌', title: 'Rideshare',  par: 14000, detail: 'Drop several small satellites into separate orbits for 💰60.' },
  'sso-rideshare':       { icon: '🧭', title: 'Polar Ride', par: 15000, detail: 'Carry small satellites to a sun-synchronous polar orbit for 💰90.' },
  'crew-dock':           { icon: '👩‍🚀', title: 'Crew Dock', par: 19000, detail: 'Fly a crew capsule up and dock it with the station for 💰140.' },
  'station-rendezvous':  { icon: '🛰️', title: 'Rendezvous', par: 15000, detail: 'Catch up with the space station and hold close formation for 💰160.' },
  'tower-catch':         { icon: '🗼', title: 'Tower Catch', par: 12500, detail: 'Bring the super-heavy booster back to be caught by the tower for 💰80.' },
  'refuel':              { icon: '⛽', title: 'Refuel',     par: 13500, detail: 'Move propellant between two ships in orbit for 💰55.' },
  'super-heavy-catch':   { icon: '🦾', title: 'Heavy Catch', par: 17000, detail: 'Fly the full ship stack and catch its booster for 💰220.' },
  'ship-transfer':       { icon: '🔁', title: 'Tanker Run', par: 14000, detail: 'Deliver 100 t of propellant to a depot ship in orbit for 💰260.' },
  'lunar-landing':       { icon: '🌙', title: 'Moon Landing', par: 19500, detail: 'Fly the ship to the Moon and land it upright for 💰500.' },
  'mars-ship':           { icon: '🔴', title: 'Mars',       par: 21500, detail: 'Send the ship across to Mars and land it for 💰650.' },
};
// Best score so far for a contract (practice is never 'done', so read its flight log).
export const bestScore = (career, id) => CONTRACTS[id]?.practice
  ? Math.max(0, ...career.flights.filter(f => f.mission === id && f.ok).map(f => f.score))
  : (Object.hasOwn(career.done, id) ? career.done[id] : 0);
export const starsFor = (id, score) => STAR_FRACTIONS.filter(f => score > 0 && score >= f * TILES[id].par).length;
// lock: 'open' | 'vehicle' (tier not unlocked yet) | 'money' (unlocked, can't afford now).
export function lockOf(career, id) {
  const t = tierOfMission(id); if (!t || !career.unlocked.includes(t.vehicleId)) return 'vehicle';
  return canFly(career, id).ok ? 'open' : 'money';
}
// Carousel feed, in career order. Pure: same career in → same tiles out.
export function missionTiles(career) {
  return CAREER.flatMap(t => t.contracts.map(id => {
    const d = TILES[id], best = bestScore(career, id);
    return { id, mission: missionOf(id), tier: t.tier, vehicleId: t.vehicleId, icon: d.icon, title: d.title,
      stars: starsFor(id, best), best, lock: lockOf(career, id), done: Object.hasOwn(career.done, id), detail: d.detail,
      cost: CONTRACTS[id].cost, reward: CONTRACTS[id].reward };
  }));
}
