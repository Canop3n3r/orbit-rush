// Company 'rockwell' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed rw-.
export const ENGINES_ROCKWELL = {
  'rw-h3':   { tSl: 1860, tVac: 2279, ispSl: 366, ispVac: 452.3, src: 'spec:engines#rw-h3' },
  'rw-s4':   { tSl: 13300, tVac: 14700, ispSl: 242, ispVac: 268, src: 'spec:engines#rw-s4' },
  'rw-s5':   { tSl: 14590, tVac: 16170, ispSl: 242, ispVac: 269, src: 'spec:engines#rw-s5', est: ['tVac', 'ispSl'] },
  'rw-h4':   { tSl: 0, tVac: 110.1, ispSl: 0, ispVac: 465.5, src: 'spec:engines#rw-h4' },
};
export const ROSTER_ROCKWELL = [
  { id: 'space-truck', name: 'Space Truck Stack (orbiter + tank + boosters)', company: 'rockwell', src: 'spec:space-truck', area: 100, fairing: 0, est: ['area'],
    publishedLoss: { grav: 1222, drag: 107 }, // spec:loss-model#published
    stages: [
      { engines: { 'rw-s4': 2 }, dry: 181437, prop: 997903, burn: 124, group: 0, recovery: 'parachute to sea, recovered' },
      // tank + orbiter: orbiter carried at its 110 t launch mass (EST: taken as excluding payload); tank prop = gross − empty
      { engines: { 'rw-h3': 3 }, dry: 26535 + 110000, prop: 735510, burn: 510, group: 0, recovery: 'orbiter runway landing; tank expended', est: ['dry'] },
    ],
    modes: [{ variant: 'leo', payload: 27500, orbit: { hp: 204, ha: 204, inc: 28.5 }, src: 'spec:space-truck#leo',
      knownGap: 'model +15.1 % at the edge; orbital-maneuvering burn and tank residuals not modelled' }],
    gto: 4940, flights: 135 },
  { id: 'super-lift', name: 'Super Lift System', company: 'rockwell', src: 'spec:super-lift', area: 76.9, fairing: 0,
    stages: [
      { engines: { 'rw-s5': 2 }, dry: 181437, prop: 1270059, burn: 126, group: 0, recovery: 'expended' },
      { engines: { 'rw-h3': 4 }, dry: 97934, prop: 987486, burn: 480, group: 0, recovery: 'expended', est: ['burn'] },
      { engines: { 'rw-h4': 1 }, dry: 3490, prop: 28576, burn: 1125, group: 1, recovery: 'expended' },
    ],
    modes: [{ variant: 'leo', payload: 95000, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: 'spec:super-lift#leo',
      knownGap: 'model ~+50 %: stage burnout masses (residuals, adapters) not sourced; physics gravity loss EST' }],
    tli: 27000, flights: 2 },
];
