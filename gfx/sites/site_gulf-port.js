// Site 'gulf-port' (ladder unlock with the heavy rung): the gulf coast starport for the fully reusable super-lift
// stack (Rocketwell). Two launch-and-catch towers on round mounts, tall vertical tank farm, a production yard with
// high bays ~2.6 km inland along the coast road, a suborbital landing pad and lighting.
export const SITE = { id: 'gulf-port', name: 'Bay Starport', body: 'earth', lat: 25.9972, lon: -97.1566, reuse: true,
  layout: [
    { k: 'ground', mat: 'sand', r: 3400, sea: { x: 6600, w: 12000, d: 16000 } },
    { k: 'catch', at: [0, 0], w: 12, h: 146, armY: 110, arm: 34, qd: 20, qdY: 125, r: 75 },
    { k: 'catch', at: [-260, 0], w: 12, h: 146, armY: 110, arm: 34, qd: 20, qdY: 125, r: 75 },
    { k: 'tanks', at: [-120, -150], n: 6, r: 4.5, style: 'v', h: 32 },
    { k: 'tanks', at: [-120, -230], n: 3, r: 4, style: 'h' },
    { k: 'lz', at: [320, 120], r: 32 },
    { k: 'vab', at: [-2600, 300], w: 50, d: 60, h: 85, doors: 1 },
    { k: 'vab', at: [-2700, 300], w: 40, d: 50, h: 70, doors: 1 },
    { k: 'hangar', at: [-2620, 470], w: 60, d: 110, h: 24, rot: Math.PI / 2 },
    { k: 'tanks', at: [-2450, 150], n: 3, r: 4, style: 'v', h: 20 },
    { k: 'block', at: [140, -120], w: 30, h: 8, d: 18, roof: true },
    { k: 'water', at: [-2800, 120], h: 55, r: 7 },
    { k: 'masts', pts: [[90, -90], [90, 120], [-350, -90], [-350, 120], [-130, 140]], h: 60 },
    { k: 'road', pts: [[400, 260], [-130, 260], [-2400, 320], [-3400, 340]], w: 12, line: true },
    { k: 'road', pts: [[0, 100], [0, 260]], w: 10 },
    { k: 'road', pts: [[-260, 100], [-260, 260]], w: 10 },
    { k: 'road', pts: [[320, 152], [320, 260]], w: 8 },
  ],
  views: { hero: { eye: [170, 50, 330], at: [-110, 75, 10] }, top: { eye: [-1300, 3800, 2600], at: [-1300, 0, 200], fov: 45 }, yard: { eye: [-2350, 90, 760], at: [-2620, 40, 320] }, phone: { eye: [160, 70, 320], at: [-60, 85, 20] } } };
