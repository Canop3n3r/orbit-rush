// Company 'krunich' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed kr-.
export const ENGINES_KRUNICH = {
  'kr-u1': { tSl: 1755, tVac: 1946, ispSl: 285, ispVac: 316, src: 'spec:engines#kr-u1', est: ['tVac', 'ispVac'] },
  'kr-u2': { tSl: 0, tVac: 600, ispSl: 0, ispVac: 327, src: 'spec:engines#kr-u2 (stage thrust / 4)', est: ['tVac'] },
  'kr-u3': { tSl: 0, tVac: 613.8, ispSl: 0, ispVac: 325, src: 'spec:engines#kr-u3' },
};
export const ROSTER_KRUNICH = [
  { id: 'protonik', name: 'Protonik', company: 'krunich', src: 'spec:protonik', area: 43.0, fairing: 4000, est: ['fairing'],
    stages: [
      { engines: { 'kr-u1': 6 }, dry: 30600, prop: 428300, burn: 108, group: 0, recovery: 'expended' },
      { engines: { 'kr-u2': 4 }, dry: 11000, prop: 157300, burn: 206, group: 1, recovery: 'expended' },
      { engines: { 'kr-u3': 1 }, dry: 3500, prop: 46562, burn: 238, group: 2, recovery: 'expended' },
    ],
    modes: [{ variant: 'leo', payload: 23000, orbit: { hp: 180, ha: 180, inc: 51.5 }, src: 'spec:protonik#leo',
      knownGap: 'model ~+38 %: physics gravity loss EST below published range for a high-T/W stack' }],
    gto: 6920, flights: 116 },
];
