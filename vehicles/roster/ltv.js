// Company 'ltv' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed lt-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_LTV = {
  'lt-e1': { tSl: 352.0, tVac: 400.0, ispSl: 227.8, ispVac: 258.9, src: 'spec:engines#lt-e1', est: ['tSl', 'ispSl'] },
  'lt-e2': { tSl: 0, tVac: 259.0, ispSl: 0, ispVac: 281.9, src: 'spec:engines#lt-e2' },
  'lt-e3': { tSl: 0, tVac: 93.0, ispSl: 0, ispVac: 281.4, src: 'spec:engines#lt-e3' },
  'lt-e4': { tSl: 0, tVac: 25.0, ispSl: 0, ispVac: 284.1, src: 'spec:engines#lt-e4' },
  'lt-e5': { tSl: 374.5, tVac: 413.0, ispSl: 214, ispVac: 236, src: 'spec:engines#lt-e5', est: ['tSl (vac thrust x Isp ratio)'] },
  'lt-e6': { tSl: 0, tVac: 235.0, ispSl: 0, ispVac: 254.3, src: 'spec:engines#lt-e6' },
  'lt-e7': { tSl: 0, tVac: 60.0, ispSl: 0, ispVac: 255.0, src: 'spec:engines#lt-e7' },
  'lt-e8': { tSl: 0, tVac: 13.0, ispSl: 0, ispVac: 256, src: 'spec:engines#lt-e8' },
};
export const ROSTER_LTV = [
  { id: 'scoutling', name: "Scoutling", company: 'ltv', src: 'spec:scoutling', area: 0.8, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'lt-e1': 1}, dry: 1170, prop: 9530, burn: 80.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'lt-e2': 1}, dry: 565, prop: 3435, burn: 37.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'lt-e3': 1}, dry: 107, prop: 1193, burn: 36.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'lt-e4': 1}, dry: 32, prop: 268, burn: 30.5, group: 3, spin: true, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 143, orbit: { hp: 555, ha: 555, inc: 37.9 }, src: "spec:scoutling#leo (GCAT LEO capacity; the program quotes capability at its 555 km circular design orbit from the east-coast range: space-congress paper and small-satellite conference paper)", est: ['applying the program reference orbit to the GCAT figure ESTIMATE', 'inclination = east-coast range latitude ESTIMATE'] , knownGap: "model +118 %: Scout-program 555 km reference orbit applied to the GCAT figure (ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'blue-scoutling', name: "Blue Scoutling", company: 'ltv', src: 'spec:blue-scoutling', area: 0.8, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'lt-e5': 1}, dry: 1380, prop: 9320, burn: 44.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'lt-e6': 1}, dry: 783, prop: 3417, burn: 38.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'lt-e7': 1}, dry: 240, prop: 960, burn: 38.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'lt-e8': 1}, dry: 94, prop: 206, burn: 39.0, group: 3, spin: true, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 50, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:blue-scoutling#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] }] },
];
