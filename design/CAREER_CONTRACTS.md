# f5 career contracts (data: `design/career_contracts.js`)

The ladder runs first hop → Kármán line → first orbit → booster landing → satellite batch → crew to the station → Moon → Mars. After Mars comes the Venus rung that already exists in `fun/ladder.js`.

| # | contract id | fun/ladder rung | missions/ mission | vehicle → model | site | cost → cash / 🔬 / rep | unlocks |
|---|---|---|---|---|---|---|---|
| 1 | first-hop | hop | (new, free flight) | needle → sparrow-1 | atoll | 2 → 10 / 2 / 2 | karman-line |
| 2 | karman-line | karman | (new, free flight) | needle | atoll | 5 → 20 / 8 / 5 | site slc40, first-orbit |
| 3 | first-orbit | orbit | first-orbit | needle | atoll | 10 → 40 / 12 / 10 | kestrel, booster-landing |
| 4 | booster-landing | booster | (new, free flight) | kestrel → heron-9 | slc40 | 15 → 60 / 10 / 10 | site lz1, constellation-batch |
| 5 | constellation-batch | constellation-batch (brandKey) | constellation-batch | kestrel | slc40 | 10 → 90 / 15 / 10 | heron, site lc39a, crew-dock |
| 6 | crew-dock | crew-dock (brandKey) | crew-dock | heron → heron-9-crew | lc39a | 50 → 140 / 25 / 12 | atlas, selene, lunar-landing |
| 7 | lunar-landing | moon | lunar-landing | selene | lc39a | 200 → 250 / 60 / 25 | titan, ares, site starbase, mars-ship |
| 8 | mars-ship | mars | mars-ship | ares | starbase | 250 → 400 / 100 / 30 | venus |

**Mapping:**
- Ids 3 and 5–8 are the same as in `missions/campaign/career.js`.
- `rung` is the `fun/ladder.js` id for the same contract. The cash and 🔬 values match it, so the rewards on screen don't change.
- The `fun/ladder.js` "heavy" rung has no contract here, and nothing in this ladder depends on it.

**Gaps:**
- first-hop, karman-line and booster-landing have no `missions/*.js` file. They are free-flight goals checked by `fun/ladder.js`.
- The site ids `slc40`, `lc39a` and `starbase` are real pad designations. `SITES` gives each one a neutral name and a proposed id (`cape-north`, `cape-heritage`, `gulf-port`). Renaming them is in Game bot's lane, in `fun/ladder.js`.
- Two `fun/ladder.js` rung ids are real names (the constellation and station rungs). This file refers to them by their `brandKey` (`constellation-batch`, `crew-dock`). Game bot should rename the rung ids, which also changes the save key's `done` entries.
- Roster vehicles used as inspiration exist only on the unmerged roster PRs #15–#25. `tests/career_contracts.mjs` checks them against the id list in this file, not against the repo.
- The selene and ares showroom vehicles have no `vehicles/catalog.js` model yet.
