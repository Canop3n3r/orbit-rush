// f5.6h (Aaron): direct-manipulation (trackball) navball. The rocket's nose marker is ALWAYS at ball center.
// Grab the ball and drag: the sphere turns under your finger like a trackball (drag the horizon down = pitch up,
// drag sideways = yaw: the side you drag away from comes to center). Two-finger twist turns the ball about center
// = roll (mouse: Shift-drag or right-drag sideways). The direction the ball now shows at center becomes a TARGET
// attitude that SAS / the booster hold flies to; the ball keeps showing the CURRENT attitude with a ghost of the
// target until it catches up. Frames are world unit vectors: n = nose (out of the screen), t = ship top (screen
// up), r = right (screen right) = t × n.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const comb = (a, x, b, y) => [a[0] * x + b[0] * y, a[1] * x + b[1] * y, a[2] * x + b[2] * y];
export function frameOf(n, t) { n = nrm(n); t = nrm(comb(t, 1, n, -dot(t, n))); return { n, t, r: cross(t, n) }; }
// drag (px, screen y down) on a ball of radius R: the point that was at (−dx, −dy) from center comes to center
// (1 ball radius of drag = 1 rad). Returns the new target frame.
export function dragRotate(F, dx, dy, R) { const d = Math.hypot(dx, dy); if (d < 1e-9) return frameOf(F.n, F.t);
  const th = d / R, w = comb(F.r, -dx / d, F.t, dy / d), c = Math.cos(th), s = Math.sin(th);
  const tw = dot(F.t, w); return frameOf(comb(F.n, c, w, s), comb(F.t, 1, comb(w, (c - 1) * tw, F.n, -s * tw), 1)); } // rotation in the (n, w) plane
// clockwise twist φ (rad, screen) = the ball turns clockwise about center = the ship rolls the other way
export function twistRotate(F, phi) { const c = Math.cos(phi), s = Math.sin(phi); return frameOf(F.n, comb(F.r, -s, F.t, c)); }
export const shiftRoll = (F, dx, R) => twistRotate(F, dx / R);
export const ghostAngle = (F, G) => Math.acos(Math.max(-1, Math.min(1, dot(F.n, G.n))));
// el: the ball element. cur(): current frame {n,t}; target(): the held target frame or null; onTarget(frame) sets it.
export function attachNavStick(el, { cur, target = () => null, onTarget, onGrab = () => {}, roll = true, mirrorX = false } = {}) { // mirrorX: balls drawn with east on the right (the split mini balls)
  const P = new Map(); let last = null, tw = null, rollMode = false, G = null;
  const R = () => el.getBoundingClientRect().width / 2;
  const reset = () => { last = tw = null; G = null; el.classList.remove('grab'); };
  const base = () => { const t = target(), c = cur(); return t ? frameOf(t.n, t.t) : c ? frameOf(c.n, c.t) : null; };
  el.style.touchAction = 'none';
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture && el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); onGrab();
    el.classList.add('grab'); rollMode = roll && e.pointerType === 'mouse' && (e.shiftKey || e.button === 2); if (!G) G = base();
    if (P.size === 1) last = [e.clientX, e.clientY]; else if (P.size === 2) { const [a, b] = [...P.values()]; tw = Math.atan2(b[1] - a[1], b[0] - a[0]); } });
  el.addEventListener('pointermove', e => { if (!P.has(e.pointerId)) return; P.set(e.pointerId, [e.clientX, e.clientY]); if (!G) G = base(); if (!G) return;
    if (P.size >= 2 && tw !== null) { if (!roll) return; const [a, b] = [...P.values()], a1 = Math.atan2(b[1] - a[1], b[0] - a[0]); let d = a1 - tw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; tw = a1; G = twistRotate(G, d); onTarget(G); return; }
    if (!last) return; const dx = (e.clientX - last[0]) * (mirrorX ? -1 : 1), dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; if (!dx && !dy) return;
    G = rollMode || (roll && e.shiftKey && e.pointerType === 'mouse') ? shiftRoll(G, dx, R()) : dragRotate(G, dx, dy, R()); onTarget(G); });
  const up = e => { if (!P.has(e.pointerId)) return; P.delete(e.pointerId); if (!P.size) reset(); else if (P.size === 1) { tw = null; last = [...P.values()][0]; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  return { get active() { return P.size > 0; } };
}
// f5.6h (QA P1: a navball drag tore Heron-9 apart at 2.6 km): at high dynamic pressure the target nose may lean at
// most aoaMax = k·QALPHA/q from prograde (k = 0.5 keeps half the structural margin). Returns { n, limited }.
export function aoaLimit(q, qAlphaMax, k = 0.5) { return q > 1 ? Math.min(Math.PI, Math.max(0.02, k * qAlphaMax / q)) : Math.PI; }
export function limitToPrograde(n, pro, aoaMax) { const c = Math.max(-1, Math.min(1, dot(n, pro))), a = Math.acos(c); if (a <= aoaMax || !pro) return { n, limited: false };
  let w = comb(n, 1, pro, -c); const l = Math.hypot(...w); if (l < 1e-9) w = Math.abs(pro[0]) < 0.9 ? cross(pro, [1, 0, 0]) : cross(pro, [0, 1, 0]); w = nrm(w);
  return { n: nrm(comb(pro, Math.cos(aoaMax), w, Math.sin(aoaMax))), limited: true }; }
