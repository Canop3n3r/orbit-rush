// f5.9-31 (OR-014): pad chase framing only. The flight HUD keeps its centred navball.
// On the pad the stack is fitted into the strip above that ball so the base (legs, fins) is readable.
import { frameRocket, projectY } from './showroom_frame.js';

const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// Points are already in chase space: x toward the camera, y along the nose, z sideways.
export function pointsObject(pts) {
  return { isObject3D: true, updateMatrixWorld() {}, traverse(fn) { fn({ isMesh: true, visible: true, matrixWorld: { elements: IDENT }, geometry: { attributes: { position: { count: pts.length, getX: i => pts[i][0], getY: i => pts[i][1], getZ: i => pts[i][2] } } } }); } };
}

// Screen y as a fraction from the top (0 top .. 1 bottom) of the lowest point on a ring of `radius`
// at height y, under the flight chase camera (local up +Y, yaw 0.5, lookAt L*aim).
export function chaseRimY({ L, y, dist, aim, pitch, yaw = 0.5, fovDeg = 55, radius = 0 }) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch), aimY = (L || 0) * aim;
  const cam = [Math.sin(yaw) * cp * dist, aimY + sp * dist, Math.cos(yaw) * cp * dist];
  const aimP = [0, aimY, 0];
  if (!(radius > 0)) return projectY(cam, aimP, [0, y, 0], fovDeg);
  const hl = Math.hypot(cam[0], cam[2]) || 1, nx = cam[0] / hl, nz = cam[2] / hl, px = -nz, pz = nx;
  let low = -Infinity;
  for (let i = 0; i < 32; i++) {
    const a = 2 * Math.PI * i / 32, c = Math.cos(a), s = Math.sin(a);
    low = Math.max(low, projectY(cam, aimP, [(nx * c + px * s) * radius, y, (nz * c + pz * s) * radius], fovDeg));
  }
  return low;
}

// Lowest world-Y of a mesh whose local +Y is the nose and whose origin is the stack base.
// Legs and fins on the hero sit several metres below that origin; framing y=0 hides them behind the ball.
function lowestY(object) {
  let y0 = Infinity;
  object.updateMatrixWorld?.(true);
  object.traverse(o => {
    const pa = o.isMesh && o.visible && o.geometry?.attributes?.position; if (!pa) return;
    const e = o.matrixWorld.elements;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1;
      const wy = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w; if (wy < y0) y0 = wy;
    }
  });
  return Number.isFinite(y0) ? y0 : 0;
}
// dist / aim / pitch for the chase camera. aim is the fraction of stack length above the stack origin
// (negative when the look point is down among the legs). free.top / free.bottom are screen fractions
// covered by the top bar and by the navball, measured from the ball's top edge.
export function padChaseFrame({ L, fovDeg = 55, aspect = 1, screenH = 844, free = {}, elev = 0.12, padPx = 18, radius, object } = {}) {
  const h = Math.max(4, +L || 40);
  const top = Math.max(0, Math.min(0.45, free.top || 0));
  let bottom = Math.max(0, Math.min(0.72, free.bottom || 0));
  if (top + bottom > 0.82) bottom = Math.max(0, 0.82 - top);
  const y0 = object?.isObject3D ? lowestY(object) : 0;
  const f = frameRocket({
    h, radius: radius ?? Math.max(1.2, h * 0.09), topRadius: 0, object,
    fovDeg, aspect, screenH, free: { top, bottom, left: free.left || 0, right: free.right || 0 },
    elev, yaw: 0, padPx, fill: 0.9, of: 'free', safeTop: 0,
  });
  const se = Math.sin(elev), aimM = f.aim[1] + y0; // solver aim is above the feet; flight aim is above the origin
  return { dist: f.dist * Math.hypot(1, se), aim: Math.max(-0.4, Math.min(1.2, aimM / h)), pitch: Math.atan(se), tipY: f.tipY, baseY: f.baseY, y0 };
}

// True only while the vehicle chase is sitting on the pad and the player has not just grabbed it.
export function padFrameActive({ state, ignited, camMode, view, open, trailer, userAgoMs }) {
  if (state !== 'flight' || ignited || camMode !== 'chase' || open || trailer) return false;
  if (view && view !== 'vehicle') return false;
  if (!(userAgoMs >= 8000)) return false;
  return true;
}
