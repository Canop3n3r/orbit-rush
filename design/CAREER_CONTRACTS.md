# f5 career contracts (data: `design/career_contracts.js`)

The ladder runs first hop → Kármán line → first orbit → booster landing → satellite batch → crew to the station → Moon → Mars. After Mars comes the Venus rung that already exists in `fun/ladder.js`.

| # | contract id | fun/ladder rung | missions/ mission | vehicle → model | site | cost → cash / 🔬 / rep | unlocks |
|---|---|---|---|---|---|---|---|
| 1 | first-hop | hop | (new, free flight) | needle → sparrow-1 | atoll | 2 → 10 / 2 / 2 | karman-line |
| 2 | karman-line | karman | (new, free flight) | needle | atoll | 5 → 20 / 8 / 5 | site cape-north, first-orbit |
| 3 | first-orbit | orbit | first-orbit | needle | atoll | 10 → 40 / 12 / 10 | swift, booster-landing |
| 4 | booster-landing | booster | (new, free flight) | swift → heron-9 | cape-north | 15 → 60 / 10 / 10 | site lz1, constellation-batch |
| 5 | constellation-batch | constellation-batch | constellation-batch | swift | cape-north | 10 → 90 / 15 / 10 | heron, site cape-heritage, crew-dock |
| 6 | crew-dock | crew-dock | crew-dock | heron → heron-9-crew | cape-heritage | 50 → 140 / 25 / 12 | atlas, selene, lunar-landing |
| 7 | lunar-landing | moon | lunar-landing | selene | cape-heritage | 200 → 250 / 60 / 25 | titan, ares, site gulf-port, mars-ship |
| 8 | mars-ship | mars | mars-ship | ares | gulf-port | 250 → 400 / 100 / 30 | venus |

**Mapping:**
- Ids 3 and 5–8 are the same as in `missions/campaign/career.js`.
- `rung` is the `fun/ladder.js` id for the same contract. The cash and 🔬 values match it, so the rewards on screen don't change.
- The `fun/ladder.js` "heavy" rung has no contract here, and nothing in this ladder depends on it.

**Gaps:**
- first-hop, karman-line and booster-landing have no `missions/*.js` file. They are free-flight goals checked by `fun/ladder.js`.
- Site ids were renamed to neutral ids (`cape-north`, `cape-heritage`, `gulf-port`) in `fun/ladder.js`. Its save format went to v2, which migrates old saves.
- The constellation and station rungs are now `constellation-batch` and `crew-dock` (v2 migration).
- Roster vehicles used as inspiration exist only on the unmerged roster PRs #15–#25. `tests/career_contracts.mjs` checks them against the id list in this file, not against the repo.
- The selene and ares showroom vehicles have no model yet. They use a placeholder (`PLACEHOLDER_VEHICLES` in `fun/ladder.js`), and the lunar-landing and mars-ship contracts (plus Venus) stay locked until Rocket Art Bot delivers the models.
