# gfx/vehicles — hero vehicle models (art1, Rocket Art Bot)

Original procedural models with real-world-inspired proportions (dimensions from the Vehicle Specs Bot sheet,
`/workspace/game-studio/orbit-rush/specs/`). No logos, no real names: ids match `vehicles/catalog.js`
(`sparrow-1, heron-9, heron-9-v11, heron-9-crew, heron-heavy, titan-ss-v3, titan-ss-v4`) plus
`catch-tower, payload-roadster, payload-flatsat-stack`. Display names come from `vehicles/brand.js`.

Files: `textures.js` (procedural canvases: paint with panel lines + soot gradient, carbon, stainless, hex tiles,
grid-fin lattice, regen bell / heat-tinted extension, solar cells), `kit.js` (shared materials; every part is baked
into one merged mesh per material), `parts.js` (bells + powerheads, grid fins, legs, ogives, decal strips, struts),
`vehicles.js` (models), `decals.js` (livery slots), `viewer.html` (standalone viewer: `gfx/vehicles/viewer.html?id=heron-9[&webgl]`).

Budget (hi / lo LOD): heron-9 16k tris, 31 meshes / 2k tris; heron-heavy 43k; titan-ss-v3 52k tris, 14 meshes / 5k.
Textures: <= 512 px canvases, generated once and shared.

## Integration hook (for Game bot, after f3)
```js
import { buildLOD, build, setLegs, VEHICLES } from './gfx/vehicles/vehicles.js?v=f4';
const rocket = buildLOD('heron-9');            // THREE.LOD; origin = bottom of the engine exits, +Y up, metres
scene.add(rocket);                              // LOD needs rocket.update(camera) only if autoUpdate is off
const { stages } = rocket.userData.hi.userData; // stages.booster / .upper / .payload (heron-heavy: + side0, side1, struts)
for (const L of rocket.userData.hi.userData.legs) setLegs(L, 1); // 0 stowed .. 1 deployed (do the same on .lo)
build('catch-tower').userData                   // tower child has mountY (launch mount top) and catchY (chopstick height)
build('heron-9', { fins: 1, legs: 1 })          // fins: grid-fin deploy 0..1 at build time
```
To swap stages at staging, detach `stages.upper` etc. (each is a Group positioned in vehicle space).
Brand pack (private repo only): `import { setBrandPack } from './gfx/vehicles/decals.js'; setBrandPack({ 'booster.side': urlOrCanvas, ... })`
before building. Slots: booster.side, upper.side, fairing.side, capsule.side, ship.side, titanbooster.side, sat.top.

## Perf notes (rockets-3)
- **Swapping models:** call `dispose(group)` (or `await release(group, renderer, scene, camera)`, which detaches, renders one frame without the model and then disposes). The rendered-cycle heap leak (+27.5 MB per full cycle, ~3.6k buffers, Playtest QA) came from three r172 RenderObjects subscribing to our shared materials' `dispose` event; `kit.js` `weakDisposeListeners` now holds those listeners weakly. `tests/vehicles_budget.cjs` checks the rendered heap (flat to <3 MB over 4 cycles; measured 18.9 → 19.1 MB).
- **Avoid `THREE.InstancedMesh` for per-model parts** in r172: each instance mesh leaves node-builder state behind (+5.5 MB/cycle measured). The leg arms are therefore one vertex-rewritten mesh.
- **heron-9 family hi:** 27–28 meshes, 16.8–18.5k tris (was 40–41 / 15.9–17.6k), with a budget of 30 meshes / 20k tris. Phones should still use `buildLOD(id, {phone: true})` (mid near level: 18–19 meshes, 5.5–6.2k tris).
- **Build cost:** titan hi takes 58–70 ms to build on the main thread (heron-heavy hi 25–49 ms). Build at the hangar or showroom, never mid-flight: `prewarm(['titan-ss-v3', ...], {phone})` builds during idle slices, and `await takeWarm(id, {phone})` hands one out (it builds on the spot if it wasn't prewarmed).
