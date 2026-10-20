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

# UI budget smoke (Playtest QA Bot): step 1 of the UI ideal path

    node tests/smoke/ui_budget_smoke.cjs [baseUrl] [--strict] [--vp 390x844,844x390] [--shots dir] [--json out.json]

Checks each screen's controls, words, UI coverage and taps from open to liftoff against the budgets in `playtest/ui_ideal_path_2026-10-20.md` §6. It uses the `ui_audit_menus.cjs` counting rules: topmost-at-centre controls and text, and an 8 px opaque-UI grid. It runs at 390x844 and 844x390 touch by default.
**Report-only by default**: it prints PASS/FAIL per budget and always exits 0. `--strict` exits 1 on any FAIL. Budgets move to strict as the UI PRs land.
Screens: first_run (must already be Home; no welcome), home, settings, missions_hub, build, hud_auto, orbit_toast, map, photo, end_card, plus taps_to_liftoff (real taps on a fresh profile, ≤2). It takes ~2.5 min on SwiftShader. Coverage is a grid estimate (±3%).
