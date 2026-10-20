// Company 'martell' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed mm-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_MARTELL = {
  'mm-e1': { tSl: 914.4, tVac: 1045.0, ispSl: 259, ispVac: 296, src: 'spec:engines#mm-e1', est: ['tSl (vac thrust x Isp ratio)'] },
  'mm-e2': { tSl: 0, tVac: 440.0, ispSl: 0, ispVac: 316.0, src: 'spec:engines#mm-e2' },
  'mm-e3': { tSl: 5479.9, tVac: 6227.2, ispSl: 231.4, ispVac: 263.0, src: 'spec:engines#mm-e3', est: ['tSl', 'ispSl'] },
  'mm-e4': { tSl: 973.9, tVac: 1176.5, ispSl: 250, ispVac: 302, src: 'spec:engines#mm-e4', est: ['tSl (vac thrust x Isp ratio)'] },
  'mm-e5': { tSl: 0, tVac: 449.2, ispSl: 0, ispVac: 316.0, src: 'spec:engines#mm-e5' },
  'mm-e6': { tSl: 0, tVac: 35.5, ispSl: 0, ispVac: 311.0, src: 'spec:engines#mm-e6' },
  'mm-e7': { tSl: 1411.5, tVac: 1604.0, ispSl: 246.4, ispVac: 280.0, src: 'spec:engines#mm-e7', est: ['tSl', 'ispSl'] },
  'mm-e8': { tSl: 0, tVac: 1604.0, ispSl: 0, ispVac: 280.0, src: 'spec:engines#mm-e8' },
  'mm-e9': { tSl: 0, tVac: 187.0, ispSl: 0, ispVac: 293.0, src: 'spec:engines#mm-e9' },
  'mm-e10': { tSl: 0, tVac: 0.2, ispSl: 0, ispVac: 236.0, src: 'spec:engines#mm-e10' },
};
export const ROSTER_MARTELL = [
  { id: 'titanus-2', name: "Titanus II", company: 'martell', src: 'spec:titanus-2', area: 7.3, fairing: 0, est: ['area'],
    stages: [
      { engines: {'mm-e1': 2}, engineCount: 2, engineName: 'mm-e1', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 4000, prop: 118000, burn: 147.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'mm-e2': 1}, engineCount: 1, engineName: 'mm-e2', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 2400, prop: 26500, burn: 182.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 3600, orbit: { hp: 161, ha: 298, inc: 28.9 }, src: "spec:titanus-2#ref (published capability: 3,600 kg, encyclopedia entry; agency design orbit 87 x 161 nmi from the launch-vehicle technical paper and agency report)", est: ['inclination 28.9 deg (the flown rendezvous missions) ESTIMATE'] }] },
  { id: 'titanus-3', name: "Titanus III", company: 'martell', src: 'spec:titanus-3', area: 22.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'mm-e3': 2}, engineCount: 2, engineName: 'mm-e3', propellant: 'solid', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 67600, prop: 384800, burn: 115.0, group: 0, jettisonAt: 115.0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'mm-e4': 2}, engineCount: 2, engineName: 'mm-e4', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 5500, prop: 111100, burn: 147.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'mm-e5': 1}, engineCount: 1, engineName: 'mm-e5', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 2650, prop: 26550, burn: 205.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'mm-e6': 2}, engineCount: 2, engineName: 'mm-e6', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 2000, prop: 10500, burn: 440.0, group: 2, restart: true, restartSrc: 'spec:titanus-3#restart (rocketdb per-stage restartable, cited)', recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 13300, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:titanus-3#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] }] },
  { id: 'athenix', name: "Athenix", company: 'martell', src: 'spec:athenix', area: 4.2, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'mm-e7': 1}, engineCount: 1, engineName: 'mm-e7', propellant: 'solid', nozzleLayout: { type: 'single' }, reusable: false, dry: 4450, prop: 48650, burn: 83.4, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'mm-e8': 1}, engineCount: 1, engineName: 'mm-e8', propellant: 'solid', nozzleLayout: { type: 'single' }, reusable: false, dry: 4450, prop: 48650, burn: 83.4, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'mm-e9': 1}, engineCount: 1, engineName: 'mm-e9', propellant: 'solid', nozzleLayout: { type: 'single' }, reusable: false, dry: 1030, prop: 9770, burn: 150.0, group: 2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'mm-e10': 4}, engineCount: 4, engineName: 'mm-e10', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['propellant', 'nozzleLayout'], dry: 360, prop: 340, burn: 550.0, group: 3, restart: true, restartSrc: "spec:athenix#restart (vendor family brief: orbit-adjust module, multiple orbits, 2-orbit 3-hour timelines)", recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 726, orbit: { hp: 677, ha: 682, inc: 98.2 }, src: "spec:athenix#ref (flown: imaging satellite and its orbit, GCAT satcat)", est: [] , knownGap: "model +117 %: fairing mass unsourced (0); final stage restartable: coast-and-restart flown; SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
];
