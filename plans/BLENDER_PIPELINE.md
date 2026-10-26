# Blender stage-asset pipeline (f6.0)

the owner's direction (10/25): the Build menu is gone for now; every rocket is built from **stage assets, each modelled in Blender**: real geometry with a
controlled mesh budget, one `.glb` per stage, a manifest per rocket. This document is the spec: formats, naming, budgets, kit, how to run it, how the
game loads it.

## 1. What is produced

```
assets/rockets/index.json                     per-rocket switch (enabled), tiers, stage count, bytes
assets/rockets/<id>/manifest.json             the rocket: stages in order, attach nodes, engines, pivots, sizes, tri/byte counts
assets/rockets/<id>/<stage>.<tier>.glb        one asset per stage and tier (hi | mid | lo)
assets/rockets/_shared/<sha1>.<tier>.glb      byte-identical stage assets (e.g. 5 identical strap-on boosters) stored once, referenced by path
```

Tiers: **hi** (desktop near), **mid** (phone near), **lo** (far LOD, all devices). Phones only ever fetch mid + lo. Each tier is a separate file, so
streaming is just choosing a URL (no LOD nodes inside a file).

## 2. Frame, units, naming

* Metres, **+Y up**, the stage axis is +Y. Asset origin = the hull axis at the **bottom of the stage silhouette**; engine bells hang below (negative Y).
* The rocket (vehicle) frame is the same as the procedural models: origin at the bottom of the lowest engine exit. `manifest.stages[i].offset` places the
  asset origin in that frame, `rotY` is a yaw about +Y (strap-ons are yawed so their attach side faces the core).
* glTF node names inside an asset (all exported with `extras`):
  * `<key>.hull|metal|bell|dark|tile|glass|foam` – one mesh per material (≤ 7 draw calls per stage),
  * `nozzle_<i>` – empty at the **bell exit centre**; extras `bell_r` (exit radius, m), `length` (m), `prop` (kerolox | methalox | hydrolox | solid | hypergolic), `dir` = [0,-1,0],
  * `attach_top`, `attach_bottom`, `attach_side` (strap-ons), `com` (centre-of-mass hint),
  * `leg_<i>` – hinged landing-leg pivots (rotate about local Z; `deploy_rad` = −2.0 like `setLegs`; stowed = pointing up the hull),
  * `gridfin_<i>` – grid-fin pivots (`deploy_axis`, `deploy_deg`),
  * `fairing_L` / `fairing_R` – the two half-shells of a fairing, each with its own pivot on the base ring (`hinge`, `sep_dir` extras).
* Stage keys are the **same keys the game already uses** (`booster`, `upper`, `payload`, `s1`, `srb0`, `side0`, `core`, ...): the staging code
  (`fun/stagemap.js`), plume tables (`gfx/vehicles/nozzles.js`) and the payload logic need no changes.

## 3. Materials (light, no per-rocket textures)

Five shared PBR kinds (`hull`, `metal`, `bell`, `dark`, `tile`, plus `glass`, `foam`): factor-only glTF materials; **the livery is baked into vertex colours**
(paint, bands, soot gradient at the engine end, regen-cooling copper on bells, faint panel facets, heat-shield tile noise). `gfx/vehicles/staged.js` swaps every
imported material for ONE shared `MeshStandardMaterial` per kind (vertex colours on), so the whole fleet shares 8 materials. No textures, so no atlas to
download; panel lines, tank welds, separation grooves and fairing seams are real geometry.

## 4. Budgets (enforced by `tests/staged_models.cjs`)

| tier | triangles per stage asset | notes |
|------|---------------------------|-------|
| hi   | 6k–20k target, **≤ 20 000** | all detail: bells with corrugation, powerheads, actuators, grid-fin lattice, legs with braces, bolt pads, RCS quads |
| mid  | 2k–6k target, **≤ 6 000**   | phones' near tier |
| lo   | 600–1 500 target, **≤ 1 500** | silhouette, bells, thin details dropped |

The builder re-runs a stage with lower segment counts (`scale` × 0.75 per attempt) until it fits. Bytes: after quantisation + meshopt, **mid tier ≤ 250 KB per
rocket**, fleet total ≤ 25 MB (all tiers, lazy-loaded per rocket, cached by the browser).

## 5. Manifest schema (v1)

```json
{ "schema": 1, "id": "heron-9-v11", "height_m": 68.4, "units": "m", "frame": "game: +Y up, origin = bottom of the lowest engine exit",
  "tiers": ["hi","mid","lo"], "order": ["booster","upper","payload"], "skipped": [{"key": "...", "why": "..."}],
  "bytes": {"hi": 0, "mid": 0, "lo": 0},
  "stages": [ { "key": "booster", "role": "tank|strap|solid|capsule|les|fairing", "prop": "kerolox",
      "asset": {"hi": "assets/rockets/<id>/booster.hi.glb", "mid": "...", "lo": "..."}, "tris": {"hi":0,"mid":0,"lo":0}, "bytes": {...},
      "offset": [x,y,z], "rotY": 0, "size_m": {"h": 47.6, "r": 1.9},
      "attach": {"top": [0,h,0], "bottom": [0,0,0]}, "com": [0,y,0],
      "engines": [ {"pos": [x,y,z], "dir": [0,-1,0], "bell_r": 0.46, "length": 1.25, "prop": "kerolox"} ],
      "group_noz_ref": [x,y,z],   // asset origin in the stage-GROUP frame the plume table (nozzles.js) uses: group-frame nozzle = ref + engine.pos
      "legs": 4, "grid_fins": 4 } ] }
```
`skipped` lists stages the pipeline did not model (non-axisymmetric: wings, orbiter bodies, ...): those keep the procedural stage group (the whole rocket falls back to
procedural until every stage has an asset).

## 6. The kit (`tools/blender/`)

```
tools/blender/build.sh [rocket-id ... | all]   the one command (TIERS=hi,mid,lo ; BPY=… ; GLTFX=…)
tools/blender/setup.sh                         one-time: venv with `pip install bpy` (Blender 5.2 as a python module, python 3.13) + glTF-Transform
tools/blender/extract_specs.cjs                vehicle data -> specs/<id>.json  (needs the repo served + playwright; regenerate when the procedural vehicles change)
tools/blender/specs/<id>.json                  per-stage input: silhouette (radius vs height), livery bands, nozzles (+ bell lengths), legs, fins, propellant, offset
tools/blender/overrides/<id>.json              hand-tuned overrides on top of the spec (hero rockets): legs, fins, role, force
tools/blender/bake.py                          Blender entry: spec -> stage assets -> manifest   (runs in the bpy python; deterministic)
tools/blender/kit/geo.py                       geometry buffers, lathe / box / prism / cylinder / rod / torus, Blender assembly (bevel + smooth-by-angle modifiers), glb export
tools/blender/kit/parts.py                     hull lathe + livery bands + welds + soot, bells (parabolic, regen + extension, corrugation, lip, powerhead, actuators), engine cluster,
                                               thrust structure / octaweb plate, bolt-pad interstage, RCS quads, grid fins, landing legs, fairing halves, capsule (tiles, windows), solid motor
tools/blender/kit/stage.py                     stage role classification + the per-stage build recipe
tools/blender/optimize.mjs                     quantise + meshopt (glTF-Transform), byte-identical dedupe into _shared/, byte counts, index.json
tools/blender/flight_shots.cjs                 flies a rocket on AUTO and screenshots pad / liftoff / staging / fairing split / release
```
Determinism: seeds derive from `md5(<rocket>/<stage>)`; nothing reads the clock; same specs + same Blender => same bytes. Idempotent: `build.sh <id>` wipes and rewrites
only that rocket's folder.

How a stage is built (tank stage): silhouette lathe split into livery runs (one glTF material per run) → tank welds as real grooves → soot gradient from the engine end →
thrust structure (cone from the hull base to the bell throats, or octaweb plate when the bells sit in a skirt) → bells (`prop` picks the regen tint) → separation ring bolt pads →
RCS quads on upper stages → legs / grid fins as animatable pivots → empties (nozzles, attach, CoM).

## 7. How the game loads it (`gfx/vehicles/staged.js`)

* `assets/rockets/index.json` is the **per-rocket switch**: `"enabled": false` keeps that rocket procedural. URL overrides: `?staged=off` (all procedural), `?staged=all`
  (every rocket that has a manifest), `?staged=id1,id2`.
* `preloadStaged(id, {phone})` fetches the manifest + the tiers the device needs (phone: mid + lo, desktop: hi + lo) with `GLTFLoader` + `MeshoptDecoder`, caches parsed scenes by URL.
* `vehicles.js build()` checks `stagedReady(id, detail)`: if the assets are in, `buildStaged()` returns a `Group` with the **same shape** as the procedural models
  (`userData.stages = { key: Group }`, `userData.legs`, `height`, `id`, `detail`); each stage group sits at the origin like before and the asset hangs under it at the manifest offset/rotY.
  Geometry is cloned per instance (so `release()` can free it), materials are the shared cached ones. Payload (`setPayload`) works as before (it sizes itself on the shell group).
* `main.js attachHero()` starts the preload; the procedural model stands in until it lands; if the rocket has not ignited yet it is rebuilt from the manifest. The pad idles until STAGE,
  so the swap lands before anyone flies it. Any failure keeps the procedural model: the game never breaks mid-migration.
* Staging: the existing `dropPlan` hides stage groups by key; dropped stages are copies (`heroPiece`) of the stage group → the asset falls physically.
* Plumes: the nozzle empties/`engines[]` match `gfx/vehicles/nozzles.js` (test-enforced), so `alignCorePlumes` places plumes on the modelled bells.
* Fairing: `spawnFairHalves()` uses the asset's `fairing_L` / `fairing_R` half-shells (cloned) instead of the generic half-cones.

## 8. Tests
`tests/staged_models.cjs` (manifests, files, budgets, nozzles vs plume table, builds at all tiers, nothing above the nose / below the exits), `tests/staged_launch.cjs` (390×844 touch launch of every
staged rocket, no errors), plus `tests/hero_models.cjs` / `tests/smoke/hero_follow.cjs` for the procedural fallback.
