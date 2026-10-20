// Company 'yuzhno' roster vehicles (data only). Units/fields: see vehicles/roster/loss.js. Engines prefixed yz-.
// Stage masses, thrust, Isp, burn: GCAT (J. McDowell, planet4589.org, CC BY; see CREDITS.md) via rocketdb. ESTIMATE fields in est.
export const ENGINES_YUZHNO = {
  'yz-e1': { tSl: 1535.6, tVac: 1745.0, ispSl: 256.1, ispVac: 291.0, src: 'spec:engines#yz-e1', est: ['tSl', 'ispSl'] },
  'yz-e2': { tSl: 0, tVac: 157.0, ispSl: 0, ispVac: 303.0, src: 'spec:engines#yz-e2' },
  'yz-e3': { tSl: 545.0, tVac: 625.6, ispSl: 230.0, ispVac: 264.0, src: 'spec:engines#yz-e3', est: ['tSl (vac thrust x Isp ratio)'] },
  'yz-e4': { tSl: 0, tVac: 105.0, ispSl: 0, ispVac: 352.0, src: 'spec:engines#yz-e4' },
  'yz-e5': { tSl: 906.6, tVac: 1010.7, ispSl: 270.0, ispVac: 301.0, src: 'spec:engines#yz-e5', est: ['tSl (vac thrust x Isp ratio)'] },
  'yz-e6': { tSl: 0, tVac: 1010.0, ispSl: 0, ispVac: 317.6, src: 'spec:engines#yz-e6' },
  'yz-e7': { tSl: 0, tVac: 79.0, ispSl: 0, ispVac: 317.0, src: 'spec:engines#yz-e7' },
  'yz-e8': { tSl: 906.6, tVac: 1010.7, ispSl: 270.0, ispVac: 301.0, src: 'spec:engines#yz-e8', est: ['tSl (vac thrust x Isp ratio)'] },
  'yz-e9': { tSl: 0, tVac: 1010.0, ispSl: 0, ispVac: 317.6, src: 'spec:engines#yz-e9' },
  'yz-e10': { tSl: 545.0, tVac: 625.6, ispSl: 230.0, ispVac: 264.0, src: 'spec:engines#yz-e10', est: ['tSl (vac thrust x Isp ratio)'] },
  'yz-e11': { tSl: 0, tVac: 105.0, ispSl: 0, ispVac: 352.0, src: 'spec:engines#yz-e11' },
  'yz-e12': { tSl: 1326.7, tVac: 1507.6, ispSl: 279.8, ispVac: 318, src: 'spec:engines#yz-e12', est: ['tSl', 'ispSl'] },
  'yz-e13': { tSl: 0, tVac: 760.0, ispSl: 0, ispVac: 340, src: 'spec:engines#yz-e13' },
  'yz-e14': { tSl: 0, tVac: 18.6, ispSl: 0, ispVac: 309, src: 'spec:engines#yz-e14' },
  'yz-e15': { tSl: 1535.6, tVac: 1745.0, ispSl: 256.1, ispVac: 291.0, src: 'spec:engines#yz-e15', est: ['tSl', 'ispSl'] },
  'yz-e16': { tSl: 0, tVac: 157.0, ispSl: 0, ispVac: 303.0, src: 'spec:engines#yz-e16' },
  'yz-e17': { tSl: 7251.0, tVac: 7908.0, ispSl: 309, ispVac: 337, src: 'spec:engines#yz-e17', est: ['tSl (vac thrust x Isp ratio)'] },
  'yz-e18': { tSl: 0, tVac: 912.0, ispSl: 0, ispVac: 350.0, src: 'spec:engines#yz-e18' },
};
export const ROSTER_YUZHNO = [
  { id: 'cosmokart-3m', name: "Cosmo-Kart 3M", company: 'yuzhno', src: 'spec:cosmokart-3m', area: 4.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e1': 1}, engineCount: 1, engineName: 'yz-e1', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 5300, prop: 81900, burn: 130.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'yz-e2': 1}, engineCount: 1, engineName: 'yz-e2', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 1435, prop: 18665, burn: 335.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 1500, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:cosmokart-3m#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +79 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'cosmokart-1b', name: "Cosmo-Kart 1", company: 'yuzhno', src: 'spec:cosmokart-1b', area: 2.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e3': 1}, engineCount: 1, engineName: 'yz-e3', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 4810, prop: 29790, burn: 125.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e4': 1}, engineCount: 1, engineName: 'yz-e4', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 840, prop: 7760, burn: 250.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 500, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:cosmokart-1b#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] }] },
  { id: 'whirligig-3', name: "Whirligig-3", company: 'yuzhno', src: 'spec:whirligig-3', area: 7.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e5': 3}, engineCount: 3, engineName: 'yz-e5', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 8300, prop: 118700, burn: 120.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e6': 1}, engineCount: 1, engineName: 'yz-e6', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 4800, prop: 48500, burn: 160.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'yz-e7': 1}, engineCount: 1, engineName: 'yz-e7', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 1600, prop: 3000, burn: 125.0, group: 2, restart: true, restartSrc: "spec:whirligig-3#restart (national space agency page: third-stage engine capable of dual burn in zero gravity)", recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 3600, orbit: { hp: 200, ha: 200, inc: 90.0 }, src: "spec:whirligig-3#ref (launcher history reference: 90 deg circular)", est: ["orbit altitude 200 km (same table's circular-orbit basis) ESTIMATE"] }] },
  { id: 'whirligig-2', name: "Whirligig-2", company: 'yuzhno', src: 'spec:whirligig-2', area: 7.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e8': 3}, engineCount: 3, engineName: 'yz-e8', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 8300, prop: 118700, burn: 120.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e9': 1}, engineCount: 1, engineName: 'yz-e9', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 4800, prop: 48500, burn: 160.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 3200, orbit: { hp: 200, ha: 200, inc: 65.0 }, src: "spec:whirligig-2#ref (launcher history reference: 200 km circular, 65 deg)", est: [] , knownGap: "model no orbit: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'cosmokart-1', name: "Cosmo-Kart", company: 'yuzhno', src: 'spec:cosmokart-1', area: 2.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e10': 1}, engineCount: 1, engineName: 'yz-e10', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 4810, prop: 29790, burn: 125.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e11': 1}, engineCount: 1, engineName: 'yz-e11', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, estimated: true, estimatedFields: ['propellant'], dry: 840, prop: 7760, burn: 250.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 500, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:cosmokart-1#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] }] },
  { id: 'riverbend', name: "Riverbend Silo-Hopper", company: 'yuzhno', src: 'spec:riverbend', area: 7.1, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e12': 3}, engineCount: 3, engineName: 'yz-e12', propellant: 'hypergolic', nozzleLayout: { type: 'cluster' }, reusable: false, estimated: true, estimatedFields: ['nozzleLayout'], dry: 13620, prop: 147900, burn: 98.0, group: 0, recovery: 'expended', src: 'masses: GCAT + guide; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e13': 1}, engineCount: 1, engineName: 'yz-e13', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 4374, prop: 36740, burn: 153.0, group: 1, recovery: 'expended', src: 'masses: guide + rocketdb; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e14': 1}, engineCount: 1, engineName: 'yz-e14', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 2356, prop: 1910, burn: 600.0, group: 2, recovery: 'expended', src: 'masses: guide + rocketdb; engine: GCAT + rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 3700, orbit: { hp: 300, ha: 300, inc: 50.6 }, src: "spec:riverbend#ref (user's guide: 300 km circular, 50.6 deg)", est: [] , knownGap: "model +21 %: fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'cosmokart-2', name: "Cosmo-Kart 2", company: 'yuzhno', src: 'spec:cosmokart-2', area: 4.5, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e15': 1}, engineCount: 1, engineName: 'yz-e15', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 5300, prop: 81900, burn: 130.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
      { engines: {'yz-e16': 1}, engineCount: 1, engineName: 'yz-e16', propellant: 'hypergolic', nozzleLayout: { type: 'single' }, reusable: false, dry: 1500, prop: 18600, burn: 335.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 1500, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:cosmokart-2#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] , knownGap: "model +73 %: GCAT LEO figure has no reference orbit (185 km at the site latitude ESTIMATE); fairing mass unsourced (0); no restart on the final stage (rocketdb: unknown or single-burn); SL thrust/Isp 0.88 x vac ESTIMATE where rocketdb has no SL value" }] },
  { id: 'steppe-arrow', name: "Steppe Arrow", company: 'yuzhno', src: 'spec:steppe-arrow', area: 11.9, fairing: 0, est: ['fairing (unsourced, 0)', 'area'],
    stages: [
      { engines: {'yz-e17': 1}, engineCount: 1, engineName: 'yz-e17', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 33900, prop: 318100, burn: 140.0, group: 0, recovery: 'expended', src: 'masses: GCAT; engine: rocketdb (secondary: wikipedia.org) (rocketdb 1f8b463)' },
      { engines: {'yz-e18': 1}, engineCount: 1, engineName: 'yz-e18', propellant: 'kerolox', nozzleLayout: { type: 'single' }, reusable: false, dry: 9300, prop: 80700, burn: 300.0, group: 1, recovery: 'expended', src: 'masses: GCAT; engine: GCAT (rocketdb 1f8b463)' },
    ],
    modes: [{ variant: 'leo', payload: 13500, orbit: { hp: 185, ha: 185, inc: 51.6 }, src: 'spec:steppe-arrow#leo (GCAT LEO capacity)', est: ['orbit (GCAT gives no reference orbit: 185 km at the main site latitude)'] }] },
];
