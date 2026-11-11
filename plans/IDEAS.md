# Ideas

Unpicked expansions. Not committed work.

## Persisted warp alarms on the universe clock

KSP's alarm clock dies with the flight, and a reload does not promise you are still warping toward the burn. Store alarms on the universe clock (`{ ut, label, vesselId }`) inside the same save. If a load finds an alarm whose UT has already passed, drop warp to 1× and say so. The Tracking Station can warp to the next alarm without a flight open. Not built in M1 step 1.

## Quarantined until M2

`pegacorn: orbit on AUTO after 2 separations` — parked AUTO, un-quarantine in M2.

## Fuel lines on the part tree

KSP crossfeed and SimpleRockets 2 fuel priority let a core engine drain a side tank while the booster is still attached. Today's flight code fakes that by moving a slice of core propellant into the booster's physics stage (`specStages`). A `feed` link on the tank (`{ from, to }`) would let the stage adapter derive that parallel burn from the tree, and a later physics step could drain the tank the line names. The propellant would stay on the part that holds it. Not built in M1 step 2.

## Data bugs (Vehicle Specs)

11 roster rockets lack `group` and `burn` on their stages: the Heron-9 family (`heron-9`, `heron-9-v11`, `heron-9-crew`), Sparrow-1, Colossus v3 and v4, the four Colossus mission variants (`colossus-tanker`, `colossus-depot`, `colossus-lunar`, `colossus-mars`), and Heron Heavy. `specStages` treats every stage as group 0, so the later tanks fold into a radial liftoff phase. The core fuel split is `prop * burn / burn` with both burns missing, which is NaN. Not fixed in M1 step 3.

## Battery and eclipse on rails

KSP keeps charging an unloaded probe from its own solar panels, and a long warp can brown it out in eclipse. The charge belongs to the ship, not to the flight you happen to have open. `fun/fleet.js` already samples sunlight along a Kepler arc, but only when a flight is about to take that ship over. Doing it inside `advanceUnloaded` would leave a Moon relay's battery where the eclipses say it should be after a 1e7× warp, and a reload would not reset it to full just because nobody was looking. Not built in M1 step 3.

## Warp to the next maneuver from the station

KSP only warps to a node once that flight is open. The Tracking Station already lists every vessel and the nodes on it. A control there could jump the universe clock to the soonest burn and drop to 1×, without flying the ship first. Not built in M1 step 4.
