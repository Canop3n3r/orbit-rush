# Rocket realism audit (realism-1, 2026-11-04)

Method: `tools/blender/viewer_shots.cjs hi <ids>` (side / front / engine-base close-ups, WebGL2 on SwiftShader, no GPU on the box) of every staged rocket
(heron-9, heron-9-crew, heron-9-v11, heron-heavy, new-glendale, atlantean-v-551, electrino, dark-dart), compared with public reference photos of the
real hardware classes. Before shots: /workspace/shots/realism_before/, after: /workspace/shots/realism_after/, collage: /workspace/shots/realism_compare_collage.png.

## Ranked gaps (impact x number of rockets affected)
| # | Gap | Before | Status |
|---|---|---|---|
| 1 | PBR surface variation: every staged hull was one flat vertex colour + one roughness (plastic look) | all 8 | **Fixed (shared)**: grime/mottle colour + roughness map, biplanar from baked stage-frame coords (hi + mid) |
| 2 | Soot gradients: no engine soot on reused/kerolox first stages and boosters | all 8 | **Fixed (shared)** height gradient per stage, weight by role; hand-tuned per hero rocket (SOOT_LOOK) |
| 3 | Panel lines, weld seams, stringers, rivets | all 8 | **Fixed (shared, hi)**: procedural normal map (2 weld rings / 4 m, seam, ribs, rivet rows, access panels) |
| 4 | Environment reflections: viewer env was a 4-stop gradient; game env had no structure | all | **Improved**: clouds, horizon line, ground bounce in GX.envTexture(); viewer now uses the game env |
| 5 | Bell detail (regen tubes, stiffener rings) on staged bells | all 8 | **Fixed (shared, hi)**: tube normal map on `or_bell`. Procedural (non-staged) kit bells keep their colour-map tubes |
| 6 | Fairing seams / separation line, interstage detail on staged assets | all 8 | Open: needs Blender re-bake (geometry), Blender is not installed on the box |
| 7 | Raceways and conduits along the tanks (staged assets have none; procedural dress.js has a feedline) | 7/8 | Open: Blender geometry |
| 8 | Decals: original flags/serials/stage markings on staged hulls (no UVs on the .glb) | all 8 | Open: needs UVs in the Blender export or a projected decal pass |
| 9 | Cryo frost bands on hydrogen/LOX tanks at the pad (cryo.js only feeds procedural models) | new-glendale, atlantean | Open |
| 10 | Tonemapping: ACES flattens white hulls; AgX/neutral + exposure per scene should be A/B tested on a real GPU | all | Open (needs GPU review; not changed to avoid shifting the whole game look) |
| 11 | Procedural (non-staged) fleet: kit paint has colour seams but no normal/roughness maps | ~150 procedural rockets | Open: next shared step (kit.js `paint`/`silver`/`steel` + UV normal maps) |
| 12 | Scuffs and handling marks around attach points, leg hinges | heron family | Partly (generic scuffs in grime map) |
| 13 | Fairings get the generic grime: real fairings are cleaner | all 8 | Open: lower `dirt` for fairing stages |

## Budget
No new geometry or draw calls. +2 textures (256 px RGBA, shared fleet-wide) + 1 grime map. Per-vertex +6 floats (`surf`, `surfw`) on hi/mid only; lo is untouched.
Phones (mid) get colour + roughness only (2 texture taps, no normal work).
