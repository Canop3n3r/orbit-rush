// Off-world sandbox site 'mars': a simple base pad on the floor of the layered crater (fun/lore.js 'gale' site
// coordinates, Mars body-fixed frame). Pad with blast berm, hab modules, solar farm, propellant plant tanks, dish, lights.
export const SITE = { id: 'mars', name: 'Mars Base Pad', body: 'mars', lat: -5.4, lon: 137.8, reuse: false, sandbox: true, sun: [-500, 300, 250],
  layout: [
    { k: 'ground', mat: 'redsoil', r: 1500 },
    { k: 'lz', at: [0, 0], r: 32 }, { k: 'berm', at: [0, 0], r: 50, t: 3, mat: 'redsoil' },
    { k: 'hab', at: [120, -30], n: 4, r: 4.5 },
    { k: 'solar', at: [120, 70], n: 6 },
    { k: 'tanks', at: [-100, 20], n: 3, r: 4, style: 'v', h: 14 },
    { k: 'tanks', at: [-100, -40], n: 2, r: 3.5 },
    { k: 'dish', at: [170, 30], r: 5, h: 6 },
    { k: 'hangar', at: [-80, -110], w: 22, d: 30, h: 11, rot: Math.PI / 2 },
    { k: 'masts', pts: [[-50, -50], [50, -50], [50, 50], [-50, 50]], h: 16 },
    { k: 'road', pts: [[32, 0], [110, -10]], w: 6 }, { k: 'road', pts: [[-32, 0], [-85, 15]], w: 6 },
  ],
  views: { hero: { eye: [160, 45, 190], at: [25, 6, 0] }, top: { eye: [30, 460, 220], at: [30, 0, 0] }, phone: { eye: [100, 35, 135], at: [25, 6, 0] } } };
