// Company 'arion' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed ar-.
export const ENGINES_ARION = {
  'ar-h2':  { tSl: 960, tVac: 1390, ispSl: 310, ispVac: 432, src: 'spec:engines#ar-h2' },
  'ar-s1':  { tSl: 6400, tVac: 7080, ispSl: 250, ispVac: 274, src: 'spec:engines#ar-s1', est: ['tSl', 'ispSl', 'ispVac'] },
  'ar-h7':  { tSl: 0, tVac: 67, ispSl: 0, ispVac: 446, src: 'spec:engines#ar-h7' },
  'ar-h21': { tSl: 950, tVac: 1370, ispSl: 310, ispVac: 432, src: 'spec:engines#ar-h21', est: ['tSl', 'ispSl', 'ispVac'] },
  'ar-s2':  { tSl: 4350, tVac: 4780, ispSl: 255, ispVac: 280, src: 'spec:engines#ar-s2', est: ['tSl', 'ispSl'] },
  'ar-h5':  { tSl: 0, tVac: 180, ispSl: 0, ispVac: 457, src: 'spec:engines#ar-h5', est: ['ispVac'] },
};
const a6 = n => ({ id: 'arion-6', name: 'Arion 6', company: 'arion', src: 'spec:arion-6', variant: `b${n} (${n} boosters)`,
  area: 22.9 + n * 9.08, fairing: 2500, est: ['fairing'],
  stages: [
    { engines: { 'ar-s2': n }, dry: n * 11200, prop: n * 141400, burn: 134, group: 0, recovery: 'expended' },
    { engines: { 'ar-h21': 1 }, dry: 23000, prop: 154000, burn: 515, group: 0, recovery: 'expended', src: 'spec:arion-6#core-esa', est: ['prop', 'burn'] }, // dry sourced; prop 'almost 154 t'; burn = 468 s × 154/140 (same mass flow) EST
    { engines: { 'ar-h5': 1 }, dry: 6000, prop: 32000, burn: 900, group: 1, recovery: 'expended (deorbit)', restart: true, src: 'spec:arion-6#restart (user manual §2.3.2: circular orbits use two burns)' },
  ] });
export const ROSTER_ARION = [
  { id: 'arion-5', name: 'Arion 5', company: 'arion', src: 'spec:arion-5', variant: 'cryo upper stage', area: 30.3, fairing: 2400, est: ['fairing'],
    stages: [
      { engines: { 'ar-s1': 2 }, dry: 66000, prop: 480000, burn: 140, group: 0, recovery: 'expended' },
      { engines: { 'ar-h2': 1 }, dry: 14700, prop: 170000, burn: 540, group: 0, recovery: 'expended' },
      { engines: { 'ar-h7': 1 }, dry: 4540, prop: 14900, burn: 945, group: 1, recovery: 'expended' },
    ],
    // GTO 250 × 35,786 km, 6° (orbit definition EST: standard for this site)
    modes: [{ variant: 'gto', payload: 10865, orbit: { hp: 250, ha: 35786, inc: 6 }, src: 'spec:arion-5#gto', est: ['orbit'] }], flights: 117 },
  { ...a6(2), modes: [{ variant: 'b2', payload: 10000, orbit: { hp: 250, ha: 250, inc: 51.6 }, src: 'spec:arion-6#iss (user manual)',
 knownGap: 'model −45 % with the finite-burn coast-and-restart (was −28 % with an impulsive perigee raise): low-T/W core + upper stage; the coast starts as soon as the apogee reaches the target, and the second burn is flown prograde-horizontal, a narrower family than a real optimised ascent; deorbit reserve and adapter unsourced' }] },
  { ...a6(4), modes: [{ variant: 'b4', payload: 20000, orbit: { hp: 250, ha: 250, inc: 51.6 }, src: 'spec:arion-6#iss (user manual)',
 }], flights: 9 },
];
