# f3 regression smokes (Playtest QA Bot)

    node tests/smoke/f3_smokes.cjs [baseUrl] [--shots dir] [--only check1,check2]

Defaults to the live Pages build. Headless Chrome with SwiftShader, phone 390x844 touch, `fx=low`. Exit 0 only if all 8 pass.
Needs playwright-core (`PW_CORE=` path) and Chrome (`CHROME=` path).

| check | pass when |
|---|---|
| plume_on_nozzles | `plumeAudit()` finds ≥1 plume and none off a live nozzle (8 km ascent) |
| no_shock_cone | aero FX change ≤12% of screen pixels (FX on vs hidden) and shock scale ≤ 0.6·L+6 m |
| no_spiral_trail | smoke-trail lateral RMS ≤ 9 m |
| auto_staging | AUTO stages the booster with 0 STAGE taps, with >2% booster fuel left (for the return) |
| map_ui_15pct | non-canvas UI covers ≤15% of 8 px grid samples in map view; no overlapping `.mlab` labels |
| map_cam_upright | after 4 drags (incl. past the pole) camera right·Z < 0.05 and up·Z ≥ 0 (NORTH = +Z) |
| audio_after_tap | AudioContext `running`, master > 0, not muted after the first tap |
| end_card_compact | `#end` ≤45% of the screen, ≤8 body lines, covers ≤20% of `rocketBox()` (if on screen) |

Software GL note: `no_shock_cone` reads 8.9–13.6% on f3 between runs (threshold 12%), so it's borderline/flaky on SwiftShader.
Since f5a (clouds drift on sim time, bigger smoke trail) the raw FX-on/off diff read 21.8–26.4% with no shock cone at all: two FX-on frames 300 ms apart already differ by ~30%. The check now takes a third FX-on frame and counts only pixels that change with FX *and* stay put between the two FX-on frames (`fxCoverPct`); `rawPct` and `motionPct` are logged too. Live f5a.1: 5.7% (raw 25.2, motion 30.8).

# UI budget smoke (Playtest QA Bot): step 1 of the UI ideal path

    node tests/smoke/ui_budget_smoke.cjs [baseUrl] [--strict] [--vp 390x844,844x390] [--shots dir] [--json out.json]

Checks each screen's controls, words, UI coverage and taps from open to liftoff against the budgets in `playtest/ui_ideal_path_2026-10-20.md` §6. It uses the `ui_audit_menus.cjs` counting rules: topmost-at-centre controls and text, and an 8 px opaque-UI grid. It runs at 390x844 and 844x390 touch by default.
**Report-only by default**: it prints PASS/FAIL per budget and always exits 0. `--strict` exits 1 on any FAIL. Budgets move to strict as the UI PRs land.
Screens: first_run (must already be Home; no welcome), home, settings, missions_hub, build, hud_auto, orbit_toast, map, photo, end_card, plus taps_to_liftoff (real taps on a fresh profile, ≤2). It takes ~2.5 min on SwiftShader. Coverage is a grid estimate (±3%).

Rev 2 spec-gap checks (ideal path rev 2): `end_card hud_hidden` (no flight-HUD control visible, touch HUD `#mtop/#mleft/#mright/#mThr` included; a control counts when the hit point is itself, a child, or its own container) + `over_rocket` (card bbox must not contain the rocket's screen centre; viewport centre until `__game.rocketScreen()` exists), `home launch_h` (≥64 px) + `thumb_zone` (bottom 25% portrait / bottom-right quadrant landscape), `picker group_words` (company chips `[data-company]`/`.co-chip` ≤2 words), `home builder_gated` (builder hidden unless Sandbox on). Checks whose UI doesn't exist yet print SKIP with a note and never fail.

f5.1c note: the welcome's `#frSb` became "🚀 Fly now" (it launches), so the screen pass now closes `#firstRun` without tapping it before measuring Home/Build/Settings; `taps_to_liftoff` still taps `#frSb` for real. Without this, f5.1c measured the flight HUD as "home"/"build" and read 26/70. Same 18/72 on f5.1b (local ca31428).

# Far-planet smoke (f6.4)

    U=http://localhost:8964/ OUT=dir [BODIES=earth,moon,mars,venus,jupiter] [ALTS=1000,10000,...] node tests/smoke/planet_far.cjs

Parks the craft on the Sun side of a body at each altitude (km above the surface), points the camera at the body centre (tele fov so a far disc is ~60 px) and reads back three frames with the UI hidden: normal, planet+clouds hidden, sky sphere hidden. Inside the disc: ≥90% of pixels must change when the planet is hidden (it is drawn), ≤2% may change when the sky is hidden and are not drifting clouds (no sky painted over it), mean luminance ≥25. Bug it guards: the sky sphere was a fixed 1e8 m, so any planet whose surface was further than 100,000 km from the camera was drawn behind it. One slow software-GL page, ~40 s per case.

# release_end_safe (Playtest QA Bot, f5.9-7 live pass)

    VP=390x844,844x390 node tests/smoke/release_end_safe.cjs [baseUrl]

At orbit: a real double tap (120 ms apart) on RELEASE must release the payload but not end the flight (END FLIGHT takes the same corner once the payload is out), and ending the flight with the craft list open must close the list (no FLY/VIEW rows left over the end card). Red on f5.9-7 d9ca4843: 4 FAIL (2 per viewport). `planet_far` now imports `physics/solar.js` relative to the page so it also runs on the GitHub Pages sub-path.

# staged_deploy (Playtest QA Bot, f5.9-9 live pass)

    U=http://localhost:8959/ [VP=390x844] node tests/smoke/staged_deploy.cjs [ids...]

Every staged (Blender, f6.0) rocket on AUTO: reaches orbit, drops at least one stage, splits the fairing into 2 halves, shows a tappable RELEASE in orbit without a hidden extra STAGE, and a real tap releases the payload. Red on f5.9-9 (dfd186de) for electrino (AUTO parks with the kick stage attached; RELEASE appears only after a manual STAGE). planet_far.cjs now defaults to /usr/bin/google-chrome when CHROME is unset (the bundled headless shell is not installed for playwright-core 1.64).
