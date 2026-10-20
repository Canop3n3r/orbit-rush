// Career campaign + save/load: table order by first flight, unlocks in order, contracts on the right vehicle,
// money/reputation/flight history, and tamper-resistant versioned saves (schema, replay, checksum, migration).
import { CAREER, CONTRACTS, START, missionOf, REPEAT_REWARD } from '../missions/campaign/career.js';
import { newCareer, applyFlight, canFly, replay, available, restartCareer, STIPEND_FLOOR } from '../missions/campaign/state.js';
import { serialize, load, saveTo, loadFrom, SAVE_KEY, VERSION, MIGRATIONS } from '../missions/campaign/save.js';
import { loadMissions } from '../missions/catalog.js';
import { VEHICLES } from '../vehicles/catalog.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const ms = Object.fromEntries((await loadMissions()).map(m => [m.id, m]));
// table
const dated = CAREER.filter(t => t.firstFlight); ok(dated.every((t, i) => i === 0 || t.firstFlight >= dated[i - 1].firstFlight), 'career tiers ordered by first-flight date');
ok(CAREER.at(-1).firstFlight === null && CAREER.at(-1).unlock.future, 'unflown block is a locked future tier');
for (const t of CAREER) { ok(VEHICLES.some(v => v.id === t.vehicleId), `tier ${t.tier}: vehicle ${t.vehicleId} in vehicles/catalog.js`);
  for (const id of t.contracts) { const mid = missionOf(id); ok(!!ms[mid] && !!CONTRACTS[id], `contract ${id} has a mission and terms`); ok(ms[mid] && ms[mid].vehicle.vehicleId === t.vehicleId, `${id} flies on ${t.vehicleId}`); } }
ok(Object.keys(CONTRACTS).every(id => CAREER.some(t => t.contracts.includes(id))), 'every contract belongs to a tier');
// progression
let s = newCareer(); ok(s.money === START.money && s.unlocked.length === 1 && s.unlocked[0] === 'sparrow-1', 'new career: small launcher only');
ok(!canFly(s, 'gto-comsat').ok && canFly(s, 'gto-comsat').why === 'vehicle locked', 'heavy contract locked at start');
s = applyFlight(s, 'first-orbit', { complete: false, score: 500 }); ok(s.money === START.money - 10 && s.rep === 0 && s.flights[0].n === 1 && !s.flights[0].ok, 'failed flight costs money, no reward, rep floored at 0');
s = applyFlight(s, 'first-orbit', { complete: true, score: 8000 }); ok(s.unlocked.includes('heron-heavy') && s.done['first-orbit'] === 8000, 'success unlocks the next tier');
ok(!s.unlocked.includes('heron-9'), 'later tiers stay locked');
const order = ['roadster-helio', 'gto-comsat', 'constellation-batch', 'rideshare', 'sso-rideshare', 'crew-dock', 'station-rendezvous', 'tower-catch', 'super-heavy-catch', 'ship-transfer', 'lunar-landing', 'mars-ship'];
for (const id of order) { ok(canFly(s, id).ok, `can fly ${id} (money ${s.money}, rep ${s.rep})`); s = applyFlight(s, id, { complete: true, score: 10000 }); }
ok(s.unlocked.join() === CAREER.filter(t => !t.unlock.future).map(t => t.vehicleId).join(), 'full career: every flown tier unlocked, in order');
ok(!s.unlocked.includes('titan-ss-v4'), 'future tier never unlocks'); ok(s.flights.length === 14 && s.flights.every((f, i) => f.n === i + 1), 'flight-number history 1..14');
ok(available(s).length > 0, 'contracts available at the end');
let broke = newCareer(); for (let i = 0; i < 8; i++) broke = applyFlight(broke, 'first-orbit', { complete: false, score: 0 });
ok(broke.money === STIPEND_FLOOR && broke.flights.some(f => f.stipend > 0), `stipend tops money back up to the cheapest contract (${broke.money})`);
let threw = false; try { applyFlight({ ...newCareer(), money: 0 }, 'first-orbit', { complete: true }); } catch (e) { threw = true; } ok(threw, 'applyFlight refuses an unaffordable flight');
// ---- QA PR #9 N1: no softlock from any reachable state (exhaustive over win/fail of every available contract, depth 10) ----
{ let seen = 0, stuck = 0; const key = s => JSON.stringify([s.money, s.rep, s.unlocked, Object.keys(s.done).sort()]), vis = new Set();
  const walk = (s, d) => { const k = key(s); if (vis.has(k)) return; vis.add(k); seen++; const av = available(s); if (!av.length) { stuck++; return; } if (d === 0) return;
    for (const id of av) for (const ok_ of [true, false]) walk(applyFlight(s, id, { complete: ok_, score: 1000 }), d - 1); };
  walk(newCareer(), 10); ok(stuck === 0 && seen > 500, `no softlock: ${seen} reachable states, ${stuck} with nothing to fly`); }
ok(available({ ...newCareer(), money: 0 }).includes('practice') && canFly({ ...newCareer(), money: 0 }, 'practice').ok, 'practice is free and always available, even at 0 money');
{ let p = newCareer(); for (let i = 0; i < 50; i++) p = applyFlight(p, 'practice', { complete: true, score: 9000 }); ok(p.rep === 0 && !p.done.practice && p.money === START.money + 50 * CONTRACTS.practice.reward, `practice: tiny reward, no rep farming, never "done" (money ${p.money}, rep ${p.rep})`); }
{ const r = restartCareer(); ok(JSON.stringify(r) === JSON.stringify(newCareer()), 'restart-career option returns a fresh career'); }
// ---- LOWs ----
{ let a = applyFlight(newCareer(), 'first-orbit', { complete: true, score: 1 }); const m1 = a.money, r1 = a.rep; a = applyFlight(a, 'first-orbit', { complete: true, score: 1 });
  ok(a.rep === r1 && a.money === m1 - CONTRACTS['first-orbit'].cost + Math.round(CONTRACTS['first-orbit'].reward * REPEAT_REWARD), `repeat contract: ${Math.round(REPEAT_REWARD * 100)}% reward, no rep`);
  ok(canFly(a, 'roadster-helio').ok && canFly(a, 'gto-comsat').ok, `tier 2 affordable after 2 tier-1 wins (money ${a.money}, roadster ${CONTRACTS['roadster-helio'].cost}, gto ${CONTRACTS['gto-comsat'].cost})`); }
for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) ok(!canFly(newCareer(), id).ok, 'Object.hasOwn on CONTRACTS: ' + id + ' is not a contract');
// save / load
const txt = serialize(s), L = load(txt); ok(L.ok && JSON.stringify(L.career) === JSON.stringify(s), 'save round-trips');
ok(JSON.parse(txt).v === VERSION && JSON.parse(txt).format === SAVE_KEY, 'versioned format');
const tamper = f => { const d = JSON.parse(txt); f(d.career, d); return load(JSON.stringify(d)); };
ok(!tamper(c => { c.money = -5; }).ok, 'rejects negative money');
ok(!tamper(c => { c.money += 1000; }).ok, 'rejects money not matching history');
ok(!tamper(c => { c.rep = 999; }).ok, 'rejects edited reputation');
ok(!tamper(c => { c.unlocked = ['sparrow-1', 'titan-ss-v3']; }).ok, 'rejects unlocks out of order');
ok(!tamper(c => { c.unlocked.push('titan-ss-v4'); }).ok, 'rejects unlocking the future tier');
ok(!tamper(c => { c.flights[0].score = 1e9; }).ok, 'rejects absurd scores');
ok(!tamper(c => { c.flights.splice(1, 1); }).ok, 'rejects a gap in flight numbers');
ok(!tamper(c => { c.flights[0].mission = 'mars-ship'; }).ok, 'rejects a flight on a locked vehicle');
ok(!tamper(c => { c.done['mars-ship'] = 99999; }).ok, 'rejects forged completions');
ok(!tamper(c => { c.flights[0].vehicle = 'titan-ss-v3'; }).ok, 'rejects vehicle mismatch');
ok(!tamper((c, d) => { d.sum = '00000000'; }).ok, 'rejects bad checksum');
// a consistent forged history still has to be a legal career: replay rejects an impossible one
ok(!tamper((c, d) => { c.flights = [{ n: 1, mission: 'lunar-landing', vehicle: 'titan-ss-v3', ok: true, score: 1 }]; }).ok, 'rejects an impossible history');
for (const bad of ['', 'null', '{', '[]', '{"v":99}', '{"format":"x","v":2}', JSON.stringify({ v: 2, format: SAVE_KEY })]) ok(!load(bad).ok, 'corrupt input rejected: ' + bad.slice(0, 20));
const v1 = JSON.stringify({ v: 1, money: 50, flights: [{ mission: 'first-orbit', ok: true, score: 7000 }] }), M = load(v1);
ok(M.ok && M.migrated && M.career.flights[0].n === 1 && M.career.unlocked.includes('heron-heavy'), 'v1 save migrates to v2 via MIGRATIONS[1]');
ok(typeof MIGRATIONS[1] === 'function', 'migration hook present');
const mem = { d: {}, getItem(k) { return k in this.d ? this.d[k] : null; }, setItem(k, v) { this.d[k] = String(v); } };
ok(saveTo(mem, s) && loadFrom(mem).ok, 'localStorage-compatible store round-trip');
ok(!loadFrom({ getItem() { throw new Error('denied'); } }).ok && !saveTo({ setItem() { throw new Error('full'); } }, s), 'throwing storage handled');
{ const d = JSON.parse(serialize(s)); d.career.junk = 'x'.repeat(1000); d.career.flights[0].constructor = { prototype: { polluted: 1 } }; const L2 = load(JSON.stringify(d));
  ok(L2.ok && !('junk' in L2.career) && !Object.hasOwn(L2.career.flights[0], 'constructor') && !({}).polluted, 'load whitelists career / flight fields (junk and constructor keys dropped)');
  const big = JSON.parse(serialize(s)); big.career.junk = 'x'.repeat(600 * 1024); ok(!load(JSON.stringify(big)).ok, 'load caps the save size');
  const t2 = JSON.parse(serialize(s)); t2.career.flights[0].mission = 'toString'; ok(!load(JSON.stringify(t2)).ok, 'flight mission toString rejected via Object.hasOwn');
  const t3 = JSON.parse(serialize(broke)); t3.career.flights.forEach(f => { delete f.stipend; }); ok(!load(JSON.stringify(t3)).ok, 'stipend entries must match the replay'); }
console.log(`campaign: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
