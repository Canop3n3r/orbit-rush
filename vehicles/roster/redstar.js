// Company 'redstar' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed ko-.
export const ENGINES_REDSTAR = {
  'ko-k1':  { tSl: 838.5, tVac: 1021.3, ispSl: 262, ispVac: 319, src: 'spec:engines#ko-k1' },
  'ko-k2':  { tSl: 792.5, tVac: 990.2, ispSl: 255, ispVac: 319, src: 'spec:engines#ko-k2' },
  'ko-k3':  { tSl: 0, tVac: 294.3, ispSl: 0, ispVac: 359, src: 'spec:engines#ko-k3' },
  'ko-m15': { tSl: 1526, tVac: 1544, ispSl: 284, ispVac: 330, src: 'spec:engines#ko-m15 (Isp: draft-project set)' },
  'ko-m15v':{ tSl: 0, tVac: 1758, ispSl: 0, ispVac: 346, src: 'spec:engines#ko-m15v' },
  'ko-m21': { tSl: 0, tVac: 450, ispSl: 0, ispVac: 353, src: 'spec:engines#ko-m21' },
};
export const ROSTER_REDSTAR = [
  { id: 'soyuzny', name: 'Soyuzny', company: 'redstar', src: 'spec:soyuzny', area: 18.1, fairing: 4500, est: ['fairing'],
    stages: [
      { engines: { 'ko-k1': 4 }, dry: 15136, prop: 156640, burn: 118, group: 0, recovery: 'expended' },
      { engines: { 'ko-k2': 1 }, dry: 6545, prop: 90100, burn: 286, group: 0, recovery: 'expended' },
      { engines: { 'ko-k3': 1 }, dry: 2355, prop: 25400, burn: 270, group: 1, recovery: 'expended' },
    ],
    modes: [{ variant: 'leo', payload: 8670, orbit: { hp: 240, ha: 240, inc: 51.6 }, src: 'spec:soyuzny#leo',
 }],
    tli: 2350, flights: 170 },
  { id: 'moonhammer', name: 'Moonhammer', company: 'redstar', src: 'spec:moonhammer (draft-project masses)', area: 227, fairing: 0,
    stages: [
      { engines: { 'ko-m15': 30 }, dry: 130000, prop: 1750000, burn: 125, group: 0, recovery: 'expended' },
      { engines: { 'ko-m15v': 8 }, dry: 55700, prop: 505000, burn: 120, group: 1, recovery: 'expended' },
      { engines: { 'ko-m21': 4 }, dry: 13700, prop: 175000, burn: 370, group: 2, recovery: 'expended' },
    ],
    modes: [{ variant: 'leo', payload: 95000, orbit: { hp: 225, ha: 225, inc: 51.6 }, src: 'spec:moonhammer#leo (design)',
 knownGap: 'model +24 % (2-D): design-stage masses vs design payload; never flew to orbit' }],
    tli: 33000, flights: 4 },
];
