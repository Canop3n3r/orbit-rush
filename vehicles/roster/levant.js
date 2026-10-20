// Company 'levant' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed lv-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_LEVANT = {
  'lv-e1': { tSl: 682.0, tVac: 775.0, ispSl: 220.0, ispVac: 250.0, src: 'spec:engines#lv-e1', est: ['tSl', 'ispSl'] },
  'lv-e2': { tSl: 0, tVac: 775.0, ispSl: 0, ispVac: 250.0, src: 'spec:engines#lv-e2' },
  'lv-e3': { tSl: 0, tVac: 58.0, ispSl: 0, ispVac: 295.0, src: 'spec:engines#lv-e3' },
};
export const ROSTER_LEVANT = [
  { id: 'shavitron', name: "Shavitron", company: 'levant', src: 'spec:shavitron', area: 1.4, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'lv-e1': 1}, dry: 1200, prop: 11800, burn: 55.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'lv-e2': 1}, dry: 1200, prop: 11800, burn: 55.0, group: 1, recovery: 'expended', src: 'GCAT' },
      { engines: {'lv-e3': 1}, dry: 170, prop: 1830, burn: 92.0, group: 2, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 350, orbit: { hp: 250, ha: 1400, inc: 143.0 }, src: "spec:shavitron#ref (secondary aircraft/launcher reference site: about 350 kg to 250 x 1,400 km retrograde; no user's guide found)", est: ['inclination 143 deg (westward from the coastal site) ESTIMATE', 'secondary source only ESTIMATE'] , knownGap: "model -45 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
