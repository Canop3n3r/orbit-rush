// Orbital refuel: a tanker flight that arrives in orbit with as much propellant as possible left in the
// upper stage to transfer to a waiting depot/ship. Transfer is ABSTRACTED as "propellant left on orbit".
// TODO(main.js/flight): a depot target and a transfer action. Real: ship dry mass from specs/starship.md (Ship dry mass row, ~100 t,
// Musk 2021); delivered load is not in the sheet (ESTIMATE). Game-scale numbers below.
export default {
  id: 'refuel', name: 'Orbital refuel',
  blurb: 'Fly a tanker to orbit and deliver its spare propellant to the depot.',
  vehicle: { template: 'Recommended', role: 'tanker', payloadPart: 'sat', gameMassT: 1.5 }, // transfer hardware + depot adapter
  real: { tankerDryT: 100 /* specs/starship.md Ship dry mass (~100 t) */, deliverT: 100 /* ESTIMATE */ },
  deploy: [ { kind: 'fairing-sep' }, { kind: 'coast', s: 120 }, { kind: 'propellant-check' }, { kind: 'booster-return', mode: 'droneship' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'pe', kind: 'pe-min', m: 140000, label: 'Stable depot orbit (Pe > 140 km)', points: 500, required: true },
    { id: 'deliver', kind: 'propellant', minT: 2.0, label: 'Deliver at least 2 t of propellant', points: 2500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
