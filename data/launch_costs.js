// Ballpark launch prices, USD millions per launch (a rough public figure for a flight with this rocket, in today's money).
// These are rounded, honest guesses for the end-of-flight "what would this have cost" line, NOT quotes or accounting.
// Keyed by roster id and by art-model id; resolution: exact id, then the id with trailing segments / letters trimmed,
// then a class fallback from liftoff mass (or the crewed / hopper flags). Neutral names only.
export const LAUNCH_COSTS_NOTE = 'Ballpark estimates from rough public price figures, rounded. Not quotes.';

export const LAUNCH_COSTS_M = {
  // house rockets (spacey)
  'sparrow-1': 8, 'heron-9': 70, 'heron-9-v11': 60, 'heron-9-crew': 75, 'heron-heavy': 150,
  'colossus-v3': 100, 'colossus-v4': 100, 'colossus-tanker': 100, 'colossus-depot': 100, 'colossus-lunar': 150, 'colossus-mars': 150,
  // showroom ids
  pip: 0.5, needle: 8, swift: 60, heron: 75, atlas: 150, bulwark: 150, selene: 900, ares: 600, colossus: 100, hopper: 1, sandpiper: 1,
  // small and medium
  'dark-dart': 8, 'alpha-bug': 15, diamantine: 15, 'polar-slinger': 15, 'slinger-mk3': 15, 'negev-dart': 15, electrino: 8, 'electrino-recovery': 8,
  'granite-2': 60, 'ember-finch-2e': 40, 'ember-finch-3': 60,
  tsubame: 90, 'tsubame-2024': 90, tsurugi: 50, 'tsurugi-22': 50, 'tsurugi-24': 55, 'tsurugi-30': 45,
  kawasemi: 30, uguisu: 15, 'hoshi-m': 20, 'hoshi-v': 38, mejiro: 20,
  scoutling: 25, 'scoutling-x1': 20, 'blue-scoutling': 15, athenix: 55, 'pine-crest-1': 20, 'lumen-trail': 20,
  pegacorn: 40, antarion: 85, 'minotaurus-1': 30, 'minotaurus-4': 50, taurox: 55, conestogo: 20,
  thorin: 20, 'thorin-toaster': 20, 'thorin-agenta': 30, 'thorin-capable': 25, 'thorin-capablestar': 25,
  deltoid: 55, 'deltoid-2': 60, 'deltoid-2-heavy9': 65, 'deltoid-2-light3': 55, 'deltoid-3': 90, 'deltoid-4': 165, 'deltoid-4-m': 165, 'deltoid-4-heavy': 350,
  atlantean: 70, 'atlantean-centaurus': 100, 'atlantean-crew': 130, 'atlantean-upper': 100,
  'atlantean-v': 120, 'atlantean-v-401': 110, 'atlantean-v-501': 130, 'atlantean-v-551': 155,
  cosmokart: 15, 'cosmokart-1': 15, 'cosmokart-1b': 15, 'cosmokart-2': 25, 'cosmokart-3m': 25, 'whirligig-2': 30, 'whirligig-3': 35, riverbend: 20,
  rodnik: 50, 'rodnik-2': 45, lastochka: 30, pervy: 15, kometa: 30, 'steppe-arrow': 50, 'steppe-arrow-2': 50, 'steppe-arrow-3': 60,
  'taiga-1': 40, 'taiga-a5': 100, gorynych: 70, 'gorynych-m': 70, 'gorynych-k': 75,
  'titanus-2': 60, 'titanus-2-icbm': 40, 'titanus-3': 150, 'titanus-4': 450,
  'baltic-hammer': 3, 'baltic-hammer-tandem': 5, redrock: 20, 'redrock-crew': 25, 'junebug-1': 15, vantguard: 20, 'featherwing-1': 5, 'new-shepherdish': 4,
  'monsoon-heavy': 50, 'flock-hopper': 1,
  // heavy and up
  europia: 60, vegara: 40, 'vegara-c': 48, 'arion-5': 165, 'arion-6': 85, 'arion-62': 85, 'arion-64': 115,
  'new-glendale': 110, 'jade-lantern-5': 100, 'jade-lantern-5b': 100, 'jade-lantern-2f': 70, 'jade-lantern-3b': 70,
  'vulcanis-2s': 110, 'vulcanis-4l': 120, 'vulcanis-6l': 130,
  'saturnine-1': 300, 'saturnine-1b': 350, 'saturnine-v': 1200, moonhammer: 700, mogutny: 1000, 'mogutny-glider': 1000,
  'space-truck': 1500, 'super-lift': 2000, 'super-lift-crew': 2200, 'super-lift-cargo': 2000, 'super-lift-1b-crew': 2500, 'super-lift-1b-cargo': 2300,
  // payload stacks and ground structures are never flown on their own: a token price keeps the lookup total
  'payload-roadster': 70, 'payload-flatsat-stack': 10, 'catch-tower': 100,
};

// class fallbacks (USD millions): by liftoff mass in tonnes, then the crewed / hopper flags
export const CLASS_COSTS_M = { sounding: 0.5, hopper: 1, small: 15, medium: 60, heavy: 150, 'super-heavy': 800, crewed: 150, 'deep-space': 600 };
export const classOfMass = t => (!(t > 0) ? 'medium' : t < 10 ? 'sounding' : t < 60 ? 'small' : t < 300 ? 'medium' : t < 900 ? 'heavy' : 'super-heavy');

const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// candidates for one id: itself, then trimmed trailing letters after digits ("x-5b" -> "x-5"), then trailing "-segment"s
function* trims(id) {
  let s = slug(id);
  while (s) { yield s; const a = s.replace(/(\d)[a-z]+$/, '$1'); if (a !== s) yield a; const i = s.lastIndexOf('-'); s = i > 0 ? s.slice(0, i) : ''; }
}
// info: { ids: [model, showroom id, design name…], massT, crewed, hop, deepSpace }  ->  { usd, basis: 'named'|'class', key, cls }
export function launchCost(info = {}) {
  const ids = [].concat(info.ids || info.id || []).filter(Boolean);
  for (const id of ids) for (const k of trims(id)) if (LAUNCH_COSTS_M[k] > 0) return { usd: LAUNCH_COSTS_M[k] * 1e6, basis: 'named', key: k, cls: null };
  const cls = info.hop ? 'hopper' : info.deepSpace ? 'deep-space' : info.crewed ? 'crewed' : classOfMass(info.massT);
  return { usd: CLASS_COSTS_M[cls] * 1e6, basis: 'class', key: null, cls };
}
