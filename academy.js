// Orbit Rush Academy: twelve interactive lessons, the HUD glossary (Learn overlay) and progress storage.
// No DOM: main.js / academy-ui.js render it, and tests/academy.mjs drives the same lessons headlessly.
// Every number shown in a lesson comes from the physics modules (single source of truth): the constants and
// functions are imported, never re-typed here.
import * as P from './physics.js?v=f5a.1';
import { TEMPLATES, PARTS, designStats, aeroBalance, ORBIT_DV } from './parts.js?v=f5a.1';
import * as C from './physics/patched.js?v=f5a.1';
import { BODIES } from './physics/solar.js?v=f5a.1';
import { chuteLimits, SAFE_TOUCHDOWN, SAFE_LANDING, DEORBIT_PE } from './flight.js?v=f5a.1';
const { V, G0, MU, R } = P;

// ---------- formulas (what the concept cards display) ----------
export const calc = {
  twr: (thrustN, massKg, g = G0) => thrustN / (massKg * g),
  rocketEq: (isp, m0, mf) => isp * G0 * Math.log(m0 / mf),                       // Tsiolkovsky
  dynamicPressure: (rho, v) => 0.5 * rho * v * v,                                 // q = ½ρv²
  mach: (v, a) => v / a,
  vCirc: h => Math.sqrt(MU / (R + h)),                                            // circular orbital speed
  period: (pe, ap = pe) => { const a = R + (pe + ap) / 2; return 2 * Math.PI * Math.sqrt(a * a * a / MU); },
  visViva: (r, a) => Math.sqrt(MU * (2 / r - 1 / a)),                             // speed on an orbit of semi-major axis a
  circDv: (pe, ap) => calc.vCirc(ap) - calc.visViva(R + ap, R + (pe + ap) / 2),  // Δv to circularize at apoapsis
  heatFlux: (rho, v, rn) => P.suttonGraves(rho, v, rn),                           // Sutton–Graves stagnation heating
  gravity: h => P.gravityAt(h),
  terminal: (massKg, rho, cdA, h = 0) => Math.sqrt(2 * massKg * P.gravityAt(h) / (rho * cdA)), // drag = weight
  // suicide-burn height: distance needed to stop from vertical speed vz at full thrust T (N), mass m (kg)
  stopDistance: (vz, T, m, h = 0) => { const a = T / m - P.gravityAt(h); return a > 0 ? vz * vz / (2 * a) : Infinity; },
};
const f0 = (x, d = 0) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmt = f0;
const km = m => f0(m / 1000, m < 10000 ? 1 : 0) + ' km';
const deg = r => r * 180 / Math.PI;
const tpl = name => TEMPLATES.find(t => t.name === name);
const D = (name, parts) => ({ name, parts: parts.map(p => typeof p === 'string' ? { id: p } : p) });
const hasFins = d => d.parts.some(p => p.id === 'fins');
const horizSpeed = v => { const up = V.norm(v.r), vel = V.sub(v.v, V.scale(up, V.dot(v.v, up))); return V.len(vel); };
const pitchDeg = v => deg(Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), V.norm(v.r))))));
const angleTo = (v, dir) => deg(Math.acos(Math.max(-1, Math.min(1, V.dot(P.noseOf(v), dir)))));
const vz = v => V.dot(v.v, V.norm(v.r));
const flying = c => c.state === 'flight' && c.F;
export const heightAboveGround = F => F.alt - F.tel.ycom;
export const burnHeight = F => { const v = F.v; return calc.stopDistance(Math.min(0, vz(v)), P.maxThrust(v, F.tel.p), P.massOf(v) * 1000, F.alt); };

// ---------- the designs lessons start from ----------
export const DESIGNS = {
  hop: tpl('Light & fast'),
  under: D('Too heavy', ['probe', 'tank-m', { id: 'lark', n: 1 }, 'dec', 'tank-xl', 'tank-l', { id: 'mule', n: 1 }, 'fins']),
  finless: D('No fins', ['fairing', 'probe', 'tank-m', { id: 'lark', n: 1 }, 'dec', 'tank-xl', { id: 'thumper', n: 3 }]),
  orbit: tpl('Recommended'),
  rcs: tpl('Heavy lift'),
  home: tpl('Orbit & home'),
  lander: D('Hopper', ['probe', 'tank-l', { id: 'mule', n: 1 }, 'fins']),
};
// Moon-bound craft for the two solar-system lessons: parked in a 200 km orbit; soi: already on a lunar transfer
const moonPlan = F => C.planFull('earth', F.v.r, F.v.v, F.tAbs, 'moon', { minWait: 600 });
export function setupTransfer(F) { F.placeInOrbit(200000, 1); F.v.sas = 'prograde'; return F; }
export function setupSOI(F) {
  setupTransfer(F); const pl = moonPlan(F); if (!pl || !pl.reaches) return F;
  F.target = 'moon'; F.applyNodeNow(F.addNode(pl.tuned));
  const pr = C.predict('earth', F.v.r, F.v.v, F.tAbs, { maxPatches: 3 }), ix = pr.patches.findIndex(p => p.body === 'moon');
  if (ix > 0) F.coastTo(pr.patches[ix - 1].t1 - 3 * 3600); F.v.sas = 'prograde'; return F;
}
const reachesMoon = F => { const pr = C.predict(F.body, F.v.r, F.v.v, F.tAbs, { maxPatches: 3 }); return pr.patches.some(p => p.body === 'moon'); };
export const Q_LIMIT = 32000; // Pa: lesson 4's Max-Q budget (Medium-lift orbital rockets peak around 30–35 kPa)

// ---------- lessons ----------
// start: { mode: 'flight' (on the pad unless setup moves it) | 'build', design, setup(F) applied on every launch }
// steps: [{ text(c) | string, hl: [HUD keys or #selectors], keys: [key caps], done(c) }] — sequential
// pass(c): the lesson's real check (latched). fail(c): a reason string when the attempt can't pass any more.
// track(c): per-update observations into c.fm (this flight) and c.mem (the whole lesson).
export const LESSONS = [
  {
    id: 'controls', title: 'Controls & staging', goal: 'Hop to 1 km and stage',
    start: { mode: 'flight', design: DESIGNS.hop },
    steps: [
      { text: 'Press SPACE to light the engines.', keys: ['Space'], done: c => c.F.ignited },
      { text: 'Liftoff! The clamps let go once thrust beats weight. Throttle with Shift / Ctrl (or ↑ / ↓); Z is full, X is cut.', hl: ['thr', 'alt'], keys: ['Shift', 'Ctrl', 'Z', 'X'], done: c => c.F.flags.liftoff && c.F.alt > 200 },
      { text: c => `Climb to 1 km — ALT reads ${km(c.F.alt)}.`, hl: ['alt'], done: c => c.F.flags.maxAlt >= 1000 },
      { text: 'Stage: press SPACE twice. The booster drops away and the upper stage lights.', hl: ['stage'], keys: ['Space', 'Space'], done: c => c.v.cur >= 1 },
    ],
    pass: c => flying(c) && c.F.flags.maxAlt >= 1000 && c.v.cur >= 1,
    concept: {
      title: 'Why rockets have stages',
      body: c => { const s = designStats(DESIGNS.hop); return `<p>A rocket is mostly propellant. Once a tank is empty its mass is dead weight, so we throw it away and light a smaller engine on a lighter stack.</p>
        <p>This rocket: stage 1 weighs <b>${f0(s.stages[0].m0, 1)} t</b> full and <b>${f0(s.stages[0].m1, 1)} t</b> empty; stage 2 starts at only <b>${f0(s.stages[1].m0, 1)} t</b>.</p>
        <p class="k">SPACE ignite · SPACE×2 stage · Shift/Ctrl throttle · Z/X full/cut · W/S A/D Q/E steer · F AUTO · M map</p>`; },
    },
  },
  {
    id: 'twr', title: 'Thrust-to-weight & the rocket equation', goal: 'Fix an underpowered rocket and lift off',
    start: { mode: 'build', design: DESIGNS.under },
    steps: [
      { text: c => `Stage 1 TWR is ${f0(c.stats.stages[0].twr, 2)} (Stages table): its engine can't lift its own weight. Add engines with +, or put Thumpers on stage 1, until TWR ≥ 1.2.`, hl: ['#readout table'], done: c => c.state === 'build' ? c.stats.stages[0].twr >= 1.2 : c.mem.fixed },
      { text: 'Roll to the pad.', hl: ['#launchBtn'], done: c => c.state === 'flight' },
      { text: 'Ignite (SPACE) and climb to 2 km.', keys: ['Space'], hl: ['alt'], done: c => flying(c) && c.F.flags.maxAlt > 2000 },
    ],
    track: c => { if (c.state === 'build' && c.stats.stages[0].twr >= 1.2) c.mem.fixed = true; },
    pass: c => flying(c) && c.F.flags.liftoff && c.F.flags.maxAlt > 2000,
    concept: {
      title: 'Thrust-to-weight and Δv', plot: 'dvbar',
      body: c => { const s = c.stats, st = s.stages[0];
        return `<p>To leave the pad thrust must beat weight:</p><div class="eq">TWR = <span class="fr"><i>T</i><i>m · g<sub>0</sub></i></span> &gt; 1</div>
        <p>How much speed a stage can add is the <b>rocket equation</b> (Tsiolkovsky):</p>
        <div class="eq">Δv = I<sub>sp</sub> · g<sub>0</sub> · ln <span class="fr"><i>m<sub>0</sub></i><i>m<sub>f</sub></i></span></div>
        <p>Your stage 1: ${f0(st.ispUsed)} s × ${f0(G0, 2)} m/s² × ln(${f0(st.m0, 1)} t / ${f0(st.m1, 1)} t) = <b data-v="dv0">${f0(calc.rocketEq(st.ispUsed, st.m0, st.m1))} m/s</b>. TWR now: <b data-v="twr0">${f0(st.twr, 2)}</b>.</p>
        <p>Whole rocket: <b data-v="dvTotal">${f0(s.total)} m/s</b>. Low Earth orbit costs about ${f0(ORBIT_DV)} m/s (≈7.8 km/s of orbital speed plus gravity and drag losses).</p>`; },
    },
  },
  {
    id: 'aero', title: 'Aero balance: CoM vs CoP', goal: 'See a fin-less rocket flip, then fly a finned one straight',
    start: { mode: 'build', design: DESIGNS.finless },
    steps: [
      { text: 'This rocket has no fins: on the preview the cyan centre of pressure sits ABOVE the yellow centre of mass. Launch it anyway.', hl: ['#launchBtn', '.aero'], done: c => c.state === 'flight' && !hasFins(c.F.design) },
      { text: 'Ignite (SPACE). Above 1.5 km switch SAS OFF (V) and tap W once.', keys: ['Space', 'V', 'W'], hl: ['sas'], done: c => c.mem.sawFlip || (flying(c) && c.v.sas === 'off' && c.F.alt > 1000) },
      { text: 'Watch AoA: the air pushes the nose further off and it flips.', hl: ['aoa'], done: c => c.mem.sawFlip },
      { text: 'Press R for the hangar and add Tail Fins at the bottom of the stack (the Aero line turns green).', keys: ['R'], hl: ['.aero'], done: c => c.state === 'build' ? hasFins(c.design) && c.ab && c.ab.stable : c.mem.finnedOk },
      { text: 'Fly it the same way: SAS OFF above 1.5 km, tap W. The fins swing it back like an arrow. Climb to 12 km.', keys: ['Space', 'V', 'W'], hl: ['aoa', 'alt'], done: c => c.mem.finnedOk },
    ],
    track: c => {
      if (!flying(c) || !c.F.ignited) return;
      const F = c.F, t = F.tel, fins = hasFins(F.design), a = Math.min(t.aoa, Math.PI - t.aoa);
      if (t.q > 2000) c.fm.maxAoA = Math.max(c.fm.maxAoA || 0, a);
      if (c.v.sas === 'off' && F.alt > 1000) c.fm.sasOff = true;
      if (!fins && c.fm.sasOff && ((c.fm.maxAoA || 0) > 0.35 || /tumbl|breakup/.test(F.flags.dead))) c.mem.sawFlip = true;
      if (fins && c.fm.sasOff && F.alt > 12000 && (c.fm.maxAoA || 0) < 0.2 && !F.flags.dead) c.mem.finnedOk = true;
    },
    pass: c => !!(c.mem.sawFlip && c.mem.finnedOk),
    fail: c => flying(c) && c.F.flags.dead && hasFins(c.F.design) ? 'The finned rocket was lost — check that the fins are at the very bottom.' : null,
    concept: {
      title: 'Centre of mass vs centre of pressure',
      body: c => { const fin = aeroBalance(DESIGNS.finless), ok = aeroBalance({ ...DESIGNS.finless, parts: [...DESIGNS.finless.parts, { id: 'fins' }] });
        return `<p>Aerodynamic forces act at the <b>centre of pressure</b> (CoP); gravity and thrust act through the <b>centre of mass</b> (CoM).</p>
        <p>If the CoP is <i>behind</i> the CoM, a gust that tilts the nose makes a restoring torque — the rocket weathervanes into the wind like an arrow. If the CoP is <i>ahead</i>, the torque pushes it further off and it flips.</p>
        <p>Stability margin, in body diameters (calibers): without fins <b class="bad">${f0(fin.margin, 2)}</b>, with fins <b class="good">${f0(ok.margin, 2)}</b>. Model rocketeers aim for about 1–2.</p>
        <p>Engine gimbal and SAS can hide an unstable rocket — until they're switched off.</p>`; },
    },
  },
  {
    id: 'maxq', title: 'Max-Q, Mach & drag', goal: `Throttle through Max-Q under ${Q_LIMIT / 1000} kPa`,
    start: { mode: 'flight', design: DESIGNS.orbit, setup: F => { F.autoThrottle = false; } },
    steps: [
      { text: 'Ignite (SPACE), then press F: AUTO steers the gravity turn, but in this lesson YOU work the throttle.', keys: ['Space', 'F'], done: c => c.F.autoOn && c.F.flags.liftoff },
      { text: c => `Q = ½ρv² climbs as you speed up in thick air (now ${f0(c.F.tel.q / 1000, 1)} kPa). Keep it under ${Q_LIMIT / 1000} kPa: throttle down (Ctrl or ↓) as it passes ~22 kPa.`, hl: ['q'], keys: ['Ctrl'], done: c => c.F.tel.q > 18000 || c.F.flags.maxq },
      { text: 'Mach 1! Near Max-Q in humid air the pressure drop behind the shock condenses water: a vapor cone.', hl: ['mach'], done: c => c.F.flags.mach1 },
      { text: c => `Max-Q is behind you (${f0(c.F.maxQ / 1000, 1)} kPa): the air now thins faster than you speed up. Throttle back to full (Z).`, hl: ['q', 'thr'], keys: ['Z'], done: c => c.F.flags.maxq && c.v.ut >= 0.95 },
      { text: 'Climb past 30 km.', hl: ['alt'], done: c => c.F.alt > 30000 },
    ],
    pass: c => flying(c) && c.F.alt > 30000 && c.F.maxQ <= Q_LIMIT && !c.F.flags.dead,
    fail: c => flying(c) && c.F.maxQ > Q_LIMIT ? `Max-Q reached ${f0(c.F.maxQ / 1000, 1)} kPa — over the ${Q_LIMIT / 1000} kPa budget. Throttle down earlier.` : null,
    concept: {
      title: 'Dynamic pressure and Mach', plot: 'cdmach',
      body: c => { const t = c.F && c.F.tel, h = 11000, at = P.atmosphere(h), vq = 450;
        return `<p>The air load on the rocket is the <b>dynamic pressure</b>:</p><div class="eq">q = ½ ρ v²</div>
        <p>Density ρ falls fast with height while speed v grows, so q peaks once: <b>Max-Q</b>, typically around 10–14 km. At ${km(h)} (ρ = ${f0(at.rho, 3)} kg/m³) and ${vq} m/s: q = <b data-v="qEx">${f0(calc.dynamicPressure(at.rho, vq) / 1000, 1)} kPa</b>.
        Medium-lift orbital rockets peak around 30–35 kPa and throttle down to stay there.</p>
        <p><b>Mach</b> = v / a, with a the speed of sound (${f0(at.a)} m/s at ${km(h)}). Drag rises steeply near Mach 1 (the transonic drag rise) and falls off when supersonic: see the plot.</p>
        ${t ? `<p class="k">Now: ρ ${t.rho.toExponential(2)} kg/m³ · v ${f0(t.vAir)} m/s → q ${f0(calc.dynamicPressure(t.rho, t.vAir) / 1000, 1)} kPa · Mach ${f0(t.mach, 2)}</p>` : ''}`; },
    },
  },
  {
    id: 'gravity', title: 'Gravity turn to orbit', goal: 'Reach orbit (Pe above 130 km)',
    start: { mode: 'flight', design: DESIGNS.orbit },
    steps: [
      { text: 'Ignite and press F for AUTO — or fly it yourself (W pitches toward the east).', keys: ['Space', 'F'], done: c => c.F.flags.liftoff },
      { text: c => `Gravity turn: tip over gradually so gravity bends the path toward horizontal. PITCH ${f0(pitchDeg(c.v))}° from vertical.`, hl: ['pitch'], done: c => pitchDeg(c.v) > 30 && c.F.alt > 5000 },
      { text: c => `Orbit means going sideways fast: horizontal speed ${f0(horizSpeed(c.v))} m/s of the ~${f0(calc.vCirc(200000))} needed.`, hl: ['spd'], done: c => horizSpeed(c.v) > 3000 },
      { text: 'Raise apoapsis (Ap) above 130 km, then cut the engine and coast up.', hl: ['ap'], done: c => P.orbitOf(c.v).ap > 130000 },
      { text: 'At Ap burn prograde until periapsis (Pe) is above 130 km. (AUTO does this for you.)', hl: ['pe'], done: c => c.F.flags.orbit },
    ],
    pass: c => flying(c) && !!c.F.flags.orbit,
    concept: {
      title: 'Why horizontal speed makes an orbit', plot: 'density',
      body: () => `<p>An orbit is falling around the Earth: you move sideways so fast that the ground curves away as quickly as you fall. The speed for a circular orbit is</p>
        <div class="eq">v = √(μ / r)</div>
        <p>with μ = GM = ${(MU).toExponential(4)} m³/s². At 200 km: <b data-v="vc200">${f0(calc.vCirc(200000))} m/s</b>. The ISS at ~400 km: ${f0(calc.vCirc(400000))} m/s, one lap every <b data-v="issT">${f0(calc.period(400000) / 60, 1)} min</b>.</p>
        <p>Going straight up only buys height. The <b>gravity turn</b> lifts you out of the thick air first, then lets gravity bend the path over so the engine's thrust goes into horizontal speed.</p>`,
    },
  },
  {
    id: 'orbits', title: 'Orbits: Ap, Pe & circularizing', goal: 'Circularize at apoapsis (Pe above 280 km)',
    start: { mode: 'flight', design: DESIGNS.orbit, setup: F => F.placeOrbit(160000, 320000) },
    steps: [
      { text: 'You are at periapsis of an egg-shaped orbit. Press M: the map shows the high point (Ap) and low point (Pe).', keys: ['M'], hl: ['ap', 'pe'], done: c => c.ui.camMode === 'map' || c.mem.mapSeen },
      { text: 'Press M again, then SAS PROGRADE (2) to point along your velocity.', keys: ['M', '2'], hl: ['sas'], done: c => c.v.sas === 'prograde' && c.ui.camMode !== 'map' },
      { text: c => `Warp to apoapsis: G (Ap in ${f0(P.timeToApV(c.v) / 60, 1)} min).`, keys: ['G'], done: c => c.F.autoWarp || P.timeToApV(c.v) < 60 },
      { text: c => `At Ap burn prograde: Z (full throttle). Pe ${km(P.orbitOf(c.v).pe)} is rising.`, keys: ['Z'], hl: ['pe'], done: c => P.orbitOf(c.v).pe > 200000 },
      { text: c => { const o = P.orbitOf(c.v); return `Cut (X) when Pe ≈ Ap (${km(o.pe)} / ${km(o.ap)}): a circular orbit.`; }, keys: ['X'], hl: ['pe', 'ap'], done: c => P.orbitOf(c.v).pe > 280000 && c.v.thrust <= 0 },
    ],
    track: c => { if (c.ui.camMode === 'map') c.mem.mapSeen = true; },
    pass: c => { if (!flying(c)) return false; const o = P.orbitOf(c.v); return o.pe > 280000 && o.ap - o.pe < 60000 && c.v.thrust <= 0; },
    fail: c => flying(c) && P.orbitOf(c.v).pe < 120000 ? 'Pe dropped into the atmosphere — that was a retrograde burn. Point PROGRADE (2) and burn at Ap.' : null,
    concept: {
      title: 'Apoapsis, periapsis and prograde burns',
      body: () => { const pe = 160000, ap = 320000, va = calc.visViva(R + ap, R + (pe + ap) / 2);
        return `<p>Orbits are ellipses. The highest point is <b>apoapsis</b> (Ap), the lowest <b>periapsis</b> (Pe). Speed at any point follows the <b>vis-viva</b> equation:</p>
        <div class="eq">v² = μ (2/r − 1/a)</div>
        <p>A <b>prograde</b> burn (along your velocity) raises the <i>opposite</i> side of the orbit; <b>retrograde</b> lowers it. So burning prograde at Ap lifts Pe.</p>
        <p>This orbit (${km(pe)} × ${km(ap)}): at Ap you move at ${f0(va)} m/s, a circular orbit there needs ${f0(calc.vCirc(ap))} m/s, so circularizing costs <b data-v="circDv">${f0(calc.circDv(pe, ap))} m/s</b>. Period now ${f0(calc.period(pe, ap) / 60, 1)} min.</p>`; },
    },
  },
  {
    id: 'attitude', title: 'Attitude control: SAS & RCS', goal: 'Steer all three axes, then hold prograde and retrograde',
    start: { mode: 'flight', design: DESIGNS.rcs, setup: F => F.placeInOrbit(200000) },
    steps: [
      { text: 'Switch SAS off: V. Now nothing holds the nose.', keys: ['V'], hl: ['sas'], done: c => c.v.sas === 'off' },
      { text: 'Pitch: hold W or S.', keys: ['W', 'S'], hl: ['pitch'], done: c => c.fm.pitch > 0.5 },
      { text: 'Yaw: hold A or D.', keys: ['A', 'D'], done: c => c.fm.yaw > 0.5 },
      { text: 'Roll: hold Q or E.', keys: ['Q', 'E'], done: c => c.fm.roll > 0.5 },
      { text: 'RCS on: C. Small thrusters add torque (and translation with I/K J/L H/N).', keys: ['C'], done: c => c.v.rcsOn },
      { text: c => `SAS PROGRADE (2): wait until the nose points along your velocity — ${f0(angleTo(c.v, P.progradeOf(c.v)))}° off.`, keys: ['2'], hl: ['sas'], done: c => c.v.sas === 'prograde' && angleTo(c.v, P.progradeOf(c.v)) < 5 },
      { text: c => `SAS RETROGRADE (3): flip to point backwards, the deorbit attitude — ${f0(angleTo(c.v, V.scale(P.progradeOf(c.v), -1)))}° off.`, keys: ['3'], hl: ['sas'], done: c => c.v.sas === 'retrograde' && angleTo(c.v, V.scale(P.progradeOf(c.v), -1)) < 5 },
    ],
    track: c => { if (!flying(c)) return; const inp = c.v.input || {}, dt = c.dt || 0;
      for (const ax of ['pitch', 'yaw', 'roll']) if (inp[ax]) c.fm[ax] = (c.fm[ax] || 0) + dt; },
    pass: c => c.tutor.i >= c.tutor.L.steps.length,
    concept: {
      title: 'Three axes, wheels and thrusters',
      body: () => `<p>In space there's no air to steer with. A spacecraft turns about three axes: <b>pitch</b> (nose up/down, W/S), <b>yaw</b> (nose left/right, A/D) and <b>roll</b> (spin around the nose, Q/E).</p>
        <p>Torque comes from <b>reaction wheels</b> (spin a wheel one way, the craft turns the other), the <b>engine gimbal</b> (only while thrusting) and <b>RCS</b> thrusters. Angular momentum is conserved: once spinning, you keep spinning until you brake.</p>
        <p><b>SAS</b> is the autopilot that holds a direction: stability, prograde (along velocity), retrograde (against it), radial and normal.</p>`,
    },
  },
  {
    id: 'reentry', title: 'Deorbit & reentry heating', goal: 'Deorbit and survive the heat pulse',
    start: { mode: 'flight', design: DESIGNS.home, setup: F => F.placeInOrbit(170000) },
    steps: [
      { text: 'Press O: AUTO turns retrograde and burns to drop Pe to ~45 km.', keys: ['O'], done: c => !!c.F.ret },
      { text: c => `Deorbit burn: Pe ${km(P.orbitOf(c.v).pe)} → ${DEORBIT_PE / 1000} km.`, hl: ['pe'], done: c => c.F.ret && ['sep', 'coast', 'entry'].includes(c.F.ret.phase) },
      { text: 'The service stage drops away. The capsule flies heat shield first (SAS retrograde).', hl: ['sas'], done: c => c.v.cur > c.F.lastPow },
      { text: 'Coasting down to the atmosphere. Watch q̇ in the HEAT line and the HEAT panel.', hl: ['heat'], done: c => c.F.flags.reentry },
      { text: c => `Heating grows with v³: q̇ ${f0(c.F.tel.heat / 1000)} kW/m², shield ${f0(shieldT(c.v))} K. Survive the pulse.`, hl: ['heat', '#heat'], done: c => c.mem.peakPassed },
    ],
    track: c => { if (flying(c) && c.F.maxHeat > 2e5 && c.F.tel.heat < 0.5 * c.F.maxHeat && !c.F.flags.dead && c.F.alt < 45000) c.mem.peakPassed = true; },
    pass: c => !!c.mem.peakPassed,
    concept: {
      title: 'Why reentry is hot (and capsules are blunt)', plot: 'heat',
      body: c => { const rho = P.atmosphere(60000).rho, v1 = 7000, rn = 2.5, t = c.F && c.F.tel;
        return `<p>Coming home you must lose ~7.8 km/s. Air can't get out of the way: a shock wave forms and compresses it to thousands of kelvin. The heating at the nose follows the <b>Sutton–Graves</b> relation:</p>
        <div class="eq">q̇ = k · √(ρ / r<sub>n</sub>) · v³</div>
        <p>k = ${P.SUTTON_GRAVES_K.toExponential(3)} (SI, for air). At 60 km (ρ = ${rho.toExponential(2)} kg/m³), ${f0(v1)} m/s and a ${rn} m nose radius: q̇ ≈ <b data-v="sgEx">${f0(calc.heatFlux(rho, v1, rn) / 1000)} kW/m²</b>.</p>
        <p>v³ means speed dominates; the √(1/r<sub>n</sub>) means a <b>bigger, blunter nose heats less</b> — the shock stands off and carries the heat away. Heat shields then radiate, soak or <b>ablate</b> (char and carry heat off as they erode).</p>
        ${t && t.heat > 1000 ? `<p class="k">Now: ρ ${t.rho.toExponential(2)} · v ${f0(t.vAir)} m/s · rₙ ${f0(t.rnLead || 1, 1)} m → q̇ ${f0(t.heat / 1000)} kW/m²</p>` : ''}`; },
    },
  },
  {
    id: 'chutes', title: 'Parachutes & recovery', goal: `Deploy drogues, then mains, and touch down under ${SAFE_TOUCHDOWN} m/s`,
    start: { mode: 'flight', design: DESIGNS.home, setup: F => F.placeState({ h: 30000, vUp: -550, vEast: 350, stage: F.v.stages.length - 1, att: 'retrograde', sas: 'retrograde' }) },
    steps: [
      { text: c => { const s = c.F.chuteSpec(); return `Too fast for parachutes. Drogues need Mach < ${s.drogue.machMax} and q < ${s.drogue.qMax / 1000} kPa — now Mach ${f0(c.F.tel.mach, 1)}, q ${f0(c.F.tel.q / 1000, 1)} kPa. Wait…`; }, hl: ['mach', 'q', '#heat'], done: c => chuteLimits(c.F.chuteSpec(), c.F.tel, 'drogue').ok || c.v.chute.state !== 'stowed' },
      { text: 'Inside the drogue limits: press P.', keys: ['P'], done: c => c.v.chute.state !== 'stowed' },
      { text: c => `Drogues steady the capsule. Mains need < ${c.F.chuteSpec().main.vMax} m/s (now ${f0(c.F.tel.vAir)}). Then press P again.`, hl: ['spd'], keys: ['P'], done: c => ['main', 'failed'].includes(c.v.chute.state) },
      { text: c => `Under main chutes: ${f0(c.F.tel.vAir, 1)} m/s. Touchdown at ≤ ${SAFE_TOUCHDOWN} m/s is a recovery.`, done: c => c.F.flags.recovered },
    ],
    pass: c => flying(c) && !!c.F.flags.recovered,
    fail: c => flying(c) && c.v.chute.state === 'failed' ? 'The parachutes shredded: deploy only inside their limits.' : null,
    concept: {
      title: 'Parachutes and their limits',
      body: () => { const ch = PARTS.chute, m = (PARTS.crew.m + PARTS.ablator.m + ch.m) * 1000, rho0 = P.atmosphere(0).rho;
        return `<p>Drag on a parachute is D = q · C<sub>d</sub>A, and at the bottom the capsule settles at the terminal speed where drag equals weight:</p>
        <div class="eq">v<sub>t</sub> = √(2 m g / (ρ · C<sub>d</sub>A))</div>
        <p>This capsule (${f0(m / 1000, 2)} t) under its mains (C<sub>d</sub>A = ${f0(ch.main.cda)} m²) at sea level: v<sub>t</sub> ≈ <b data-v="vTerm">${f0(calc.terminal(m, rho0, ch.main.cda), 1)} m/s</b> — under the ${SAFE_TOUCHDOWN} m/s the crew survives.</p>
        <p>Canopies have limits: open one too fast and the opening shock tears it. So recovery is staged: small <b>drogues</b> (below Mach ${ch.drogue.machMax} and ${ch.drogue.qMax / 1000} kPa) slow and steady the capsule, then big <b>mains</b> (under ${ch.main.vMax} m/s) open slowly (reefed) for a gentle splashdown.</p>`; },
    },
  },
  {
    id: 'landing', title: 'Booster landing: the suicide burn', goal: `Land upright under ${SAFE_LANDING.speed} m/s`,
    start: { mode: 'flight', design: DESIGNS.lander, setup: F => F.placeState({ h: 2000, vUp: -120, att: 'up', fuel: 8, sas: 'stab' }) },
    steps: [
      { text: c => `Falling at ${f0(-vz(c.v))} m/s, engine off. Burn too early and you waste fuel hovering; too late and you can't stop. Burn at ≈ ${f0(burnHeight(c.F))} m (engines at ${f0(heightAboveGround(c.F))} m).`, hl: ['vs', 'alt'], done: c => c.v.thrust > 0 },
      { text: c => `Burning! Ease off (Ctrl) as you slow and touch down under ${SAFE_LANDING.speed} m/s, upright. V/S ${f0(vz(c.v), 1)} m/s, ${f0(heightAboveGround(c.F))} m to go.`, hl: ['vs', 'thr'], keys: ['Shift', 'Ctrl'], done: c => c.F.flags.landed },
    ],
    pass: c => flying(c) && !!c.F.flags.landed,
    concept: {
      title: 'Stopping distance',
      body: c => { const F = c.F, T = F ? P.maxThrust(F.v, F.tel.p) : 0, m = F ? P.massOf(F.v) * 1000 : 0, vv = F ? Math.abs(vz(F.v)) : 120;
        return `<p>With the engine at full thrust T the net deceleration is a = T/m − g, so from a fall speed v you need a height</p>
        <div class="eq">h = <span class="fr"><i>v²</i><i>2 (T/m − g)</i></span></div>
        ${F ? `<p>Now: T ${f0(T / 1000)} kN, m ${f0(m / 1000, 1)} t, g ${f0(calc.gravity(F.alt), 2)} m/s², v ${f0(vv)} m/s → h ≈ <b data-v="hBurn">${f0(calc.stopDistance(vv, T, m, F.alt))} m</b>.</p>` : ''}
        <p>A booster with a thrust-to-weight above 1 at its lowest throttle can't hover, so it lights at the last moment and reaches zero speed exactly at the ground: the "suicide burn" or hoverslam.</p>`; },
    },
  },
  {
    id: 'transfer', title: 'Transfer orbits & launch windows', goal: 'Plan and fly a burn that reaches the Moon',
    start: { mode: 'flight', design: tpl('Moon lander'), setup: setupTransfer },
    steps: [
      { text: 'Open the map: M. Drag to orbit the camera, scroll or pinch to zoom.', keys: ['M'], done: c => c.ui.camMode === 'map' || c.mem.mapSeen },
      { text: 'Open the Planner and pick the Moon as target: it finds the next launch window and the burn.', hl: ['#mapBar'], done: c => c.F.target === 'moon' || c.F.nodes.length > 0 },
      { text: 'Add the planned maneuver node (the Planner\'s "Create node" button).', hl: ['#mapPanel'], done: c => c.F.nodes.length > 0 || c.mem.burned },
      { text: c => { const n = c.F.nodes[0]; return n ? `Warp to the node: G (burn in ${f0(Math.max(0, n.t - c.F.tAbs) / 60, 1)} min), then point SAS MANEUVER and burn until the node is done.` : 'Burning…'; }, keys: ['G'], done: c => c.mem.burned },
    ],
    track: c => { if (c.ui.camMode === 'map') c.mem.mapSeen = true; if (!flying(c)) return;
      if (c.F.dvUsed > 2500 && !c.F.nodes.length && c.v.thrust <= 0 && !c.mem.burned) { c.mem.burned = true; c.mem.reach = reachesMoon(c.F); } },
    pass: c => !!c.mem.reach,
    fail: c => c.mem.burned && !c.mem.reach ? 'The burn missed the Moon — open the Planner again and add a correction node.' : null,
    concept: {
      title: 'Hohmann transfers and launch windows',
      body: () => { const r1 = R + 200000, r2 = 384400e3, h = C.hohmann(MU, r1, r2);
        return `<p>The cheapest way between two circular orbits is a <b>Hohmann transfer</b>: one prograde burn makes an ellipse that just touches the target orbit, a second burn there matches it.</p>
        <div class="eq">Δv₁ = √(μ/r₁) · (√(2r₂/(r₁+r₂)) − 1)</div>
        <p>From 200 km to the Moon's distance: Δv₁ ≈ <b data-v="tliDv">${f0(h.dv1)} m/s</b>, and the coast takes ${f0(h.tt / 86400, 1)} days. The Moon must be at the far end when you get there, so you can only leave at the right phase angle: the <b>launch window</b>. For Mars the window repeats every synodic period, about 26 months.</p>`; },
    },
  },
  {
    id: 'soi', title: 'Spheres of influence & gravity assists', goal: "Coast into the Moon's sphere of influence",
    start: { mode: 'flight', design: tpl('Moon lander'), setup: setupSOI },
    steps: [
      { text: "You're on the way to the Moon. Open the map (M): the path changes colour where the Moon's gravity takes over.", keys: ['M'], done: c => c.ui.camMode === 'map' || c.mem.mapSeen },
      { text: 'Time warp: G. Warp stops by itself at the sphere-of-influence boundary.', keys: ['G'], done: c => c.F.body === 'moon' || c.F.warpI > 0 || c.mem.warped },
      { text: c => c.F.body === 'moon' ? 'Inside the Moon\'s SOI!' : 'Warping to the Moon\'s sphere of influence…', done: c => c.F.body === 'moon' },
    ],
    track: c => { if (c.ui.camMode === 'map') c.mem.mapSeen = true; if (flying(c) && c.F.warpI > 0) c.mem.warped = true; },
    pass: c => flying(c) && c.F.body === 'moon',
    fail: c => flying(c) && c.F.flags.dead ? 'Lost the craft.' : null,
    concept: {
      title: 'Patched conics',
      body: () => { const soi = BODIES.moon.soi;
        return `<p>Near a body only its gravity matters: inside its <b>sphere of influence</b> r<sub>SOI</sub> ≈ a · (m/M)<sup>2/5</sup> the game uses a plain Kepler orbit around it, and switches body at the boundary. The Moon's SOI reaches <b data-v="moonSoi">${f0(soi / 1000)} km</b>.</p>
        <p>In the Moon's frame you arrive on a hyperbola and leave at the same speed — but the Moon itself is moving, so in Earth's frame your speed changes: a <b>gravity assist</b>. Passing behind the Moon speeds you up, in front of it slows you down.</p>`; },
    },
  },
];
const shieldT = v => { let T = 0; for (let j = v.cur; j < v.stages.length; j++) for (const p of v.stages[j].parts) if (p.kind === 'shield') T = Math.max(T, p.Ts || 0); return T; };

// ---------- the lesson runner ----------
// c = { state: 'build'|'flight', F, v, design, stats, ab, ui: { camMode }, dt } — supplied by main.js or a test.
export class Tutor {
  constructor(lesson) { this.L = lesson; this.i = 0; this.mem = {}; this.fm = {}; this.F = null; this.passed = false; this.failMsg = null; this.flights = 0; }
  get step() { return this.L.steps[Math.min(this.i, this.L.steps.length - 1)]; }
  get done() { return this.i >= this.L.steps.length; }
  update(c) {
    if (c.F !== this.F) { this.F = c.F; this.fm = {}; if (c.F) this.flights++; this.failMsg = null; }
    c.v = c.F ? c.F.v : null; c.mem = this.mem; c.fm = this.fm; c.tutor = this; c.ui = c.ui || {};
    if (c.design && !c.stats) c.stats = designStats(c.design);
    if (c.design && c.ab === undefined) c.ab = aeroBalance(c.design);
    const i0 = this.i;
    if (this.L.track) this.L.track(c);
    while (!this.done && this.safe(() => this.L.steps[this.i].done(c))) this.i++;
    if (!this.passed && this.safe(() => this.L.pass(c))) { this.passed = true; this.i = this.L.steps.length; }
    if (!this.passed) {
      let f = null; try { f = this.L.fail ? this.L.fail(c) : null; } catch (e) { f = null; }
      this.failMsg = f || (c.F && c.state === 'flight' && c.F.flags.dead ? `Lost: ${c.F.flags.dead}.` : null);
    } else this.failMsg = null;
    return { changed: this.i !== i0, passed: this.passed, fail: this.failMsg };
  }
  safe(f) { try { return !!f(); } catch (e) { return false; } }
  text(c) { const s = this.step, t = typeof s.text === 'function' ? this.safeText(s, c) : s.text; return t; }
  safeText(s, c) { try { return s.text(c); } catch (e) { return ''; } }
}

// ---------- progress (localStorage, or any { getItem, setItem } store) ----------
export const PROGRESS_KEY = 'orbitrush.academy.v1';
export const emptyProgress = () => ({ v: 1, passed: {}, skipped: {}, seen: false, last: null });
export function loadProgress(store) {
  try { const p = JSON.parse(store.getItem(PROGRESS_KEY) || 'null'); if (p && p.v === 1) return { ...emptyProgress(), ...p, passed: { ...p.passed }, skipped: { ...p.skipped } }; } catch (e) { }
  return emptyProgress();
}
export function saveProgress(store, p) { try { store.setItem(PROGRESS_KEY, JSON.stringify(p)); return true; } catch (e) { return false; } }
export const isDone = (p, id) => !!(p.passed[id] || p.skipped[id]);
export const isUnlocked = (p, i) => i === 0 || isDone(p, LESSONS[i - 1].id);
export function markPassed(p, id) { p.passed[id] = true; delete p.skipped[id]; p.last = id; return p; }
export function markSkipped(p, id) { if (!p.passed[id]) p.skipped[id] = true; return p; }
export const nextLesson = p => LESSONS.findIndex((l, i) => isUnlocked(p, i) && !p.passed[l.id]);

// ---------- Learn overlay: one line per HUD readout ----------
export const GLOSSARY = {
  alt: 'Altitude above sea level. Space officially starts at the Kármán line, 100 km.',
  spd: 'Speed: "orbital" is relative to Earth\'s centre (what orbits care about); "air" is relative to the moving atmosphere (what drag and heating feel).',
  vs: 'Vertical speed: how fast you climb (+) or fall (−).',
  ap: 'Apoapsis: the highest point of your current orbit or arc if you cut the engine now.',
  pe: 'Periapsis: the lowest point. Above ~130 km it is a lasting orbit; below ground means you will come down.',
  mach: 'Mach: airspeed divided by the local speed of sound. Drag peaks near Mach 1.',
  q: 'Dynamic pressure q = ½ρv²: the air load on the rocket. Its peak is Max-Q.',
  aoa: 'Angle of attack: the angle between the nose and the oncoming air. Keep it small when q is high or the rocket breaks up.',
  g: 'G-load: felt acceleration in multiples of Earth gravity (1 g on the pad).',
  pitch: 'Pitch from vertical (0° straight up, 90° horizontal) and heading (90° = east).',
  sas: 'SAS: the attitude autopilot. RCS: small thrusters for extra torque and translation.',
  stage: 'Current stage. Stages fire from the bottom up; empty ones are dropped.',
  air: 'Outside air: temperature, density ρ and flow regime (continuum, transitional, free-molecular as the air thins out).',
  heat: 'Stagnation temperature T₀ and heat flux q̇ at the nose (Sutton–Graves): what heat shields are for.',
  thr: 'Throttle: share of full thrust.',
  fuel: 'Propellant left in each stage.',
  score: 'Score: altitude, space, orbit, recovery and booster landing bonuses × payload multiplier.',
  heatpanel: 'Part temperatures against their limits; the shield and its ablator; whether parachutes are safe to open.',
};
