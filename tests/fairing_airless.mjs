// OR-006: payload fairings are not required on airless bodies. They can come off on the
// pad, and a launch drops them at liftoff instead of waiting for Earth's 100 km rule.
// A body with air (Earth, Mars) keeps the fairing through the early climb.
import { Flight } from '../flight.js';
import { SHOWROOM } from '../fun/showroom.js';
import { siteOpts } from '../sites.js';
import { FAIRING_ALT } from '../physics/guidance.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const design = () => JSON.parse(JSON.stringify(SHOWROOM.find(r => r.id === 'needle').design));
const flight = body => new Flight(design(), {}, body === 'earth' ? {} : siteOpts({ body, lat: 0, lon: 0 }));
const press = F => { const a = F.stagePress(); if (a === 'armed') { F.realT = (F.realT || 0) + 0.2; return F.stagePress(); } return a; };

ok(flight('moon').v.fairing > 0, 'a payload rocket still ships with a fairing');

for (const body of ['moon', 'mercury']) {
  const F = flight(body);
  ok(F.stagePress() === 'ignite' && F.v.clamped && F.v.fairing > 0, `${body}: ignition on the pad leaves the fairing on`);
  F.v.cur = F.last; F.realT += 1;
  const a = press(F);
  ok(a === 'fairing' && F.v.fairing === 0 && F.flags.fairing === 1 && F.alt < 1000, `${body}: fairing jettisons on the pad`, `${a} alt ${F.alt.toFixed(0)}`);
}

{
  const E = flight('earth');
  E.stagePress(); E.v.cur = E.last; E.realT += 1;
  const a = E.stagePress();
  ok(a !== 'fairing' && E.v.fairing > 0 && !E.flags.fairing, 'Earth pad: the fairing is not jettisonable yet', a);
}

function climb(body, alt, sec) {
  const F = flight(body); F.stagePress(); F.setAuto(true, true);
  let held = false;
  for (let i = 0; i < 30 * sec && F.alt < alt && !F.flags.dead; i++) {
    F.advance(1 / 30);
    if (F.v.clamped && F.flags.fairing) held = true;
  }
  return { F, held };
}

{
  const { F, held } = climb('moon', 5000, 40);
  ok(!F.flags.dead && !F.v.clamped, 'Moon launch leaves the pad', F.flags.dead || `alt ${F.alt.toFixed(0)}`);
  ok(!held && F.flags.fairing === 1 && F.v.fairing === 0 && F.alt < FAIRING_ALT, 'Moon fairing drops at liftoff, below the Earth fairing altitude', `alt ${(F.alt / 1000).toFixed(1)} km flag ${F.flags.fairing}`);
}
{
  const { F } = climb('earth', 2500, 30);
  ok(!F.flags.dead && F.alt > 400 && F.v.fairing > 0 && !F.flags.fairing, 'Earth keeps the fairing through the early climb', `alt ${F.alt.toFixed(0)} fair ${F.v.fairing}`);
}
{
  const { F } = climb('mars', 1500, 50);
  ok(!F.flags.dead && F.alt > 200 && F.v.fairing > 0 && !F.flags.fairing, 'Mars keeps the fairing in its atmosphere', `alt ${F.alt.toFixed(0)} dead ${F.flags.dead || ''}`);
}

console.log(fail ? `fairing_airless: ${fail} failed` : 'fairing_airless: ok');
process.exit(fail ? 1 : 0);
