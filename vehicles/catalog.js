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
export const VEHICLES = [
  { id: 'sparrow-1', src: 'spec:sparrow-1', lat: 9, liftoff: 33230,
    stages: [
      { engines: { 'kero-c': 1 }, dry: 2300, prop: 27150, recovery: 'parachute (planned, never achieved)', est: ['dry', 'prop'] },
      { engines: { 'kero-p': 1 }, dry: 800, prop: 3600, recovery: 'expended', est: ['dry', 'prop'] },
    ], fairing: 0,
    modes: [{ mode: 'expendable', payloadLEO: 470, src: 'spec:sparrow-1#payload (185 km)' }] },
  { id: 'heron-9', src: 'spec:heron-9', lat: 28.5, liftoff: 549000, payloadGTO: 8300, payloadGTOReuse: 5500,
    stages: [
      { engines: { 'kero-d': 9 }, dry: 25600, prop: 395700, recovery: 'propulsive: drone ship / return to site, or expended' },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 1900, fairingRecovery: 'parachute + water',
    modes: [{ mode: 'expendable', payloadLEO: 22800, src: 'spec:heron-9#leo-expendable' },
            { mode: 'drone-ship', payloadLEO: 17400, reserve: [42000, 0], src: 'spec:heron-9#leo-reusable', est: ['reserve'] }] },
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
      { engines: { 'kero-d': 9 }, dry: 25600, prop: 395700, recovery: 'propulsive landing (drone ship / landing zone)' },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 0,
    modes: [{ mode: 'drone-ship', payloadLEO: 17400, reserve: [42000, 0], src: 'spec:heron-9#leo-reusable (capacity; capsule 12.5 t)', est: ['reserve'] }] },
  { id: 'heron-heavy', src: 'spec:heron-heavy', lat: 28.5, liftoff: 1420000, payloadGTO: 26700,
    stages: [
      { engines: { 'kero-d': 18 }, dry: 2 * 26600, prop: 2 * 395700, parallel: true, coreFrac: 0.825, recovery: 'side boosters: return to site / drone ship', est: ['dry', 'coreFrac'] }, // coreFrac = side burn 154.3 s / core burn 187 s (spec:heron-heavy), constant-flow assumption
      { engines: { 'kero-d': 9 }, dry: 27000, prop: 395700, recovery: 'center core: drone ship, or expended', est: ['dry'] },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 1900,
    // Reusable LEO figures (57 t / <50 t) are unsourced in spec:heron-heavy, so only the expendable figure is tested.
    modes: [{ mode: 'expendable', payloadLEO: 63800, src: 'spec:heron-heavy#leo-expendable' }] },
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
