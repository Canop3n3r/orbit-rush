// Site 'cape-heritage' (the game's default pad: gfx/earthmap.js PAD_LAT_DEG/PAD_LON_DEG, Earth-fixed +x): the heritage
// crewed-launch complex. Big pad with fixed tower and crew arm, tall vertical assembly building at its real offset
// (~4.6 km west, 2.5 km south) joined by a twin-lane crawler road, propellant spheres, droneship station downrange.
export const SITE = { id: 'cape-heritage', name: 'Heritage Complex', body: 'earth', lat: 28.6084, lon: -80.6043, reuse: true,
  layout: [
    { k: 'ground', r: 5600, sea: { x: 8800, w: 12000, d: 20000 } },
    { k: 'pad', at: [0, 0], r: 95, trench: 16, mount: 10, tower: { w: 12, h: 105, x: -30, mast: 28, arms: [{ y: 82, len: 18 }, { y: 62, len: 16 }, { y: 40, len: 12 }] } },
    { k: 'vab', at: [-4555, 2470], w: 158, d: 218, h: 160, doors: 2 },
    { k: 'hangar', at: [-120, 380], w: 70, d: 120, h: 30 },
    { k: 'tanks', at: [-170, -140], n: 1, r: 11 },
    { k: 'tanks', at: [170, -140], n: 1, r: 9 },
    { k: 'tanks', at: [180, 90], n: 4, r: 3, style: 'h' },
    { k: 'block', at: [-200, 120], w: 36, h: 9, d: 22, roof: true },
    { k: 'water', at: [300, -60], h: 88, r: 10 },
    { k: 'masts', pts: [[-140, -140], [140, -140], [140, 140], [-140, 140]], h: 70 },
    { k: 'masts', pts: [[-4400, 2300], [-4700, 2300], [-4400, 2640], [-4700, 2640]], h: 50, min: 'mid' },
    { k: 'road', pts: [[-15, 95], [-15, 700], [-2200, 1700], [-4440, 2300]], w: 12 },
    { k: 'road', pts: [[15, 95], [15, 700], [-2170, 1730], [-4410, 2330]], w: 12 },
    { k: 'road', pts: [[-120, 440], [-120, 900], [600, 900]], w: 9, line: true },
    // world-pop-1: support area + dressing (gfx/sites/world.js)
    { k: 'lot', at: [-290, 200], w: 48, d: 28 },
    { k: 'block', at: [220, 960], w: 40, h: 10, d: 24, roof: true, mat: 'clad' }, // visitor / press building
    { k: 'lot', at: [60, 960], w: 60, d: 30 },
    { k: 'dish', at: [260, 230], r: 8, h: 10 },
    // world-pop-2: textured support buildings (gfx/sites/world.js bld)
    { k: 'bld', style: 'assembly', at: [-420, 420], w: 70, d: 60, h: 62 },
    { k: 'bld', style: 'blockhouse', at: [-300, -160], w: 28, d: 18, h: 9 },
    { k: 'bld', style: 'hangar', at: [380, 140], w: 50, d: 80, h: 24 },
    { k: 'bld', style: 'office', at: [-480, 820], w: 40, d: 26, h: 16 },
    { k: 'bld', style: 'office', at: [360, 640], w: 34, d: 22, h: 10 },
    { k: 'tanks', at: [100, -330], n: 3, r: 4, style: 'v', h: 16 },
    { k: 'scatter', seed: 'ch', r0: 80, r1: 2400, mix: { pine: 90, palm: 40, scrub: 140, rock: 24 }, shore: 24, mid: 0.05 } /* phone near tier stays under the 8k site cap */,
    { k: 'belts', seed: 'ch', road: 0.45, perimeter: 24, ring: 260, coast: 50, r1: 2400, mid: 0.3 }, // world-pop-2: crawler-road tree lines, pad hedge ring, shore palms
    { k: 'hills', r0: 7500, r1: 13000, h: 320, from: Math.PI * 0.5, to: Math.PI * 1.5 }, // inland ridges beyond the assembly building
  ],
  stations: [{ id: 'droneship', name: 'Droneship holding area', lat: 29.8, lon: -76.0, layout: [{ k: 'droneship' }] }],
  views: { wide: { eye: [900, 300, 1100], at: [-2500, 0, 0], fov: 50 }, hero: { eye: [190, 70, 250], at: [-10, 45, 0] }, top: { eye: [-2200, 5200, 5200], at: [-2200, 0, 1200], fov: 45 }, vab: { eye: [-4200, 120, 2900], at: [-4555, 70, 2470] }, phone: { eye: [190, 80, 250], at: [0, 55, 20] } } };
