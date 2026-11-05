// Pad → ascent opening camera. Pure, so tests/opening.mjs can run it headlessly.
//
// 0–9 s   slow zoom-out from the pad framing to a wide pose (pad + horizon).
// 9–16 s  smoothstep blend from that wide pose onto the vehicle tracking pose.
// 16 s    the pose equals the track, and the chase camera takes over with no pop.
//
// A playing trailer path (?cine= / __cine) latches the shot as seen and never starts it.
// A player zoom or drag releases it; the caller's distance is left alone.

export const OPEN_ZOOM_S = 9;
export const OPEN_BLEND_S = 7;
export const OPEN_END_S = OPEN_ZOOM_S + OPEN_BLEND_S;
const WIDE_PITCH = 0.05, WIDE_AIM = 0.32;

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function wideDist(length) {
  const L = length > 0 ? length : 40;
  return Math.max(150, Math.min(420, L * 5 + 60));
}

export function trackDist(length) {
  const L = length > 0 ? length : 40;
  return Math.max(30, Math.min(160, L * 2.6 + 20));
}

export function openingPose(t, from, track, length) {
  const zoom = smooth(t / OPEN_ZOOM_S);
  const blend = smooth((t - OPEN_ZOOM_S) / OPEN_BLEND_S);
  const distW = from.dist + (wideDist(length) - from.dist) * zoom;
  const pitchW = from.pitch + (WIDE_PITCH - from.pitch) * zoom;
  const aimW = from.aim + (WIDE_AIM - from.aim) * zoom;
  return {
    dist: distW * (1 - blend) + track.dist * blend,
    pitch: pitchW * (1 - blend) + track.pitch * blend,
    aim: aimW * (1 - blend) + track.aim * blend,
    zoom, blend, done: t >= OPEN_END_S,
  };
}

// Ignition on the pad, vehicle chase, still in the air. One start per flight.
export function openingBegin({ view, mode, alt, orbit }) {
  return view === 'vehicle' && mode === 'chase' && alt < 200 && !orbit;
}

// First ignition frame. A trailer path marks the shot seen so it cannot start when the path stops.
export function openingLatch({ trailer, ignited, seen, begin }) {
  if (!ignited) return { seen: !!seen, start: false };
  if (seen) return { seen: true, start: false };
  if (trailer || !begin) return { seen: true, start: false };
  return { seen: true, start: true };
}

// The scripted pose stops. The caller keeps whatever distance the player just set.
export function openingRelease({ trailer, user, view, mode, orbit }) {
  return !!(trailer || user || view !== 'vehicle' || mode !== 'chase' || orbit);
}
