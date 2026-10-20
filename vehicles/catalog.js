// Data-only real-world-inspired vehicles. Masses in kg, thrust in kN, Isp in s. No DOM, no game wiring yet.
// Sources: /workspace/game-studio/orbit-rush/specs/*.md (each value there carries its URL). "EST" = ESTIMATE (unsourced/derived).
// Ids are neutral; names via ./brand.js displayName(id).
export const ENGINES = {
  'kero-a':  { tSl: 318, tVac: 360,  ispSl: 245, ispVac: 290, src: 'specs/engines.md (kero-a ~340 kN; vac/Isp EST from 1C)', est: ['tVac', 'ispSl', 'ispVac'] },
  'kero-c':  { tSl: 420, tVac: 480,  ispSl: 275, ispVac: 304.8, src: 'specs/engines.md (kero-c, F9 v1.0)' },
  'kero-cv': { tSl: 0,   tVac: 617,  ispSl: 0,   ispVac: 342, src: 'specs/engines.md (kero-cv)' },
  'kero-d':  { tSl: 845, tVac: 914,  ispSl: 283, ispVac: 312, src: 'specs/falcon9.md (Block 5 stage 7,607/8,227 kN ÷ 9)', est: ['tSl', 'tVac'] },
  'kero-dv': { tSl: 0,   tVac: 981,  ispSl: 0,   ispVac: 348, src: 'specs/engines.md (kero-dv Block 5)' },
  'kero-p':  { tSl: 0,   tVac: 31,   ispSl: 0,   ispVac: 327, src: 'specs/falcon1.md (kero-p)' },
  'meth-3':  { tSl: 2452, tVac: 2697, ispSl: 327, ispVac: 350, src: 'specs/engines.md (meth-3 thrust; Isp from meth-2)', est: ['ispSl', 'ispVac'] },
  'meth-3v': { tSl: 0,   tVac: 2697, ispSl: 0,   ispVac: 380, src: 'specs/engines.md (meth-3v Isp 380; thrust EST = R3 vac)', est: ['tVac'] },
};
// stage: { engines:{id:n}, dry, prop, parallel? (burns together with the next stage), coreFrac? (share of next stage prop burned meanwhile), recovery, reserve (prop kept for recovery, EST) }
// payloadLEO: sourced expendable (or stated config) payload to LEO, kg. Stages listed in flight order.
export const VEHICLES = [
  { id: 'sparrow-1', src: 'specs/falcon1.md', liftoff: 33230, payloadLEO: 470, payloadNote: 'kero-c config, 185 km, 9° incl',
    stages: [
      { engines: { 'kero-c': 1 }, dry: 1750, prop: 27150, recovery: 'parachute-planned (never achieved)', est: ['dry', 'prop'] },
      { engines: { 'kero-p': 1 }, dry: 700, prop: 3600, recovery: 'expended', est: ['dry', 'prop'] },
    ], fairing: 0 },
  { id: 'heron-9', src: 'specs/falcon9.md', knownGap: 'sourced stage masses (Wikipedia/SpaceX 2015 page) give ~18.6 t ideal payload vs 22.8 t sourced; Block 5 stage masses not published', liftoff: 549000, payloadLEO: 22800, payloadLEOReuse: 17400, payloadGTO: 8300, payloadGTOReuse: 5500,
    stages: [
      { engines: { 'kero-d': 9 }, dry: 25600, prop: 395700, recovery: 'propulsive: drone ship or RTLS (expended for max payload)' },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 1900, fairingRecovery: 'parachute + water' },
  { id: 'heron-9-v11', src: 'specs/falcon9.md (v1.1)', liftoff: 506000, payloadLEO: 13150, payloadGTO: 4850,
    stages: [
      { engines: { 'kero-d': 9 }, dry: 26000, prop: 368000, ispOverride: [282, 311], recovery: 'expended (landing tests)', est: ['dry', 'prop'] },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 71000, tVacOverride: 801, ispOverride: [0, 340], recovery: 'expended', est: ['dry', 'prop'] },
    ], fairing: 1750, est: ['fairing'] },
  { id: 'heron-9-crew', src: 'specs/falcon9_crew_dragon.md', liftoff: 549000, payloadLEO: 12519, payloadNote: 'crew capsule launch mass; booster recovered', capacityLEO: 17400, // sourced F9 reusable LEO (specs/falcon9.md)
    capsule: { id: 'capsule-2', dry: 7700, launch: 12519, crew: 4, recovery: 'parachute splashdown', src: 'specs/dragon.md' },
    stages: [
      { engines: { 'kero-d': 9 }, dry: 25600, prop: 395700, reserve: 20000, recovery: 'propulsive landing (drone ship / LZ)', est: ['reserve'] },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 0 },
  { id: 'heron-heavy', src: 'specs/falcon_heavy.md', knownGap: 'per-core masses are F9 values (EST) that already underperform; 63.8 t is a theoretical figure', liftoff: 1420000, payloadLEO: 63800, payloadGTO: 26700,
    stages: [
      { engines: { 'kero-d': 18 }, dry: 2 * 27000, prop: 2 * 395700, parallel: true, coreFrac: 0.55, recovery: 'side boosters RTLS / drone ship', est: ['dry', 'prop', 'coreFrac'] },
      { engines: { 'kero-d': 9 }, dry: 29000, prop: 395700, recovery: 'center core drone ship (or expended)', est: ['dry', 'prop'] },
      { engines: { 'kero-dv': 1 }, dry: 3900, prop: 92670, recovery: 'expended' },
    ], fairing: 1900 },
  { id: 'titan-ss-v3', src: 'specs/starship.md (Block 3)', payloadLEO: 100000, payloadNote: 'reusable, both stages recovered',
    stages: [
      { engines: { 'meth-3': 33 }, dry: 275000, prop: 3650000, reserve: 350000, recovery: 'boostback + tower catch', est: ['reserve'] },
      { engines: { 'meth-3': 3, 'meth-3v': 3 }, dry: 160000, prop: 1600000, reserve: 40000, recovery: 'belly-flop entry, flip, catch/landing', est: ['dry', 'reserve'] },
    ], fairing: 0 },
  { id: 'titan-ss-v4', src: 'specs/starship.md (Block 4, planned)', payloadLEO: 200000, payloadNote: 'reusable, planned',
    stages: [
      { engines: { 'meth-3': 33 }, dry: 300000, prop: 4050000, reserve: 350000, recovery: 'boostback + tower catch', est: ['dry', 'reserve'] },
      { engines: { 'meth-3': 3, 'meth-3v': 6 }, dry: 150000, prop: 2300000, reserve: 50000, recovery: 'belly-flop entry, flip, catch', est: ['dry', 'reserve'] },
    ], fairing: 0 },
];
