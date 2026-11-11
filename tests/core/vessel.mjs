// Vessel record and situation state machine. The part tree is what the vessel is.
// Run: node tests/core/vessel.mjs
import { Vessel, SITUATIONS, canTransition } from '../../core/vessel.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const stack = () => ([
  { uid: 1, spec: 'probe-core', parent: null, attachNode: null, state: { elec: 80 } },
  { uid: 2, spec: 'upper-tank', parent: 1, attachNode: 'bottom', state: { fuel: 8 } },
  { uid: 3, spec: 'sep', parent: 2, attachNode: 'bottom', state: {} },
  { uid: 4, spec: 'booster-tank', parent: 3, attachNode: 'bottom', state: { fuel: 40 } },
  { uid: 5, spec: 'kero-d', parent: 4, attachNode: 'bottom', state: { n: 9 } },
]);

console.log('1. Record and situations');
{
  ok(SITUATIONS.join() === 'prelaunch,landed,flying,orbiting,escaping,docked,destroyed', 'the seven situations from the architecture');
  const r = [1.9e6, 0, 0], vel = [0, 1500, 0];
  const v = new Vessel({
    id: 'v3', name: 'Comsat 1', situation: 'orbiting', body: 'moon',
    orbit: { epoch: 1500, r, v: vel },
    parts: stack(), control: { sas: 'prograde', throttle: 0 }, nodes: [{ t: 2000, pro: -10 }],
  });
  r[0] = 0; vel[1] = 0;
  ok(v.orbit.r[0] === 1.9e6 && v.orbit.v[1] === 1500, 'orbit state is copied off the caller arrays');
  ok(v.parts[0].state.elec === 80 && v.parts[3].state.fuel === 40, 'the vessel holds the part tree');
  ok(v.transition('flying') === v && v.situation === 'flying', 'orbiting can fall back to flying');
  ok(v.transition('orbiting').transition('escaping').situation === 'escaping', 'flying reaches escape through orbit');
  ok(canTransition('escaping', 'orbiting') && v.transition('orbiting').situation === 'orbiting', 'a capture returns to orbit');
  let illegal = false; try { v.transition('prelaunch'); } catch (e) { illegal = /cannot go from orbiting to prelaunch/.test(e.message); }
  ok(illegal && v.situation === 'orbiting', 'a situation that is not a legal move is refused and the vessel stays');
  v.transition('destroyed');
  let stuck = false; try { v.transition('flying'); } catch (e) { stuck = /cannot go from destroyed/.test(e.message); }
  ok(stuck && v.situation === 'destroyed', 'destroyed is terminal');
  let unknown = false; try { new Vessel({ situation: 'splashed' }); } catch (e) { unknown = /unknown situation/.test(e.message); }
  ok(unknown, 'an unknown situation is rejected');
  const back = Vessel.fromJSON(v.toJSON());
  ok(back.id === 'v3' && back.body === 'moon' && back.situation === 'destroyed' && back.parts[4].spec === 'kero-d' && back.control.sas === 'prograde' && back.nodes[0].pro === -10, 'the vessel record round-trips');
}

console.log('2. Split and merge');
{
  const host = new Vessel({ id: 'v1', name: 'Comsat', situation: 'orbiting', body: 'earth', parts: stack(), orbit: { epoch: 10, r: [7e6, 0, 0], v: [0, 7000, 0] } });
  const dropped = host.split(3, { id: 'v2', name: 'Booster' });
  ok(host.situation === 'orbiting' && dropped.situation === 'flying' && dropped.id === 'v2' && dropped.body === 'earth', 'decoupling keeps the ship in its situation and the piece starts flying');
  ok(host.parts.every(p => p.uid < 3) && host.parts.some(p => p.state.fuel === 8), 'the ship keeps the parts above the separator, fuel included');
  ok(dropped.parts[0].uid === 3 && dropped.parts[0].parent === null && dropped.parts.some(p => p.state.fuel === 40) && dropped.orbit.epoch === 10, 'the dropped tree is rooted at the separator and keeps its fuel and the orbit');
  let dead = false; try { host.transition('destroyed'); host.split(2); } catch (e) { dead = /destroyed/.test(e.message); }
  ok(dead, 'a destroyed vessel does not split');

  const station = new Vessel({ id: 'v8', name: 'Station', situation: 'orbiting', parts: [{ uid: 1, spec: 'bus', parent: null, state: { elec: 100 } }] });
  const visitor = new Vessel({ id: 'v9', name: 'Tug', situation: 'orbiting', parts: [{ uid: 1, spec: 'dock-port', parent: null, state: { fuel: 2 } }, { uid: 2, spec: 'tug-tank', parent: 1, attachNode: 'bottom', state: { fuel: 5 } }] });
  station.merge(visitor);
  ok(visitor.situation === 'docked' && visitor.dockedTo === 'v8' && visitor.parts.length === 0, 'docking leaves the guest docked and empty');
  const port = station.parts.find(p => p.spec === 'dock-port');
  ok(port && port.parent === 1 && port.attachNode === 'dock' && port.state.fuel === 2 && station.parts.some(p => p.spec === 'tug-tank' && p.state.fuel === 5), 'the guest tree hangs off the host on the dock node, fuel unchanged');
  const pad = new Vessel({ id: 'v4', name: 'Pad', situation: 'prelaunch', parts: [{ uid: 4, spec: 'hopper', parent: null, state: { fuel: 1 } }] });
  const before = station.parts.length;
  let refused = false; try { station.merge(pad); } catch (e) { refused = /cannot go from prelaunch to docked/.test(e.message); }
  ok(refused && pad.situation === 'prelaunch' && station.parts.length === before, 'a craft still on the pad cannot dock, and neither tree changes');
  const wreck = new Vessel({ id: 'v5', name: 'Wreck', situation: 'destroyed', parts: [{ uid: 1, spec: 'hulk', parent: null, state: {} }] });
  let no = false; try { station.merge(wreck); } catch (e) { no = /destroyed/.test(e.message); }
  ok(no && wreck.situation === 'destroyed', 'a destroyed craft is not merged');
}

console.log(`\nvessel: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
