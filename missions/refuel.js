// Orbital refuel: a tanker flight that arrives in orbit with as much propellant as possible left in the
// upper stage to transfer to a waiting depot/ship. Transfer is ABSTRACTED as "propellant left on orbit".
// TODO(main.js/flight): a depot target and a transfer action. Real: ship dry mass of vehicle 'titan-ss-v3' (specs super-heavy sheet, Ship dry mass row, ~100 t,
// 2021 estimate); delivered load is not in the sheet (ESTIMATE). Game-scale numbers below.
export default {
  id: 'refuel', name: 'Orbital refuel',
  blurb: 'Fly a tanker to orbit and deliver its spare propellant to the depot.',
  vehicle: { template: 'Recommended', role: 'tanker', vehicleId: 'titan-ss-v3', payloadPart: 'sat', gameMassT: 1.5 }, // transfer hardware + depot adapter
  real: { tankerDryT: 100 /* titan-ss-v3 sheet, Ship dry mass (~100 t) */, deliverT: 100 /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'booster-return', mode: 'droneship' },
    { kind: 'transfer', apM: 200000, peM: 195000, label: 'Rendezvous with the depot at 195–200 km' }, { kind: 'coast', s: 120 }, { kind: 'propellant-check' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'depot', kind: 'band', apM: 200000, peM: 195000, tolM: 8000, label: 'Reach the depot orbit 195–200 km (± 8 km)', points: 750, required: true },
    { id: 'deliver', kind: 'propellant', minT: 2.0, label: 'Arrive with at least 2 t spare propellant to transfer (save fuel!)', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
