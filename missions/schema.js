// Mission schema (pure data, no DOM). A mission is plain JSON-able data:
// {
//   id: 'constellation-batch',            neutral id (never a brand name)
//   name: 'Constellation batch',           neutral display name; brand packs may override via brand.js
//   vehicle: { template, role, payloadPart, gameMassT, reserve? }
//     template: name of a parts.js TEMPLATE to fly; role: neutral vehicle role key ('medium-reusable-launcher')
//     gameMassT: payload mass the flown (game-scaled) design carries; real figures live in `real`
//   real: { ...realistic figures, from specs/ with the row cited; unsourced values flagged ESTIMATE }
//   deploy: [ { kind, ...} ]  ordered sequence run after orbit insertion:
//     'fairing-sep'            requires the fairing to have dropped (flight.js drops it itself above 100 km)
//     'stack-release' { delayS } release the payload stack from the upper stage
//     'dispense' { count, intervalS, label? }  staggered dispense, one unit every intervalS
//     'booster-return' { mode: 'droneship'|'catch', catchRadiusM?, maxSpeed? }  checked after the booster settles
//     'coast' { s }            coast on orbit (e.g. hold/station-keeping)
//     'propellant-check' { minT } upper-stage propellant left to deliver (tanker)
//   objectives: [ { id, kind, label, points, required, ...params } ]
//     kinds: 'orbit', 'pe-min' {m}, 'ap-max' {m}, 'band' {altM, tolM}, 'fairing-sep', 'stack-release',
//            'dispensed' {count}, 'booster-landed', 'booster-catch', 'propellant' {minT}, 'hold' {s}
//   scoring: { base: 'flight'|0, timeBonus?: { parS, perS } }
// }
export const DEPLOY_KINDS = ['fairing-sep', 'stack-release', 'dispense', 'booster-return', 'coast', 'propellant-check'];
export const OBJECTIVE_KINDS = ['orbit', 'pe-min', 'ap-max', 'band', 'fairing-sep', 'stack-release', 'dispensed', 'booster-landed', 'booster-catch', 'propellant', 'hold'];
export function validateMission(m) {
  const err = [];
  if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id)) err.push('id must be a neutral kebab-case string');
  if (!m.name) err.push('name required');
  if (!m.vehicle || !m.vehicle.template) err.push('vehicle.template required');
  if (!Array.isArray(m.deploy)) err.push('deploy must be an array');
  else for (const d of m.deploy) if (!DEPLOY_KINDS.includes(d.kind)) err.push('unknown deploy kind ' + d.kind);
  if (!Array.isArray(m.objectives) || !m.objectives.length) err.push('objectives required');
  else for (const o of m.objectives) { if (!OBJECTIVE_KINDS.includes(o.kind)) err.push('unknown objective kind ' + o.kind); if (!o.id) err.push('objective id required'); }
  return { ok: !err.length, err };
}
