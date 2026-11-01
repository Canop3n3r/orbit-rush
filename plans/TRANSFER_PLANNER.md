# Pre-launch transfer planner (f6.5)

Goal: while still on the pad, pick a world (the Moon, Venus, Mars, Jupiter or another planet), and get the best launch day, time of day and site, plus a
parking-orbit / departure / midcourse / arrival burn sequence, a plain-words Δv bill, and a verdict for the chosen rocket. AUTO can then start
the flight on that day and fly the burns.

## Approach (physics/transfer_plan.js, pure maths, tests in tests/transfer_plan.mjs)
1. **Porkchop sweep.** For departure days `td` over one synodic period (Moon: 30 days) and flight times `tf`, solve Lambert's problem
   (planets: heliocentric, Earth at `td` to the target at `td+tf`; Moon: geocentric from the burn point to the Moon's position). Cost of a point =
   departure burn from the 200 km circular parking orbit `sqrt(v∞² + 2μ/r) − sqrt(μ/r)` + arrival capture burn into a low circular orbit.
   Windows = local minima of the cheapest cost per day, at least half a synodic period apart (Earth–Mars: about 26 months apart).
2. **Launch geometry.** For the chosen window and a fine grid of days around it, and for every launch site: the parking-orbit plane must contain
   the departure asymptote (Moon: the direction of the Moon at arrival) and the site at launch time. Scan launch times (30 s steps, up to about two
   orbits of coast); require that the craft, after the ascent (540 s, 17° downrange), reaches the burn point exactly at `td`. Roots of that phase
   error are the real launch times. Each gives an inclination and azimuth; ascent cost = 9.4 km/s baseline adjusted by how well the launch
   direction uses the Earth's spin (vector difference of the orbital and site velocities). Only north-of-east ascents (what the AUTO ascent flies).
3. **Pick** the day, site and time with the lowest ascent + departure + midcourse + arrival Δv (plus a 2 m/s per day nudge toward earlier).
4. **Real Earth rotation.** `Flight({ realPhase: true, t0 })` orients the Earth with the real rotation angle (so local time of day and the Sun are the real
   ones for that date); normal flights keep the fixed mid-morning start.
5. **Flying it.** `Director` with `departT` calls `planFull` with the departure forced to the planned day; planFull then tunes the real node from the
   actual parking orbit (finite burn), the director burns, corrects and captures. The plan numbers are the nominal bill; the flight re-tunes.
6. **Verdict.** Rocket Δv (`designStats(design).total`) vs the bill: ≥ 115 % "room to spare", ≥ 100 % "just do it", else "short on fuel".

## UI (fun/xferui.js, self-contained overlay `#xferPlan`, CSS block at the end of style.css)
Home ⚙ menu → "🚀 Plan transfer" → pick a world → steps list + fuel bill + verdict → **Launch on AUTO** (arms the plan; FLY then starts on the launch day and
AUTO flies it) or **Set up the launch** (same, you fly). Clear plan in the same panel. Picking another launch site also clears the plan.

## Limits
Patched conics, circular parking orbit, impulsive burns for planning (the flight uses finite burns). Planets and the Moon only (no moons of other planets).
Game geometry: sites sit where the game's Earth frame puts them (the Heritage pad on the game equator). Capture is propulsive into a low circular orbit
(no aerobraking). Midcourse is a nominal budget.
