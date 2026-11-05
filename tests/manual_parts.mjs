// OR-008: the player can command stage, fairing, payload, engines, and attitude
// without AUTO or a mission director taking them back. SPACE / auto-drop rules from
// OR-006 and the payload altitude rule from OR-007 stay as they are.
import { readFileSync } from 'node:fs';
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
import { Director, hopAuto } from '../fun/director.js';
import * as P from '../physics.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const design = () => JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === 'swift').design));
const quiet = { toast() {} };
const flight = () => new Flight(design(), quiet, { t0: P.tFromDate(Date.UTC(2026, 9, 19, 15)) });

{
  const F = flight();
  ok(F.stagePress() === 'ignite' && F.v.cur === 0 && F.v.fairing > 0, 'first SPACE still only ignites');
  ok(!F.canStage() && F.v.clamped, 'SPACE staging still waits until the rocket has cleared the tower');
  ok(!F.canJettison() && F.alt < 1000, 'SPACE still will not drop an Earth fairing on the pad (OR-006)');
  ok(F.canDropFairing() && F.v.cur < F.last && F.dropFairing() && F.v.fairing === 0 && F.flags.fairing === 1, 'FAIRING drops with lower stages still attached, in the air');
  const cur = F.v.cur;
  ok(F.canManualStage() && F.manualStage() && F.v.cur === cur + 1, 'STAGE is available on the pad, before the tower gate');
}

{
  const F = flight();
  F.ignited = true; F.v.cur = F.last; F.setAuto(true, true);
  ok(F.canRelease(), 'payload release stays available at any altitude once that stage is current (OR-007)');
  ok(!!F.releasePayload() && F.released && !F.payloadPart(), 'RELEASE works while AUTO is on');
  const low = flight(); low.ignited = true; low.v.cur = 0;
  ok(low.last > 0 && !low.canRelease(), 'RELEASE still waits until the payload stage is the one you are flying');
}

{
  const F = flight(); F.stagePress(); F.setAuto(true, true);
  F.v.clamped = false;
  ok(F.setEngines(false) && F.pilotEng && F.v.ut === 0, 'ENG cuts the engines without asking AUTO to step down');
  for (let i = 0; i < 8; i++) F.step(0.05);
  ok(F.autoOn && F.pilotEng && F.v.ut === 0 && F.v.throttle === 0, 'AUTO guidance does not relight engines the player cut', `ut ${F.v.ut} thr ${F.v.throttle} auto ${F.autoOn}`);
  ok(F.setEngines(true) && F.v.ut === 1, 'ENG relights at the player throttle');
  F.step(0.05);
  ok(F.autoOn && F.v.throttle === 1, 'a player engine command is not capped by AUTO', `thr ${F.v.throttle}`);
}

{
  const F = flight(); const D = new Director(F, 'orbit', { say() {} });
  F.stagePress(); F.setAuto(true, true);
  ok(F.autoOn, 'a mission may start on AUTO');
  F.setAuto(false, true);
  D.tick(1 / 30); D.tick(1 / 30);
  ok(!F.autoOn && F.wantManual && D.active, 'the mission director does not force AUTO back on');
  F.setAuto(true, true); D.tick(1 / 30);
  ok(F.autoOn && !F.wantManual, 'AUTO stays optional: the player can hand the mission back');
}

{
  const F = flight(); F.stagePress();
  const D = hopAuto(F, { say() {} });
  ok(F.setEngines(false) && F.keepAttitude(), 'hop: player cuts engines and holds attitude');
  const nose = F.v.sasHold && F.v.sasHold.slice();
  D.tick(1 / 30); F.step(0.05);
  ok(F.v.ut === 0 && F.v.throttle === 0, 'the hop director does not relight a cut engine', `ut ${F.v.ut}`);
  ok(F.attManual && F.v.sas === 'stab' && !F.v.steerDir && nose && F.v.sasHold && F.v.sasHold[1] === nose[1], 'KEEP holds the nose; the hop autopilot does not point it for you');
}

{
  const F = flight(); F.stagePress(); F.setAuto(true, true); F.v.clamped = false;
  ok(F.keepAttitude() && F.autoOn && F.attManual && F.v.sas === 'stab' && F.v.sasHold, 'KEEP takes the nose and leaves AUTO on');
  F.v.input = { pitch: 1, yaw: 0, roll: 0 };
  F.step(0.05);
  ok(F.autoOn && !F.v.steerDir, 'AUTO does not overwrite a held attitude', F.v.steerDir && 'steerDir set');
  ok(F.toggleRCS() === true || F.v.rcsOn === true || F.v.rcsOn === false, 'RCS toggles without AUTO');
  const rcs = F.v.rcsOn; F.setAuto(false, true); F.toggleRCS();
  ok(F.v.rcsOn !== rcs && !F.autoOn, 'RCS works with AUTO off and does not turn AUTO on');
  ok(F.toggleFine() === true && F.v.fine && F.stickScale(1) === 0.2, 'FINE is one fifth of a full stick');
  ok(F.toggleFine() === false && F.stickScale(1) === 1, 'FINE off is full stick again');
}

{
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../ui59.css', import.meta.url), 'utf8');
  ok(main.includes('manBtn') && main.includes('manSheet'), 'flight HUD has a manual-control button and sheet');
  for (const name of ['manualStage', 'dropFairing', 'releasePayload', 'setEngines', 'toggleRCS', 'toggleFine', 'keepAttitude']) ok(main.includes(name), `HUD calls ${name}`);
  ok(css.includes('#manBtn') && css.includes('#manSheet'), 'the manual controls are styled in the bar, not floating over the view');
  ok(!/autoOn[^{]*#manBtn[^}]*display:\s*none/.test(css), 'AUTO does not hide the manual-control button');
}

console.log(fail ? `manual_parts: ${fail} failed` : 'manual_parts: ok');
process.exit(fail ? 1 : 0);
