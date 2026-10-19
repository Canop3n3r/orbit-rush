// Milestone A: solar system ephemeris, patched conics, transfer planner, prediction vs. stepped simulation.
import * as P from '../physics.js?v=gx1';
import * as C from '../physics/patched.js?v=gx1';
const V = P.V, B = P.BODIES; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const T = (y, mo, d) => P.tFromDate(Date.UTC(y, mo - 1, d)), AU = P.AU, lon = r => Math.atan2(r[1], r[0]) * 180 / Math.PI;
const dl = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
// --- positions vs reference values ---
ok(Math.abs(V.len(P.absState('earth', T(2026, 1, 3)).r) / AU - 0.98329) / 0.98329 < 0.01, 'Earth perihelion distance 2026-01-03');
ok(Math.abs(V.len(P.absState('earth', T(2026, 7, 6)).r) / AU - 1.01664) / 1.01664 < 0.01, 'Earth aphelion distance 2026-07-06');
for (const [id, y, m, d] of [['mars', 2027, 2, 19], ['jupiter', 2026, 1, 10], ['saturn', 2026, 10, 4], ['uranus', 2025, 11, 21], ['neptune', 2026, 9, 25]]) {
  const t = T(y, m, d); ok(dl(lon(P.absState(id, t).r), lon(P.absState('earth', t).r)) < 1.5, `${id} opposition ${y}-${m}-${d}: Δlon ${dl(lon(P.absState(id, t).r), lon(P.absState('earth', t).r)).toFixed(2)}°`);
}
for (const [id, a, per] of [['mercury', 0.387, 87.97], ['venus', 0.723, 224.7], ['earth', 1, 365.256], ['mars', 1.524, 686.98], ['jupiter', 5.203, 4332.6], ['saturn', 9.537, 10759], ['uranus', 19.19, 30689], ['neptune', 30.07, 60190]]) {
  ok(Math.abs(B[id].a / AU - a) / a < 0.02, id + ' semi-major axis'); ok(Math.abs(B[id].period / 86400 - per) / per < 0.02, id + ' period');
}
const md = V.len(P.relState('moon', T(2026, 10, 19)).r) / 1000; ok(md > 356000 && md < 407000, 'Moon distance ' + md.toFixed(0));
for (const [id, R] of [['mars', 3389.5], ['jupiter', 71492], ['titan', 2574.7], ['moon', 1737.4]]) ok(Math.abs(B[id].R / 1000 - R) / R < 0.01, id + ' radius');
for (const [id, s] of [['moon', 66100], ['earth', 924600], ['mars', 577000], ['jupiter', 48.2e6]]) ok(Math.abs(B[id].soi / 1000 - s) / s < 0.03, id + ' SOI ' + (B[id].soi / 1000).toFixed(0));
// --- SOI patch continuity: state continuous through frame transfers (both directions), at every body ---
for (const id of Object.keys(B)) {
  if (!B[id].parent) continue; const t = T(2026, 10, 19) + 12345, r = [B[id].soi * 0.999, 1e3, 2e3], v = [10, 200, -30];
  const up = P.toParent(id, r, v, t), dn = P.toChild(id, up.r, up.v, t);
  ok(V.len(V.sub(dn.r, r)) < 1e-3 * B[id].soi * 1e-6 + 1 && V.len(V.sub(dn.v, v)) < 1e-6, id + ' toParent/toChild round trip');
  const sun = P.transfer(id, 'sun', r, v, t), back = P.transfer('sun', id, sun.r, sun.v, t); ok(V.len(V.sub(back.r, r)) < 50 && V.len(V.sub(back.v, v)) < 1e-4, id + ' via-Sun round trip');
  ok(P.soiOf(id, [B[id].soi * 1.001, 0, 0], t) === B[id].parent, id + ' soiOf exit');
}
// --- scripted Earth→Moon: plan, refine, capture, land ---
const t0 = T(2026, 10, 19), muE = B.earth.mu, r0 = B.earth.R + 200000, R0 = [r0, 0, 0], V0 = [0, Math.sqrt(muE / r0), 0];
const pl = C.planTransfer('earth', R0, V0, t0, 'moon'), rf = C.refineNode('earth', R0, V0, t0, pl.node, 'moon', { peAlt: 100000, good: 2000 });
let pr = C.predict('earth', R0, V0, t0, { nodes: [rf.node] }); const mp = pr.patches.find(p => p.body === 'moon');
ok(C.nodeDv(rf.node) > 3000 && C.nodeDv(rf.node) < 3300, 'TLI dv ' + C.nodeDv(rf.node).toFixed(0));
ok(mp && mp.o.rp - B.moon.R > 30000 && mp.o.rp - B.moon.R < 300000, 'Moon periapsis alt ' + (mp ? ((mp.o.rp - B.moon.R) / 1e3).toFixed(1) : '-'));
if (mp) {
  const muM = B.moon.mu;
  // coast to periapsis inside the Moon SOI, burn retrograde to a circular orbit
  let tPe = 0; { let best = Infinity; for (let k = 0; k <= 4000; k++) { const s = P.propagate(mp.r0, mp.v0, k * 60, muM), d = V.len(s.r); if (d < best) { best = d; tPe = k * 60; } } }
  const sPe = P.propagate(mp.r0, mp.v0, tPe, muM), vcM = Math.sqrt(muM / V.len(sPe.r)), cap = { t: mp.t0 + tPe, pro: vcM - V.len(sPe.v), nrm: 0, rad: 0 };
  ok(cap.pro < -700 && cap.pro > -1000, 'capture burn ' + cap.pro.toFixed(0));
  const pc = C.predict('moon', sPe.r, sPe.v, cap.t, { nodes: [cap] }), orb = pc.patches[pc.patches.length - 1];
  ok(orb.body === 'moon' && orb.o.e < 0.02 && orb.end.type !== 'soi-exit', 'captured in lunar orbit, e=' + orb.o.e.toFixed(4));
  const vAfter = V.add(sPe.v, C.nodeVector(sPe.r, sPe.v, cap)), deo = { t: cap.t + 600, pro: -60, nrm: 0, rad: 0 };
  const pd = C.predict('moon', sPe.r, vAfter, cap.t, { nodes: [deo] }); ok(pd.end.type === 'surface', 'deorbit reaches the lunar surface: ' + pd.end.type);
}
// --- scripted Earth→Mars: reaches the Mars SOI ---
const pm = C.planTransfer('earth', R0, V0, t0, 'mars'); ok(pm.wait / 86400 > 20 && pm.wait / 86400 < 90, 'Mars window in ' + (pm.wait / 86400).toFixed(0) + ' d');
const rm = C.refineNode('earth', R0, V0, t0, pm.node, 'mars', { peAlt: 300000, scaleT: 900, scaleV: 30, iters: 250 });
pr = C.predict('earth', R0, V0, t0, { nodes: [rm.node] }); const marsP = pr.patches.find(p => p.body === 'mars');
ok(!!marsP, 'trajectory enters the Mars SOI: ' + pr.patches.map(p => p.body + ':' + p.end.type).join(' → '));
ok(C.nodeDv(rm.node) < 4500, 'TMI dv ' + C.nodeDv(rm.node).toFixed(0));
const ip = C.planInterplanetary('earth', R0, V0, t0, 'mars', pm); ok(ip && ip.vinf > 2500 && ip.vinf < 4000, 'Lambert v∞ ' + (ip && ip.vinf.toFixed(0)));
ok(Math.abs(V.len(P.propagate(P.relState('earth', ip.td).r, C.lambert(P.relState('earth', ip.td).r, P.relState('mars', ip.td + ip.tf).r, ip.tf, B.sun.mu).v1, ip.tf, B.sun.mu).r.map((x, i) => x - P.relState('mars', ip.td + ip.tf).r[i]))) < 1e5, 'Lambert hits Mars');
// --- prediction vs stepped simulation (what flight does: Kepler steps + soiOf + transfer each step) ---
if (marsP) {
  let body = 'earth', r = [...R0], v = [...V0], t = t0, burned = false, entered = null; const dt = 600;
  for (let k = 0; k < 2e5 && !entered; k++) {
    let h = dt; if (!burned && t + h >= rm.node.t) h = rm.node.t - t;
    const s = P.propagate(r, v, h, B[body].mu); r = s.r; v = s.v; t += h;
    if (!burned && Math.abs(t - rm.node.t) < 1e-6) { v = V.add(v, C.nodeVector(r, v, rm.node)); burned = true; }
    const nb = P.soiOf(body, r, t); if (nb !== body) { const tr = P.transfer(body, nb, r, v, t); body = nb; r = tr.r; v = tr.v; if (body === 'mars') entered = t; }
    if (body === 'sun') { const s2 = P.propagate(r, v, 3 * 3600, B.sun.mu); const nb2 = P.soiOf('sun', s2.r, t + 3 * 3600); if (nb2 === 'sun') { r = s2.r; v = s2.v; t += 3 * 3600; } }
  }
  ok(entered && Math.abs(entered - marsP.t0) < 6 * 3600, 'stepped sim enters Mars SOI within 6 h of prediction: Δ ' + (entered ? ((entered - marsP.t0) / 3600).toFixed(2) + ' h' : 'never'));
  const ex = pr.patches[0].t1, s1 = C.predict('earth', R0, V0, t0, { nodes: [rm.node] }).patches[1];
  ok(Math.abs(s1.t0 - ex) < 1e-6, 'patch times contiguous');
}
console.log(`solar: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
