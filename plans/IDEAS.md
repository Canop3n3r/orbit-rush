# Ideas

Unpicked expansions. Not committed work.

## Persisted warp alarms on the universe clock

KSP's alarm clock dies with the flight, and a reload does not promise you are still warping toward the burn. Store alarms on the universe clock (`{ ut, label, vesselId }`) inside the same save. If a load finds an alarm whose UT has already passed, drop warp to 1× and say so. The Tracking Station can warp to the next alarm without a flight open. Not built in M1 step 1.

## Quarantined until M2

`pegacorn: orbit on AUTO after 2 separations` — parked AUTO, un-quarantine in M2.

## Fuel lines on the part tree

KSP crossfeed and SimpleRockets 2 fuel priority let a core engine drain a side tank while the booster is still attached. Today's flight code fakes that by moving a slice of core propellant into the booster's physics stage (`specStages`). A `feed` link on the tank (`{ from, to }`) would let the stage adapter derive that parallel burn from the tree, and a later physics step could drain the tank the line names. The propellant would stay on the part that holds it. Not built in M1 step 2.
