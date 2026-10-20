// Showroom framing (Rocket Art Bot, ui_ideal_path #9). Pure helpers; Game bot wires them into the home camera.
// frameRocket: camera distance + aim height so a rocket of height h (m) fills `fill` (default 0.70) of the screen height
// (of: 'screen', capped at the free strip below the top safe area) or of the free height (of: 'free'), centred in the free area (portrait: the strip above a bottom sheet; landscape: the area beside a side card).
// free = { top, bottom, left, right } as fractions of the screen covered by UI (e.g. portrait bottom sheet: bottom 0.3).
// safeTop (px, default 48 or env(safe-area-inset-top) if larger) / screenH (px): the rocket tip never goes above that line.
// Note: portrait with a 30% bottom sheet + 48 px leaves 64% free on 390x844, so 70% needs a sheet of <= ~24% (free.bottom 0.24).
export function safeAreaTopPx() { if (typeof document === 'undefined') return 0; const d = document.createElement('div'); d.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);visibility:hidden'; document.body.appendChild(d); const v = d.getBoundingClientRect().height; d.remove(); return v; }
// Exact solve (QA rockets-3b): the camera sits above the aim (elev), so the tip/base do NOT project symmetrically.
// We project the real points (nose tip on the axis, and the base rim on the camera side, radius = `radius` m, default
// 0.09 h ~ heron-heavy half-width) with the same pinhole maths as THREE.PerspectiveCamera.lookAt and iterate dist + aim
// until tip and base land exactly on their screen targets. padPx keeps the base off the bottom sheet.
export function projectY(cam, aim, p, fovDeg) { // screen y as a fraction from the top (0 top .. 1 bottom), lookAt(aim) with world up +Y
  const f = norm(sub(aim, cam)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), v = sub(p, cam);
  return (1 - dot(v, u) / dot(v, f) / Math.tan(fovDeg * Math.PI / 360)) / 2; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm = a => { const l = Math.hypot(...a); return a.map(x => x / l); };
export function frameRocket({ h: hIn, fovDeg = 40, aspect = 1, free = {}, fill = 0.7, of = 'screen', yaw = 0.6, elev = 0.08, safeTop = 48, padPx = 6, radius, topRadius, bounds, object, screenH = (typeof innerHeight !== 'undefined' ? innerHeight : 844) }) {
  // bounds: a THREE.Box3 / {min,max} in rocket space (base at min.y), or object (Object3D: its world Box3 is taken).
  // With bounds all 8 corners are projected (blunt/flat tops, wide bases); else the bbox corners of round bodies of radius (base) / topRadius (top), default 0.09 h.
  if (object && !bounds && object.isObject3D) { object.updateMatrixWorld(true); const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; object.traverse(o => { if (!o.isMesh || !o.visible) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (let i = 0; i < 8; i++) { const v = b.min.clone().set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld); for (const [k, a] of ['x', 'y', 'z'].entries()) { mn[k] = Math.min(mn[k], v[a]); mx[k] = Math.max(mx[k], v[a]); } } }); bounds = { min: { x: mn[0], y: mn[1], z: mn[2] }, max: { x: mx[0], y: mx[1], z: mx[2] } }; }
  let h = hIn; if (bounds) h = h ?? (bounds.max.y - bounds.min.y); // bounds assumed to have base at min.y; corners projected relative to it
  if (bounds) { const y0 = bounds.min.y; bounds = { min: { ...bounds.min, y: 0 }, max: { ...bounds.max, y: bounds.max.y - y0 } }; }
  radius ??= bounds ? Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z)) : 0.09 * h;
  topRadius ??= radius; // blunt/flat-top safe default; pass topRadius: 0 for a needle nose
  const ring = (y, r) => r > 0 ? [[r, y, r], [r, y, -r], [-r, y, r], [-r, y, -r]] : []; // bbox corners of a round body of radius r (matches full-mesh-bounds measurement)
  const corners = y => [0, 1, 2, 3].map(i => [i & 1 ? bounds.max.x : bounds.min.x, y, i & 2 ? bounds.max.z : bounds.min.z]);
  const TOP = bounds ? corners(h) : [[0, h, 0], ...ring(h, topRadius)], BASE = bounds ? corners(0) : [[0, 0, 0], ...ring(0, radius)];
  const safe = Math.max(safeTop, safeAreaTopPx()) / screenH, pad = padPx / screenH;
  const top = Math.max(free.top || 0, safe), bottom = (free.bottom || 0) + pad, left = free.left || 0, right = free.right || 0;
  const freeH = 1 - top - bottom, freeW = 1 - left - right, vfov = fovDeg * Math.PI / 180, T = Math.tan(vfov / 2);
  const frac = of === 'screen' ? Math.min(fill, freeH) : fill * freeH; // 70% of SCREEN height when the free strip allows it, else the whole strip
  const c = top + freeH / 2, tipT = c - frac / 2, baseT = c + frac / 2;
  const hfov = 2 * Math.atan(T * aspect), dMinW = (h / 6) / (freeW * 2 * Math.tan(hfov / 2)); // keep rocket width (≈ h/12 + pad) inside the free width
  let d = h / (frac * 2 * T), aimY = h / 2, cam, tip, base;
  const at = () => { cam = [Math.cos(yaw) * d, aimY + d * Math.sin(elev), Math.sin(yaw) * d]; const aim = [0, aimY, 0];
    tip = Math.min(...TOP.map(p => projectY(cam, aim, p, fovDeg))); base = Math.max(...BASE.map(p => projectY(cam, aim, p, fovDeg))); }; // highest top point, lowest base point
  for (let i = 0; i < 60; i++) { at(); const span = base - tip; d = Math.max(dMinW, d * span / frac); at(); const e = (tip + base) / 2 - c; aimY -= e * 2 * d * T; if (Math.abs(e) < 1e-6 && Math.abs(base - tip - frac) < 1e-6) break; }
  if (d === dMinW) { at(); const e = (tip + base) / 2 - c; aimY -= e * 2 * d * T; } // width-limited: keep it centred in the strip
  at(); const offX = (right - left) / 2;
  return { dist: d, aim: [0, aimY, 0], cam, viewOffsetX: offX, tipY: tip, baseY: base };
}
// Lighter showroom pad: light concrete, low roughness contrast, no dark slab, so the rocket reads as the hero.
export const SHOWROOM_PAD = { color: 0xc9c4ba, roughness: 0.82, metalness: 0.0, ringColor: 0xdedad2, radiusPerHeight: 0.35, envIntensity: 0.6 };
// usage (main.js, Game bot):
//   const f = frameRocket({ h: VEHICLES[id].height, fovDeg: cam.fov, aspect: cam.aspect, free: portrait ? { bottom: 0.24 } : { right: 0.38 }, screenH: innerHeight }); // safeTop defaults to 48 px / env(safe-area-inset-top)
//   cam.position.set(...f.cam); ctl.target.set(...f.aim); padMat.color.setHex(SHOWROOM_PAD.color); padMat.roughness = SHOWROOM_PAD.roughness;
