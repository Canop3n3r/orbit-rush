// Company 'firefly' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed ff-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_FIREFLY = {
  'ff-e1': { tSl: 161.9, tVac: 184.0, ispSl: 260.1, ispVac: 295.6, src: 'spec:engines#ff-e1', est: ['tSl', 'ispSl'] },
  'ff-e2': { tSl: 0, tVac: 70.1, ispSl: 0, ispVac: 322.0, src: 'spec:engines#ff-e2' },
};
export const ROSTER_FIREFLY = [
  { id: 'alpha-bug', name: "Alpha-Bug", company: 'firefly', src: 'spec:alpha-bug', area: 2.6, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'ff-e1': 4}, dry: 2895, prop: 42105, burn: 163.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'ff-e2': 1}, dry: 908, prop: 17092, burn: 314.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 1000, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: "spec:alpha-bug#ref (payload user's guide 2019-08-30: 1,000 kg to 200 km LEO at 28.5 deg; current guide 5.3 lists 1,030 kg LEO)", est: [] , knownGap: "model +25 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
