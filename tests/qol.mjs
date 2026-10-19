// Milestone Q (quality of life) tests: settings/keys/units, undo, handle layout, radial boosters, per-body Δv,
// Δv map, quicksave snapshots, impact prediction and nodes on later patches. Run: node tests/qol.mjs
import * as P from '../physics.js?v=f1u';
import * as C from '../physics/patched.js?v=f1u';
import { TEMPLATES, cloneDesign, analyze, validate, designStats, insertPart, setSymmetry, radialGroup } from '../parts.js?v=f1u';
import { Flight, simulateAuto } from '../flight.js?v=f1u';
import { DEFAULTS, bindKey, makeTranslator, resetKeys, fmtDist, fmtSpeed, History, keyOf } from '../settings.js?v=f1u';
import { layoutHandles } from '../maplayout.js?v=f1u';
import { dvMap } from '../physics/dvmap.js?v=f1u';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✔', n, x); } else { fail++; console.log('  ✘', n, x); } };
const T = n => cloneDesign(TEMPLATES.find(t => t.name === n));
const S = () => JSON.parse(JSON.stringify(DEFAULTS));

console.log('1. Key remap and units');
{ const s = S(); let tr = makeTranslator(s);
  ok(tr('KeyW') === 'KeyW' && tr('KeyP') === 'KeyP', 'defaults pass through');
  bindKey(s, 'map', 'KeyP'); tr = makeTranslator(s);
  ok(tr('KeyP') === 'KeyM' && tr('KeyM') === null, 'M remapped to P: P acts as M, M is freed', `${tr('KeyP')} ${tr('KeyM')}`);
  resetKeys(s); tr = makeTranslator(s); ok(tr('KeyM') === 'KeyM', 'reset restores defaults');
  ok(fmtDist(1609.344, 'imperial') === '1 mi' && fmtDist(100, 'imperial') === '328 ft' && fmtDist(1500) === '1.5 km', 'distance units', fmtDist(1609.344, 'imperial'));
  ok(fmtSpeed(100, 'imperial') === '328 ft/s' && fmtSpeed(100) === '100 m/s', 'speed units'); }

console.log('2. Builder undo/redo');
{ const h = new History(); let d = T('Side boosters'); const n0 = d.parts.length;
  h.push(d); d = insertPart(d, 'tank-s', 0); h.push(d); d = insertPart(d, 'tank-s', 0);
  d = h.undo(d); ok(d.parts.length === n0 + 1, 'undo one step'); d = h.undo(d); ok(d.parts.length === n0, 'undo two steps');
  d = h.redo(d); ok(d.parts.length === n0 + 1, 'redo'); d = h.undo(d); ok(d && !h.canUndo && h.canRedo && h.undo(d) === null, 'history empties cleanly'); }

console.log('3. Node handles never overlap');
{ let worst = 1e9;
  for (let i = 0; i < 400; i++) { const dirs = {}; const a = Math.random() * 6.28, b = Math.random() * 0.3, sc = Math.random() * 60;
    const ax = { pro: [Math.cos(a), Math.sin(a) * b], nrm: [-Math.sin(a) * b, Math.cos(a) * Math.random()], rad: [Math.random() - .5, Math.random() - .5] };
    for (const [k, v] of Object.entries(ax)) { dirs[k] = v; dirs[{ pro: 'ret', nrm: 'anti', rad: 'radin' }[k]] = [-v[0], -v[1]]; }
    const L = layoutHandles({ x: 200, y: 200 }, k => ({ x: 200 + dirs[k][0] * sc, y: 200 + dirs[k][1] * sc, z: 0.5 }), 30, 58);
    const v = Object.values(L); for (let p = 0; p < v.length; p++) for (let q = p + 1; q < v.length; q++) worst = Math.min(worst, Math.hypot(v[p].x - v[q].x, v[p].y - v[q].y)); }
  ok(worst >= 30, '400 random (incl. edge-on) views: handles ≥ one handle apart', `min gap ${worst.toFixed(0)} px`); }

console.log('4. Radial boosters');
{ const d = T('Side boosters'), a = analyze(d), v = validate(d);
  ok(!v.errors.length, 'template validates', v.errors.join('; '));
  ok(a.stages[0].radial === 4 && radialGroup(d).idx.length >= 2, 'first stage is 4 radial boosters', `k=${a.stages[0].radial}`);
  const d6 = setSymmetry(d, d.parts.findIndex(p => p.id === 'rdec'), +1); ok(analyze(d6).stages[0].radial === 6, 'symmetry 4 → 6');
  const bad = cloneDesign(d); bad.parts.splice(bad.parts.findIndex(p => p.id === 'rdec') + 1, 0, { id: 'fins' }); ok(validate(bad).errors.length > 0, 'fins on a radial decoupler rejected');
  const st = designStats(d); ok(st.twr > 1.15, 'liftoff TWR > 1.15', st.twr.toFixed(2));
  let sepAlt = null; const r = simulateAuto(d, { each: F => { if (sepAlt === null && F.v.cur > 0) sepAlt = F.alt; } });
  ok(r.orbit && r.pe > P.ORBIT_PE, 'AUTO flies Side boosters to orbit', `Pe ${(r.pe / 1e3).toFixed(0)} km`);
  ok(sepAlt > 5000 && sepAlt < 80000, 'boosters dropped during ascent', `${(sepAlt / 1e3).toFixed(1)} km`); }

console.log('5. Per-body stage Δv/TWR');
{ const d = T('Moon lander'), e = designStats(d), m = designStats(d, { env: { g: 1.62, p: 0 } }), vac = designStats(d, { env: 'vac' });
  const L = e.stages.length - 1;
  ok(m.stages[L].twr > e.stages[L].twr * 5, 'Moon TWR ≈ 6× Earth TWR', `${e.stages[L].twr.toFixed(2)} → ${m.stages[L].twr.toFixed(2)}`);
  ok(vac.stages[0].dv > e.stages[0].dv, 'vacuum Δv beats sea-level Δv for stage 1'); }

console.log('6. Δv map');
{ const rows = dvMap(), by = Object.fromEntries(rows.map(r => [r.id, r]));
  ok(by.moon && by.mars && by.moon.total > 3000 && by.moon.total < 9000, 'Moon total plausible', by.moon.total.toFixed(0));
  ok(by.mars.land > by.moon.land, 'Mars landing costs more than Moon (after aerobraking-free estimate)', `${by.moon.land.toFixed(0)} / ${by.mars.land.toFixed(0)}`);
  ok(rows.every(r => isFinite(r.total) && r.total > 0), 'all rows finite', rows.length + ' bodies'); }

console.log('7. Quicksave snapshot');
{ const F = new Flight(T('Moon lander'), {}, { epoch: Date.UTC(2026, 9, 19) }); F.placeInOrbit(200000, 1);
  const s = JSON.parse(JSON.stringify(F.snapshot())); const G = new Flight(s.design, {}, {}).loadSnapshot(s);
  ok(G.tAbs === F.tAbs && G.body === F.body && G.v.cur === F.v.cur, 'time, body and stage restored');
  ok(Math.abs(P.orbitOf(G.v).pe - P.orbitOf(F.v).pe) < 1, 'orbit restored'); }

console.log('8. Impact prediction');
{ const H = new Flight(T('Orbit & home'), {}, {}); H.placeState({ h: 120000, vUp: -100, vEast: 6000, stage: H.v.stages.length - 1, att: 'retrograde', sas: 'retrograde' });
  const t0 = performance.now(), imp = H.predictImpact(), ms = performance.now() - t0;
  ok(imp && imp.dt > 60 && imp.dt < 2000 && isFinite(imp.lat), 'suborbital craft gets an impact point', imp && `${imp.dt.toFixed(0)} s`);
  ok(ms < 200, 'fast enough for the HUD', ms.toFixed(0) + ' ms');
  const O = new Flight(T('Orbit & home'), {}, {}); O.placeInOrbit(300000, O.v.stages.length - 1); ok(!O.predictImpact(), 'stable orbit: no impact'); }

console.log('9. Node on a later patch (capture burn at the Moon)');
{ const F = new Flight(T('Moon lander'), {}, { epoch: Date.UTC(2026, 9, 19) }); F.placeInOrbit(200000, 1);
  const pl = C.planFull('earth', F.v.r, F.v.v, F.tAbs, 'moon', { minWait: 600 }); F.target = 'moon'; F.applyNodeNow(F.addNode(pl.tuned));
  const mp = C.predict('earth', F.v.r, F.v.v, F.tAbs, { maxPatches: 3 }).patches.find(p => p.body === 'moon');
  ok(!!mp, 'trajectory reaches the Moon');
  const n = F.addNode({ t: mp.t0 + C.timeToPe(mp.r0, mp.v0, P.BODIES.moon.mu), pro: -300 }); F.updateNode(F.nodes.indexOf(n), 1);
  ok(n.later, 'node flagged as on a later patch');
  const pr = C.predict('earth', F.v.r, F.v.v, F.tAbs, { maxPatches: 4, nodes: F.nodes }), m2 = pr.patches.filter(p => p.body === 'moon').pop();
  ok(m2 && m2.o.e < 1, 'prediction shows capture', m2 && `e=${m2.o.e.toFixed(2)}`);
  F.warpToNode(); for (let i = 0; i < 3000 && F.warpTarget; i++) F.advance(1 / 30);
  ok(F.body === 'moon' && Math.abs(n.t - F.tAbs) < 600, 'warp-to-node crosses the SOI and stops before the burn', `${F.body}, ${(n.t - F.tAbs).toFixed(0)} s`); }

console.log(`qol: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
