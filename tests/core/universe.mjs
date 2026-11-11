// M1 step 1: headless clock and universe. One versioned save, legacy import, no three/DOM in core/.
// Run: node tests/core/universe.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { Clock, PHYSICS_WARP_MAX, RAILS_WARP_MAX } from '../../core/clock.js';
import { Universe, SAVE_KEY, VERSION, LEGACY_KEYS, migrate } from '../../core/universe.js';
import { KEY as WORLD_KEY } from '../../fun/world.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(k); },
  };
};

console.log('1. Clock advances and warps');
{
  const c = new Clock();
  ok(c.ut === 0 && c.warp === 1 && c.mode === 'physics' && c.effective === 1, 'starts at UT 0, real-time, physics mode');
  ok(c.advance(2) === 2 && c.ut === 2, '1× advance adds real seconds to UT');
  c.setMode('rails'); c.setWarp(10);
  ok(c.mode === 'rails' && c.effective === 10, 'rails mode honours a warp inside the rails cap');
  const u0 = c.ut; ok(c.advance(3) === 30 && c.ut === u0 + 30, 'rails warp multiplies the advance', `ut ${c.ut}`);
  c.setMode('physics'); c.setWarp(100);
  ok(c.warp === 100 && c.effective === PHYSICS_WARP_MAX, 'physics mode caps the rate and keeps the request', `eff ${c.effective}`);
  const u1 = c.ut; ok(c.advance(1) === PHYSICS_WARP_MAX && c.ut === u1 + PHYSICS_WARP_MAX, 'physics advance uses the cap, not the request');
  c.setMode('rails');
  ok(c.effective === 100, 'switching back to rails restores the requested warp');
  c.setWarp(1e12);
  ok(c.effective === RAILS_WARP_MAX && c.warp === RAILS_WARP_MAX, 'rails warp cannot exceed the rails cap', `eff ${c.effective}`);
  ok(PHYSICS_WARP_MAX === 4 && RAILS_WARP_MAX === 1e7, 'caps match the live flight: 4× under physics, 1e7 on rails');
  c.setWarp(0); ok(c.warp === 1 && c.effective === 1, 'warp 0 is not a rate; real-time is the floor');
  const before = c.ut; c.jump(86400); ok(c.ut === before + 86400 && c.warp === 1, 'jump moves UT by a day without changing warp');
  c.jump(-1e12); ok(c.ut === 0, 'UT does not go negative');
  ok(c.advance(-5) === 0 && c.ut === 0, 'a negative frame does not rewind');
  const back = Clock.fromJSON(c.toJSON());
  ok(back.ut === c.ut && back.warp === c.warp && back.mode === c.mode, 'clock JSON round-trips');
  const bad = Clock.fromJSON({ ut: NaN, warp: -3, mode: 'nope' });
  ok(bad.ut === 0 && bad.warp === 1 && bad.mode === 'physics', 'bad clock JSON falls back to a real-time physics clock');
}

console.log('2. Universe round-trip');
{
  const u = new Universe();
  u.clock.setMode('rails'); u.clock.setWarp(1000); u.clock.advance(2);
  const r = [1.9e6, 0, 0], vel = [0, 1500, 0];
  const a = u.addVessel({
    name: 'Comsat 1', body: 'moon', situation: 'orbiting', r, v: vel, t: 1500,
    parts: [{ uid: 1, spec: 'probe-core', parent: null, state: { elec: 80 } }],
    control: { sas: 'prograde', throttle: 0 }, nodes: [{ t: 2000, pro: -10 }],
  });
  r[0] = 0; vel[1] = 0;
  ok(a.orbit.r[0] === 1.9e6 && a.orbit.v[1] === 1500, 'orbit state is copied off the caller arrays');
  ok(u.vessels instanceof Map && u.setActive(a.id) && u.active === a && u.activeId === a.id, 'registry is a Map and activeId points at the vessel');
  ok(u.setActive('missing') === false && u.activeId === a.id, 'an unknown active id is refused');
  ok(u.clock.ut === 2000 && u.advance(1) === 1000 && u.clock.ut === 3000, 'the universe has one clock and advance goes through it');
  const store = mem();
  ok(u.save(store) === true && store.getItem(SAVE_KEY), 'save writes the single universe key');
  const raw = JSON.parse(store.getItem(SAVE_KEY));
  ok(raw.v === VERSION && VERSION === 3 && Array.isArray(raw.vessels) && !raw.vessels.vessels, 'save is versioned JSON, vessels as a list');
  const u2 = Universe.load(store);
  ok(u2.clock.ut === 3000 && u2.clock.warp === 1000 && u2.clock.mode === 'rails' && u2.clock.effective === 1000, 'load restores UT, warp request and mode');
  ok(u2.vessels instanceof Map && u2.vessels.size === 1 && u2.activeId === a.id, 'load restores the registry and activeId');
  const b = u2.get(a.id);
  ok(b && b.name === 'Comsat 1' && b.body === 'moon' && b.situation === 'orbiting', 'vessel identity, body and situation survive');
  ok(b.orbit.epoch === 1500 && b.orbit.r[0] === 1.9e6 && b.orbit.v[1] === 1500, 'orbit epoch and state survive');
  ok(b.parts[0].state.elec === 80 && b.control.sas === 'prograde' && b.control.throttle === 0 && b.nodes[0].pro === -10, 'parts, control and nodes survive');
  ok(u2.remove(a.id) && u2.activeId === null && !u2.get(a.id), 'removing the active vessel clears activeId');
  const thrown = mem(); thrown.setItem = () => { throw new Error('full'); };
  ok(new Universe().save(thrown) === false, 'a throwing store fails the save instead of crashing');
}

console.log('3. Version migration');
{
  const v1 = {
    v: 1, ut: 42, warp: 100, activeId: 'v1', seq: 3,
    vessels: [{ id: 'v1', name: 'Old', body: 'mars', t: 40, r: [3e6, 0, 0], v: [0, 3000, 0], sas: 'retrograde', throttle: 0.5, nodes: [{ t: 50, pro: 1 }], situation: 'flying' }],
  };
  const migrated = migrate(v1);
  ok(migrated.v === 3 && migrated.ut === 42 && migrated.warp === 100 && migrated.warpMode === 'rails', 'v1 with a high warp becomes rails on the current save');
  ok(migrated.vessels[0].orbit.epoch === 40 && migrated.vessels[0].orbit.r[0] === 3e6 && migrated.vessels[0].control.sas === 'retrograde', 'flat r/v/t becomes an orbit and control block');
  ok(migrated.vessels[0].control.throttle === 0.5 && migrated.vessels[0].situation === 'flying' && migrated.vessels[0].nodes[0].t === 50, 'throttle, situation and nodes are kept');
  ok(migrate({ v: 1, ut: 1, warp: 2, vessels: [] }).warpMode === 'physics', 'a v1 warp inside the physics cap stays on physics');
  const store = mem({ [SAVE_KEY]: JSON.stringify(v1) });
  const u = Universe.load(store);
  ok(u.toJSON().v === 3 && u.clock.ut === 42 && u.clock.mode === 'rails' && u.active.body === 'mars', 'load migrates a stored v1 save');
  const again = mem({ [SAVE_KEY]: JSON.stringify(u.toJSON()) });
  const u2 = Universe.load(again);
  ok(u2.clock.ut === 42 && u2.active.control.throttle === 0.5 && u2.toJSON().v === 3, 'a migrated save loads again as the current version');
  let unknown = false; try { Universe.load(mem({ [SAVE_KEY]: JSON.stringify({ v: 9, ut: 1 }) })); } catch (e) { unknown = /version/i.test(e.message); }
  ok(unknown, 'an unknown save version is rejected');
  let corrupt = false; try { Universe.load(mem({ [SAVE_KEY]: '{not json' })); } catch (e) { corrupt = /JSON/i.test(e.message); }
  ok(corrupt, 'corrupt universe JSON is rejected');
}

console.log('4. Legacy save import');
{
  const world = {
    v: 1, seq: 3,
    objs: [
      { id: 'o1', kind: 'sat', name: 'Constellation sat #1', group: 'constellation', r: [7e6, 0, 0], v: [0, 7500, 0], t: 1000, m: 0.2, model: 'heron-9' },
      { id: 'o2', kind: 'sat', name: 'Moon relay', body: 'moon', r: [2e6, 0, 0], v: [0, 1400, 0], t: 5000, craft: 'comsat', elec: 40 },
      { id: 'o3', kind: 'debris', name: 'Fairing' },
    ],
  };
  const quick = {
    v: 1, design: { name: 'Heron 9' }, at: 1700000000000, body: 'moon', tAbs: 8000,
    veh: { r: [1.91e6, 2, 0], v: [0, 1600, 0], sas: 'retrograde', throttle: 0, clamped: false, stages: [{ fuel: 1.5 }], craft: { elec: 80, type: 'comsat' } },
    f: { ignited: true, parked: false, nodes: [{ t: 9000, pro: 100 }], flags: { orbit: 1 }, t0: 0 },
    fleet: {
      seq: 2, activeId: 'v2', originId: 'v1',
      list: [
        { id: 'v1', name: 'Heron 9', type: 'stage', body: 'earth', origin: true, r: [7.1e6, 1, 0], v: [0, 7600, 0], t: 7900, q: [1, 0, 0, 0], w: [0, 0, 0], power: true, veh: { sas: 'prograde', throttle: 0, stages: [{ fuel: 12 }] } },
        { id: 'v2', name: 'Comsat', type: 'comsat', body: 'earth', r: [1.9e6, 0, 0], v: [0, 1500, 0], t: 7900, worldId: 'o2', q: [1, 0, 0, 0], w: [0, 0, 0], power: true, ctx: { nodes: [{ t: 1, pro: 0 }] }, veh: { sas: 'stab', throttle: 1, craft: { elec: 1 } } },
      ],
    },
  };
  const worldJson = JSON.stringify(world), quickJson = JSON.stringify(quick);
  const progress = '{"v":1,"contracts":{}}';
  const store = mem({
    [WORLD_KEY]: worldJson,
    'orbitrush.quicksave.v1': quickJson,
    'orbitrush.progress.v1': progress,
  });
  ok(SAVE_KEY === 'orbitrush.universe', 'one storage key, version lives inside the JSON');
  ok(LEGACY_KEYS.world === WORLD_KEY && WORLD_KEY === 'orbitrush.world.v1', 'world key matches fun/world.js');
  const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
  ok(main.includes(LEGACY_KEYS.quicksave) && LEGACY_KEYS.quicksave === 'orbitrush.quicksave.v1', 'quicksave key matches main.js');
  const u = Universe.load(store);
  ok(store.getItem(WORLD_KEY) === worldJson && store.getItem('orbitrush.quicksave.v1') === quickJson, 'import does not wipe the legacy keys');
  ok(store.getItem('orbitrush.progress.v1') === progress && store.getItem(SAVE_KEY) == null, 'import does not write the new key or touch progress');
  ok(u.clock.ut === 8000 && u.clock.warp === 1 && u.clock.mode === 'physics', 'UT comes from the quicksave; warp starts at real-time');
  ok(u.activeId === 'v2' && u.get('v1') && u.get('v2') && u.get('o1') && !u.get('o2') && !u.get('o3'), 'fleet vessels plus world objects, skipping the linked Moon relay and a record with no state');
  ok(u.get('o1').body === 'earth' && u.get('o1').legacy && u.get('o1').legacy.earthAssumed === true, 'a world object with no body stays Earth and is marked as assumed');
  const moon = u.get('v2');
  ok(moon.body === 'moon' && moon.orbit.r[0] === 1.91e6 && moon.orbit.epoch === 8000, 'the active quicksave craft keeps the Moon and the live state, not the stale fleet vector');
  ok(moon.nodes.length === 1 && moon.nodes[0].t === 9000 && moon.nodes[0].pro === 100, 'active nodes come from the flight snapshot');
  ok(moon.legacy && moon.legacy.veh && moon.legacy.veh.craft.elec === 80 && moon.legacy.veh.stages[0].fuel === 1.5, 'fuel and battery ride along in the legacy vehicle blob');
  ok(u.get('v1').body === 'earth' && u.get('v1').name === 'Heron 9' && u.get('v1').legacy.veh.stages[0].fuel === 12, 'a parked fleet vessel keeps its own body and fuel');
  ok(u.get('o1').situation === 'orbiting' && moon.situation === 'orbiting', 'world payloads and an in-orbit quicksave are orbiting');
  const saved = mem({
    [WORLD_KEY]: worldJson,
    'orbitrush.quicksave.v1': quickJson,
  });
  u.save(saved);
  ok(saved.getItem(WORLD_KEY) === worldJson && saved.getItem('orbitrush.quicksave.v1') === quickJson, 'saving the universe leaves the legacy keys byte-for-byte');
  saved.setItem(WORLD_KEY, '{"v":1,"seq":0,"objs":[]}');
  const u2 = Universe.load(saved);
  ok(u2.get('v2') && u2.get('v2').legacy.veh.craft.elec === 80 && u2.clock.ut === 8000, 'once the universe key exists, load does not re-read legacy');
  const worldOnly = mem({ [WORLD_KEY]: JSON.stringify({ v: 1, seq: 1, objs: [{ id: 'o9', kind: 'sat', name: 'Lone', body: 'mars', r: [4e6, 0, 0], v: [0, 3000, 0], t: 250 }] }) });
  const w = Universe.load(worldOnly);
  ok(w.activeId === null && w.clock.ut === 250 && w.get('o9').body === 'mars', 'a world-only save imports with no active flight and keeps Mars');
  const qsOnly = { v: 1, design: { name: 'Hopper' }, body: 'earth', tAbs: 12, veh: { r: [6378137, 0, 0], v: [0, 0, 0], clamped: true, sas: 'stab', throttle: 0 }, f: { ignited: false, parked: false, nodes: [] } };
  const q = Universe.load(mem({ 'orbitrush.quicksave.v1': JSON.stringify(qsOnly) }));
  ok(q.vessels.size === 1 && q.active && q.active.situation === 'prelaunch' && q.active.name === 'Hopper' && q.clock.ut === 12, 'a quicksave with no fleet becomes one prelaunch vessel');
  const blank = Universe.load(mem());
  ok(blank.vessels.size === 0 && blank.clock.ut === 0 && blank.activeId === null, 'an empty store is a blank universe');
  const messy = mem({ [WORLD_KEY]: 'not-json', 'orbitrush.quicksave.v1': JSON.stringify(qsOnly) });
  const m = Universe.load(messy);
  ok(m.active && m.active.name === 'Hopper' && messy.getItem(WORLD_KEY) === 'not-json', 'a corrupt world key is skipped; the quicksave still imports');
}

console.log('5. v2 legacy stages become a part tree and the legacy blob stays');
{
  const v2 = {
    v: 2, ut: 9, warp: 1, warpMode: 'physics', activeId: 'v1', seq: 1,
    vessels: [{
      id: 'v1', name: 'Old stack', situation: 'flying', body: 'earth',
      orbit: { epoch: 9, r: [7e6, 0, 0], v: [0, 100, 0] },
      parts: [],
      control: { sas: 'stab', throttle: 0.25 },
      nodes: [],
      legacy: { veh: { stages: [{ fuel: 1.5, dry: 0.4, eng: { tv: 30, ispSl: 220, ispVac: 320 }, n: 1 }, { fuel: 12, dry: 4 }], craft: { elec: 80, type: 'comsat' } }, source: 'quicksave' },
    }],
  };
  const migrated = migrate(v2);
  ok(migrated.v === 3 && migrated.vessels[0].legacy.veh.stages[0].fuel === 1.5 && migrated.vessels[0].legacy.veh.stages[1].fuel === 12, 'migration keeps the legacy stage list byte for byte on the vessel');
  const parts = migrated.vessels[0].parts;
  ok(parts.some(p => p.state && p.state.role === 'tank' && p.state.propKg === 1500) && parts.some(p => p.state && p.state.propKg === 12000), 'stage fuel is kept on tank parts, in kilograms');
  ok(parts.some(p => p.state && p.state.elec === 80), 'battery charge from the legacy craft lands on a part');
  const kept = migrate({
    v: 2, ut: 1, warp: 1, warpMode: 'physics', vessels: [{
      id: 'v9', name: 'Already', situation: 'orbiting', body: 'moon', parts: [{ uid: 1, spec: 'probe-core', parent: null, state: { elec: 3 } }],
      legacy: { veh: { stages: [{ fuel: 9 }] } },
    }],
  });
  ok(kept.vessels[0].parts.length === 1 && kept.vessels[0].parts[0].spec === 'probe-core' && kept.vessels[0].legacy.veh.stages[0].fuel === 9, 'a v2 vessel that already has parts keeps them and still keeps legacy');
  const u = Universe.load(mem({ [SAVE_KEY]: JSON.stringify(v2) }));
  ok(u.toJSON().v === 3 && u.get('v1').parts.some(p => p.state && p.state.elec === 80) && u.get('v1').legacy.veh.stages[0].fuel === 1.5, 'loading a v2 save migrates stages into parts without dropping legacy');
}

console.log('6. core/ has no three or DOM imports');
{
  const dir = new URL('../../core/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  ok(files.includes('clock.js') && files.includes('universe.js'), 'clock and universe live under core/', files.join(','));
  const banned = [/from\s+['"][^'"]*three/i, /import\s*\(\s*['"][^'"]*three/i, /\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bnavigator\b/, /\bHTMLElement\b/, /\bXMLHttpRequest\b/];
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    ok(!banned.some(re => re.test(src)), `${f} does not import three or touch the DOM`);
  }
}

console.log(`\nuniverse: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
