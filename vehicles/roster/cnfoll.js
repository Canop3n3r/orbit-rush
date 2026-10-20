// Company 'cnfoll' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed cf-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_CNFOLL = {
  'cf-e1': { tSl: 733.3, tVac: 833.3, ispSl: 242.3, ispVac: 275.3, src: 'spec:engines#cf-e1', est: ['tSl', 'ispSl'] },
  'cf-e2': { tSl: 0, tVac: 690.0, ispSl: 0, ispVac: 275.3, src: 'spec:engines#cf-e2' },
};
export const ROSTER_CNFOLL = [
  { id: 'strongblade-2', name: "Strongblade-2", company: 'cnfoll', src: 'spec:strongblade-2', area: 8.8, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'cf-e1': 9}, dry: 51000, prop: 459000, burn: 165.2, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb f708c45)', est: ['burn'] },
      { engines: {'cf-e2': 1}, dry: 10000, prop: 80000, burn: 313.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb f708c45)', est: ['burn'] },
    ],
    modes: [{ variant: 'leo', payload: 12000, orbit: { hp: 185, ha: 185, inc: 41.0 }, src: "spec:strongblade-2#ref (12,000 kg LEO; launcher-comparison table, no user's guide found)", est: ['orbit 185 km / 41 deg (orbit unstated) ESTIMATE', 'secondary source only ESTIMATE'] , knownGap: "model -79 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
