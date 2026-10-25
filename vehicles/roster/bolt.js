// Company 'bolt' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed rl-.
// Stage masses: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md).
export const ENGINES_BOLT = {
  'rl-k1':  { tSl: 24.9, tVac: 26.0, ispSl: 303, ispVac: 311, src: 'spec:engines#rl-k1 (stage thrust / 9)', est: ['tSl', 'tVac', 'ispSl'] },
  'rl-k1v': { tSl: 0, tVac: 25.8, ispSl: 0, ispVac: 343, src: 'spec:engines#rl-k1v' },
  'rl-c1':  { tSl: 0, tVac: 0.12, ispSl: 0, ispVac: 320, src: 'spec:engines#rl-c1 (120 N user guide; Isp ~320 s)', est: ['ispVac'] },
};
export const ROSTER_BOLT = [
  { id: 'electrino', name: 'Electrino', company: 'bolt', src: 'spec:electrino', area: 1.13, fairing: 50, est: ['fairing'],
    stages: [
      // burn = prop / (Tvac / (Isp·g0)) (EST, spec:electrino#burn)
      { engines: { 'rl-k1': 9 }, engineCount: 9, engineName: 'rl-k1', propellant: 'kerolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 950, prop: 9250, burn: 120, group: 0, recovery: 'expended (ocean recovery trialled)', src: 'GCAT', est: ['burn'] },
      { engines: { 'rl-k1v': 1 }, engineCount: 1, engineName: 'rl-k1v', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 250, prop: 2050, burn: 267, group: 1, recovery: 'expended', src: 'GCAT', est: ['burn'] },
      // kick stage (spec:electrino#kick): dry 40 kg and 120 N from the user guide; restartable; prop = 120 N × 130 s / (320 s·g0)
      // with 130 s = half the 267 s quoted as "more than twice the standard" burn (EST)
      { engines: { 'rl-c1': 1 }, engineCount: 1, engineName: 'rl-c1', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 40, prop: 5, burn: 130, group: 2, restart: true, recovery: 'deorbit burn', est: ['prop', 'burn'] },
    ],
    // reference orbit from the payload user guide: 200 kg to 500 km circular sun-synchronous
    modes: [{ variant: 'sso-500', payload: 200, orbit: { hp: 500, ha: 500, inc: 97.4 }, src: 'spec:electrino#sso',
 knownGap: 'model −24 % with the kick stage: kick-stage propellant (5 kg) is an ESTIMATE from burn time; battery jettison not modelled' }],
    payloadLow: 300, flights: 97 },
];
