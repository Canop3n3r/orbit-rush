// Company 'blueh' roster vehicles (data only). Units/fields: see header of vehicles/roster/loss.js. Engines prefixed bh-.
// Stage masses: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md).
export const ENGINES_BLUEH = {
  'bh-m1': { tSl: 2460, tVac: 2698, ispSl: 310, ispVac: 340, src: 'spec:engines#bh-m1', est: ['tVac', 'ispSl'] },
  'bh-h1': { tSl: 0, tVac: 711.5, ispSl: 0, ispVac: 445, src: 'spec:engines#bh-h1' },
};
export const ROSTER_BLUEH = [
  { id: 'new-glendale', name: 'New Glen-Dale', company: 'blueh', src: 'spec:new-glendale', area: 38.5, fairing: 12000, est: ['fairing'],
    stages: [
      { engines: { 'bh-m1': 7 }, engineCount: 7, engineName: 'bh-m1', propellant: 'methalox', nozzleLayout: { type: 'cluster' }, reusable: true, estimated: true, estimatedFields: ['nozzleLayout'], dry: 110000, prop: 790000, burn: 139, group: 0, recovery: 'propulsive landing on ship', src: 'GCAT (masses flagged uncertain)', est: ['dry', 'prop', 'burn'] }, // burn = prop / rated mass flow 7 × 2698 kN / (340 s·g0) (spec:new-glendale#inputs); the 190 s figure implied ~73 % thrust
      { engines: { 'bh-h1': 2 }, engineCount: 2, engineName: 'bh-h1', propellant: 'hydrolox', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 28000, prop: 122000, burn: 374, group: 1, recovery: 'expended', src: 'GCAT (masses flagged uncertain)', est: ['dry', 'prop', 'burn'] }, // burn = prop / rated mass flow 2 × 711.5 kN / (445 s·g0); the 644 s figure implied ~58 % thrust
    ],
    // sourced 45 t is quoted with booster recovery; model flies expendable (landing reserve not modelled)
    modes: [{ variant: 'leo', payload: 45000, orbit: { hp: 200, ha: 200, inc: 28.5 }, src: 'spec:new-glendale#leo', est: ['orbit'],
 modeMismatch: 'sourced 45 t is quoted with booster recovery, the model flies expendable (no sourced landing reserve); GCAT flags both stage masses uncertain; burns from rated mass flow (EST)' }],
    gto: 13600, tli: 7000, flights: 3 },
];
