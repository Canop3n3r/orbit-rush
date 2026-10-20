// Showroom framing (Rocket Art Bot, ui_ideal_path #9). Pure helpers; Game bot wires them into the home camera.
// frameRocket: camera distance + aim height so a rocket of height h (m) fills `fill` (default 0.70) of the screen height
// (of: 'screen', capped at 92% of the free strip) or of the free height (of: 'free'), centred in the free area (portrait: the strip above a bottom sheet; landscape: the area beside a side card).
// free = { top, bottom, left, right } as fractions of the screen covered by UI (e.g. portrait bottom sheet: bottom 0.3).
export function frameRocket({ h, fovDeg = 40, aspect = 1, free = {}, fill = 0.7, of = 'screen', yaw = 0.6, elev = 0.08 }) {
  const top = free.top || 0, bottom = free.bottom || 0, left = free.left || 0, right = free.right || 0;
  const freeH = 1 - top - bottom, freeW = 1 - left - right, vfov = fovDeg * Math.PI / 180;
  // world height visible at distance d is 2 d tan(vfov/2); we want h = fill * freeH * that
  const frac = of === 'screen' ? Math.min(fill, 0.92 * freeH) : fill * freeH; // ~70% of SCREEN height, never more than 92% of the free strip
  let d = h / (frac * 2 * Math.tan(vfov / 2));
  // landscape/narrow free areas: also keep the rocket width (≈ h/12 + pad) inside the free width
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect); d = Math.max(d, (h / 6) / (freeW * 2 * Math.tan(hfov / 2)));
  // shift the aim so the rocket's centre lands in the centre of the free area (view offset in screen fractions)
  const offY = (bottom - top) / 2, offX = (right - left) / 2; // +offY: free area is above centre -> aim lower
  const aimY = h * 0.5 - offY * 2 * d * Math.tan(vfov / 2);
  return { dist: d, aim: [0, aimY, 0], cam: [Math.cos(yaw) * d, aimY + d * Math.sin(elev), Math.sin(yaw) * d], viewOffsetX: offX };
}
// Lighter showroom pad: light concrete, low roughness contrast, no dark slab, so the rocket reads as the hero.
export const SHOWROOM_PAD = { color: 0xc9c4ba, roughness: 0.82, metalness: 0.0, ringColor: 0xdedad2, radiusPerHeight: 0.35, envIntensity: 0.6 };
// usage (main.js, Game bot):
//   const f = frameRocket({ h: VEHICLES[id].height, fovDeg: cam.fov, aspect: cam.aspect, free: portrait ? { bottom: 0.3 } : { right: 0.38 } });
//   cam.position.set(...f.cam); ctl.target.set(...f.aim); padMat.color.setHex(SHOWROOM_PAD.color); padMat.roughness = SHOWROOM_PAD.roughness;
