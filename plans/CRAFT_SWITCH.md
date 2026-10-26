# Craft switching and craft types (f6.2)

Goal: every craft left in space can be flown, switched on and off, and looks and flies like what it is.

## Data model
- `data/craft_types.js`: `CRAFT_TYPES` (cubesat, smallsat, leosat, navsat, comsat, geosat, probe, crew, cargo, station, lander, tug, kick, rideshare, roadster, stage),
  `PROPULSION` (none, cold gas, monoprop, hypergolic, hydrolox, landing, solid, ion), `craftTypeFor(info)` (the launcher class decides the craft), `buildCraftVehicle(type)` (a normal physics `Vehicle`).
- `fun/fleet.js`: `Fleet` of vessel records `{ id, name, type, origin, r, v, t, body, power, veh?, ctx? }`. The flown vessel is `Flight.v`; every other vessel coasts on an exact Kepler orbit (`stateAt`), so time warp needs no stepping.
- `fun/vessels.js`: `installVessels(Flight)` adds the fleet methods to `Flight` (flight.js only has the hook lines).

## Rules
- Switch only coasting above the rails altitude (140 km at Earth), not on the pad, no booster flying, no return burn under way. Time warp drops to x1, the clock keeps running.
- Parking packs the Vehicle and its context into the record; taking control rebuilds them. The rocket stage keeps its staging, nodes and return plan.
- Power: panels charge a battery in sunlight (cylinder shadow of the planet), idle and engine draw it, empty means brownout. Power OFF: no wheels, no engine, the craft tumbles slowly. Ion drives need power; solid kick motors light once and burn dry.
- The ascent autopilot is refused on craft. A craft that is destroyed is removed and control returns to the rocket stage: the flight does not end.
- Vessels that fall below 90 km are removed (they burned up).

## Keys and UI
`[` / `]` previous / next craft, `-` power on/off. The CRAFT button (flight bar and map bar) opens the vessel list with FLY, VIEW and a power switch per vessel. Deploy (STAGE) on a rideshare carrier lets its cubesats go.

## Hooks (Flight -> main.js)
`vesselSwitched`, `vesselParked`, `vesselLost`, `vesselGone`, `vesselDeployed`. main.js rebuilds `rocketG` / `SG` from `F.v` on `vesselSwitched`.

## Models
`gfx/vehicles/craft_models.js` registers the seven new shapes as payload kinds and builds per-stage groups for a craft (`buildCraftStages`), so the model under the fairing is the one you later fly.
