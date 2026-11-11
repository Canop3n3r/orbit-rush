// Stage adapter: a part tree built from each roster rocket derives the stage list
// stepVehicle already burns. That list matches fun/specstack.js specStages for every
// rocket: mass, thrust, and stage groups, including a non-finite fuel split.
// Run: node tests/core/stage.mjs
import * as CAT from '../../vehicles/catalog.js';
import { specStages } from '../../fun/specstack.js';
import { ENGINES, treeFromVehicle, deriveStages, treeFromLegacyVehicle } from '../../core/stage.js';
import { stepVehicle, engineOut, atmAt } from '../../physics/dynamics.js';
import { massOf } from '../../physics/vehicle.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const near = (a, b) => Math.abs(a - b) <= 1e-4 + 1e-8 * Math.abs(b);
// specStages fuel is NaN when a group-0 split has no burn time, and Isp is Infinity when vac Isp is 0.
const sameNum = (a, b) => Object.is(a, b) || (Number.isFinite(a) && Number.isFinite(b) && near(a, b));
const labelOf = (v, i) => [v.company, v.id, v.variant].filter(Boolean).join(' ') || ('rocket ' + i);

function rockets() {
  const out = [];
  for (const [k, v] of Object.entries(CAT)) {
    if (k === 'VEHICLES' || k === 'MISSION_VARIANTS' || k.startsWith('ROSTER_')) for (const r of v) out.push(r);
  }
  return out;
}
function stagesMatch(derived, spec) {
  if (!spec || derived.length !== spec.length) return false;
  for (let s = 0; s < spec.length; s++) {
    const g = derived[s], w = spec[s];
    if (!sameNum(g.dry, w.dry) || !sameNum(g.fuel, w.fuel) || g.n !== w.n) return false;
    if (!sameNum(g.eng.tv, w.tv) || !sameNum(g.eng.ispVac, w.ispVac) || !sameNum(g.eng.ispSl, w.ispSl)) return false;
    if (!!g.radial !== !!w.radial) return false;
    if (w.boosters && g.boosters !== w.boosters) return false;
  }
  return true;
}

console.log('1. Every roster rocket: the tree keeps each stage, the derived list matches specStages');
{
  const all = rockets();
  ok(all.length > 0, 'the roster and catalog have rockets', String(all.length));
  let matched = 0;
  for (let i = 0; i < all.length; i++) {
    const v = all[i], name = labelOf(v, i);
    const tree = treeFromVehicle(v);
    const tanks = tree.toJSON().filter(p => p.state && p.state.role === 'tank').sort((a, b) => a.state.index - b.state.index);
    const stages = Array.isArray(v.stages) ? v.stages : [];
    let treeOk = tanks.length === stages.length;
    for (let s = 0; treeOk && s < stages.length; s++) {
      const st = stages[s], tank = tanks[s];
      if (Math.abs(tank.state.dryKg - (st.dry || 0)) > 1e-6) treeOk = false;
      if (Math.abs(tank.state.propKg - (st.prop || 0)) > 1e-6) treeOk = false;
      if ((tank.state.group || 0) !== (st.group || 0)) treeOk = false;
      const got = {};
      for (const c of tree.children(tank.uid)) if (c.state.role === 'engine') got[c.spec] = (got[c.spec] || 0) + (c.state.n || 1);
      for (const [id, n] of Object.entries(st.engines || {})) if (got[id] !== n || !ENGINES[id]) treeOk = false;
      for (const id of Object.keys(got)) if ((st.engines || {})[id] !== got[id]) treeOk = false;
    }
    ok(treeOk, `${name}: part tree matches roster dry mass, propellant, group and engines`);
    if (!treeOk || !stages.length) continue;
    let spec = null, err = '';
    try { spec = specStages(v); } catch (e) { err = e && e.message || String(e); }
    const derived = deriveStages(tree);
    const same = stagesMatch(derived, spec);
    if (same) matched++;
    ok(same, `${name}: derived stages match specStages mass, thrust and stage groups`, err);
    if (spec && spec.every(x => Number.isFinite(x.dry) && Number.isFinite(x.fuel))) {
      const sumD = derived.reduce((t, s) => t + s.dry + s.fuel, 0);
      const sumR = stages.reduce((t, s) => t + (s.dry || 0) + (s.prop || 0), 0) / 1000;
      ok(near(sumD, sumR), `${name}: derived dry+fuel equals the roster`, `got ${sumD} want ${sumR}`);
    }
  }
  ok(matched === all.length, 'every roster rocket matches specStages', `${matched}/${all.length}`);
}

console.log('2. Decoupling a tree keeps the fuel each stage had');
{
  const v = CAT.VEHICLES.find(r => r.id === 'sparrow-1');
  const tree = treeFromVehicle(v);
  const sep = tree.toJSON().find(p => p.state && p.state.role === 'decoupler' && !p.state.radial);
  const { kept, dropped } = tree.split(sep.uid);
  const fuel = t => t.toJSON().filter(p => p.state.role === 'tank').reduce((s, p) => s + p.state.propKg, 0);
  ok(Math.abs(fuel(kept) + fuel(dropped) - v.stages.reduce((s, st) => s + st.prop, 0)) < 1e-6, 'splitting sparrow-1 does not lose propellant');
  ok(dropped.toJSON().some(p => p.state.role === 'tank' && p.state.index === 0) && kept.toJSON().some(p => p.state.role === 'tank' && p.state.index === 1), 'the bottom stage drops and the upper stage stays');
}

console.log('3. stepVehicle burns the derived stage and leaves the next one alone');
{
  const v0 = CAT.ROSTER_ALBION.find(r => r.id === 'dark-dart');
  const stages = deriveStages(treeFromVehicle(v0));
  const R = 6378137;
  const craft = {
    r: [R + 400000, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0],
    throttle: 1, clamped: false, earthRot: false, stages, cur: 0, payload: 0, fairing: 0,
    rcsFuel: 0, rcsOn: false, sas: 'off', trans: [0, 0, 0], cmdTorque: [0, 0, 0], clock: 0, body: 'earth',
  };
  const alt = Math.hypot(...craft.r) - R;
  const eo = engineOut(craft, atmAt(craft, alt).p);
  const before = stages[0].fuel, upper = stages[1].fuel;
  const dt = 0.02;
  const hit = stepVehicle(craft, dt);
  const drop = before - craft.stages[0].fuel;
  ok(hit !== 'ground' && eo.mdot > 0 && near(drop, eo.mdot * dt / 1000), 'one step burns the first derived stage at the thrust stepVehicle computes', `drop ${drop}`);
  ok(craft.stages[1].fuel === upper && craft.stages[0].eng.tv > 0, 'the upper stage fuel and the first stage thrust are unchanged by that burn');
  ok(massOf(craft) > stages[0].dry, 'mass properties still read the derived parts');
}

console.log('4. A legacy physics stage list becomes a tree the adapter can burn');
{
  const tree = treeFromLegacyVehicle({
    stages: [
      { dry: 4, fuel: 12, fuelMax: 20, eng: { tv: 450, ispSl: 270, ispVac: 335, gimbal: 0.1 }, n: 2, parts: [{ id: 'tank-xl', kind: 'tank', m: 4, h: 6, d: 2.5, fuelCap: 20 }, { id: 'mule', kind: 'engine', m: 0.7, h: 2, d: 2.5, n: 2 }] },
      { dry: 0.5, fuel: 1.5, fuelMax: 1.5, eng: { tv: 30, ispSl: 220, ispVac: 320, gimbal: 0 }, n: 1 },
    ],
    craft: { elec: 80, type: 'comsat' },
  });
  ok(tree.toJSON().some(p => p.state.elec === 80), 'legacy battery charge is on a part');
  const stages = deriveStages(tree);
  ok(stages.length === 2 && near(stages[0].fuel, 12) && near(stages[0].dry, 4) && stages[0].eng.tv === 450 && stages[0].n === 2, 'the bottom legacy stage keeps its fuel, dry mass and thrust');
  ok(near(stages[1].fuel, 1.5) && stages[1].eng.ispVac === 320, 'the upper legacy stage keeps its fuel and Isp');
  const R = 6378137;
  const craft = {
    r: [R + 400000, 0, 0], v: [0, 0, 0], q: [1, 0, 0, 0], w: [0, 0, 0],
    throttle: 1, clamped: false, earthRot: false, stages, cur: 0, payload: 0, fairing: 0,
    rcsFuel: 0, rcsOn: false, sas: 'off', trans: [0, 0, 0], cmdTorque: [0, 0, 0], clock: 0, body: 'earth',
  };
  const before = stages[0].fuel;
  stepVehicle(craft, 0.02);
  ok(craft.stages[0].fuel < before && craft.stages[1].fuel === 1.5, 'stepVehicle burns the migrated stage');
}

console.log(`\nstage: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
