// Site 'lz1' (ladder unlock after the booster-landing rung): the return-to-launch-site landing zones for the
// reusable Heron boosters (Rocketwell) on the cape, two pads plus recovery hangar, detanking farm and lighting.
export const SITE = { id: 'lz1', name: 'Landing Zone One', body: 'earth', lat: 28.4858, lon: -80.5428, reuse: true,
  layout: [
    { k: 'ground', r: 1400, sea: { x: 7400, w: 12000, d: 16000 } },
    { k: 'lz', at: [0, 0], r: 46 },
    { k: 'lz', at: [150, 0], r: 46 },
    { k: 'hangar', at: [-30, -190], w: 44, d: 70, h: 30, rot: Math.PI / 2 },
    { k: 'tanks', at: [160, -150], n: 3, r: 2.6, style: 'h' },
    { k: 'block', at: [-170, 40], w: 22, h: 6, d: 14, roof: true },
    { k: 'water', at: [260, 120], h: 40, r: 6 },
    { k: 'masts', pts: [[-75, -75], [75, -75], [75, 75], [-75, 75], [225, -75], [225, 75]], h: 40 },
    { k: 'road', pts: [[0, 46], [0, 120], [150, 120], [150, 46]], w: 12, line: true },
    { k: 'road', pts: [[-30, -150], [-30, -60], [0, -46]], w: 12 },
    { k: 'road', pts: [[0, 120], [-400, 120]], w: 10, line: true },
  ],
  views: { hero: { eye: [330, 90, 300], at: [75, 0, 0] }, top: { eye: [75, 820, 380], at: [75, 0, 0] }, phone: { eye: [200, 70, 260], at: [60, 5, 0] } } };
