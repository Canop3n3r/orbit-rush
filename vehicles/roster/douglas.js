// Company 'douglas' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed dw-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_DOUGLAS = {
  'dw-e1': { tSl: 439.3, tVac: 499.2, ispSl: 241.1, ispVac: 274.0, src: 'spec:engines#dw-e1', est: ['tSl', 'ispSl'] },
  'dw-e2': { tSl: 955.5, tVac: 1085.8, ispSl: 265.8, ispVac: 302.0, src: 'spec:engines#dw-e2', est: ['tSl', 'ispSl'] },
  'dw-e3': { tSl: 0, tVac: 43.7, ispSl: 0, ispVac: 319.2, src: 'spec:engines#dw-e3' },
  'dw-e4': { tSl: 227.9, tVac: 259.0, ispSl: 264.0, ispVac: 300, src: 'spec:engines#dw-e4', est: ['ispVac', 'tSl', 'ispSl'] },
  'dw-e5': { tSl: 802.6, tVac: 912.0, ispSl: 259.6, ispVac: 295.0, src: 'spec:engines#dw-e5', est: ['tSl', 'ispSl'] },
  'dw-e6': { tSl: 0, tVac: 42.0, ispSl: 0, ispVac: 301.3, src: 'spec:engines#dw-e6' },
  'dw-e7': { tSl: 0, tVac: 68.0, ispSl: 0, ispVac: 283.6, src: 'spec:engines#dw-e7' },
  'dw-e8': { tSl: 227.9, tVac: 259.0, ispSl: 264.0, ispVac: 300, src: 'spec:engines#dw-e8', est: ['ispVac', 'tSl', 'ispSl'] },
  'dw-e9': { tSl: 756.8, tVac: 860.0, ispSl: 264.0, ispVac: 300, src: 'spec:engines#dw-e9', est: ['ispVac', 'tSl', 'ispSl'] },
  'dw-e10': { tSl: 0, tVac: 71.0, ispSl: 0, ispVac: 289.8, src: 'spec:engines#dw-e10' },
  'dw-e18': { tSl: 587.0, tVac: 667.0, ispSl: 264.0, ispVac: 300, src: 'spec:engines#dw-e18', est: ['ispVac', 'tSl', 'ispSl'] },
  'dw-e19': { tSl: 0, tVac: 45.0, ispSl: 0, ispVac: 289.6, src: 'spec:engines#dw-e19' },
  'dw-e20': { tSl: 535.1, tVac: 608.1, ispSl: 241.1, ispVac: 274.0, src: 'spec:engines#dw-e20', est: ['tSl', 'ispSl'] },
  'dw-e21': { tSl: 955.5, tVac: 1085.8, ispSl: 265.8, ispVac: 302.0, src: 'spec:engines#dw-e21', est: ['tSl', 'ispSl'] },
  'dw-e22': { tSl: 0, tVac: 110.0, ispSl: 0, ispVac: 465.5, src: 'spec:engines#dw-e22' },
};
export const ROSTER_DOUGLAS = [
  { id: 'deltoid-2', name: "Deltoid II", company: 'douglas', src: 'spec:deltoid-2', area: 12.0, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'dw-e1': 9}, dry: 11835, prop: 106065, burn: 63.3, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'dw-e2': 1}, dry: 5680, prop: 96120, burn: 261.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e3': 1}, dry: 950, prop: 5950, burn: 431.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 4844, orbit: { hp: 185, ha: 185, inc: 28.7 }, src: "spec:deltoid-2#ref (payload planner's guide table 2-3: 185 km circular, 28.7 deg, 10-ft fairing)", est: [] , knownGap: "model +24 % against the planner's guide figure (185 km circular, 28.7 deg): air-lit strap-ons flown as ground-lit (GCAT gives no light sequence), SL thrust/Isp 0.88 x vac ESTIMATE, fairing mass not in the guide (0), residuals/reserves unsourced"  }] },
  { id: 'deltoid', name: "Deltoid", company: 'douglas', src: 'spec:deltoid', area: 9.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'dw-e4': 9}, dry: 5085, prop: 30915, burn: 37.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'dw-e5': 1}, dry: 4360, prop: 80040, burn: 223.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e6': 1}, dry: 845, prop: 4555, burn: 322.0, group: 1, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e7': 1}, dry: 83, prop: 1017, burn: 42.0, group: 2, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 2000, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:deltoid#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +56 %: no near-LEO reference with a defined orbit found (vehicle flew only GTO/high orbits); GCAT LEO figure kept with 185 km ESTIMATE orbit; fairing unsourced"  }] },
  { id: 'thorin-agenta', name: "Thorin-Agenta", company: 'douglas', src: 'spec:thorin-agenta', area: 6.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'dw-e8': 3}, dry: 1695, prop: 10305, burn: 37.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'dw-e9': 1}, dry: 3715, prop: 66585, burn: 215.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e10': 1}, dry: 750, prop: 6250, burn: 480.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 1500, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:thorin-agenta#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +36 %: flown payloads stay attached to the upper stage (payload mass ambiguous), so the GCAT LEO figure is kept with a 185 km ESTIMATE orbit; fairing unsourced"  }] },
  { id: 'thorin', name: "Thorin", company: 'douglas', src: 'spec:thorin', area: 4.7, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'dw-e18': 1}, dry: 3125, prop: 45675, burn: 160.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e19': 1}, dry: 67, prop: 833, burn: 66.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 500, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: 'spec:thorin#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model -100 %: no orbit: GCAT upper-stage data incomplete for this variant"  }] },
  { id: 'deltoid-3', name: "Deltoid III", company: 'douglas', src: 'spec:deltoid-3', area: 14.4, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'dw-e20': 9}, dry: 18315, prop: 155385, burn: 75.2, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'dw-e21': 1}, dry: 6820, prop: 95580, burn: 261.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'dw-e22': 1}, dry: 2475, prop: 16825, burn: 700.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 8292, orbit: { hp: 185, ha: 185, inc: 28.7 }, src: "spec:deltoid-3#ref (payload planner's guide: 185 km circular, 28.7 deg, 4-m composite fairing)", est: [] , knownGap: "model +24 % against the planner's guide figure (185 km circular, 28.7 deg): air-lit strap-ons flown as ground-lit, SL thrust/Isp 0.88 x vac ESTIMATE, 4-m fairing mass unsourced (0), residuals/reserves unsourced"  }] },
];
