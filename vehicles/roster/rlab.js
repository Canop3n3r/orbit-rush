// Company 'rlab' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed rl-.
// Stage masses: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md).
export const ENGINES_RLAB = {
  'rl-k1':  { tSl: 24.9, tVac: 26.0, ispSl: 303, ispVac: 311, src: 'spec:engines#rl-k1 (stage thrust / 9)', est: ['tSl', 'tVac', 'ispSl'] },
  'rl-k1v': { tSl: 0, tVac: 25.8, ispSl: 0, ispVac: 343, src: 'spec:engines#rl-k1v' },
};
export const ROSTER_RLAB = [
  { id: 'electrino', name: 'Electrino', company: 'rlab', src: 'spec:electrino', area: 1.13, fairing: 50, est: ['fairing'],
    stages: [
      // burn = prop / (Tvac / (Isp·g0)) (EST, spec:electrino#burn)
      { engines: { 'rl-k1': 9 }, dry: 950, prop: 9250, burn: 120, group: 0, recovery: 'expended (ocean recovery trialled)', src: 'GCAT', est: ['burn'] },
      { engines: { 'rl-k1v': 1 }, dry: 250, prop: 2050, burn: 267, group: 1, recovery: 'expended', src: 'GCAT', est: ['burn'] },
    ],
    // reference orbit from the payload user guide: 200 kg to 500 km circular sun-synchronous
    modes: [{ variant: 'sso-500', payload: 200, orbit: { hp: 500, ha: 500, inc: 97.4 }, src: 'spec:electrino#sso',
      knownGap: 'model overshoots: kick stage, battery mass, and physics gravity/drag loss for a tiny stack are EST' }],
    payloadLow: 300, flights: 97 },
];
