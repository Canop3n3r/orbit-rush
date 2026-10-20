// f5.2.3 payload lifecycle: fly the Heron-9 stack (swift base) to LEO by hand (AUTO off, STAGE presses), RELEASE the
// payload (button or last STAGE press), it becomes a saved world object on rails; the spent stage burns retrograde,
// de-orbits and that ends the flight as planned (not a failure). The world list survives a reload and propagates.
import { Flight } from '../flight.js?v=f5.3b3';
import * as P from '../physics.js?v=f5.3b3';
import * as W from '../fun/world.js?v=f5.3b3';
import * as L from '../fun/ladder.js?v=f5.3b3';
import { SHOWROOM } from '../fun/showroom.js?v=f5.3b3';
import { cloneDesign } from '../parts.js?v=f5.3b3';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };
const mem = new Map(), store = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15)), norm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
const press = F => { const a = F.stagePress(); if (a === 'armed') { F.realT = (F.realT || 0) + 0.1; return F.stagePress(); } return a; };
const d = cloneDesign(SHOWROOM.find(s => s.id === 'swift').design); d.name = 'Heron-9'; d.model = 'heron-9';
let rel = null, deorb = null; const F = new Flight(d, { release: r => { rel = r; }, deorbited: r => { deorb = r; } }, { t0: T0 }); F.setAuto(false, true); const v = F.v;
press(F); let i = 0;
for (; i < 30 * 1500 && !F.flags.dead; i++) { const up = norm(v.r), o = P.orbitOf(v);
  const gd = P.autoGuide(v); v.input = { pitch: 0, yaw: 0, roll: 0 }; v.sas = 'stab'; v.sasHold = F.alt < 300 ? up : gd.dir; v.ut = gd.throttle;
  if (gd.phase === 'done' || o.pe > 160000) { v.ut = 0; break; }
  if (v.stages[v.cur].fuel <= 0 && v.cur < F.last && F.canStage()) press(F);
  F.advance(1 / 30); }
const o = P.orbitOf(v); ok(!F.flags.dead && o.pe > 140000, 'Heron-9 reaches LEO by hand', `Ap ${(o.ap / 1e3).toFixed(0)} / Pe ${(o.pe / 1e3).toFixed(0)} km, stage ${v.cur}/${F.last}`);
ok(F.canRelease(), 'RELEASE is offered on the final stage in orbit');
const m0 = P.massOf(v), r1 = press(F); ok(r1 === 'release' && rel, 'the last STAGE press releases the payload', r1);
ok(P.massOf(v) < m0 - 0.1, 'the stage is lighter by the payload', `${m0.toFixed(2)} → ${P.massOf(v).toFixed(2)} t`);
ok(!F.canRelease() && F.stagePress() === 'none', 'nothing left to release');
const sat = W.add(store, { ...rel, name: 'Heron-9 payload', group: 'constellation' }); ok(!!sat, 'payload saved to the world list', sat && `Pe ${(W.orbit(sat).pe / 1e3).toFixed(0)} km`);
// de-orbit: hold retrograde, burn until Pe < 50 km, then coast in
v.sas = 'retrograde'; let burnt = 0; for (let k = 0; k < 30 * 600 && P.orbitOf(v).pe > 40000; k++) { v.ut = k > 30 * 20 ? 1 : 0; F.advance(1 / 30); burnt++; }
ok(P.orbitOf(v).pe < 50000, 'retrograde burn lowers the stage Pe into the air', `Pe ${(P.orbitOf(v).pe / 1e3).toFixed(0)} km`);
v.ut = 0; for (let k = 0; k < 30 * 4000 && !F.flags.deorbited && !F.flags.dead; k++) { if (F.alt > 140000) F.setWarp ? F.advance(1) : F.advance(1 / 30); else F.advance(1 / 30); }
ok(!!F.flags.deorbited && !F.flags.dead && deorb, 'the spent stage de-orbits and that is not a failure', F.flags.deorbited || F.flags.dead || `alt ${(F.alt / 1e3).toFixed(0)} km`);
// reload: a fresh load still has the sat, and it propagates on rails
const S2 = W.load(store); ok(W.count(S2) === 1 && W.count(S2, 'constellation') === 1, 'reload keeps the deployed sat (constellation 1)');
const s1 = W.stateAt(S2.objs[0], S2.objs[0].t + 86400), alt = Math.hypot(...s1.r) - 6378137; ok(alt > 140000 && alt < 2000000, 'a day later it is still in orbit', `${(alt / 1e3).toFixed(0)} km`);
ok(W.add(store, { r: [6378137 + 80000, 0, 0], v: [0, 7800, 0], t: 0 }) === null, 'a decaying object (Pe < 120 km) is not saved');
// career: a delivered payload pays, recovery refunds
const C = L.blank(), out = L.record(C, { delivered: { cash: 15 }, recovered: true }); ok(C.cash >= 15 && C.sats === 1, 'career pays for a delivered payload and counts it', `cash ${C.cash}, sats ${C.sats}`);
console.log(`payload: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
