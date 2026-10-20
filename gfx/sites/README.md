# Space-center sites (art-sites-N)

Original, logo-free launch complexes for every launch site in `fun/ladder.js` ALL.sites, plus sandbox pads off Earth.

- `site_<id>.js`: pure layout data (no three.js): `{ id, name, body, lat, lon, reuse, layout: [{ k, at: [x, z], rot, ... }], stations, views }`.
  Local frame: +X east, +Y up, +Z south, metres, origin at the main pad. `stations` are remote groups (droneship holding areas)
  placed exactly at their own lat/lon on the sphere.
- `kit.js`: `buildSite(S, { detail, ground })`, `buildSiteLOD(S, { phone })` (near hi, or mid on phones; mid at 1.5 km; lo at 6 km),
  `placeSite(obj, S, R?)` (body-frame matrix from `geo.js`), `disposeSite(obj)`. One merged mesh per material per group, shared
  cached materials, no instanced meshes.
- `geo.js`: Earth sites use `gfx/earthmap.js` latLonToGame (the heritage pad is Earth-fixed +x); Moon/Mars use their plain body-fixed frame.
- Landing zones and droneship stations exist only at the reusable-booster sites (Rocketwell: cape-north, lz1, cape-heritage, gulf-port).
- `viewer.html?id=<id>&view=hero|top|phone` renders the hero shots in `screens/sites_<id>_*.png`; `budget.html` feeds tests/vehicles_budget.cjs.
