// Trailer capture hooks (f5.9-30). Pure: URL flags, cine keyframes, quiet warp, deploy scale, arrival orbits.
// main.js installs window.__cine / window.__orAudio and applies a sample in the flight camera. Nothing here runs unless a URL flag or the console API asks.
//
// Query: trailer=1 · hud=0 | clean=1 · cine=orbit|dolly|crane|payload · warp=<multiplier>
//        deploy=<speed 1=normal, 0.25=slower> · deploySize=<mesh scale> · epoch=ISO · tod=HH:mm
//        site=<id> | body:id · at=moon|mars|venus · atAlt=<metres> · music=space | score=1
// Console: __cine.play(name|keys|{keys,duration,loop,look}) · stop() · hold({dist,yaw,pitch,aim,fov,look})
//          seek(t) · fov(deg) · sample(dt) · warp(mult) · clean(on) · deploy({speed,size}) · status()
//          __orAudio.gain(0..1) · __orAudio.score(on)

export const PRESETS = {
  orbit: { name: 'orbit', duration: 24, loop: true, look: 'stack', keys: [
    { t: 0, dist: 90, yaw: 0.4, pitch: 0.22, aim: 0.48, fov: 32 },
    { t: 24, dist: 90, yaw: 0.4 + Math.PI * 2, pitch: 0.22, aim: 0.48, fov: 32 }] },
  dolly: { name: 'dolly', duration: 12, loop: false, look: 'stack', keys: [
    { t: 0, dist: 260, yaw: 0.15, pitch: 0.08, aim: 0.42, fov: 42 },
    { t: 12, dist: 36, yaw: 0.55, pitch: 0.2, aim: 0.55, fov: 22 }] },
  crane: { name: 'crane', duration: 14, loop: false, look: 'stack', keys: [
    { t: 0, dist: 140, yaw: 0.9, pitch: -0.05, aim: 0.35, fov: 36 },
    { t: 14, dist: 180, yaw: 1.4, pitch: 0.95, aim: 0.5, fov: 28 }] },
  payload: { name: 'payload', duration: 18, loop: true, look: 'payload', keys: [
    { t: 0, dist: 22, yaw: 0.3, pitch: 0.16, aim: 0.8, fov: 28 },
    { t: 18, dist: 22, yaw: 0.3 + Math.PI * 2, pitch: 0.16, aim: 0.8, fov: 28 }] },
};

export const ARRIVE_ALT = { moon: 100000, mars: 400000, venus: 400000 };

const qOf = s => s instanceof URLSearchParams ? s : new URLSearchParams(String(s || '').replace(/^\?/, ''));
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const num = (q, k) => q.has(k) && isFinite(+q.get(k)) ? +q.get(k) : null;

export function parseQuery(search) {
  const q = qOf(search);
  const trailer = q.get('trailer') === '1' || (q.has('trailer') && q.get('trailer') !== '0' && q.get('trailer') !== 'false');
  const cine = q.get('cine') || (trailer ? 'orbit' : null);
  return {
    trailer, clean: q.get('hud') === '0' || q.get('clean') === '1', pause: false,
    cine, warp: num(q, 'warp'), deploySpeed: num(q, 'deploy') ?? 1, deploySize: num(q, 'deploySize') ?? 1,
    at: ['moon', 'mars', 'venus'].includes(q.get('at')) ? q.get('at') : null, atAlt: num(q, 'atAlt'),
    score: q.get('music') === 'space' || q.get('score') === '1',
    epoch: q.get('epoch') && isFinite(Date.parse(q.get('epoch'))) ? Date.parse(q.get('epoch')) : null,
    tod: /^\d{1,2}:\d{2}$/.test(q.get('tod') || '') ? q.get('tod') : null,
    site: q.get('site') || null,
    autoStart: trailer || !!q.get('cine') || ['moon', 'mars', 'venus'].includes(q.get('at')),
  };
}

export function preset(name) { const p = PRESETS[name]; return p ? { ...p, keys: p.keys.map(k => ({ ...k })) } : null; }

function normalize(spec) {
  if (!spec) return null;
  const keys = Array.isArray(spec) ? spec : spec.keys;
  if (!keys || keys.length < 2) return null;
  const duration = spec.duration || keys[keys.length - 1].t || 1;
  return { name: spec.name || 'custom', duration, loop: !!spec.loop, look: spec.look || keys[0].look || 'stack', keys: keys.map(k => ({ ...k })) };
}

export function sampleKeys(path, time) {
  const keys = path.keys, dur = path.duration || keys[keys.length - 1].t || 1;
  let t = time;
  if (path.loop) t = ((t % dur) + dur) % dur; else t = Math.max(0, Math.min(dur, t));
  let i = 0; while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(keys.length - 1, i + 1)], span = (b.t - a.t) || 1, k = a === b ? 0 : smooth((t - a.t) / span);
  const pick = (f, d) => lerp(a[f] ?? d, b[f] ?? a[f] ?? d, k);
  return { dist: pick('dist', 90), yaw: pick('yaw', 0.4), pitch: pick('pitch', 0.18), aim: pick('aim', 0.48), fov: pick('fov', 35), look: path.look || 'stack', t, name: path.name || 'custom' };
}

export function createTrailer(search) {
  const cfg = parseQuery(search);
  let path = cfg.cine ? preset(cfg.cine) : null, t = 0, playing = !!path, hold = null, fovLock = null;
  const api = {
    cfg, score: cfg.score, deploy: { speed: cfg.deploySpeed, size: cfg.deploySize },
    get active() { return !!(playing || hold); },
    play(spec) { path = typeof spec === 'string' ? preset(spec) : normalize(spec); if (!path) return false; playing = true; hold = null; t = 0; fovLock = null; return true; },
    stop() { playing = false; hold = null; fovLock = null; },
    hold(pose) { hold = { dist: 90, yaw: 0.4, pitch: 0.18, aim: 0.48, fov: 35, look: 'stack', ...(pose || {}) }; playing = false; },
    seek(s) { t = +s || 0; },
    fov(n) { fovLock = +n; if (hold) hold.fov = +n; },
    sample(dt) {
      if (!playing && !hold) return null;
      if (hold) return { ...hold, fov: fovLock || hold.fov, name: 'hold', t };
      t += Math.max(0, +dt || 0); const s = sampleKeys(path, t); if (fovLock) s.fov = fovLock; return s;
    },
    status() {
      const s = hold ? { ...hold, name: 'hold', t } : playing ? sampleKeys(path, t) : null;
      return { on: !!(playing || hold), clean: cfg.clean, pause: false, score: api.score, deploy: { ...api.deploy }, warp: cfg.warp, at: cfg.at, site: cfg.site, path: s };
    },
    setScore(on) { api.score = on == null ? !api.score : !!on; return api.score; },
    setClean(on) { cfg.clean = !!on; return cfg.clean; },
    setDeploy(o = {}) { if (o.speed != null) api.deploy.speed = +o.speed; if (o.size != null) api.deploy.size = +o.size; return deployMotion(api.deploy.speed, api.deploy.size); },
  };
  return api;
}

export function warpPlan(mult, warps) {
  const m = +mult;
  if (!isFinite(m) || m <= 1) return { index: 0, mult: warps[0], quiet: true };
  let best = 0, err = Infinity;
  for (let i = 0; i < warps.length; i++) {
    if (warps[i] === m) return { index: i, mult: m, quiet: true };
    const e = Math.abs(Math.log(warps[i]) - Math.log(Math.max(m, 1e-9)));
    if (e < err) { err = e; best = i; }
  }
  return { index: best, mult: warps[best], quiet: true };
}

// Same 52 km gate the flight uses, plus a trailer override that plays the space score on the ground.
export function spaceScore(alt, prevOn, force) {
  if (force) return { on: true, kind: 'space', level: 1 };
  const on = alt > (prevOn ? 52000 : 56000), lvl = Math.max(0, Math.min(1, (alt - 52000) / 20000));
  return on ? { on: true, kind: 'space', level: Math.max(0.15, lvl) } : { on: false, kind: null, level: 0 };
}

// speed 1 = today's 2 m/s spring and 4 s unfold. Smaller speed is a slower close-up. size scales the released mesh.
export function deployMotion(speed, size) {
  const s = Math.max(0.05, Math.min(4, isFinite(+speed) && +speed > 0 ? +speed : 1));
  const z = Math.max(0.25, Math.min(6, isFinite(+size) && +size > 0 ? +size : 1));
  return { speed: s, sep: 2 * s, delay: 1.2 / s, dur: 4 / s, size: z };
}

export function epochMillis(search, now) {
  const q = qOf(search);
  if (q.get('epoch') && isFinite(Date.parse(q.get('epoch')))) return Date.parse(q.get('epoch'));
  const m = /^(\d{1,2}):(\d{2})$/.exec(q.get('tod') || '');
  if (!m) return now;
  const d = new Date(now); d.setUTCHours(+m[1] % 24, +m[2] % 60, 0, 0); return d.getTime();
}

export function resolveSite(search, sites) {
  const raw = qOf(search).get('site'); if (!raw || !sites) return null;
  let body = null, id = raw;
  if (raw.includes(':')) { const p = raw.split(':'); body = p[0]; id = p.slice(1).join(':'); }
  for (const b of (body ? [body] : Object.keys(sites))) {
    const hit = (sites[b] || []).find(s => s[0] === id);
    if (hit) return { body: b, id: hit[0], name: hit[1], lat: hit[2], lon: hit[3] };
  }
  return null;
}

export function arriveAlt(body, alt) { if (alt != null && isFinite(+alt) && +alt > 1000) return +alt; return ARRIVE_ALT[body] || 200000; }

// Put an already-built Flight in a circular orbit of `body` (moon / mars / venus). Marks the flyby and orbit goals quietly.
export function applyArrival(F, body, alt, P) {
  const b = P.BODIES[body]; if (!F || !b) return null;
  const h = arriveAlt(body, alt), v = F.v;
  F.ignited = true; F.flags.liftoff = 1; F.flags.space = 1; F.flags.orbit = 1; F.flags.cutoff = 1; F.flags.fairing = 1;
  F.ascent = false; F.met = 600; F.endQueued = false;
  while (v.cur < (F.lastPow || 0)) v.cur++;
  v.fairing = 0; v._g = null; v.clamped = false; v.ut = 0; v.throttle = 0; v.body = body;
  const r = b.R + h, vc = Math.sqrt(b.mu / r), th = 0.45;
  v.r = [r * Math.cos(th), r * Math.sin(th), 0]; v.v = [-vc * Math.sin(th), vc * Math.cos(th), 0];
  const sp = Math.hypot(v.v[0], v.v[1], v.v[2]) || 1;
  v.q = P.V.qFromTo([0, 1, 0], [v.v[0] / sp, v.v[1] / sp, v.v[2] / sp]);
  v.w = [0, 0, 0]; v.clock = v.clock || 600; v.sas = 'prograde';
  F.goals[body] = { ...(F.goals[body] || {}), flyby: F.tAbs, orbit: F.tAbs };
  P.stepVehicle(v, 0);
  return { body, alt: h, r, vc };
}
