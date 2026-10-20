// f5 career ladder: one ordered contract ladder from a first hop to Mars. Each rung pays currency ($M) and/or
// science (🔬) and unlocks vehicles (showroom ids), parts, launch sites and missions. Pure logic over an injected
// storage (localStorage in the game, a Map-like in tests). Sandbox mode keeps everything unlocked.
// Rungs reuse Mission Design Bot's design: the ops contracts in missions/*.js (constellation-batch, crew-dock,
// lunar-landing, mars-ship) and the vehicle order of missions/campaign/career.js (sparrow-1 -> heron-9 ->
// heron-9-crew -> heron-heavy -> titan-ss). Vehicle ids here are showroom ids (fun/showroom.js MODEL_OF).
export const KEY = 'orbitrush.ladder.v1', SANDBOX_KEY = 'orbitrush.sandbox';
export const START = { vehicles: ['pip', 'hopper', 'needle'], sites: ['atoll'], parts: [], missions: ['hop'] };
// every lockable thing, for sandbox and the progress screen
export const ALL = { vehicles: ['pip', 'hopper', 'needle', 'kestrel', 'heron', 'atlas', 'selene', 'titan', 'ares'],
  sites: ['atoll', 'slc40', 'lz1', 'lc39a', 'starbase'], parts: ['ion', 'xenon'], missions: ['hop', 'constellation-batch', 'crew-dock', 'moon', 'mars', 'venus'] };
export const SITE_NAMES = { atoll: 'Atoll pad', slc40: 'Cape pad 40', lz1: 'Landing zone 1', lc39a: 'Cape pad 39', starbase: 'Gulf starport' };
// how: 'fly' (vehicle, free flight) | 'op' (missions/*.js contract) | 'mission' (fun/director.js one-tap mission)
export const LADDER = [
  { id: 'hop', name: 'First hop', goal: 'Climb above 10 km', how: 'fly', vehicle: 'needle', test: r => r.maxAlt >= 10000,
    reward: { cash: 10, sci: 2 }, unlock: { parts: ['ion'] } },
  { id: 'karman', name: 'Kármán line', goal: 'Cross 100 km: you are in space', how: 'fly', vehicle: 'needle', test: r => r.space,
    reward: { cash: 20, sci: 8 }, unlock: { sites: ['slc40'] } },
  { id: 'orbit', name: 'First orbit', goal: 'Reach a stable orbit', how: 'fly', vehicle: 'needle', test: r => r.orbit,
    reward: { cash: 40, sci: 12 }, unlock: { vehicles: ['kestrel'] } },
  { id: 'booster', name: 'Booster landing', goal: 'Fly the booster back and land it', how: 'fly', vehicle: 'kestrel', test: r => r.boosterLanded,
    reward: { cash: 60, sci: 10 }, unlock: { sites: ['lz1'], missions: ['constellation-batch'] } },
  { id: 'starlink', name: 'Constellation deploy', brandKey: 'constellation-batch', goal: 'Loft a satellite stack and dispense it', how: 'op', op: 'constellation-batch', vehicle: 'kestrel',
    test: r => r.op === 'constellation-batch' && r.opOk, reward: { cash: 90, sci: 15 }, unlock: { vehicles: ['heron'], sites: ['lc39a'], missions: ['crew-dock'] } },
  { id: 'iss', name: 'Crew to station', brandKey: 'crew-dock', goal: 'Take a crew to the station orbit and dock', how: 'op', op: 'crew-dock', vehicle: 'heron',
    test: r => r.op === 'crew-dock' && r.opOk, reward: { cash: 140, sci: 25 }, unlock: { vehicles: ['atlas', 'selene'], missions: ['moon'] } },
  { id: 'heavy', name: 'Heavy lift', goal: 'Reach orbit on the heavy, side boosters back', how: 'fly', vehicle: 'atlas', test: r => r.orbit && r.vehicle === 'atlas',
    reward: { cash: 120, sci: 15 }, unlock: { parts: ['xenon'] } },
  { id: 'moon', name: 'Moon landing', goal: 'Land on the Moon', how: 'mission', mission: 'moon', vehicle: 'selene', test: r => r.landed === 'moon',
    reward: { cash: 250, sci: 60 }, unlock: { vehicles: ['titan', 'ares'], sites: ['starbase'], missions: ['mars'] } },
  { id: 'mars', name: 'Mars', goal: 'Reach Mars', how: 'mission', mission: 'mars', vehicle: 'ares', test: r => (r.visited || []).includes('mars'),
    reward: { cash: 400, sci: 100 }, unlock: { missions: ['venus'] } },
  { id: 'venus', name: 'Venus flyby', goal: 'Swing past Venus', how: 'mission', mission: 'venus', vehicle: 'ares', test: r => (r.visited || []).includes('venus'),
    reward: { cash: 150, sci: 80 }, unlock: {} },
];
export function blank() { return { v: 1, cash: 0, sci: 0, done: {}, unlocked: JSON.parse(JSON.stringify(START)), flights: 0, last: null }; }
export function load(store) {
  try { const s = JSON.parse(store.getItem(KEY) || 'null'); if (!s || s.v !== 1 || typeof s.done !== 'object') return blank();
    const b = blank(); for (const k in START) b.unlocked[k] = [...new Set([...(START[k]), ...((s.unlocked || {})[k] || [])])]; return { ...b, ...s, unlocked: b.unlocked }; } catch (e) { return blank(); }
}
export function save(store, s) { try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const sandbox = store => { try { return store.getItem(SANDBOX_KEY) === '1'; } catch (e) { return false; } };
export const setSandbox = (store, on) => { try { store.setItem(SANDBOX_KEY, on ? '1' : '0'); } catch (e) { } };
export const isUnlocked = (s, kind, id, sb = false) => sb || !ALL[kind].includes(id) || s.unlocked[kind].includes(id);
export const next = s => LADDER.find(c => !s.done[c.id]) || null;
export const unlockedBy = (kind, id) => LADDER.find(c => (c.unlock[kind] || []).includes(id)) || null;
// Record a flight result r: { maxAlt, space, orbit, boosterLanded, landed, visited, vehicle, op, opOk, dead }.
// Rungs are earned in order; one flight can earn several consecutive rungs (orbit also passes hop and karman).
export function record(s, r, t = Date.now()) {
  const out = { earned: [], cash: 0, sci: 0, unlocks: [], next: null };
  s.flights++;
  for (const c of LADDER) {
    if (s.done[c.id]) continue;
    if (!c.test(r || {})) break;
    s.done[c.id] = t; out.earned.push(c); s.cash += c.reward.cash || 0; s.sci += c.reward.sci || 0; out.cash += c.reward.cash || 0; out.sci += c.reward.sci || 0;
    for (const k in c.unlock) for (const id of c.unlock[k]) if (!s.unlocked[k].includes(id)) { s.unlocked[k].push(id); out.unlocks.push({ kind: k, id }); }
  }
  out.next = next(s); s.last = { t, earned: out.earned.map(c => c.id) };
  return out;
}
