// f5.3 (QA playtest/staging_manual_f5.1f.md): 2-stage serial stacks broke up when staged at 3-4 km. After a serial
// separation (flown by hand, AUTO off, as in the QA run) the upper stage holds its flight path for SEP_HOLD_S; STAGE is one tap when safe and warns above half QMAX.
import { Flight, QMAX, SEP_HOLD_S, STAGE_Q_WARN } from '../flight.js?v=f53';
import { SHOWROOM } from '../fun/showroom.js?v=f53';
import { specDesign, rosterFor } from '../fun/specstack.js?v=f53';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const heron = SHOWROOM.find(r => r.id === 'heron');
const rockets = [['Heron', heron.design], ...['new-glendale', 'saturnine-v', 'atlantean-v-401'].map(id => [id, specDesign(rosterFor(id), id, id)])];
for (const [name, d] of rockets) for (const alt of [3100, 3400, 3800]) {
  const F = new Flight(JSON.parse(JSON.stringify(d)), {}, {}); F.autoStage = false; F.stagePress(); F.setAuto(true, true); let r = null, q = 0, first = null;
  for (let i = 0; i < 30 * 200 && !F.flags.dead; i++) { F.advance(1 / 30); F.realT = (F.realT || 0) + 1 / 30;
    if (r === null && F.alt > alt && F.v.cur === 0) { F.setAuto(false, true); F.v.ut = 1; q = F.v.tel.q; r = first = F.stagePress(); if (r === 'armed') { F.realT += 0.2; r = F.stagePress(); } }
    if (r && F.met > 60 + 0) break; }
  const broke = /breakup|broke up/.test(F.flags.dead || '');
  ok(F.v.cur >= 1 && (!broke || first === 'armed'), `${name}: staged at ${alt} m (q ${(q / 1000).toFixed(1)} kPa, first tap ${first}): ${broke ? 'broke up, but STAGE warned first' : 'upper stage survives separation'} (${F.flags.dead || 'ok'})`); }
{ const F = new Flight(JSON.parse(JSON.stringify(heron.design)), {}, {}); F.autoStage = false; F.stagePress(); F.setAuto(true, true);
  for (let i = 0; i < 30 * 30; i++) { F.advance(1 / 30); F.realT = (F.realT || 0) + 1 / 30; } F.v.tel.q = 2 * STAGE_Q_WARN;
  ok(F.stagePress() === 'armed' && F.v.cur === 0, 'high Q: the first STAGE tap only warns'); F.v.tel.q = 0; F.realT += 5; F.stageArm = -1;
  ok(F.stagePress() === 'stage' && F.v.cur === 1, 'safe: STAGE is one tap'); ok(F.stagePress() !== 'stage' && F.v.cur === 1, 'a fast second tap never drops a second stage');
  ok(F.sepHold > F.met && F.sepHold - F.met <= SEP_HOLD_S, 'the upper stage holds its flight path after separation'); }
console.log(`stagesafe: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
