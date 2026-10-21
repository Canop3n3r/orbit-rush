// Orbit Rush f1 — one-tap mission director. Flies a whole mission with the real Flight (6-DOF ascent on AUTO,
// planner-built transfer nodes executed as finite burns, mid-course corrections, SOI warps, capture, Moon
// landing) and tells the renderer which cinematic camera suits each phase. The player can take over anytime
// (takeOver()); nothing here bypasses the physics. DOM-free, so tests/fun.mjs runs it headlessly.
import * as P from '../physics.js?v=f5.4j';
import * as C from '../physics/patched.js?v=f5.4j';
const V = P.V;
export const MISSIONS = {
  orbit: { name: 'Orbit & home', icon: '🛰️', tpl: 'Orbit & home', target: null, blurb: 'Fly to orbit, then bring the capsule home under parachutes.' },
  moon: { name: 'Moon landing', icon: '🌕', tpl: 'Moon lander', target: 'moon', land: true, blurb: 'Transfer burn, capture into lunar orbit, powered landing.' },
  mars: { name: 'Mars', icon: '🔴', tpl: 'Mars explorer', target: 'mars', capture: true, blurb: 'Wait for the window, cross the Sun’s gravity well, arrive at Mars.' },
  hop: { name: 'Hop & land', icon: '🦗', tpl: 'Grasshopper', target: null, hop: 3000, land: true, blurb: 'Straight up to 3 km, engine off, fall back and hoverslam onto the pad.' },
  venus: { name: 'Venus flyby', icon: '🟡', tpl: 'Mars explorer', target: 'venus', blurb: 'Fall inward toward the Sun and swing past Venus.' },
};
// phase → camera: the renderer picks chase / wide / map cams from this
export const CAMS = { hop: 'chase', coast: 'wide', ascent: 'chase', plan: 'map', burn: 'wide', correct: 'wide', cruise: 'map', capture: 'wide', brake: 'chase', descent: 'chase', home: 'chase', done: 'wide' };
export const FLYBY_AIM = 30e6; // m: where the flyby correction aims
export const FLYBY_MAX = 150e6; // m: closest approach that still counts as a flyby (AUTO reaches ~66,000 km; QA saw 448,666 km)
export const MAX_CORR_WAIT = 400 * 86400; // s: never wait longer than this for a course-correction node
const ORDER = ['hop', 'coast', 'ascent', 'plan', 'burn', 'correct', 'cruise', 'lift', 'capture', 'brake', 'descent', 'home', 'done'];
const WARP_BURN = () => 4;
const STALL_PH = ['plan', 'burn', 'correct', 'capture', 'lift'];
export class Director {
  constructor(F, id, opts = {}) {
    this.F = F; this.id = id; this.m = MISSIONS[id]; this.phase = 'ascent'; this.t = 0; this.log = ['ascent']; this.active = true; this.opts = opts;
    if (this.m.target) F.autoStage = false; // f3: Moon/Mars/Venus need the whole booster; f5.4 (QA B3): Earth-orbit missions use the normal AUTO staging rule, so reusable boosters stage early and land
    this.target = this.m.target; this.corrections = 0; this.result = null; this.ok = false; this.say = opts.say || (() => {});
  }
  get cam() { return CAMS[this.phase] || 'chase'; }
  get label() {
    const L = { ascent: 'Climbing to orbit', plan: 'Plotting the transfer', burn: 'Transfer burn', correct: 'Course correction', cruise: 'Cruising to ' + (this.target ? P.BODIES[this.target].name : ''), capture: 'Capture burn', lift: 'Raising periapsis', brake: 'Braking from orbit', descent: 'Powered descent', home: 'Coming home', done: this.result || 'Mission complete' };
    return L[this.phase] || this.phase;
  }
  get progress() { return ORDER.indexOf(this.phase) / (ORDER.length - 1); }
  takeOver() { const F = this.F; this.active = false; F.setExec(false); F.setAuto(false, true); this.say('You have control — mission autopilot off'); }
  set(ph, msg) { this.phase = ph; this.t = 0; this._w0 = Date.now(); this.log.push(ph); if (msg) this.say(msg); }
  finish(res, ok = true) { this.result = res; this.ok = ok; this.set('done', res); this.active = false; }
  dvCap() { return 900; }
  execNext(node) { const F = this.F; if (this.target && this.target !== 'moon') node.cl = true; F.addNode(node); F.setExec(true); } // f5.1h: closed-loop guidance for interplanetary burns
  tick(dt) { // once per frame, before F.advance
    const F = this.F, v = F.v;
    if (!this.active) return;
    if (F.flags.dead) { this.active = false; this.result = 'Lost: ' + F.flags.dead; this.ok = false; return; }
    this.t += dt;
    // f5.1h (QA): a mid-course phase that never finishes (sim time or wall time) ends with a card instead of a silent stall
    if (this.target && STALL_PH.includes(this.phase) && ((this.phase !== 'burn' && this.phase !== 'plan' && this.t > 5 * 86400) || Date.now() - (this._w0 || Date.now()) > 180000)) { this.finish('Stalled during ' + this.label.toLowerCase() + ' — try again', false); return; }
    if (this.m.hop && this.phase === 'ascent') this.set('hop', 'Hop! Straight up to ' + (this.m.hop / 1000).toFixed(0) + ' km');
    switch (this.phase) {
      case 'hop': { // vertical climb; cut when the ballistic apex reaches the target height
        const up = V.norm(v.r), va = P.airVel(v), vs = V.dot(va, up), R = V.len(v.r), g = P.BODIES[F.body].mu / (R * R);
        if (!F.ignited) { F.stagePress(); this.alt0 = F.alt - v.tel.ycom; }
        v.sas = 'stab'; v.steerDir = up; v.ut = 1;
        if (F.alt + Math.max(vs, 0) ** 2 / (2 * g) >= this.m.hop) { v.ut = 0; v.steerDir = null; this.set('coast', 'Engine off — coasting to the top'); }
        break; }
      case 'coast': { const up = V.norm(v.r); v.ut = 0; v.sas = 'stab'; v.steerDir = up; if (V.dot(P.airVel(v), up) < -2) this.set('descent', 'Falling — hoverslam onto the pad'); break; }
      case 'ascent':
        if (!F.ignited) { F.stagePress(); F.setAuto(true, true); }
        else if (!F.autoOn && !F.flags.orbit) F.setAuto(true, true);
        if (F.flags.orbit && v.guid === 'done') {
          if (!this.target) { if (F.canDeorbit()) { F.deorbit(); this.set('home', 'Orbit! Deorbiting for the trip home'); } else this.finish('Orbit reached'); }
          else this.set('plan', 'Orbit! Plotting the transfer to ' + P.BODIES[this.target].name);
        }
        break;
      case 'plan': {
        const pl = C.planFull(F.body, v.r, v.v, F.tAbs, this.target, { minWait: 1200, burn: F.burnModel() });
        if (!pl || !pl.reaches) { this.finish('No transfer found from this orbit', false); break; }
        this.plan = pl; F.target = pl.target; this.execNext(pl.tuned);
        this.set('burn', `Window in ${pl.wait > 86400 ? (pl.wait / 86400).toFixed(0) + ' days' : Math.round(pl.wait / 60) + ' min'} — warping to the burn`); break; }
      case 'burn': case 'correct':
        // f4 (QA): a correction node far beyond the cruise (seen: ~9,749 days out) would stall the mission; drop it and keep cruising
        if (this.phase === 'correct' && F.nodes.length && F.nodes[0].t - F.tAbs > MAX_CORR_WAIT) { F.setExec(false); F.nodes.splice(0); this.set('cruise', 'Correction skipped — cruising on'); break; }
        if (v.thrust > 0 && !F.warpTarget) F.setWarp(WARP_BURN(this), true);
        if (!F.exec && !F.nodes.length) this.afterBurn();
        else if (!F.exec && F.nodes.length) F.setExec(true);
        break;
      case 'cruise':
        if (F.body === this.target) { this.arrive(); break; }
        if (this._cruise0 == null) this._cruise0 = F.tAbs; // f5a.2 (QA P1): never cruise for years; a transfer that misses ends the mission
        if (F.body === 'sun' && F.tAbs - this._cruise0 > MAX_CORR_WAIT) { this.finish('Missed ' + P.BODIES[this.target].name + ' — try again', false); break; }
        if (!F.warpTarget && !F.exec) {
          if (F.body === 'sun' && this.corrections < 4) {
            const pr = C.predict('sun', v.r, v.v, F.tAbs, { maxPatches: 3 }), ca = C.closestApproach(pr, this.target);
            if (!ca.inside) { this.corrections++;
              let cn = C.correctionNode('sun', v.r, v.v, F.tAbs, this.target, { peAlt: 300000, tol: 3e6, starts: [5 * 86400, 30 * 86400], scaleV: 2, byT: F.tAbs + 4e7 });
              if (!(cn && cn.node && cn.good && cn.dv < this.dvCap())) { // QA f5.1c P1 (Venus ~1 in 3 missed): wider search; a flyby only needs to enter the SOI
                const c2 = C.correctionNode('sun', v.r, v.v, F.tAbs, this.target, { peAlt: 300000, tol: this.m.capture || this.m.land ? 3e6 : 3e7, starts: [2 * 86400, 10 * 86400, 30 * 86400, 60 * 86400], scaleV: 4, byT: F.tAbs + 6e7 });
                if (c2 && c2.node && c2.dv < this.dvCap() && (!cn || !cn.node || cn.dv >= this.dvCap() || (c2.good && !cn.good))) cn = c2; }
              if (cn && cn.node && cn.dv < this.dvCap() && cn.node.t - F.tAbs < MAX_CORR_WAIT) { this.execNext(cn.node); this.set('correct', 'Course correction ' + cn.dv.toFixed(0) + ' m/s'); break; } }
          }
          if (!F.warpToSOI()) this.finish('Missed ' + P.BODIES[this.target].name, false);
        }
        break;
      case 'capture':
        if (v.thrust > 0 && !F.warpTarget) F.setWarp(4, true);
        if (!F.exec && F.nodes.length && (F.nodes[0].t < F.tAbs - 600 || this.t > 5)) F.nodes.splice(0); // QA f5.1c P1: exec stopped with a stale node (already captured) — never sit in capture forever
        if (!F.exec && !F.nodes.length) {
          const o = P.orbitOf(v);
          if (this.m.land && o.e < 0.9) { if (v.cur < F.lastPow && F.canStage()) { F.stageArm = -1; F.realT = Math.max(F.realT, 100); F.stage(); } v.sas = 'retrograde'; v.sasHold = null; this.set('brake', 'In lunar orbit — braking for the landing'); }
          else this.finish(o.e < 1 ? `In orbit around ${P.BODIES[F.body].name}!` : `Flew past ${P.BODIES[F.body].name}`);
        }
        break;
      case 'lift': if (v.thrust > 0 && !F.warpTarget) F.setWarp(4, true); if (!F.exec && !F.nodes.length) this.arrive(); else if (!F.exec && F.nodes.length) F.setExec(true); break;
      case 'brake': {
        v.sas = 'retrograde';
        const ang = Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.scale(P.progradeOf(v), -1)))));
        if (ang < 0.05 || this.t > 60) this.set('descent', 'Powered descent');
        break; }
      case 'descent': if (F.flags.landed || F.parked) this.finish(this.m.hop ? 'Hopped and landed!' : 'Landed on the ' + P.BODIES[F.body].name + '!'); else this.land(); break;
      case 'home': if (F.flags.recovered) this.finish('Orbit and home!'); break;
    }
  }
  afterBurn() {
    const F = this.F, v = F.v;
    if (F.body === this.target) { this.arrive(); return; }
    const pr = C.predict(F.body, v.r, v.v, F.tAbs, { maxPatches: 4 }), ca = C.closestApproach(pr, this.target), tp = pr.patches.find(p => p.body === this.target);
    const good = this.target === 'moon' ? tp && tp.o.rp - P.BODIES.moon.R > 40000 && tp.o.rp - P.BODIES.moon.R < 250000 : ca.inside && (this.m.land || this.m.capture || !!(tp && tp.o && tp.o.rp - P.BODIES[this.target].R < FLYBY_MAX * 0.6)); // f5.4: a flyby must pass close, not just touch the SOI
    if (!good && this.corrections < 3 && F.body === 'earth') {
      this.corrections++;
      const cn = this.target === 'moon' ? C.correctionNode('earth', v.r, v.v, F.tAbs, 'moon', { peAlt: 100000 })
        : C.correctionNode('earth', v.r, v.v, F.tAbs, this.target, { peAlt: 300000, tol: 3e6, starts: [3600, 6 * 3600, 86400], scaleV: 3, byT: F.tAbs + (this.plan && this.plan.hohmann ? this.plan.hohmann.tt * 1.25 : 3e7) });
      if (cn && cn.node && cn.node.t - F.tAbs < MAX_CORR_WAIT) { this.execNext(cn.node); this.set('correct', 'Course correction ' + C.nodeDv(cn.node).toFixed(0) + ' m/s'); return; }
    }
    this.set('cruise', 'Coasting to ' + P.BODIES[this.target].name);
  }
  arrive() {
    const F = this.F, v = F.v, b = P.BODIES[F.body];
    this.say('Welcome to ' + b.name + '!');
    const tp = C.timeToPe(v.r, v.v, b.mu), sp = P.propagate(v.r, v.v, tp, b.mu), rp = V.len(sp.r), ra = b.R + (this.m.land ? 1500000 : Math.max(2e6, b.R * 2));
    if (!(this.m.land || this.m.capture)) { // f5.4 (QA A1/A4): a flyby only counts close in (closest approach under FLYBY_MAX), not anywhere in the SOI
      const ca = Math.max(0, rp - b.R); this.closest = ca;
      const low = rp < b.R + (b.atm ? 250000 : 50000);
      if ((ca > FLYBY_MAX || low) && !this._lift) { // aim closer first: a small burn soon after SOI entry pulls the pass in to ~FLYBY_AIM
        const want = b.R + (low ? 2e6 : FLYBY_AIM), tn = F.tAbs + Math.min(3600, tp * 0.2); let best = null;
        const s0 = P.propagate(v.r, v.v, tn - F.tAbs, b.mu);
        for (let k = -80; k <= 80; k++) for (let j = -8; j <= 8; j++) { const nd = { t: tn, pro: j * 25, nrm: 0, rad: k * 10 }, dv = C.nodeVector(s0.r, s0.v, nd), v1 = V.add(s0.v, dv);
          const tp1 = C.timeToPe(s0.r, v1, b.mu); if (!(tp1 > 0)) continue; const s1 = P.propagate(s0.r, v1, tp1, b.mu), err = Math.abs(V.len(s1.r) - want) / 1000 + C.nodeDv(nd) * 0.05;
          if (!best || err < best.err) best = { nd, err }; }
        if (best) { this._lift = true; this.execNext(best.nd); this.set('lift', 'Course correction for a close pass of ' + b.name); return; } }
      if (low) { this.finish(`On a collision course with ${b.name}`, false); return; }
      if (ca > FLYBY_MAX) { this.finish(`Passed ${b.name} at ${Math.round(ca / 1000).toLocaleString('en-US')} km: too far for a flyby`, false); return; }
      this.finish(`Flew past ${b.name} at ${Math.round(ca / 1000).toLocaleString('en-US')} km!`); return; }
    if (F.body !== 'moon' && rp < b.R + 100000 && !this._lift) { // f5.1h: arriving low or on a collision course — raise periapsis first (a small radial burn soon), then capture
      const want = b.R + Math.max(300000, (b.atm ? 150000 : 0) + 200000), tn = F.tAbs + Math.min(3600, tp * 0.2); let best = null;
      for (let k = -80; k <= 80; k++) for (let j = -4; j <= 4; j++) { const nd = { t: tn, pro: j * 50, nrm: 0, rad: k * 25 }, s0 = P.propagate(v.r, v.v, tn - F.tAbs, b.mu), dv = C.nodeVector(s0.r, s0.v, nd), v1 = V.add(s0.v, dv);
        const tp1 = C.timeToPe(s0.r, v1, b.mu), s1 = P.propagate(s0.r, v1, tp1, b.mu), err = Math.abs(V.len(s1.r) - want) / 1000 + C.nodeDv(nd) * 0.02;
        if (!best || err < best.err) best = { nd, err }; }
      if (best) { this._lift = true; this.execNext(best.nd); this.set('lift', 'Raising periapsis before the capture'); return; } }
    if (rp < b.R) { this.finish('On a collision course with ' + b.name, false); return; }
    F.addNode({ t: F.tAbs + tp, pro: Math.sqrt(b.mu * (2 / rp - 2 / (rp + ra))) - V.len(sp.v) }); F.setExec(true);
    this.set('capture', 'Capture burn at periapsis');
  }
  land() { // hoverslam (suicide burn) from the shared solver: coast, light as late as possible at ~88% throttle, cut at touchdown
    const F = this.F, v = F.v, b = P.BODIES[F.body], R = V.len(v.r), g = b.mu / (R * R);
    const h = F.alt - v.tel.ycom, up = V.norm(v.r), va = P.airVel(v), sp = V.len(va), vs = V.dot(va, up), a = P.thrustAccel(v);
    if (this.m.hop) { v.sas = 'stab'; v.steerDir = up; } else v.sas = 'retrograde';
    const aE = F.body === 'earth' ? P.maxThrust(v, P.atmosphere(Math.max(0, F.alt)).p) / (P.massOf(v) * 1000) : a; // sea-level thrust on Earth
    const hG = this.m.hop ? F.alt - (this.alt0 ?? 0) - v.tel.ycom : h; // hop: height above the pad it left
    const sol = P.hoverslamSolve({ h: hG, vDown: vs < 0 ? sp : 0, m: 1, Tmax: aE, thrMin: 0.05, g, burning: !!v._hs, lit: v.ignAlt != null });
    F.landCue = { burnIn: sol.ignite ? 0 : sol.tIgn, lowTWR: sol.lowTWR, noLand: sol.noLand, thr: sol.throttle, twr: sol.twr };
    if (sol.lowTWR && !this._warned) { this._warned = true; F.toast && F.toast(sol.noLand ? 'TWR too low to land: braking as hard as possible' : 'Low TWR: controlled descent instead of a hoverslam', '#ffb347'); }
    // warp while far from the burn, never during it
    F.setWarp(!sol.ignite && sol.tIgn > 120 ? 3 : !sol.ignite && sol.tIgn > 30 ? 2 : 0, true);
    if (sol.legs) v.legs = true;
    v._hs = sol.ignite && sol.throttle > 0;
    if (v._hs && v.ignAlt == null) { v.ignAlt = h; v.ignV = sp; }
    v.ut = sol.noLand && vs < 0 ? 1 : sol.throttle;
  }

}
