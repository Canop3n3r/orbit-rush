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
export function frameRocket({ h: hIn, fovDeg = 40, aspect = 1, free = {}, fill = 0.7, of = 'screen', yaw = 0.6, elev = 0.08, safeTop = 48, padPx = 6, radius, topRadius, bounds, object, profile, screenH = (typeof innerHeight !== 'undefined' ? innerHeight : 844) }) {
  // Real-silhouette projection (QA perf_rockets-3d): never project bbox corners (they sit r*sqrt2 off-axis, outside a round body).
  // object (Object3D): its visible meshes' WORLD-space vertices (sampled, <= ~4000 total) are projected; base = lowest vertex y.
  // bounds (Box3/{min,max}) only: 16 points on the ellipse inscribed in the box at the top and base planes.
  // profile: [[y, r], ...] silhouette rings (m, y from the base), e.g. a blunt/ogive nose; else rings at y=0 (radius) and y=h (topRadius, default = radius, 0 = needle).
  const N = 16, ring = (y, rx, rz = rx, cx = 0, cz = 0) => rx > 0 || rz > 0 ? Array.from({ length: N }, (_, i) => [cx + rx * Math.cos(2 * Math.PI * i / N), y, cz + rz * Math.sin(2 * Math.PI * i / N)]) : [[cx, y, cz]];
  let PTS = null, h = hIn;
  if (object && object.isObject3D) {
    object.updateMatrixWorld(true); const meshes = []; let total = 0;
    object.traverse(o => { if (o.isMesh && o.visible && o.geometry?.attributes?.position) { meshes.push(o); total += o.geometry.attributes.position.count; } });
    const step = Math.max(1, Math.ceil(total / 4000)), raw = [], all = []; let y0 = Infinity, y1 = -Infinity;
    for (const o of meshes) { const pa = o.geometry.attributes.position, e = o.matrixWorld.elements;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), w = e[3] * x + e[7] * y + e[11] * z + e[15], wy = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w;
        y0 = Math.min(y0, wy); y1 = Math.max(y1, wy); all.push([o, i, wy]); } }
    const band = 0.03 * (y1 - y0); // every vertex near the tip / base plane is kept; the rest is sampled
    for (let k = 0; k < all.length; k++) { const [o, i, wy] = all[k]; if (k % step && wy > y0 + band && wy < y1 - band) continue;
      const pa = o.geometry.attributes.position, e = o.matrixWorld.elements, x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), w = e[3] * x + e[7] * y + e[11] * z + e[15];
      raw.push([(e[0] * x + e[4] * y + e[8] * z + e[12]) / w, wy, (e[2] * x + e[6] * y + e[10] * z + e[14]) / w]); }
    if (raw.length) { PTS = raw.map(v => [v[0], v[1] - y0, v[2]]); h = hIn ?? (y1 - y0); }
  }
  if (!PTS && bounds) { const y0 = bounds.min.y; h = hIn ?? (bounds.max.y - y0); const cx = (bounds.min.x + bounds.max.x) / 2, cz = (bounds.min.z + bounds.max.z) / 2, rx = (bounds.max.x - bounds.min.x) / 2, rz = (bounds.max.z - bounds.min.z) / 2;
    PTS = [...ring(0, rx, rz, cx, cz), ...ring(bounds.max.y - y0, rx, rz, cx, cz)]; }
  if (!PTS) { radius ??= 0.09 * h; topRadius ??= radius;
    PTS = [...ring(0, radius), ...(profile ? profile.flatMap(([y, r]) => ring(y, r)) : ring(h, topRadius))]; }
  const TOP = PTS, BASE = PTS; // highest / lowest projected point of the whole silhouette
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
