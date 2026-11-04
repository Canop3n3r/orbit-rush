// legs-fins-1: moving landing hardware. Landing legs, grid fins and ship flaps are pivots on the model; this module turns the booster /
// ship flight state into target angles (pure, no three.js import, so tests run in node) and eases the pivots toward them every frame.
//   legs:  t 0 stowed flush (foot up) -> 1 deployed, a 120 deg swing down about the base hinge (pivot.rotation.z = -t * LEG_SWING)
//   grid fins: stowed flat along the hull (0) -> deployed out (1) after the boostback / separation coast, then each fin twists about its
//              own span (defl child rotation.y) to steer: commanded by the glide steering vector and the body rates, plus roll trim
//   flaps: forward + aft pairs pivot about their root hinge line (rotation.y of flap_<f|a>_<side>); belly-flop holds them spread, pitch/roll error moves them differentially
export const LEG_SWING = 2 * Math.PI / 3;      // 120 deg
export const FIN_DEPLOY = 88 * Math.PI / 180;  // stowed up -> out from the hull
export const FIN_MAX = 20 * Math.PI / 180;     // steering twist limit
export const FLAP_MAX = 55 * Math.PI / 180;    // flap travel from the fully folded (leeward) stop
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const RATE = { leg: 1 / 5, fin: 1 / 2.0, defl: 1.6, flap: 1.2 }; // per second: legs ~5 s full swing, fins 2 s, twist 1.6 rad/s, flaps 1.2 rad/s

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
/** ship pose: belly-flop (horizontal fall, flaps spread and working), flip (aft flaps fold, forward flaps up), landing (folded). */
export function shipPose(s) {
  const descending = s.state === 'flying' && s.vr < 0 && s.alt < 85000, flip = descending && s.alt < 1200, landed = s.state === 'landed';
  const r = s.rates || [0, 0, 0], base = landed ? 0 : flip ? 0.15 : descending ? 0.55 : 0.1; // fraction of FLAP_MAX
  const pitch = descending && !flip ? clamp(-1.2 * r[0] + 0.12 * Math.sin((s.t || 0) * 1.7), -0.35, 0.35) : 0, roll = descending && !flip ? clamp(-1.5 * r[2], -0.25, 0.25) : 0;
  // per flap: [forward?, side]: pitch moves forward vs aft pairs opposite, roll moves left vs right opposite
  return { flap: (fwd, side) => clamp(base + (fwd ? pitch : -pitch) + side * roll + (flip && fwd ? 0.6 : 0), 0, 1) * FLAP_MAX };
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
    else if (/^flap_(f|a)_(-?1)$/.test(n)) { const m = n.match(/^flap_(f|a)_(-?1)$/); rig.flaps.push({ piv: o, fwd: m[1] === 'f', side: +m[2], rest: o.rotation.y }); }
  });
  // start from the pose the model was built in (a booster whose fins are built open, like the super-heavy's fixed-out fins, keeps them open)
  if (rig.fins.length) { rig.finT = clamp(-rig.fins[0].piv.rotation.z / FIN_DEPLOY, 0, 1); rig.finFixed = rig.finT > 0.9; }
  if (rig.legs.length) rig.legT = clamp(-rig.legs[0].rotation.z / LEG_SWING, 0, 1);
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
  const lt = smooth(rig.legT); for (const l of rig.legs) l.rotation.z = -lt * LEG_SWING;
  for (const f of rig.fins) { f.piv.rotation.z = -smooth(rig.finT) * FIN_DEPLOY;
    const tw = (Math.sin(f.az) * p.steer[0] - Math.cos(f.az) * p.steer[1] + p.roll) * rig.finT; f.defl.rotation.y = ease(f.defl.rotation.y, tw, RATE.defl * dt); }
  return rig;
}
// flaps fold toward the leeward side about their root hinge (local y); the mirrored (side -1) mount turns the other way
export function applyShip(rig, p, dt) { for (const f of rig.flaps) { const cur = -(f.piv.rotation.y - f.rest) * f.side; f.piv.rotation.y = f.rest - f.side * ease(cur, p.flap(f.fwd, f.side), RATE.flap * dt); } return rig; }
const smooth = t => t * t * (3 - 2 * t);
