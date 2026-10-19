# Orbit Rush 🚀

Build a two-stage rocket, fly a gravity turn, reach orbit, and land the booster on a droneship. Runs free in the browser on **WebGPU** (Three.js `WebGPURenderer`) with automatic WebGL2 fallback. Add `?webgl` to the URL to force WebGL2.

**Play:** https://canop3n3r.github.io/orbit-rush/

## Controls
| Key | Action |
|---|---|
| Space | Ignite / stage / drop fairing |
| W / S (↑/↓) | Throttle up / down |
| Z / X | Full / cut throttle |
| A / D (←/→) | Pitch |
| F | AUTO: gravity turn, Max-Q throttle, coast + circularize, auto cutoff |
| T / , | Time warp up / down (shown on HUD) |
| G | Warp to apoapsis |
| L | Fly the booster landing yourself (or hand back to auto-land) |
| M | Map view with orbit line |
| B | Watch the booster land |
| R | Back to hangar |

On phones, on-screen buttons are shown. Drag to orbit the camera; scroll or pinch to zoom.

## Physics
2D planar flight around a 1:10 scale Earth (600 km radius, 70 km atmosphere): inverse-square gravity, exponential atmosphere with drag and Max-Q, Isp that changes with air pressure, fuel mass burn, staging, Keplerian apoapsis and periapsis. The booster lands itself with an entry burn and a throttled landing burn, but only if you staged with fuel left over.

`node tests/beginner.mjs` (AUTO-only flights reach orbit), `node tests/manual_land.mjs` (scripted manual booster landing), `node tests/simtest.mjs` and `node tests/kick.mjs` run headless physics checks.
