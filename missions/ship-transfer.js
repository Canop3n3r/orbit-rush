// Ship-to-ship propellant transfer: rendezvous with a waiting tanker (vehicle colossus-tanker), dock for real
// (range and relative-velocity gates, latched hold), then pump propellant into the ship's upper stage while
// the latch holds. Real: 100 t tanker cargo (V2-era row; the 150 t 2021 figure only reaches ~95% of LEO Δv) (spec:colossus-tanker rows);
// tankers per lunar mission 4–16 (spec:colossus-tanker); first ship-to-ship demo slated 2026. Game scale: 2 t.
export default {
  id: 'ship-transfer', name: 'Ship-to-ship refuel',
  blurb: 'Meet the tanker, dock, and pump propellant across.',
  vehicle: { template: 'Recommended', role: 'depot-ship', vehicleId: 'colossus-v3', specId: 'colossus-depot', payloadPart: 'sat', gameMassT: 1.5 },
  real: { tankerLoadT: 100 /* spec:colossus-tanker V2-era row; the 150 t (2021) load only reaches ~95% of LEO Δv in Vehicle Specs Bot's model, so 100 t is the cargo used */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'rendezvous', target: 'tanker', altM: 240000, leadDeg: 7, phasingOrbits: 4, targetFuelT: 3 },
    { kind: 'dock', rangeM: 60, relV: 0.5, holdS: 30 },
    { kind: 'prop-transfer', t: 2, rateTps: 0.1 } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'g1k', kind: 'gate', rangeM: 1000, relV: 5, label: 'Approach: inside 1 km at < 5 m/s', points: 500, required: true },
    { id: 'dock', kind: 'docked', label: 'Dock with the tanker', points: 2000, required: true },
    { id: 'xfer', kind: 'transferred', t: 2, label: 'Transfer 2 t of propellant while docked', points: 2500, required: true },
  ],
  scoring: { base: 'flight' },
};
