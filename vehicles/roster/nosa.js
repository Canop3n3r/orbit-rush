// Company 'nosa' roster vehicles (data only). Masses kg, thrust kN, Isp s, burn s. Values trace to neutral spec ids (resolved outside
// this repo); est lists ESTIMATE fields. group: 0 = lit at liftoff, higher = lit when the previous group is spent. Engines prefixed nosa-.
export const ENGINES_NOSA = {
  'nosa-k1': { tSl: 6770, tVac: 7770, ispSl: 263, ispVac: 304, src: 'spec:engines#nosa-k1' },
  'nosa-h1': { tSl: 486.2, tVac: 1033.1, ispSl: 200, ispVac: 421, src: 'spec:engines#nosa-h1' },
};
export const ROSTER_NOSA = [
  { id: 'saturnine-v', name: 'Saturnine V', company: 'nosa', src: 'spec:saturnine-v', area: 80.1, fairing: 0,
    // published ascent losses: gravity 1534, drag 40 m/s (spec:loss-model#published)
    publishedLoss: { grav: 1534, drag: 40, steer: 243 }, // spec:loss-model#published (steering from the same table)
    stages: [
      { engines: { 'nosa-k1': 5 }, engineCount: 5, engineName: 'nosa-k1', propellant: 'kerolox', nozzleLayout: { type: 'cluster', positions: [[0,0],[1,1],[1,-1],[-1,1],[-1,-1]] }, reusable: false, dry: 137439, prop: 2076600, burn: 150, group: 0, recovery: 'expended' },
      { engines: { 'nosa-h1': 5 }, engineCount: 5, engineName: 'nosa-h1', propellant: 'hydrolox', nozzleLayout: { type: 'cluster', positions: [[0,0],[1,1],[1,-1],[-1,1],[-1,-1]] }, reusable: false, dry: 43091, prop: 427285, burn: 395, group: 1, recovery: 'expended', note: 'dry incl. interstage' },
      { engines: { 'nosa-h1': 1 }, engineCount: 1, engineName: 'nosa-h1', propellant: 'hydrolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 15241, prop: 105233, burn: 477, group: 2, recovery: 'expended', note: 'dry incl. instrument unit; burn = both burns' },
    ],
    // sourced 140 t = total mass in orbit (spacecraft + third stage + its remaining propellant), so compared as orbitMass
    modes: [{ variant: 'leo', payload: 140000, orbitMass: true, orbit: { hp: 185, ha: 185, inc: 32.5 }, src: 'spec:saturnine-v#leo', est: ['orbit.inc'],
 }],
    tli: 43500, flights: 13 },
];
