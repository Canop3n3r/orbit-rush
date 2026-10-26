// f6.2 craft switching: every craft left in space is a vessel you can take control of, switch power on/off, and fly with its own propulsion.
import { Flight } from '../flight.js';
import * as P from '../physics.js';
import { SHOWROOM } from '../fun/showroom.js';
import { cloneDesign } from '../parts.js';
import { CRAFT_TYPES, CRAFT_IDS, PROPULSION, buildCraftVehicle, craftTypeFor, rosterIds, rosterInfo, kindOfType, engineDv, typeOf } from '../data/craft_types.js';
import { Fleet, sunlit } from '../fun/fleet.js';
import { KINDS } from '../gfx/vehicles/payload_kinds.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15));
const mk = () => { const d = cloneDesign(SHOWROOM.find(s => s.id === 'swift').design); d.model = 'heron-9'; const log = { toast: [], hook: [] };
  const hooks = { toast: m => log.toast.push(m), release: () => {} }; for (const k of ['vesselSwitched', 'vesselParked', 'vesselLost', 'vesselGone', 'vesselDeployed']) hooks[k] = (...a) => log.hook.push([k, ...a]);
  const F = new Flight(d, hooks, { t0: T0 }); F.placeInOrbit(300000); return { F, log }; };

// ---- every craft type is complete and flies ----
for (const id of CRAFT_IDS) { const T = CRAFT_TYPES[id], v = buildCraftVehicle(id, { house: 'x' });
  ok(T.name && T.cls && T.gfx && PROPULSION[T.prop] && T.blurb !== undefined, `type ${id}: named, with a model and propulsion`, `${T.name} · ${PROPULSION[T.prop].name}`);
  ok(v.stages.length >= 1 && P.massOf(v) > 0 && v.craft.type === id, `type ${id}: builds a flight vehicle`, `${P.massOf(v).toFixed(3)} t`);
  if (T.prop !== 'none' && id !== 'stage') ok(engineDv(v) > 0, `type ${id}: has delta-v`, Math.round(engineDv(v)) + ' m/s'); }
ok(new Set(CRAFT_IDS.map(i => CRAFT_TYPES[i].prop)).size >= 5, 'types use at least five different propulsion kinds', [...new Set(CRAFT_IDS.map(i => CRAFT_TYPES[i].prop))].join(','));
ok(CRAFT_IDS.every(i => KINDS.includes(kindOfType(i)) || i === 'stage'), 'every craft model kind is a registered payload kind');
ok(PROPULSION.ion.ispVac > 1500 && PROPULSION.ion.tPerT < PROPULSION.hypergolic.tPerT / 5, 'ion drives are efficient and feeble, chemical ones the reverse');

// ---- the launcher decides the craft ----
const ids = rosterIds(); ok(ids.length > 40, 'the roster is readable', ids.length + ' vehicles');
const types = new Set(); let bad = 0; for (const id of ids) { const t = craftTypeFor({ model: id }); if (!CRAFT_TYPES[t]) bad++; types.add(t); }
ok(bad === 0, 'every roster launcher resolves to a craft type'); ok(types.size >= 7, 'the roster flies at least seven different craft types', [...types].join(','));
const small = ids.filter(i => rosterInfo(i).payloadKg < 350), big = ids.filter(i => rosterInfo(i).payloadKg > 30000);
ok(small.every(i => ['cubesat', 'smallsat'].includes(craftTypeFor({ model: i }))), 'micro launchers carry cubesats and small satellites', small.length + ' vehicles');
ok(big.length === 0 || big.every(i => ['station', 'tug', 'lander', 'cargo'].includes(craftTypeFor({ model: i }))), 'super-heavy launchers carry station modules, tugs, landers or freighters', big.length + ' vehicles');
ok(craftTypeFor({ model: ids[0], partIds: ['crew'] }) === 'crew', 'a crewed stack deploys a crew capsule');
ok(craftTypeFor({ model: ids[0], constellation: true }) === 'leosat', 'a constellation batch deploys flat-pack satellites');

// ---- switching ----
{ const { F, log } = mk(); ok(F.fleet.list.length === 1 && F.fleet.list[0].origin, 'the launched rocket is vessel 1');
  ok(!F.cycleVessel(1), 'with one vessel there is nothing to switch to');
  ok(F.canRelease(), 'release is offered in orbit'); F.releasePayload(); ok(F.fleet.list.length === 2, 'releasing a payload adds a vessel to the fleet');
  const o = F.fleet.list[1]; ok(o.type && CRAFT_TYPES[o.type] && !o.origin, 'the payload is a piloted-craft type', o.type);
  const alt = F.alt; ok(F.canSwitch().ok, 'switching is allowed in orbit');
  ok(F.switchTo(o.id), 'switch to the released payload'); ok(F.v.craft && F.v.craft.type === o.type && F.fleet.activeId === o.id, 'the payload is now the flown vessel');
  ok(log.hook.some(h => h[0] === 'vesselSwitched') && log.hook.some(h => h[0] === 'vesselParked'), 'the game is told (park + switch hooks)');
  ok(Math.abs(F.alt - alt) < 3000, 'switching keeps position', `${(F.alt / 1e3).toFixed(1)} km`);
  const tA = F.tAbs; for (let i = 0; i < 250; i++) F.advance(0.02); ok(F.tAbs > tA + 4 && F.alt > 250000, 'the craft coasts on its own physics');
  ok(F.hint().length > 5 && !F.setAuto(true, true), 'a craft has its own hint and refuses the ascent autopilot');
  // burn
  const T = typeOf(F.v.craft.type); if (T.prop !== 'none') { F.v.sas = 'prograde'; for (let i = 0; i < 200; i++) F.advance(0.02); const a0 = P.orbitOf(F.v).ap; F.v.ut = 1; for (let i = 0; i < 500; i++) F.advance(0.02); F.v.ut = 0;
    ok(P.orbitOf(F.v).ap > a0 + 100 || F.v.craft.brown, 'the craft burns its own engine', `Ap +${Math.round(P.orbitOf(F.v).ap - a0)} m`); }
  // other vessel is on rails and consistent through warp
  F.setWarp(8); const before = F.vesselList().find(r => r.origin).alt; for (let i = 0; i < 20; i++) F.advance(0.1); const after = F.vesselList().find(r => r.origin).alt;
  ok(Math.abs(after - before) < 60000 && after > 250000, 'a parked vessel keeps its orbit through time warp', `${(before / 1e3).toFixed(0)} → ${(after / 1e3).toFixed(0)} km`);
  F.setWarp(0); ok(F.switchTo(F.originId), 'switch back to the rocket stage'); ok(!F.v.craft && F.v.stages.length >= 2, 'the rocket is restored as a staged vehicle');
  ok(F.cycleVessel(1) && F.v.craft, 'cycle control with ]'); ok(F.cycleVessel(-1) && !F.v.craft, 'and back with [');
  ok(!F.switchTo('nope', true), 'an unknown vessel is refused'); }
// ---- rules ----
{ const { F } = mk(); const d = cloneDesign(SHOWROOM.find(s => s.id === 'swift').design); d.model = 'heron-9'; const G = new Flight(d, { toast() {} }, { t0: T0 });
  ok(!G.canSwitch().ok, 'no switching on the launch pad'); }
// ---- power ----
{ const { F } = mk(); F.releasePayload(); const id = F.fleet.list[1].id; F.switchTo(id); const c = F.v.craft;
  if (!c.noPower) { ok(F.setPower(false), 'power off'); ok(c.power === false, 'the switch is off'); F.v.ut = 1; for (let i = 0; i < 100; i++) F.advance(0.02); ok(F.v.thrust === 0, 'an unpowered craft cannot burn');
    F.switchTo(F.originId); ok(F.fleet.get(id).power === false, 'the off state is remembered while parked'); ok(F.fleet.get(id).w && Math.hypot(...F.fleet.get(id).w) > 0, 'an unpowered craft slowly tumbles');
    ok(F.setVesselPower(id, true) && F.fleet.get(id).power === true, 'power another vessel on from the list'); }
  F.switchTo(F.originId); ok(!F.setPower(false, true), 'rocket stages have no power switch'); }
// ---- battery ----
{ const { F } = mk(); F.releasePayload(); F.switchTo(F.fleet.list[1].id); const c = F.v.craft; if (!c.noPower) {
  ok(c.elec > 0 && c.elecMax > 0, 'a craft carries a battery', `${c.elec.toFixed(1)}/${c.elecMax} Wh`); c.elec = 0.01; c.solarW = 0; c.idleW = 50; for (let i = 0; i < 50; i++) F.advance(0.5);
  ok(c.brown === true, 'an empty battery with no sun browns the craft out'); c.solarW = 400; c.sun = 1; c._st = 1e9; for (let i = 0; i < 600; i++) F.advance(0.5); ok(c.brown === false && c.elec > 0, 'the panels bring it back'); } }
// ---- losing a craft keeps the flight ----
{ const { F, log } = mk(); F.releasePayload(); F.switchTo(F.fleet.list[1].id); const n = F.fleet.list.length; F.fail('test'); ok(F.fleet.list.length === n - 1 && !F.flags.dead, 'a lost craft is removed; the flight goes on');
  ok(!F.v.craft && log.hook.some(h => h[0] === 'vesselLost'), 'control returns to the rocket stage'); }
// ---- snapshot ----
{ const { F } = mk(); F.releasePayload(); F.switchTo(F.fleet.list[1].id); const s = JSON.parse(JSON.stringify(F.snapshot())); const d = cloneDesign(SHOWROOM.find(s0 => s0.id === 'swift').design); d.model = 'heron-9';
  const G = new Flight(d, { toast() {} }, { t0: T0 }); G.loadSnapshot(s); ok(G.fleet.list.length === 2 && G.fleet.activeId === F.fleet.activeId && G.v.craft, 'a saved flight restores the fleet and who you fly'); }
// ---- fleet bookkeeping + decay ----
{ const f = new Fleet(); const a = f.add({ name: 'A', type: 'comsat', r: [7e6, 0, 0], v: [0, 7500, 0], t: 0, body: 'earth', m: 1 }), b = f.add({ name: 'B', type: 'comsat', r: [6.5e6, 0, 0], v: [0, 6000, 0], t: 0, body: 'earth', m: 1 });
  ok(f.list.length === 2 && f.get(a.id), 'fleet adds and finds vessels'); const gone = f.prune(5000); ok(gone.some(o => o.id === b.id) && f.get(a.id), 'a vessel on a re-entry orbit is pruned', gone.map(o => o.name).join()); }
ok(sunlit('earth', [7e6, 0, 0], [0, 7500, 0], T0, 0, 1) >= 0, 'sunlight query works');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
