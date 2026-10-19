// Orbit Rush f1 — retention: contract chain, part/paint unlocks, achievements, seeded daily challenge with a
// local best, play streak and mission medals. Pure logic over an injected storage (localStorage in the game,
// a Map in tests); every reader survives corrupt or throwing storage.
export const KEY = 'orbitrush.progress.v1';
export const CONTRACTS = [
  { id: 'hop', name: 'First Hop', goal: 'Reach 10 km', test: r => r.maxAlt >= 10000, reward: 'paint:sunset' },
  { id: 'space', name: 'Touch Space', goal: 'Cross the Kármán line (100 km)', test: r => r.space, reward: 'part:ion' },
  { id: 'orbit', name: 'Orbit!', goal: 'Reach a stable orbit', test: r => r.orbit, reward: 'paint:arctic' },
  { id: 'booster', name: 'Stick the Landing', goal: 'Land a booster on the droneship', test: r => r.boosterLanded, reward: 'decal:chevron' },
  { id: 'home', name: 'Round Trip', goal: 'Orbit and bring the capsule home', test: r => r.recovered, reward: 'paint:copper' },
  { id: 'moonfly', name: 'Moonshot', goal: 'Enter the Moon’s sphere of influence', test: r => r.visited.includes('moon'), reward: 'part:xenon' },
  { id: 'moonland', name: 'Footprints', goal: 'Land on the Moon', test: r => r.landed === 'moon', reward: 'paint:lunar' },
  { id: 'mars', name: 'Red Horizon', goal: 'Reach Mars', test: r => r.visited.includes('mars'), reward: 'decal:star' },
  { id: 'venus', name: 'Morning Star', goal: 'Fly past Venus', test: r => r.visited.includes('venus'), reward: 'paint:nebula' },
  { id: 'jovian', name: 'King of Planets', goal: 'Reach Jupiter’s sphere of influence', test: r => r.visited.includes('jupiter'), reward: 'decal:ring' },
];
export const ACHIEVEMENTS = [
  { id: 'firstflight', name: 'Lift-off', icon: '🚀', desc: 'Leave the pad', test: r => r.maxAlt > 50 },
  { id: 'rud', name: 'Unplanned Disassembly', icon: '💥', desc: 'Blow up a rocket', test: r => !!r.dead },
  { id: 'rud10', name: 'Demolition Expert', icon: '🧨', desc: 'Blow up 10 rockets', test: (r, s) => s.stats.booms >= 10 },
  { id: 'machone', name: 'Sound Barrier', icon: '〰️', desc: 'Go supersonic', test: r => r.maxMach >= 1 },
  { id: 'space', name: 'Astronaut Wings', icon: '🌌', desc: 'Reach space', test: r => r.space },
  { id: 'orbit', name: 'Going Around', icon: '🛰️', desc: 'Reach orbit', test: r => r.orbit },
  { id: 'booster', name: 'Tail First', icon: '🎯', desc: 'Land a booster', test: r => r.boosterLanded },
  { id: 'hot', name: 'Fireball', icon: '🔥', desc: 'Survive 500 kW/m² of reentry heating', test: r => r.recovered && r.maxHeat > 5e5 },
  { id: 'moon', name: 'Magnificent Desolation', icon: '🌕', desc: 'Land on the Moon', test: r => r.landed === 'moon' },
  { id: 'mars', name: 'Red Planet', icon: '🔴', desc: 'Reach Mars', test: r => r.visited.includes('mars') },
  { id: 'tourist', name: 'Grand Tourist', icon: '🧭', desc: 'Visit 4 worlds', test: (r, s) => s.visited.length >= 4 },
  { id: 'photo', name: 'Space Photographer', icon: '📸', desc: 'Take a photo', test: (r, s) => s.stats.photos > 0 },
  { id: 'streak3', name: 'Regular', icon: '📅', desc: 'Play 3 days in a row', test: (r, s) => s.streak.n >= 3 },
  { id: 'daily', name: 'Daily Pilot', icon: '⭐', desc: 'Finish a daily challenge', test: (r, s) => Object.keys(s.daily).length > 0 },
];
export const PAINTS = { classic: { name: 'Classic', body: 0xf2f2f2, accent: 0x111111 }, sunset: { name: 'Sunset', body: 0xff8a3c, accent: 0x5a1a00 },
  arctic: { name: 'Arctic', body: 0xdff3ff, accent: 0x1d6fd6 }, copper: { name: 'Copper', body: 0xc8743a, accent: 0x2b1408 },
  lunar: { name: 'Lunar', body: 0x9a9a9a, accent: 0xfff0b0 }, nebula: { name: 'Nebula', body: 0x5a3ab8, accent: 0xff6ad5 }, stealth: { name: 'Stealth', body: 0x222428, accent: 0xff3b3b } };
export const DECALS = { none: '', chevron: '⌃', moon: '☾', star: '★', ring: '◎', flame: '🔥' };
export const DEFAULT_UNLOCKS = ['paint:classic', 'paint:stealth', 'decal:none', 'decal:flame', 'decal:moon'];
// Parts that start locked and are earned by contracts (everything else is open from the start)
export const LOCKED_PARTS = ['ion', 'xenon'];
export function blank() { return { v: 1, contracts: {}, ach: {}, unlocks: [...DEFAULT_UNLOCKS], visited: ['earth'], stats: { flights: 0, booms: 0, photos: 0, best: 0 }, daily: {}, streak: { last: null, n: 0, best: 0 }, medals: {} }; }
export function load(store) {
  try { const s = JSON.parse(store.getItem(KEY)); if (!s || s.v !== 1) return blank(); const b = blank(); return { ...b, ...s, stats: { ...b.stats, ...s.stats }, streak: { ...b.streak, ...s.streak } }; }
  catch (e) { return blank(); }
}
export function save(store, s) { try { store.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } }
export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// streak: consecutive local days with a flight
export function touchStreak(s, t = Date.now()) {
  const k = dayKey(t), y = dayKey(t - 86400000); if (s.streak.last === k) return s.streak.n;
  s.streak.n = s.streak.last === y ? s.streak.n + 1 : 1; s.streak.last = k; s.streak.best = Math.max(s.streak.best, s.streak.n); return s.streak.n;
}
// seeded daily challenge: everyone gets the same one on the same date
function rng(seed) { let x = (Math.imul(seed >>> 0, 2654435761) ^ 0x9e3779b9) >>> 0 || 1; for (let i = 0; i < 4; i++) { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; } return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
export const DAILY_KINDS = [
  { kind: 'alt', fmt: n => `Reach ${n} km with no more than {stages} stages`, pick: r => 60 + Math.floor(r() * 9) * 20, test: (c, r) => r.maxAlt >= c.n * 1000 && r.stages <= c.stages },
  { kind: 'orbitfuel', fmt: () => 'Reach orbit with the most upper-stage fuel left', pick: () => 0, test: (c, r) => r.orbit, score: r => Math.round((r.fuelLeft || 0) * 1000) },
  { kind: 'booster', fmt: () => 'Reach space AND land the booster', pick: () => 0, test: (c, r) => r.space && r.boosterLanded },
  { kind: 'mass', fmt: n => `Reach orbit with a liftoff mass under ${n} t`, pick: r => 160 + Math.floor(r() * 6) * 20, test: (c, r) => r.orbit && r.mass <= c.n },
];
export function dailyChallenge(t = Date.now()) {
  const k = dayKey(t), seed = [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7), r = rng(seed), D = DAILY_KINDS[Math.floor(r() * DAILY_KINDS.length)];
  const c = { day: k, kind: D.kind, n: D.pick(r), stages: 2 + Math.floor(r() * 2) }; c.text = D.fmt(c.n).replace('{stages}', c.stages); return c;
}
export function dailyResult(c, r) { const D = DAILY_KINDS.find(d => d.kind === c.kind); if (!D || !D.test(c, r)) return null; return D.score ? D.score(r) : r.score; }
// medals for a finished mission run: bronze/silver/gold by how much was left in the tank
export function medal(r) { if (!(r.orbit || r.recovered || r.landed || r.visited.length > 1)) return null; const f = r.fuelLeft || 0; return f > 0.3 ? 'gold' : f > 0.1 ? 'silver' : 'bronze'; }
// Record a finished flight; returns what is new (for the toasts / cards)
export function record(s, r, t = Date.now()) {
  r = { maxAlt: 0, space: false, orbit: false, boosterLanded: false, recovered: false, visited: [], landed: null, dead: null, maxMach: 0, maxHeat: 0, stages: 1, mass: 0, fuelLeft: 0, score: 0, ...r };
  const out = { contracts: [], ach: [], unlocks: [], daily: null, medal: null, streak: 0 };
  s.stats.flights++; if (r.dead) s.stats.booms++; s.stats.best = Math.max(s.stats.best, r.score || 0);
  for (const b of r.visited) if (!s.visited.includes(b)) s.visited.push(b);
  out.streak = touchStreak(s, t);
  // the contract chain: only the first open contract can complete per flight… plus any later ones also met
  for (const c of CONTRACTS) if (!s.contracts[c.id] && c.test(r)) { s.contracts[c.id] = dayKey(t); out.contracts.push(c); if (c.reward && !s.unlocks.includes(c.reward)) { s.unlocks.push(c.reward); out.unlocks.push(c.reward); } }
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.test(r, s)) { s.ach[a.id] = dayKey(t); out.ach.push(a); }
  const dc = dailyChallenge(t), ds = dailyResult(dc, r);
  if (ds !== null) { const prev = s.daily[dc.day]; out.daily = { score: ds, best: !prev || ds > prev, prev: prev ?? null }; if (!prev || ds > prev) s.daily[dc.day] = ds;
    const a = ACHIEVEMENTS.find(x => x.id === 'daily'); if (!s.ach.daily) { s.ach.daily = dayKey(t); out.ach.push(a); } }
  out.medal = r.mission ? medal(r) : null; if (out.medal && r.mission) { const order = ['bronze', 'silver', 'gold'], cur = s.medals[r.mission]; if (!cur || order.indexOf(out.medal) > order.indexOf(cur)) s.medals[r.mission] = out.medal; }
  for (const a of ACHIEVEMENTS) if (!s.ach[a.id] && a.test(r, s)) { s.ach[a.id] = dayKey(t); out.ach.push(a); } // ones that depend on the updated totals
  return out;
}
export const nextContract = s => CONTRACTS.find(c => !s.contracts[c.id]) || null;
export const isUnlocked = (s, key) => s.unlocks.includes(key);
export const partLocked = (s, id) => LOCKED_PARTS.includes(id) && !s.unlocks.includes('part:' + id);
