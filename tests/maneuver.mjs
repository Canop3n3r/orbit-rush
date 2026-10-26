// f6.5 maneuver tool: planned nodes never block the engines; manual and AUTO burns both work.
// Run: node tests/maneuver.mjs
import * as P from '../physics.js?v=f5.9-7';
import * as C from '../physics/patched.js?v=f5.9-7';
import { Flight } from '../flight.js?v=f5.9-7';
import { TEMPLATES } from '../parts.js?v=f5.9-7';
const V = P.V; let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), DT = 1 / 30, tpl = n => TEMPLATES.find(t => t.name === n);
const run = (F, until, maxFrames = 2e5, each) => { for (let i = 0; i < maxFrames; i++) { if (until()) return true; if (each) each(i); F.advance(DT); if (F.flags.dead) return false; } return until(); };
const noseErr = F => { const v = F.v; return v.nodeDir ? Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), v.nodeDir)))) : 9; };

console.log('1. a real AUTO ascent, then plan a node: the engines answer the pilot');
{
  const F = new Flight(tpl('Recommended'), {}, { t0: T0 }), v = F.v; F.setAuto(true, true); F.stagePress();
  run(F, () => F.flags.orbit && F.flags.cutoff, 30 * 1500);
  ok(F.flags.orbit && F.autoOn && v.guid === 'done', 'AUTO reached orbit and is still on (cut off)');
  const n = F.addNode({ t: F.tAbs + 900, pro: 150 }); const ap0 = P.orbitOf(v).ap;
  v.ut = 1; run(F, () => false, 60);
  ok(v.thrust > 0 && v.throttle > 0, `Z with a node planned and AUTO on: thrust ${v.thrust.toFixed(0)} kN (was zero: AUTO zeroed the throttle every step)`);
  ok(!F.autoOn, 'AUTO stepped aside for the manual burn');
  ok(P.orbitOf(v).ap > ap0 + 50, 'the burn raised the orbit'); void n;
}

console.log('2. throttle is never blocked by a node, in every stage');
{
  const F = new Flight(tpl('Three-stager'), {}, { t0: T0 }), v = F.v; F.placeInOrbit(200000, 2);
  for (const withNode of [false, true]) {
    if (withNode) F.addNode({ t: F.tAbs + 1800, pro: 100 });
    v.ut = 1; run(F, () => false, 30); ok(v.thrust > 0, `stage ${v.cur}: thrust with${withNode ? '' : 'out'} a node (${v.thrust.toFixed(0)} kN)`);
    v.ut = 0; run(F, () => false, 30); ok(v.thrust === 0, 'X cuts the engine');
  }
}

console.log('3. manual burn: the node Δv counts down and the node completes');
{
  const F = new Flight(tpl('Mars explorer'), {}, { t0: T0 }), v = F.v; F.placeInOrbit(200000, 2);
  const n = F.addNode({ t: F.tAbs + 1200, pro: 400 }), dv0 = V.len(F.nodeRemaining(n));
  ok(Math.abs(dv0 - 400) < 1, 'remaining Δv shows the planned 400 m/s'); ok(F.nodeBurnTime(n) > 5, 'burn time is shown (' + F.nodeBurnTime(n).toFixed(0) + ' s)');
  F.setSAS('node'); ok(v.sas === 'node', 'SAS MANEUVER selected');
  F.warpToNode(true); run(F, () => !F.warpTarget, 20000);
  ok(F.tAbs > n.t - F.nodeBurnTime(n) / 2 - 200 && F.tAbs < n.t, 'warp stops shortly before the burn start');
  run(F, () => noseErr(F) < 0.05, 30 * 120); ok(noseErr(F) < 0.1, 'SAS MANEUVER points the nose at the node (' + (noseErr(F) * 57.3).toFixed(1) + '°)');
  run(F, () => F.tAbs >= n.t - F.nodeBurnTime(n) / 2, 30 * 400);
  v.ut = 1; let half = null; const ap0 = P.orbitOf(v).ap;
  run(F, () => !F.nodes.length, 30 * 400, () => { if (half === null && F.nodes[0] && V.len(F.nodeRemaining(F.nodes[0])) < 200) half = V.len(F.nodeRemaining(F.nodes[0])); if (F.nodes[0] && F.nodes[0].started && V.len(F.nodeRemaining(F.nodes[0])) < 3) v.ut = 0.05; });
  ok(half !== null && half < 200, 'remaining Δv counted down while burning by hand (' + (half && half.toFixed(0)) + ' m/s left at the check)');
  ok(!F.nodes.length, 'node completes and is removed when the Δv is spent'); v.ut = 0;
  const o = P.orbitOf(v); ok(o.ap > ap0 + 800000 * 0 + 300000, 'Ap raised by the burn: ' + (o.ap / 1000).toFixed(0) + ' km');
}

console.log('4. two nodes chain');
{
  const F = new Flight(tpl('Mars explorer'), {}, { t0: T0 }), v = F.v; F.placeInOrbit(200000, 2);
  const a = F.addNode({ t: F.tAbs + 900, pro: 200 }), tp = C.timeToPe(v.r, v.v, P.muOf(v));
  const b = F.addNode({ t: F.tAbs + 6000, pro: -50 });
  ok(F.nodes.length === 2 && F.nodes[0] === a, 'two nodes, sorted');
  const fly = () => { F.setExec(true); const k = F.nodes.length; return run(F, () => F.nodes.length < k || !F.exec, 4e5, () => { if (v.thrust > 0) F.setWarp(3, true); }); };
  ok(fly() && F.nodes.length === 1 && F.nodes[0] === b, 'AUTO flew node 1, node 2 is next');
  ok(fly() && F.nodes.length === 0, 'AUTO flew node 2'); void tp;
}

console.log('5. AUTO execute hits the target orbit');
{
  const F = new Flight(tpl('Mars explorer'), {}, { t0: T0 }), v = F.v; F.placeInOrbit(200000, 2); const o0 = P.orbitOf(v), mu = P.muOf(v);
  const t = F.tAbs + 1500, s = P.propagate(v.r, v.v, 1500, mu), r = V.len(s.r), vc = V.len(s.v), target = o0.ap + 600000;
  const dv = Math.sqrt(mu * (2 / r - 1 / ((r + (P.BODIES.earth.R + target)) / 2))) - vc; // raise the apoapsis by 600 km
  F.addNode({ t, pro: dv }); F.setExec(true);
  const done = run(F, () => !F.nodes.length, 4e5, () => { if (v.thrust > 0) F.setWarp(3, true); });
  const o = P.orbitOf(v); ok(done, 'maneuver executed'); ok(Math.abs(o.ap - target) < 20000, `Ap ${(o.ap / 1000).toFixed(0)} km vs ${(target / 1000).toFixed(0)} km target`);
}

console.log('6. the pilot overrides AUTO maneuver at any time');
{
  const F = new Flight(tpl('Mars explorer'), {}, { t0: T0 }), v = F.v; F.placeInOrbit(200000, 2);
  F.addNode({ t: F.tAbs + 3000, pro: 300 }); F.setExec(true); run(F, () => false, 10); ok(F.exec && v.thrust === 0, 'AUTO maneuver armed, waiting for the burn');
  F.setWarp(0, true); F.warpTarget = null; v.ut = 1; run(F, () => false, 10);
  ok(!F.exec && v.thrust > 0, 'Z during AUTO maneuver: AUTO steps aside, the engine fires'); v.ut = 0;
}
console.log(`maneuver: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
