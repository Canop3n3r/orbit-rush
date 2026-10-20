// Ship-to-ship propellant transfer: rendezvous with a waiting tanker (vehicle titan-ss-tanker), dock for real
// (range and relative-velocity gates, latched hold), then pump propellant into the ship's upper stage while
// the latch holds. Real: ~150 t per tanker flight (2021 statement) / ~100 t V2-era (spec:titan-ss-tanker rows);
// tankers per lunar mission 4–16 (spec:titan-ss-tanker); first ship-to-ship demo slated 2026. Game scale: 2 t.
export default {
  id: 'ship-transfer', name: 'Ship-to-ship refuel',
  blurb: 'Meet the tanker, dock, and pump propellant across.',
  vehicle: { template: 'Recommended', role: 'depot-ship', vehicleId: 'titan-ss-v3', specId: 'titan-ss-depot', payloadPart: 'sat', gameMassT: 1.5 },
  real: { tankerLoadT: 150 /* spec:titan-ss-tanker (2021) */, tankerLoadV2T: 100 /* spec:titan-ss-tanker V2-era */ },
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
