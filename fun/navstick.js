// f5.5d (Aaron): the navball IS the joystick. One finger (or mouse) drag on the ball = pitch / yaw, same
// directions as the old thumb stick (drag up = pitch over / nose down toward the horizon, drag down = nose up,
// drag right = yaw right). Two-finger twist on the ball = roll. Mouse: Shift+drag or right-drag sideways = roll,
// and Q / E still roll. Springs back to neutral on release.
export const DEAD = 0.1;
const cl = x => Math.max(-1, Math.min(1, x)), dz = v => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
// drag offset (px, screen y down) on a ball of radius R → { pitch, yaw } in the stick's convention
export function dragToStick(dx, dy, R) { const d = Math.hypot(dx, dy), k = d > R ? R / d : 1; return { pitch: -dz(dy * k / R), yaw: -dz(dx * k / R) }; }
// twist between two finger vectors (rad, screen coords) → roll −1..1 (clockwise on screen = roll right), full at 40°
export function twistToRoll(a0, a1) { let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return cl(dz(d / (40 * Math.PI / 180))); }
export function attachNavStick(el, input, { onGrab = () => {}, knob = null } = {}) {
  const P = new Map(); let start = null, tw = null, rollMode = false;
  const R = () => el.getBoundingClientRect().width / 2;
  const reset = () => { input.pitch = input.yaw = input.roll = 0; start = tw = null; if (knob) { knob.style.transform = ''; knob.classList.remove('on'); } el.classList.remove('grab'); };
  el.style.touchAction = 'none';
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture && el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); onGrab();
    el.classList.add('grab'); rollMode = e.pointerType === 'mouse' && (e.shiftKey || e.button === 2);
    if (P.size === 1) start = [e.clientX, e.clientY]; else if (P.size === 2) { const [a, b] = [...P.values()]; tw = Math.atan2(b[1] - a[1], b[0] - a[0]); input.pitch = input.yaw = 0; } });
  el.addEventListener('pointermove', e => { if (!P.has(e.pointerId)) return; P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size >= 2 && tw !== null) { const [a, b] = [...P.values()]; input.roll = twistToRoll(tw, Math.atan2(b[1] - a[1], b[0] - a[0])); return; }
    if (!start) return; const dx = e.clientX - start[0], dy = e.clientY - start[1], r = R();
    if (rollMode) { input.roll = cl(dz(dx / r)); input.pitch = input.yaw = 0; } else { const s = dragToStick(dx, dy, r); input.pitch = s.pitch; input.yaw = s.yaw; }
    if (knob) { const d = Math.hypot(dx, dy), k = d > r ? r / d : 1; knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; knob.classList.add('on'); } });
  const up = e => { if (!P.has(e.pointerId)) return; P.delete(e.pointerId); if (!P.size) reset(); else if (P.size === 1) { tw = null; input.roll = 0; start = [...P.values()][0]; } };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  return { get active() { return P.size > 0; } };
}
