// Off-world sandbox site 'generic': a plain pad for any other body (sandbox launches). body 'generic' has no fixed
// radius: placeSite(obj, SITE, R) takes the body's radius (SITE.R is only the budget test's default).
export const SITE = { id: 'generic', name: 'Sandbox Pad', body: 'generic', R: 600000, lat: 0, lon: 0, reuse: false, sandbox: true, sky: 0x05070c, sun: [-500, 250, 250],
  layout: [
    { k: 'ground', mat: 'regolith', r: 1200 },
    { k: 'lz', at: [0, 0], r: 24 },
    { k: 'tanks', at: [-70, 10], n: 2, r: 3 },
    { k: 'hab', at: [80, -20], n: 2, r: 3.5 },
    { k: 'solar', at: [80, 50], n: 3 },
    { k: 'masts', pts: [[-35, -35], [35, -35], [35, 35], [-35, 35]], h: 12 },
    { k: 'road', pts: [[24, 0], [70, -10]], w: 4 },
  ],
  views: { hero: { eye: [110, 35, 140], at: [10, 4, 0] }, top: { eye: [10, 330, 160], at: [10, 0, 0] }, phone: { eye: [75, 28, 100], at: [10, 4, 0] } } };
