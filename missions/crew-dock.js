// Crew to station: launch the crew capsule to the station's orbit band and hold there long enough to dock.
// Docking is ABSTRACTED for now: "dock" = staying inside the station's orbit band for the dock-hold time.
// TODO(main.js/flight): a real station target (second orbiting body) with phasing, rendezvous and a
// relative-velocity docking check. Real capsule figures from vehicle 'capsule-2' (vehicles/catalog.js, heron-9-crew.capsule; specs capsule sheet, gen-2 column);
// station altitude is not in the sheet (ESTIMATE ~400 km); game AUTO parks ~150-185 km, so the band (250 km) is game-scaled and
// sits above the default AUTO orbit: the player must fly the transfer, and overshooting the band fails.
export default {
  id: 'crew-dock', name: 'Crew to station',
  blurb: 'Take a crew capsule up to the station orbit and hold position to dock.',
  vehicle: { template: 'Orbit & home', role: 'crew-capsule-launcher', payloadPart: 'crew', gameMassT: 4.0 /* game-scale capsule (catalogue pod 4 t; real capsule-2 12.5 t) */, vehicleId: 'heron-9-crew', capsuleId: 'capsule-2' },
  real: { capsuleLaunchMassKg: 12519 /* capsule-2 launch */, capsuleDryKg: 7700 /* capsule-2 dry */,
    crew: 4 /* capsule-2 crew */, rcsPropKg: 2562 /* capsule sheet, Thrusters row */, recovery: 'parachute splashdown' /* capsule-2 recovery */, stationAltKm: 400 /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'transfer', apM: 250000, peM: 250000, label: 'Climb to the station orbit (250 km)' }, { kind: 'coast', s: 660 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'band', kind: 'band', apM: 250000, peM: 250000, tolM: 15000, label: 'Match the station orbit (250 ± 15 km; overshoot fails)', points: 1500, required: true },
    { id: 'dock', kind: 'hold', s: 600, label: 'Hold in band 10 min to dock', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
