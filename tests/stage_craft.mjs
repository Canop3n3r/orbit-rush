// OR-002: a separated stage or booster is not deleted. It stays in the fleet as its own craft:
// trackable (a vessel-list row, the same records the map tracking list reads) and flyable (switch to it, burn, switch back).
import { Flight } from '../flight.js';
import * as P from '../physics.js';
import { SHOWROOM } from '../fun/showroom.js';
import { cloneDesign } from '../parts.js';
import { Fleet } from '../fun/fleet.js';
import { R_E } from '../physics/constants.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15));
const design = id => { const d = cloneDesign(SHOWROOM.find(s => s.id === id).design); return d; };
function lift(id, alt, speed) {
  const F = new Flight(design(id), { toast() {}, release() {}, stage() {}, drop() {}, ship() {} }, { t0: T0 });
  const v = F.v; F.ignited = true; F.met = 30; v.clamped = false; v.ut = 0; v.throttle = 0;
  const m = Math.hypot(...v.r); v.r = v.r.map(x => x * (m + alt) / m);
  const up = v.r.map(x => x / Math.hypot(...v.r)), east = [-up[1], up[0], 0], el = Math.hypot(...east) || 1;
  v.v = east.map(x => x / el * speed); P.stepVehicle(v, 0); return F;
}
const circ = alt => Math.sqrt(P.MU / (P.R + alt));

// ---- an expended stage left in space stays, and you can fly it ----
{
  const F = lift('needle', 250000, circ(250000));
  const before = F.fleet.list.length, fuelSep = F.v.stages[0].fuel;
  ok(F.stage() === undefined && F.v.cur === 1, 'staging drops the first stage');
  const sep = F.fleet.list.filter(o => o.separated);
  ok(F.fleet.list.length === before + 1 && sep.length === 1, 'the separated stage joins the fleet instead of being deleted', `fleet ${F.fleet.list.length}`);
  ok(sep[0].name === 'Spent booster' && sep[0].type === 'stage' && !sep[0].origin, 'it is named as its own stage craft', sep[0] && sep[0].name);
  ok(sep[0].veh && sep[0].veh.stages[0].fuel > 0.2 && Math.abs(sep[0].veh.stages[0].fuel - fuelSep) < 1e-6, 'it keeps the fuel it had at separation', sep[0] && sep[0].veh.stages[0].fuel.toFixed(2));
  const row = F.vesselList().find(r => r.id === sep[0].id);
  ok(row && !row.active && F.fleet.others().some(o => o.id === sep[0].id), 'it is a tracking row (vessel list and the parked-craft set the map reads)');
  for (let i = 0; i < 20; i++) F.advance(1);
  ok(F.fleet.get(sep[0].id) && !F.flags.dead, 'it is still there after a minute in orbit', F.flags.dead || `alt ${(F.alt / 1e3).toFixed(0)} km`);
  ok(F.canSwitch(sep[0]).ok && F.switchTo(sep[0].id), 'switch to the spent stage');
  ok(F.v.craft && F.v.craft.type === 'stage' && F.fleet.activeId === sep[0].id && F.v.stages.length === 1, 'you are flying that stage alone');
  const fuel0 = F.v.stages[0].fuel; F.v.ut = 1; for (let i = 0; i < 15; i++) F.advance(0.05);
  ok(F.v.stages[0].fuel < fuel0 - 0.01, 'its own engine burns', `${fuel0.toFixed(2)} → ${F.v.stages[0].fuel.toFixed(2)} t`);
  ok(F.switchTo(F.originId) && !F.v.craft && F.v.cur >= 1, 'switch back to the rocket, upper stack intact');
}

// ---- every serial stage, not only the first ----
{
  const F = lift('selene', 250000, circ(250000));
  const n0 = F.v.stages.length; let n = 0;
  while (F.v.cur < F.last && n < 8) { F.stage(); n++; }
  const sep = F.fleet.list.filter(o => o.separated);
  ok(n === n0 - 1 && sep.length === n && F.fleet.list.length === n0, 'every stage you separate becomes its own craft', `${n} of ${n0}`);
  for (let i = 0; i < 5; i++) F.advance(1);
  ok(sep.every(o => F.fleet.get(o.id)) && !F.flags.dead, 'spent stages stay in space');
}

// ---- a returning booster stays in the fleet below the decay altitude, and you can take it ----
{
  const F = lift('swift', 200000, circ(200000));
  F.stage();
  const b = F.booster, o = b && F.fleet.get(b.vesselId);
  ok(b && b.state === 'flying' && o && o.separated && o.returning && o.keep, 'the returning booster is a kept craft', o && o.name);
  ok(F.vesselList().some(r => r.id === o.id), 'it appears in the vessel list while it flies home');
  // pull it down into the air: the old decay rule would delete anything under 90 km
  const up = b.r.map(x => x / Math.hypot(...b.r)); b.r = up.map(x => x * (P.R + 40000));
  F.fleetTick();
  ok(F.fleet.get(o.id) && F.fleet.get(o.id).keep, 'a returning booster is not deleted in the air');
  ok(F.canRelease() && F.releasePayload(), 'the upper stage can still release');
  const pay = F.fleet.list.find(x => !x.origin && !x.separated);
  ok(pay && !F.switchTo(pay.id, true) && !F.canSwitch(pay).ok, 'a payload stays locked while the booster is flying home');
  ok(!F.cycleVessel(1) && F.booster.state === 'flying' && F.fleet.activeId === F.originId, '] leaves the booster on its landing');
  ok(F.canSwitch(o).ok && F.switchTo(o.id), 'you can take the booster itself');
  ok(F.alt < 140000 && F.v.craft && F.v.craft.type === 'stage' && b.state === 'craft', 'you are flying the booster; the return sim handed it over', `alt ${(F.alt / 1e3).toFixed(0)} km`);
  ok(F.switchTo(F.originId) && F.fleet.activeId === F.originId && !F.v.craft, 'from down there you can switch back to the upper stage');
  // a lost booster leaves the list (it is gone, not parked in space)
  const G = lift('swift', 80000, 2000); G.stage(); const gb = G.booster; gb.state = 'lost'; G.fleetTick();
  ok(!G.fleet.get(gb.vesselId), 'a lost booster is removed from tracking');
}

// ---- side boosters are two craft ----
{
  const F = lift('atlas', 50000, 1500);
  F.stage();
  const ids = (F.boosters || []).map(b => b.vesselId);
  const names = ids.map(id => F.fleet.get(id) && F.fleet.get(id).name);
  ok(F.boosters.length === 2 && ids.every(id => F.fleet.get(id) && F.fleet.get(id).returning), 'each side booster is its own returning craft', names.join(', '));
  F.fleetTick();
  ok(ids.every(id => F.fleet.get(id)), 'both stay in the fleet while they fly home');
}

// ---- a spent stage high above a low periapsis is not dropped the way a decaying satellite is ----
{
  const r = [R_E + 300000, 0, 0], v = [0, 6200, 0], f = new Fleet(); f.activeId = 'x';
  const sep = f.add({ name: 'Stage 2', type: 'stage', separated: true, r, v, t: 0, body: 'earth', m: 4 });
  const sat = f.add({ name: 'Sat', type: 'comsat', r: r.slice(), v: v.slice(), t: 0, body: 'earth', m: 1 });
  const k = f.orbitOf(sep, 0);
  ok(k.alt > 200000 && k.pe < 90000 && k.e < 1 && k.T > 0, 'setup: high now, periapsis in the air', `pe ${(k.pe / 1e3).toFixed(0)} km, T ${k.T.toFixed(0)} s`);
  const gone = f.prune(k.T + 1);
  ok(gone.some(o => o.id === sat.id) && f.get(sep.id), 'the spent stage is still in space after an orbit; the decaying satellite is gone');
}

// OR-003: taking a booster that has already landed parks the flight vehicle on the ground.
// [ ] and Tracking FLY must still leave it. The booster stays in the fleet (it did not burn up).
{
  const F = lift('atlas', 200000, circ(200000));
  F.flags.liftoff = 1; F.flags.space = 1; F.flags.orbit = 1; F.met = 600;
  F.stage();
  const b = F.boosters.find(x => x.id === 'B');
  const up = b.r.map(x => x / Math.hypot(...b.r));
  b.r = up.map(x => x * (P.R + 2)); b.dir = up.slice();
  const w = P.OMEGA_E; b.v = [-w * b.r[1], w * b.r[0], 0]; b.state = 'landed';
  F.fleetTick();
  const sat = F.fleet.add({ name: 'Constellation sat #1', type: 'comsat', origin: false, r: F.v.r.slice(), v: F.v.v.slice(), t: F.tAbs, body: 'earth', m: 0.2, power: true });
  ok(F.switchTo(b.vesselId), 'FLY the landed booster');
  for (let i = 0; i < 5; i++) F.advance(0.05);
  ok(F.parked && F.fleet.activeId === b.vesselId && F.alt < 1000, 'taking it parks you on the ground', `alt ${F.alt.toFixed(0)} parked ${!!F.parked}`);
  const why = F.canSwitch(sat);
  ok(why.ok, 'FLY another craft is allowed from the ground', why.why);
  ok(F.switchTo(sat.id) && F.fleet.activeId === sat.id && !F.parked && !F.flags.landed, 'FLY leaves the grounded booster for the satellite');
  for (let i = 0; i < 8; i++) F.advance(0.05);
  ok(F.fleet.activeId === sat.id && F.alt > 150000 && !F.parked, 'the satellite keeps flying; the ground park does not follow it', `alt ${(F.alt / 1e3).toFixed(0)} km`);
  ok(!!F.fleet.get(b.vesselId), 'the landed booster stays in tracking after you leave it');
  ok(F.switchTo(b.vesselId), 'FLY back onto the grounded booster');
  for (let i = 0; i < 5; i++) F.advance(0.05);
  ok(F.parked && F.fleet.activeId === b.vesselId, 'it parks again');
  const back = F.fleet.activeId;
  ok(F.cycleVessel(1) && F.fleet.activeId !== back && !F.parked, 'Alt+] leaves the grounded craft', F.fleet.active && F.fleet.active.name);
  ok(F.switchTo(b.vesselId), 'return to the grounded booster');
  for (let i = 0; i < 5; i++) F.advance(0.05);
  ok(F.cycleVessel(-1) && F.fleet.activeId !== b.vesselId && !F.parked, 'Alt+[ leaves the grounded craft the other way', F.fleet.active && F.fleet.active.name);
  F.switchTo(F.originId);
  for (const x of F.boosters) x.state = 'landed';
  F.parked = { ef: [1, 0, 0], lift: 20 };
  const block = F.canSwitch(sat);
  ok(F.fleet.activeId === F.originId && !block.ok && /parked on the ground/.test(block.why), 'a ship that landed itself, not a separated visit, still cannot switch', block.why);
}

// Took the booster in the air (its landing sim hands off) and only then touched down.
// Leaving must not drop it: keep was cleared on handoff, and the ground is under the decay altitude.
{
  const F = lift('swift', 200000, circ(200000));
  F.flags.liftoff = 1; F.flags.space = 1; F.flags.orbit = 1; F.met = 600;
  F.stage();
  const b = F.booster, id = b.vesselId, up = b.r.map(x => x / Math.hypot(...b.r)), w = P.OMEGA_E;
  b.r = up.map(x => x * (P.R + 2)); b.dir = up.slice(); b.v = [-w * b.r[1], w * b.r[0], 0];
  F.fleetTick();
  ok(b.state === 'flying' && F.switchTo(id) && b.state === 'craft', 'taking the booster stops its landing sim');
  for (let i = 0; i < 8; i++) F.advance(0.05);
  ok(F.parked && F.fleet.activeId === id, 'touchdown parks the booster you are flying');
  ok(F.cycleVessel(1) && F.fleet.activeId !== id && !F.parked && F.alt > 150000, 'cycling leaves it for the rocket, still in orbit', F.fleet.active && F.fleet.active.name);
  for (let i = 0; i < 5; i++) F.advance(0.2);
  ok(!!F.fleet.get(id), 'a booster you landed and then left is still tracked');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
