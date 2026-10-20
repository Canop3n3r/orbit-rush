# gfx/world — f5 world-1 (Rocket Art Bot)

Volumetric clouds + Earth/Moon/Mars surface detail, as standalone modules (not yet wired into `main.js`; Game bot owns integration).
Units are km; pass the planet centre/sun direction via the uniforms.

- `tiers.js` — `WORLD_TIERS` (high: 20 steps × 2 light samples, med: 14 × 1, low: 2D layer), `worldTier(gfxQ, touch)` (touch/low ⇒ 2D), `lonLatToDir`.
- `clouds.js` — `createClouds({ weatherTex, tier, R })` → `{ mesh, U, setSun(v), update(dt, camera) }`. Raymarched shell (1.6–9 km) driven by the Earth cloud map as weather/coverage (coverage remap + billow/erosion noise), Beer-Powder + dual-lobe HG, ambient + Earth shadow. March is unrolled at build time (a dynamic TSL `Loop` stalled software/mobile GPUs). Far field (>260 km) blends to the smooth weather-map shape (no speckle). `U.offset` = weather-of-the-day offset; `U.wind`/`U.time` advect.
- `surfaces.js` — `earthSurfaceMaterial`, `moonSurfaceMaterial`, `marsSurfaceMaterial`, `capGeometry` (high-res ground cap around a site). Earth: coastline mask + turquoise shallows, ocean glint/wave normals (fade by altitude), land detail normals, cloud shadows (share `cloudUV` with `clouds.U.offset`), contrast-curved night lights dimmed under cloud. Moon regolith grain + detail normals; Mars dunes + dust haze (in the surface shader, not the atmosphere).
- `world.html` — showcase/perf page: `?shot=pad|10km|100km|orbit|moon|mars&tier=high|med|low&webgl&perf=N&view` (view = coverage/noise/shape debug).

Integration sketch (main.js, ~6 lines): build `CU = cloudUniforms({R})`, `createClouds({weatherTex: GX.tex('earth_clouds', q, false), tier: worldTier(gfxQ, isTouch()), R, U: CU})`, add mesh, set `CU.center`/`setSun` each frame and call `update(dt, camera)`; swap `GX.earthMaterial` for `earthSurfaceMaterial(...)` with `cloudUV: CU.offset`. The atmosphere/bloom stay as f4.1 left them.
