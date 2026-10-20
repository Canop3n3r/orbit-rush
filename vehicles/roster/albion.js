// Company 'albion' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed ab-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_ALBION = {
  'ab-e1': { tSl: 220.9, tVac: 251.0, ispSl: 233.2, ispVac: 265.0, src: 'spec:engines#ab-e1', est: ['tSl', 'ispSl'] },
  'ab-e2': { tSl: 0, tVac: 69.0, ispSl: 0, ispVac: 251.0, src: 'spec:engines#ab-e2' },
  'ab-e3': { tSl: 0, tVac: 21.1, ispSl: 0, ispVac: 276.0, src: 'spec:engines#ab-e3' },
};
export const ROSTER_ALBION = [
  { id: 'dark-dart', name: "Dark Dart", company: 'albion', src: 'spec:dark-dart', area: 3.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'ab-e1': 1}, dry: 1070, prop: 13030, burn: 125.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'ab-e2': 1}, dry: 535, prop: 2965, burn: 113.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
      { engines: {'ab-e3': 1}, dry: 39, prop: 312, burn: 40.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)' },
    ],
    modes: [{ variant: 'leo', payload: 75, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:dark-dart#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +59 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
