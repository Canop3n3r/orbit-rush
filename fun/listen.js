// OR-005: engine sound for the air you are actually in.
// The flight camera used to ask Earth's atmosphere for a pressure ratio of (distance from the Earth's centre
// minus Earth's radius). On the Moon that height is largely negative, and the Earth model clamps a negative
// height to sea level, so the engines roared in vacuum. Ratio is ambient pressure / Earth sea-level pressure.
// Airless bodies are 0: a low internal rumble, the same curve Earth already uses above its atmosphere.
import { P0 } from '../physics/constants.js?v=f5.9-27';
import { atmosphere } from '../physics/atmosphere.js?v=f5.9-27';
import { BODIES, bodyAtm } from '../physics/solar.js?v=f5.9-27';

export const airlessBody = id => { const b = BODIES[id || 'earth']; return !b || !b.atm; };

export function ambientPressureRatio(body, z) {
  const id = body || 'earth';
  if (id === 'earth') return atmosphere(z).p / P0; // Earth path unchanged, including z < 0 → sea level
  if (airlessBody(id)) return 0;
  const atm = bodyAtm(id, z);
  return (atm && atm.p ? atm.p : 0) / P0;
}

// Camera distance times the air the engines are in. Map view is a fixed quiet bed.
// The ground camera falls off fast (it leaves the rocket). The chase camera stays full until ~250 m, then eases.
// vacK is engineListen().vacK: sea level ~1, vacuum ~0.1. The product is the flight-bus gain.
export function flightLoudness(camD, { map = false, ground = false, vacK = 1 } = {}) {
  const d = Math.max(0, +camD || 0), air = vacK > 0 ? vacK : 0;
  const distK = map ? 0.35 : ground ? 1 / (1 + Math.pow(d / 600, 1.5)) : 1 / (1 + Math.max(0, d - 250) / 2500);
  return { distK, vacK: air, gain: distK * air };
}

// p is ambient / Earth sea level and is not clamped: a thick atmosphere stays at the roar end of this curve,
// and the flight loop already caps the resulting gains. Vacuum (p = 0) keeps the 0.25 internal rumble at 150 Hz.
export function engineListen(p) {
  const pr = p > 0 ? p : 0;
  return {
    vacK: 0.1 + 0.9 * Math.sqrt(Math.min(1, pr * 3)),
    rumble: 0.25 + 0.75 * pr,
    hz: 150 + 500 * pr,
    crack: (0.3 + 0.7 * pr) * 0.5,
  };
}
