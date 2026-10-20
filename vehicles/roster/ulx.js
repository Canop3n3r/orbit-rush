// Company 'ulx' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed ulx-.
export const ENGINES_ULX = {
  'ulx-k1': { tSl: 3830, tVac: 4150, ispSl: 311, ispVac: 338, src: 'spec:engines#ulx-k1' },
  'ulx-h1': { tSl: 0, tVac: 99.2, ispSl: 0, ispVac: 450.5, src: 'spec:engines#ulx-h1' },
  'ulx-s1': { tSl: 1520, tVac: 1688.4, ispSl: 255, ispVac: 279.3, src: 'spec:engines#ulx-s1', est: ['tSl', 'ispSl'] },
  'ulx-h2': { tSl: 3140, tVac: 3593, ispSl: 360, ispVac: 412, src: 'spec:engines#ulx-h2', est: ['tVac'] },
  'ulx-h3': { tSl: 0, tVac: 110.1, ispSl: 0, ispVac: 465.5, src: 'spec:engines#ulx-h3' },
};
const core = { engines: { 'ulx-k1': 1 }, dry: 21054, prop: 284089, burn: 253, group: 0, recovery: 'expended' };
const upper = { engines: { 'ulx-h1': 1 }, dry: 2316, prop: 20830, burn: 842, group: 1, recovery: 'expended' };
export const ROSTER_ULX = [
  { id: 'atlantean-v', name: 'Atlantean V', company: 'ulx', src: 'spec:atlantean-v', variant: 'v0 (4 m fairing, no boosters)', area: 12.6, fairing: 2100, est: ['fairing'],
    stages: [{ ...core }, { ...upper }],
    modes: [{ variant: 'v0', payload: 9797, orbit: { hp: 200, ha: 200, inc: 28.7 }, src: 'spec:atlantean-v#leo-v0', est: ['orbit.hp'],
      knownGap: 'model ~+53 %: stage burnout masses not sourced; physics gravity loss EST' }], gto: 4750 },
  { id: 'atlantean-v', name: 'Atlantean V', company: 'ulx', src: 'spec:atlantean-v', variant: 'v5 (5 m fairing, 5 boosters)', area: 32.9, fairing: 4000, est: ['fairing'],
    stages: [{ engines: { 'ulx-s1': 5 }, dry: 20335, prop: 213150, burn: 94, group: 0, recovery: 'expended' }, { ...core }, { ...upper }],
    modes: [{ variant: 'v5', payload: 18814, orbit: { hp: 200, ha: 200, inc: 28.7 }, src: 'spec:atlantean-v#leo-v5', est: ['orbit.hp'],
      knownGap: 'model ~+49 %: as v0; booster SL Isp EST' }], gto: 8900, flights: 110 },
  { id: 'deltoid-4', name: 'Deltoid IV', company: 'ulx', src: 'spec:deltoid-4', variant: 'heavy (3 cores)', area: 61.3, fairing: 3500, est: ['fairing'],
    stages: [
      { engines: { 'ulx-h2': 2 }, dry: 53520, prop: 400800, burn: 246, group: 0, recovery: 'expended' },
      { engines: { 'ulx-h2': 1 }, dry: 26760, prop: 200400, burn: 334, group: 0, recovery: 'expended', note: 'centre core throttled' },
      { engines: { 'ulx-h3': 1 }, dry: 3490, prop: 27220, burn: 1125, group: 1, recovery: 'expended' },
    ],
    modes: [{ variant: 'heavy', payload: 28370, orbit: { hp: 200, ha: 200, inc: 28.7 }, src: 'spec:deltoid-4#leo',
      knownGap: 'model ~+36 %: stage burnout masses not sourced; physics gravity loss EST' }], gto: 14210, tli: 11290, flights: 16 },
];
