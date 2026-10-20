// Company 'gaulois' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed ga-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_GAULOIS = {
  'ga-e1': { tSl: 346.1, tVac: 415.0, ispSl: 221, ispVac: 265.0, src: 'spec:engines#ga-e1', est: ['tSl (vac thrust x Isp ratio)'] },
  'ga-e2': { tSl: 0, tVac: 180.0, ispSl: 0, ispVac: 273, src: 'spec:engines#ga-e2' },
  'ga-e3': { tSl: 0, tVac: 52.5, ispSl: 0, ispVac: 280.0, src: 'spec:engines#ga-e3' },
};
export const ROSTER_GAULOIS = [
  { id: 'diamantine', name: "Diamantine", company: 'gaulois', src: 'spec:diamantine', area: 1.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'ga-e1': 1}, engineCount: 1, engineName: 'ga-e1', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 2500, prop: 17800, burn: 119.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'ga-e2': 1}, engineCount: 1, engineName: 'ga-e2', propellant: 'solid', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 350, prop: 4450, burn: 62.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'ga-e3': 1}, engineCount: 1, engineName: 'ga-e3', propellant: 'solid', nozzleLayout: { type: 'single' }, reusable: false, dry: 62, prop: 738, burn: 46.5, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 150, orbit: { hp: 500, ha: 500, inc: 5.0 }, src: "spec:diamantine#ref (manufacturer history: up to 150 kg to 500 km LEO; 5 deg inclination from the national space-history dossier)", est: [] , knownGap: "model +145 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
