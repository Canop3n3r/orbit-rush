# Ideas

Unpicked expansions. Not committed work.

## Persisted warp alarms on the universe clock

KSP's alarm clock dies with the flight, and a reload does not promise you are still warping toward the burn. Store alarms on the universe clock (`{ ut, label, vesselId }`) inside the same save. If a load finds an alarm whose UT has already passed, drop warp to 1× and say so. The Tracking Station can warp to the next alarm without a flight open. Not built in M1 step 1.
