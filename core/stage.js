// Derive the stage list physics/dynamics.stepVehicle already burns from a part tree.
// The tree is the saved truth: one tank part per roster stage, fuel stays on that tank.
// The list is a view. Where the roster has a liftoff group with burn times, the view matches
// today's specStages grouping (strap-ons plus the core propellant burned beside them, then
// the core, then later groups). Where that split is not defined, the view is one stage per tank.
// Masses below are tonnes, the unit stepVehicle uses. The tree stores the roster's kilograms.

import { PartTree } from './parttree.js';
import * as CAT from '../vehicles/catalog.js';

export const ENGINES = {};
for (const [k, v] of Object.entries(CAT)) {
  if (k === 'ENGINES' || k.startsWith('ENGINES_')) Object.assign(ENGINES, v);
}

const num = x => { const n = +x; return Number.isFinite(n) ? n : 0; };

function engineMap(tree, uid) {
  const o = {};
  for (const c of tree.children(uid)) {
    if (!c.state || c.state.role !== 'engine') continue;
    o[c.spec] = (o[c.spec] || 0) + (c.state.n || 1);
  }
  return o;
}

// Vacuum thrust the way fun/specstack.js engOf does, per stage, before a parallel group is summed.
function engOf(engines) {
  let n = 0, tv = 0, tsl = 0, fv = 0, fsl = 0;
  for (const [id, k] of Object.entries(engines)) {
    const e = ENGINES[id];
    if (!e || !(k > 0) || !(e.ispVac > 0)) return null;
    n += k;
    tv += k * e.tVac;
    tsl += k * (e.tSl || 0);
    fv += k * e.tVac / e.ispVac;
    fsl += e.ispSl > 0 ? k * (e.tSl || 0) / e.ispSl : 0;
  }
  if (!n || !(fv > 0)) return null;
  const ispVac = tv / fv, ispSl = tsl > 0 ? tsl / fsl : ispVac * 0.6;
  if (!Number.isFinite(ispVac) || !Number.isFinite(ispSl)) return null;
  return { n, tv: tv / n, ispSl, ispVac, thrustKn: tv };
}

function combineEng(parts) {
  const T = parts.reduce((t, x) => t + x.tv * x.n, 0);
  const n = parts.reduce((t, x) => t + x.n, 0);
  const fv = parts.reduce((t, x) => t + x.tv * x.n / x.ispVac, 0);
  const fs = parts.reduce((t, x) => t + x.tv * x.n / x.ispSl, 0);
  if (!n || !(fv > 0) || !(fs > 0)) return null;
  const ispVac = T / fv, ispSl = T / fs;
  if (!Number.isFinite(ispVac) || !Number.isFinite(ispSl)) return null;
  return { n, tv: T / n, ispSl, ispVac, thrustKn: T };
}

function fallbackEng(engines) {
  let n = 0, T = 0;
  for (const [id, k] of Object.entries(engines)) {
    const e = ENGINES[id];
    n += k;
    T += k * ((e && e.tVac) || 0);
  }
  return { n, tv: n ? T / n : 0, ispSl: 0, ispVac: 0, gimbal: 0, thrustKn: T };
}

function tanksOf(tree) {
  const list = tree.toJSON();
  return list.filter(p => p.state && p.state.role === 'tank').map(p => ({
    uid: p.uid,
    spec: p.spec,
    index: p.state.index || 0,
    group: p.state.group || 0,
    dryKg: num(p.state.dryKg),
    propKg: num(p.state.propKg),
    fuelMaxKg: p.state.fuelMaxKg == null ? num(p.state.propKg) : num(p.state.fuelMaxKg),
    burn: p.state.burn,
    jettisonAt: p.state.jettisonAt,
    boosters: p.state.boosters || 0,
    engines: engineMap(tree, p.uid),
    source: p.state.source || null,
    n: p.state.n || 0,
    tv: p.state.tv || 0,
    ispSl: p.state.ispSl || 0,
    ispVac: p.state.ispVac || 0,
    gimbal: p.state.gimbal || 0,
    radial: p.state.radial || false,
  }));
}

function pack(tank, eng, extra = {}) {
  return {
    dryKg: tank.dryKg,
    fuelKg: tank.propKg,
    fuelMaxKg: tank.fuelMaxKg,
    group: tank.group,
    radial: false,
    boosters: null,
    eng,
    spec: tank.spec,
    engineSpec: Object.keys(tank.engines)[0] || tank.spec,
    ...extra,
  };
}

// Same grouping as fun/specstack.js specStages. Returns null when the burn split is not defined
// (missing burn, or an engine with no vacuum Isp): the caller lists one stage per tank instead.
function trySpec(tanks) {
  const g0 = tanks.filter(s => (s.group || 0) === 0).sort((a, b) => a.index - b.index);
  const rest = tanks.filter(s => (s.group || 0) > 0).sort((a, b) => a.group - b.group || a.index - b.index);
  if (!g0.length) return null;
  const core = g0.length > 1 ? g0.reduce((a, b) => (b.burn > a.burn ? b : a)) : g0[0];
  const boost = g0.filter(s => s !== core);
  const coreEng = engOf(core.engines);
  const restEng = rest.map(s => engOf(s.engines));
  if (!coreEng || restEng.some(e => !e)) return null;
  if (!boost.length) return [pack(core, coreEng), ...rest.map((s, i) => pack(s, restEng[i]))];
  const boostEng = boost.map(s => engOf(s.engines));
  if (boostEng.some(e => !e)) return null;
  const bt = Math.max(...boost.map(s => s.jettisonAt || s.burn));
  const coreUsed = Math.min(core.propKg * 0.9, core.propKg * bt / core.burn);
  if (!Number.isFinite(bt) || !Number.isFinite(coreUsed)) return null;
  const merged = combineEng([...boostEng, coreEng]);
  if (!merged) return null;
  const nb = boost.every(s => s.boosters > 0) ? boost.reduce((t, s) => t + s.boosters, 0) : null;
  return [
    {
      dryKg: boost.reduce((t, s) => t + s.dryKg, 0),
      fuelKg: boost.reduce((t, s) => t + s.propKg, 0) + coreUsed,
      fuelMaxKg: boost.reduce((t, s) => t + s.propKg, 0) + coreUsed,
      group: 0,
      radial: true,
      boosters: nb,
      eng: merged,
      spec: boost[0].spec,
      engineSpec: Object.keys(boost[0].engines)[0] || boost[0].spec,
    },
    pack(core, coreEng, { fuelKg: core.propKg - coreUsed, fuelMaxKg: core.propKg - coreUsed }),
    ...rest.map((s, i) => pack(s, restEng[i])),
  ];
}

function rawRows(tanks) {
  return tanks.slice().sort((a, b) => a.index - b.index).map(t => {
    const eng = t.source === 'legacy'
      ? (t.tv > 0
        ? { n: t.n || 1, tv: t.tv, ispSl: t.ispSl, ispVac: t.ispVac, gimbal: t.gimbal, thrustKn: t.tv * (t.n || 1) }
        : { n: t.n || 0, tv: 0, ispSl: 1, ispVac: 1, gimbal: 0, thrustKn: 0 })
      : (engOf(t.engines) || fallbackEng(t.engines));
    return {
      dryKg: t.dryKg,
      fuelKg: t.propKg,
      fuelMaxKg: t.fuelMaxKg,
      group: t.group,
      radial: t.radial,
      boosters: t.boosters || null,
      eng,
      spec: t.spec,
      engineSpec: Object.keys(t.engines)[0] || t.spec,
    };
  });
}

function rowToStage(row) {
  const eng = row.eng || { n: 0, tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 };
  const dry = row.dryKg / 1000, fuel = row.fuelKg / 1000, fuelMax = (row.fuelMaxKg == null ? row.fuelKg : row.fuelMaxKg) / 1000;
  const live = eng.tv > 0;
  const parts = [];
  if (live) parts.push({ id: row.engineSpec || 'engine', kind: 'engine', h: 2, d: 1.6, m: 0, n: eng.n, gimbal: eng.gimbal || 0 });
  parts.push({ id: row.spec || 'tank', kind: 'tank', h: 8, d: 3, m: dry, fuelCap: fuelMax, nose: { cd: 1.2, rn: 0.6, cpFrac: 0.4 } });
  const stage = {
    dry, fuel, fuelMax,
    eng: live ? { tv: eng.tv, ispSl: eng.ispSl, ispVac: eng.ispVac, gimbal: eng.gimbal || 0 } : { tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 },
    n: eng.n || 0,
    fins: false,
    parts,
    group: row.group || 0,
  };
  if (row.radial) stage.radial = row.radial === true ? true : row.radial;
  if (row.boosters) stage.boosters = row.boosters;
  return stage;
}

function hangPayload(stages, tree) {
  if (!stages.length) return stages;
  const top = stages[stages.length - 1];
  for (const p of tree.toJSON()) {
    if (!p.state) continue;
    if (p.state.role === 'payload' && p.state.dryKg > 0) {
      top.parts.push({ id: p.spec, kind: 'payload', h: 2, d: 2, m: p.state.dryKg / 1000, fuelCap: 0, nose: { cd: 1.2, rn: 0.5, cpFrac: 0.4 } });
    } else if (p.state.role === 'fairing' && p.state.dryKg > 0) {
      top.parts.push({ id: p.spec, kind: 'fairing', h: 0, d: 3, m: p.state.dryKg / 1000, fuelCap: 0 });
    }
  }
  return stages;
}

export function deriveStages(tree) {
  const tanks = tanksOf(tree);
  if (!tanks.length) return [];
  const legacy = tanks.some(t => t.source === 'legacy');
  const rows = legacy ? rawRows(tanks) : (trySpec(tanks) || rawRows(tanks));
  return hangPayload(rows.map(rowToStage), tree);
}

function payloadKgOf(v) {
  if (v.capsule) {
    const c = v.capsule.launch || v.capsule.dry || 0;
    if (c > 0) return c;
  }
  const m = (v.modes || [])[0];
  if (!m) return 0;
  if (m.payload > 0) return m.payload;
  if (m.payloadLEO > 0) return m.payloadLEO;
  return 0;
}

function radialIndexes(stages) {
  const groups = new Map();
  stages.forEach((s, i) => {
    const g = s.group || 0;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  });
  const radial = new Set();
  for (const idxs of groups.values()) {
    const parallel = idxs.filter(i => stages[i].parallel);
    const boosted = idxs.filter(i => stages[i].boosters > 0);
    if (parallel.length && parallel.length < idxs.length) parallel.forEach(i => radial.add(i));
    else if (boosted.length && boosted.length < idxs.length) boosted.forEach(i => radial.add(i));
  }
  stages.forEach((s, i) => { if (s.parallel) radial.add(i); });
  return radial;
}

function radialHost(stages, i, radial) {
  const g = stages[i].group || 0;
  for (let j = 0; j < stages.length; j++) {
    if (j !== i && !radial.has(j) && (stages[j].group || 0) === g) return j;
  }
  for (let j = i + 1; j < stages.length; j++) if (!radial.has(j)) return j;
  for (let j = i - 1; j >= 0; j--) if (!radial.has(j)) return j;
  return null;
}

function addTank(tree, tag, s, index, parent, attachNode) {
  const state = {
    role: 'tank',
    index,
    group: s.group == null ? 0 : s.group,
    dryKg: num(s.dry),
    propKg: num(s.prop),
  };
  if (s.burn != null) state.burn = +s.burn;
  if (s.jettisonAt != null) state.jettisonAt = +s.jettisonAt;
  if (s.igniteAt != null) state.igniteAt = +s.igniteAt;
  if (s.boosters) state.boosters = s.boosters;
  if (s.parallel) state.parallel = true;
  if (s.coreFrac != null) state.coreFrac = +s.coreFrac;
  if (s.propellant) state.propellant = s.propellant;
  const tank = tree.add({ spec: `${tag}#s${index}`, parent, attachNode, state });
  for (const [id, n] of Object.entries(s.engines || {})) {
    tree.add({ spec: id, parent: tank.uid, attachNode: 'bottom', state: { role: 'engine', n: n || 1 } });
  }
  return tank;
}

// Build a part tree from one vehicles/ roster or catalog rocket.
export function treeFromVehicle(v) {
  const tree = new PartTree();
  if (!v) return tree;
  const tag = [v.id || 'rocket', v.variant].filter(Boolean).join(':').replace(/\s+/g, '-');
  const root = tree.add({
    spec: v.capsule && v.capsule.id ? v.capsule.id : `${tag}#payload`,
    state: { role: 'payload', dryKg: payloadKgOf(v), elec: 0 },
  });
  if (v.fairing > 0) {
    tree.add({ spec: `${tag}#fairing`, parent: root.uid, attachNode: 'top', state: { role: 'fairing', dryKg: v.fairing } });
  }
  const stages = Array.isArray(v.stages) ? v.stages : [];
  if (!stages.length) return tree;
  const radial = radialIndexes(stages);
  const axial = stages.map((_, i) => i).filter(i => !radial.has(i));
  const ordered = axial.slice().sort((a, b) => {
    const ga = stages[a].group || 0, gb = stages[b].group || 0;
    if (ga !== gb) return gb - ga;
    return b - a;
  });
  const tankUid = new Map();
  let parent = root.uid;
  ordered.forEach((idx, n) => {
    const tank = addTank(tree, tag, stages[idx], idx, parent, 'bottom');
    tankUid.set(idx, tank.uid);
    if (n < ordered.length - 1) {
      const dec = tree.add({
        spec: `${tag}#sep-${idx}`,
        parent: tank.uid,
        attachNode: 'bottom',
        state: { role: 'decoupler', above: idx, below: ordered[n + 1] },
      });
      parent = dec.uid;
    }
  });
  for (const idx of radial) {
    const host = radialHost(stages, idx, radial);
    const hostUid = host == null ? null : tankUid.get(host);
    const hang = hostUid == null ? root.uid : hostUid;
    const node = hostUid == null ? 'bottom' : 'radial';
    if (node === 'radial') {
      const dec = tree.add({
        spec: `${tag}#rdec-${idx}`,
        parent: hang,
        attachNode: 'radial',
        state: { role: 'decoupler', radial: true, below: idx },
      });
      addTank(tree, tag, stages[idx], idx, dec.uid, 'bottom');
    } else addTank(tree, tag, stages[idx], idx, hang, 'bottom');
  }
  return tree;
}

// A physics vehicle blob (legacy.veh) into a part tree. Masses in that blob are already tonnes.
// Returns an empty tree when there is no stage list to read.
export function treeFromLegacyVehicle(veh) {
  const stages = veh && Array.isArray(veh.stages) ? veh.stages : [];
  const tree = new PartTree();
  if (!stages.length) return tree;
  const elec = veh.craft && Number.isFinite(+veh.craft.elec) ? +veh.craft.elec : null;
  const top = stages[stages.length - 1];
  const topParts = Array.isArray(top.parts) ? top.parts : [];
  const pod = topParts.find(p => p && (p.kind === 'pod' || p.kind === 'payload')) || null;
  let parent = null;
  if (pod || elec != null) {
    const root = tree.add({
      spec: (pod && pod.id) || (veh.craft && veh.craft.type) || 'legacy-root',
      state: { role: 'payload', source: 'legacy', dryKg: pod && pod.m ? pod.m * 1000 : 0, ...(elec != null ? { elec } : {}) },
    });
    parent = root.uid;
  }
  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i];
    const fuelT = Number.isFinite(+s.fuel) ? +s.fuel : 0;
    const fuelMaxT = Number.isFinite(+s.fuelMax) ? +s.fuelMax : fuelT;
    const dryT = Number.isFinite(+s.dry) ? +s.dry : 0;
    const tankSpec = (Array.isArray(s.parts) && (s.parts.find(p => p && p.kind === 'tank') || {}).id) || `legacy#s${i}`;
    const tank = tree.add({
      spec: tankSpec,
      ...(parent == null ? {} : { parent, attachNode: 'bottom' }),
      state: {
        role: 'tank', source: 'legacy', index: i, group: i,
        dryKg: dryT * 1000, propKg: fuelT * 1000, fuelMaxKg: fuelMaxT * 1000,
        n: s.n || 0,
        tv: s.eng && s.eng.tv || 0,
        ispSl: s.eng && s.eng.ispSl || 0,
        ispVac: s.eng && s.eng.ispVac || 0,
        gimbal: s.eng && s.eng.gimbal || 0,
        ...(s.radial ? { radial: s.radial } : {}),
      },
    });
    const engPart = Array.isArray(s.parts) ? s.parts.find(p => p && p.kind === 'engine') : null;
    if (engPart || (s.eng && s.eng.tv > 0)) {
      tree.add({
        spec: (engPart && engPart.id) || 'legacy-engine',
        parent: tank.uid,
        attachNode: 'bottom',
        state: { role: 'engine', source: 'legacy', n: s.n || 1 },
      });
    }
    if (i > 0) {
      const dec = tree.add({ spec: `legacy#sep-${i}`, parent: tank.uid, attachNode: 'bottom', state: { role: 'decoupler', source: 'legacy' } });
      parent = dec.uid;
    }
  }
  return tree;
}
