// f5.9-25 / f5.9-31: AUTO picks RTLS when boostback fits the fuel at this downrange and speed, else an ocean barge.
// A setting forces either, and setRecovery('auto'|'rtls'|'ship') switches mid-flight (auto re-reads the three).
import { Flight, recoveryPlan } from '../flight.js';
import * as P from '../physics.js';
import { SHOWROOM } from '../fun/showroom.js';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
// Same fuel and altitude; only downrange, horizontal speed, or fuel changes.
const sample = (fuel, speed, down) => { const h = 70000, a = down / P.R, c = Math.cos(a), s = Math.sin(a);
  return recoveryPlan({ stages: [{ dry: 22, fuel, eng: { ispVac: 311 } }], r: [(P.R + h) * c, (P.R + h) * s, 0], v: [-s * speed, c * speed, 0], clock: 0 }, [1, 0, 0], false); };
const sep = (id, pref) => { const F = new Flight(JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === id).design)), {}, { recoveryPref: pref }); F.stagePress(); F.setAuto(true, true);
  for (let i = 0; i < 200000 && !F.flags.dead && !(F.booster && F.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } return F; };
{ const F = sep('swift', 'auto'), p = F.booster.recPlan; ok(p.mode === 'rtls' && F.booster.rtls && F.ship.lz, `swift AUTO -> RTLS (${p.why})`); }
{ const F = sep('heron', 'auto'), p = F.booster.recPlan; ok(p.mode === 'ship' && !F.booster.rtls && F.ship && !F.ship.lz, `heron AUTO -> barge (${p.why})`);
  ok(p.down >= 0 && p.speed >= 0 && p.fuel > 0, `plan carries downrange ${p.down} m, speed ${p.speed} m/s, fuel ${p.fuel} t`);
  ok(F.setRecovery('rtls') && F.booster.rtls && F.ship.lz && p.mode === 'rtls' && p.pref === 'rtls', 'heron override -> RTLS mid-flight');
  ok(F.setRecovery('ship') && !F.booster.rtls && !F.ship.lz && p.mode === 'ship', 'heron override back -> barge');
  ok(F.setRecovery('auto') && p.pref === 'auto' && p.mode === p.auto, `AUTO re-picks ${p.mode} from downrange, speed and fuel`); }
{ const F = sep('swift', 'ship'); ok(!F.booster.rtls && F.booster.recPlan.pref === 'ship', 'setting forces the barge'); }
{ const F = sep('heron', 'design'); ok(F.booster.recPlan.mode === 'ship', 'no setting keeps the rocket default'); }
{ const near = sample(40, 250, 8000), far = sample(40, 250, 500000), fast = sample(40, 2200, 8000), dry = sample(3, 250, 8000);
  ok(near.mode === 'rtls', `close, slow, fueled -> RTLS (${near.why})`);
  ok(far.mode === 'ship' && far.down > near.down, `same fuel and speed, farther downrange -> barge (${far.why})`);
  ok(fast.mode === 'ship' && fast.speed > near.speed, `same fuel and downrange, higher speed -> barge (${fast.why})`);
  ok(dry.mode === 'ship' && dry.fuel < near.fuel, `same speed and downrange, less fuel -> barge (${dry.why})`); }
console.log(`recovery_plan: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
