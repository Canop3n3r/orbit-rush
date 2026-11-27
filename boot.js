// Desktop boot and quality decisions. No DOM and no three, so tests/desktop.mjs can run them under node.
// A real GPU starts at med. A software GPU stays low. ?gfx=, ?fx= and a saved choice still win.
import { GFX } from './gfx/presets.js?v=f5.9-27';
import { QUALITY, QUALITY_ORDER } from './fxmap.js?v=f5.9-32';

export const BOOT_CAP_MS = 12000;
export const RENDERER_INIT_MS = 8000;
const PIX_FLOOR = 0.6;
const PIX_STEP = 0.25;

/** Query and saved choice win. Software GPUs stay low. Desktop and touch both start at med. */
export function chooseGfx(stored, param, software) {
  if (GFX[param]) return param;
  if (GFX[stored]) return stored;
  return software ? 'low' : 'med';
}

/** Query and saved choice win. Otherwise med, on desktop and on touch. */
export function chooseFx(stored, param) {
  if (QUALITY[param]) return param;
  if (QUALITY[stored]) return stored;
  return 'med';
}

/** Near LOD is the mid (phone) build unless this is a desktop session on graphics High. */
export function lodPhone(gfxQ, touch) {
  return !!touch || gfxQ !== 'high';
}

/**
 * One rung after the frame rate has been low (slowT > 2), on Home or in any other state.
 * Effects quality first, then bloom, then pixel ratio.
 * ?fx= locks effects. ?gfx= locks bloom.
 */
export function qualityLadderStep({ slowT, fxQ, fxLocked, bloomOn, gfxPinned, pixR }) {
  if (!(slowT > 2)) return null;
  const i = QUALITY_ORDER.indexOf(fxQ);
  if (!fxLocked && i > 0) return { kind: 'fx', q: QUALITY_ORDER[i - 1] };
  if (!fxLocked && i === 0 && bloomOn && !gfxPinned) return { kind: 'bloom' };
  if (pixR > PIX_FLOOR) return { kind: 'pixel', pixR: Math.max(PIX_FLOOR, +(pixR - PIX_STEP).toFixed(4)) };
  return null;
}

export function withTimeout(work, ms, label = 'timeout') {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), ms); });
  const run = typeof work === 'function' ? Promise.resolve().then(work) : Promise.resolve(work);
  return Promise.race([run, timeout]).finally(() => clearTimeout(timer));
}

/** Init the first renderer. On a throw or a timeout, dispose it and init one with forceWebGL: true. */
export async function initRenderer(create, { timeoutMs = RENDERER_INIT_MS } = {}) {
  let primary = null;
  try {
    primary = create({ forceWebGL: false });
    await withTimeout(() => primary.init(), timeoutMs, 'renderer init timeout');
    return primary;
  } catch (e) {
    try { if (primary && primary.dispose) primary.dispose(); } catch (e2) {}
    const gl = create({ forceWebGL: true });
    await withTimeout(() => gl.init(), timeoutMs, 'renderer init timeout');
    gl.fallbackReason = e && e.message || String(e);
    return gl;
  }
}

/** The boot card stays up until a frame has presented, compileAsync settles, or the cap. */
export function waitToShowHome({ compile, frame, capMs = BOOT_CAP_MS }) {
  return new Promise(resolve => {
    let done = false;
    const finish = why => { if (done) return; done = true; clearTimeout(timer); resolve(why); };
    const timer = setTimeout(() => finish('cap'), capMs);
    Promise.resolve(compile).then(() => finish('compile'), () => finish('compile'));
    Promise.resolve(frame).then(() => finish('frame'), () => finish('frame'));
  });
}
