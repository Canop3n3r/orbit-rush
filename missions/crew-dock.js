// Crew to station: launch the crew capsule to the station's orbit band and hold there long enough to dock.
// Docking is ABSTRACTED for now: "dock" = staying inside the station's orbit band for the dock-hold time.
// TODO(main.js/flight): a real station target (second orbiting body) with phasing, rendezvous and a
// relative-velocity docking check. Real capsule figures from specs/dragon.md (Dragon 2 column);
// station altitude is not in the sheet (ESTIMATE ~400 km); game AUTO parks ~150-185 km, so the band is game-scaled.
export default {
  id: 'crew-dock', name: 'Crew to station',
  blurb: 'Take a crew capsule up to the station orbit and hold position to dock.',
  vehicle: { template: 'Orbit & home', role: 'crew-capsule-launcher' },
  real: { capsuleLaunchMassKg: 12519 /* specs/dragon.md Launch mass (Crew) */, capsuleDryKg: 7700 /* specs/dragon.md Dry mass */,
    crew: 4 /* specs/dragon.md Crew */, rcsPropKg: 2562 /* specs/dragon.md Thrusters */, recovery: 'parachute splashdown' /* specs/dragon.md Recovery */, stationAltKm: 400 /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'coast', s: 900 }, { kind: 'booster-return', mode: 'droneship' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'band', kind: 'band', altM: 168000, tolM: 25000, label: 'Match the station orbit band (168 ± 25 km)', points: 1500, required: true },
    { id: 'dock', kind: 'hold', s: 600, label: 'Hold in band 10 min to dock', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
