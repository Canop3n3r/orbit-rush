// Universal time for one universe. UT is seconds since the game epoch. Warp is a requested
// rate; the effective rate is capped by the mode. Physics (a loaded craft) stops at 4×, matching
// the live flight's in-air thrust cap. Rails (everything else coasting) stops at 1e7, the top
// step of flight.js WARPS. Pause is not a warp rate: the floor is 1×.
// This file stays free of the renderer and of page globals so node can run it.

export const PHYSICS_WARP_MAX = 4;
export const RAILS_WARP_MAX = 1e7;
const MODES = new Set(['physics', 'rails']);

const finite = (x, fallback) => {
  const n = +x;
  return Number.isFinite(n) ? n : fallback;
};

export class Clock {
  constructor({ ut = 0, warp = 1, mode = 'physics' } = {}) {
    this.ut = Math.max(0, finite(ut, 0));
    this.warp = Math.min(RAILS_WARP_MAX, Math.max(1, finite(warp, 1)));
    this.mode = MODES.has(mode) ? mode : 'physics';
  }
  get limit() { return this.mode === 'rails' ? RAILS_WARP_MAX : PHYSICS_WARP_MAX; }
  get effective() { return Math.min(this.warp, this.limit); }
  setWarp(rate) {
    this.warp = Math.min(RAILS_WARP_MAX, Math.max(1, finite(rate, 1)));
    return this.effective;
  }
  setMode(mode) {
    if (!MODES.has(mode)) throw new Error('unknown warp mode ' + mode);
    this.mode = mode;
    return this;
  }
  // realSeconds of wall time. Returns how many seconds UT actually moved.
  advance(realSeconds) {
    const dt = finite(realSeconds, 0);
    if (!(dt > 0)) return 0;
    const sim = dt * this.effective;
    this.ut += sim;
    return sim;
  }
  // Jump UT by sim seconds (a rails skip). Warp is unchanged. UT never goes below 0.
  jump(simSeconds) {
    this.ut = Math.max(0, this.ut + finite(simSeconds, 0));
    return this.ut;
  }
  toJSON() { return { ut: this.ut, warp: this.warp, mode: this.mode }; }
  static fromJSON(o) { return new Clock(o || {}); }
}
