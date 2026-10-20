// Neutral brand pack (public build). A private pack has the same shape and replaces any key it defines.
// Keys: title, short, vehicles{id}, engines{id}, payloads{id}, missions{id}, labels{key}, logos{slot: url}, decals{slot: url}
export default {
  id: 'default',
  title: 'Orbit Rush', short: 'Orbit Rush', tagline: 'Build a rocket. Reach orbit. Land the booster.',
  vehicles: {}, // empty: vehicles/brand.js NEUTRAL_NAMES are the defaults
  engines: {},
  payloads: { 'sat-batch': 'Constellation satellites', 'capsule': 'Crew capsule', 'cargo': 'Cargo', 'probe': 'Probe' },
  missions: {}, // empty: each mission file's neutral `name`
  labels: {},
  logos: { title: null, hangar: null, endcard: null },
  decals: {}, // gfx/vehicles/decals.js slots, e.g. 'booster.side'
};
