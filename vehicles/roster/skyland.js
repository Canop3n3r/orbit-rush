// Company 'skyland' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed sk-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_SKYLAND = {
  'sk-e1': { tSl: 704.0, tVac: 800.0, ispSl: 311.5, ispVac: 354.0, src: 'spec:engines#sk-e1', est: ['tSl', 'ispSl'] },
  'sk-e2': { tSl: 0, tVac: 857.0, ispSl: 0, ispVac: 350.0, src: 'spec:engines#sk-e2' },
  'sk-e3': { tSl: 713.8, tVac: 811.1, ispSl: 311.5, ispVac: 354.0, src: 'spec:engines#sk-e3', est: ['tSl', 'ispSl'] },
  'sk-e4': { tSl: 0, tVac: 944.4, ispSl: 0, ispVac: 350.0, src: 'spec:engines#sk-e4' },
};
export const ROSTER_SKYLAND = [
  { id: 'ember-finch-2e', name: "Ember Finch-2E", company: 'skyland', src: 'spec:ember-finch-2e', area: 8.8, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sk-e1': 4}, engineCount: 4, engineName: 'sk-e1', propellant: 'methalox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 15000, prop: 135000, burn: 146.5, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)', est: ['burn'] },
      { engines: {'sk-e2': 1}, engineCount: 1, engineName: 'sk-e2', propellant: 'methalox', nozzleLayout: { type: 'single' }, reusable: false, dry: 5000, prop: 45000, burn: 180.2, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)', est: ['burn'] },
    ],
    modes: [{ variant: 'leo', payload: 4000, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:ember-finch-2e#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -36 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'ember-finch-3', name: "Ember Finch-3", company: 'skyland', src: 'spec:ember-finch-3', area: 15.9, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'sk-e3': 9}, engineCount: 9, engineName: 'sk-e3', propellant: 'methalox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 4000, prop: 381000, burn: 181.2, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)', est: ['burn'] },
      { engines: {'sk-e4': 1}, engineCount: 1, engineName: 'sk-e4', propellant: 'methalox', nozzleLayout: { type: 'single' }, reusable: false, dry: 1400, prop: 143600, burn: 521.9, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)', est: ['burn'] },
    ],
    modes: [{ variant: 'leo', payload: 12000, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:ember-finch-3#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +148 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
