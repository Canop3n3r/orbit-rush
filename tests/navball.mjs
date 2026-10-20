// Navball math (fun/navball.js) + the new SAS target mode. Run: node tests/navball.mjs
import * as N from '../fun/navball.js?v=f5.1b';
import * as P from '../physics.js?v=f5.1b';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const r = [6.4e6, 0, 0], H = N.horizonFrame(r);
{ const F = N.shipFrame(H.east, H.up), p = N.navballProject(F, H.east); ok(near(p.x, 0) && near(p.y, 0) && p.front, 'nose direction sits under the fixed reticle (ball centre)');
  const u = N.navballProject(F, H.up); ok(near(u.y, 1) && near(u.x, 0), 'nose on the horizon heading east: sky (up) is at the top of the ball');
  const b = N.navballProject(F, P.V.scale(H.east, -1)); ok(!b.front, 'retrograde of the nose is on the hidden side'); }
{ const ph = N.pitchHeading(H, H.up); ok(near(ph.pitch, 90), 'pitch of up = 90°'); ok(near(N.pitchHeading(H, H.east).heading, 90) && near(N.pitchHeading(H, H.north).heading, 0), 'heading: north 0°, east 90°');
  const d = P.V.norm(P.V.add(H.east, H.up)); ok(near(N.pitchHeading(H, d).pitch, 45, 1e-6), '45° up the pitch ladder'); }
{ const F = N.shipFrame(H.up, H.north), p = N.navballProject(F, H.north); ok(near(p.y, 1), 'on the pad (nose up), north is at the top'); }
ok(Object.keys(N.MARKERS).length === 9 && ['pro', 'retro', 'nrm', 'anti', 'radOut', 'radIn', 'node', 'tgt', 'antiTgt'].every(k => N.MARKERS[k]), 'markers: prograde/retro, normal/anti, radial out/in, maneuver, target/anti');
{ const v = { r, v: [0, 7700, 0], q: [0, 0, 0, 1], targetDir: [0, 0, 1] }; ok(P.sasDir(v, 'target')[2] === 1 && P.SAS_LABEL.target === 'TARGET', 'SAS target mode steers at the target direction');
  ok(P.sasDir(v, 'antitarget')[2] === -1, 'SAS anti-target'); }
console.log(`navball: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
