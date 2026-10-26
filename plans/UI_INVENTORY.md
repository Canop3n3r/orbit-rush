# Orbit Rush UI inventory (f5.9)

Every screen, menu, panel, sheet, dialog, toast and button, and the f5.9 state of each one.
The system: **one font stack, one border (2 px), one radius, one panel colour, all as `:root` tokens in `ui59.css`.**
**Every button lives in a top bar (`#topBar`) or a bottom bar (`#botBar`); panels open as drawers attached to a bar; nothing floats over the middle of the view.**
Controls get their slot with `data-dock="top-left|top-center|top-right|bottom-attitude|bottom-left|bottom-center|bottom-right"` or a row in `fun/dock.js`.
`tests/smoke/ui_walk.cjs` walks the states below at 12 viewport sizes (overlap, off-screen, clipped text, one font, navball centred in the bottom bar, controls only in bars/drawers).
Status: `todo` / `done (phase)`. The count of `todo` rows must be 0 when f5.9c ships.

## Flight (HUD)
| Surface | Elements | After | Status |
|---|---|---|---|
| Top bar | `#wDn #wVal #wUp` (time warp), `#gcamBtn` (camera), `#dMap/#mMap` MAP, `#dMenuBtn/#mMenuBtn` ☰, `#pTake` TAKE OVER, `#hintS` one text line, `#ignite` prompt | `#topBar` | done (a) |
| Bottom bar | `#plain` telemetry (mph, alt, Ap/Pe + T, Δv per stage, landing aid), `#nav` navball (centre), `#navRd` attitude readout, `#navSasT` SAS toggle, `#mright/#dCtl` AUTO, CHUTE, STAGE, THR gauge, `#relBtn` RELEASE | `#botBar` | done (a) |
| SAS modes | `#navSas` (8 buttons) | drawer on top of the bottom bar | done (a) |
| ☰ flight menu | `#mMenu` (touch) / `#dMenu` (desktop): Pause, Warp to Ap, Chute, Return to pad, Abort, Ground cam, Full screen, Home | drawer under the top bar, between the bars | done (a) |
| Abort | `#mAbort/#dAbort` | top bar (right) | done (a) |
| Engineer view | `#engS` 8 readouts, `#strip #sL` chips, `#strip2` | todo | todo |
| Heat, callouts, craft tag, objective, score, learn, lesson, photo bar | `#heat #callout #craftTag #pObj #score #learn #learnTip #lesson #photobar #opTask #bars #tip #toasts` | todo | todo |
| Booster landing split view | `#split #spPane #spPane2 #spCardU #spCardB #spCardB2 #spBtnsU .spBtns (#spCtl #spFull #spClose)`, booster pip | todo | todo |
| Touch sticks (legacy) | `#mleft #mStick #mRoll #mhud #mtop #touch .tl .tr` | todo | todo |

## Map and maneuvers
| Surface | Elements | After | Status |
|---|---|---|---|
| Map toolbar | `#mapBar` ◀ focus ▶ ◆Node ⏩ ⋯ ✕ | todo | todo |
| Map ⋯ sheet | `#mapMore` Craft, Top, Edge, Reset, Planner, Alarms, Δv map, Body info, Conic | todo | todo |
| Maneuver node editor | `#mapPanel` (node mode): prograde/normal/radial ±, time ±, Execute, SAS maneuver, warp to burn, delete, next, close | todo | todo |
| Transfer planner / alarms / Δv map / body info panels | `#mapPanel` (plan, alarms, dv, body modes) | todo | todo |
| Map info, tracking, labels, handles | `#mapInfo #mapTrack #mapLabels .mlab .mhandle` | todo | todo |

## Menus and screens outside flight
| Surface | Elements | After | Status |
|---|---|---|---|
| Home + rocket picker (one screen) | `#home #hTop #hCard #hGal #pkQ #pkSandbox .pkTab .pkC #hFly #hSite #hMenuB #hMenu` | todo | todo |
| Launch site picker | `#sitePick` | todo | todo |
| Pause | `#pause` Resume, Quicksave, Quickload, Restart, Settings | todo | todo |
| Settings | `#settings` units, sensitivity, view, keys, effects, graphics, sound | todo | todo |
| Δv map dialog | `#dvModal` | todo | todo |
| End-of-flight card | `#end` title, body, stats, Retry, Instant replay, Home, Continue, Share, Post on X | todo | todo |
| Credits | `#credits` | todo | todo |
| Loading, badge, ignite prompt | `#loading #badge #ignite` | todo | todo |
| Tutorials | `#academy #lesson #concept` (hidden unless enabled) | todo | todo |
| Career / Missions / hub | `#careerM #misCard` (parked, hidden) | todo | todo |
| Tooltips | `#tip` | todo | todo |
| Craft / vessel list, music toggle, transfer planner (other workers) | `data-dock` | todo | todo |
