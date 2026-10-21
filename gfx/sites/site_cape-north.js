// Site 'cape-north' (ladder unlock after the 100 km rung): the north coast complex, home pad of the reusable Heron
// boosters (Rocketwell). Pad + crew-arm tower, horizontal integration hangar, propellant farm, droneship station downrange.
export const SITE = { id: 'cape-north', name: 'North Coast Complex', body: 'earth', lat: 28.5619, lon: -80.5772, reuse: true,
  layout: [
    { k: 'ground', r: 1600, sea: { x: 7600, w: 12000, d: 16000 } },
    { k: 'pad', at: [0, 0], r: 70, trench: 12, mount: 8, tower: { w: 10, h: 80, x: -26, mast: 22, arms: [{ y: 65, len: 14 }, { y: 50, len: 12 }] } },
    { k: 'hangar', at: [0, 240], w: 62, d: 110, h: 26 },
    { k: 'tanks', at: [140, -20], n: 2, r: 9 },
    { k: 'tanks', at: [140, 60], n: 3, r: 3, style: 'h' },
    { k: 'tanks', at: [-150, -60], n: 2, r: 4, style: 'v', h: 18 },
    { k: 'block', at: [-140, 160], w: 30, h: 8, d: 20, roof: true },
    { k: 'water', at: [-120, 50], h: 70, r: 8 },
    { k: 'masts', pts: [[-110, -110], [110, -110], [110, 110], [-110, 110]], h: 55 },
    { k: 'road', pts: [[0, 70], [0, 185]], w: 14, line: true },
    { k: 'road', pts: [[0, 300], [0, 380], [-600, 380]], w: 10, line: true },
    { k: 'road', pts: [[70, 0], [140, 0], [140, 100]], w: 8 },
  ],
  stations: [{ id: 'droneship', name: 'Droneship holding area', lat: 30.5, lon: -74.5, layout: [{ k: 'droneship' }] }],
  views: { hero: { eye: [170, 60, 220], at: [-10, 32, 20] }, top: { eye: [0, 900, 420], at: [0, 0, 90] }, phone: { eye: [150, 70, 200], at: [0, 45, 20] } } };
