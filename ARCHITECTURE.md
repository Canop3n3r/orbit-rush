# Orbit Rush Architecture (ADOPTED 2026-11-10, M1 "The World Persists")

This is the target structure. Every bot reads this before touching code. Full rationale, evidence and milestones: `plans/FOUNDATION.md`.

## Principles
- **One Universe.** All game state (UT clock, every vessel, active vessel id, progress) lives in `core/universe.js` and is saved as one versioned JSON. No other save keys.
- **Vessels outlive flights.** A vessel is created at rollout and exists until it is destroyed or recovered. Flight is a *view* that flies `universe.active`, and it can be entered from the Tracking Station for any vessel. Launching is never required to reach a craft.
- **Rails everywhere, physics nearby.** Unloaded vessels are propagated with patched conics around any body. Vessels within the physics bubble (2.5 km of the active one) are integrated in a local frame centred on the active vessel.
- **Part tree is truth.** A vessel is a tree of parts with per-part state. Stages are derived from it. Decoupling splits a vessel into two, and docking merges two into one.
- **Manual flight first.** SAS, navball and maneuver nodes are the core loop. Autopilots are optional plugins under `autopilot/` and are off by default.
- **core/ is headless.** Nothing in `core/` imports three or DOM, and all of it is tested under node.

## Modules
| Path | Owns | Owner bot |
|---|---|---|
| core/clock.js | UT, warp rate, rails/physics warp limits | Game bot |
| core/universe.js | vessels Map, activeId, save/load/migrate | Game bot |
| core/vessel.js | Vessel record + situation state machine | Game bot |
| core/parttree.js | parts, attach nodes, split/merge | Vehicle Specs (review: Game bot) |
| core/stage.js | part tree → stage list adapter for physics/dynamics.stepVehicle | Vehicle Specs |
| core/propagator.js | rails state for any body, SOI hand-off (wraps physics/kepler + patched) | Game bot |
| core/bubble.js | load/unload, local frame (Krakensbane) | Game bot |
| physics/* | kept as the kernel (dynamics, aero, thermal, kepler, patched, solar) | Game bot |
| scenes/scene_manager.js | one active scene, enter/exit | Mission Design (UX) |
| scenes/space_center.js, tracking.js, vab.js, flight.js | the four scenes | Mission Design (UX) |
| autopilot/* | ascent, landing, node exec (from physics/guidance.js etc.) | parked until M2 |
| render/* | Three.js renderer, floating origin, art loaders (gfx/) | Rocket Art |

## Vessel record (save format sketch)
```json
{ "v": 2, "ut": 123456.7, "activeId": "v3",
  "vessels": [ { "id": "v3", "name": "Comsat 1", "situation": "orbiting", "body": "earth",
                 "orbit": { "epoch": 123400, "r": [0,0,0], "v": [0,0,0] },
                 "parts": [ { "uid": 1, "spec": "probe-core", "parent": null, "state": { "elec": 80 } } ],
                 "control": { "sas": "prograde", "throttle": 0 }, "nodes": [] } ] }
```

## Rules for bots (quality bar)

1. **Study the reference first.** Before you build a system, write 5 lines on how KSP, KSP2, Juno: New Origins, SimpleRockets 2 or Children of a Dead Earth do it, and what we'll do better.
2. **Aim past the ask.** Every task report ends with "Beyond the ask": 1–3 expansions that would make this feel top-tier. Don't build them, propose them.
3. **Kill, don't patch.** If a system needed 3 fixes in 2 weeks, or fights the architecture, write a rewrite proposal against ARCHITECTURE.md instead of a fourth patch.
4. **Architecture first.** Code must go into the module that owns it (section 5). No new globals in main.js. No feature may bypass Universe.
5. **New-player test.** Every player-facing change answers this: would someone who has never played understand it without you there?
6. **Proof is playable.** Done means the milestone acceptance test passes headless *and* a recorded phone run exists. Green unit tests alone don't count.
7. **Red main blocks everything.** No merge while `tests/prepush.sh` is red.


## Milestone gate
Nothing merges unless it moves the current milestone's acceptance test forward and `tests/prepush.sh` is green. The current milestone is **M1: The World Persists** (see the plan).
