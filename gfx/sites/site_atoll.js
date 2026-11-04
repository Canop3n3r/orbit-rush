// Site 'atoll' (fun/ladder.js START site): small island range in the central ocean, low-latitude pad for the
// first small orbital launchers. Expendable only: no landing zone, no droneship. Local frame: +X east, +Y up, +Z south.
export const SITE = { id: 'atoll', name: 'Atoll Range', body: 'earth', lat: 9.0477, lon: 167.7433, reuse: false,
  land: { r: 520, sand: true, wob: 0.3, edge: 160 }, // sites-on-land-1: the ground tile draws the island itself (sand, irregular shore), a little wider than the pad apron
  layout: [
    { k: 'ground', mat: 'sand', r: 420, sea: { w: 14000, d: 14000 } },
    { k: 'pad', at: [0, 0], r: 28, trench: 5, mount: 3, tower: { w: 4, h: 28, x: -14, mast: 10, arms: [{ y: 18, len: 5 }] } },
    { k: 'hangar', at: [-20, 95], w: 22, d: 40, h: 12 },
    { k: 'tanks', at: [55, 10], n: 2, r: 2.2, style: 'h' },
    { k: 'tanks', at: [55, -30], n: 2, r: 3, style: 'v', h: 9 },
    { k: 'block', at: [70, 110], w: 18, h: 5, d: 12, roof: true },
    { k: 'water', at: [-80, 40], h: 22, r: 4 },
    { k: 'masts', pts: [[-45, -40], [45, -45], [45, 45], [-45, 45]], h: 26 },
    { k: 'road', pts: [[0, 25], [-20, 70], [-20, 160], [70, 160], [70, 120]], w: 7 },
    { k: 'road', pts: [[25, 0], [50, 0]], w: 5 },
    // world-pop-1: palms, dune grass, shore boulders, a tracking dish, a crew lot and far volcanic islets (gfx/sites/world.js)
    { k: 'dish', at: [-70, -55], r: 3.5, h: 5 },
    { k: 'lot', at: [-85, 150], w: 24, d: 16, fill: 0.5 },
    { k: 'scatter', seed: 'at', r0: 40, r1: 200, mix: { palm: 90, scrub: 80, grass: 120, rock: 8 }, shore: 50, mid: 0.3 },
    { k: 'belts', seed: 'at', road: 5, perimeter: 12, ring: 120, coast: 40, r1: 210, kinds: { tree: 'palm', under: 'grass' }, coastKinds: { tree: 'palm', under: 'scrub' }, mid: 0.35 }, // world-pop-2: palm lines along the roads and the island rim
    { k: 'hills', islets: 7, r0: 2500, r1: 7000, h: 220 },
  ],
  views: { wide: { eye: [380, 120, 420], at: [0, 0, 0], fov: 50 }, hero: { eye: [95, 30, 120], at: [0, 12, 10] }, top: { eye: [0, 520, 260], at: [0, 0, 40] }, phone: { eye: [90, 40, 120], at: [0, 16, 0] }, night: { eye: [95, 30, 120], at: [0, 12, 10], night: true } } };
