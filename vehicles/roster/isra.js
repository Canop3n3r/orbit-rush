// Company 'isra' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed is-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_ISRA = {
  'is-e1': { tSl: 633.6, tVac: 720.0, ispSl: 230.6, ispVac: 262.0, src: 'spec:engines#is-e1', est: ['tSl', 'ispSl'] },
  'is-e2': { tSl: 4320.8, tVac: 4910.0, ispSl: 236.7, ispVac: 269.0, src: 'spec:engines#is-e2', est: ['tSl', 'ispSl'] },
  'is-e3': { tSl: 0, tVac: 724.0, ispSl: 0, ispVac: 293, src: 'spec:engines#is-e3' },
  'is-e4': { tSl: 0, tVac: 324.0, ispSl: 0, ispVac: 294.0, src: 'spec:engines#is-e4' },
  'is-e5': { tSl: 0, tVac: 7.4, ispSl: 0, ispVac: 308.0, src: 'spec:engines#is-e5' },
  'is-e6': { tSl: 441.8, tVac: 502.0, ispSl: 222.6, ispVac: 253.0, src: 'spec:engines#is-e6', est: ['tSl', 'ispSl'] },
  'is-e7': { tSl: 617.8, tVac: 702.0, ispSl: 227.9, ispVac: 259.0, src: 'spec:engines#is-e7', est: ['tSl', 'ispSl'] },
  'is-e8': { tSl: 0, tVac: 304.0, ispSl: 0, ispVac: 275.9, src: 'spec:engines#is-e8' },
  'is-e9': { tSl: 0, tVac: 90.7, ispSl: 0, ispVac: 277.0, src: 'spec:engines#is-e9' },
  'is-e10': { tSl: 0, tVac: 35.0, ispSl: 0, ispVac: 281.0, src: 'spec:engines#is-e10' },
};
export const ROSTER_ISRA = [
  { id: 'polar-slinger', name: "Polar Sat-Slinger", company: 'isra', src: 'spec:polar-slinger', area: 10.9, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'is-e1': 6}, dry: 12000, prop: 69000, burn: 49.0, group: 0, jettisonAt: 49.0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e2': 1}, dry: 30000, prop: 147000, burn: 105.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e3': 1}, dry: 5300, prop: 40500, burn: 158.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb f708c45)' },
      { engines: {'is-e4': 1}, dry: 1100, prop: 7300, burn: 83.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e5': 2}, dry: 920, prop: 1980, burn: 425.0, group: 3, restart: true, restartSrc: "spec:polar-slinger#restart (agency release: fourth stage restarted twice with a long coast)", recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
    ],
    modes: [{ variant: 'leo', payload: 1750, orbit: { hp: 600, ha: 600, inc: 97.8 }, src: "spec:polar-slinger#ref (agency: 1,750 kg to 600 km sun-synchronous polar orbit)", est: ['inclination 97.8 deg (600 km sun-synchronous) ESTIMATE'] , knownGap: "model +118 %: fairing mass unsourced (0); final stage restartable: coast-and-restart flown; SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'slinger-mk3', name: "Sat-Slinger Mk3", company: 'isra', src: 'spec:slinger-mk3', area: 2.4, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'is-e6': 2}, dry: 5926, prop: 17274, burn: 49.0, group: 0, jettisonAt: 49.0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e7': 1}, dry: 2900, prop: 8900, burn: 45.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e8': 1}, dry: 800, prop: 3600, burn: 36.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e9': 1}, dry: 650, prop: 1050, burn: 45.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'is-e10': 1}, dry: 195, prop: 305, burn: 33.0, group: 3, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
    ],
    modes: [{ variant: 'leo', payload: 150, orbit: { hp: 400, ha: 400, inc: 46.0 }, src: "spec:slinger-mk3#ref (agency: 150 kg class to 400 km circular)", est: ['inclination 46 deg (flown orbits) ESTIMATE'] , knownGap: "model no orbit: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
