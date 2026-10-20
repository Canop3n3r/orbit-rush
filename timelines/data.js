// Real flight timelines (seconds after liftoff) for the data-only vehicles, by neutral mission id.
// Sources resolve outside the repo via spec:<id>. alt/vel: approximate, ESTIMATE unless noted (see spec sheets).
// AUTO-comparable events: maxq, stage1Sep (booster/first-stage cutoff+sep), stage2Sep (core sep, three-core only),
// seco, entryBurn, landingBurn, boosterLanded. Others are kept as reference data.
export const MISSIONS = [
  { id: 'heron-9-constellation-ship', vehicle: 'heron-9', mode: 'drone-ship', payload: 17400, src: 'spec:timeline-heron-9-constellation',
    countdown: { propLoadGo: -2280, rp1Load: -2100, s1LoxLoad: -2100, s2LoxLoad: -960, engineChill: -420, finalChecks: -60, goForLaunch: -45, ignition: -3 },
    events: { maxq: 72, meco: 147, stage1Sep: 150, ses1: 157, fairing: 178, entryBurn: 360, entryBurnEnd: 380, landingBurn: 474, boosterLanded: 496, seco: 520, payloadDeploy: 3709 },
    state: { maxq: { alt: 12000, vel: 500 }, meco: { alt: 68000, vel: 2300 }, seco: { alt: 200000, vel: 7600 } }, recovery: 'drone ship ~600 km downrange (EST)' },
  { id: 'heron-9-rideshare-rtls', vehicle: 'heron-9', mode: 'drone-ship', reserve: 84000, payload: 8000, est: ['reserve', 'payload'], src: 'spec:timeline-heron-9-rtls',
    events: { maxq: 72, meco: 137, stage1Sep: 140, ses1: 148, boostback: 153, boostbackEnd: 200, fairing: 226, entryBurn: 404, entryBurnEnd: 427, landingBurn: 478, boosterLanded: 510, seco: 503 },
    state: { meco: { alt: 60000, vel: 1700 } }, recovery: 'return to launch site (landing zone ~10 km from pad, EST)' },
  { id: 'heron-9-crew-iss', vehicle: 'heron-9-crew', reserve: 84000, payload: 12519, est: ['reserve'], src: 'spec:timeline-heron-9-crew',
    countdown: { propLoadGo: -2700, accessArmRetract: -2520, escapeArmed: -2340, rp1Load: -2100, s2LoxLoad: -960, engineChill: -420, internalPower: -300, goForLaunch: -45, ignition: -3 },
    events: { maxq: 72, meco: 144, stage1Sep: 147, flip: 151, ses1: 155, boostback: 161, boostbackEnd: 207, entryBurn: 380, entryBurnEnd: 393, landingBurn: 444, boosterLanded: 461, seco: 527, capsuleSep: 579, noseconeOpen: 625 },
    state: { meco: { alt: 65000, vel: 1900 } }, recovery: 'return to launch site; capsule to orbit' },
  { id: 'heron-heavy-side-rtls', vehicle: 'heron-heavy', reserve: 84000, payload: 10000, est: ['reserve', 'payload'], src: 'spec:timeline-heron-heavy',
    countdown: { propLoadGo: -3180, s1Rp1Load: -3000, s1LoxLoad: -2700, s2Rp1Load: -2100, s2LoxLoad: -1110, engineChill: -420, finalChecks: -59, goForLaunch: -45, pressurize: -20, ignition: -6 },
    events: { maxq: 68, beco: 144, stage1Sep: 147, flip: 152, boostback: 163, boostbackEnd: 228, meco: 231, stage2Sep: 234, ses1: 240, fairing: 255, entryBurn: 379, entryBurnEnd: 389, landingBurn: 443, boosterLanded: 460, seco: 508 },
    recovery: 'side boosters return to two landing zones; core expended or drone ship' },
  // Block 3 (catalog v3) data: spec:timeline-titan-ss-catch#v3-f14 (most nominal v3 booster: full boostback, 11/13-engine landing burn).
  // No v3 booster catch has occurred (v3 flights 1-3 all ended in sea splashdown), so boosterLanded = landing-burn shutdown (catch proxy, est).
  { id: 'titan-ss-catch', vehicle: 'titan-ss-v3', src: 'spec:timeline-titan-ss-catch#v3-f14',
    note: 'v3 event times sourced; no v3 catch yet, catch time is a proxy; Block 1 catch flight kept as fallback',
    countdown: { propLoadGo: -3000, boosterLox: -2193, boosterFuel: -2100, shipLox: -2053, shipFuel: -2051, engineChill: -1300, boosterLoadDone: -170, shipLoadDone: -130, goForLaunch: -30, flameDiverter: -17, ignition: -3 },
    events: { maxq: 58, meco: 140, stage1Sep: 142, boostback: 147, boostbackEnd: 187, landingBurn: 395, boosterLanded: 421, seco: 491, orbitInsertion: 1528, deployStart: 2058, deployEnd: 3890 },
    est: ['boosterLanded'],
    alt: { v3f12: { maxq: 45, meco: 142, stage1Sep: 144, boostback: 150, landingBurn: 394, seco: 491 }, v3f13: { maxq: 58, meco: 138, stage1Sep: 141, boostback: 145, landingBurn: 387, seco: 485 } },
    fallback: { src: 'spec:timeline-titan-ss-catch#b1-f5', maxq: 62, meco: 153, stage1Sep: 158, boostback: 163, boostbackEnd: 219, landingBurn: 388, boosterLanded: 412, seco: 505, boostbackApogee: 96000 },
    state: { est: 'altitudes/velocities not published in sourced tables' }, recovery: 'v3: booster sea splashdown (no catch yet); target profile: tower-arm catch' },
];
// Events AUTO is compared against (±15 %).
export const AUTO_EVENTS = ['maxq', 'stage1Sep', 'stage2Sep', 'seco', 'entryBurn', 'landingBurn', 'boosterLanded'];
export const GROUND = {
  'drone-ship': { deck: [91, 52], src: 'spec:ground#drone-ship (300 x 170 ft)', downrange: { lowInclination: 600000, est: true, firstTest: 320000 } },
  'catch-tower': { height: 146, armSpan: 'EST', launchTable: 370, src: 'spec:ground#tower (height EST; table 370 t sourced)', est: ['height'] },
  'landing-zone': { padDiameter: 86, est: true, src: 'spec:ground#landing-zone (EST)' },
};
