# Orbit Rush 🚀

Build a rocket from parts (pods, tanks, engines, separators, fins, fairing, RCS, heat shields, parachutes), fly it to a **full-scale Earth orbit**, land the booster on a droneship, then deorbit and bring the capsule home through a plasma-hot reentry. Runs free in the browser on **WebGPU** (Three.js `WebGPURenderer`) with automatic WebGL2 fallback. Add `?webgl` to the URL to force WebGL2.

**Play:** https://canop3n3r.github.io/orbit-rush/

## Fun first (f1)
- **Pilot HUD by default:** an altitude/speed gauge, one fuel ring per stage, a mini-globe of your orbit (tap it for the map), the current objective with a progress bar, and big callouts (LIFTOFF, SUPERSONIC, MAX-Q, SEPARATION, SPACE, ORBIT, BOOSTER LANDED). **📊 / Tab** switches to the Engineer view with every number.
- **🎯 Missions (one tap):** Orbit & home, Moon landing, Mars and Venus flyby. The mission director builds the rocket and flies the whole thing on the real physics: AUTO ascent, a planner-built transfer burn, course corrections, SOI warps, the capture burn and a powered Moon landing. It also picks cinematic cameras. Steer, or tap **✋ TAKE OVER**, to fly it yourself.
- **Destruction:** a flash, then a fireball, a shockwave ring, tumbling smoking debris and secondary pops, with distance-scaled shake and a layered boom. Time drops to slow motion as it happens. The Unplanned Disassembly card offers **⟲ Instant replay** and a one-tap relaunch.
- **Building:** parts snap in with an animation and a click. Paint (unlockable colours), decals and a name are drawn on the rocket. **🔮 Will it fly?** draws AUTO's simulated ascent as a ghost trajectory. **🔥 Test stand** static-fires the rocket while it's held down and reports thrust vs. weight. **🌬️ Wind tunnel** shows flow lines, CoM/CoP and whether the rocket weathervanes or flips. **📦 Drop test** drops it from 1.5 km.
- **Plume and air:** a layered exhaust (glow, flame, hot core, nozzle glow, shock diamonds, flicker) that stays tight at sea level and opens into a wide bell in thin air and vacuum. The smoke is a continuous, billowing column that drifts with the wind and thins out with altitude. Flow streaks only appear once the flow becomes compressible (above about Mach 0.8). Vapor cones only form between Mach 0.86 and 1.25 in humid air.
- **Split-screen staging:** after separation the booster flies its own entry and landing burns in full physics while the upper stage climbs. Both appear side by side (stacked on phones), each with its own camera and mini HUD. Tap a pane to make it full screen; ⇄ switches control. The booster pane shows a slow replay of the landing, then closes. Warp is capped at ×10 while both are flying. On phones the second pane renders at half resolution with no flow particles or bloom.
- **Exploration:** a first-visit "NEW WORLD" reveal, the **🪐 Planetary Atlas** (survey notes, gravity, air, points of interest), and the nearest POI shown when you land. Photo mode (**📸** or **'**) offers filters and a PNG snapshot.
- **Retention:** a 10-step contract chain that unlocks paints, decals and the ion engine/xenon tank, 14 achievements, a seeded daily challenge with a local best, a play streak, and bronze/silver/gold mission medals. Progress is saved in localStorage. All sound is synthesized WebAudio (engine, wind, explosions, snaps, fanfare), with a 🔊 mute.
- **Hoverslam landings:** every auto landing (booster return, Moon/airless landers) is a suicide burn from one shared solver (`physics/hoverslam.js`): it uses the live mass, the thrust at the current air pressure, the throttle range, gravity, drag and the height above the pad or deck, plans at 88% throttle so it has room to correct, recomputes every frame, deploys the legs about 5 s out and cuts at touchdown without hovering. The booster's entry burn is decided live from a predicted peak dynamic pressure and heating (none if the path is already safe). Grid fins steer it on the coast. A low TWR falls back to a controlled descent with a warning. A "🔥 Burn in T−x s" cue sits above the navball.
- **Navball:** the centre of the Pilot HUD. It's a per-pixel attitude sphere on its own small canvas showing sky and ground, a pitch ladder, heading ticks and N/E/S/W. It has original markers for prograde/retrograde (◇), normal/anti-normal (△▽), radial (⊞▣), the maneuver node (✛) and the target (◎), a fixed nose reticle and a speed pill (surface/orbit/target, chosen automatically by altitude, tap to cycle). Around it are an SAS ring (stability, prograde, retro, normal, radial, maneuver, target) and throttle and fuel arcs.
- **UI:** one design system with glass panels, a single type scale, 44 px tap targets on touch, and motion for modals and toasts. Callouts, hints and toasts share one top stack so they never overlap. The Pilot card is compact and the hangar is redesigned. Every view is checked for overlaps at 1280×800, 390×844 and 844×390 (`ui_smoke.cjs`).
- Tests: `node tests/hoverslam.mjs` (1-D drops on several worlds, booster nominal + off-nominal entry, Moon) and `node tests/navball.mjs`; `node tests/fun.mjs` flies the one-tap Moon, Mars, Venus and orbit-and-home missions from the pad, and covers take-over, progress/unlocks/daily/streak/medals (including corrupt storage), POIs, the ghost track, the plume and vapor mappings, the test stand, and the warp cap while the booster flies.

## Solar system (ss1)
The whole solar system is in the game: the Sun, the eight planets, Pluto and the Moon, all on real orbits from the epoch (`?epoch=YYYY-MM-DD`, default today). Gravity uses patched conics. Each body owns a sphere of influence (SOI), and the craft switches body automatically at the boundary, during physics steps or on rails. Time warp goes up to **×10,000,000** and stops by itself at every event: SOI changes, 90 s before a maneuver node, alarms, and the rails altitude. You can land on other bodies (a parachute touchdown counts where there is air). Each body has its own goals, worth points: flyby 1,500, orbit 3,000 and landed 6,000.

**Map (M)** is a full 3D orbit camera:
- **Moving the camera:** drag (or one finger) to orbit with a trackball (no gimbal lock). Right-drag, shift-drag or two fingers pan. Scroll or pinch to zoom. Use Tab or ◀ ▶ to change focus, double-tap a body to focus it, and Top / Edge for preset views.
- **What it shows:** orbit lines for every body, plus your predicted trajectory patch by patch in colour. Markers show Ap, Pe, AN/DN, SOI encounters and escapes, impact and closest approach.
- **Maneuver nodes:** tap the trajectory or press ◆ Node to add one. Drag its six handles (prograde/retrograde, normal/anti-normal, radial in/out) or type Δv into the panel.
- **Planner:** pick a target (the Moon or any planet). It gives the next launch window, the transfer Δv, the time of flight and the capture Δv, plus the **best parking-orbit inclination**. It offers the cheaper tuned ejection burn by default and the exact out-of-plane one on request. It can also add a correction burn after the escape.

**Flying to a node:**
- **8** points SAS at the node (MANEUVER). **9** executes it on autopilot.
- **.** (Next) warps to the next event. **G** warps to the node or to Ap.
- Burns are finite-burn aware.

**Launch inclination** is set in the hangar ("Launch incl."), or with `?incl=`. AUTO flies the matching launch azimuth, corrected for Earth's rotation.

New parts: the **Wren H2 tank** (liquid hydrogen), the **Osprey** hydrogen upper-stage engine (451 s), the **Glimmer Ion Thruster** (3,100 s, with a xenon tank) and the **Bison** heavy booster engine. New templates: **Moon lander** and **Mars explorer**.

## Graphics (gx1)
- Licensed planet textures (Solar System Scope, CC BY 4.0; see **Credits** in the hangar and CREDITS.md). The pad sits at a real equatorial coast (0°, 51.5° W) with the Atlantic downrange.
- Earth: day map, city lights on the night side, clouds, ocean glint (specular mask), limb haze and an analytic scattering shell (blue by day, orange at the terminator, sunsets on ascent); the Sun moves with the real game clock and the craft goes dark in Earth's shadow.
- Sun glow + bloom (High), Milky Way sky, ACES HDR tone mapping, PBR parts (clear-coated paint with panel normal maps, metal bells, sky reflections).
- Cinematic launches: steam and dust clouds rolling off the pad at ignition, the plume lighting the pad and smoke, camera shake (engine near the ground, max-Q, staging), separation flash with sparks and ullage puffs at staging. Ground haze.
- Pad: textured concrete apron, flame deflector, lightning masts with wires, roads and buildings; ground tile coloured from the Earth map with shader detail noise.
- Map: textured planets and the Moon, Saturn's ring, Earth with night lights and atmosphere, procedural maps for the smaller moons.
- **Graphics** presets in the hangar: Low (phones and software GPUs; picked automatically there), Medium (phones), High (desktop: bloom + 2K textures). `?gfx=low|med|high` pins it; bloom turns off automatically if the frame rate stays low.

## Quality of life (q1)
- **Esc** pause menu (resume, quicksave/quickload, revert to launch, settings, Δv map, hangar). **F5** quicksave, **F9** quickload (one slot, kept in this browser).
- **Settings**: remap any key (a key taken from another action leaves that one unbound), camera/zoom/touch-stick sensitivity, metric or imperial units, CoM/CoP/CoT markers, free or locked flight camera, conic mode.
- **`** free / locked (follows the craft's attitude) camera. **\\** CoM (yellow) / CoP (cyan) / CoT (magenta) overlay.
- **Map**: ⏰ alarms (before node, SOI, Ap, Pe, +10 min … +1 week; warp stops and the game pauses when one fires), Δv map of the solar system, conic toggle (draw the patch around its own body or around the parent). Maneuver nodes can go on any patch, e.g. a capture burn at the Moon or Mars after the SOI change; warp-to-node crosses the SOI.
- **Impact prediction**: on a suborbital arc the HUD shows IMPACT time and speed (Kepler to the top of the atmosphere, then integrated with drag) and the map marks the point.
- **Hangar**: undo/redo (Ctrl+Z / Ctrl+Y, ↶ ↷), part tooltips, per-body Δv/TWR (pick Earth, vacuum, Moon, Mars, …), Radial Decoupler + RT-40 Booster Tank with 2/3/4/6× symmetry (radial boosters fire first and drop away; template "Side boosters").
- Phones: the ☰ menu has PAUSE, QUICKSAVE, QUICKLOAD, CAM FREE/LOCK and CoM/CoP; the map panel uses the full right column on short landscape screens and sits above a one-row toolbar in portrait, with the node centred in the free part of the screen.

## Academy (ac1)
Twelve interactive lessons, opened from **🎓 Academy** in the hangar (first-time players get a prompt): controls & staging, TWR and the rocket equation, aero balance (CoM vs CoP), Max-Q/Mach/drag, the gravity turn, orbits (Ap/Pe, circularizing), attitude control (SAS/RCS, 3 axes), deorbit & reentry heating, parachutes & recovery, a booster suicide burn, transfer orbits & launch windows, and spheres of influence & gravity assists. Each lesson has a goal, steps that advance on live telemetry (the relevant HUD readout or key is highlighted), a concept card with the formulas worked through using your rocket's numbers, small interactive plots (Δv budget, Cd vs Mach, air density vs altitude, Sutton–Graves heating), and a pass check. Lessons unlock in order, any can be skipped, and progress is saved in `localStorage` (`orbitrush.academy.v1`). In flight, **/** (or ? LEARN) opens the Learn overlay, which gives a one-line physical explanation of every HUD readout; hovering a label does the same. Sandbox play is unchanged. `?noacademy` suppresses the first-run prompt.

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
| T / , | Time warp up / down. Coasting uses exact Kepler "rails" up to ×10,000,000 |
| G | Warp to apoapsis (drops to ×1 for the burn) |
| Y | Fly the booster landing yourself (or hand back to auto-land) |
| M | 3D map (see Solar system) |
| 8 · 9 | SAS to maneuver node · execute node |
| . | Warp to next event (node, SOI, Ap/Pe) |
| Tab · [ ] · + / − | Map focus · cycle · zoom |
| B | Watch the booster land |
| O | Deorbit and return: AUTO turns retrograde, burns Pe down to ~45 km, separates the capsule and flies it shield-first; O again cancels |
| P | Deploy parachutes now (drogues below Mach 1.2 and 15 kPa; mains under 95 m/s and 4.5 kPa — outside those limits they shred) |
| U | Cycle effects quality |
| R | Back to hangar |
| Esc · F5 · F9 | Pause menu · quicksave · quickload |
| ` · \\ | Free/locked camera · CoM/CoP/CoT overlay |
| Ctrl+Z / Ctrl+Y | Undo / redo in the hangar |

All keys can be remapped in Settings (Esc → Settings).

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
`parts.js` (part catalog, designs, staging, Δv/TWR math, aero balance, validation), `physics.js` (re-exports `physics/*`), `flight.js` (one flight's rules: staging, fairing, clock, warp/rails, booster, scoring, hints; no DOM), `main.js` (rendering, input, HUD), `fx.js` / `fxmap.js` (effects), `worker.js` (hangar verdict worker), `academy.js` (lessons, pass checks, progress, glossary; no DOM; every formula imported from the physics modules), `mobile.js` (touch layout and controls), `wording.js` (key vs touch wording), `academy-ui.js` (Academy menu, lesson panel, concept cards, plots, Learn overlay), `physics/thermal.js` (part temperatures), `physics/solar.js` (bodies, ephemerides, frames), `physics/patched.js` (patched conics, prediction, Lambert, transfer planner, finite burns), `solarmap.js` (the 3D map), `settings.js` (settings, key remap, units, undo history), `qol-ui.js` (pause/settings/Δv-map modals, tooltips), `maplayout.js` (node handle layout), `physics/dvmap.js` (Δv map), `gfx/gfx.js` (textures, Earth/atmosphere/cloud materials, bloom, procedural pad and part textures), `gfx/presets.js`, `gfx/earthmap.js`, `assets/tex/` (licensed textures, see CREDITS.md).

## Tests
`node tests/physics.mjs`: gravity, the 400 km period, energy and angular momentum over many orbits, RK4 vs Kepler rails, USSA76 spot values, Cd(Mach), drag and terminal velocity, weathervane stability vs tumbling, rigid-body spin, reaction wheels, SAS modes, RCS, Earth rotation, Isp vs pressure, and every template reaching orbit on AUTO at full scale (with and without Earth rotation). `node tests/builder.mjs`: the part builder (Δv/TWR math, staging, validation, aero balance, templates, a hand-built 3-stage rocket). `node tests/flight.mjs`: the game rules headlessly (booster hand-off, warp/rails, fairing, clock, advice, staging guard, booster landing by AUTO and by a scripted pilot, telemetry). `node tests/heat.mjs`: Sutton–Graves and the free-molecular limit against analytic values (including orbital-reentry orders of magnitude), Mach/T₀ clamping in the thermosphere, the thermal model (radiative equilibrium, soak, ablation, failure), parachute deploy limits, scripted deorbits (the capsule survives with either shield and burns up without one; no chutes = impact), an AUTO orbit-and-home round trip, ascent heating margins for every template, and monotonic effect mappings. `node tests/academy.mjs`: every lesson's pass check fires on a scripted correct play and not on a wrong one (driving the real sim headlessly), progress save/load/unlock/skip (including corrupt and throwing storage), and the formula values on the concept cards against the physics modules (a source scan forbids re-typed constants). `node tests/mobile.mjs`: every hint/toast/lesson string rewritten for touch names no keyboard key; desktop wording unchanged; keycaps have touch labels. `node tests/solar.mjs`: ephemerides, frames, SOI switching, prediction, Lambert and the planner. `node tests/mission.mjs`: full Moon (TLI, correction, capture, landing) and Mars (TMI, correction, arrival) missions, headless. `node tests/qol.mjs`: key remap, units, undo/redo, non-overlapping node handles, radial boosters (validation, symmetry, AUTO to orbit, booster drop), per-body Δv/TWR, the Δv map, quicksave snapshots, impact prediction, and a capture node on a later (Moon) patch. `node tests/gfx.mjs`: graphics presets, Earth map alignment (pad on land, sea downrange), every texture credited, texture budget.

## f1u — compact flight UI (2026-10-19)
The rocket is the hero: thin top strip (ALT · speed · Ap/Pe or next event · warp · ☰), one-line auto-hiding hint, ~88 px navball at the bottom edge with a collapsible SAS fan, slim stick/roll/STAGE/AUTO/throttle, and everything secondary (stats, camera, sound, mission, Engineer) in one ☰ drawer. In-world visuals ride on the craft: a speed/altitude tag, prograde/target arrows, an active-stage ring and stage-separation markers. One speed source feeds the strip, navball and tag.
