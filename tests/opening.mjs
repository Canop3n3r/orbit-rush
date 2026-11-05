// Launch opening shot: slow zoom-out from the pad, then a blend onto the vehicle track.
// A playing trailer path (?cine= / __cine) never starts it, and a player zoom releases it.
import { OPEN_ZOOM_S, OPEN_BLEND_S, OPEN_END_S, wideDist, trackDist, openingPose, openingBegin, openingLatch, openingRelease } from '../fun/opening.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };

ok(OPEN_ZOOM_S === 9 && OPEN_BLEND_S === 7 && OPEN_END_S === 16, 'zoom-out is 9 s, blend is 7 s, shot ends at 16 s');

const L = 70, pad = { dist: 120, pitch: 0.12, aim: 0.5 }, track = { dist: trackDist(L), pitch: 0.12, aim: 0.45 };
ok(wideDist(L) > pad.dist * 1.7 && track.dist < wideDist(L), 'a 70 m stack has a wide pad shot and a closer track', `wide ${wideDist(L)} track ${track.dist}`);

const at = t => openingPose(t, pad, track, L);
const z0 = at(0), z5 = at(5), z9 = at(9), z12 = at(12), z16 = at(16), z20 = at(20);
ok(z0.dist === pad.dist && z0.pitch === pad.pitch && z0.aim === pad.aim && !z0.done, 't = 0 stays on the pad framing (no jump)');
ok(z5.dist > pad.dist * 1.4 && z5.blend === 0 && !z5.done, 'by 5 s the zoom-out is past 1.4× the pad distance', z5.dist.toFixed(1));
let mono = true; let prev = pad.dist;
for (let t = 1; t <= OPEN_ZOOM_S; t++) { const d = at(t).dist; if (d < prev - 1e-6) mono = false; prev = d; }
ok(mono && Math.abs(z9.dist - wideDist(L)) < 1e-6 && z9.pitch === 0.05 && z9.aim === 0.32, '0–9 s zooms out monotonically onto the wide pose');
ok(z12.dist < z9.dist && z12.dist > track.dist && z12.blend > 0 && z12.blend < 1, '9–16 s blends from the wide pose toward the vehicle track', z12.dist.toFixed(1));
ok(z16.done && Math.abs(z16.dist - track.dist) < 1e-6 && z16.pitch === track.pitch && z16.aim === track.aim, 'at 16 s the pose is the vehicle track (handoff does not pop)');
ok(z20.done && z20.dist === z16.dist && z20.pitch === z16.pitch && z20.aim === z16.aim, 'after 16 s the pose stays on the track');

ok(openingBegin({ view: 'vehicle', mode: 'chase', alt: 40, orbit: false }), 'a low vehicle chase may open the shot');
ok(!openingBegin({ view: 'free', mode: 'chase', alt: 40, orbit: false }) && !openingBegin({ view: 'vehicle', mode: 'chase', alt: 400, orbit: false }) && !openingBegin({ view: 'vehicle', mode: 'chase', alt: 10, orbit: true }), 'free, high, or already in orbit does not open the shot');
ok(!openingLatch({ trailer: false, ignited: false, seen: false, begin: true }).seen, 'before ignition the shot is not latched');
ok(openingLatch({ trailer: true, ignited: true, seen: false, begin: true }).seen && !openingLatch({ trailer: true, ignited: true, seen: false, begin: true }).start, '?cine= at ignition marks the shot seen and does not start it');
ok(!openingLatch({ trailer: true, ignited: true, seen: true, begin: true }).start, 'a trailer path that later stops does not start the opening');
const go = openingLatch({ trailer: false, ignited: true, seen: false, begin: true });
ok(go.seen && go.start, 'a pad chase with no trailer starts the opening');
ok(!openingLatch({ trailer: false, ignited: true, seen: true, begin: true }).start, 'the opening starts once');

ok(openingRelease({ trailer: true, user: false, view: 'vehicle', mode: 'chase', orbit: false }), 'a playing trailer path releases the opening camera');
ok(openingRelease({ trailer: false, user: true, view: 'vehicle', mode: 'chase', orbit: false }), 'a player zoom or drag releases the opening camera');
ok(!openingRelease({ trailer: false, user: false, view: 'vehicle', mode: 'chase', orbit: false }), 'the shot keeps the camera while the player has not taken it');
ok(openingRelease({ trailer: false, user: false, view: 'horizon', mode: 'chase', orbit: false }), 'leaving the vehicle view releases the shot');
ok(openingRelease({ trailer: false, user: false, view: 'vehicle', mode: 'chase', orbit: true }), 'orbit releases the shot');

console.log(fail ? `opening: ${fail} FAIL, ${pass} passed` : `opening: ${pass} passed`);
process.exit(fail ? 1 : 0);
