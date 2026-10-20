// design/career_contracts.js validator (pure): reachability, acyclic unlocks, real unlock targets, no free rewards, neutral names.
import { readFileSync } from 'node:fs';
import * as D from '../design/career_contracts.js';
import * as L from '../fun/ladder.js';
import { SHOWROOM, MODEL_OF } from '../fun/showroom.js';
import { MISSION_IDS } from '../missions/catalog.js';
import { CONTRACTS as CAMP } from '../missions/campaign/career.js';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
const C = D.CONTRACTS, ids = C.map(c => c.id), byId = Object.fromEntries(C.map(c => [c.id, c]));
const REAL = { vehicles: new Set([...SHOWROOM.map(r => r.id), ...L.ALL.vehicles]), sites: new Set(L.ALL.sites), missions: new Set([...ids, ...L.ALL.missions]) };
ok(new Set(ids).size === ids.length && ids.length === 8, 'eight unique contract ids');
// no free rewards
for (const c of C) ok(c.cost > 0 && c.reward.cash > c.cost && c.reward.sci > 0 && c.reward.rep > 0, `${c.id}: costs ${c.cost}, pays more (${c.reward.cash}) — no free reward`);
// every reward unlocks something real, new, and only once
const seen = { vehicles: new Set(D.START.vehicles), sites: new Set(D.START.sites), missions: new Set(D.START.missions) };
for (const c of C) { const u = Object.entries(c.unlock); ok(u.length && u.every(([, v]) => v.length), `${c.id}: reward unlocks something`);
  for (const [k, v] of u) for (const id of v) { ok(REAL[k] && REAL[k].has(id), `${c.id}: unlock ${k}:${id} exists in the game`); ok(!seen[k].has(id), `${c.id}: unlock ${k}:${id} not already unlocked`); seen[k].add(id); } }
// reachability: fixed point from START, a contract is playable once its mission id, vehicle and site are all unlocked
{ const have = structuredClone({ vehicles: [...D.START.vehicles], sites: [...D.START.sites], missions: [...D.START.missions] }), done = [];
  for (let changed = true; changed;) { changed = false; for (const c of C) if (!done.includes(c.id) && have.missions.includes(c.id) && have.vehicles.includes(c.vehicle) && have.sites.includes(c.site)) {
    done.push(c.id); changed = true; for (const [k, v] of Object.entries(c.unlock)) have[k].push(...v); } }
  ok(done.length === C.length, `every contract reachable from the start (${done.join(' → ')})`);
  ok(done.join() === ids.join(), 'reach order = table order'); }
// placeholder vehicles: contracts flown on them are reachable in the unlock graph but locked to play, and agree with fun/ladder.js
for (const c of C) { const ph = Object.hasOwn(L.PLACEHOLDER_VEHICLES, c.vehicle); ok(!!c.locked === ph, `${c.id}: locked flag ${!!c.locked} matches placeholder vehicle ${ph}`);
  ok(L.rungLocked(L.LADDER.find(r => r.id === c.rung)) === ph, `${c.id}: fun/ladder.js rung lock agrees`); }
ok(C.filter(c => c.locked).map(c => c.id).join() === 'lunar-landing,mars-ship', 'exactly the Moon and Mars contracts wait for models');
ok(C.filter(c => !c.locked).every(c => !Object.hasOwn(L.PLACEHOLDER_VEHICLES, c.vehicle)), 'every playable contract has a real model');
// acyclic: the contract → contract unlock graph has a topological order (Kahn)
{ const edges = C.flatMap(c => (c.unlock.missions || []).filter(m => byId[m]).map(m => [c.id, m])), indeg = Object.fromEntries(ids.map(i => [i, 0]));
  edges.forEach(([, b]) => indeg[b]++); const q = ids.filter(i => !indeg[i]), order = [];
  while (q.length) { const n = q.shift(); order.push(n); for (const [a, b] of edges) if (a === n && !--indeg[b]) q.push(b); }
  ok(order.length === ids.length, 'unlock graph is acyclic'); ok(C.every(c => D.START.missions.includes(c.id) || edges.some(([, b]) => b === c.id)), 'every non-start contract is unlocked by another contract'); }
// unit test of the validators themselves on a cycle
{ const bad = [{ id: 'a', unlock: { missions: ['b'] } }, { id: 'b', unlock: { missions: ['a'] } }], e = bad.flatMap(c => c.unlock.missions.map(m => [c.id, m])), d = { a: 0, b: 0 }; e.forEach(([, b]) => d[b]++);
  ok(Object.values(d).every(x => x > 0), 'a 2-cycle has no zero-indegree node (detector sanity)'); }
// ids line up with the game and the campaign
for (const c of C) { ok(L.LADDER.some(r => r.id === c.rung), `${c.id}: rung ${c.rung} exists in fun/ladder.js`); ok(c.mission === null || MISSION_IDS.includes(c.mission), `${c.id}: mission ${c.mission} exists`);
  ok(c.mission === null || Object.hasOwn(CAMP, c.id), `${c.id}: reuses the campaign contract id`); ok(REAL.vehicles.has(c.vehicle) && L.ALL.sites.includes(c.site), `${c.id}: vehicle/site exist`);
  ok(typeof c.goal.text === 'string' && c.goal.kind, `${c.id}: goal`);
  ok(c.inspiration.length && c.inspiration.every(i => D.INSPIRATION_COMPANIES.includes(i.company) && D.INSPIRATION_VEHICLES.includes(i.vehicle) && i.note), `${c.id}: inspiration uses listed parody companies / neutral ids`); }
for (const id of L.ALL.sites) ok(D.SITES[id] && D.SITES[id].name, `site ${id} has a neutral name`);
ok(MODEL_OF.needle === 'sparrow-1' && MODEL_OF.swift === 'heron-9', 'showroom → catalog mapping as documented');
// neutrality scan (same ROT13 list as tests/missions.mjs)
const rot = s => s.replace(/[a-z]/gi, c => String.fromCharCode((c <= 'Z' ? 65 : 97) + ((c.toLowerCase().charCodeAt(0) - 97 + 13) % 26)));
const BAD = ['fcnprk', 'fgneyvaxf?', 'snypbaf?', 'qentbaf?', 'fgnefuvcf?', 'fhcre ?urnil', 'zrpunmvyyn', 'pubcfgvpxf?', 'encgbef?', 'zreyvaf?', 'SU', 'nfqf', 'zhfx', 'S9'].map(rot);
const BRANDS = new RegExp('\\b(' + BAD.join('|') + ')\\b', 'i');
for (const f of ['design/career_contracts.js', 'design/CAREER_CONTRACTS.md', 'tests/career_contracts.mjs']) readFileSync(new URL('../' + f, import.meta.url), 'utf8').split('\n')
  .forEach((l, i) => ok(!BRANDS.test(l), `${f}:${i + 1} neutral`));
console.log(`career_contracts: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
