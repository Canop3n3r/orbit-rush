// Company 'northp' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed np-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_NORTHP = {
  'np-e1': { tSl: 501.6, tVac: 570.0, ispSl: 224.4, ispVac: 255.0, src: 'spec:engines#np-e1', est: ['tSl', 'ispSl'] },
  'np-e2': { tSl: 0, tVac: 140.0, ispSl: 0, ispVac: 255.0, src: 'spec:engines#np-e2' },
  'np-e3': { tSl: 0, tVac: 18.0, ispSl: 0, ispVac: 250.0, src: 'spec:engines#np-e3' },
  'np-e4': { tSl: 264.0, tVac: 300.0, ispSl: 0.0, ispVac: 0, src: 'spec:engines#np-e4', est: ['ispVac', 'tSl', 'ispSl'], unsourced: ['ispVac'] },
  'np-e5': { tSl: 0, tVac: 140.0, ispSl: 0, ispVac: 255.0, src: 'spec:engines#np-e5' },
  'np-e6': { tSl: 0, tVac: 18.0, ispSl: 0, ispVac: 0, src: 'spec:engines#np-e6', est: ['ispVac'], unsourced: ['ispVac'] },
};
export const ROSTER_NORTHP = [
  { id: 'pine-crest-1', name: "Pine Crest-1", company: 'northp', src: 'spec:pine-crest-1', area: 1.2, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'np-e1': 1}, dry: 3700, prop: 21900, burn: 95.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'np-e2': 1}, dry: 1500, prop: 6000, burn: 176.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'np-e3': 1}, dry: 50, prop: 150, burn: 27.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 50, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:pine-crest-1#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -40 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'starstream', name: "Starstream-ish", company: 'northp', src: 'spec:starstream', area: 4.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'np-e4': 4}, dry: 5000, prop: 55000, burn: 120.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'np-e5': 1}, dry: 1500, prop: 6000, burn: 176.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'np-e6': 1}, dry: 500, prop: 3500, burn: 27.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 50, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:starstream#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)']  , knownGap: "UNMODELLED: rocketdb has no vacuum Isp for np-e4, np-e6 (no invented figure); data request" }] },
];
