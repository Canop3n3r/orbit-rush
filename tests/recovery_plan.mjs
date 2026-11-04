// f5.9-25: booster recovery autopilot: AUTO picks return-to-site when the boostback fits in the propellant left at
// separation, else a barge on the downrange track; a setting forces either, and setRecovery switches mid-flight.
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? '  ✔' : 'FAIL', m); };
const sep = (id, pref) => { const F = new Flight(JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === id).design)), {}, { recoveryPref: pref }); F.stagePress(); F.setAuto(true, true);
  for (let i = 0; i < 200000 && !F.flags.dead && !(F.booster && F.booster.state === 'flying'); i++) { F.realT += 0.02; F.step(0.02); } return F; };
{ const F = sep('swift', 'auto'), p = F.booster.recPlan; ok(p.mode === 'rtls' && F.booster.rtls && F.ship.lz, `swift AUTO -> RTLS (${p.why})`); }
{ const F = sep('heron', 'auto'), p = F.booster.recPlan; ok(p.mode === 'ship' && !F.booster.rtls && F.ship && !F.ship.lz, `heron AUTO -> barge (${p.why})`);
  ok(F.setRecovery('rtls') && F.booster.rtls && F.ship.lz && p.mode === 'rtls', 'heron override -> RTLS mid-flight');
  ok(F.setRecovery('ship') && !F.booster.rtls && !F.ship.lz && p.mode === 'ship', 'heron override back -> barge'); }
{ const F = sep('swift', 'ship'); ok(!F.booster.rtls && F.booster.recPlan.pref === 'ship', 'setting forces the barge'); }
{ const F = sep('heron', 'design'); ok(F.booster.recPlan.mode === 'ship', 'no setting keeps the rocket default'); }
console.log(`recovery_plan: ${pass} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
