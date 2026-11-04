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
    // world-pop-1: support area + dressing (gfx/sites/world.js). Scatter stays off the pad, roads, buildings and the sea side of the coast.
    { k: 'block', at: [-230, 300], w: 40, h: 12, d: 24, roof: true, mat: 'clad' }, // range operations office
    { k: 'block', at: [230, 220], w: 50, h: 14, d: 30, mat: 'clad' },              // parts warehouse
    { k: 'lot', at: [85, 330], w: 44, d: 24 },
    { k: 'dish', at: [-210, -170], r: 6, h: 8 },
    // world-pop-2: textured support buildings (gfx/sites/world.js bld: facade / roof / stripe maps)
    { k: 'bld', style: 'assembly', at: [-380, 120], w: 60, d: 50, h: 55 },  // stage integration block
    { k: 'bld', style: 'blockhouse', at: [-300, -120], w: 26, d: 18, h: 8 }, // launch control blockhouse
    { k: 'bld', style: 'hangar', at: [300, -160], w: 46, d: 70, h: 22, rot: Math.PI / 2 }, // booster refurb hangar
    { k: 'bld', style: 'office', at: [260, 420], w: 30, d: 20, h: 12 },
    { k: 'tanks', at: [-60, -300], n: 3, r: 4, style: 'v', h: 16 },        // LOX / RP-1 day tanks
    { k: 'scatter', seed: 'cn', r0: 60, r1: 1500, mix: { pine: 150, palm: 50, scrub: 220, rock: 30 }, shore: 50, groves: 40 },
    { k: 'belts', seed: 'cn', road: 4, perimeter: 22, ring: 210, coast: 60, r1: 1500, mid: 0.3 }, // world-pop-2: tree lines along the roads, a hedge ring round the pad fence, palms + dune grass on the shore
    { k: 'hills', r0: 4500, r1: 10000, h: 680, ridge: 0.65, from: Math.PI * 0.5, to: Math.PI * 1.5 }, // world-pop-2: taller ridged inland range (grass foothills, rock above), south through west to north
    { k: 'beach', z0: -2400, z1: 2600, w: 170, out: 30 }, // world-pop-2: sand / wet sand / foam strip on the game's waterline
  ],
  stations: [{ id: 'droneship', name: 'Droneship holding area', lat: 30.5, lon: -74.5, layout: [{ k: 'droneship' }] }],
  views: { wide: { eye: [900, 260, 900], at: [-1500, 0, -200], fov: 50 }, hero: { eye: [170, 60, 220], at: [-10, 32, 20] }, top: { eye: [0, 900, 420], at: [0, 0, 90] }, phone: { eye: [150, 70, 200], at: [0, 45, 20] } } };
