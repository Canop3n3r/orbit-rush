# Orbit Rush — playtest + UI evaluation of f2 (2026-10-19)

Method: `playtest.cjs` walks every flow headless (Chrome + SwiftShader WebGPU) at **390x844 touch** (pp), **844x390 touch** (pl)
and **1280x800 desktop** (d), screenshots each step to `playtest/shots/{pp,pl,d1280}_NN_*.png`, and runs an automatic
scan per step (visible buttons, < 40 px taps, offscreen controls, overlapping buttons, clipped text, page errors).
Missions are fast-forwarded through the real director. Aaron's iPhone screenshots (plume, map) and QA's
`qa_2026-10-19.md` are folded in. No page errors in any flow.

| Flow | Score f2 (/10) | Main problems | f3 status |
|---|---|---|---|
| First launch + tutorial | 7 | welcome card fine; "Sandbox" button 37 px tall | ok (left) |
| Home showroom | 8 | clean; 9 rockets, swipe/arrows work | — |
| Settings (gear) | 5 | dense; key-binding table shown on phones; 13 px checkboxes | key table hidden on touch |
| Missions hub | 5 | Hop/Venus clipped in landscape, Venus offscreen in portrait | scrollable auto-fit grid |
| Atlas | 7 | long but scrolls | — |
| Builder (phone) | 4 | 135 controls, Launch below the fold, rocket hidden | Launch pinned (sticky); full simplification **still open** |
| Wind tunnel | 7 | ok | — |
| Pad + liftoff | 7 | Needle on pad framed behind the tower on desktop/landscape | open (camera yaw) |
| Ascent visuals (Max-Q) | 3 | sky-wide shock cone, speckle cloud, corkscrew trail, exhaust bit beside the nozzle | **fixed** (see below) |
| Staging / booster RTLS | 5 | "SPACE twice" coaching on AUTO; booster burned up unless player staged by hand | **AUTO stages + lands the booster** |
| End-of-flight card | 3 | 15-line wall, covers rocket and controls, buttons offscreen in landscape, title under the strip, stays over the map | **compact card**: stars, one-line result, Retry / Continue / Home, details folded; hides while the map is open |
| Map + nodes | 3 | 12-button panel, labels on top of Earth, Ap/impact/craft labels stacked, 3-line info, free trackball flips upside down | **remastered** |
| Warp | 7 | fine | — |
| Photo mode | 6 | filter buttons 37 px, under the end card | end card fix covers it |
| One-tap missions | 8 | all succeed (Orbit, Moon, Mars, Venus, Hop); two NEW WORLD cards (Sun + Moon) stacked on each other; Hop showed "Tap AUTO (flies all the way to orbit)" | reveals queued; director suppresses AUTO/stage coaching |
| Split screen | 6 | CONTROL/⤢/✕ under the warp bar at 844x390 | moved below the strip |
| Sound | 0 | **silent since f1**: master gain was wired to itself | **fixed** + gesture unlock + mute in ☰ and ⚙ |

## Root causes worth remembering
- **Corkscrew trail / exhaust bit beside the nozzle**: each frame's smoke was spawned on the path, then `Particles.update`
  moved it by the wind velocity (Earth rotation, ~400 m/s) the same frame, and the previous frame's anchor was not advanced
  with the air. Result: every frame's batch sat `400 m/s · dt` sideways → a sawtooth/helix that depends on frame rate.
  Fix: pre-step spawn positions and carry the anchor with the air. Trail lateral rms 62 m → 0.2 m.
- **Sky-wide cone**: shock mesh height `1.5·L + 25` m with the Mach angle near 90° at M≈1 → a 150 m cone. Now a faint
  collar ≤ min(0.25 L, 2.5 d + 3) m; streak particles only in the reentry plasma regime; vapor lathe + speckle puffs removed
  (condensation is now part of the one trail: whiter/wider in dense humid air when transonic or at high thrust).
- **No sound**: `master.connect(master)` (f1). Now `master.connect(ac.destination)`; unlock on the first pointer/touch/key
  anywhere, resume on visibility change; new mute key so nobody stays stuck muted.

## Tests added
`tests/f3.mjs` (AUTO auto-staging + booster landing, audio wiring), `plume_smoke.cjs`, `map_smoke.cjs`, `audio_smoke.cjs`, `playtest.cjs`.

## Still open (next slices)
- Phone builder simplification (rocket visible, collapsed part categories) — only Launch pinning shipped.
- Pad camera framing for slim rockets; small (< 44 px) taps in settings/photo bar.
