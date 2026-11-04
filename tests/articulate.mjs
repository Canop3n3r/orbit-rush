// legs-fins-1: landing legs, grid fins and flaps really move over a landing timeline (pivot angles change), not just appear.
import { boosterPose, shipPose, rigOf, applyBooster, applyShip, LEG_SWING, FIN_DEPLOY, FIN_MAX } from '../gfx/vehicles/articulate.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const O = (name, yaw = 0, kids = []) => { const o = { name, children: [], rotation: { x: 0, y: yaw, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; } }, add(c) { const i = c.parent ? c.parent.children.indexOf(c) : -1; if (i >= 0) c.parent.children.splice(i, 1); c.parent = this; this.children.push(c); } }; for (const k of kids) o.add(k); return o; };
const mk = () => O('');
// a booster: 4 legs + 4 grid fins, each fin with a lattice mesh child
const legs = [0, 1, 2, 3].map(i => O('leg_' + i, i * Math.PI / 2)), fins = [0, 1, 2, 3].map(i => O('gridfin_' + i, -(Math.PI / 4 + i * Math.PI / 2), [O('lattice')]));
const model = O('heron-9', 0, [O('booster', 0, [...legs, ...fins])]); model.userData = {};
const rig = rigOf(model, mk); ok(rig.legs.length === 4 && rig.fins.length === 4, 'rig finds 4 legs + 4 grid fins');
ok(rig.fins.every(f => f.piv.children.length === 1 && f.piv.children[0].name === 'defl' && f.piv.children[0].children[0].name === 'lattice'), 'each fin twists through a defl child holding its lattice');
// RTLS landing timeline (s since separation): boostback 5-50, coast, entry burn, glide with steering + rates, legs at 600 m, landed
const tl = []; for (let t = 0; t <= 420; t += 0.5) { const alt = t < 150 ? 70000 + 40000 * Math.sin(t / 150 * Math.PI / 2) : Math.max(0, 110000 - (t - 150) * 420);
  tl.push({ t, s: { state: alt <= 0 ? 'landed' : 'flying', rtls: true, tSep: t, phase: t >= 5 && t < 50 ? 'boostback' : 'coast', bbDone: t >= 50, legs: false, alt,
    fin: alt < 30000 && alt > 0 ? [0.02 * Math.sin(t / 3), 0, 0.015 * Math.cos(t / 4)] : null, rates: alt < 30000 ? [0.05 * Math.sin(t), 0.04 * Math.cos(t * 0.7), 0.03 * Math.sin(t * 0.5)] : [0, 0, 0] } }); }
const rec = []; for (const { t, s } of tl) { applyBooster(rig, boosterPose(s), 0.5); rec.push({ t, leg: rig.legs[0].rotation.z, fin: rig.fins[0].piv.rotation.z, tw: rig.fins.map(f => f.defl.rotation.y), alt: s.alt }); }
const at = t => rec.find(r => r.t >= t);
ok(at(0).leg === 0 && at(0).fin === 0, 'legs and fins stowed at separation');
ok(at(20).fin === 0, 'grid fins stay stowed during the boostback');
ok(at(60).fin < -FIN_DEPLOY * 0.99, 'grid fins deployed after the boostback: ' + at(60).fin.toFixed(2));
ok(rec.filter(r => r.alt > 600).every(r => r.leg === 0), 'legs stay folded until the landing burn (600 m)');
ok(Math.abs(rec[rec.length - 1].leg + LEG_SWING) < 1e-6, 'legs end fully deployed: 120 deg swing');
const mids = rec.filter(r => r.leg < 0 && r.leg > -LEG_SWING); ok(mids.length >= 6, 'legs swing over several frames (animated, not a pop): ' + mids.length);
const glide = rec.filter(r => r.alt < 30000 && r.alt > 600), tw = glide.flatMap(r => r.tw);
ok(Math.max(...tw) > 0.03 && Math.min(...tw) < -0.03, 'grid fins twist both ways while steering the descent');
ok(tw.every(x => Math.abs(x) <= FIN_MAX * 1.6 + 1e-9), 'twist within limits');
ok(new Set(glide.map(r => r.tw[0].toFixed(3))).size > 20, 'fin twist keeps changing during the glide');
ok(glide.some(r => Math.abs(r.tw[0] - r.tw[1]) > 0.02), 'fins deflect individually (azimuth mixing)');
// ship flaps: belly-flop then flip
const fl = [['f', 1], ['f', -1], ['a', 1], ['a', -1]].map(([k, s]) => O(`flap_${k}_${s}`)); const ship = O('ship', 0, fl); ship.userData = {}; const sr = rigOf(ship);
ok(sr.flaps.length === 4, 'rig finds 4 flaps');
const fr = []; for (let t = 0; t < 300; t += 0.5) { const alt = 80000 - t * 270; applyShip(sr, shipPose({ state: alt > 0 ? 'flying' : 'landed', vr: -80, alt: Math.max(alt, 0), t, rates: [0.08 * Math.sin(t * 0.9), 0, 0.05 * Math.cos(t * 0.6)] }), 0.5); fr.push({ alt, a: sr.flaps.map(f => -f.piv.rotation.y * f.side) }); }
const belly = fr.filter(r => r.alt > 2000 && r.alt < 70000);
ok(new Set(belly.map(r => r.a[0].toFixed(3))).size > 20, 'forward flap keeps moving in the belly-flop');
ok(belly.some(r => Math.abs(r.a[0] - r.a[2]) > 0.05), 'forward and aft flaps move differentially (pitch control)');
ok(belly.some(r => Math.abs(r.a[0] - r.a[1]) > 0.03), 'left and right flaps move differentially (roll control)');
const flip = fr.filter(r => r.alt < 1000 && r.alt > 0); ok(flip.length && flip[flip.length - 1].a[0] > flip[flip.length - 1].a[2] + 0.3, 'flip: forward flaps up, aft flaps folded');
// a booster built with its fins open (super-heavy: fixed-out fins) keeps them open; they still twist to steer
{ const f = [0, 1, 2].map(i => { const o = O('gridfin_' + i, 0, [O('lattice')]); o.userData = { yaw: -i }; o.rotation.z = -FIN_DEPLOY; return o; }); const m = O('b', 0, f); m.userData = {}; const r = rigOf(m, mk);
  applyBooster(r, boosterPose({ state: 'flying', tSep: 0, alt: 70000, rates: [0.1, 0, 0] }), 0.5); ok(r.fins.every(x => Math.abs(x.piv.rotation.z + FIN_DEPLOY) < 1e-6), 'built-open fins stay open');
  ok(r.fins.every(x => Math.abs(x.piv.rotation.y + f.indexOf(x.piv)) < 1e-9), 'fin azimuth kept'); }
// a baked per-stage swing (Blender deploy_rad) wins over the default 120 deg
{ const l = O('leg_0'); l.userData = { deploy_rad: -1.85 }; const m = O('b', 0, [l]); m.userData = {}; const r = rigOf(m, mk); applyBooster(r, boosterPose({ state: 'landed', alt: 0 }), Infinity); ok(Math.abs(l.rotation.z + 1.85) < 1e-9, 'leg uses its baked swing'); }
// flaps: the hinge is the flap root (local y axis, x = 0): the root stays put, the tip sweeps several metres over the belly-flop -> flip travel
{ const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
  const tipA = [5.0, 0.6, 0], rootTop = [0, 11, 0], fA = fr.find(r => r.alt < 60000 && r.alt > 50000), fB = fr.filter(r => r.alt < 1000 && r.alt > 0).pop();
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  ok(d(rotY(rootTop, 0), rotY(rootTop, 0.7)) < 1e-9, 'flap root lies on the hinge axis');
  const aft = sr.flaps.findIndex(f => !f.fwd), fwd = sr.flaps.findIndex(f => f.fwd);
  ok(d(rotY(tipA, fA.a[fwd]), rotY(tipA, fB.a[fwd])) > 2, 'forward flap tip sweeps > 2 m from belly-flop to flip: ' + d(rotY(tipA, fA.a[fwd]), rotY(tipA, fB.a[fwd])).toFixed(2));
  ok(Math.max(...fr.map(r => r.a[fwd])) > 0.8, 'forward flap travel > 45 deg');
  ok(sr.flaps.every(f => Math.abs(f.piv.rotation.y) <= 55 * Math.PI / 180 + 1e-9), 'flap travel within the 55 deg stop'); }
console.log(`articulate: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
