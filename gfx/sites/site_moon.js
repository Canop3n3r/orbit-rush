// Off-world sandbox site 'moon': a simple base pad on the flat basalt plain (fun/lore.js 'tranq' site coordinates,
// Moon body-fixed frame). Regolith-blast berm, landing/launch pad, hab modules, solar farm, propellant spheres, mast lights.
export const SITE = { id: 'moon', name: 'Moon Base Pad', body: 'moon', lat: 0.7, lon: 23.5, reuse: false, sandbox: true, sky: 0x020306, sun: [-500, 160, 200],
  layout: [
    { k: 'ground', mat: 'regolith', r: 1500 },
    { k: 'lz', at: [0, 0], r: 26 }, { k: 'berm', at: [0, 0], r: 42, t: 2.5 },
    { k: 'hab', at: [110, -30], n: 3, r: 4 },
    { k: 'solar', at: [110, 60], n: 5 },
    { k: 'tanks', at: [-90, 20], n: 3, r: 3.5 },
    { k: 'dish', at: [150, 40], r: 4, h: 5 },
    { k: 'hangar', at: [-70, -90], w: 18, d: 24, h: 9, rot: Math.PI / 2 },
    { k: 'masts', pts: [[-40, -40], [40, -40], [40, 40], [-40, 40]], h: 14 },
    { k: 'road', pts: [[26, 0], [100, -10]], w: 5 }, { k: 'road', pts: [[-26, 0], [-75, 15]], w: 5 },
  ],
  views: { hero: { eye: [140, 40, 170], at: [20, 4, 0] }, top: { eye: [30, 420, 200], at: [30, 0, 0] }, phone: { eye: [90, 30, 120], at: [20, 5, 0] } } };
