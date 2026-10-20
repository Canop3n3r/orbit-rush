// Data-only real-world-inspired vehicles. Masses kg, thrust kN, Isp s. Not wired into the game yet.
// Every value traces to a neutral spec id ("spec:<id>"), resolved outside this repo. est: [...] lists ESTIMATE fields.
// Display names come from ./brand.js displayName(id).
export const ENGINES = {
  'kero-a':  { tSl: 318, tVac: 360,  ispSl: 245, ispVac: 290,   src: 'spec:engines#kero-a', est: ['tVac', 'ispSl', 'ispVac'] },
  'kero-c':  { tSl: 420, tVac: 480,  ispSl: 275, ispVac: 304.8, src: 'spec:engines#kero-c' },
  'kero-cv': { tSl: 0,   tVac: 617,  ispSl: 0,   ispVac: 342,   src: 'spec:engines#kero-cv' },
  'kero-d':  { tSl: 845, tVac: 914,  ispSl: 283, ispVac: 312,   src: 'spec:heron-9#stage1 (stage thrust / 9)', est: ['tSl', 'tVac'] },
  'kero-dv': { tSl: 0,   tVac: 981,  ispSl: 0,   ispVac: 348,   src: 'spec:engines#kero-dv' },
  'kero-p':  { tSl: 0,   tVac: 31,   ispSl: 0,   ispVac: 327,   src: 'spec:sparrow-1#stage2' },
  'meth-3':  { tSl: 2452, tVac: 2697, ispSl: 327, ispVac: 350,  src: 'spec:engines#meth-3 (Isp from meth-2)', est: ['ispSl', 'ispVac'] },
  'meth-3v': { tSl: 0,   tVac: 2697, ispSl: 0,   ispVac: 380,   src: 'spec:engines#meth-3v', est: ['tVac'] },
};
// stage: { engines:{id:n}, dry, prop, parallel? (burns alongside the next stage), coreFrac? (share of the next stage's prop burned meanwhile, EST), recovery }
// modes: payload figures paired with the recovery mode they were quoted for. reserve[i] = prop kept by stage i for its own recovery (EST).
// lat: launch-site latitude / quoted inclination in degrees (eastward Earth-rotation credit).
// Game engines use one mass flow per engine (mdot = Tvac / (IspVac·g0), SL thrust = Tvac·IspSl/IspVac). Sourced SL/vac
// thrust and SL/vac Isp pairs are not exactly consistent with that, so a vehicle with thrustAnchor 'sl' gets the vac
// thrust implied by its sourced SL thrust (EST, spec:ascent-heron-9#mdot): exact liftoff thrust and mass flow.
export const gameTVac = (e, anchor) => (anchor === 'sl' && e.tSl > 0 ? e.tSl * e.ispVac / e.ispSl : e.tVac);
export const VEHICLES = [
  { id: 'sparrow-1', src: 'spec:sparrow-1', lat: 9, liftoff: 33230,
    stages: [
      { engines: { 'kero-c': 1 }, dry: 2300, prop: 27150, recovery: 'parachute (planned, never achieved)', est: ['dry', 'prop'] },
      { engines: { 'kero-p': 1 }, dry: 800, prop: 3600, recovery: 'expended', est: ['dry', 'prop'] },
    ], fairing: 0,
    modes: [{ mode: 'expendable', payloadLEO: 470, src: 'spec:sparrow-1#payload (185 km)' }] },
  { id: 'heron-9', src: 'spec:heron-9', lat: 28.5, liftoff: 549000, payloadGTO: 8300, payloadGTOReuse: 5500,
    // game-flight data (spec:ascent-heron-9#game): body/fairing diameters sourced; AUTO throttle-bucket floor 0.8 EST
    diam: 3.7, fairingDiam: 5.2, thrustAnchor: 'sl', qFloor: 0.8, burnTime: 162,
    stages: [
      // Block 5 mass set (spec:heron-9#b5-tanks): empty mass + LOX/RP-1 tank capacities from one source; the older
      // web-table set (S1 25.6 / 395.7 t, S2 3.9 / 92.67 t, fairing 1.9 t) is kept only for derived vehicles below.
      { engines: { 'kero-d': 9 }, dry: 22200, prop: 410900, recovery: 'propulsive: drone ship / return to site, or expended' },
      { engines: { 'kero-dv': 1 }, dry: 4000, prop: 107500, recovery: 'expended' },
    ], fairing: 1700, fairingRecovery: 'parachute + water',
    // S2 reserve 2.5 t (EST, spec:heron-9#s2-reserve): unusable residuals (~1 %) + deorbit/passivation burn (~100-150 m/s).
    modes: [{ mode: 'expendable', payloadLEO: 22800, reserve: [0, 2500], src: 'spec:heron-9#leo-expendable', est: ['reserve'] },
            { mode: 'drone-ship', payloadLEO: 17400, reserve: [42000, 2500], src: 'spec:heron-9#leo-reusable', est: ['reserve'] }] },
  { id: 'heron-9-v11', src: 'spec:heron-9#v1.1', lat: 28.5, liftoff: 506000, payloadGTO: 4850,
    stages: [
      { engines: { 'kero-d': 9 }, dry: 28000, prop: 400000, ispOverride: [282, 311], recovery: 'expended (landing tests)', est: ['dry', 'prop'] },
      { engines: { 'kero-dv': 1 }, dry: 4500, prop: 55000, tVacOverride: 801, ispOverride: [0, 340], recovery: 'expended', est: ['dry', 'prop'] },
    ], fairing: 1750, est: ['fairing'],
    // Published v1.1 figure withheld ~30 % for powered-return tests (spec:heron-9#v1.1-margin), so pair it with a stage-1 reserve.
    modes: [{ mode: 'published (stage-1 return-test reserve)', payloadLEO: 13150, reserve: [19000, 0], src: 'spec:heron-9#v1.1-leo', est: ['reserve'] }] },
  { id: 'heron-9-crew', src: 'spec:heron-9-crew', lat: 28.5, liftoff: 549000,
    capsule: { id: 'capsule-2', dry: 7700, launch: 12519, crew: 4, recovery: 'parachute splashdown', src: 'spec:capsule-2' },
    stages: [
      // Block 5 mass set (spec:heron-9#b5-tanks), same as heron-9; S2 reserve 2.5 t EST (spec:heron-9#s2-reserve)
      { engines: { 'kero-d': 9 }, dry: 22200, prop: 410900, recovery: 'propulsive landing (drone ship / landing zone)' },
      { engines: { 'kero-dv': 1 }, dry: 4000, prop: 107500, recovery: 'expended' },
    ], fairing: 0,
    modes: [{ mode: 'drone-ship', payloadLEO: 17400, reserve: [42000, 2500], src: 'spec:heron-9#leo-reusable (capacity; capsule 12.5 t)', est: ['reserve'] }] },
  { id: 'heron-heavy', src: 'spec:heron-heavy', lat: 28.5, liftoff: 1420000, payloadGTO: 26700,
    stages: [
      // Block 5 S1 base (spec:heron-9#b5-tanks: 22.2 t / 410.9 t per core). EST deltas (spec:heron-heavy#core-deltas):
      // side booster +1.0 t nosecone/attach; center core +10 % structure (22.2 -> 24.4 t) for side-booster loads.
      { engines: { 'kero-d': 18 }, dry: 2 * 23200, prop: 2 * 410900, parallel: true, coreFrac: 0.825, recovery: 'side boosters: return to site / drone ship', est: ['dry', 'coreFrac'] }, // coreFrac = side burn 154.3 s / core burn 187 s (spec:heron-heavy), constant-flow assumption
      { engines: { 'kero-d': 9 }, dry: 24400, prop: 410900, recovery: 'center core: drone ship, or expended', est: ['dry'] },
      { engines: { 'kero-dv': 1 }, dry: 4000, prop: 107500, recovery: 'expended' },
    ], fairing: 1700,
    // Reusable LEO figures (57 t / <50 t) are unsourced in spec:heron-heavy, so only the expendable figure is tested.
    // Documented exception (owner decision): 63.8 t is an advertised theoretical max, structurally limited and never flown (spec:heron-heavy),
    // so payload is checked against a 50-64 t band instead of +/-8 %.
    modes: [{ mode: 'expendable', payloadLEO: 63800, payloadBand: [50000, 64000], reserve: [0, 0, 2500], src: 'spec:heron-heavy#leo-expendable', est: ['reserve'] }] },
  { id: 'titan-ss-v3', src: 'spec:titan-ss#v3', lat: 26, est: ['lat'],
    stages: [
      { engines: { 'meth-3': 33 }, dry: 275000, prop: 3650000, recovery: 'boostback + tower catch' },
      { engines: { 'meth-3': 3, 'meth-3v': 3 }, dry: 170000, prop: 1600000, recovery: 'belly-flop entry, flip, catch / landing', est: ['dry'] },
    ], fairing: 0,
    modes: [{ mode: 'fully-reusable', payloadLEO: 100000, reserve: [450000, 60000], src: 'spec:titan-ss#v3-payload', est: ['reserve'] }] },
  { id: 'titan-ss-v4', src: 'spec:titan-ss#v4 (planned)', lat: 26, est: ['lat'],
    stages: [
      { engines: { 'meth-3': 33 }, dry: 320000, prop: 4050000, recovery: 'boostback + tower catch', est: ['dry'] },
      { engines: { 'meth-3': 3, 'meth-3v': 6 }, dry: 185000, prop: 2300000, recovery: 'belly-flop entry, flip, catch', est: ['dry'] },
    ], fairing: 0,
    modes: [{ mode: 'fully-reusable', payloadLEO: 200000, reserve: [450000, 70000], src: 'spec:titan-ss#v4-payload', est: ['reserve'] }] },
];

// Mission variants of the Mk III super-heavy stack (data only; spec:titan-ss-missions). Built from titan-ss-v3 so shared
// numbers stay in one place; only the listed fields differ. Kept out of VEHICLES because their "payload" is not a LEO
// payload quote (propellant cargo, surface payloads), so the LEO ±8 % check does not apply; see tests/mission_vehicles.mjs.
const V3 = VEHICLES.find(v => v.id === 'titan-ss-v3');
const variant = (id, src, ship, extra) => ({ id, base: 'titan-ss-v3', src, lat: V3.lat, est: ['lat'], fairing: 0,
  stages: [{ ...V3.stages[0] }, { ...V3.stages[1], ...ship }], ...extra });
export const MISSION_VARIANTS = [
  // Propellant carrier: cargo is transferable propellant. ~150 t per flight sourced (spec:titan-ss-missions#tanker); dry EST.
  variant('titan-ss-tanker', 'spec:titan-ss-missions#tanker', { recovery: 'belly-flop entry, flip, catch' },
    { role: 'tanker', cargoProp: 150000, cargoPropRange: [100000, 150000], reserve: V3.modes[0].reserve, est: ['lat', 'reserve'] }),
  // Orbital depot: stays in LEO, stores transferred propellant; capacity and dry mass unsourced (EST: ~ship tank capacity).
  variant('titan-ss-depot', 'spec:titan-ss-missions#depot', { recovery: 'none (stays in orbit)', dry: 150000, est: ['dry'] },
    { role: 'depot', storageCap: 1600000, tankersPerFill: [4, 16], est: ['lat', 'storageCap'] }),
  // Lunar lander: no heat shield/flaps; refilled in LEO. Tank ~1,200 t sourced; dry ~85–100 t EST; surface payload ~100 t EST.
  variant('titan-ss-lunar', 'spec:titan-ss-missions#lunar', { recovery: 'none (stays in lunar space)', dry: 100000, dryRange: [85000, 100000], prop: 1200000, est: ['dry'] },
    { role: 'lunar-lander', payloadSurface: 100000, dvNeed: 5900, tankersPerFill: [4, 16], est: ['lat', 'payloadSurface', 'dvNeed'] }),
  // Mars ship: >100 t to Mars surface after orbital refill (sourced architecture figure); ship dry EST from Mk III.
  variant('titan-ss-mars', 'spec:titan-ss-missions#mars', { recovery: 'aerobraked entry, propulsive landing on Mars' },
    { role: 'mars-transport', payloadSurface: 100000, dvNeed: 4200, est: ['lat', 'dvNeed'] }),
];
// Payload items (not vehicles): mass carried by a vehicle mode; the catalog has no payload registry, so this is a plain list.
export const PAYLOADS = [
  { id: 'roadster-payload', mass: 1300, massRange: [1250, 1350], kind: 'demo mass (car + mount)', carrier: 'heron-heavy', orbit: 'heliocentric', src: 'spec:roadster-payload' },
];

// Roster company 'redstar' (data only, neutral ids; spec:loss-model): see vehicles/roster/redstar.js
export { ROSTER_REDSTAR, ENGINES_REDSTAR } from './roster/redstar.js';
// Roster company 'calt' (data only, neutral ids; spec:loss-model): see vehicles/roster/calt.js
export { ROSTER_CALT, ENGINES_CALT } from './roster/calt.js';
// Roster company 'nosa' (data only, neutral ids; spec:loss-model): see vehicles/roster/nosa.js
export { ROSTER_NOSA, ENGINES_NOSA } from './roster/nosa.js';
// Roster company 'rockwell' (data only, neutral ids; spec:loss-model): see vehicles/roster/rockwell.js
export { ROSTER_ROCKWELL, ENGINES_ROCKWELL } from './roster/rockwell.js';
// Roster company 'ulx' (data only, neutral ids; spec:loss-model): see vehicles/roster/ulx.js
export { ROSTER_ULX, ENGINES_ULX } from './roster/ulx.js';
// Roster company 'rlab' (data only, neutral ids; spec:loss-model): see vehicles/roster/rlab.js
export { ROSTER_RLAB, ENGINES_RLAB } from './roster/rlab.js';
// Roster company 'arion' (data only, neutral ids; spec:loss-model): see vehicles/roster/arion.js
export { ROSTER_ARION, ENGINES_ARION } from './roster/arion.js';
// Roster company 'krunich' (data only, neutral ids; spec:loss-model): see vehicles/roster/krunich.js
export { ROSTER_KRUNICH, ENGINES_KRUNICH } from './roster/krunich.js';
// Roster company 'blueh' (data only, neutral ids; spec:loss-model): see vehicles/roster/blueh.js
export { ROSTER_BLUEH, ENGINES_BLUEH } from './roster/blueh.js';
// Roster company 'martell' (data only, neutral ids; spec:loss-model): see vehicles/roster/martell.js
export { ROSTER_MARTELL, ENGINES_MARTELL } from './roster/martell.js';
// Roster company 'convair' (data only, neutral ids; spec:loss-model): see vehicles/roster/convair.js
export { ROSTER_CONVAIR, ENGINES_CONVAIR } from './roster/convair.js';
// Roster company 'douglas' (data only, neutral ids; spec:loss-model): see vehicles/roster/douglas.js
export { ROSTER_DOUGLAS, ENGINES_DOUGLAS } from './roster/douglas.js';
// Roster company 'yuzhno' (data only, neutral ids; spec:loss-model): see vehicles/roster/yuzhno.js
export { ROSTER_YUZHNO, ENGINES_YUZHNO } from './roster/yuzhno.js';
// Roster company 'jaxo' (data only, neutral ids; spec:loss-model): see vehicles/roster/jaxo.js
export { ROSTER_JAXO, ENGINES_JAXO } from './roster/jaxo.js';
// Roster company 'isra' (data only, neutral ids; spec:loss-model): see vehicles/roster/isra.js
export { ROSTER_ISRA, ENGINES_ISRA } from './roster/isra.js';
// Roster company 'orbitron' (data only, neutral ids; spec:loss-model): see vehicles/roster/orbitron.js
export { ROSTER_ORBITRON, ENGINES_ORBITRON } from './roster/orbitron.js';
// Roster company 'albion' (data only, neutral ids; spec:loss-model): see vehicles/roster/albion.js
export { ROSTER_ALBION, ENGINES_ALBION } from './roster/albion.js';
