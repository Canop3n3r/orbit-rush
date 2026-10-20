// First orbit on the small launcher (vehicle sparrow-1): reach orbit, then circularise at 200 km.
// Real: payload to LEO 470 kg (spec:sparrow-1, LEO row); first orbit 2008-09-28 (missions_data first-flight table).
export default {
  id: 'first-orbit', name: 'First orbit',
  blurb: 'The small launcher: make orbit, then trim it round at 200 km.',
  vehicle: { template: 'Light & fast', role: 'small-launcher', vehicleId: 'sparrow-1', payloadPart: 'probe', gameMassT: 0.47 /* spec:sparrow-1 470 kg */ },
  real: { payloadLEOKg: 470 /* spec:sparrow-1 */ },
  deploy: [ { kind: 'booster-return', mode: 'droneship' }, { kind: 'transfer', apM: 205000, peM: 200000, label: 'Circularise at 200 km' } ],
  objectives: [
    { id: 'orbit', kind: 'orbit', label: 'Reach orbit', points: 0, required: true },
    { id: 'circ', kind: 'band', apM: 205000, peM: 200000, tolM: 8000, label: 'Round orbit at 200 km (± 8 km)', points: 1500, required: true },
    { id: 'booster', kind: 'booster-landed', label: 'Booster lands', points: 1000, required: false },
  ],
  scoring: { base: 'flight' },
};
