# Orbit Rush 🚀

Build a rocket from parts (pods, tanks, engines, separators, fins, fairing), fly a gravity turn, reach orbit, and land the booster on a droneship. Runs free in the browser on **WebGPU** (Three.js `WebGPURenderer`) with automatic WebGL2 fallback. Add `?webgl` to the URL to force WebGL2.

**Play:** https://canop3n3r.github.io/orbit-rush/

## Hangar
Assemble the rocket top to bottom: click a part to add it (at the bottom, or above the highlighted part), drag parts to reorder, ▲▼✕ to move/remove, −/+ for engine clusters, ⇧⇩ to reorder whole stages. Stage Separators split stages; Stage 1 is the bottom and fires first. The readout shows mass, Δv, TWR and burn time per stage, total Δv against the ~3,600 m/s orbit needs, and an AUTO test flight verdict. Templates: ★ Recommended (default), Light & fast, Heavy lift, Three-stager. Save designs to the browser with Save.

## Controls
| Key | Action |
|---|---|
| Space | Ignite. After liftoff, press Space **twice** (within 2 s) to stage |
| W / S (↑/↓) | Throttle up / down |
| Z / X | Full / cut throttle |
| A / D (←/→) | Pitch |
| F | AUTO: flies all the way to orbit (gravity turn, Max-Q throttle, coast, circularization burn, cutoff). Steer or press F to take over |
| T / , | Time warp up / down (shown on HUD) |
| G | Warp to apoapsis (high warp while coasting, drops to ×1 for the burn) |
| L | Fly the booster landing yourself (or hand back to auto-land) |
| M | Map view with orbit line |
| B | Watch the booster land |
| R | Back to hangar |

On phones, on-screen buttons are shown. Drag to orbit the camera; scroll or pinch to zoom.

## Code
`parts.js` (part catalog, designs, staging, Δv/TWR math, validation), `physics.js` (flight model + AUTO guidance), `flight.js` (one flight's rules: staging, fairing, clock, warp, booster, scoring, hints; no DOM), `main.js` (rendering, input, HUD).

## Physics
2D planar flight around a 1:10 scale Earth (600 km radius, 70 km atmosphere): inverse-square gravity, exponential atmosphere with drag and Max-Q, Isp that changes with air pressure, fuel mass burn, staging, Keplerian apoapsis and periapsis. The booster lands itself with an entry burn and a throttled landing burn, but only if you staged with fuel left over.

`node tests/builder.mjs` checks the part builder (Δv/TWR math, staging, validation, templates on AUTO, a hand-built 3-stage rocket). `node tests/flight.mjs` is the main flight suite: it runs the real game rules in `flight.js` headlessly (booster-fly handoff still reaches orbit, AUTO reaches a stable orbit on every preset, warp-to-Ap, fairing at 40 km, clock starts at liftoff, score freeze, end-screen advice, staging guard, landing warnings). Also `node tests/beginner.mjs` (AUTO-only flights reach orbit), `node tests/manual_land.mjs` (scripted manual booster landing), `node tests/simtest.mjs` and `node tests/kick.mjs` run headless physics checks.
