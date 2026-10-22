// fx-1 (QA f5.5d plumes/fairing): pure helpers for the plasma sheath gate, hull halo gate, vacuum flame puffs,
// smooth (non-random) plume flicker, the post-separation plume fade, and the fairing half kinematics.
import * as FX from '../fxmap.js?v=fx1';
import { halfPose, HALF_LIFE } from '../fun/fairing.js?v=fx1';
import { placeToast } from '../fun/toastzone.js?v=fx1';
import { stageEngines } from '../fun/exhaust.js?v=fx1';
import { landAid } from '../fun/plainhud.js?v=fx1';
let pass = 0, fail = 0; const ok = (c, n) => { c ? pass++ : fail++; console.log(c ? '  ✔' : '  ✘', n); };
// 1. sheath: nothing on a climbing ascent (the "maroon dome" ahead of the Heron-9 upper stage), full on reentry
ok(FX.sheathAlpha(0.06, +1200) === 0, 'no sheath on ascent at weak plasma (48 km, 2 km/s climb)');
ok(FX.sheathAlpha(0.3, +800) === 0, 'no sheath on ascent at moderate plasma');
ok(FX.sheathAlpha(0.04, -500) === 0, 'no sheath below the visible threshold on descent');
ok(FX.sheathAlpha(0.8, -3000) > 0.3, 'strong sheath on a real reentry');
ok(FX.sheathAlpha(0.9, +100) > 0, 'very hot ascent can still glow');
// 2. hull halo: no faint red cylinder from tiny heating
ok(FX.haloAlpha(0.05) === 0, 'no halo for k=0.05'); ok(FX.haloAlpha(0.6) > 0.2, 'halo when the hull really glows');
// 3. flame puffs only in thick air (no white/orange puffs in vacuum)
ok(FX.flamePuffs(1.0) > 0 && FX.flamePuffs(0.05) === 0 && FX.flamePuffs(0.001) === 0, 'flame puffs only in dense air');
// 4. flicker is smooth: small and continuous in time
const f = t => FX.plumeFlicker(t, 0); let maxStep = 0, lo = 9, hi = -9; for (let t = 0; t < 5; t += 1 / 60) { maxStep = Math.max(maxStep, Math.abs(f(t + 1 / 60) - f(t))); lo = Math.min(lo, f(t)); hi = Math.max(hi, f(t)); }
ok(maxStep < 0.02 && lo > 0.9 && hi < 1.1, `smooth flicker (step ${maxStep.toFixed(3)}, ${lo.toFixed(2)}..${hi.toFixed(2)})`);
// 5. after separation the plume length clamp scales the nozzle glow too (no flat sprite with no flame)
ok(FX.glowScaleK(2, 30) < 0.1 && FX.glowScaleK(30, 30) === 1, 'nozzle glow shrinks with a clamped plume');
// 6. liftoff smoke: ground cloud bounded
ok(FX.groundSmokeK(0) <= 1.3 && FX.groundSmokeK(200) === 1, 'ground cloud multiplier bounded and off above 60 m');
// 7. fairing halves: open outward, drift apart, mirror each other, then are retired
const a = halfPose(1.5, +1), b = halfPose(1.5, -1);
ok(a.lat > 2 && b.lat < -2 && Math.abs(a.lat + b.lat) < 1e-9, 'halves move apart symmetrically');
ok(a.ang > 0.5 && Math.abs(a.ang + b.ang) < 1e-9, 'halves hinge outward');
ok(halfPose(0, 1).lat === 0 && halfPose(0, 1).ang === 0, 'halves start closed on the rocket');
ok(halfPose(HALF_LIFE + 1, 1).gone === true && !halfPose(3, 1).gone, 'halves are removed after their life');
// 8. fill-light floor: no black hull in space or in its own shadow, more on phones; daylight unchanged
{ const sp = FX.fillLight(0, 1, 0, false), ph = FX.fillLight(0, 1, 0, true), d = FX.fillLight(1, 0, 1, false);
  ok(sp.hemi >= 0.4 && sp.env >= 0.35, 'space/shadow fill floor'); ok(ph.hemi > sp.hemi && ph.env > sp.env, 'phone gets more fill'); ok(d.hemi === 1 && d.env === 1, 'daylight unchanged'); }
// 9. toasts never cover a telemetry card
{ const hitT = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const card = { x: 10, y: 58, w: 267, h: 74 }, box = { x: 93, y: 100, w: 203, h: 28 }, m = placeToast(box, [card], 600, 390), nb = { ...box, x: box.x + m.dx, y: box.y + m.dy };
  ok(!hitT(nb, card) && m.dy > 0 && m.dx === 0, 'toast moves below the upper card');
  const free = placeToast({ x: 100, y: 10, w: 100, h: 28 }, [card], 600, 390); ok(free.dx === 0 && free.dy === 0, 'toast stays put when clear');
  const tall = { x: 0, y: 0, w: 150, h: 700 }, s2 = placeToast({ x: 100, y: 100, w: 100, h: 28 }, [tall], 600, 390), b2 = { x: 100 + s2.dx, y: 100 + s2.dy, w: 100, h: 28 };
  ok(!hitT(b2, tall), 'no room below: slides beside the card'); }
// 10. parallel boosters (Heron Heavy): side boosters get 9 engines each, the core 9, the upper stage 1 (was 18 / 9)
ok(stageEngines('heron-heavy', 0, []).n === 9, 'Heavy core: 9 engines'); ok(stageEngines('heron-heavy', 1, []).n === 1, 'Heavy upper stage: 1 engine');
ok(stageEngines('heron-heavy', 0, [], true, 2).n === 9, 'Heavy side booster: 9 engines each'); ok(stageEngines('heron-9', 0, []).n === 9 && stageEngines('heron-9', 1, []).n === 1, 'Heron-9 unchanged');
// 11. manual landing aid: only near the ground and falling; burn timing from full-thrust stopping distance
ok(landAid(5000, -50, 20, 9.8) === null && landAid(500, 10, 20, 9.8) === null, 'landing aid hidden high up or climbing');
{ const a = landAid(1000, -100, 20, 9.8), b = landAid(400, -100, 20, 9.8), c = landAid(1000, -50, 5, 9.8);
  ok(a.state === 'wait' && Math.abs(a.burnIn - 5.1) < 0.1 && a.vs === -224, 'burn in ~5 s from 1 km at 100 m/s'); ok(b.state === 'now', 'BURN NOW when the stopping distance is reached'); ok(c.state === 'low' && c.tImp > 0, 'low TWR warning'); }
// 12. fx-3: airflow streaks fade out with altitude (no white streaks at 48 km)
ok(FX.flowStreaks(9000, 1.2, 10000) > 0.9 && FX.flowStreaks(9000, 1.2, 48000) === 0 && FX.flowStreaks(9000, 1.2, 27000) < FX.flowStreaks(9000, 1.2, 20000), 'flow streaks fade above ~22 km, gone by 32 km');
ok(FX.fxState({ q: 9000, mach: 3, machShown: 3, alt: 48000 }).flow === 0, 'fxState: no streaks at 48 km');
console.log(`fx_fix: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
