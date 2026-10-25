// Company 'glowbug' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed ff-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_GLOWBUG = {
  'ff-e1': { tSl: 161.9, tVac: 184.0, ispSl: 260.1, ispVac: 295.6, src: 'spec:engines#ff-e1', est: ['tSl', 'ispSl'] },
  'ff-e2': { tSl: 0, tVac: 70.1, ispSl: 0, ispVac: 322.0, src: 'spec:engines#ff-e2' },
};
export const ROSTER_GLOWBUG = [
  { id: 'alpha-bug', name: "Alpha-Bug", company: 'glowbug', src: 'spec:alpha-bug', area: 2.6, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'ff-e1': 4}, engineCount: 4, engineName: 'ff-e1', propellant: 'kerolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 2895, prop: 41390, burn: 163.0, group: 0, recovery: 'expended', src: 'masses: GCAT + rocketdb (secondary: sky-brokers.com); engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'ff-e2': 1}, engineCount: 1, engineName: 'ff-e2', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 909, prop: 6971, burn: 314.0, group: 1, recovery: 'expended', src: 'masses: GCAT + rocketdb (secondary: sky-brokers.com); engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 1000, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: "spec:alpha-bug#ref (payload user's guide 2019-08-30: 1,000 kg to 200 km LEO at 28.5 deg; current guide 5.3 lists 1,030 kg LEO)", est: [] }] },
];
