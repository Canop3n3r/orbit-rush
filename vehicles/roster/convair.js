// Company 'convair' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed cv-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_CONVAIR = {
  'cv-e1': { tSl: 6265.6, tVac: 7120.0, ispSl: 239.4, ispVac: 272.0, src: 'spec:engines#cv-e1', est: ['tSl', 'ispSl'] },
  'cv-e2': { tSl: 1014.9, tVac: 1226.0, ispSl: 250, ispVac: 302, src: 'spec:engines#cv-e2', est: ['tSl (vac thrust x Isp ratio)'] },
  'cv-e3': { tSl: 0, tVac: 472.2, ispSl: 0, ispVac: 316.0, src: 'spec:engines#cv-e3' },
  'cv-e4': { tSl: 1209.2, tVac: 1375.0, ispSl: 248.0, ispVac: 282, src: 'spec:engines#cv-e4', est: ['tSl (vac thrust x Isp ratio)'] },
  'cv-e5': { tSl: 174.4, tVac: 253.0, ispSl: 213.0, ispVac: 309, src: 'spec:engines#cv-e5', est: ['tSl (vac thrust x Isp ratio)'] },
  'cv-e6': { tSl: 1817.2, tVac: 2065.0, ispSl: 258.2, ispVac: 293.4, src: 'spec:engines#cv-e6', est: ['tSl', 'ispSl'] },
  'cv-e7': { tSl: 433.7, tVac: 478.3, ispSl: 237.8, ispVac: 262.3, src: 'spec:engines#cv-e7' },
  'cv-e8': { tSl: 265.0, tVac: 380.6, ispSl: 220.0, ispVac: 316, src: 'spec:engines#cv-e8', est: ['tSl (vac thrust x Isp ratio)'] },
  'cv-e9': { tSl: 0, tVac: 99.2, ispSl: 0, ispVac: 450.5, src: 'spec:engines#cv-e9' },
};
export const ROSTER_CONVAIR = [
  { id: 'titanus-4', name: "Titanus IV", company: 'convair', src: 'spec:titanus-4', area: 22.5, fairing: 4989, est: ['area'],
    stages: [
      { engines: {'cv-e1': 2}, dry: 102400, prop: 536200, burn: 120.0, group: 0, jettisonAt: 120.0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'cv-e2': 2}, dry: 8000, prop: 155000, burn: 164.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'cv-e3': 1}, dry: 4500, prop: 35000, burn: 223.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 17600, orbit: { hp: 185, ha: 185, inc: 90.0 }, src: "spec:titanus-4#ref (service fact sheet: polar LEO from the west-coast site)", est: ['orbit altitude (fact sheet gives none: 185 km ESTIMATE)'] , knownGap: "model -45 %: residuals/reserves unsourced; no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'atlantean', name: "Atlantean", company: 'convair', src: 'spec:atlantean', area: 14.6, fairing: 0, est: ['area'],
    stages: [
      { engines: {'cv-e4': 1}, dry: 3400, prop: 76320, burn: 135.0, group: 0, jettisonAt: 135.0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'cv-e5': 1}, dry: 3400, prop: 35280, burn: 281.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)', est: ['prop (minus the drop-off section share)'] },
    ],
    modes: [{ variant: 'leo', payload: 1360, orbit: { hp: 185, ha: 185, inc: 28.0 }, src: "spec:atlantean#ref (published capability of the crewed-capsule variant: 1,360 kg to 185 km at 28 deg, encyclopedia entry)", est: ['capability quoted for the crewed-capsule sub-variant, applied to the modelled base variant ESTIMATE'] , knownGap: "(losses kept physical, not lowered; rocketdb DELTA_V.md flags this variant SHORT) model no orbit: residuals/reserves unsourced; no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'atlantean-centaurus', name: "Atlantean-Centaurus", company: 'convair', src: 'spec:atlantean-centaurus', area: 17.9, fairing: 2087, est: ['area'],
    stages: [
      { engines: {'cv-e6': 1}, dry: 3200, prop: 123440, burn: 172.0, group: 0, jettisonAt: 172.0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'cv-e7': 4}, dry: 5600, prop: 40800, burn: 56.2, group: 0, jettisonAt: 56.2, recovery: 'expended', src: 'masses: GCAT; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'cv-e8': 1}, dry: 10350, prop: 29710, burn: 274.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)', est: ['prop (minus the drop-off section share)'] },
      { engines: {'cv-e9': 2}, dry: 2200, prop: 16800, burn: 370.0, group: 1, restart: true, restartSrc: 'spec:atlantean-centaurus#restart (rocketdb per-stage restartable, cited)', recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 8610, orbit: { hp: 185, ha: 185, inc: 28.5 }, src: "spec:atlantean-centaurus#ref (185 km circular at 28.5 deg, encyclopedia entry citing the mission planner's guide)", est: [] }] },
];
