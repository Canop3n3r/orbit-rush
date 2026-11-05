// Trailer hooks (f5.9-30): clean plate does not pause, scripted warp is quiet, cine paths move, deploy scale slows the push, arrival orbits are circular.
import { Flight, WARPS } from '../flight.js';
import * as P from '../physics.js';
import { SHOWROOM } from '../fun/showroom.js';
import { cloneDesign } from '../parts.js';
import { SITES } from '../sites.js';
import { parseQuery, createTrailer, warpPlan, spaceScore, deployMotion, epochMillis, resolveSite, applyArrival, preset } from '../fun/trailer.js';
let pass = 0, fail = 0; const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('FAIL', m, x); } };

const hud = parseQuery('?hud=0&warp=100');
ok(hud.clean === true && hud.pause === false, 'hud=0 hides the plate and does not pause');
ok(parseQuery('?clean=1').clean === true && parseQuery('?clean=1').pause === false, 'clean=1 is the same opt-in');
ok(parseQuery('').clean === false && parseQuery('').autoStart === false && parseQuery('').pause === false, 'a normal URL leaves the HUD and the sim alone');
ok(parseQuery('?trailer=1').cine === 'orbit' && parseQuery('?trailer=1').autoStart && !parseQuery('?trailer=1').clean, 'trailer=1 starts an orbit path and still shows the HUD');
ok(parseQuery('?cine=crane').cine === 'crane' && parseQuery('?cine=dolly&hud=0').clean, 'cine= names a path');
ok(parseQuery('?music=space').score && parseQuery('?score=1').score && !parseQuery('').score, 'music=space / score=1 request the space score');

ok(warpPlan(100, WARPS).index === WARPS.indexOf(100) && warpPlan(100, WARPS).quiet === true && warpPlan(100, WARPS).mult === 100, 'warp 100 is the ×100 step, quiet');
ok(warpPlan(1, WARPS).index === 0 && warpPlan(10, WARPS).mult === 10, 'warp 1 is ×1 and warp 10 is exact');
ok(warpPlan(3, WARPS).mult === 4, 'an off-step warp picks the nearest step (×3 → ×4)');

const dolly = createTrailer('?cine=dolly');
const d0 = dolly.sample(0), d1 = dolly.sample(6);
ok(dolly.active && d0.dist > 200 && d1.dist < d0.dist - 40 && d1.name === 'dolly', 'dolly path moves in', d0.dist.toFixed(0) + ' → ' + d1.dist.toFixed(0));
const orbit = createTrailer('?cine=orbit');
const y0 = orbit.sample(0).yaw, y1 = orbit.sample(8).yaw;
ok(y1 > y0 + 0.8, 'orbit path yaws around the craft', (y1 - y0).toFixed(2) + ' rad');
const crane = createTrailer('?cine=crane');
const c0 = crane.sample(0), c1 = crane.sample(10);
ok(c1.pitch > c0.pitch + 0.3, 'crane path rises', c0.pitch.toFixed(2) + ' → ' + c1.pitch.toFixed(2));
const pay = preset('payload');
ok(pay && pay.look === 'payload' && pay.keys.length >= 2, 'payload preset frames the payload');
const custom = createTrailer('');
ok(custom.play([{ t: 0, dist: 10, yaw: 0, pitch: 0, fov: 50 }, { t: 4, dist: 40, yaw: 1, pitch: 0.2, fov: 24 }]), 'play() accepts keyframes');
const k0 = custom.sample(0), k1 = custom.sample(4);
ok(k0.fov === 50 && k1.dist > k0.dist && k1.fov < k0.fov, 'custom keyframes interpolate dist and fov');
custom.hold({ dist: 12, fov: 18, look: 'payload', yaw: 0.2, pitch: 0.1 });
const held = custom.sample(3);
ok(held.look === 'payload' && held.dist === 12 && held.fov === 18, 'hold() freezes a payload close-up');
custom.stop(); ok(custom.sample(1) === null && !custom.active, 'stop() hands the camera back');

ok(deployMotion(1, 1).sep === 2 && deployMotion(1, 1).dur === 4 && deployMotion(1, 1).delay === 1.2, 'deploy scale 1 keeps the 2 m/s, 4 s unfold');
const slow = deployMotion(0.25, 2);
ok(slow.sep === 0.5 && slow.dur === 16 && slow.delay === 4.8 && slow.size === 2, 'deploy 0.25 is slower and deploySize 2 is bigger', JSON.stringify(slow));

ok(spaceScore(1000, false, false).kind === null, 'below 52 km the space score stays off');
ok(spaceScore(80000, true, false).kind === 'space' && spaceScore(80000, true, false).level > 0.15, 'above the air the space score plays');
ok(spaceScore(0, false, true).kind === 'space' && spaceScore(0, false, true).level === 1, 'trailer music plays the space score on the pad');

ok(epochMillis('epoch=2026-06-21T15:04:00Z', 0) === Date.parse('2026-06-21T15:04:00Z'), 'epoch= sets the clock');
ok(new Date(epochMillis('tod=18:40', Date.parse('2026-11-05T03:00:00Z'))).toISOString() === '2026-11-05T18:40:00.000Z', 'tod= sets UTC time of day');
ok(epochMillis('', 1234) === 1234, 'with no epoch the caller clock is kept');
ok(resolveSite('site=gale', SITES).body === 'mars' && resolveSite('site=moon:tranq', SITES).id === 'tranq', 'site= picks a launch site');
ok(resolveSite('site=nope', SITES) === null, 'an unknown site does not override the saved pad');

function along(F, v0) { const n = P.noseOf(F.v), r = F.released.v; return (r[0] - v0[0]) * n[0] + (r[1] - v0[1]) * n[1] + (r[2] - v0[2]) * n[2]; }
function ship() { const d = cloneDesign(SHOWROOM.find(s => s.id === 'swift').design); d.model = 'heron-9'; return d; }
{ const F = new Flight(ship(), { toast() {} }); F.placeInOrbit(300000); const v0 = F.v.v.slice(); F.releasePayload();
  ok(F.released && Math.abs(along(F, v0) - 2) < 0.05, 'normal release still pushes at 2 m/s', along(F, v0).toFixed(3)); }
{ const F = new Flight(ship(), { toast() {}, deployScale: () => 0.25 }); F.placeInOrbit(300000); const v0 = F.v.v.slice(); F.releasePayload();
  ok(F.released && Math.abs(along(F, v0) - 0.5) < 0.05, 'deploy scale 0.25 pushes at 0.5 m/s', along(F, v0).toFixed(3)); }

for (const body of ['moon', 'mars', 'venus']) {
  const log = []; const F = new Flight(ship(), { toast: m => log.push(m) });
  const st = applyArrival(F, body, null, P); F.postStep();
  const b = P.BODIES[body], R = Math.hypot(...F.v.r), sp = Math.hypot(...F.v.v), alt = R - b.R;
  ok(st && F.v.body === body && Math.abs(alt - st.alt) < 1 && Math.abs(sp - st.vc) / st.vc < 1e-6, body + ' arrival is a circular orbit', Math.round(alt / 1000) + ' km');
  ok(!log.some(m => /ORBIT AROUND|FLYBY/.test(m)) && !F.ended, body + ' arrival does not toast or end the flight');
}

console.log(fail ? `trailer: ${fail} FAIL, ${pass} passed` : `trailer: ${pass} passed`);
process.exit(fail ? 1 : 0);
