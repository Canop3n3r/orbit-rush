# Orbit Rush 🚀

Build a rocket from parts (pods, tanks, engines, separators, fins, fairing, RCS, heat shields, parachutes), fly it to a **full-scale Earth orbit**, land the booster on a droneship, then deorbit and bring the capsule home through a plasma-hot reentry. Runs free in the browser on **WebGPU** (Three.js `WebGPURenderer`) with automatic WebGL2 fallback. Add `?webgl` to the URL to force WebGL2.

**Play:** https://canop3n3r.github.io/orbit-rush/

## Academy (ac1)
Ten interactive lessons, opened from **🎓 Academy** in the hangar (first-time players get a prompt): controls & staging, TWR and the rocket equation, aero balance (CoM vs CoP), Max-Q/Mach/drag, the gravity turn, orbits (Ap/Pe, circularizing), attitude control (SAS/RCS, 3 axes), deorbit & reentry heating, parachutes & recovery, and a booster suicide burn. Each lesson has a goal, steps that advance on live telemetry (the relevant HUD readout or key is highlighted), a concept card with the formulas worked through using your rocket's numbers, small interactive plots (Δv budget, Cd vs Mach, air density vs altitude, Sutton–Graves heating), and a pass check. Lessons unlock in order, any can be skipped, and progress is saved in `localStorage` (`orbitrush.academy.v1`). In flight, **/** (or ? LEARN) opens the Learn overlay, which gives a one-line physical explanation of every HUD readout; hovering a label does the same. Sandbox play is unchanged. `?noacademy` suppresses the first-run prompt.

## Phones and tablets (mb1)
Touch devices (pointer: coarse; force with `?touch`, or `?desktop` to opt out) get a mobile layout: a compact HUD with six readouts (ALT, SPD, Ap, Pe, Mach/Q, which switches to heat or vertical speed outside dense air, and fuel). Tap it for the full telemetry sheet. Controls: a thumb stick (pitch/yaw), a roll bar, a vertical throttle slider, a big STAGE button (same double-press guard), AUTO and CHUTE, MAP, and a ☰ menu with SAS modes, RCS, warp, ⏩ Ap, HOME (deorbit), booster, effects, Learn, fullscreen and hangar. Everything respects the safe areas and keeps the rocket and the centre of the screen clear. Hints, toasts and Academy steps use touch wording on touch devices and key names on desktop, through one wording layer (`wording.js`). Haptics fire on staging and failures where supported. Wake Lock keeps the screen on in flight. Effects default to Medium, with the pixel ratio capped at 1.25. Installable as a PWA (`manifest.webmanifest`, `sw.js` is network-only). The hangar becomes one scrolling column with a horizontal parts drawer: tap to add, or long-press and drag onto the stack. The map pinch-zooms.

## Hangar
Assemble the rocket top to bottom: click a part to add it (at the bottom, or above the highlighted part), drag parts to reorder, ▲▼✕ to move/remove, −/+ for engine clusters, ⇧⇩ to reorder whole stages. Stage Separators split stages; Stage 1 is the bottom and fires first. The readout shows mass, Δv, TWR and burn time per stage, total Δv against the ~9,400 m/s that orbit really costs, the **aero balance** (centre of mass ● yellow vs centre of pressure ● cyan, also drawn on the 3D preview; the CoP must sit behind the CoM or the rocket flips), an AUTO test-flight verdict and the booster-landing plan. Templates: ★ Recommended (default), Light & fast, Heavy lift, Orbit & home (crew capsule with an ablative shield and parachutes), Three-stager. The AUTO verdict runs in a Web Worker (`worker.js`), so editing never stalls the preview. The **Effects** menu sets effects quality (High / Medium / Low; saved in the browser). Toggle Earth rotation (+465 m/s at the equatorial pad). Save designs to the browser with Save.

## Controls
| Key | Action |
|---|---|
| Space | Ignite. After liftoff, press Space **twice** (within 2 s) to stage |
| Shift / Ctrl (↑/↓) | Throttle up / down |
| Z / X | Full / cut throttle |
| W / S · A / D · Q / E | Pitch · yaw · roll (engine gimbal, reaction wheels, RCS) |
| 1–7, V | SAS: 1 stability, 2 prograde, 3 retrograde, 4/5 radial out/in, 6/7 normal/anti-normal · V toggles SAS |
| C · I/K J/L H/N | RCS on/off · RCS translation (needs a Puffer RCS Ring) |
| F | AUTO: flies all the way to orbit (gravity turn, Max-Q throttling, staging, coast, circularization, cutoff). Steer or press F to take over |
| T / , | Time warp up / down. Coasting above 140 km uses exact Kepler "rails" up to ×1000 |
| G | Warp to apoapsis (drops to ×1 for the burn) |
| Y | Fly the booster landing yourself (or hand back to auto-land) |
| M | Map view with the orbit line |
| B | Watch the booster land |
| O | Deorbit and return: AUTO turns retrograde, burns Pe down to ~45 km, separates the capsule and flies it shield-first; O again cancels |
| P | Deploy parachutes now (drogues below Mach 1.2 and 15 kPa; mains under 95 m/s and 4.5 kPa — outside those limits they shred) |
| U | Cycle effects quality |
| R | Back to hangar |

On phones, on-screen buttons are shown. Drag to orbit the camera; scroll or pinch to zoom.

## Physics (v2)
Everything lives in `physics/` and is pure JS with no DOM, shared by the game, the tests and (later) the lessons:

| Module | What it does |
|---|---|
| `constants.js` | WGS84 radius 6,378,137 m, μ = 3.986004418e14, Earth rotation 7.292e-5 rad/s, Kármán line 100 km |
| `atmosphere.js` | U.S. Standard Atmosphere 1976: T, p, ρ, speed of sound per layer to 86 km, then the 1976 thermosphere table (log-interpolated) to 1,000 km |
| `aero.js` | Cd(Mach) with transonic rise and supersonic falloff, normal-force model (nose + body crossflow + fins), centre of pressure, stagnation temperature, Sutton–Graves heat flux bridged to free-molecular flow, Knudsen number / flow regime, real-gas T₀ cap |
| `thermal.js` | Per-part skin/interior temperatures: convection by flow exposure, radiation, soak, ablation, limits |
| `vehicle.js` | Stack geometry, mass, centre of mass and moments of inertia from the parts |
| `dynamics.js` | 6-DOF rigid body (quaternion attitude, body rates), RK4 at a fixed 0.02 s step, engine thrust/Isp vs ambient pressure, gimbal + reaction wheels + RCS, aero force and torque about the CoM, Kepler rails, 3-DOF boosters |
| `control.js` | SAS modes and the attitude controller |
| `guidance.js` | AUTO ascent (gravity turn, Max-Q and g-limit throttling, coast, circularization) and the booster autopilot (entry + landing burn) |
| `kepler.js` | Orbital elements, time to apoapsis, universal-variable propagation, orbit lines |

Each frame `v.tel` exposes Mach, dynamic pressure, AoA, g-load, density, temperature, stagnation temperature, stagnation heat flux, the airflow direction in the body frame and the CoM/CoP stations, for the effects and lessons phases. Rendering is camera-relative (floating origin): the focused craft sits at the scene origin, the Earth turns underneath, and a high-resolution ground tile is rebuilt in float64 around it, so full-scale coordinates never jitter in float32.

## Heating, reentry and recovery (fx1)
`physics/thermal.js` gives every part a two-node temperature (skin + interior): hot-wall convective heating from the stagnation heat flux scaled by how much of the part faces the flow (leading face, sides, wake shelter behind a shield), radiation εσT⁴ to space, conduction soaking into the interior, and ablation (the Ember shield loses mass above 1,450 K at 12 MJ/kg). Every part has a temperature limit; fins and the parachute pack burn off, anything else destroys the craft. Heat flux follows Sutton–Graves (q̇ = 1.74e-4·√(ρ/rₙ)·V³) in continuum flow and bridges to the free-molecular limit (½ρV³·0.9) by the Knudsen number; in the thermosphere the HUD shows Mach as "— (rarefied)" and T₀ falls back towards ambient, and T₀ has a real-gas cap (~7–8 kK). Heat shields: **Kiln Tile** (reusable, 1,900 K) and **Ember Ablative** (3,000 K). **Canopy Parachute Pack**: two drogues, then three reefed mains; touchdown ≤ 12 m/s recovers the capsule (+4,000 × payload multiplier). The HEAT panel shows the three hottest parts against their limits, the shield temperature and ablator left, and whether the next parachute stage is safe to deploy.

## Effects
`fxmap.js` maps telemetry to effect intensities (pure functions, tested for monotonicity) and `fx.js` draws them:
- **Airflow particles** stream past the rocket along the real body-frame flow direction (a Rankine source/sink body + crossflow doublet, slowed and brightened behind the Mach cone). On WebGPU they are integrated by a TSL compute shader (up to 16,000); on WebGL2 they run on the CPU (up to 2,200). `?fxcpu` forces the CPU path.
- **Vapor cone** at the shoulder near Mach 1 / Max-Q in humid low air; **shock cone and compressed-air glow** scaling with Mach and q; **plume** that widens as ambient pressure drops (underexpanded, ~√(pe/pa)), with shock diamonds low down.
- **Reentry plasma**: a bow-shock cap, windward glow and a wake trail coloured from orange to white-violet with T₀ and heat flux, oriented to the airflow, plus ablation embers and smoke; incandescent skins from ~800 K.
- Quality High / Medium / Low changes particle counts and layers; if frames drop for 2 s, the quality steps down before the render resolution does. `?fx=high|med|low` pins it (no auto-lowering). `?scenario=orbit` / `?scenario=reentry` start the selected design in orbit (dev/testing).

## Code
`parts.js` (part catalog, designs, staging, Δv/TWR math, aero balance, validation), `physics.js` (re-exports `physics/*`), `flight.js` (one flight's rules: staging, fairing, clock, warp/rails, booster, scoring, hints; no DOM), `main.js` (rendering, input, HUD), `fx.js` / `fxmap.js` (effects), `worker.js` (hangar verdict worker), `academy.js` (lessons, pass checks, progress, glossary; no DOM; every formula imported from the physics modules), `mobile.js` (touch layout and controls), `wording.js` (key vs touch wording), `academy-ui.js` (Academy menu, lesson panel, concept cards, plots, Learn overlay), `physics/thermal.js` (part temperatures).

## Tests
`node tests/physics.mjs`: gravity, the 400 km period, energy and angular momentum over many orbits, RK4 vs Kepler rails, USSA76 spot values, Cd(Mach), drag and terminal velocity, weathervane stability vs tumbling, rigid-body spin, reaction wheels, SAS modes, RCS, Earth rotation, Isp vs pressure, and every template reaching orbit on AUTO at full scale (with and without Earth rotation). `node tests/builder.mjs`: the part builder (Δv/TWR math, staging, validation, aero balance, templates, a hand-built 3-stage rocket). `node tests/flight.mjs`: the game rules headlessly (booster hand-off, warp/rails, fairing, clock, advice, staging guard, booster landing by AUTO and by a scripted pilot, telemetry). `node tests/heat.mjs`: Sutton–Graves and the free-molecular limit against analytic values (including orbital-reentry orders of magnitude), Mach/T₀ clamping in the thermosphere, the thermal model (radiative equilibrium, soak, ablation, failure), parachute deploy limits, scripted deorbits (the capsule survives with either shield and burns up without one; no chutes = impact), an AUTO orbit-and-home round trip, ascent heating margins for every template, and monotonic effect mappings. `node tests/academy.mjs`: every lesson's pass check fires on a scripted correct play and not on a wrong one (driving the real sim headlessly), progress save/load/unlock/skip (including corrupt and throwing storage), and the formula values on the concept cards against the physics modules (a source scan forbids re-typed constants). `node tests/mobile.mjs`: every hint/toast/lesson string rewritten for touch names no keyboard key; desktop wording unchanged; keycaps have touch labels.
