// legs-fins-1: moving landing hardware. Landing legs, grid fins and ship flaps are pivots on the model; this module turns the booster /
// ship flight state into target angles (pure, no three.js import, so tests run in node) and eases the pivots toward them every frame.
//   legs:  t 0 stowed flush (foot up) -> 1 deployed, a 120 deg swing down about the base hinge (pivot.rotation.z = -t * LEG_SWING)
//   grid fins: stowed hanging down flat on the hull, lattice aft (0) -> hinged up 90 deg to stand out (1) after the boostback / separation coast, then each fin twists about its
//              own span (defl child rotation.y) to steer: commanded by the glide steering vector and the body rates, plus roll trim
//   flaps: forward + aft pairs pivot about their root hinge line (rotation.y of flap_<f|a>_<side>); belly-flop holds them spread, pitch/roll error moves them differentially
export const LEG_SWING = 2 * Math.PI / 3;      // 120 deg
export const FIN_DEPLOY = Math.PI / 2;        // stowed hanging down flat on the hull -> hinged up 90 deg to stand straight out
export const FIN_MAX = 20 * Math.PI / 180;     // steering twist limit
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const RATE = { leg: 1 / 5, fin: 1 / 2.0, defl: 1.6, flap: 1.4 }; // per second: legs ~5 s full swing, fins 2 s, twist 1.6 rad/s, flaps 1.2 rad/s

/** booster pose from its sim state. s: { state, phase, bbDone, legs, alt (m), tSep (s since separation), fin: [x,y,z] glide vector or null,
 *  rates: [pitch, yaw, roll] body rates (rad/s), rtls }  ->  { leg, fin, steer: [pitch, yaw], roll } */
export function boosterPose(s) {
  const landed = s.state === 'landed', flying = s.state === 'flying';
  const leg = landed || (flying && (s.legs || s.alt < 600)) ? 1 : 0;
  // grid fins open once the booster has left the stack: after the boostback (RTLS) or a few seconds into the separation coast
  const out = landed || (flying && (s.bbDone || (!s.rtls && s.tSep > 4) || (s.rtls && s.phase !== 'boostback' && s.tSep > 12) || s.alt < 70000)) ? 1 : 0;
  const r = s.rates || [0, 0, 0], g = s.fin || [0, 0, 0];
  // steering: fins oppose the body rates (rate damping) and follow the glide command; a little buffet in thick air so they never sit dead still
  const q = clamp(1 - s.alt / 40000, 0, 1), buf = flying && out && !landed ? 0.04 * q * Math.sin((s.tSep || 0) * 2.3) : 0;
  const steer = out && !landed ? [clamp(-1.8 * r[0] + 6 * (g[0] || 0) + buf, -FIN_MAX, FIN_MAX), clamp(-1.8 * r[1] + 6 * (g[2] || 0) - buf, -FIN_MAX, FIN_MAX)] : [0, 0];
  const roll = out && !landed ? clamp(-2.5 * r[2], -FIN_MAX * 0.6, FIN_MAX * 0.6) : 0;
  return { leg, fin: out, steer, roll };
}
/** ship flap angles over the descent, per flap (0 = folded flat along the hull .. FLAP_OUT = straight out):
 *  ascent / orbit folded; belly-flop (descending below 85 km) about 55 deg out with differential pitch (forward vs aft) and roll (left vs right)
 *  trim from the body rates plus small per-flap steering wiggles; flip part 1 (below 1.5 km) forward folded and aft out, part 2 (below 700 m)
 *  the reverse; landed folded. s: { state, vr, alt, t, rates } -> { flap(fwd, side) -> rad } */
export const FLAP_OUT = Math.PI / 2;
export function shipPose(s) {
  const desc = s.state === 'flying' && s.vr < 0 && s.alt < 85000, t = s.t || 0, r = s.rates || [0, 0, 0];
  if (!desc) return { flap: () => 0 };
  if (s.alt < 700) return { flap: fwd => (fwd ? FLAP_OUT : 0) };
  if (s.alt < 1500) return { flap: fwd => (fwd ? 0 : FLAP_OUT) };
  const D = Math.PI / 180, pitch = clamp(-1.4 * r[0] + 12 * D * Math.sin(t * 0.45), -20 * D, 20 * D), roll = clamp(-1.6 * r[2] + 8 * D * Math.sin(t * 0.31 + 1), -15 * D, 15 * D);
  return { flap: (fwd, side) => clamp(55 * D + (fwd ? pitch : -pitch) + side * (fwd ? roll : -roll) + 4 * D * Math.sin(t * 2.1 + (fwd ? 0 : 1.7) + side * 0.9), 0, FLAP_OUT) };
}

const RIGS = new WeakMap(); // rig per model, kept off userData (Object3D.clone JSON-copies userData)
const ease = (cur, tgt, step) => cur + clamp(tgt - cur, -step, step);
/** find the movable parts of a built model (staged Blender assets or procedural): leg pivots, grid-fin pivots, flap pivots. */
export function rigOf(model, mkGroup) {
  const hit = RIGS.get(model); if (hit) return hit;
  const rig = { legs: [], fins: [], flaps: [], struts: [], legT: 0, finT: 0 };
  const walk = (o, f) => { if (o.visible === false) return; f(o); for (const c of o.children || []) walk(c, f); }; // hidden copies (the other side booster's half of a split clone) are not ours
  walk(model, o => {
    const n = o.name || '';
    if (/^leg_\d+$/.test(n)) rig.legs.push(o);
    else if (n === 'legstruts') rig.struts.push(o);
    else if (/^gridfin_\d+$/.test(n)) rig.fins.push(finOf(o, mkGroup));
    else if (/^flap_(f|a)_(-?1)$/.test(n)) { const m = n.match(/^flap_(f|a)_(-?1)$/); rig.flaps.push({ piv: o, fwd: m[1] === 'f', side: +m[2] }); }
  });
  // start from the pose the model was built in (a booster whose fins are built open, like the super-heavy's fixed-out fins, keeps them open)
  if (rig.fins.length) { rig.finT = clamp(rig.fins[0].piv.rotation.z / FIN_DEPLOY, 0, 1); rig.finFixed = rig.finT > 0.9; }
  if (rig.legs.length) rig.legT = clamp(-rig.legs[0].rotation.z / legSwing(rig.legs[0]), 0, 1);
  RIGS.set(model, rig); return rig;
}
// a grid fin twists about its span: put its geometry under a 'defl' child so the twist rides on top of the deploy hinge
// mkGroup: () => new THREE.Group() (passed in so this module stays three-free). The pivot's euler is rebuilt from its yaw (like the staged legs),
// so rotation.z is the deploy hinge in the fin's own frame.
function finOf(piv, mkGroup) {
  let d = (piv.children || []).find(c => c.name === 'defl');
  if (!d && mkGroup && !piv.isMesh) { d = mkGroup(); d.name = 'defl'; for (const c of [...piv.children]) d.add(c); piv.add(d); }
  const yaw = piv.userData && piv.userData.yaw != null ? piv.userData.yaw : piv.quaternion ? 2 * Math.atan2(piv.quaternion.y, piv.quaternion.w) : piv.rotation.y; piv.rotation.set(0, yaw, piv.userData && piv.userData.yaw != null ? piv.rotation.z : 0);
  return { piv, defl: d || { rotation: { y: 0 } }, az: -yaw }; // az: fin azimuth around the hull (pivots were placed with rot_y = -a)
}
/** ease the rig toward a booster pose; dt in seconds (dt = Infinity snaps). Returns the rig. */
export function applyBooster(rig, p, dt) {
  const l0 = rig.legT; rig.legT = ease(rig.legT, p.leg, RATE.leg * dt); rig.legMoved = rig.legT !== l0 || rig.legMoved === undefined; rig.finT = ease(rig.finT, rig.finFixed ? 1 : p.fin, RATE.fin * dt);
  const lt = smooth(rig.legT); for (const l of rig.legs) l.rotation.z = -lt * legSwing(l);
  for (const f of rig.fins) { f.piv.rotation.z = smooth(rig.finT) * FIN_DEPLOY;
    const tw = (Math.sin(f.az) * p.steer[0] - Math.cos(f.az) * p.steer[1] + p.roll) * rig.finT; f.defl.rotation.y = ease(f.defl.rotation.y, tw, RATE.defl * dt); }
  return rig;
}
// flap hinge: angle a (0 folded flat toward the leeward side .. 90 deg out) -> rotation.y = -side * (90 deg - a); the mirrored mount turns the other way
export const flapRot = (a, side) => -side * (FLAP_OUT - a);
export const flapAngle = (rotY, side) => FLAP_OUT + rotY * side;
export function applyShip(rig, p, dt) { for (const f of rig.flaps) f.piv.rotation.y = flapRot(ease(flapAngle(f.piv.rotation.y, f.side), p.flap(f.fwd, f.side), RATE.flap * dt), f.side); return rig; }
/** a leg's full swing: the Blender kit bakes it per stage (deploy_rad extra: feet land 1-2 m below the bells), else 120 deg */
export const legSwing = l => (l.userData && Number.isFinite(l.userData.deploy_rad) ? Math.abs(l.userData.deploy_rad) : LEG_SWING);
const smooth = t => t * t * (3 - 2 * t);
