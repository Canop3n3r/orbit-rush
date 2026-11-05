// OR-014: on a 390px phone the pad chase camera must put the stack base above the centred navball
// so legs and fins stay readable. Flight keeps the centred navball; this module only returns a pad camera.
import { padChaseFrame, chaseRimY, padFrameActive } from '../gfx/pad_frame.js';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('FAIL', m)); };

const W = 390, H = 844, fov = 55;
// Measured from the f5.9j arch: ~140px ball, centre ~14px above a ~140px bar → navball top ~224px from the bottom.
const free = { top: 56 / H, bottom: 224 / H };
const navTop = 1 - free.bottom;

function fitDist(L, frac) {
  const vf = fov * Math.PI / 180;
  return Math.max(18, L / frac / (2 * Math.tan(vf / 2)));
}

for (const L of [18, 40, 70, 120]) {
  const rad = Math.max(1.2, L * 0.09);
  const f = padChaseFrame({ L, fovDeg: fov, aspect: W / H, screenH: H, free, radius: rad, padPx: 18 });
  const base = chaseRimY({ L, y: 0, dist: f.dist, aim: f.aim, pitch: f.pitch, fovDeg: fov, radius: rad });
  const tip = chaseRimY({ L, y: L, dist: f.dist, aim: f.aim, pitch: f.pitch, fovDeg: fov, radius: 0 });
  ok(base < navTop - 12 / H, `390 h${L}: base ${(base * H).toFixed(1)}px clears navball ${(navTop * H).toFixed(1)}px (gap ${((navTop - base) * H).toFixed(1)})`);
  ok(tip > free.top, `390 h${L}: tip ${(tip * H).toFixed(1)}px stays under the top bar ${(free.top * H).toFixed(1)}px`);
  ok(Math.abs(base - f.baseY) < 3 / H, `390 h${L}: chase rim matches solver (${(base * H).toFixed(2)} vs ${(f.baseY * H).toFixed(2)})`);
  ok(!('navX' in f) && f.aim > 0.02 && f.aim < 0.98, `390 h${L}: camera only, aim ${f.aim.toFixed(3)}`);
}

// Hero legs hang below the stack origin (Heron feet measured ~8 m under the base). The look point has to drop with them.
{
  const drop = 8, L = 70, rad = 4, pts = [];
  for (let i = 0; i < 16; i++) { const a = 2 * Math.PI * i / 16; pts.push([rad * Math.cos(a), -drop, rad * Math.sin(a)]); }
  pts.push([0, L, 0]);
  const ident = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const object = { isObject3D: true, updateMatrixWorld() {}, traverse(fn) { fn({ isMesh: true, visible: true, matrixWorld: { elements: ident }, geometry: { attributes: { position: { count: pts.length, getX: i => pts[i][0], getY: i => pts[i][1], getZ: i => pts[i][2] } } } }); } };
  const f = padChaseFrame({ L, fovDeg: fov, aspect: W / H, screenH: H, free, radius: rad, padPx: 18, object });
  const base = chaseRimY({ L, y: -drop, dist: f.dist, aim: f.aim, pitch: f.pitch, fovDeg: fov, radius: rad });
  ok(f.y0 === -drop, `legs: lowest vertex at ${f.y0} m`);
  ok(base < navTop - 12 / H, `legs: feet ${(base * H).toFixed(1)}px clear the navball ${(navTop * H).toFixed(1)}px (gap ${((navTop - base) * H).toFixed(1)})`);
}
// The old pad framing (aim mid-stack, 60% of the full screen) plants the base on the ball.
{
  const L = 70, rad = L * 0.09;
  const base = chaseRimY({ L, y: 0, dist: Math.min(fitDist(L, 0.6), 420), aim: 0.5, pitch: 0.12, fovDeg: fov, radius: rad });
  ok(base > navTop, `old 390 framing covers the base (${(base * H).toFixed(1)}px > nav ${(navTop * H).toFixed(1)}px)`);
}

// Short landscape phone: the arch still eats the base unless the pad frame lifts it.
{
  const Wl = 844, Hl = 390, freeL = { top: 48 / Hl, bottom: 110 / Hl }, L = 70, rad = L * 0.09;
  const f = padChaseFrame({ L, fovDeg: fov, aspect: Wl / Hl, screenH: Hl, free: freeL, radius: rad, padPx: 12 });
  const base = chaseRimY({ L, y: 0, dist: f.dist, aim: f.aim, pitch: f.pitch, fovDeg: fov, radius: rad });
  ok(base < 1 - freeL.bottom - 8 / Hl, `844x390 base ${(base * Hl).toFixed(1)}px clears navball ${((1 - freeL.bottom) * Hl).toFixed(1)}px`);
}

ok(padFrameActive({ state: 'flight', ignited: false, camMode: 'chase', view: 'vehicle', open: false, trailer: false, userAgoMs: 1e9 }), 'pad, idle, vehicle chase: frame');
ok(!padFrameActive({ state: 'flight', ignited: true, camMode: 'chase', view: 'vehicle', open: false, trailer: false, userAgoMs: 1e9 }), 'in flight the centred navball framing is left alone');
ok(!padFrameActive({ state: 'build', ignited: false, camMode: 'chase', view: 'vehicle', open: false, trailer: false, userAgoMs: 1e9 }), 'home showroom is not the pad chase');
ok(!padFrameActive({ state: 'flight', ignited: false, camMode: 'chase', view: 'vehicle', open: false, trailer: false, userAgoMs: 1000 }), 'a recent drag keeps the player camera');
ok(!padFrameActive({ state: 'flight', ignited: false, camMode: 'chase', view: 'free', open: false, trailer: false, userAgoMs: 1e9 }), 'free camera is not reframed');
ok(!padFrameActive({ state: 'flight', ignited: false, camMode: 'map', view: 'vehicle', open: false, trailer: false, userAgoMs: 1e9 }), 'map is not reframed');

console.log(fail ? `pad_frame: ${fail} FAIL of ${pass + fail}` : `pad_frame: all ok (${pass})`);
process.exit(fail ? 1 : 0);
