// legs-fins-1: landing legs, grid fins and flaps really move over a landing timeline (pivot angles change), not just appear.
import { boosterPose, shipPose, rigOf, applyBooster, applyShip, flapRot, flapAngle, FLAP_OUT, LEG_SWING, FIN_DEPLOY, FIN_MAX } from '../gfx/vehicles/articulate.js';
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
ok(at(60).fin > FIN_DEPLOY * 0.99, 'grid fins deployed after the boostback: ' + at(60).fin.toFixed(2));
ok(rec.filter(r => r.alt > 600).every(r => r.leg === 0), 'legs stay folded until the landing burn (600 m)');
ok(Math.abs(rec[rec.length - 1].leg + LEG_SWING) < 1e-6, 'legs end fully deployed: 120 deg swing');
const mids = rec.filter(r => r.leg < 0 && r.leg > -LEG_SWING); ok(mids.length >= 6, 'legs swing over several frames (animated, not a pop): ' + mids.length);
const glide = rec.filter(r => r.alt < 30000 && r.alt > 600), tw = glide.flatMap(r => r.tw);
ok(Math.max(...tw) > 0.03 && Math.min(...tw) < -0.03, 'grid fins twist both ways while steering the descent');
ok(tw.every(x => Math.abs(x) <= FIN_MAX * 1.6 + 1e-9), 'twist within limits');
ok(new Set(glide.map(r => r.tw[0].toFixed(3))).size > 20, 'fin twist keeps changing during the glide');
ok(glide.some(r => Math.abs(r.tw[0] - r.tw[1]) > 0.02), 'fins deflect individually (azimuth mixing)');
// ship flaps: ascent folded, belly-flop working, flip (forward folded / aft out, then reverse), each flap on its own
const fl = [['f', 1], ['f', -1], ['a', 1], ['a', -1]].map(([k, s]) => { const o = O(`flap_${k}_${s}`); o.rotation.y = flapRot(0, s); return o; }); /* built folded flat */ const ship = O('ship', 0, fl); ship.userData = {}; const sr = rigOf(ship);
ok(sr.flaps.length === 4, 'rig finds 4 flaps');
const fr = []; for (let t = 0; t < 400; t += 0.25) { const alt = t < 40 ? 120000 : Math.max(0, 85000 - (t - 40) * 240); applyShip(sr, shipPose({ state: alt > 0 ? 'flying' : 'landed', vr: t < 40 ? 50 : -80, alt, t, rates: [0.08 * Math.sin(t * 0.9), 0, 0.05 * Math.cos(t * 0.6)] }), 0.25); fr.push({ t, alt, a: sr.flaps.map(f => flapAngle(f.piv.rotation.y, f.side)) }); }
const D = Math.PI / 180, all = fr.flatMap(r => r.a);
ok(all.every(x => x >= -1e-9 && x <= FLAP_OUT + 1e-9), 'every flap stays within 0..90 deg');
ok(fr.filter(r => r.t < 40).every(r => r.a.every(x => x < 1e-9)), 'ascent: flaps folded flat');
for (let i = 0; i < 4; i++) { const xs = fr.map(r => r.a[i]); ok(Math.max(...xs) > 85 * D && Math.min(...xs) < 1e-6, `flap ${i} uses the full 0..90 deg travel`); }
const belly = fr.filter(r => r.alt > 2000 && r.alt < 80000 && r.t > 60);
for (let i = 0; i < 4; i++) ok(new Set(belly.map(r => r.a[i].toFixed(3))).size > 40, `flap ${i} keeps moving in the belly-flop (trim + wiggles)`);
{ const xs = belly.flatMap(r => r.a); ok(xs.every(x => x > 15 * D && x < 89.9 * D) && xs.some(x => x < 40 * D) && xs.some(x => x > 70 * D), 'belly-flop: flaps spread and working (15..90 deg, wide trim range)'); }
ok(belly.some(r => Math.abs(r.a[0] - r.a[2]) > 15 * D), 'forward and aft flaps move differentially (pitch)');
ok(belly.some(r => Math.abs(r.a[0] - r.a[1]) > 8 * D), 'left and right flaps move differentially (roll)');
const f1 = fr.filter(r => r.alt < 1300 && r.alt > 900), f2 = fr.filter(r => r.alt < 400 && r.alt > 0);
ok(f1.length && f1[f1.length - 1].a[0] < 10 * D && f1[f1.length - 1].a[2] > 80 * D, 'flip part 1: forward folded, aft out');
ok(f2.length && f2[f2.length - 1].a[0] > 80 * D && f2[f2.length - 1].a[2] < 10 * D, 'flip part 2: the reverse');
ok(Math.abs(flapRot(0, 1) + Math.PI / 2) < 1e-9 && Math.abs(flapRot(FLAP_OUT, -1)) < 1e-9 && Math.abs(flapRot(0, -1) - Math.PI / 2) < 1e-9, 'hinge mapping: folded = 90 deg toward leeward (mirrored per side), out = 0');
// a booster built with its fins open (super-heavy: fixed-out fins) keeps them open; they still twist to steer
{ const f = [0, 1, 2].map(i => { const o = O('gridfin_' + i, 0, [O('lattice')]); o.userData = { yaw: -i }; o.rotation.z = FIN_DEPLOY; return o; }); const m = O('b', 0, f); m.userData = {}; const r = rigOf(m, mk);
  applyBooster(r, boosterPose({ state: 'flying', tSep: 0, alt: 70000, rates: [0.1, 0, 0] }), 0.5); ok(r.fins.every(x => Math.abs(x.piv.rotation.z - FIN_DEPLOY) < 1e-6), 'built-open fins stay open');
  ok(r.fins.every(x => Math.abs(x.piv.rotation.y + f.indexOf(x.piv)) < 1e-9), 'fin azimuth kept'); }
// a baked per-stage swing (Blender deploy_rad) wins over the default 120 deg
{ const l = O('leg_0'); l.userData = { deploy_rad: -1.85 }; const m = O('b', 0, [l]); m.userData = {}; const r = rigOf(m, mk); applyBooster(r, boosterPose({ state: 'landed', alt: 0 }), Infinity); ok(Math.abs(l.rotation.z + 1.85) < 1e-9, 'leg uses its baked swing'); }
// flaps: the hinge is the flap root (local y, x = 0): the root stays put while the tip sweeps metres over the travel
{ const rotY = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)], d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  ok(d(rotY([0, 11, 0], 0), rotY([0, 11, 0], 1.2)) < 1e-9, 'flap root lies on the hinge axis');
  const tip = [5.6, 8.5, 0]; ok(d(rotY(tip, flapRot(0, 1)), rotY(tip, flapRot(FLAP_OUT, 1))) > 7, 'aft flap tip sweeps > 7 m from folded to out');
  ok(rotY(tip, flapRot(0, 1))[2] > 5, 'folded flap lies along +z (leeward) for side +1'); }
// grid fin hinge: a fin hangs down (span -y) when stowed and stands straight out (+x, radial) after the +90 deg hinge
{ const rz = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)], tip = [0, -1.9];
  const s0 = rz(tip, 0), s1 = rz(tip, FIN_DEPLOY); ok(s0[1] < -1.8 && Math.abs(s0[0]) < 1e-9, 'stowed fin hangs down along the hull'); ok(s1[0] > 1.8 && Math.abs(s1[1]) < 1e-9, 'deployed fin stands straight out');
  ok(rec.every(r => r.fin >= -1e-9 && r.fin <= FIN_DEPLOY + 1e-9), 'fin hinge only swings up (0..90 deg)'); }
console.log(`articulate: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
