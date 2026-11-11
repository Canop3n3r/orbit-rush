# Orbit Rush: foundation-first plan (replaces "One clean flight")

Written 2026-11-10 from a code read of /workspace/orbit-rush (795 commits, Oct 19 – Nov 5 2026). Nothing is committed or pushed.
Repo draft: `orbit-rush/ARCHITECTURE.md` (uncommitted).

## 1. What the code actually is

| Area | What exists | Evidence |
|---|---|---|
| Game state | No universe object. There are two modes, `state = 'build' \| 'flight'` (main.js:791), and the whole game lives in one 2,925-line `main.js` with 234 top-level `let/const` globals. | main.js:791; `state === 'flight'` appears 65 times |
| The "Flight" | `Flight` is described as "one flight from the pad to the end screen" (flight.js:1). A new `Flight` is built from a pad design every time the preview refreshes (main.js:928, `showPreview`). | flight.js:1, 214; main.js:923-929 |
| Clock | No persistent universal time. `tAbs = t0 + v.clock` (flight.js:242), and `t0` is `EPOCH = epochMillis(params, Date.now())` (main.js:830, fun/trailer.js:126-131). Every session starts at wall-clock *now*, so time warp done in one flight is thrown away at the next one, and saved craft can jump backwards or forwards. | flight.js:242; main.js:830 |
| Physics | This part is strong. Full-scale 6-DOF point vehicle, fixed RK4 step `PHYS_DT = 0.02` (flight.js:30), `stepVehicle` (physics/dynamics.js:105), and on-rails `railsStep` for warp (dynamics.js:167). The game clock runs at `SIM_SPEED = 2`× real time (flight.js:13). | physics/dynamics.js, physics/kepler.js |
| Patched conics | Present and good: SOI changes (`switchBody`, `checkSOI`, flight.js:252-269), `nextEvent`, `predict`, `closestApproach`, Hohmann, Lambert, interplanetary planning, finite burns (physics/patched.js:45-300), and real ephemerides for about 20 bodies (physics/solar.js). | physics/patched.js |
| Maneuver nodes | Present: add, remove, burn time, closed-loop execution, warp to node (flight.js:271-363). | flight.js |
| Floating origin | Present, but only for rendering: the camera-relative scene puts the focused craft at the origin (main.js:85, 1877-1881). There is no physics-frame equivalent of Krakensbane, because there is no multi-body physics. | main.js:1877 |
| Vehicle model | A **stage list**, not a part tree. `buildVehicle` gives `{stages:[{dry,fuel,eng,n,fins,parts}], cur, payload, fairing}` (parts.js:210-222). Parts are mass and flags inside a stage. There are no attach nodes and no per-part state, structure or joints, so docking, a craft splitting in arbitrary ways, or building a station can't be represented. | parts.js:210 |
| Other vessels | `Fleet` (fun/fleet.js, 96 lines) holds records with state vectors that are Kepler-propagated on demand. That is the right idea. But it lives **inside a Flight** (`this.fleet = new Fleet()` in `initFleet`, fun/vessels.js), it is rebuilt every session, and `seedFleet` brings back saved payloads with `veh: null` (vessels.js:81-84), which drops the full vehicle state. | fun/fleet.js:1-5; fun/vessels.js:81 |
| Switching craft | `canSwitch` refuses on the pad: *"Launch first: nothing to switch to on the pad"* (vessels.js:94). It also refuses below the rails altitude, while a booster is flying, or during a return (vessels.js:92-105). The CRAFT button only appears when `F.ignited && n > 1` (main.js:1110). **So you cannot reach any craft without launching a new rocket first.** This is the exact problem Aaron describes. | vessels.js:92-105; main.js:1110, 1333 |
| Save/load | Three separate stores that don't know about each other. (1) `orbitrush.world.v1` holds payloads only: r, v, t, kind (fun/world.js). It **assumes Earth**: `stateAt` and `orbit` use `MU_E`/`R_E` (world.js:10,13), so a craft parked around the Moon or Mars is propagated wrongly on reload. Anything with periapsis below 120 km is refused (world.js:6,12). Separated stages are never written. (2) `orbitrush.quicksave.v1` is one Flight snapshot (main.js:1248-1253), and it warns that "the booster in flight is not saved". (3) `PR` progress/contracts are kept separately (fun/progress.js). | fun/world.js; main.js:1105-1109, 1248 |
| Time warp | `WARPS` goes up to 1e7 (flight.js:14). Warp exists only inside a Flight, and the result isn't carried into the next session (see Clock). | flight.js:14, 754-766 |
| Scenes/UI | No space center, tracking station or VAB scene. "Home" is a rocket picker with a pad preview (main.js:785 says "the hangar / Build screen is gone"). Missions, Career and Academy are hidden but still loaded. | main.js:785-786 |
| Manual flight | It exists: SAS modes stab, prograde, retrograde, node, antinormal, antiradial and off; navball (fun/navball.js); touch stick (fun/navstick.js); RCS; fine control (flight.js:567-575). But the product is built around AUTO: the "fly" rungs ignite on AUTO (main.js:2468), and 136 of the 1,099 lines in flight.js mention auto. | flight.js:567-575; main.js:2468 |

**In short:** the physics kernel is roughly KSP-class for a single craft (and better on real-scale ephemerides). The *game* around it is a one-flight arcade loop. There's no universe, no persistent clock, no vessel registry that outlives a flight, no scenes, and the vehicle model is a stage list.

## 2. KSP fundamentals vs Orbit Rush

| KSP fundamental | Orbit Rush | Evidence |
|---|---|---|
| Universe/game state with a persistent list of vessels (orbit + state each) | **Partial → effectively missing.** A Fleet exists but is per-Flight. The world save is payloads-only and Earth-only. | fleet.js, vessels.js:81, world.js:10 |
| Persistent universal time | **Missing.** The epoch is Date.now() each session. | main.js:830 |
| On-rails Keplerian propagation for unloaded vessels | **Present** (`Fleet.stateAt`, `propagate`), but only Earth-mu in the saved world. | fleet.js:26; world.js:13 |
| Physics bubble (loaded vessels near the active one get full physics) | **Missing.** Only the active vessel and a special-cased booster sim are integrated. Everything else is on rails or just a mesh. | flight.js:849+; main.js:1074-1086 |
| Floating origin / Krakensbane | **Partial**: render-only. Doubles in ECI are fine for one point vehicle, but a bubble needs a local frame. | main.js:1877 |
| Part-tree vessel model (attach nodes, decouplers, docking ports, per-part state) | **Missing.** Stage list only. | parts.js:210 |
| Scene separation (Space Center / Tracking Station / Flight / VAB) | **Missing.** Two modes inside one god-file. | main.js:791 |
| Tracking station (pick any vessel, fly it, warp the world) | **Missing.** This is the #1 gap Aaron hits. | vessels.js:94 |
| Time warp (physics warp + rails warp, world-wide) | **Partial.** Rails and physics warp exist per Flight and aren't persisted. | flight.js:754 |
| Maneuver nodes, patched-conic prediction, encounters | **Present** and strong. | patched.js |
| Manual flight + SAS as the primary loop | **Partial.** The controls exist, but the product funnels players into AUTO, and onboarding teaches AUTO. | main.js:2468 |
| Career/science loop (contracts, science, tech tree, funds) | **Weak and hidden.** A contract chain and unlocks exist (fun/progress.js:1). Career and Academy are hidden. There's no science. | progress.js |
| Docking, rendezvous, EVA | Closest approach math exists (patched.js:111). Docking can't be represented (no part tree); fun/dock.js is UI only. | patched.js:111 |

## 3. Where the effort went

Measured from git, Oct 19 – Nov 5 2026. "Real" commits are those with at least one changed line that isn't a `?v=` cache-tag bump.

| Bucket | Commits touching (real) | Lines added | Tests |
|---|---|---|---|
| AUTO flight: guidance.js, hoverslam.js, control.js, director.js plus ascent/landing/auto tests | 185 (**63 real**) | **2,486** | 31 test files drive AUTO (`setAuto`/`autoOn`) |
| Persistence/switching: fleet.js, vessels.js, vesselui.js, world.js plus fleet/postswap tests | 126 (**9 real**) | **641** | 6 test files touch the fleet |
| Art and vehicles: gfx/, vehicles/, assets/ | 345 + 157 + 12 | **22,157** | 26 roster tests |

Commit messages mentioning auto/guidance/ascent/landing/RTLS number 121, against 64 for fleet/vessel/save/switch (and most of those 64 are "rebake staged fleet" art). **About 7× more real commits and 4× more code went into AUTO than into persistence. About 35× more code went into art than into persistence.** The only real switching work is f6.2 (Oct 25) and OR-002 (Nov 5).

## 4. Verdict: new core, same repo, keep the physics and the art

Don't patch. Don't switch engines.

- **Why not patch:** the missing pieces are the *spine*: universe, clock, vessel registry, scenes and part tree. Everything in main.js and flight.js assumes "one Flight built from a pad design". Adding a tracking station on top means fighting `canSwitch`, `seedFleet`, three save stores and 234 globals. That is the "retrying a broken system" pattern again.
- **Why not Unity or another engine:** the valuable thing here is the orbital/physics kernel: real-scale doubles, patched conics, Lambert, ephemerides, 6-DOF RK4, ~130 headless tests. A generic engine gives you none of that, since KSP itself had to build rails, Krakensbane and patched conics on top of Unity. Unity WebGL on an iPhone is also heavier than Three.js WebGPU. Godot and Babylon would throw away the 22k lines of art code too. Three.js is fine as a *renderer*. The problem is that no game architecture was built under it.
- **Optional library:** if the part tree needs joint physics later (wobbly stacks, docking contact), add Rapier (WASM) **inside the physics bubble only**, in a local frame. Not needed for M1–M3.

**Keep:** physics/* (kepler, patched, solar, atmosphere, aero, thermal, dynamics, vec, constants), vehicles/ specs and roster data, gfx/ art and the staged hero models, assets/, fx and plumes, navball and navstick widgets, audio.
**Rewrite (in this order):** `core/universe.js` (clock + vessel registry + one save) → `core/vessel.js` (part tree + per-part state, with an adapter to today's stage list so `stepVehicle` keeps working) → `core/propagator.js` (rails for every body, wrapping kepler/patched) → `core/bubble.js` (load/unload around the active vessel, local frame) → `scenes/*` (SpaceCenter, TrackingStation, Flight, VAB) behind a `SceneManager` → shrink main.js into a renderer and HUD shell → re-attach AUTO as an *optional* autopilot module.
**Retire:** fun/world.js and quicksave (folded into the universe save), the Fleet-inside-Flight design, hidden Missions/Career/Academy code (rebuild later on the new core), and the `?v=` per-file cache tags (one build version).

## 5. Core architecture spec

```
core/
  clock.js        UT (seconds since game epoch, persisted), warp rate, warp limits (rails vs physics)
  universe.js     { ut, bodies, vessels: Map<id, Vessel>, activeId, settings } ; save()/load() single JSON (versioned, migratable)
  vessel.js       Vessel { id, name, situation: 'prelaunch'|'landed'|'flying'|'orbiting'|'escaping'|'docked'|'destroyed',
                           body, orbit|surface (elements at epoch, or lat/lon/alt), parts: PartTree, resources, controlState, flightPlan(nodes) }
  parttree.js     Part { uid, specId, parent, attachNode, children, state(fuel, temp, deployed, power) } ; split(at decoupler) -> 2 vessels ; merge(docking)
  propagator.js   railsState(vessel, ut) for ANY body via patched conics (wraps physics/kepler + patched) ; SOI hand-off for unloaded vessels too
  bubble.js       loaded set = active + vessels within 2.5 km ; local frame centered on active (Krakensbane) ; packs/unpacks rails <-> physics
  stage.js        derive stage list from part tree (adapter feeding physics/dynamics.stepVehicle unchanged)
scenes/
  scene_manager.js  one active scene ; enter/exit hooks ; no globals shared across scenes except Universe + Renderer
  space_center.js   hub: Launch (VAB), Tracking Station, Flight continue, Missions board
  tracking.js       list + 3D map of every vessel/body ; select -> Fly / Rename / Terminate ; world-wide warp to next event
  vab.js            part-tree assembly (start: roster rockets as prefabs + editable payload stack)
  flight.js         flies Universe.active through the bubble ; HUD, navball, SAS, nodes ; AUTO is a plugin, off by default
autopilot/        ascent, landing, node exec: optional modules over controlState (existing guidance.js moved here)
render/           Three.js renderer, floating origin, art loaders (existing gfx/)
```

Rules: no module under `core/` imports three or DOM (it runs in node tests). Everything goes through `Universe`, with one save. Switching vessels means `universe.setActive(id)` followed by `bubble.reload()`. It works from any scene and never needs a launch.

## 6. Milestones (each ends with a playable acceptance test on Aaron's iPhone, plus a headless node test)

**M1: The World Persists**
- Universe, clock, vessel registry, one save, and a Tracking Station scene with a minimal Space Center hub.
- Acceptance (node test `tests/core/universe.mjs` + manual check):
  1. Launch craft A to orbit, then go back to the Space Center. Launch craft B to a different orbit.
  2. Open the Tracking Station, which lists A and B (and their spent stages) with orbits. Tap A, then Fly, and you are flying A **without launching anything**.
  3. Warp the world 1 day in the Tracking Station. A and B sit exactly where Kepler says, within 1 m.
  4. Reload the page. UT, both craft, their fuel and their nodes are all identical.
  5. A craft around the Moon reloads around the Moon (today it is propagated with Earth's mu).

**M2: You Can Fly It**
- Manual flight comes first. SAS is the primary tool, AUTO is off by default, and onboarding teaches flying by hand.
- Acceptance:
  1. A brand-new player (cleared save), with no AUTO button visible, gets to orbit using the first-flight tutorial: SAS stab → pitch over at 100 m/s → prograde hold → circularize with a node. The test is that a non-player friend gets to orbit in under 10 minutes.
  2. A headless test flies the tutorial inputs to orbit for small, medium and heavy rockets.
  3. AUTO is available as a "Pilot assist" unlock after the first manual orbit.
  4. HUD shows only Ap, Pe, speed, alt, throttle, stage, navball and SAS. Everything else is behind a menu.

**M3: Many Ships, One Sky**
- Part tree, a physics bubble and splitting.
- Acceptance:
  1. Staging splits the part tree into two vessels. Both appear in the Tracking Station, and the spent stage is flyable.
  2. Two vessels within 2.5 km are both physically simulated (a booster coasting beside the core) with no jitter at 7,000 km from Earth's centre (local frame).
  3. Rendezvous: launch B to meet A using target and closest approach, then switch between them inside the bubble with no reload.
  4. A docking-port part exists in the tree (actual docking merge is M4).

Later: M4 Docking & Stations (merge part trees, a station built from 2 launches), M5 Real VAB (part-tree editing, attach nodes), M6 Career & Science (contracts on the new core, science from experiments at bodies and situations, a tech tree), M7 Interplanetary campaign (existing transfer planner re-attached), M8 Polish & expansion.

## 7. Quality bar for every bot (drop-in: `orbit-rush/QUALITY_BAR.md`, section in ARCHITECTURE.md)

1. **Study the reference first.** Before you build a system, write 5 lines on how KSP, KSP2, Juno: New Origins, SimpleRockets 2 or Children of a Dead Earth do it, and what we'll do better.
2. **Aim past the ask.** Every task report ends with "Beyond the ask": 1–3 expansions that would make this feel top-tier. Don't build them, propose them.
3. **Kill, don't patch.** If a system needed 3 fixes in 2 weeks, or fights the architecture, write a rewrite proposal against ARCHITECTURE.md instead of a fourth patch.
4. **Architecture first.** Code must go into the module that owns it (section 5). No new globals in main.js. No feature may bypass Universe.
5. **New-player test.** Every player-facing change answers this: would someone who has never played understand it without you there?
6. **Proof is playable.** Done means the milestone acceptance test passes headless *and* a recorded phone run exists. Green unit tests alone don't count.
7. **Red main blocks everything.** No merge while `tests/prepush.sh` is red.

## 8. Team structure

| Module | Owner | Notes |
|---|---|---|
| core/ (Universe, clock, vessel, parttree, propagator, bubble) and the merge gate | **Game bot** (lead) | Only Game bot merges. Writes ARCHITECTURE.md changes. |
| scenes/ (Space Center, Tracking Station, Flight shell, VAB) and onboarding | **Mission Design** (repurposed as Game Feel / UX) | Owns the new-player test and the tutorial |
| parts and specs → part-tree prefabs, the stage adapter | **Vehicle Specs** | Converts roster stage lists into part trees |
| render/ and art (frozen except for what the new scenes need) | **Rocket Art** (+ World Art paused) | No new art until M2 ships |
| Acceptance tests and phone runs per milestone | **Playtest QA** | One pass per merge. Top 5 bugs. Runs the milestone acceptance script. |
| autopilot/ | Nobody until M2 is done | Then Vehicle Specs re-attaches it as an optional module |
| Playtest squad (10 bots) | Paused | Bring back 2 at M2 for new-player testing |

**How expansion ideas are generated:** at each milestone close, Game bot runs one "Reference & Reach" session. Every active bot submits its "Beyond the ask" items plus one reference-game teardown. Game bot ranks them by fun per effort and posts the top 5 for Aaron to pick 1–2 for the next milestone. Unpicked ideas go to `plans/IDEAS.md`, never into code.

## 9. Order of work for M1 (concrete)

1. `core/clock.js` + `core/universe.js` + `tests/core/universe.mjs` (save/load round-trip, multi-body rails). No UI yet.
2. Migration: read `orbitrush.world.v1` and the quicksave into the Universe once, then stop writing them.
3. Move Fleet out of Flight. `Flight` takes `(universe, vesselId)` instead of `(design)`. Launching creates a vessel in the Universe and then flies it.
4. `scenes/tracking.js` (reuses solarmap.js rendering) + Fly button → `universe.setActive` → Flight scene.
5. Space Center hub replaces Home. Delete `canSwitch`'s "Launch first" path.
6. Acceptance run on iPhone and the M1 checklist.
