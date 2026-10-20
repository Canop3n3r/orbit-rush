// Company 'cnfoll' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed cf-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_CNFOLL = {
  'cf-e1': { tSl: 835.0, tVac: 835.0, ispSl: 0.0, ispVac: 0, src: 'spec:engines#cf-e1', est: ['tVac unknown (SL thrust stored; rocketdb isp_vac_unknown) ESTIMATE', 'ispVac'], unsourced: ['ispVac'] },
  'cf-e2': { tSl: 0, tVac: 690.0, ispSl: 0, ispVac: 0, src: 'spec:engines#cf-e2', est: ['ispVac'], unsourced: ['ispVac'] },
};
export const ROSTER_CNFOLL = [
  { id: 'granite-2', name: "Granite-2", company: 'cnfoll', src: 'spec:granite-2', area: 8.8, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'cf-e1': 9}, engineCount: 9, engineName: 'cf-e1', propellant: 'kerolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 51000, prop: 459000, burn: 1, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)', est: ['burn'] },
      { engines: {'cf-e2': 1}, engineCount: 1, engineName: 'cf-e2', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 10000, prop: 80000, burn: 1, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)', est: ['burn'] },
    ],
    modes: [{ variant: 'leo', payload: 12000, orbit: { hp: 185, ha: 185, inc: 41.0 }, src: "spec:granite-2#ref (12,000 kg LEO; launcher-comparison table, no user's guide found)", est: ['orbit 185 km / 41 deg (orbit unstated) ESTIMATE', 'secondary source only ESTIMATE']  , knownGap: "UNMODELLED: rocketdb has no vacuum Isp for cf-e1, cf-e2 (no invented figure); data request" }] },
];
