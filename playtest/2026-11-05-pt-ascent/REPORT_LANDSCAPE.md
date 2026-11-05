# PT · Ascent HUD — landscape / 1280 · f5.9-38 · 2026-11-05

Before: live https://canop3n3r.github.io/orbit-rush/?v=f5.9-37&webgl&noacademy&fx=low
After: local f5.9-38, Heron-9 AUTO, same query flags. Phone portrait 390×844 was not reworked.

The portrait post-sep fold (#83) now also applies while `splitOn` and not `inOrbit` on landscape touch and on desktop. CRAFT, time warp and the camera leave the flight bar until orbit and stay in ☰. RELEASE stays a top-level control (portrait still paints it on the STAGE slot). Orbit may show RELEASE and STAGE together. The booster PIP and recovery strip are unchanged.

## 844×390 (touch landscape)
| Beat | hud_ctl (≤5) | labs |
|---|---|---|
| pad | **5** OK | AUTO, MAP, STAGE, ☰, 🎥VEHICLE |
| AUTO ascent | **5** OK | same |
| post-sep / split | **5** OK | AUTO, MAP, STAGE, ☰, 🛰RELEASE |

Was 7 (those five plus CRAFT2 and 🎥VEHICLE). ☰ then offers ▶▶ Warp, the craft list, and 🎥 VEHICLE. Tapping warp stepped time to ×2.

Shots: `844_390_pad.png`, `844_390_ascent.png`, `844_390_staging.png`

## 1280×800 (desktop)
| Beat | hud_ctl (≤5) | labs |
|---|---|---|
| pad | **4** OK | AUTO, MAP, STAGE, ☰ |
| AUTO ascent | **4** OK | same |
| post-sep / split | **5** OK | AUTO, MAP, STAGE, ☰, 🛰RELEASE |

Was 7 (AUTO, CRAFT2, MAP, STAGE, warp, ☰, 🛰RELEASE). ☰ offers ▶▶ Warp and the craft list. At orbit the bar warp and CRAFT come back, and RELEASE and STAGE are both still there.

Shots: `1280_800_pad.png`, `1280_800_ascent.png`, `1280_800_staging.png`

## Checks
- `node tests/smoke/ascent_landscape_split_smoke.cjs http://127.0.0.1:8960/ 844x390` exit 0
- `node tests/smoke/ascent_landscape_split_smoke.cjs http://127.0.0.1:8960/ 1280x800` exit 0
- Portrait `ascent_split_hud.cjs` at 390×844 still reports post-sep hud_ctl 5 with RELEASE on the bar. Its orbit line that wants the bar warp back fails the same way on unmodified f5.9-37 CSS: touch AUTO keeps ▶▶ in ☰ (#82). That path was left alone.

## Verdict
Pad and AUTO ascent stay inside the budget. Post-sep on 844×390 and 1280×800 is now 5.
