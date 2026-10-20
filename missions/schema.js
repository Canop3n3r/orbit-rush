// Mission schema (pure data, no DOM). A mission is plain JSON-able data:
// {
//   id: 'constellation-batch',            neutral id (never a brand name)
//   name: 'Constellation batch',           neutral display name; a brand pack may override via vehicles/brand.js setBrandPack
//   vehicle: { template, role, payloadPart, gameMassT, reserve? }
//     vehicleId: real-world-inspired vehicle id from vehicles/catalog.js; template: name of a parts.js TEMPLATE to fly; role: neutral vehicle role key ('medium-reusable-launcher')
//     gameMassT: payload mass the flown (game-scaled) design carries; real figures live in `real`
//   real: { ...realistic figures, from specs/ with the row cited; unsourced values flagged ESTIMATE }
//   deploy: [ { kind, ...} ]  ordered sequence run after orbit insertion:
//     'fairing-sep'            requires the fairing to have dropped (flight.js drops it itself above 100 km)
//     'stack-release' { delayS } release the payload stack from the upper stage
//     'dispense' { count, intervalS, label? }  staggered dispense, one unit every intervalS
//     'booster-return' { mode: 'droneship'|'catch', catchRadiusM?, maxSpeed? }  checked after the booster settles
//     'transfer' { apM, peM, label } player task: two planned burns to the mission's target orbit
//     'coast' { s }            coast on orbit (e.g. hold/station-keeping)
//     'propellant-check' { minT } upper-stage propellant left to deliver (tanker)
//   objectives: [ { id, kind, label, points, required, ...params } ]
//     kinds: 'orbit', 'pe-min' {m}, 'ap-max' {m}, 'band' {apM, peM, tolM}, 'fairing-sep', 'stack-release',
//            'dispensed' {count}, 'booster-landed', 'booster-catch', 'propellant' {minT}, 'hold' {s}
//   Campaign-era kinds: 'plane-change' {inclDeg}, 'raise-ap' {apM}, 'rendezvous' {altM, leadDeg}, 'dock' {rangeM, relV, holdS},
//   'prop-transfer' {t, rateTps}, 'director' {dest}, 'interplanetary' {target}; objectives 'incl' {deg, tol}, 'ap-min' {m},
//   'gate' {rangeM, relV}, 'docked', 'transferred' {t}, 'landed-on' {body}, 'orbiting' {body}, 'helio' {aphMinAU},
//   'recovered' {which: 'side'|'core', mode: 'rtls'|'droneship'|'catch'}.
//   scoring: { base: 'flight'|0, timeBonus?: { parS, perS } }
// }
export const DEPLOY_KINDS = ['transfer', 'fairing-sep', 'stack-release', 'dispense', 'booster-return', 'coast', 'propellant-check',
  'plane-change', 'raise-ap', 'rendezvous', 'dock', 'prop-transfer', 'director', 'interplanetary'];
export const OBJECTIVE_KINDS = ['orbit', 'pe-min', 'ap-max', 'band', 'fairing-sep', 'stack-release', 'dispensed', 'booster-landed', 'booster-catch', 'propellant', 'hold',
  'incl', 'ap-min', 'gate', 'docked', 'transferred', 'landed-on', 'orbiting', 'helio', 'recovered'];
import { TEMPLATES } from '../parts.js?v=f2';
export const MAX_GAME_MASS_T = 20; // game scale: no template can lift more than this
export function validateMission(m) {
  const err = [];
  if (!m || typeof m.id !== 'string' || !/^[a-z0-9-]+$/.test(m.id)) err.push('id must be a neutral kebab-case string');
  if (!m.name) err.push('name required');
  if (!m.vehicle || !(m.vehicle.template || Array.isArray(m.vehicle.parts))) err.push('vehicle.template or vehicle.parts required');
  if (!Array.isArray(m.deploy)) err.push('deploy must be an array');
  else for (const d of m.deploy) if (!DEPLOY_KINDS.includes(d.kind)) err.push('unknown deploy kind ' + d.kind);
  const g = m.vehicle && m.vehicle.gameMassT;
  if (g !== undefined && !(typeof g === 'number' && Number.isFinite(g) && g > 0 && g <= MAX_GAME_MASS_T)) err.push(`vehicle.gameMassT must be a number in (0, ${MAX_GAME_MASS_T}] t`);
  if (g !== undefined && m.vehicle) { const part = m.vehicle.payloadPart || 'sat', t = m.vehicle.parts ? { parts: m.vehicle.parts } : TEMPLATES.find(x => x.name === m.vehicle.template);
    if (t && !t.parts.some(p => p.id === part)) err.push(`vehicle.gameMassT set but the vehicle has no '${part}' payload part`); }
  for (const d of m.deploy || []) if (d.kind === 'transfer' && !(d.apM >= d.peM && d.peM > 130000 && d.apM < 2e6)) err.push('transfer needs 130 km < peM <= apM < 2000 km');
  if (!Array.isArray(m.objectives) || !m.objectives.length) err.push('objectives required');
  else for (const o of m.objectives) { if (!OBJECTIVE_KINDS.includes(o.kind)) err.push('unknown objective kind ' + o.kind); if (!o.id) err.push('objective id required'); }
  return { ok: !err.length, err };
}
