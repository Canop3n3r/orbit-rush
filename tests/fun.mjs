// Milestone F (fun): one-tap missions flown headlessly from the pad on the real physics (Moon landing, Mars
// capture, Venus flyby, orbit-and-home), take-over, progress (contracts, unlocks, achievements, daily, streak,
// medals, corrupt storage), lore/POIs, the ghost-trajectory track, the plume/vapor mappings, test stand
// hold-down, and the warp limit while a booster flies (split-screen staging).
import * as P from '../physics.js?v=f5b';
import * as FX from '../fxmap.js?v=f5b';
import { Flight, assessDesign, BOOSTER_WARP, simulateAuto } from '../flight.js?v=f5b';
import { TEMPLATES } from '../parts.js?v=f5b';
import { Director, MISSIONS } from '../fun/director.js?v=f5b';
import * as PR from '../fun/progress.js?v=f5b';
import { ATLAS, POIS, nearestPoi, gcDist } from '../fun/lore.js?v=f5b';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), tpl = n => TEMPLATES.find(t => t.name === n);
function fly(id, maxF = 2e6) { const said = []; const F = new Flight(tpl(MISSIONS[id].tpl), {}, { t0: T0 }); const D = new Director(F, id, { say: m => said.push(m) });
  for (let i = 0; i < maxF && D.active; i++) { D.tick(1 / 30); F.advance(1 / 30); } return { F, D, said }; }
// ---------- one-tap missions from the pad ----------
{ const { F, D } = fly('moon'); ok(D.ok && /Landed on the Moon/.test(D.result), 'one-tap Moon: ' + D.result); ok(F.flags.landed && F.body === 'moon' && !F.flags.dead, 'landed intact on the Moon');
  ok(['ascent', 'plan', 'burn', 'cruise', 'capture', 'brake', 'descent', 'done'].every(p => D.log.includes(p)), 'Moon phases: ' + D.log.join('>')); ok(F.goals.moon && F.goals.moon.landed, 'Moon landing goal'); }
{ const { F, D } = fly('mars'); ok(D.ok && F.body === 'mars', 'one-tap Mars: ' + D.result); const o = P.orbitOf(F.v); ok(o.e < 1, `captured at Mars (e ${o.e.toFixed(2)})`); }
{ const { F, D } = fly('venus'); ok(D.ok && F.goals.venus && F.goals.venus.flyby, 'one-tap Venus flyby: ' + D.result); }
{ const { F, D } = fly('orbit'); ok(D.ok && F.flags.recovered, 'one-tap orbit & home: ' + D.result); }
{ const F = new Flight(tpl('Moon lander'), {}, { t0: T0 }), D = new Director(F, 'moon');
  for (let i = 0; i < 900; i++) { D.tick(1 / 30); F.advance(1 / 30); } D.takeOver(); ok(!D.active && !F.autoOn && !F.exec, 'take over: director, AUTO and node execution all off');
  const ph = D.phase; for (let i = 0; i < 60; i++) { D.tick(1 / 30); F.advance(1 / 30); } ok(D.phase === ph, 'director stays out after take-over');
  ok(['orbit', 'moon', 'mars', 'venus'].every(k => tpl(MISSIONS[k].tpl)), 'every mission names an existing template'); ok(typeof D.cam === 'string' && D.progress >= 0 && D.progress <= 1, 'cam + progress'); }
// ---------- progress ----------
{ const mem = new Map(), store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  let s = PR.load(store); ok(s.stats.flights === 0 && s.visited[0] === 'earth', 'blank progress');
  ok(PR.partLocked(s, 'ion') && !PR.partLocked(s, 'bison'), 'ion starts locked, Bison open');
  const day = Date.UTC(2026, 9, 19, 17), o1 = PR.record(s, { maxAlt: 120000, space: true, score: 2000 }, day);
  ok(o1.contracts.map(c => c.id).join() === 'hop,space', 'contracts: First Hop + Touch Space'); ok(o1.unlocks.includes('part:ion') && !PR.partLocked(s, 'ion'), 'contract unlocks the ion engine');
  ok(o1.ach.some(a => a.id === 'space') && o1.ach.some(a => a.id === 'firstflight'), 'achievements awarded'); ok(o1.streak === 1, 'streak starts at 1');
  PR.record(s, { maxAlt: 100, dead: 'boom' }, day + 86400000); ok(s.streak.n === 2, 'next day: streak 2'); PR.record(s, {}, day + 3 * 86400000); ok(s.streak.n === 1 && s.streak.best === 2, 'gap resets the streak, best kept');
  ok(s.stats.booms === 1 && s.ach.rud, 'explosions counted (Unplanned Disassembly)');
  const o2 = PR.record(s, { orbit: true, maxAlt: 2e5, space: true, visited: ['earth', 'moon'], landed: 'moon', fuelLeft: 0.4, mission: 'moon', score: 9000 }, day + 3 * 86400000);
  ok(o2.medal === 'gold' && s.medals.moon === 'gold', 'gold medal with fuel to spare'); ok(s.visited.includes('moon') && s.contracts.moonland, 'Moon visited + Footprints contract');
  PR.save(store, s); const s2 = PR.load(store); ok(s2.medals.moon === 'gold' && s2.streak.best === 2, 'save/load round trip');
  mem.set(PR.KEY, '{corrupt'); ok(PR.load(store).stats.flights === 0, 'corrupt storage → blank'); ok(PR.load({ getItem: () => { throw new Error('x'); } }).v === 1, 'throwing storage → blank');
  ok(!PR.save({ setItem: () => { throw new Error('full'); } }, s), 'save survives a full/blocked storage');
  const a = PR.dailyChallenge(day), b = PR.dailyChallenge(day + 3600000), c = PR.dailyChallenge(day + 86400000 * 5);
  ok(a.text === b.text && a.day === b.day, 'daily challenge is seeded by the date: ' + a.text); ok(a.day !== c.day, 'a new challenge each day');
  const kinds = new Set(); for (let i = 0; i < 40; i++) kinds.add(PR.dailyChallenge(day + i * 86400000).kind); ok(kinds.size >= 3, 'daily challenge varies (' + kinds.size + ' kinds in 40 days)');
  ok(PR.CONTRACTS.every(c => !c.reward || /^(paint|decal|part):/.test(c.reward)) && PR.CONTRACTS.filter(c => c.reward && c.reward.startsWith('part:')).every(c => PR.LOCKED_PARTS.includes(c.reward.slice(5))), 'every reward is a real unlock');
  ok(!TEMPLATES.some(t => t.parts.some(p => PR.LOCKED_PARTS.includes(p.id))), 'no template needs a locked part'); }
// ---------- exploration ----------
{ ok(Object.keys(ATLAS).every(id => P.BODIES[id]), 'every Atlas entry is a real body'); ok(POIS.every(p => P.BODIES[p.body] && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180), 'POIs on real bodies with valid coordinates');
  const n = nearestPoi('moon', P.BODIES.moon.R, 0.5, 23); ok(n && n.poi.id === 'tranq' && n.d < 20000, 'nearest Moon POI: ' + n.poi.name + ' ' + (n.d / 1000).toFixed(1) + ' km');
  ok(Math.abs(gcDist(1, 0, 0, 0, 180) - Math.PI) < 1e-9, 'great-circle distance'); }
// ---------- ghost trajectory ----------
{ const a = assessDesign(tpl('Light & fast') || TEMPLATES[0]); ok(Array.isArray(a.track) && a.track.length > 20, 'verdict carries a ghost track (' + (a.track || []).length + ' points)');
  const L = a.track[a.track.length - 1]; ok(a.orbit ? L[3] === 'orbit' && L[1] > 100 : true, 'track ends in orbit for a good design'); ok(a.track.some(p => p[3] === 'stage'), 'staging marked on the track');
  ok(a.track.every((p, i) => i === 0 || p[2] >= a.track[i - 1][2]), 'track time is monotonic'); ok(JSON.stringify(a.track).length < 20000, 'track is small enough for the worker message');
  const bad = { name: 'flipper', parts: [{ id: 'probe' }, { id: 'tank-l' }, { id: 'tank-l' }, { id: 'bison' }, { id: 'dec' }, { id: 'tank-l' }, { id: 'bison', n: 2 }] }; const ab = assessDesign(bad); ok(ab.track && ab.track.length > 1, 'failing designs get a track too (' + ab.level + ')'); }
// ---------- effects mappings (plume + air) ----------
{ ok(FX.flowStreaks(12000, 0.5) === 0, 'no flow specks at Mach 0.5'); ok(FX.flowStreaks(12000, 1.1) > 0.5, 'flow streaks once compressible');
  ok(FX.vaporCone(0.5, 15000, 2000) === 0 && FX.vaporCone(0.8, 15000, 2000) === 0, 'no vapor cone below Mach 0.86'); ok(FX.vaporCone(0.97, 30000, 5000) > 0.5, 'vapor cone at Mach ~0.97 in humid air'); ok(FX.vaporCone(1.3, 30000, 5000) === 0, 'vapor gone by Mach 1.3');
  const sl = FX.plumeLook(101325, 1), mid = FX.plumeLook(20000, 1), vac = FX.plumeLook(1, 1);
  ok(sl.bellW < mid.bellW && mid.bellW < vac.bellW && vac.bellW > 2.5 && vac.bellW < 4, // f4: capped so it stays subtle at altitude
  `plume bell widens as the air thins (${sl.bellW.toFixed(2)} → ${mid.bellW.toFixed(2)} → ${vac.bellW.toFixed(2)})`);
  ok(sl.bell < 0.05 && vac.bell > 0.5 && vac.bell < 0.7, 'tight column at sea level, faint bell in vacuum (f4 cap)'); ok(vac.len > sl.len, 'longer plume in vacuum');
  ok(FX.plumeLook(101325, 0.4).len < sl.len && FX.plumeLook(101325, 0.4).bright < sl.bright, 'plume scales with throttle'); ok(sl.diamonds > 0.5 && vac.diamonds === 0, 'shock diamonds only in thick air');
  ok(sl.smoke === 1 && vac.smoke < 1e-4, 'exhaust smoke fades with altitude'); }
// ---------- test stand + split-screen warp ----------
{ const F = new Flight(TEMPLATES[0], {}, { t0: T0 }); F.v.holdDown = true; F.stagePress(); F.v.ut = 1;
  for (let i = 0; i < 30 * 12; i++) F.advance(1 / 30); ok(F.v.clamped && F.alt < 200 && !F.flags.dead, 'test stand: full thrust, held down, no "too heavy" failure'); ok(F.v.thrust > 1e3, 'static fire thrust ' + (F.v.thrust / 1000).toFixed(2) + ' MN'); }
{ let seenB = false, capped = true, why = ''; const r = simulateAuto(TEMPLATES[0], { reserve: 16, each: F => { if (F.booster && F.booster.state === 'flying') { seenB = true; const w = F.warpLimit(); if (w[0] > BOOSTER_WARP) capped = false; if (w[1] === 'booster in flight') why = w[1]; } } });
  ok(seenB, 'booster flies on its own after staging');
  ok(capped && why === 'booster in flight', `warp capped at ×${BOOSTER_WARP} for the whole booster flight`);
  ok(r.boosterLanded, 'the booster still lands itself (full physics for both craft)'); }
console.log(`fun: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
