// Display-name lookup keyed by neutral vehicle/engine id. The public repo stays neutral (TEAM.md rule 4):
// branded names live only in the private brand pack repo, which can call setBrandPack(map) at load.
// No brand pack exists in this repo, so this is a minimal stand-in with neutral defaults.
export const NEUTRAL_NAMES = {
  'sparrow-1': 'Sparrow-1 Smallsat Launcher', 'heron-9': 'Heron-9', 'heron-9-v10': 'Heron-9 (Mk I)', 'heron-9-v11': 'Heron-9 (Mk II)',
  'heron-9-crew': 'Heron-9 Crew', 'heron-heavy': 'Heron Heavy', 'titan-ss-v3': 'Colossus (Mk III)', 'titan-ss-v4': 'Colossus (Mk IV)',
  'kero-a': 'KR-A', 'kero-c': 'KR-C', 'kero-d': 'KR-D', 'kero-cv': 'KR-C Vac', 'kero-dv': 'KR-D Vac', 'kero-p': 'KR-P (pressure-fed)',
  'meth-3': 'MX-3', 'meth-3v': 'MX-3 Vac', 'capsule-2': 'Skylark Crew Capsule',
  'titan-ss-tanker': 'Colossus Tanker', 'titan-ss-depot': 'Colossus Depot', 'titan-ss-lunar': 'Colossus Lunar Lander', 'titan-ss-mars': 'Colossus Mars Ship',
  'roadster-payload': 'Demo Car Payload',
};
// One-word showroom names (UI step #6). Neutral, distinct, invented flavour names (not sourced figures).
// A brand pack overrides them with keys 'short:<id>'.
export const SHORT_NAMES = {
  'sparrow-1': 'Sparrow', 'heron-9': 'Heron', 'heron-9-v11': 'Egret', 'heron-9-crew': 'Crane', 'heron-heavy': 'Condor',
  'titan-ss-v3': 'Titan', 'titan-ss-v4': 'Colossus',
  'titan-ss-tanker': 'Tanker', 'titan-ss-depot': 'Depot', 'titan-ss-lunar': 'Selene', 'titan-ss-mars': 'Ares',
};
let pack = {};
export function setBrandPack(map) { pack = { ...(map || {}) }; }
export const displayName = id => pack[id] || NEUTRAL_NAMES[id] || id;
export const shortName = id => pack['short:' + id] || SHORT_NAMES[id] || displayName(id);
