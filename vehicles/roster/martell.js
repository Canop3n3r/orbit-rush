// Company 'martell' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed mm-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_MARTELL = {
  'mm-e1': { tSl: 919.6, tVac: 1045.0, ispSl: 260.5, ispVac: 296.0, src: 'spec:engines#mm-e1', est: ['tSl', 'ispSl'] },
  'mm-e2': { tSl: 0, tVac: 440.0, ispSl: 0, ispVac: 316.0, src: 'spec:engines#mm-e2' },
  'mm-e3': { tSl: 5479.9, tVac: 6227.2, ispSl: 231.4, ispVac: 263.0, src: 'spec:engines#mm-e3', est: ['tSl', 'ispSl'] },
  'mm-e4': { tSl: 1035.3, tVac: 1176.5, ispSl: 267.5, ispVac: 304.0, src: 'spec:engines#mm-e4', est: ['tSl', 'ispSl'] },
  'mm-e5': { tSl: 0, tVac: 449.2, ispSl: 0, ispVac: 316.0, src: 'spec:engines#mm-e5' },
  'mm-e6': { tSl: 0, tVac: 35.5, ispSl: 0, ispVac: 311.0, src: 'spec:engines#mm-e6' },
  'mm-e7': { tSl: 1411.5, tVac: 1604.0, ispSl: 246.4, ispVac: 280.0, src: 'spec:engines#mm-e7', est: ['tSl', 'ispSl'] },
  'mm-e8': { tSl: 0, tVac: 1604.0, ispSl: 0, ispVac: 280.0, src: 'spec:engines#mm-e8' },
  'mm-e9': { tSl: 0, tVac: 187.0, ispSl: 0, ispVac: 293.0, src: 'spec:engines#mm-e9' },
  'mm-e10': { tSl: 0, tVac: 0.2, ispSl: 0, ispVac: 236.0, src: 'spec:engines#mm-e10' },
};
export const ROSTER_MARTELL = [
  { id: 'titanus-2', name: "Titanus II", company: 'martell', src: 'spec:titanus-2', area: 7.3, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'mm-e1': 2}, dry: 4000, prop: 118000, burn: 147.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e2': 1}, dry: 2400, prop: 26500, burn: 182.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 3600, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:titanus-2#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -26 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); SL thrust/Isp 0.88 \u00d7 vac ESTIMATE; fairing mass unsourced (0)"  }] },
  { id: 'titanus-3', name: "Titanus III", company: 'martell', src: 'spec:titanus-3', area: 22.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'mm-e3': 2}, dry: 67600, prop: 384800, burn: 115.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'mm-e4': 2}, dry: 5500, prop: 111100, burn: 147.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e5': 1}, dry: 2650, prop: 26550, burn: 205.0, group: 1, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e6': 2}, dry: 2000, prop: 10500, burn: 440.0, group: 2, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 13300, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:titanus-3#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -15 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); SL thrust/Isp 0.88 \u00d7 vac ESTIMATE; fairing mass unsourced (0)"  }] },
  { id: 'athenix', name: "Athenix", company: 'martell', src: 'spec:athenix', area: 4.2, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'mm-e7': 1}, dry: 4450, prop: 48650, burn: 83.4, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e8': 1}, dry: 4450, prop: 48650, burn: 83.4, group: 1, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e9': 1}, dry: 1030, prop: 9770, burn: 150.0, group: 2, recovery: 'expended', src: 'GCAT' },
      { engines: {'mm-e10': 4}, dry: 360, prop: 340, burn: 550.0, group: 3, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 2065, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:athenix#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -65 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); SL thrust/Isp 0.88 \u00d7 vac ESTIMATE; fairing mass unsourced (0)"  }] },
];
