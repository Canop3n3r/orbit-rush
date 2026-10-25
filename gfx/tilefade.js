// f5.9 terrain: the 150 km ground tile (a high-detail cap around the craft) hands off to the globe instead of ending in a round edge.
// Two fades multiply: by altitude (the whole tile dissolves between A0 and A1, so there is no pop when it switches off) and by ground
// distance from the craft's nadir (it dissolves between R0 and R1; R1 stays inside the tile's 150 km radius minus the 25 km re-centre slack).
// gfx.js applies the same maths per fragment (a real blend, only above `swap` altitude; below it the cheaper opaque tile draws).
export const TILE_R = 150000, TILE_SLACK = 25000;
export const TILE_FADE = { r0: 55000, r1: 120000, a0: 14000, a1: 62000, swap: 1500 }; // swap: below this camera altitude the opaque tile is used: its rim (125-150 km out) is at/behind the horizon (sqrt(2*R*h) = 138 km at 1.5 km)
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const tileAltAlpha = h => 1 - ss(TILE_FADE.a0, TILE_FADE.a1, h);                    // 1 near the ground, 0 above ~62 km
export const tileRadAlpha = dh => 1 - ss(TILE_FADE.r0, TILE_FADE.r1, dh);                  // 1 close to the craft, 0 by 120 km of ground range
export const tileAlpha = (h, dh) => tileAltAlpha(h) * tileRadAlpha(dh);
// worst case: the tile is centred up to TILE_SLACK from the craft, so its rim is at least TILE_R - TILE_SLACK from the nadir
export const tileRimAlpha = h => tileAlpha(h, TILE_R - TILE_SLACK);
