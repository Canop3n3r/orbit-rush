// f5 world-1 quality tiers for clouds + surfaces. Pure data (unit-testable in node).
// steps = primary raymarch samples, light = sun-ward samples per step, detail = surface detail-normal octaves.
export const WORLD_TIERS = {
  high: { volumetric: true, steps: 20, light: 2, detail: 3, shadows: true, scale: 1 },
  med:  { volumetric: true, steps: 14, light: 1, detail: 2, shadows: true, scale: 1 },
  low:  { volumetric: false, steps: 0, light: 0, detail: 1, shadows: true, scale: 1 }, // phones / software GPUs: 2D cloud layer
};
export const CLOUD_LAYER = { base: 1.6, top: 9.0 }; // km above sea level (cumulus base .. towering tops)
// map the game's gfx preset (GX.GFX keys: low/med/high) + touch to a world tier. Phones never raymarch.
export function worldTier(gfxQ, touch) { if (touch || gfxQ === 'low') return 'low'; return gfxQ === 'high' ? 'high' : 'med'; }
// equirect UV <-> unit direction, matching THREE.SphereGeometry (u = atan2(z,-x)/2pi, v = 1 - theta/pi)
export function lonLatToDir(lonDeg, latDeg) { const u = (lonDeg + 180) / 360, v = (latDeg + 90) / 180, phi = u * 2 * Math.PI, th = (1 - v) * Math.PI;
  return [-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th)]; }
