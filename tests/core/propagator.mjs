// M1 step 3: rails propagation for every unloaded vessel, any body, SOI hand-off.
// Run: node tests/core/propagator.mjs
import { railsState, advanceUnloaded } from '../../core/propagator.js';
import { Vessel } from '../../core/vessel.js';
import { Universe, SAVE_KEY } from '../../core/universe.js';
import { propagate, elements } from '../../physics/kepler.js';
import { predict } from '../../physics/patched.js';
import { BODIES, transfer } from '../../physics/solar.js';
import { MU_E } from '../../physics/constants.js';
import { RAILS_WARP_MAX } from '../../core/clock.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const speed = a => Math.hypot(a[0], a[1], a[2]);
const energy = (r, v, mu) => speed(v) ** 2 / 2 - mu / speed(r);
const ang = (r, v) => [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(String(k), String(v)); } };
};

// Hyperbolic Moon flyby that enters the Moon's SOI and comes back out to Earth.
// Built in the Moon frame, then expressed in Earth's frame with the kernel's transfer.
function moonFlyby(t) {
  const moon = BODIES.moon, mu = moon.mu, rp = moon.R + 80e3, vinf = 900;
  const e = 1 + rp * vinf * vinf / mu, p = rp * (1 + e);
  const nu = -Math.acos(Math.max(-1, Math.min(1, (p / (moon.soi * 1.002) - 1) / e)));
  const rmag = p / (1 + e * Math.cos(nu)), h = Math.sqrt(mu * p);
  return transfer('moon', 'earth',
    [rmag * Math.cos(nu), rmag * Math.sin(nu), 0],
    [-mu / h * Math.sin(nu), mu / h * (e + Math.cos(nu)), 0], t);
}

console.log('1. A circular orbit returns to its start after one period');
{
  const r = BODIES.earth.R + 300e3, mu = MU_E, vc = Math.sqrt(mu / r);
  const r0 = [r, 0, 0], v0 = [0, vc, 0];
  const T = elements(r0, v0, mu).T;
  const u = new Universe();
  u.clock.setMode('rails');
  const a = u.addVessel({ name: 'LEO', body: 'earth', situation: 'orbiting', r: r0, v: v0, t: 0, nodes: [{ t: 10, pro: 1 }] });
  const epoch = a.orbit.epoch, node = a.nodes[0].pro;
  u.clock.jump(T);
  advanceUnloaded(u);
  ok(dist(a.orbit.r, r0) < 1 && dist(a.orbit.v, v0) < 1e-3, 'one period on rails is back at the start, within a metre', `dr ${dist(a.orbit.r, r0)}`);
  ok(a.body === 'earth' && a.situation === 'orbiting' && a.orbit.epoch === T, 'it is still orbiting Earth at the new epoch');
  ok(a.nodes[0].pro === node && epoch === 0, 'the node is untouched');
  const pure = railsState(a, T);
  ok(a.orbit.r[0] === pure.r[0] && a.orbit.epoch === T, 'reading the state does not move a vessel that is already there');
}

console.log('2. Energy and angular momentum hold across a long rails warp');
{
  const r = BODIES.earth.R + 400e3, mu = MU_E, vc = Math.sqrt(mu / r);
  const r0 = [r, 0, 0], v0 = [0, vc, 0];
  const u = new Universe();
  u.clock.setMode('rails');
  u.clock.setWarp(RAILS_WARP_MAX);
  const a = u.addVessel({ name: 'Coast', body: 'earth', situation: 'orbiting', r: r0, v: v0, t: 0 });
  ok(u.advance(1) === RAILS_WARP_MAX && u.clock.ut === 1e7, 'one real second at the rails cap jumps UT by 1e7 s');
  advanceUnloaded(u);
  const E0 = energy(r0, v0, mu), H0 = ang(r0, v0), E1 = energy(a.orbit.r, a.orbit.v, mu), H1 = ang(a.orbit.r, a.orbit.v);
  ok(Math.abs(E1 - E0) / Math.abs(E0) < 1e-9, 'specific energy is conserved over the warp', E1);
  ok(dist(H1, H0) / speed(H0) < 1e-9, 'angular momentum is conserved over the warp', speed(H1));
  const ref = propagate(r0, v0, 1e7, mu);
  ok(dist(a.orbit.r, ref.r) < 1 && dist(a.orbit.v, ref.v) < 1e-4, 'the long jump matches one Kepler step, not a drifted numerical loop');
  ok(a.body === 'earth' && a.situation === 'orbiting' && Number.isFinite(a.orbit.r[0]), 'the vessel is still in its Earth orbit');
}

console.log('3. Earth to the Moon, and back, including one warp that covers the whole flyby');
{
  const t0 = 1e6;
  const tr = moonFlyby(t0);
  const pred = predict('earth', tr.r, tr.v, t0, { maxPatches: 4, stopAlt: 0 });
  const moon = pred.patches.find(p => p.body === 'moon');
  const back = pred.patches.find(p => p.t0 === moon.t1);
  ok(moon && moon.end.to === 'earth' && back && back.body === 'earth', 'the kernel predicts a Moon encounter that returns to Earth');
  const u = new Universe({ ut: t0 });
  u.clock.setMode('rails');
  const a = u.addVessel({ name: 'Flyby', body: 'earth', situation: 'escaping', r: tr.r, v: tr.v, t: t0 });
  const entry = moon.t0, exit = moon.t1;
  u.clock.jump(entry - 1 - t0);
  advanceUnloaded(u);
  ok(a.body === 'earth' && a.situation === 'escaping', 'a second before entry the ship is still escaping Earth');
  u.clock.jump(2);
  advanceUnloaded(u);
  ok(a.body === 'moon' && Math.abs(a.orbit.epoch - (entry + 1)) < 1, 'SOI entry has handed the ship to the Moon by the predicted time', `epoch ${a.orbit.epoch} entry ${entry}`);
  ok(Math.abs(speed(a.orbit.r) - BODIES.moon.soi) < 2e3, 'the hand-off sits on the Moon SOI boundary', speed(a.orbit.r));
  u.clock.jump(exit + 1 - u.clock.ut);
  advanceUnloaded(u);
  ok(a.body === 'earth' && a.situation === 'escaping', 'the ship comes back out of the Moon SOI onto Earth');
  ok(Math.abs(a.orbit.epoch - (exit + 1)) < 1, 'the return is at the predicted exit', `epoch ${a.orbit.epoch}`);

  const once = new Vessel({ name: 'Jump', body: 'earth', situation: 'escaping', orbit: { epoch: t0, r: tr.r, v: tr.v } });
  const jumped = railsState(once, exit + 30);
  const pure = propagate(tr.r, tr.v, exit + 30 - t0, MU_E);
  const ref = propagate(back.r0, back.v0, exit + 30 - back.t0, MU_E);
  ok(jumped.body === 'earth' && dist(jumped.r, pure.r) > 1e6, 'one jump across the flyby is not the Earth-only conic', `delta ${dist(jumped.r, pure.r)}`);
  ok(dist(jumped.r, ref.r) < 10 && dist(jumped.v, ref.v) < 1e-2, 'that jump matches the patched conic after the return', `dr ${dist(jumped.r, ref.r)}`);
  const sun = pred.patches.find(p => p.body === 'sun');
  const far = railsState(once, t0 + 1e7);
  const farRef = propagate(sun.r0, sun.v0, t0 + 1e7 - sun.t0, BODIES.sun.mu);
  ok(sun && far.body === 'sun' && dist(far.r, farRef.r) < 50, 'a 1e7 s jump still flies the Moon and leaves Earth for the Sun', `dr ${dist(far.r, farRef.r)} body ${far.body}`);
  ok(once.body === 'earth' && once.orbit.epoch === t0, 'railsState does not write the vessel');
}

console.log('4. Escape to a heliocentric orbit');
{
  const t0 = 1e6, r = BODIES.earth.R + 300e3, vesc = Math.sqrt(2 * MU_E / r) * 1.05;
  const r0 = [r, 0, 0], v0 = [0, vesc, 0];
  const pred = predict('earth', r0, v0, t0, { maxPatches: 3, stopAlt: 0 });
  const sun = pred.patches.find(p => p.body === 'sun');
  ok(sun && pred.patches[0].end.type === 'soi-exit' && pred.patches[0].end.to === 'sun', 'the kernel has this hyperbola leaving Earth for the Sun');
  const u = new Universe({ ut: t0 });
  u.clock.setMode('rails');
  const a = u.addVessel({ name: 'Escape', body: 'earth', situation: 'orbiting', r: r0, v: v0, t: t0 });
  u.clock.jump(100);
  advanceUnloaded(u);
  ok(a.body === 'earth' && a.situation === 'escaping', 'still inside Earth, the conic is an escape');
  u.clock.jump(sun.t0 + 100 - u.clock.ut);
  advanceUnloaded(u);
  const ref = propagate(sun.r0, sun.v0, u.clock.ut - sun.t0, BODIES.sun.mu);
  const el = elements(a.orbit.r, a.orbit.v, BODIES.sun.mu, BODIES.sun.R);
  ok(a.body === 'sun' && a.situation === 'orbiting', 'past the SOI the ship is in orbit of the Sun');
  ok(el.e < 1 && dist(a.orbit.r, ref.r) < 10, 'the heliocentric state matches the patched hand-off', `e ${el.e} dr ${dist(a.orbit.r, ref.r)}`);
}

console.log('5. A vessel on the Moon stays on the Moon after save and load');
{
  const rm = 1.9e6, mu = BODIES.moon.mu, vc = Math.sqrt(mu / rm), T = elements([rm, 0, 0], [0, vc, 0], mu).T;
  const u = new Universe();
  u.clock.setMode('rails');
  const a = u.addVessel({ name: 'Relay', body: 'moon', situation: 'orbiting', r: [rm, 0, 0], v: [0, vc, 0], t: 0 });
  const store = mem();
  ok(u.save(store), 'the Moon relay is saved');
  const u2 = Universe.load(store);
  ok(u2.get(a.id).body === 'moon', 'load keeps the Moon');
  u2.clock.setMode('rails');
  u2.clock.jump(T);
  advanceUnloaded(u2);
  const b = u2.get(a.id);
  ok(b.body === 'moon' && b.situation === 'orbiting', 'after a lunar period it is still orbiting the Moon');
  ok(dist(b.orbit.r, [rm, 0, 0]) < 1 && dist(b.orbit.v, [0, vc, 0]) < 1e-3, 'the lunar period closes with the Moon\'s mu, within a metre', `dr ${dist(b.orbit.r, [rm, 0, 0])}`);
  const wrong = propagate([rm, 0, 0], [0, vc, 0], T, MU_E);
  ok(dist(b.orbit.r, wrong.r) > 1e5, 'Earth\'s mu would not have put it back here');
  ok(store.getItem(SAVE_KEY), 'the universe key is the one that was loaded');
}

console.log('6. Several vessels advance on their own');
{
  const re = BODIES.earth.R + 300e3, ve = Math.sqrt(MU_E / re);
  const rm = BODIES.moon.R + 100e3, vm = Math.sqrt(BODIES.moon.mu / rm);
  const u = new Universe();
  u.clock.setMode('physics');
  const leo = u.addVessel({ name: 'LEO', body: 'earth', situation: 'orbiting', r: [re, 0, 0], v: [0, ve, 0], t: 0 });
  const high = u.addVessel({ name: 'High', body: 'earth', situation: 'orbiting', r: [re + 500e3, 0, 0], v: [0, Math.sqrt(MU_E / (re + 500e3)), 0], t: 100 });
  const luna = u.addVessel({ name: 'Luna', body: 'moon', situation: 'orbiting', r: [rm, 0, 0], v: [0, vm, 0], t: 0 });
  u.setActive(leo.id);
  const leoR = leo.orbit.r.slice(), leoE = leo.orbit.epoch;
  u.clock.jump(1000);
  advanceUnloaded(u);
  ok(leo.orbit.epoch === leoE && leo.orbit.r[0] === leoR[0], 'in physics mode the active vessel is loaded and stays where the flight left it');
  const highRef = propagate([re + 500e3, 0, 0], [0, Math.sqrt(MU_E / (re + 500e3)), 0], 900, MU_E);
  const lunaRef = propagate([rm, 0, 0], [0, vm, 0], 1000, BODIES.moon.mu);
  ok(high.body === 'earth' && dist(high.orbit.r, highRef.r) < 1, 'the other Earth ship coasts on its own orbit');
  ok(luna.body === 'moon' && dist(luna.orbit.r, lunaRef.r) < 1, 'the Moon ship coasts on the Moon, not on the Earth ship\'s clock math');
  ok(dist(high.orbit.r, leo.orbit.r) > 1e5 && dist(luna.orbit.r, high.orbit.r) > 1e5, 'the three states stay distinct');
  u.clock.setMode('rails');
  u.clock.jump(500);
  advanceUnloaded(u);
  const leoRef = propagate(leoR, [0, ve, 0], u.clock.ut - leoE, MU_E);
  ok(dist(leo.orbit.r, leoRef.r) < 1 && leo.body === 'earth', 'on rails the active ship coasts too');
}

console.log('7. Surface intersection lands gently and destroys a lithobrake');
{
  const Rb = BODIES.earth.R, w = BODIES.earth.omega, t0 = 5000;
  const rSoft = [Rb + 1, 0, 0];
  const vSoft = [-0.2, w * rSoft[0], 0];
  const u = new Universe({ ut: t0 });
  u.clock.setMode('rails');
  const soft = u.addVessel({ name: 'Hopper', body: 'earth', situation: 'flying', r: rSoft, v: vSoft, t: t0 });
  const halfway = railsState(soft, t0 + 0.2);
  ok(halfway.situation === 'flying' && speed(halfway.r) > Rb, 'before the ground the hopper is still flying');
  u.clock.jump(30);
  advanceUnloaded(u);
  ok(soft.situation === 'landed' && soft.body === 'earth' && Math.abs(speed(soft.orbit.r) - Rb) < 1, 'a slow touchdown becomes landed on the surface', `alt ${speed(soft.orbit.r) - Rb}`);
  ok(soft.orbit.epoch < u.clock.ut, 'the landed epoch is the impact, not the end of the warp');
  const stuck = soft.orbit.r.slice();
  u.clock.jump(1000);
  advanceUnloaded(u);
  ok(soft.situation === 'landed' && dist(soft.orbit.r, stuck) === 0, 'a landed ship stays where it touched');

  const ap = Rb + 200e3, vc = Math.sqrt(MU_E / ap);
  const hard = u.addVessel({ name: 'Litho', body: 'earth', situation: 'orbiting', r: [ap, 0, 0], v: [0, vc * 0.85, 0], t: u.clock.ut });
  const epoch = u.clock.ut;
  u.clock.jump(5000);
  advanceUnloaded(u);
  ok(hard.situation === 'destroyed' && hard.body === 'earth' && Math.abs(speed(hard.orbit.r) - Rb) < 1, 'a suborbital intersection is destroyed at the surface');
  ok(hard.orbit.epoch > epoch && hard.orbit.epoch < u.clock.ut, 'destruction is recorded at the impact time');

  const Rm = BODIES.moon.R, wm = BODIES.moon.omega;
  const rM = [Rm + 1, 0, 0];
  const mooner = u.addVessel({ name: 'Touch', body: 'moon', situation: 'flying', r: rM, v: [-0.2, wm * rM[0], 0], t: u.clock.ut });
  u.clock.jump(30);
  advanceUnloaded(u);
  ok(mooner.situation === 'landed' && mooner.body === 'moon' && Math.abs(speed(mooner.orbit.r) - Rm) < 1, 'an airless moon lands on a surface event, and stays on the Moon');
}

console.log('8. Legacy world objects flagged earthAssumed stay on Earth');
{
  const r = BODIES.earth.R + 300e3, vc = Math.sqrt(MU_E / r), T = elements([r, 0, 0], [0, vc, 0], MU_E).T;
  const u = new Universe();
  u.clock.setMode('rails');
  const a = u.addVessel({
    name: 'Old sat', body: 'earth', situation: 'orbiting', r: [r, 0, 0], v: [0, vc, 0], t: 0,
    legacy: { source: 'world', earthAssumed: true },
  });
  u.clock.jump(T);
  advanceUnloaded(u);
  ok(a.body === 'earth' && a.legacy.earthAssumed === true && dist(a.orbit.r, [r, 0, 0]) < 1, 'an assumed-Earth payload coasts on Earth\'s mu');

  const t0 = 1e6;
  const inside = transfer('moon', 'earth', [BODIES.moon.R + 100e3, 0, 0], [0, 1000, 0], t0);
  const u2 = new Universe({ ut: t0 });
  u2.clock.setMode('rails');
  const parked = u2.addVessel({
    name: 'Misread', body: 'earth', situation: 'orbiting', r: inside.r, v: inside.v, t: t0,
    legacy: { earthAssumed: true },
  });
  const real = u2.addVessel({
    name: 'Already there', body: 'earth', situation: 'orbiting', r: inside.r, v: inside.v, t: t0,
  });
  u2.clock.jump(600);
  advanceUnloaded(u2);
  const earthOnly = propagate(inside.r, inside.v, 600, MU_E);
  const moonMu = propagate(inside.r, inside.v, 600, BODIES.moon.mu);
  ok(parked.body === 'earth' && parked.legacy.earthAssumed === true, 'a flagged object inside the Moon\'s SOI is not handed to the Moon');
  ok(dist(parked.orbit.r, earthOnly.r) < 1, 'it moved under Earth\'s mu');
  ok(dist(parked.orbit.r, moonMu.r) > 100, 'the Moon\'s mu would have been a different path', `delta ${dist(parked.orbit.r, moonMu.r)}`);
  ok(real.body === 'moon' && real.situation === 'destroyed', 'a ship that is not flagged is already in the Moon\'s SOI and meets the surface there');
}

console.log(`\npropagator: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
