// f5.6h (Aaron): trackball navball. The nose marker stays at ball center; dragging rotates the sphere under the
// finger and the target attitude is the direction the ball now shows at center.
import { aoaLimit, limitToPrograde, dragRotate, twistRotate, shiftRoll, frameOf, ghostAngle } from '../fun/navstick.js';
import { rollError } from '../physics/control.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
// ship frame: nose +x (east), top +z (sky), right = top × nose = +y
const F = frameOf([1, 0, 0], [0, 0, 1]); const R = 60;
t(near(dot(F.r, [0, 1, 0]), 1), 'frame: right = top × nose (screen right)');
{ const g = dragRotate(F, 0, 30, R); t(dot(g.n, F.t) > 0.4 && near(Math.acos(dot(g.n, F.n)), 0.5), 'drag down (horizon down) = nose pitches UP toward the top, 1 rad per ball radius'); t(near(dot(g.n, g.t), 0) && near(Math.hypot(...g.n), 1), 'target frame stays orthonormal'); }
{ const g = dragRotate(F, 0, -30, R); t(dot(g.n, F.t) < -0.4, 'drag up = nose pitches DOWN'); }
{ const g = dragRotate(F, 30, 0, R); t(dot(g.n, F.r) < -0.4 && near(dot(g.n, F.t), 0), 'drag right = the sphere turns right, the left side comes to center = yaw LEFT (no pitch)'); }
{ const g = dragRotate(F, -30, 0, R); t(dot(g.n, F.r) > 0.4, 'drag left = yaw right'); }
{ const g = dragRotate(F, 0, 0, R); t(near(dot(g.n, F.n), 1) && near(dot(g.t, F.t), 1), 'no drag = no change'); }
{ const g = dragRotate(dragRotate(F, 0, 15, R), 0, 15, R), h = dragRotate(F, 0, 30, R); t(near(dot(g.n, h.n), 1, 1e-9), 'incremental drags add up (pure pitch)'); }
{ const g = twistRotate(F, 0.3); t(near(dot(g.n, F.n), 1) && dot(g.t, F.r) < -0.25, 'twist clockwise on screen = ball turns clockwise = ship top rolls LEFT; nose unchanged'); }
{ const g = shiftRoll(F, 30, R); t(near(dot(g.n, F.n), 1) && dot(g.t, F.r) < -0.25, 'Shift-drag right = same as a clockwise twist'); }
{ const g = dragRotate(F, 0, 30, R); t(near(ghostAngle(F, g), 0.5, 1e-6), 'ghost: angle between the target and the current nose'); }
// SAS roll hold sign: positive error = rotate about +nose (right-hand) to reach the target top
{ const tgt = twistRotate(F, 0.3).t; const e = rollError(F.n, F.t, tgt); t(near(e, 0.3, 1e-6), 'rollError: the target top rolled left = +0.3 rad about the nose (right-hand)'); }
{ const L = aoaLimit(30000, 12000); t(near(L, 0.2) && aoaLimit(0.5, 12000) === Math.PI && aoaLimit(1e7, 12000) === 0.02, 'AoA limit: 0.5·QALPHA/q (0.2 rad at 30 kPa), free in vacuum, ≥ 0.02 rad');
  const pro = [0, 0, 1], n = [1, 0, 0], r = limitToPrograde(n, pro, 0.2); t(r.limited && near(Math.acos(dot(r.n, pro)), 0.2) && r.n[0] > 0, 'limitToPrograde: a 90° lean is pulled back to 0.2 rad, same side');
  t(!limitToPrograde([0, 0.1, 0.995], pro, 0.2).limited, 'a small lean passes untouched'); }
console.log(`navstick: ${p} passed, ${f} failed`); process.exit(f ? 1 : 0);
