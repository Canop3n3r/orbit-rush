// Space score, pause silence, and menu bleed. Pure checks plus the flight-loop wiring.
// Menu lofi and the space score stay different tracks; flight one-shots stay off until a flight starts.
import { readFileSync } from 'node:fs';
import { createAudio } from '../fun/audio.js';
import { engineListen, flightLoudness } from '../fun/listen.js';
import { scoreLeaveFade } from '../fun/music.js';
import { spaceScore } from '../fun/trailer.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };

const hi = spaceScore(80000, false, false);
ok(hi.kind === 'space' && hi.level === 1, 'above 60 km the space score is full');
ok(spaceScore(0, false, true).kind === 'space' && spaceScore(1000, false, false).kind === null, 'trailer force plays on the pad; a normal pad stays quiet');

ok(scoreLeaveFade('space', 'menu') <= 0.45 && scoreLeaveFade('space', 'menu') < scoreLeaveFade('menu', null), 'space leaves a menu quickly; the lofi crossfade into flight is longer', scoreLeaveFade('space', 'menu') + ' vs ' + scoreLeaveFade('menu', null));
ok(scoreLeaveFade('menu', 'space') === scoreLeaveFade('menu', null), 'the menu beat uses one leave time whichever flight track follows');

const chase = flightLoudness(80, { vacK: 1 });
const farGround = flightLoudness(2500, { ground: true, vacK: 1 });
const vac = flightLoudness(80, { vacK: engineListen(0).vacK });
ok(chase.distK > 0.9 && chase.gain > 0.9, 'chase camera in air stays loud', JSON.stringify(chase));
ok(farGround.distK < 0.4 && farGround.gain < 0.4, 'a distant ground camera ducks the rocket', JSON.stringify(farGround));
ok(flightLoudness(9000, { map: true, vacK: 1 }).distK === 0.35, 'map view is a fixed quiet bed');
ok(vac.gain < 0.25 && vac.gain > 0, 'vacuum keeps a faint internal rumble at the chase camera', JSON.stringify(vac));
ok(flightLoudness(80, { vacK: engineListen(1).vacK }).gain > 0.95, 'sea-level chase is a full roar');

const api = createAudio(() => null);
ok(api.heard === false, 'flight one-shots start closed');
api.boom(true, 10);
api.startLoops();
ok(api.heard === true, 'a flight opens one-shots');
api.boom(true, 10);
api.stopLoops();
ok(api.heard === false && api.liveLoops() === 0, 'leaving the flight closes one-shots and the wind loop');

const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const show = main.slice(main.indexOf('function showEnd'), main.indexOf('function showEnd') + 1200);
ok(show.includes('silenceFlight('), 'the end card silences the flight bus');
ok(!/stopFlightLoops\(/.test(show), 'the end card does not leave one-shots on an open bus');
const mode = main.slice(main.indexOf('function musicMode'), main.indexOf('function musicTick'));
ok(mode.indexOf("return ['menu', 1]") < mode.indexOf('spaceScore('), 'pause and the end card pick the menu lofi before the space score');
ok(mode.includes('TR.score'), 'trailer ?music=space / __orAudio.score still reaches the score');
const mix = main.slice(main.indexOf('if (ac && dbus)'), main.indexOf("if (state === 'flight' && (hudT"));
ok(mix.includes('flightLoudness(') && mix.includes('funAudio.heard') && mix.includes('engineListen('), 'distance and air scale the flight bus only while a flight is heard');
ok(main.includes('!funAudio.heard') && /function beep\(/.test(main), 'flight beeps and cracks do not start when the flight bus is closed');

console.log(fail ? `audio_polish: ${fail} failed` : `audio_polish: ${pass} passed`);
process.exit(fail ? 1 : 0);
