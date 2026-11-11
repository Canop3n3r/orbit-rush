// M1 step 4: Tracking Station session. Rails warp stops on SOI or surface, and Fly / leave
// round-trips the vessel through today's flight snapshot into the one universe save.
// Run: node tests/core/tracking.mjs
import { coast } from '../../core/propagator.js';
import { Universe, SAVE_KEY, LEGACY_KEYS } from '../../core/universe.js';
import { advanceUnloaded } from '../../core/propagator.js';
import { flightSeed, commitFlight, mapView, describeVessel } from '../../scenes/session.js';
import { SceneManager } from '../../scenes/scene_manager.js';
import { Flight } from '../../flight.js?v=f5.9-40';
import { propagate } from '../../physics/kepler.js?v=f5.9-27';
import { predict } from '../../physics/patched.js?v=f5.9-27';
import { BODIES, transfer } from '../../physics/solar.js?v=f5.9-27';
import { MU_E } from '../../physics/constants.js?v=f5.9-27';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(String(k), String(v)); } };
};

function moonFlyby(t) {
  const moon = BODIES.moon, mu = moon.mu, rp = moon.R + 80e3, vinf = 900;
  const e = 1 + rp * vinf * vinf / mu, p = rp * (1 + e);
  const nu = -Math.acos(Math.max(-1, Math.min(1, (p / (moon.soi * 1.002) - 1) / e)));
  const rmag = p / (1 + e * Math.cos(nu)), h = Math.sqrt(mu * p);
  return transfer('moon', 'earth',
    [rmag * Math.cos(nu), rmag * Math.sin(nu), 0],
    [-mu / h * Math.sin(nu), mu / h * (e + Math.cos(nu)), 0], t);
}

console.log('1. A day of rails warp leaves every vessel where Kepler says');
{
  const re = BODIES.earth.R + 300e3, ve = Math.sqrt(MU_E / re);
  const rm = BODIES.moon.R + 100e3, vm = Math.sqrt(BODIES.moon.mu / rm);
  const u = new Universe();
  u.clock.setMode('rails');
  u.clock.setWarp(1e4);
  const leo = u.addVessel({ name: 'LEO', body: 'earth', situation: 'orbiting', r: [re, 0, 0], v: [0, ve, 0], t: 0 });
  const luna = u.addVessel({ name: 'Relay', body: 'moon', situation: 'orbiting', r: [rm, 0, 0], v: [0, vm, 0], t: 0 });
  u.setActive(leo.id);
  const day = coast(u, 86400);
  const leoRef = propagate([re, 0, 0], [0, ve, 0], 86400, MU_E);
  const lunaRef = propagate([rm, 0, 0], [0, vm, 0], 86400, BODIES.moon.mu);
  ok(!day.stopped && day.moved === 86400 && u.clock.ut === 86400, 'a clear day is not cut short', `moved ${day.moved}`);
  ok(u.clock.warp === 1e4 && u.clock.mode === 'rails', 'warp stays where the player set it when nothing is in the way');
  ok(dist(leo.orbit.r, leoRef.r) < 1 && dist(leo.orbit.v, leoRef.v) < 1e-3, 'the Earth ship is within a metre of Kepler', `dr ${dist(leo.orbit.r, leoRef.r)}`);
  ok(luna.body === 'moon' && dist(luna.orbit.r, lunaRef.r) < 1 && dist(luna.orbit.v, lunaRef.v) < 1e-3, 'the Moon ship uses the Moon\'s mu, within a metre', `dr ${dist(luna.orbit.r, lunaRef.r)}`);
  const wrong = propagate([rm, 0, 0], [0, vm, 0], 86400, MU_E);
  ok(dist(luna.orbit.r, wrong.r) > 1e5, 'Earth\'s mu would not have put the relay here');
}

console.log('2. Warp drops to 1× at an SOI change and at the surface');
{
  const t0 = 1e6;
  const tr = moonFlyby(t0);
  const pred = predict('earth', tr.r, tr.v, t0, { maxPatches: 4, stopAlt: 0 });
  const moon = pred.patches.find(p => p.body === 'moon');
  const u = new Universe({ ut: t0 });
  u.clock.setWarp(1e7);
  const a = u.addVessel({ name: 'Flyby', body: 'earth', situation: 'escaping', r: tr.r, v: tr.v, t: t0 });
  const res = coast(u, 1e7);
  ok(res.stopped && res.stopped.type === 'soi' && u.clock.warp === 1, 'an SOI ahead drops the rails warp to real-time', JSON.stringify(res.stopped));
  ok(u.clock.ut < t0 + 1e7 - 1000 && Math.abs(u.clock.ut - moon.t0) < 5, 'the clock stops on the encounter, not a day past it', `ut ${u.clock.ut} entry ${moon.t0}`);
  ok(a.body === 'moon', 'the ship is handed to the Moon at that stop', a.body);

  const Rb = BODIES.earth.R, ap = Rb + 200e3, vc = Math.sqrt(MU_E / ap);
  const u2 = new Universe({ ut: 0 });
  u2.clock.setWarp(1e5);
  const hard = u2.addVessel({ name: 'Litho', body: 'earth', situation: 'orbiting', r: [ap, 0, 0], v: [0, vc * 0.85, 0], t: 0 });
  const safeR = BODIES.earth.R + 400e3, safeV = Math.sqrt(MU_E / safeR);
  const safe = u2.addVessel({ name: 'Safe', body: 'earth', situation: 'orbiting', r: [safeR, 0, 0], v: [0, safeV, 0], t: 0 });
  const hit = coast(u2, 1e6);
  ok(hit.stopped && hit.stopped.type === 'surface' && u2.clock.warp === 1, 'surface contact drops warp to 1×', JSON.stringify(hit.stopped));
  ok(u2.clock.ut < 1e6 && hard.orbit.epoch <= u2.clock.ut + 1e-6, 'the universe does not run on past the impact', `ut ${u2.clock.ut}`);
  ok(hard.situation === 'destroyed' && Math.abs(Math.hypot(...hard.orbit.r) - Rb) < 1, 'the impact is recorded on the surface', hard.situation);
  const safeRef = propagate([safeR, 0, 0], [0, safeV, 0], u2.clock.ut, MU_E);
  ok(dist(safe.orbit.r, safeRef.r) < 1, 'the other ship only coasts up to the same stop', `dr ${dist(safe.orbit.r, safeRef.r)}`);
  const parked = safe.orbit.r.slice();
  coast(u2, 10);
  ok(u2.clock.warp === 1 && dist(safe.orbit.r, propagate(parked, safe.orbit.v, 0, MU_E).r) < 1 || u2.clock.ut > hit.ut, 'after the drop, time runs at 1×');
}

console.log('3. Fly, leave, reload: the vessel is the flight you left');
{
  const re = BODIES.earth.R + 280e3, ve = Math.sqrt(MU_E / re);
  const u = new Universe({ ut: 100 });
  const a = u.addVessel({
    name: 'Comsat 1', body: 'earth', situation: 'orbiting',
    r: [re, 0, 0], v: [0, ve, 0], t: 100,
    control: { sas: 'prograde', throttle: 0 },
    nodes: [{ t: 5000, pro: -12, nrm: 0, rad: 0 }],
  });
  const seed = flightSeed(a, u);
  const F = new Flight(seed.design, {}, seed.opts);
  F.loadSnapshot(seed.snapshot);
  ok(F.body === 'earth' && dist(F.v.r, [re, 0, 0]) < 1 && dist(F.v.v, [0, ve, 0]) < 1e-3, 'Fly opens today\'s flight on the vessel\'s state', `dr ${dist(F.v.r, [re, 0, 0])}`);
  ok(Math.abs(F.tAbs - 100) < 1 && F.v.sas === 'prograde' && F.nodes[0] && F.nodes[0].pro === -12, 'UT, SAS and the node come with it', `t ${F.tAbs}`);
  const fuel0 = F.v.stages[0].fuel;
  F.v.stages[0].fuel = Math.max(0, fuel0 - 0.15);
  const moved = propagate(F.v.r, F.v.v, 600, MU_E);
  F.v.r = moved.r.slice(); F.v.v = moved.v.slice(); F.v.clock = (F.v.clock || 0) + 600;
  F.v.sas = 'retrograde'; F.nodes[0].pro = -3;
  const store = mem({ [LEGACY_KEYS.quicksave]: '{"keep":true}', [LEGACY_KEYS.world]: '{"keep":true}' });
  ok(commitFlight(u, a.id, F.snapshot()) === true, 'leaving the flight writes the vessel');
  ok(u.save(store) && store.getItem(LEGACY_KEYS.quicksave) === '{"keep":true}' && store.getItem(LEGACY_KEYS.world) === '{"keep":true}', 'the universe save does not touch the legacy keys');
  const u2 = Universe.load(store);
  const b = u2.get(a.id);
  ok(b && b.name === 'Comsat 1' && b.body === 'earth' && b.situation === 'orbiting', 'reload still lists the vessel, in orbit');
  ok(dist(b.orbit.r, moved.r) < 1 && dist(b.orbit.v, moved.v) < 1e-3, 'the orbit left behind matches the flight, within a metre', `dr ${dist(b.orbit.r, moved.r)}`);
  ok(b.nodes[0].pro === -3 && b.control.sas === 'retrograde', 'the edited node and SAS survive the reload');
  ok(b.legacy && b.legacy.veh && Math.abs(b.legacy.veh.stages[0].fuel - (fuel0 - 0.15)) < 1e-9, 'fuel is the fuel the flight had when you left', b.legacy && b.legacy.veh.stages[0].fuel);
  ok(u2.clock.ut >= F.tAbs - 1, 'the universe clock has caught up with the flight');
  const again = flightSeed(b, u2);
  const F2 = new Flight(again.design, {}, again.opts);
  F2.loadSnapshot(again.snapshot);
  ok(dist(F2.v.r, b.orbit.r) < 1 && Math.abs(F2.v.stages[0].fuel - (fuel0 - 0.15)) < 1e-9 && F2.nodes[0].pro === -3, 'Fly again resumes that same ship');
  const line = describeVessel(b);
  ok(line.name === 'Comsat 1' && line.bodyName === 'Earth' && line.situationLabel === 'In orbit', 'the station line is name, body and situation in plain words', `${line.bodyName} ${line.situationLabel}`);
}

console.log('4. A Moon craft and an imported quicksave fly as themselves');
{
  const rm = 1.9e6, vm = Math.sqrt(BODIES.moon.mu / rm);
  const u = new Universe({ ut: 50 });
  const relay = u.addVessel({ name: 'Moon relay', body: 'moon', situation: 'orbiting', r: [rm, 0, 0], v: [0, vm, 0], t: 50 });
  const seed = flightSeed(relay, u);
  const F = new Flight(seed.design, {}, seed.opts);
  F.loadSnapshot(seed.snapshot);
  ok(F.body === 'moon' && dist(F.v.r, [rm, 0, 0]) < 1, 'a ship with no flight blob still opens on the Moon', `dr ${dist(F.v.r, [rm, 0, 0])}`);
  commitFlight(u, relay.id, F.snapshot());
  const store = mem();
  u.save(store);
  const back = Universe.load(store).get(relay.id);
  ok(back.body === 'moon' && back.legacy && back.legacy.veh && back.legacy.veh.body === 'moon', 'leaving writes the Moon onto the vessel');

  const quick = {
    v: 1, design: { name: 'Heron 9' }, body: 'moon', tAbs: 8000,
    veh: { r: [1.91e6, 2, 0], v: [0, 1600, 0], sas: 'retrograde', throttle: 0, clamped: false, stages: [{ fuel: 1.5 }] },
    f: { ignited: true, parked: false, nodes: [{ t: 9000, pro: 40 }], flags: { orbit: 1 }, t0: 8000 },
  };
  const imported = Universe.load(mem({ [LEGACY_KEYS.quicksave]: JSON.stringify(quick) }));
  const moon = imported.active;
  const seeded = flightSeed(moon, imported);
  const G = new Flight(seeded.design, {}, seeded.opts);
  G.loadSnapshot(seeded.snapshot);
  ok(G.body === 'moon' && dist(G.v.r, [1.91e6, 2, 0]) < 1 && G.nodes[0].pro === 40, 'a quicksave import flies at its saved Moon state', `body ${G.body}`);
  const view = mapView(imported, moon.id);
  ok(view && view.flight.body === 'moon' && view.flight.tAbs === imported.clock.ut && Array.isArray(view.sats), 'the map view is that vessel at the universe clock');
}

console.log('5. Scene changes are one at a time');
{
  const seen = [];
  const a = { enter() { seen.push('a+'); }, exit() { seen.push('a-'); } };
  const b = { enter() { seen.push('b+'); }, exit() { seen.push('b-'); } };
  const scenes = new SceneManager();
  scenes.enter('tracking', a);
  scenes.enter('tracking', a);
  scenes.enter('flight', b);
  scenes.exit();
  ok(scenes.active === null && seen.join(',') === 'a+,a-,b+,b-', 'enter replaces the previous scene and a repeat does not re-enter', seen.join(','));
  let n = 0;
  scenes.enter('tracking', { tick() { n++; } });
  scenes.tick(0.016);
  ok(n === 1, 'tick reaches the active scene');
}

console.log('6. Coast and a plain advance agree when nothing interrupts');
{
  const r = BODIES.earth.R + 350e3, v = Math.sqrt(MU_E / r);
  const left = new Universe();
  left.clock.setMode('rails');
  left.addVessel({ name: 'A', body: 'earth', situation: 'orbiting', r: [r, 0, 0], v: [0, v, 0], t: 0 });
  const right = Universe.fromJSON(left.toJSON());
  coast(left, 1000);
  right.clock.setMode('rails');
  right.clock.jump(1000);
  advanceUnloaded(right);
  const a = [...left.vessels.values()][0], b = [...right.vessels.values()][0];
  ok(dist(a.orbit.r, b.orbit.r) < 1e-6 && a.orbit.epoch === b.orbit.epoch, 'with no event, coast is advanceUnloaded');
}

console.log(`\ntracking: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
