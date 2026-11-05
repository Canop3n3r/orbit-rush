// Camera cycle framing (ground / horizon / vehicle / free). Pure: no DOM, no three.js.
// Ground and horizon both keep the planet limb in the frame. Ground zoom-out (larger `zoom`)
// dollies back and opens the lens; zoom-in tightens onto the rocket.

export const CAM_VIEWS = ['ground', 'horizon', 'vehicle', 'free'];

const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Next view in CAM_VIEWS. Ground is skipped once the tripod can no longer see the pad (orbit).
export function nextCamView(cur, groundOk = true) {
  const L = CAM_VIEWS.filter(w => w !== 'ground' || groundOk);
  const i = L.indexOf(cur);
  return L[(i + 1) % L.length];
}

// Angle of the sea-level limb below the local horizontal, from height `alt` metres.
export function horizonDip(alt, R = 6371000) {
  const h = Math.max(0, Number(alt) || 0), r = Math.max(1, R);
  return Math.acos(clamp(r / (r + h), -1, 1));
}

// Elevation (rad, + above the local horizontal) of a point `range` metres over the ground
// and `targetAlt` above the surface, seen from `camH`.
export function elevOf(range, targetAlt, camH, R = 6371000) {
  const r = Math.max(1, R), theta = Math.max(0, range) / r;
  const relZ = (r + targetAlt) * Math.cos(theta) - (r + camH);
  const relX = (r + targetAlt) * Math.sin(theta);
  return Math.atan2(relZ, Math.max(1, relX));
}

// Chase framing. `pitch` is how far the camera sits above the craft (it looks down by that angle).
// Off the pad the limb sits a little above centre so ground fills the lower half.
// In orbit the craft rests on the limb.
export function horizonChase({ alt = 0, R = 6371000, stackL = 40, inOrbit = false, orbitDist = 40, fovDeg = 55 } = {}) {
  const dip = horizonDip(alt, R), fov = Math.max(0.4, fovDeg * DEG), Ls = Math.max(8, stackL || 40);
  const pitch = inOrbit ? clamp(dip * 0.86, 0.06, 1.05) : clamp(dip + 0.12, 0.12, 0.7);
  const dist = inOrbit
    ? clamp(Math.max(orbitDist * 2.4, Ls * 2.2, 80), 80, 900)
    : clamp(Ls * 5.2 + 90, 200, 720);
  const frac = 0.5 - ((-dip) - (-pitch)) / fov; // horizon, fraction down from the top of the frame
  return { pitch, dist, dip, frac, meaningful: frac > 0.28 && frac < 0.64 };
}

// Ground tripod. `zoom` matches the wheel: 1 is the horizon landscape, >1 dollies out, <1 tightens on the rocket.
// north/east are metres from the pad (negative = south / west). horiz is the ground range.
export function groundShot({ zoom = 1, stackL = 40, R = 6371000, rocketAlt = 20, fovCapDeg = 72 } = {}) {
  const z = clamp(zoom, 0.2, 14), Ls = Math.max(8, stackL || 40), r = Math.max(1, R);
  const back = clamp(Math.pow(z, 0.78), 0.35, 8);
  const base = Math.hypot(1700, 900);
  let horiz = base * back;
  const camH = clamp(5 + Math.max(0, z - 1) * 7, 4, 140);
  const dip = horizonDip(camH, r);
  const w = clamp((z - 0.35) / 0.7, 0, 1); // 0 zoomed in, 1 by zoom ≈ 1.05
  const wide = clamp(32 + Math.max(0, z - 1) * 6, 32, fovCapDeg) * DEG;
  const tight = 2 * Math.atan((Ls * 1.35 * clamp(z, 0.35, 1.15)) / Math.max(80, horiz));
  let fov = clamp(tight * (1 - w) + Math.max(tight, wide) * w, 2.5 * DEG, fovCapDeg * DEG);
  if (w > 0.4) {
    const maxElev = Math.min(fov * 0.40, 30 * DEG);
    let lo = horiz, hi = Math.max(horiz, 160000);
    if (elevOf(hi, rocketAlt, camH, r) > maxElev) horiz = hi;
    else {
      for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (elevOf(mid, rocketAlt, camH, r) > maxElev) lo = mid; else hi = mid; }
      horiz = hi;
    }
  }
  const elevR = elevOf(horiz, rocketAlt, camH, r), horizonEl = -dip;
  const targetFrac = 0.40;
  let lookEl = elevR * (1 - w) + (horizonEl - (0.5 - targetFrac) * fov) * w;
  const fitRocket = () => { const half = fov * 0.5 - 0.01; lookEl = clamp(lookEl, elevR - half, elevR + half); };
  fitRocket();
  for (let g = 0; g < 3 && w > 0.45 && Math.abs(horizonEl - lookEl) > fov * 0.46 && fov < fovCapDeg * DEG - 0.01; g++) {
    fov = Math.min(fovCapDeg * DEG, Math.abs(horizonEl - lookEl) / 0.40);
    lookEl = horizonEl - (0.5 - targetFrac) * fov;
    fitRocket();
  }
  const north = -horiz * (1700 / base), east = -horiz * (900 / base);
  const frac = 0.5 - (horizonEl - lookEl) / fov;
  const horizonIn = Math.abs(horizonEl - lookEl) <= fov * 0.5 - 0.006;
  const rocketIn = Math.abs(elevR - lookEl) <= fov * 0.5 + 1e-4;
  const meaningful = horizonIn && rocketIn && frac > 0.18 && frac < 0.70 && fov >= (w > 0.55 ? 24 * DEG : 6 * DEG);
  return { north, east, camH, horiz, lookEl, elevR, dip, fov, fovDeg: fov * 180 / Math.PI, w, horizonIn, rocketIn, frac, meaningful };
}
