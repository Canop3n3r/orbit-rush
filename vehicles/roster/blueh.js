// Company 'blueh' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed bh-.
// Stage data: spec:new-glendale (rocketdb ac3c84a): thrust from the payload user's guide and maker releases, burn times from NG-2,
// propellant loads derived from those burn times at rated flow (ESTIMATE), dry masses from published estimates (ESTIMATE).
export const ENGINES_BLUEH = {
  'bh-m1': { tSl: 2446, tVac: 2683, ispSl: 310, ispVac: 340, src: 'spec:engines#bh-m1', est: ['tVac', 'ispSl', 'ispVac'], ispEstimated: true },
  'bh-h1': { tSl: 0, tVac: 769.5, ispSl: 0, ispVac: 445, src: 'spec:engines#bh-h1', est: ['ispVac'], ispEstimated: true },
};
export const ROSTER_BLUEH = [
  { id: 'new-glendale', name: 'New Glen-Dale', company: 'blueh', src: 'spec:new-glendale', area: 38.5, fairing: 4000, est: ['fairing'],
    stages: [
      { engines: { 'bh-m1': 7 }, engineCount: 7, engineName: 'bh-m1', propellant: 'methalox', nozzleLayout: { type: 'cluster' }, reusable: true, estimated: true, estimatedFields: ['nozzleLayout'], dry: 110000, prop: 1109000, burn: 197, group: 0, restart: true, restartSrc: 'spec:new-glendale#restart', recovery: 'propulsive landing on ship', src: 'spec:new-glendale#stage1', est: ['dry', 'prop', 'burn'] }, // prop = MECO 185 s x rated flow + 67 t landing reserve (EST); burn = prop / rated flow
      { engines: { 'bh-h1': 2 }, engineCount: 2, engineName: 'bh-h1', propellant: 'hydrolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 20000, prop: 240000, burn: 681, group: 1, restart: true, restartSrc: 'spec:new-glendale#restart', recovery: 'expended', src: 'spec:new-glendale#stage2', est: ['dry', 'prop'] }, // prop = NG-2 burns 576 + 104 s x rated flow (EST)
    ],
    // sourced 45 t is quoted with booster recovery, so the model keeps the landing reserve in stage 1 (reserve, EST: spec:new-glendale#reserve)
    modes: [{ variant: 'leo', payload: 45000, orbit: { hp: 200, ha: 200, inc: 51.6 }, reserve: [67000, 0], src: 'spec:new-glendale#leo', est: ['reserve'] }],
    gto: 13600, tli: 7000, flights: 3 },
];
