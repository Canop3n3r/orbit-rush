// Company 'ulx' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed ulx-.
export const ENGINES_ULX = {
  'ulx-k1': { tSl: 3830, tVac: 4150, ispSl: 311, ispVac: 338, src: 'spec:engines#ulx-k1' },
  'ulx-h1': { tSl: 0, tVac: 99.2, ispSl: 0, ispVac: 450.5, src: 'spec:engines#ulx-h1' },
  'ulx-s1': { tSl: 1520, tVac: 1688.4, ispSl: 255, ispVac: 279.3, src: 'spec:engines#ulx-s1', est: ['tSl', 'ispSl'] },
  'ulx-h2': { tSl: 3140, tVac: 3593, ispSl: 360, ispVac: 412, src: 'spec:engines#ulx-h2', est: ['tVac'] },
  'ulx-h3': { tSl: 0, tVac: 110.1, ispSl: 0, ispVac: 465.5, src: 'spec:engines#ulx-h3' },
};
const core = { engines: { 'ulx-k1': 1 }, engineCount: 1, engineName: 'ulx-k1', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 21054, prop: 284089, burn: 253, group: 0, recovery: 'expended' };
const upper = { engines: { 'ulx-h1': 1 }, engineCount: 1, engineName: 'ulx-h1', propellant: 'hydrolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 2316, prop: 20830, burn: 842, group: 1, recovery: 'expended' };
export const ROSTER_ULX = [
  { id: 'atlantean-v', name: 'Atlantean V', company: 'ulx', src: 'spec:atlantean-v', variant: 'v0 (4 m fairing, no boosters)', area: 12.6, fairing: 2305, fairingSrc: 'spec:atlantean-v#ug-400 (4-m EPF, the fairing of the published LEO figure)',
    stages: [{ ...core, dry: 21054 + 947 + 182, drySrc: 'spec:atlantean-v#ug-400 (booster inert + 400-series ISA 4X1 + aft stub adapter, dropped with the booster)' }, { ...upper, dry: 2243, drySrc: 'spec:atlantean-v#ug-400 (upper-stage inert 4X1)' }],
    modes: [{ variant: 'v0', payload: 9797, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: 'spec:atlantean-v#leo-v0 (PSW, 200 km circular, 28.5 deg, 4-m EPF)',
 }], gto: 4750 },
  { id: 'atlantean-v', name: 'Atlantean V', company: 'ulx', src: 'spec:atlantean-v', variant: 'v5 (5 m fairing, 5 boosters)', area: 32.9, fairing: 3799, fairingSrc: 'spec:atlantean-v#ug-500 (5-m short PLF 3,524 + CFLR 275 kg, both drop at fairing jettison)',
    stages: [{ engines: { 'ulx-s1': 5 }, engineCount: 5, engineName: 'ulx-s1', boosters: 5, boostersSrc: 'spec:atlantean-v#srb-count', propellant: 'solid', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 20335, prop: 213150, burn: 94, group: 0, recovery: 'expended' }, { ...core, dry: 21054 + 2212 + 285, drySrc: 'spec:atlantean-v#ug-500 (booster inert + 500-series C-ISA + cylindrical ISA, dropped with the booster)' }, { ...upper, dry: 2247, drySrc: 'spec:atlantean-v#ug-500 (upper-stage inert 5X1)' }],
    modes: [{ variant: 'v5', payload: 18814, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: 'spec:atlantean-v#leo-v5 (PSW, 200 km circular, 28.5 deg, 5-m short PLF)',
 }], gto: 8900, flights: 110 },
  { id: 'deltoid-4', name: 'Deltoid IV', company: 'ulx', src: 'spec:deltoid-4', variant: 'heavy (3 cores)', area: 61.3, fairing: 3500, est: ['fairing'],
    stages: [
      { engines: { 'ulx-h2': 2 }, engineCount: 2, engineName: 'ulx-h2', boosters: 2, boostersSrc: 'spec:deltoid-4#boosters', propellant: 'solid', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 53520, prop: 400800, burn: 246, group: 0, recovery: 'expended' },
      { engines: { 'ulx-h2': 1 }, engineCount: 1, engineName: 'ulx-h2', propellant: 'hydrolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 26760, prop: 200400, burn: 334, group: 0, recovery: 'expended', note: 'centre core throttled' },
      { engines: { 'ulx-h3': 1 }, engineCount: 1, engineName: 'ulx-h3', propellant: 'hydrolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 3490, prop: 27220, burn: 1125, group: 1, recovery: 'expended' },
    ],
    modes: [{ variant: 'heavy', payload: 28370, orbit: { hp: 200, ha: 200, inc: 28.7 }, src: 'spec:deltoid-4#leo',
 }], gto: 14210, tli: 11290, flights: 16 },
];
