// f5 career ladder: one ordered contract ladder from a first hop to Mars. Each rung pays currency ($M) and/or
// science (🔬) and unlocks vehicles (showroom ids), parts, launch sites and missions. Pure logic over an injected
// storage (localStorage in the game, a Map-like in tests). Sandbox mode keeps everything unlocked.
// Rungs reuse Mission Design Bot's design: the ops contracts in missions/*.js (constellation-batch, crew-dock,
// lunar-landing, mars-ship) and the vehicle order of missions/campaign/career.js (sparrow-1 -> heron-9 ->
// heron-9-crew -> heron-heavy -> colossus). Vehicle ids here are showroom ids (fun/showroom.js MODEL_OF).
import { CONTRACTS as DESIGN } from '../design/career_contracts.js?v=f5.6v';
export const KEY = 'orbitrush.ladder.v1', VERSION = 2, SANDBOX_KEY = 'orbitrush.sandbox';
export const START = { vehicles: ['pip', 'hopper', 'needle'], sites: ['atoll'], parts: [], missions: ['hop'] };
// every lockable thing, for sandbox and the progress screen
export const ALL = { vehicles: ['pip', 'hopper', 'needle', 'swift', 'heron', 'atlas', 'selene', 'titan', 'ares'],
  sites: ['atoll', 'cape-north', 'lz1', 'cape-heritage', 'gulf-port'], parts: ['ion', 'xenon'], missions: ['hop', 'constellation-batch', 'crew-dock', 'moon', 'mars', 'venus'] };
// Vehicles without a model yet (Rocket Art Bot): shown with a placeholder model, and rungs flown on them stay locked.
export const PLACEHOLDER_VEHICLES = {}; // f5.1h: Selene and Red Arrow have their own art now (rungs 8-10 open)
export const rungLocked = c => Object.hasOwn(PLACEHOLDER_VEHICLES, c.vehicle);
// v1 -> v2 id rename. Old ids are stored ROT13 so the neutrality scan stays clean.
const rot13 = t => t.replace(/[a-z]/g, ch => String.fromCharCode(97 + (ch.charCodeAt(0) - 84) % 26));
export const RENAMES = { rungs: { [rot13('fgneyvax')]: 'constellation-batch', [rot13('vff')]: 'crew-dock' },
  vehicles: { [rot13('xrfgery')]: 'swift' }, // showroom id (a real engine name) -> neutral
  sites: { [rot13('fyp40')]: 'cape-north', [rot13('yp39n')]: 'cape-heritage', [rot13('fgneonfr')]: 'gulf-port' } };
export function migrate(s) {
  if (!s || typeof s !== 'object') return s;
  if (s.v === 1) {
    const done = {}; for (const [k, v] of Object.entries(s.done || {})) done[RENAMES.rungs[k] || k] = v;
    const u = { ...(s.unlocked || {}) }; if (Array.isArray(u.sites)) u.sites = [...new Set(u.sites.map(x => RENAMES.sites[x] || x))];
    if (Array.isArray(u.missions)) u.missions = [...new Set(u.missions.map(x => RENAMES.rungs[x] || x))];
    const last = s.last && Array.isArray(s.last.earned) ? { ...s.last, earned: s.last.earned.map(x => RENAMES.rungs[x] || x) } : s.last;
    s = { ...s, v: 2, done, unlocked: u, last };
  }
  if (s.v === 2 && s.unlocked && Array.isArray(s.unlocked.vehicles) && s.unlocked.vehicles.some(x => RENAMES.vehicles[x])) // vehicle alias (old v1/v2 saves)
    s = { ...s, unlocked: { ...s.unlocked, vehicles: [...new Set(s.unlocked.vehicles.map(x => RENAMES.vehicles[x] || x))] } };
  return s;
}
export const SITE_NAMES = { atoll: 'Atoll pad', 'cape-north': 'Cape north pad', lz1: 'Landing zone 1', 'cape-heritage': 'Cape heritage pad', 'gulf-port': 'Gulf starport' };
// how: 'fly' (vehicle, free flight) | 'op' (missions/*.js contract) | 'mission' (fun/director.js one-tap mission)
export const LADDER = [
  { id: 'hop', name: 'First hop', goal: 'Climb above 10 km', how: 'fly', vehicle: 'needle', test: r => r.maxAlt >= 10000,
    reward: { cash: 10, sci: 2 }, unlock: { parts: ['ion'] } },
  { id: 'karman', name: 'Kármán line', goal: 'Cross 100 km: you are in space', how: 'fly', vehicle: 'needle', test: r => r.space,
    reward: { cash: 20, sci: 8 }, unlock: { sites: ['cape-north'] } },
  { id: 'orbit', name: 'First orbit', goal: 'Reach a stable orbit', how: 'fly', vehicle: 'needle', test: r => r.orbit,
    reward: { cash: 40, sci: 12 }, unlock: { vehicles: ['swift'] } },
  { id: 'booster', name: 'Booster landing', goal: 'Fly the booster back and land it', how: 'fly', vehicle: 'swift', test: r => r.boosterLanded, // f5.1h: any rocket whose booster lands
    reward: { cash: 60, sci: 10 }, unlock: { sites: ['lz1'], missions: ['constellation-batch'] } },
  { id: 'constellation-batch', name: 'Constellation deploy', brandKey: 'constellation-batch', goal: 'Loft a satellite stack and dispense it', how: 'op', op: 'constellation-batch', vehicle: 'swift',
    test: r => r.op === 'constellation-batch' && r.opOk && !!r.delivered /* f5.4 (QA A4): no pay without a real 🛰 RELEASE */, reward: { cash: 90, sci: 15 }, unlock: { vehicles: ['heron'], sites: ['cape-heritage'], missions: ['crew-dock'] } },
  { id: 'crew-dock', name: 'Crew to station', brandKey: 'crew-dock', goal: 'Take a crew to the station orbit and dock', how: 'op', op: 'crew-dock', vehicle: 'heron',
    test: r => r.op === 'crew-dock' && r.opOk, reward: { cash: 140, sci: 25 }, unlock: { vehicles: ['atlas', 'selene'], missions: ['moon'] } },
  { id: 'heavy', name: 'Heavy lift', goal: 'Reach orbit on the heavy, side boosters back', how: 'fly', vehicle: 'atlas', test: r => r.orbit && r.vehicle === 'atlas',
    reward: { cash: 120, sci: 15 }, unlock: { parts: ['xenon'] } },
  { id: 'moon', name: 'Moon landing', goal: 'Land on the Moon', how: 'mission', mission: 'moon', vehicle: 'selene', test: r => r.landed === 'moon',
    reward: { cash: 250, sci: 60 }, unlock: { vehicles: ['titan', 'ares'], sites: ['gulf-port'], missions: ['mars'] } },
  { id: 'mars', name: 'Mars', goal: 'Reach Mars', how: 'mission', mission: 'mars', vehicle: 'ares', test: r => (r.visited || []).includes('mars'),
    reward: { cash: 400, sci: 100 }, unlock: { missions: ['venus'] } },
  { id: 'venus', name: 'Venus flyby', goal: 'Swing past Venus', how: 'mission', mission: 'venus', vehicle: 'ares', test: r => (r.visited || []).includes('venus'),
    reward: { cash: 150, sci: 80 }, unlock: {} },
];
// f5b: ONE career. The rungs that Mission Design Bot's contracts cover take their goal text, rewards ($M + 🔬) and
// vehicle/site unlocks from design/career_contracts.js; the ladder keeps its own tests, parts and mission-gate unlocks.
for (const c of LADDER) { const d = DESIGN.find(x => x.rung === c.id); if (!d) continue; c.contract = d.id;
  c.reward = { cash: d.reward.cash || 0, sci: d.reward.sci || 0 }; if (d.goal && d.goal.text) c.goal = d.goal.text;
  for (const k of ['vehicles', 'sites']) if (d.unlock && d.unlock[k]) c.unlock[k] = [...new Set([...(c.unlock[k] || []), ...d.unlock[k]])]; }
export function blank() { return { v: VERSION, cash: 0, sci: 0, done: {}, unlocked: JSON.parse(JSON.stringify(START)), flights: 0, last: null }; }
export function load(store) {
  try { const s = migrate(JSON.parse(store.getItem(KEY) || 'null')); if (!s || s.v !== VERSION || typeof s.done !== 'object') return blank();
    const b = blank(); for (const k in START) b.unlocked[k] = [...new Set([...(START[k]), ...((s.unlocked || {})[k] || [])])]; return { ...b, ...s, unlocked: b.unlocked }; } catch (e) { return blank(); }
}
export function save(store, s) { try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const sandbox = store => { try { return store.getItem(SANDBOX_KEY) === '1'; } catch (e) { return false; } };
export const setSandbox = (store, on) => { try { store.setItem(SANDBOX_KEY, on ? '1' : '0'); } catch (e) { } };
// f5.3 (lead): reaching a rung (every rung below it done) unlocks that rung's recommended rocket, so a card never recommends a locked one
export const reachedVehicles = s => { const out = new Set(); for (const c of LADDER) { if (c.vehicle) out.add(c.vehicle); if (!s.done[c.id]) break; } return out; };
export const isUnlocked = (s, kind, id, sb = false) => sb || !ALL[kind].includes(id) || s.unlocked[kind].includes(id) || (kind === 'vehicles' && reachedVehicles(s).has(id));
export const next = s => LADDER.find(c => !s.done[c.id]) || null;
// f5.1h (QA): after a rung's flight, Next offers the next open rung further up the ladder (never back down to an old skipped one)
export const nextAfter = (s, id) => { const k = LADDER.findIndex(c => c.id === id); return k < 0 ? next(s) : LADDER.slice(k + 1).find(c => !s.done[c.id]) || null; };
export const unlockedBy = (kind, id) => LADDER.find(c => (c.unlock[kind] || []).includes(id)) || null;
// Record a flight result r: { maxAlt, space, orbit, boosterLanded, landed, visited, vehicle, op, opOk, dead }.
// Rungs are earned in order; one flight can earn several consecutive rungs (orbit also passes hop and karman).
export function record(s, r, t = Date.now()) {
  const out = { earned: [], cash: 0, sci: 0, unlocks: [], next: null };
  s.flights++;
  if (r && r.delivered) { const c = r.delivered.cash || 0; s.cash += c; out.cash += c; s.sats = (s.sats || 0) + 1; out.delivered = c; } // f5.2.3: payload delivered to orbit
  if (r && r.stageRecovered) { const c = r.stageRecovered.cash || 0; s.cash += c; out.cash += c; out.refund = c; } // f5.2.3: recovered spacecraft refund
  if (r && r.destination && !r.missed && !r.dead) { const c = r.destination.cash || 0; s.cash += c; out.cash += c; out.destination = c; } // f5.4 (QA A4): mission pay depends on where you went
  if (r && (r.missed || (r.dead && !r.space))) { out.next = next(s); s.last = { t, earned: [] }; return out; } // f5.1h (QA): a missed mission pays $0; f5.4 (QA A4): a crash below space earns no rung either
  for (const c of LADDER) {
    if (s.done[c.id]) continue;
    if (rungLocked(c) || !c.test(r || {})) break;
    s.done[c.id] = t; out.earned.push(c); s.cash += c.reward.cash || 0; s.sci += c.reward.sci || 0; out.cash += c.reward.cash || 0; out.sci += c.reward.sci || 0;
    for (const k in c.unlock) for (const id of c.unlock[k]) if (!s.unlocked[k].includes(id)) { s.unlocked[k].push(id); out.unlocks.push({ kind: k, id }); }
  }
  out.next = next(s); s.last = { t, earned: out.earned.map(c => c.id) };
  return out;
}
