# Career ladder: pure logic API (no UI)

Aaron's rocket-ladder career (2026-10-25): start with the oldest rockets, fly them freely, every flight costs a small
launch fee, a goal reached pays generously, and the money buys the next-oldest rocket, roughly one unlock per flight.
AUTO shrinks the skill bonus, **Revert** is free. This module is **pure logic**: plain data and functions, no CSS, no markup,
no `flight.js` edits. The old contract career (`fun/ladder.js`, `missions/campaign/*`) is untouched and stays hidden.
The f5.9 UI worker mounts these exports. Entry point: `career_ladder/index.js`. Tests: `tests/career_ladder.mjs`.

## Files
| file | job |
|---|---|
| `data/ladder_meta.js` | per roster id: first-flight `year`, `leo` payload kg, `cls` (size class), `price` ($K). Ladder `ORDER`. Launch-cost adapter |
| `career_ladder/ladder.js` | `LADDER` rows, goals per class, `goalMet`, `STARTERS` |
| `career_ladder/economy.js` | fee, failed-flight charge, payout (base + bonus), stipend, `fmtMoney` |
| `career_ladder/auto_tracker.js` | AUTO fraction of the airborne flight from per-tick snapshots; stage snapshots |
| `career_ladder/state.js` | save object: `blank`, `load`, `save`, `migrate`, `sanitize`, `buyNext`, `nextInLine` |
| `career_ladder/session.js` | `createCareer(save)`: start flight, tick, `onFlightEvent`, revert to launch / stage |
| `career_ladder/strip.js`, `goal_progress.js` | stat strip values + labels, goal marker progress |
| `career_ladder/sim.js` | headless career simulation (tests and the tuning table) |

## Ladder
- Roster = every id in `vehicles/catalog.js` (`VEHICLES` + all `ROSTER_*`), 68 rockets. `tests/career_ladder.mjs` fails if an id is missing from `META` or stale.
- Order: `year` ascending, ties by size class (light, small, medium, heavy, super), then LEO payload, then id. A new career owns `STARTERS` = the oldest two (`thorin-capable`, `atlantean`), and `nextInLine(save)` shows the third with its price.
- Years are plain numbers of the real-world vehicle each neutral rocket is inspired by (rocketdb families; a few catalog-only variants are estimates, noted in the file header). No real names appear anywhere in the repo (scan in the test).
- Catalog ids vs showroom ids: the ladder keys are **catalog ids** (`sparrow-1`, `heron-9`, ...). The showroom/picker ids (`needle`, `swift`, ...) map through `MODEL_OF` in `fun/showroom.js`; the f5.9 worker resolves a picker card to its catalog id before calling `startFlight`.

### One goal per size class (`GOALS`, altitudes in metres above the surface)
| class | rockets | goal id | label | rule |
|---|---|---|---|---|
| light (< 300 kg LEO) | 11 | `space` | Reach space | highest altitude >= 100 km |
| small (< 2.5 t) | 21 | `orbit` | Reach orbit | Pe >= 120 km (and Ap >= Pe) |
| medium (< 10 t) | 13 | `high` | Orbit 400 km | Pe >= 300 km and Ap >= 400 km |
| heavy (< 40 t) | 16 | `gto` | Reach GTO | Ap >= 35,786 km and Pe >= 180 km |
| super (>= 40 t) | 7 | `lunar` | Fly to the Moon | Ap >= 380,000 km (escape counts) and Pe >= 180 km |

`goalMet(goal, {maxAlt, ap, pe})` is pure; missing or NaN readings never meet a goal. The super-class goal needs a trans-lunar burn: if AUTO cannot fly it yet, loosen `GOALS.super` (one line) rather than touching the economy.

## Economy (all numbers live in `career_ladder/economy.js`; money is integer $K)
- **Launch fee** = 5 % of the rocket's price, charged at `startFlight`.
- **Failed flight** = 3x the fee in total (the fee already paid + 2x more, clamped so cash never goes below $0).
- **Success pay** = `reward(k) = m(k) x price of the next rocket on the ladder`, with `m` falling linearly 1.8 to 1.2 from the oldest to the newest rung. Tying pay to the next price keeps the ladder completable for any price table.
- **Base / bonus**: base = 65 % of the reward, bonus = 35 % x `(1 - autoFraction)`. All-manual gets the whole reward, all-AUTO gets the base only. An unreadable fraction counts as all-AUTO.
- **Goal pays once per flight**, then the flight continues (reaching orbit does not end it).
- **Abort / scrub**: `recover` with no goal costs only the 1x fee; a flight that never left the pad is scrubbed (fee refunded).
- **Stipend**: when cash is below the cheapest owned launch fee, it tops up to 3 launches of that rocket (granted at flight start or when a flight ends). It cannot be farmed: it only fires when you cannot launch your cheapest rocket and never exceeds 3 launches of it, which is exactly what failing that rocket costs.
- **Start cash** $200K. Unlocks are explicit (`buyNext`) and strictly in ladder order.

### First ten rungs
| # | rocket id | year | class | price to own | launch fee | failed flight | pay, all manual | pay, all AUTO |
|---|---|---|---|---|---|---|---|---|
| 1 | `thorin-capable` | 1958 | light | $1.5M | $75K | $225K | $3M | $2M |
| 2 | `atlantean` | 1958 | small | $1.7M | $84K | $252K | $3.3M | $2.2M |
| 3 | `thorin-agenta` | 1959 | small | $1.9M | $93K | $279K | $3.7M | $2.4M |
| 4 | `thorin-capablestar` | 1960 | light | $2M | $103K | $309K | $4M | $2.6M |
| 5 | `scoutling` | 1960 | light | $2.3M | $114K | $342K | $4.5M | $2.9M |
| 6 | `deltoid` | 1960 | medium | $2.5M | $127K | $381K | $4.9M | $3.2M |
| 7 | `blue-scoutling` | 1961 | light | $2.8M | $141K | $423K | $5.4M | $3.5M |
| 8 | `cosmokart-1` | 1961 | small | $3.1M | $156K | $468K | $6M | $3.9M |
| 9 | `atlantean-centaurus` | 1962 | medium | $3.5M | $173K | $519K | $6.6M | $4.3M |
| 10 | `cosmokart-2` | 1964 | small | $3.8M | $192K | $576K | $7.3M | $4.8M |

Flights per unlock (headless sim, always flying the newest rocket you can afford to launch, buying every rocket you can afford): 

| AUTO share | flights to finish all 66 unlocks | avg flights per unlock | max for one unlock |
|---|---|---|---|
| 0 % (all manual) | 53 | 0.80 (17 unlocks arrive with a flight that already paid for two) | 2 |
| 50 % | 60 | 0.91 | 2 |
| 100 % (all AUTO) | 76 | 1.15 (the first 20 unlocks are 1 flight each, 2-flight unlocks only late) | 2 |

### Repeat farming (decision)
No diminishing returns. A rocket pays the same every time, but it pays in proportion to its own rung, so the newest rocket is always the best earner (tested), unlocks cannot be skipped, and grinding only the oldest rocket still progresses but is more than 5x slower to reach rocket 40 (tested). A flight that restarts after the goal was paid (revert after pay) charges a fresh fee, so revert is not a farming loop either. Saves are client-side and not tamper-proof; `sanitize` keeps them sane.

## Events: `career.onFlightEvent(ev)`
```
{ type: 'goal' | 'end' | 'recover' | 'crash',
  rocketId: string,        // catalog id; must equal the active flight's rocket
  met: number,             // mission time, s (informational)
  maxAlt?, ap?, pe?: number, // 'goal' only: readings in metres; the session re-checks goalMet(), so a wrong event pays nothing
  autoFraction?: number,   // optional 0..1 override; omitted = the session's own tracker
  liftedOff?: boolean }   // end events: false = never left the pad (scrub). Omitted = what tick() saw
```
| type | after a paid goal | without a paid goal |
|---|---|---|
| `goal` | `{ok:false, reason:'already-paid'}` | pays `base + bonus` once: `{ok, paid, base, bonus, autoFraction, net, canAffordNext}` |
| `end` (Home, stranded, timeout) | success, nothing more | fail: 3x fee total |
| `crash` | success, nothing more | fail: 3x fee total |
| `recover` | success, nothing more | abort: 1x fee only |

Results of end events: `{ok, outcome: 'success'|'fail'|'abort'|'scrub', charged, refund?, stipend, canAffordNext}`. Failures to apply: `{ok:false, reason}` with reason `no-flight`, `wrong-rocket`, `bad-event`, `goal-not-met`, `already-paid`.
The host asked Game bot for a single `onFlightEvent({type:'goal'|'end'|'recover'|'crash', ...})` callback in the flight layer; wire it straight to `career.onFlightEvent`. Run `goalMet(LADDER[...].goal, snap)` each tick, fire `goal` the first time it is true.

## Session API (`createCareer(save)`)
| call | does |
|---|---|
| `startFlight(rocketId)` | `{ok, fee, stipend, goal}` or `{ok:false, reason:'locked'|'short'}`. Charges the fee, resets the tracker. Starting over an unfinished flight: from the pad it is a free replace, airborne it is a failed flight |
| `tick(snapshot)` | feed once per frame: `{met, autoOn, vAuto, liftedOff, ended?}` from `flight.met`, `flight.autoOn`, `flight.v.auto`, `flight.ended`; `liftedOff` = left the pad. Only airborne time counts, one tick counts at most 5 s |
| `markStage()` | call at each stage start (snapshot for revert to stage) |
| `onFlightEvent(ev)` | see above |
| `revertToLaunch()` | free: refunds the fee (no refund if this flight's goal already paid, the money stays), clears the flight, resets the AUTO tracker. The host then calls `startFlight` again (one fresh fee) |
| `revertToStage()` | free: no money moves, AUTO tracker returns to the stage start, the paid flag stays (no double pay) |
| `buyNext()`, `canAffordNext()` | unlock the next rocket in line |
| `save`, `tracker`, `active` | live state: `save` is the object to persist with `save(store, career.save)` |

## Stat strip: `flightStrip(f, goal?)`
Input `f` (metric numbers, any may be missing): `ap, pe` (m above surface; Ap may be `Infinity`; Pe < 0 below ground), `dv` (m/s total left), `thrust` (N), `mass` (kg), `g` (m/s²), `accel` (m/s², default thrust / mass), `maxAlt` (m), `onPad`.
Output `{ items: [{key, label, value, text}] x6 in order ap, pe, dv, twr, g, accel, goal: {label, progress 0..1} | null }`. Labels: `Ap Pe Δv TWR g Acc`. `value` is the raw number (null if unknown) for the UI's Units setting; `text` is the metric default (`412 km`, `3,420 m/s`, `1.36`, `—` on the pad or when unknown, `escape`, `under`). Never prints NaN.

## Save (`state.js`)
`{v:1, cash, owned, flights, wins:{id:n}, fails, stipends}` under `orbitrush.career.ladder`. `owned` is a count (you own `ORDER[0..owned-1]`). `load` migrates (v0 dev prototype: $M and an id list, to v1), whitelists, clamps, and falls back to a fresh career on corrupt, unknown or future data, or a throwing storage. A flight in progress is not saved (its fee is already paid, so a reload forfeits 1x, worse than the free revert).

## Launch-cost adapter
`data/launch_costs.js` (stats worker, branch `f59-stats`) was not on origin yet when this was written. Prices come from `launchPrice(id)` in `data/ladder_meta.js`: the ladder-rank price curve (`$1.5M x 1.11^rank`). When the file lands, call `setLaunchCostSource(LAUNCH_COSTS)` once at load (values in $K); `priceOf`, fees and pay all read through it, and payouts follow the next price, so the ladder stays completable. Keep prices non-decreasing along the ladder or the "newest earns most" property (tested on the default curve) can change.

## UI hooks (Game bot's placement, for the f5.9 worker)
- Career entry: a card on the unified Home / All Rockets screen, top bar. Shows `nextInLine(save)` (name via the brand lookup, price, shortBy).
- Revert: a bottom-bar button with a small drawer, "to launch" (`revertToLaunch`) and "to last stage" (`revertToStage`). Both always available during a career flight.
- Stat strip: one row above the bottom bar, clear of the navball; in split-screen it sits in each half's bottom strip. Fed by `flightStrip`.
- Money line / toasts from `fmtMoney`, event results (`paid`, `net`, `canAffordNext`, `stipend`).
