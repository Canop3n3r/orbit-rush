// Station rendezvous: real phasing and approach to a passive station on its own orbit. The station is a
// pure Kepler target (missions/layers/target.js) 8° ahead at 250 km; the player flies the phasing burn found
// by a Lambert search, the velocity match, then closing approaches through range / relative-velocity gates
// until the dock gate holds for 30 s. Real figures: capsule-2 (spec:capsule-2), vehicle heron-9-crew.
// Station altitude ~400 km real is ESTIMATE; the 250 km game band keeps the burns inside the game stage.
export default {
  id: 'station-rendezvous', name: 'Station rendezvous',
  blurb: 'Catch the station: phase, match, approach through the gates and dock.',
  vehicle: { template: 'Recommended', role: 'crew-capsule-launcher', vehicleId: 'heron-9-crew', capsuleId: 'capsule-2', payloadPart: 'sat', gameMassT: 2.0 },
  real: { capsuleLaunchKg: 12519 /* spec:capsule-2 launch */, stationAltKm: 400 /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'rendezvous', target: 'station', altM: 250000, leadDeg: 8, phasingOrbits: 4 },
    { kind: 'dock', rangeM: 60, relV: 0.5, holdS: 30 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'g10k', kind: 'gate', rangeM: 10000, relV: 25, label: 'Gate 1: inside 10 km at < 25 m/s', points: 500, required: true },
    { id: 'g1k', kind: 'gate', rangeM: 1000, relV: 5, label: 'Gate 2: inside 1 km at < 5 m/s', points: 750, required: true },
    { id: 'g100', kind: 'gate', rangeM: 100, relV: 1, label: 'Gate 3: inside 100 m at < 1 m/s', points: 1000, required: true },
    { id: 'dock', kind: 'docked', label: 'Dock: hold < 60 m and < 0.5 m/s for 30 s', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
