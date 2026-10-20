// Company 'spacey' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed sp-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_SPACEY = {
  'sp-e1': { tSl: 662.0, tVac: 752.2, ispSl: 268.2, ispVac: 304.8, src: 'spec:engines#sp-e1', est: ['tSl', 'ispSl'] },
  'sp-e2': { tSl: 0, tVac: 801.0, ispSl: 0, ispVac: 345.0, src: 'spec:engines#sp-e2' },
  'sp-e3': { tSl: 369.9, tVac: 408.9, ispSl: 275, ispVac: 304, src: 'spec:engines#sp-e3', est: ['tSl (vac thrust x Isp ratio)'] },
  'sp-e4': { tSl: 369.9, tVac: 408.9, ispSl: 275, ispVac: 304, src: 'spec:engines#sp-e4', est: ['tSl (vac thrust x Isp ratio)'] },
  'sp-e5': { tSl: 0, tVac: 427.0, ispSl: 0, ispVac: 342.0, src: 'spec:engines#sp-e5' },
  'sp-e6': { tSl: 1933.3, tVac: 2197.0, ispSl: 0.0, ispVac: 0, src: 'spec:engines#sp-e6', est: ['ispVac', 'tSl', 'ispSl'], unsourced: ['ispVac'] },
  'sp-e7': { tSl: 0, tVac: 2083.3, ispSl: 0, ispVac: 0, src: 'spec:engines#sp-e7', est: ['ispVac'], unsourced: ['ispVac'] },
  'sp-e8': { tSl: 341.9, tVac: 378.0, ispSl: 275, ispVac: 304, src: 'spec:engines#sp-e8', est: ['tSl (vac thrust x Isp ratio)'] },
  'sp-e9': { tSl: 0, tVac: 33.0, ispSl: 0, ispVac: 317.0, src: 'spec:engines#sp-e9' },
  'sp-e10': { tSl: 593.0, tVac: 654.0, ispSl: 282, ispVac: 311, src: 'spec:engines#sp-e10', est: ['tSl (vac thrust x Isp ratio)'] },
};
export const ROSTER_SPACEY = [
  { id: 'heron-9', name: "Heron-9", company: 'spacey', src: 'spec:heron-9', area: 10.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sp-e1': 9}, dry: 18000, prop: 372000, burn: 180.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'sp-e2': 1}, dry: 4900, prop: 70800, burn: 372.0, group: 1, restart: true, restartSrc: 'spec:heron-9#restart (rocketdb per-stage restartable, cited)', recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 22800, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: "spec:heron-9#ref (manufacturer published LEO capability, expendable: 22,800 kg)", est: ['orbit 185 km / 28.5 deg (manufacturer states no orbit) ESTIMATE']}] },
  { id: 'heron-heavy', name: "Heron Heavy", company: 'spacey', src: 'spec:heron-heavy', area: 31.4, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sp-e3': 18}, dry: 35452, prop: 568548, burn: 174.0, group: 0, jettisonAt: 174.0, recovery: 'expended', src: 'GCAT' },
      { engines: {'sp-e4': 9}, dry: 17726, prop: 284274, burn: 174.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'sp-e5': 1}, dry: 2957, prop: 49043, burn: 345.0, group: 1, restart: true, restartSrc: 'spec:heron-heavy#restart (rocketdb per-stage restartable, cited)', recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 63800, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: "spec:heron-heavy#ref (manufacturer published LEO capability, expendable: 63,800 kg)", est: ['orbit 185 km / 28.5 deg (manufacturer states no orbit) ESTIMATE'] , knownGap: "model -44 %: fairing mass unsourced (0); final stage restartable: coast-and-restart flown; SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'titan-ss', name: "Colossus", company: 'spacey', src: 'spec:titan-ss', area: 63.6, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sp-e6': 33}, dry: 220000, prop: 3300000, burn: 330.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'sp-e7': 6}, dry: 120000, prop: 1180000, burn: 330.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 100000, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:titan-ss#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)']  , knownGap: "UNMODELLED: rocketdb has no vacuum Isp for sp-e6, sp-e7 (no invented figure); data request" }] },
  { id: 'sparrow-1', name: "Sparrow-1", company: 'spacey', src: 'spec:sparrow-1', area: 2.3, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sp-e8': 1}, dry: 1360, prop: 21540, burn: 169.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'sp-e9': 1}, dry: 544, prop: 3956, burn: 418.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 420, orbit: { hp: 185, ha: 185, inc: 9.1 }, src: "spec:sparrow-1#ref (user's guide rev. 7 via the 2009 small-satellite conference paper: 420 kg to 185 km circular at 9.1 deg, due east from the atoll site)", est: [] , knownGap: "model +34 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'hopper-h', name: "Hopper-H", company: 'spacey', src: 'spec:hopper-h', area: 10.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sp-e10': 9}, dry: 18000, prop: 372000, burn: 180.0, group: 0, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 13150, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:hopper-h#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model no orbit (test-vehicle variant, not an orbital configuration): GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
