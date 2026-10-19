// Milestone A, flown in the real Flight (6-DOF burns, event-bounded rails, in-flight SOI switching):
// Earth→Moon transfer, capture and landing with the Moon lander; Earth→Mars to the Mars SOI with the Mars
// explorer; prediction vs the flown trajectory; warp-to and node execution; per-body goals and score.
import * as P from '../physics.js?v=gx1h2';
import * as C from '../physics/patched.js?v=gx1h2';
import { Flight, WARPS, launchAzimuth } from '../flight.js?v=gx1h2';
import { TEMPLATES } from '../parts.js?v=gx1h2';
const V = P.V; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const tpl = n => TEMPLATES.find(t => t.name === n), T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), DT = 1 / 30;
const run = (F, until, maxFrames = 2e5, each) => { for (let i = 0; i < maxFrames; i++) { if (until()) return true; if (each) each(i); F.advance(DT); if (F.flags.dead) return false; } return until(); };
const fly = (F, n) => { F.setExec(true); const k0 = F.nodes.length; return run(F, () => F.nodes.length < k0 || !F.exec, 4e5, () => { if (F.v.thrust > 0) F.setWarp(4, true); }); };
ok(WARPS[WARPS.length - 1] === 1e7, 'warp goes to ×10,000,000');
// ---------- Moon ----------
{
  const F = new Flight(tpl('Moon lander'), {}, { t0: T0 }); F.placeInOrbit(200000, 1); const v = F.v;
  ok(F.deep && F.body === 'earth', 'deep-space design keeps flying after orbit');
  const pl = C.planFull('earth', v.r, v.v, F.tAbs, 'moon', { minWait: 1200, burn: F.burnModel() }); ok(pl && pl.reaches, 'planner: tuned TLI reaches the Moon SOI');
  ok(pl.incl > 15 && pl.incl < 30, 'planner suggests the Moon-plane inclination ' + pl.incl.toFixed(1) + '°');
  const n = F.addNode(pl.tuned); ok(F.nodes.length === 1 && Math.abs(F.nodeRemaining().length - 3) < 1, 'node added');
  ok(Math.abs(V.len(F.nodeRemaining()) - C.nodeDv(n)) < 1e-6, 'node Δv vector magnitude');
  // warp to node (rails stop at the node lead), then the burn
  const t0 = F.tAbs; ok(F.warpToNode(), 'warp to node starts');
  run(F, () => !F.warpTarget, 5000); const lead = n.t - F.tAbs;
  ok(lead > 0 && lead < F.nodeBurnTime(n) / 2 + 95, `warp stopped before the burn (${lead.toFixed(0)} s before the node, burn ${F.nodeBurnTime(n).toFixed(0)} s)`);
  ok(F.tAbs > t0, 'time advanced');
  ok(fly(F), 'TLI executed'); ok(!F.nodes.length, 'node consumed');
  let pr = C.predict('earth', v.r, v.v, F.tAbs, { maxPatches: 3 }), mp = pr.patches.find(p => p.body === 'moon');
  // mid-course correction (finite-burn error), planned with the same tools the map uses
  if (!mp || mp.o.rp - P.BODIES.moon.R < 40000 || mp.o.rp - P.BODIES.moon.R > 250000) {
    const rf = C.correctionNode('earth', v.r, v.v, F.tAbs, 'moon', { peAlt: 100000 });
    F.addNode(rf.node); ok(C.nodeDv(rf.node) < 80, 'mid-course correction ' + C.nodeDv(rf.node).toFixed(1) + ' m/s'); F.warpToNode(true); run(F, () => !F.warpTarget, 5000); fly(F);
    pr = C.predict('earth', v.r, v.v, F.tAbs, { maxPatches: 3 }); mp = pr.patches.find(p => p.body === 'moon');
  }
  ok(!!mp, 'trajectory reaches the Moon after the burn');
  const predIn = mp && mp.t0; ok(F.warpToSOI(), 'warp to SOI change');
  run(F, () => F.body === 'moon', 20000);
  ok(F.body === 'moon', 'in-flight SOI switch to the Moon'); ok(Math.abs(F.tAbs - predIn) < 120, `SOI entry ${((F.tAbs - predIn)).toFixed(1)} s from prediction`);
  ok(F.goals.moon && F.goals.moon.flyby, 'Moon flyby goal'); ok(F.effWarp() === 1, 'warp dropped at the SOI change');
  ok(V.len(v.r) < P.BODIES.moon.soi * 1.001 && V.len(v.r) > P.BODIES.moon.soi * 0.98, 'state continuous at the SOI boundary (in the Moon frame)');
  // capture at periapsis: circularize
  const tp = C.timeToPe(v.r, v.v, P.BODIES.moon.mu), sp = P.propagate(v.r, v.v, tp, P.BODIES.moon.mu), peA = V.len(sp.r) - P.BODIES.moon.R;
  ok(peA > 20000 && peA < 300000, 'Moon periapsis ' + (peA / 1000).toFixed(0) + ' km');
  const muM = P.BODIES.moon.mu, rp = V.len(sp.r), ra = P.BODIES.moon.R + 1500000;
  F.addNode({ t: F.tAbs + tp, pro: Math.sqrt(muM * (2 / rp - 2 / (rp + ra))) - V.len(sp.v) }); F.warpToNode(true); run(F, () => !F.warpTarget, 20000); fly(F);
  const om = P.orbitOf(v); ok(om.e < 0.6 && om.pe > 5000, `captured: lunar orbit ${(om.pe / 1000).toFixed(0)} × ${(om.ap / 1000).toFixed(0)} km`);
  ok(F.goals.moon.orbit, 'Moon orbit goal');
  // stage to the lander, brake from orbit (retrograde, surface-relative low down), then a throttled descent
  if (v.cur < F.lastPow) { F.stageArm = -1; F.realT = 100; F.stage(); }
  v.sas = 'retrograde'; v.sasHold = null; run(F, () => Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.scale(P.progradeOf(v), -1))))) < 0.05, 3000);
  const g = P.BODIES.moon.mu / P.BODIES.moon.R ** 2;
  const landed = run(F, () => F.flags.landed || F.flags.dead, 3e5, () => {
    const h = F.alt - v.tel.ycom, up = V.norm(v.r), va = P.airVel(v), vs = V.dot(va, up), vh = V.len(V.sub(va, V.scale(up, vs))), a = P.thrustAccel(v);
    v.sas = 'retrograde'; F.setWarp(h > 8000 && vh > 300 ? 3 : h > 3000 ? 2 : 0, true);
    if (vh > 40) v.ut = 1; // kill the horizontal speed (retrograde, surface-relative low down)
    else { const sp2 = V.len(va), k = a > 0 ? (sp2 * sp2 / (2 * Math.max(h - 25, 1)) + g) / a : 0; // suicide burn with hysteresis
      if (h < 60) v.ut = a > 0 ? Math.max(0, Math.min(1, (g + (Math.max(0, -vs) - 2) * 1.5) / a)) : 0;
      else { if (k > 0.9) v._sb = true; v.ut = v._sb ? Math.min(1, k) : 0; } }
  });
  ok(landed && F.flags.landed, 'landed on the Moon' + (F.flags.dead ? ': ' + F.flags.dead : '') + ` (touchdown ${F.flags.touchdown && F.flags.touchdown.toFixed(1)} m/s)`);
  ok(F.goals.moon.landed, 'Moon landing goal'); ok(F.score() >= 1500 + 3000 + 6000, 'score includes Moon goals: ' + F.score());
  ok(F.parked && F.body === 'moon', 'parked on the Moon surface');
}
// ---------- Mars ----------
{
  const F = new Flight(tpl('Mars explorer'), {}, { t0: T0 }); F.placeInOrbit(200000, 2); const v = F.v;
  const pl = C.planFull('earth', v.r, v.v, F.tAbs, 'mars', { burn: F.burnModel() }); ok(pl && pl.reaches, 'planner: tuned TMI reaches the Mars SOI');
  ok(pl.wait / 86400 > 20 && pl.wait / 86400 < 90, 'Mars window wait ' + (pl.wait / 86400).toFixed(0) + ' d');
  ok(pl.exactDv > pl.tunedDv, `tuned burn (${pl.tunedDv.toFixed(0)} m/s) is cheaper than the exact one from this plane (${pl.exactDv.toFixed(0)} m/s)`);
  ok(pl.incl > 10 && pl.incl < 40, 'suggested parking inclination ' + pl.incl.toFixed(1) + '°');
  F.addNode(pl.tuned); F.warpToNode(true); run(F, () => !F.warpTarget, 20000); ok(fly(F), 'TMI executed');
  let pr = C.predict('earth', v.r, v.v, F.tAbs, { maxPatches: 4 }), ca = C.closestApproach(pr, 'mars');
  if (!ca.inside) { // correction while still near Earth (finite-burn error is cheapest to fix early)
    const cn = C.correctionNode('earth', v.r, v.v, F.tAbs, 'mars', { peAlt: 300000, tol: 3e6, starts: [3600, 6 * 3600, 86400], scaleV: 3, byT: F.tAbs + pl.hohmann.tt * 1.25 });
    ok(cn.good && cn.dv < 150, 'Mars correction ' + cn.dv.toFixed(1) + ' m/s'); F.addNode(cn.node); F.warpToNode(true); run(F, () => !F.warpTarget, 20000); fly(F);
  }
  run(F, () => F.body === 'sun', 20000, () => { if (!F.warpTarget) F.warpToSOI(); });
  ok(F.body === 'sun', 'left Earth SOI into heliocentric orbit');
  pr = C.predict('sun', v.r, v.v, F.tAbs, { maxPatches: 3 }); ca = C.closestApproach(pr, 'mars');
  if (!ca.inside) { const cn = C.correctionNode('sun', v.r, v.v, F.tAbs, 'mars', { peAlt: 300000, tol: 3e6, starts: [5 * 86400, 30 * 86400], scaleV: 2, byT: T0 + pl.wait + pl.hohmann.tt * 1.25 });
    ok(cn.dv < 60, 'heliocentric correction ' + cn.dv.toFixed(1) + ' m/s'); F.addNode(cn.node); F.warpToNode(true); run(F, () => !F.warpTarget, 20000); fly(F);
    pr = C.predict('sun', v.r, v.v, F.tAbs, { maxPatches: 3 }); }
  const mp = pr.patches.find(p => p.body === 'mars'); ok(!!mp, 'predicted Mars encounter');
  const tw0 = performance.now(); run(F, () => F.body === 'mars', 20000, () => { if (!F.warpTarget) F.warpToSOI(); });
  ok(F.body === 'mars', 'arrived in the Mars SOI'); ok(mp && Math.abs(F.tAbs - mp.t0) < 3 * 3600, `Mars SOI entry ${mp ? ((F.tAbs - mp.t0) / 3600).toFixed(2) : '?'} h from prediction`);
  ok(performance.now() - tw0 < 60000, 'cruise warp is fast (event-bounded rails)');
  ok(F.goals.mars && F.goals.mars.flyby, 'Mars flyby goal'); ok(F.score() > 2.5 * 1500, 'score includes Mars flyby');
  const days = (F.tAbs - T0) / 86400; ok(days > 200 && days < 400, 'arrival ' + days.toFixed(0) + ' days after the epoch');
}
// ---------- launch azimuth ----------
for (const inc of [0, 28.5, 51.6]) { const A = launchAzimuth(inc) * 180 / Math.PI; ok(inc === 0 ? Math.abs(A - 90) < 0.5 : A > 0 && A < 90, `launch azimuth for ${inc}°: ${A.toFixed(1)}°`); }
console.log(`mission: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
