// Company 'calt' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed cl-.
export const ENGINES_CALT = {
  'cl-k1': { tSl: 1200, tVac: 1340, ispSl: 300, ispVac: 335.1, src: 'spec:engines#cl-k1' },
  'cl-h1': { tSl: 518, tVac: 700, ispSl: 316.7, ispVac: 428, src: 'spec:engines#cl-h1' },
  'cl-h2': { tSl: 0, tVac: 88.4, ispSl: 0, ispVac: 442.6, src: 'spec:engines#cl-h2' },
};
const boosters = { engines: { 'cl-k1': 8 }, dry: 55200, prop: 571200, burn: 173, group: 0, recovery: 'expended' };
const core = { engines: { 'cl-h1': 2 }, dry: 21600, prop: 165300, burn: 492, group: 0, recovery: 'expended' };
export const ROSTER_CALT = [
  // core-to-orbit variant (no second stage): the sourced 25 t LEO figure is for this one
  { id: 'long-stride-5', name: 'Long Stride 5', company: 'calt', src: 'spec:long-stride-5', variant: 'core-to-orbit', area: 54.9, fairing: 0,
    stages: [{ ...boosters }, { ...core }],
    modes: [{ variant: 'core-to-orbit', payload: 25000, orbit: { hp: 200, ha: 400, inc: 42 }, src: 'spec:long-stride-5#leo',
 }] },
  { id: 'long-stride-5', name: 'Long Stride 5', company: 'calt', src: 'spec:long-stride-5', variant: 'two-stage', area: 54.9, fairing: 4000, est: ['fairing'],
    stages: [{ ...boosters }, { ...core }, { engines: { 'cl-h2': 2 }, dry: 5100, prop: 29100, burn: 700, group: 1, recovery: 'expended' }],
    modes: [], gto: 14000, tli: 9400, tmi: 6000, flights: 18 },
];
