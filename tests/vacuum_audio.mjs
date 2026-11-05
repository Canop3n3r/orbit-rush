// OR-005: engine audio follows the body you are flying. Airless surfaces are vacuum
// (a low internal rumble), not Earth's sea-level roar. Earth's own curve stays put:
// full roar at the pad, faint rumble above the atmosphere.
import { readFileSync } from 'node:fs';
import { ambientPressureRatio, engineListen } from '../fun/listen.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };

const sea = ambientPressureRatio('earth', 0);
ok(Math.abs(sea - 1) < 1e-6, 'Earth sea level is 1 atm', sea);
const hi = ambientPressureRatio('earth', 400000);
ok(hi < 1e-8, 'Earth at 400 km is vacuum', hi);
ok(ambientPressureRatio('moon', 0) === 0, 'Moon surface is vacuum', ambientPressureRatio('moon', 0));
ok(ambientPressureRatio('moon', -4e6) === 0, 'a negative lunar altitude stays vacuum (not Earth sea level)', ambientPressureRatio('moon', -4e6));
ok(ambientPressureRatio('mercury', 0) === 0, 'Mercury is vacuum');
ok(ambientPressureRatio('phobos', 100) === 0, 'Phobos is vacuum');
ok(ambientPressureRatio('mars', 0) > 0.001, 'Mars surface still has an atmosphere', ambientPressureRatio('mars', 0));

const roar = engineListen(1), vac = engineListen(0), moon = engineListen(ambientPressureRatio('moon', 0));
ok(roar.vacK > 0.95 && roar.rumble > 0.95 && roar.hz > 600 && roar.crack === 0.5, 'sea level is a full atmospheric roar', JSON.stringify(roar));
ok(vac.rumble > 0 && vac.rumble <= 0.26 && vac.hz <= 160 && vac.crack < 0.2 && vac.vacK <= 0.11, 'vacuum keeps a low internal rumble and drops the roar', JSON.stringify(vac));
ok(moon.hz === vac.hz && moon.vacK === vac.vacK && moon.rumble === vac.rumble && moon.crack === vac.crack, 'the Moon uses the vacuum mix');
const up = engineListen(hi);
ok(up.vacK < 0.25 && up.hz < 200, 'high Earth orbit stays the faint rumble the flight bus already uses', JSON.stringify(up));

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const i = main.indexOf('if (ac && dbus)'), j = main.indexOf("if (state === 'flight' && (hudT");
const block = main.slice(i, j);
ok(block.includes('engineListen(') && block.includes('ambientPressureRatio('), 'the flight loop asks the current body for engine audio');
ok(!/\bpressureRatio\(/.test(block), 'engine audio no longer uses Earth pressureRatio on the Earth-relative height');

console.log(fail ? `vacuum_audio: ${fail} failed` : 'vacuum_audio: ok');
process.exit(fail ? 1 : 0);
