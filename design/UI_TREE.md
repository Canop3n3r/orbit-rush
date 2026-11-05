# Orbit Rush UI tree (rocket-first)

Baseline: live f5.6c (main 1051698), phone 390x844. Source inventory + headless captures in playtest/ui_tree_f5.6c/. Missions/story paused. Edit rows freely; statuses compare against f5.6c.

**Totals:** KEEP 34 · CHANGE 34 · ADD 11 · CUT 46

## Style rules (one page)
- Buttons: one shape, radius 12 px, height 48 px on phone / 36 px desktop, 600 15 px, sentence case. Primary = solid orange; secondary = dark navy + thin light border. No gradients. Icons always with a text label (except ☰ ✕ ‹ ›).
- STAGE is the only round button (72 px). ABORT is red outline, hold 1 s.
- Type scale: 12 / 15 / 20 / 32 px. Weights 600 and 800 only. Numbers in tabular figures.
- Units: Imperial default (mph, ft, mi) per Aaron; Settings switch to Metric converts every readout, including Δv and the PiP label. Never mix.
- Flight HUD: at most 8 always-visible items. Contextual items (CHUTE, warp chip) swap into an existing spot, never add one.
- Panels: ≤25% of a phone screen in flight; menus ≤50%; one sheet open at a time.
- Camera: one chase camera, horizon always level, never below ground, eases on every change.
- Words: Fly is the only launch verb; Home is the only exit verb; Restart replaces Return / Revert / Retry-on-pause.

## Screens

### App shell — 3 shown / budget 4

Present on every screen.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Loading | text | Shows load progress | Startup | Center | KEEP | need | #loading |
| Toast | text | One-line status (staged, max-Q) | On events, 3 s, max 1 | Top center under bar | CHANGE | need | #toasts (stacks several) |
| Ignite hint | text | "Tap STAGE to launch" | Pad only | Above STAGE | CHANGE | need | #ignite (long sentence) |
| Rotate tip | text | Suggest landscape for split | Never (cut) | — | CUT | nice | — |

### Home — 8 shown / budget 8

Rocket-first: the rocket fills the screen, one card at the bottom.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Logo | text | Brand | Always | Top left, small | KEEP | nice | .hLogo |
| Menu ☰ | button | Opens Home menu | Always | Top right | KEEP | need | #hMenuB |
| All rockets ▦ | button | Opens picker | — | — | CUT | nice | ☰ › "▦ All rockets" + rocket name should open it |
| Prev / Next ‹ › | button | Cycle rockets | Always | Screen edges, mid | KEEP | need | #hPrev #hNext |
| Rocket name | button | Name; tap opens picker | Always | Card top | CHANGE | need | #hName (not tappable) |
| Role line | text | One-line class + size | Always | Under name | KEEP | need | #hRole |
| FLY | button (primary) | Roll to pad and launch on AUTO | Always | Card, full width | KEEP | need | #hFly |
| Build | button (secondary) | Open Build for this rocket | Always | Right of FLY | CHANGE | need | #hBuildB "🔧" (icon only, add label) |
| Launch site chip | button (chip) | Opens site list | Always | Under FLY | CHANGE | nice | #hSite "📍 Classic pad · Earth" |
| Page dots | indicator | Position in list | — | — | CUT | nice | #hDots (one dot per rocket, too many) |
| Mission label | text | Mission for rocket | — | — | CUT | nice | #hMis (missions paused) |
| Legacy tabs | nav | Fly/Build/Missions/Atlas, Career, Settings | — | — | CUT | nice | #hNav #hnCareer #hGear (hidden but in DOM) |

### Home menu ☰ — 2 shown / budget 3

Small sheet, top right.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Rockets | menu item | Opens picker | Menu open | Sheet | KEEP | need | #hMenu "▦ All rockets" |
| Settings | menu item | Opens Settings | Menu open | Sheet | KEEP | need | #hMenu "⚙ Settings" |
| Atlas | menu item | Planet atlas | — | — | CUT | nice | #hMenu "🪐 Atlas" |

### Rocket picker — 6 shown / budget 7

Full-screen sheet is OK for a menu, but flat and short.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Title + close ✕ | button | Close picker | Always | Top bar | KEEP | need | #pkClose |
| Search | input | Filter by name | Always | Under title | KEEP | need | picker search input |
| Size filter | chips | All / Small / Medium / Heavy | Always | Under search | ADD | nice | — |
| Rocket cards | list | Tap = select + back to Home | Always | Scroll list, 2 columns | CHANGE | need | .pkC (Originals + 4 regions + maker folders) |
| Maker folders | tree | Region > maker grouping | — | — | CUT | nice | Americas/Europe/Eurasia/Asia folders |
| Sandbox switch | toggle | Unlock all | — | — | CUT | need | #pkSandbox (all unlocked since f5.6b) |
| Custom build card | button | Open Build blank | Always | First card | KEEP | nice | #pkBuild |
| My rockets | list | Saved designs | If any saved | Top of list | ADD | nice | #savedSel in Build |

### Build — 9 shown / budget 9

Phone: rocket preview top half, parts bottom half.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Back ‹ | button | Back to Home | Always | Top left | CHANGE | need | #homeBack "‹ Home" full-width bar |
| More ⋯ | button | Unclear | — | — | CUT | nice | "⋯" toggle |
| Part tabs | tabs (icons + label) | Pick part type | Always | Bottom panel top | CHANGE | need | palette icons (no labels) |
| Part cards | list | Tap to add part | Always | Bottom panel | KEEP | need | #palette cards |
| Stack list | list | Parts by stage; ▲ ▼ ✕ per part | Always | Bottom panel | KEEP | need | #stack |
| Stage stats | readout | Δv + TWR per stage (in mph setting units) | Always | Stage header | CHANGE | need | #readout (m/s only) |
| Undo | button | Undo last edit | After an edit | Top right | ADD | nice | Ctrl+Z only |
| Save | button | Save design | Always | Top right | CHANGE | nice | #saveBtn #delBtn #clearBtn #savedSel (4 controls) |
| FLY | button (primary) | Launch this design | Always | Bottom, full width | CHANGE | need | #launchBtn "ROLL TO PAD ▶" (gradient) |
| Templates | buttons | Preset rockets | — | — | CUT | nice | #presets (picker does this) |
| Header extras | buttons | Academy, Missions, Atlas, Credits | — | — | CUT | nice | #academyBtn #missionsBtn #atlasBtn #creditsBtn |
| Launch options | inputs | Earth rotation, inclination | — | — | CUT | nice | #earthRot #inclIn |
| Gfx selects | select | Effects/Graphics | — | — | CUT | need | #fxSel #gfxSel (move to Settings) |
| Test tools | buttons | Test stand, wind tunnel, drop | — | — | CUT | nice | #standBtn #tunnelBtn #dropBtn |
| How to fly | details | Key list | — | — | CUT | nice | <details> (move to Settings › Help) |
| CoM/CoP dots | overlay | Balance markers | Toggle, default off | On rocket | CHANGE | nice | on by default |

### Launch site — 5 shown / budget 5

Nice-to-have; keep Earth simple.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Close ✕ | button | Close | Always | Top right | KEEP | need | .spX |
| World chips | chips | Pick world | Always | Top | CHANGE | nice | .spBodies (16 worlds → Earth, Moon, Mars) |
| Site list | list | Pick named pad | Always | Middle | KEEP | nice | .spSites |
| Map tap | map | Pick any spot | Always | Bottom | KEEP | nice | map canvas |
| Back to classic pad | button | Reset | If site set | Bottom | CHANGE | nice | .spReset "Back to Earth (career pad)" |

### Flight HUD (phone) — 8 shown / budget 8

Max 8 always-visible items. All states share one layout; contextual items replace, never add.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Readout card | readout | Speed mph (big), ALT, Ap/Pe with T− | Always | Bottom left, ≤12% screen | CHANGE | need | #plain (good) — compact it |
| Engineer chips | readout | ALT km / SRF / AP / PE / FUEL / STAGE | — | — | CUT | nice | #mhud (hidden in f5.6c; delete) |
| Stage n/N | readout | Which stage is firing | Always | In readout card | ADD | need | only in chips |
| Menu ☰ | button | Flight sheet | Always | Top right | KEEP | need | #mMenuBtn |
| MAP | button | Orbit map | Always | Top right, left of ☰ | KEEP | need | #mMap |
| Navball joystick | control | Drag = pitch/yaw, twist = roll; shows attitude | Always (dim on AUTO; touch = take over) | Bottom center | CHANGE | need | #nav #navBall (shown; dim it on AUTO) |
| Attitude box | readout | HDG / PIT / ROLL / INC | Tap navball to show | Above navball | CHANGE | nice | #navRd HDG/PIT/ROLL/INC always on |
| Throttle | slider | 0-100%, drag; shows % | Always (dim on AUTO; touch = take over) | Right edge | KEEP | need | #mThr (shown in f5.6c) |
| STAGE | button (round 72) | Fire next stage / ignite on pad | Always | Bottom right | KEEP | need | #mStage |
| AUTO / MANUAL | toggle | Who flies; label shows mode | Always | Above STAGE | CHANGE | need | #mAuto "AUTO" only |
| ABORT | button (hold 1 s) | Cut engines, drop stages, arm chutes | In flight, not orbit | Top left under bar | ADD | need | menu only "⛔ Abort" |
| CHUTE | button | Deploy chutes | Descent, chutes fitted | Replaces ABORT spot | KEEP | need | #mChute |
| Warp chip | button | ×1 / ×5 / ×50 cycle | Coasting above atmosphere | Top bar center | CHANGE | need | #wVal ×1 + #wUp ▶▶ always shown |
| Old stick + roll | control | Thumb stick | — | — | CUT | need | #mStick #mRoll (gone in f5.6c; delete DOM) |
| Ground camera | button | Tripod view | — | — | CUT | nice | #gcamBtn "🎥 GROUND" |
| Speed ref | button | Surface/orbit speed | — | — | CUT | nice | speed-ref button (auto-switch instead) |
| Mini throttle on navball | readout | Second throttle bar | — | — | CUT | need | #navThr #navThrT (dup of #mThr) |
| SAS ⊙ on navball | button | SAS mode | — | — | CUT | nice | #navSasT ⊙ (move to AUTO long-press) |
| Score | readout | Points | — | — | CUT | nice | #mScore |

### Flight states — 0 shown / budget —

What changes per state (no new controls, only swaps).

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Pad | state | STAGE pulses + ignite hint; ABORT hidden; Ap/Pe "—" | Pad | — | CHANGE | need | ignite text |
| Ascent / max-Q | state | Toast "Max-Q" once; throttle dims if AUTO | Ascent | — | KEEP | need | HIGH Q toast |
| Staging | state | STAGE flash; booster PiP appears | After stage | — | CHANGE | need | split view |
| Orbit | state | Warp chip appears; ABORT hides | Pe above atmosphere | — | CHANGE | need | — |
| Descent / landing | state | CHUTE replaces ABORT; Ap/Pe → vertical speed | Falling in atmosphere | — | CHANGE | need | — |

### Booster PiP (was split view) — 4 shown / budget 4

Max 25% of phone, corner.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| PiP window | view | Live booster camera | After staging, booster alive | Top right under bar, 40% width | CHANGE | need | #split half-screen panes |
| PiP label | readout | "Booster · landing 2.1 mi" | With PiP | Inside PiP | CHANGE | need | #spCardB / #spCardU full cards |
| Tap to swap | gesture | Swap main and PiP | With PiP | PiP | CHANGE | need | #spFull #spFullU ⤢ |
| Close ✕ | button | Hide PiP | With PiP | PiP corner | KEEP | need | #spClose |
| Switch control | button | Fly booster | — | — | CUT | nice | #spCtl "⇄ CONTROL" |
| Mini navballs | control | Steer in pane | — | — | CUT | nice | #spBallB #spBallU |

### Flight menu ☰ — 7 shown / budget 7

Side sheet, ≤50% screen.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Resume | button | Close sheet | Open | Top | ADD | need | #mClose ✕ |
| Pause | button | Pause sim | Open | Sheet | KEEP | need | "⏸ Pause" |
| Restart | button | Relaunch same rocket | Open | Sheet | CHANGE | need | #mHome "Return" (unclear) |
| Camera reset | button | Level chase camera | Open | Sheet | ADD | need | — |
| Full screen | button | Toggle fullscreen | Open | Sheet | KEEP | nice | #mFull |
| Settings | button | Settings sheet | Open | Sheet | ADD | need | — |
| Home | button | Back to Home | Open | Sheet bottom | KEEP | need | "🏠 Home" |
| Warp − / + | button | Warp | — | — | CUT | need | "◀◀ Warp −" "Warp + ▶▶" (HUD chip) |
| Warp to Ap | button | Skip to apoapsis | — | — | CUT | nice | "⏩ Warp to Ap" |
| Chute | button | Chutes | — | — | CUT | need | "🪂 Chute" (HUD contextual) |
| Abort | button | Abort | — | — | CUT | need | "⛔ Abort" (HUD) |
| Fly booster / Booster cam | button | Booster | — | — | CUT | nice | "🎮 Fly booster" "🎥 Booster cam" |

### Map — 3 shown / budget 3

Full screen map, HUD hidden.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Back ✕ | button | Return to flight | Always | Top right | KEEP | need | #mapBar ✕ / MAP |
| Warp chip | button | Warp | Coasting | Top center | KEEP | need | mapBar ⏩ |
| Body ◀ ▶ | buttons | Focus world | Always | Top left | CHANGE | nice | mapBar ◀Earth▶ |
| Nodes / ⋯ | buttons | Maneuver nodes | — | — | CUT | nice | mapBar "◆ Node" "⋯" |

### Pause — 4 shown / budget 4

Small card, not full screen.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Resume | button (primary) | Unpause | Paused | Card | KEEP | need | #pause Resume |
| Settings | button | Settings | Paused | Card | KEEP | need | #pause Settings |
| Home | button | Home | Paused | Card | ADD | need | not in #pause today |
| Δv map | button | Δv chart | — | — | CUT | nice | #pause "Δv map" |
| Quicksave / Quickload | button | Save state | — | — | CUT | nice | #pause "💾 Quicksave (F5)" "📂 Quickload (F9)" |
| Revert to launch | button | Restart flight | — | — | CHANGE | need | #pause "↺ Revert to launch" → "Restart" |
| Revert to hangar | button | To Build | — | — | CUT | nice | #pause "🏗 Revert to hangar" (Home covers it) |

### End card (crash only) — 4 shown / budget 4

Since f5.6a only destruction ends a flight.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Title | text | "Crashed" / "Lost" | On end | Top card | KEEP | need | #endTitle |
| Retry | button (primary) | Relaunch | On end | Card | KEEP | need | #relaunchBtn "↻ Retry" |
| Home | button | Home | On end | Card | CHANGE | need | #againBtn hidden behind #endMoreBtn ⋯ |
| More ⋯ | button | Extra actions | — | — | CUT | nice | #endMoreBtn |
| Replay | button | Instant replay | If recorded | Card | KEEP | nice | #replayBtn |
| Continue | button | Next goal | — | — | CUT | nice | #contBtn "Continue ▸" |
| Stars / rewards | text | $ / science / stars | — | — | CUT | need | removed in f5.6b, verify gone |

### Settings — 7 shown / budget 7

One sheet; app-styled controls only.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Close ✕ | button | Close | Always | Top right | CHANGE | need | green "Done" |
| Units | segmented | Imperial (default) / Metric | Always | Row 1 | CHANGE | need | native radios, metric default |
| Graphics | segmented | Low / Med / High (includes effects) | Always | Row 2 | CHANGE | need | #hGearM quick panel + #fxSel #gfxSel |
| Sound | toggle | On / off | Always | Row 3 | ADD | need | 🔊 in flight sheet |
| Steering sensitivity | slider | Navball drag strength | Always | Row 4 | CHANGE | need | "Touch stick" slider |
| Camera drag | slider | Camera speed | Always | Row 5 | KEEP | nice | "Camera drag" slider |
| Help | button | Controls + keys | Always | Bottom | ADD | nice | Build "How to fly" |
| Zoom sens | slider | Zoom speed | — | — | CUT | nice | "Zoom" slider |
| Flight camera | select | Free / Locked | — | — | CUT | need | locked mode flips horizon |
| Map patches | select | Conic mode | — | — | CUT | nice | select |
| CoM markers | checkbox | Markers in flight | — | — | CUT | nice | checkbox |
| Quick panel | sheet | Graphics shortcut | — | — | CUT | need | #hGearM (2nd settings surface) |

### Hidden modes (paused) — 0 shown / budget —

Remove entry points; keep code.

| Element | Type | Does | When | Where (phone) | Status | Need | Current (f5.6c) |
|---|---|---|---|---|---|---|---|
| Missions hub | screen | Missions | — | — | CUT | nice | #hnMis / missionsBtn |
| Career | screen | Career ladder | — | — | CUT | nice | #careerM |
| Academy / welcome | screen | Lessons | — | — | CUT | nice | #firstRun #learn |
| Atlas | screen | Planet atlas | — | — | CUT | nice | #hnAtlas |
| Photo mode | screen | Photo | — | — | CUT | nice | #pPhoto |
