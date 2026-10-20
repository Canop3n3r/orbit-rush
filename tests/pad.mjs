// Hotfix pad: surface props (pad, tower, droneship) stand along the local vertical. onSurface() in main.js
// uses exactly P.surfaceFrame(ef).q, so checking that quaternion checks what is rendered.
import * as P from '../physics.js?v=f5a.1';
const V = P.V; let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const deg = (a, b) => Math.acos(Math.max(-1, Math.min(1, V.dot(V.norm(a), V.norm(b))))) * 180 / Math.PI;
const sites = [[1, 0, 0], [0, 1, 0], [-1, 0.2, 0.1], [0.3, -0.8, 0.5], [0.1, 0.1, 0.99], ...Array.from({ length: 20 }, (_, i) => [Math.cos(i * 1.7), Math.sin(i * 1.7), Math.sin(i * 0.9) * 0.8])];
for (const ef of sites) {
  const f = P.surfaceFrame(ef), up = V.qrot(f.q, [0, 1, 0]), east = V.qrot(f.q, [0, 0, 1]);
  ok(deg(up, ef) < 1, `tower/pad up axis vs surface normal at ${ef.map(x => x.toFixed(2))}: ${deg(up, ef).toFixed(4)}°`);
  ok(deg(east, f.east) < 1, `pad +Z points east at ${ef}`);
  ok(Math.abs(V.dot(V.cross(f.north, f.up), f.east) - 1) < 1e-9, 'right-handed local frame');
}
// the launch site itself, at the pad (Earth-fixed [1,0,0]) and the droneship's typical downrange spot
for (const [name, ef] of [['pad', [1, 0, 0]], ['droneship', V.norm([Math.cos(0.08), Math.sin(0.08), 0])]]) { const f = P.surfaceFrame(ef); ok(deg(V.qrot(f.q, [0, 1, 0]), ef) < 1, name + ' upright'); }
// the rocket on the pad: its nose (+Y body) is along the local vertical
const q0 = P.padAttitude([1, 0, 0]); ok(deg(V.qrot(q0, [0, 1, 0]), [1, 0, 0]) < 1, 'rocket on the pad upright');
// regression: the old mirrored basis (north = east × up) is not a rotation
const up = [1, 0, 0], east = P.eastOf(up), bad = V.cross(east, up); ok(V.dot(V.cross(bad, up), east) < 0, 'old basis was left-handed (the bug)');
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
