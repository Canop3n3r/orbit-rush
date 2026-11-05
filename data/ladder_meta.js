// Career-ladder roster data, keyed by neutral vehicle id (the ids in vehicles/catalog.js and vehicles/roster/*.js).
// Per id: first-flight YEAR (plain number of the real-world vehicle each neutral rocket is inspired by), LEO payload
// in kg (size tie-break + class), and a size CLASS derived from the payload (the fallback goal tier when nothing
// more specific is known). The unlock PRICE ($K, integer) is derived from the rocket's rank on the ladder, so it can
// never drift out of order when a year or payload is edited.
// Sources for years and payloads: rocketdb families (GCAT, see CREDITS.md); a few catalog-only variants are
// ESTIMATES (heron-9-crew 2020, colossus-v4 planned 2026, super-lift/new-glendale/arion-6 payloads).
export const CLASSES = ['light', 'small', 'medium', 'heavy', 'super'];
// class by LEO payload (kg): light < 300, small < 2500, medium < 10000, heavy < 40000, super otherwise
export const classOf = leo => (leo < 300 ? 'light' : leo < 2500 ? 'small' : leo < 10000 ? 'medium' : leo < 40000 ? 'heavy' : 'super');
// id: [first-flight year, LEO payload kg]
const RAW = {
  'thorin-capable': [1958, 120], 'atlantean': [1958, 2000], 'thorin-agenta': [1959, 1500], 'thorin-capablestar': [1960, 150],
  'deltoid': [1960, 3850], 'scoutling': [1960, 205], 'blue-scoutling': [1961, 50], 'cosmokart-1': [1961, 500],
  'atlantean-centaurus': [1962, 8620], 'titanus-2': [1964, 3600], 'titanus-3': [1964, 15350], 'cosmokart-2': [1964, 1500],
  'thorin-toaster': [1965, 500], 'diamantine': [1965, 150], 'gorynych': [1965, 21000], 'cosmokart-1b': [1965, 500],
  'rodnik': [1966, 7600], 'saturnine-v': [1967, 118000], 'cosmokart-3m': [1967, 1500], 'whirligig-2': [1967, 3350],
  'dark-dart': [1969, 75], 'moonhammer': [1969, 70000], 'hoshi-m': [1970, 800], 'mejiro': [1975, 1200],
  'thorin': [1976, 500], 'whirligig-3': [1977, 4100], 'slinger-mk3': [1979, 150], 'uguisu': [1981, 2000],
  'space-truck': [1981, 24400], 'steppe-arrow': [1985, 13500], 'kawasemi': [1986, 3200], 'negev-dart': [1988, 230],
  'titanus-4': [1989, 21680], 'deltoid-2': [1989, 5118], 'pegacorn': [1990, 440], 'polar-slinger': [1993, 1800],
  'tsubame': [1994, 19000], 'taurox': [1994, 1380], 'athenix': [1995, 2065], 'conestogo': [1995, 900],
  'arion-5': [1996, 20000], 'hoshi-v': [1997, 1800], 'deltoid-3': [1998, 8280], 'pine-crest-1': [1998, 50],
  'riverbend': [1999, 4500], 'minotaurus-1': [2000, 340], 'atlantean-v': [2002, 14000], 'deltoid-4': [2002, 28800],
  'sparrow-1': [2006, 600], 'lumen-trail': [2009, 50], 'heron-9': [2010, 22800], 'minotaurus-4': [2010, 1735],
  'heron-9-v11': [2013, 13150], 'antarion': [2013, 6250], 'jade-lantern-5': [2016, 25000], 'electrino': [2017, 150],
  'heron-heavy': [2018, 54400], 'heron-9-crew': [2020, 17400], 'alpha-bug': [2021, 1000], 'super-lift': [2022, 150000],
  'colossus-v3': [2023, 100000], 'tsurugi': [2023, 4000], 'arion-6': [2024, 21000], 'ember-finch-2e': [2024, 4000],
  'new-glendale': [2025, 45000], 'ember-finch-3': [2025, 12000], 'granite-2': [2026, 22000], 'colossus-v4': [2026, 200000],
};
// ladder order: year, then size class, then payload, then id (stable)
export const ORDER = Object.keys(RAW).sort((a, b) => RAW[a][0] - RAW[b][0] || CLASSES.indexOf(classOf(RAW[a][1])) - CLASSES.indexOf(classOf(RAW[b][1])) || RAW[a][1] - RAW[b][1] || (a < b ? -1 : 1));
// price curve ($K): $1.5M for the oldest, +11 % per rung (rounded to $10K): ~$2.2B at the top of a 70-rocket ladder
export const PRICE_BASE_K = 1500, PRICE_GROWTH = 1.11;
export const curvePrice = rank => Math.round(PRICE_BASE_K * PRICE_GROWTH ** rank / 10) * 10;
export const META = {}; ORDER.forEach((id, rank) => { const [year, leo] = RAW[id]; META[id] = { year, leo, cls: classOf(leo), price: curvePrice(rank) }; });
// Launch-cost adapter: data/launch_costs.js (stats worker, branch f59-stats) is not on main yet. When it lands, call
// setLaunchCostSource(LAUNCH_COSTS) once at load; launchPrice(id) then prefers it. The economy reads prices only
// through launchPrice(), and payouts are derived from the next price, so the ladder stays completable either way.
let source = {};
export const setLaunchCostSource = m => { source = m && typeof m === 'object' ? m : {}; };
export const launchPrice = id => { const s = source[id], m = META[id]; return Number.isFinite(s) && s > 0 ? Math.round(s) : m ? m.price : 0; };
