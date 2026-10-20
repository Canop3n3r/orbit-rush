// Company 'convair' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed cv-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_CONVAIR = {
  'cv-e1': { tSl: 6265.6, tVac: 7120.0, ispSl: 239.4, ispVac: 272.0, src: 'spec:engines#cv-e1', est: ['tSl', 'ispSl'] },
  'cv-e2': { tSl: 1078.9, tVac: 1226.0, ispSl: 265.8, ispVac: 302.0, src: 'spec:engines#cv-e2', est: ['tSl', 'ispSl'] },
  'cv-e3': { tSl: 0, tVac: 472.2, ispSl: 0, ispVac: 316.0, src: 'spec:engines#cv-e3' },
  'cv-e4': { tSl: 1210.0, tVac: 1375.0, ispSl: 218.2, ispVac: 248.0, src: 'spec:engines#cv-e4', est: ['tSl', 'ispSl'] },
  'cv-e5': { tSl: 222.6, tVac: 253.0, ispSl: 187.4, ispVac: 213.0, src: 'spec:engines#cv-e5', est: ['tSl', 'ispSl'] },
  'cv-e6': { tSl: 1817.2, tVac: 2065.0, ispSl: 258.2, ispVac: 293.4, src: 'spec:engines#cv-e6', est: ['tSl', 'ispSl'] },
  'cv-e7': { tSl: 381.7, tVac: 433.7, ispSl: 209.3, ispVac: 237.8, src: 'spec:engines#cv-e7', est: ['tSl', 'ispSl'] },
  'cv-e8': { tSl: 334.9, tVac: 380.6, ispSl: 193.6, ispVac: 220.0, src: 'spec:engines#cv-e8', est: ['tSl', 'ispSl'] },
  'cv-e9': { tSl: 0, tVac: 99.2, ispSl: 0, ispVac: 450.5, src: 'spec:engines#cv-e9' },
};
export const ROSTER_CONVAIR = [
  { id: 'titanus-4', name: "Titanus IV", company: 'convair', src: 'spec:titanus-4', area: 22.5, fairing: 4989, est: ['area'],
    stages: [
      { engines: {'cv-e1': 2}, dry: 102400, prop: 536200, burn: 120.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)'] },
      { engines: {'cv-e2': 2}, dry: 8000, prop: 155000, burn: 164.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'cv-e3': 1}, dry: 4500, prop: 35000, burn: 223.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 17600, orbit: { hp: 185, ha: 185, inc: 90.0 }, src: "spec:titanus-4#ref (service fact sheet: polar LEO from the west-coast site)", est: ['orbit altitude (fact sheet gives none: 185 km ESTIMATE)'] , knownGap: "model -44 % against the sourced polar figure with the sourced 4,989 kg fairing: west-coast polar launch flown from the site latitude; air-lit/staging sequence of the solid boosters and core ignition not in GCAT stage data; orbit altitude ESTIMATE 185 km"  }] },
  { id: 'atlantean', name: "Atlantean", company: 'convair', src: 'spec:atlantean', area: 14.6, fairing: 0, est: ['area'],
    stages: [
      { engines: {'cv-e4': 1}, dry: 3400, prop: 76325, burn: 135.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)', 'prop (shared tanks: rated flow \u00d7 burn moved from the sustainer)'] },
      { engines: {'cv-e5': 1}, dry: 3400, prop: 35275, burn: 281.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['prop (minus the drop-off section share)'] },
    ],
    modes: [{ variant: 'leo', payload: 1383, orbit: { hp: 163, ha: 265, inc: 32.5 }, src: "spec:atlantean#ref (flown: heaviest crewed capsule and its orbit, GCAT launch list/satcat)", est: [] , knownGap: "model no orbit: GCAT gives the sustainer section Isp 213 s, inconsistent with a LOX/kerosene sustainer (data issue for rocketdb); drop-off booster share ESTIMATE. Reference is now the flown crewed capsule and its orbit"  }] },
  { id: 'atlantean-centaurus', name: "Atlantean-Centaurus", company: 'convair', src: 'spec:atlantean-centaurus', area: 17.9, fairing: 2087, est: ['area'],
    stages: [
      { engines: {'cv-e6': 1}, dry: 3200, prop: 40799, burn: 165.0, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)', 'prop (shared tanks: rated flow \u00d7 burn moved from the sustainer)'] },
      { engines: {'cv-e7': 4}, dry: 5600, prop: 1, burn: 56.2, group: 0, recovery: 'expended', src: 'GCAT', est: ['group (air-lit strap-ons not modelled)', 'prop (minus the drop-off section share)'] },
      { engines: {'cv-e8': 1}, dry: 10350, prop: 153150, burn: 274.0, group: 0, recovery: 'expended', src: 'GCAT' },
      { engines: {'cv-e9': 2}, dry: 2200, prop: 16800, burn: 370.0, group: 1, recovery: 'expended', src: 'GCAT' },
    ],
    modes: [{ variant: 'leo', payload: 8610, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: "spec:atlantean-centaurus#ref (reference: 185 km circular at 28.5 deg, encyclopedia entry citing the mission planner's guide)", est: [] , knownGap: "model no orbit against the sourced 185 km / 28.5 deg reference with the sourced 2,087 kg fairing: same drop-off-section data issue as atlantean"  }] },
];
