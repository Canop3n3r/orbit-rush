// Company 'krunich' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed kr-.
export const ENGINES_KRUNICH = {
  'kr-u1': { tSl: 1667, tVac: 1833, ispSl: 285, ispVac: 316, src: 'spec:engines#kr-u1 (stage 10.0 / 11.0 MN ÷ 6, planner guide)', est: ['ispVac'] },
  'kr-u2': { tSl: 0, tVac: 600, ispSl: 0, ispVac: 327, src: 'spec:engines#kr-u2 (stage thrust / 4)', est: ['tVac'] },
  'kr-u3': { tSl: 0, tVac: 613.8, ispSl: 0, ispVac: 325, src: 'spec:engines#kr-u3' },
};
export const ROSTER_KRUNICH = [
  { id: 'gorynych', name: 'Gorynych', company: 'krunich', src: 'spec:gorynych', area: 43.0, fairing: 4000, est: ['fairing'],
    stages: [
      { engines: { 'kr-u1': 6 }, engineCount: 6, engineName: 'kr-u1', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 30600, prop: 428300, burn: 123, group: 0, recovery: 'expended' },
      { engines: { 'kr-u2': 4 }, engineCount: 4, engineName: 'kr-u2', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 11000, prop: 157300, burn: 215, group: 1, recovery: 'expended' },
      { engines: { 'kr-u3': 1 }, engineCount: 1, engineName: 'kr-u3', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 3500, prop: 46562, burn: 238, group: 2, recovery: 'expended' },
    ],
    modes: [{ variant: 'leo', payload: 23000, orbit: { hp: 180, ha: 180, inc: 51.5 }, src: 'spec:gorynych#leo', }],
    gto: 6920, flights: 116 },
];
