// Company 'rocketwell' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed rw-.
export const ENGINES_ROCKETWELL = {
  'rw-h3':   { tSl: 1860, tVac: 2279, ispSl: 366, ispVac: 452.3, src: 'spec:engines#rw-h3' },
  'rw-s4':   { tSl: 13300, tVac: 14700, ispSl: 242, ispVac: 268, src: 'spec:engines#rw-s4' },
  'rw-s5':   { tSl: 14590, tVac: 16170, ispSl: 242, ispVac: 269, src: 'spec:engines#rw-s5', est: ['tVac', 'ispSl'] },
  'rw-h4':   { tSl: 0, tVac: 110.1, ispSl: 0, ispVac: 465.5, src: 'spec:engines#rw-h4' },
};
export const ROSTER_ROCKETWELL = [
  { id: 'space-truck', name: 'Space Truck Stack', company: 'rocketwell', src: 'spec:space-truck', area: 100, fairing: 0, est: ['area'],
    publishedLoss: { grav: 1222, drag: 107, steer: 358 }, // spec:loss-model#published
    stages: [
      { engines: { 'rw-s4': 2 }, engineCount: 2, engineName: 'rw-s4', propellant: 'solid', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 181437, prop: 997903, burn: 124, group: 0, recovery: 'parachute to sea, recovered' },
      // tank + orbiter: orbiter carried at its 110 t launch mass (EST: taken as excluding payload); tank prop = gross − empty
      { engines: { 'rw-h3': 3 }, engineCount: 3, engineName: 'rw-h3', propellant: 'hydrolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 26535 + 110000, prop: 735510, burn: 510, group: 0, recovery: 'orbiter runway landing; tank expended', est: ['dry'] },
    ],
    modes: [{ variant: 'leo', payload: 27500, orbit: { hp: 204, ha: 204, inc: 28.5 }, src: 'spec:space-truck#leo',
 knownGap: 'model −26 %: dominated by orbiter mass. Agency mass-properties records give orbiter liftoff mass (excl. payload, incl. OMS prop) of 99.5–119.5 t across early flights; over that range the model gives 30.8 → 10.9 t. No source ties the 27.5 t figure to one orbiter mass, so 110 t stays ESTIMATE. The published budget (injection at 111 km, +144 m/s OMS from orbiter prop already inside its mass) needs no extra term.' }],
    gto: 4940, flights: 135 },
  { id: 'super-lift', name: 'Super Lift System', company: 'rocketwell', src: 'spec:super-lift', area: 76.9, fairing: 0,
    stages: [
      { engines: { 'rw-s5': 2 }, engineCount: 2, engineName: 'rw-s5', propellant: 'solid', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 181437, prop: 1270059, burn: 126, group: 0, recovery: 'expended' },
      { engines: { 'rw-h3': 4 }, engineCount: 4, engineName: 'rw-h3', propellant: 'hydrolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 97934, prop: 987486, burn: 480, group: 0, recovery: 'expended', est: ['burn'] },
      { engines: { 'rw-h4': 1 }, engineCount: 1, engineName: 'rw-h4', propellant: 'hydrolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 4000, prop: 27000, burn: 1125, group: 1, recovery: 'expended', src: 'spec:super-lift#vds (agency vehicle data summary: burnout ~4,000 kg, impulse prop ~27,000 kg)', est: ['dry', 'prop'] },
    ],
    modes: [{ variant: 'leo', payload: 95000, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: 'spec:super-lift#leo',
 knownGap: 'model over-predicts: core-stage reference (below) is also high, so the booster/core inputs over-perform; booster pair dry mass is the four-segment value (EST)' },
      // agency vehicle data summary: boosters + core deliver 81.0 t (incl. the upper stage) to −110 × 241 km, 28.5° (spec:super-lift#vds)
      { variant: 'core-ref', stagesUsed: 2, payload: 81000, orbit: { hp: -110, ha: 241, inc: 28.5 }, src: 'spec:super-lift#vds', knownGap: 'same cause as leo; source predates the 95 t figure (era mismatch possible)' }],
    tli: 27000, flights: 2 },
];
