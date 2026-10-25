// f5 career ladder: contract data (Mission Design Bot). Data only; the live ladder logic is fun/ladder.js (Game bot).
// Contract ids reuse missions/campaign/career.js where the mission matches (first-orbit, constellation-batch, crew-dock,
// lunar-landing, mars-ship); first-hop, karman-line and booster-landing are new. `rung` = the matching fun/ladder.js rung id.
// Unlock ids are the game's own: vehicles = showroom ids (fun/showroom.js; `model` = vehicles/catalog.js id),
// sites = fun/ladder.js ALL.sites, missions = contract ids here or fun/ladder.js ALL.missions.
// Inspiration names parody companies and neutral roster ids only (vehicles/roster/*, roster PRs #15-#25).
// Money is game balance ($M), not real prices. cost = launch fee charged per attempt.
export const START = { vehicles: ['pip', 'hopper', 'needle'], sites: ['atoll'], missions: ['first-hop'] };

// Site ids = fun/ladder.js ALL.sites (renamed to neutral ids in ladder save v2).
export const SITES = {
  atoll:    { name: 'Atoll pad', kind: 'pad' },
  'cape-north':    { name: 'Cape north pad', kind: 'pad' },
  lz1:      { name: 'Landing zone', kind: 'landing' },
  'cape-heritage': { name: 'Cape heritage pad', kind: 'pad' },
  'gulf-port':     { name: 'Gulf starport', kind: 'pad+tower' },
};

export const CONTRACTS = [
  { id: 'first-hop', rung: 'hop', mission: null, vehicle: 'needle', site: 'atoll',
    goal: { text: 'Climb above 10 km and come back down', kind: 'apogee-min', m: 10000 },
    cost: 2, reward: { cash: 10, sci: 2, rep: 2 }, unlock: { missions: ['karman-line'] },
    inspiration: [
      { company: 'spacey', vehicle: 'hopper-h', note: 'low-altitude test hops of a landing booster prototype (2012-2014)' },
      { company: 'baltic', vehicle: 'baltic-hammer', note: 'early liquid-fuel test launches from a coastal range (1942)' },
      { company: 'nosa', vehicle: 'redrock', note: 'short crewed up-and-down lob (1961)' }] },
  { id: 'karman-line', rung: 'karman', mission: null, vehicle: 'needle', site: 'atoll',
    goal: { text: 'Cross 100 km: you are in space', kind: 'apogee-min', m: 100000 },
    cost: 5, reward: { cash: 20, sci: 8, rep: 5 }, unlock: { sites: ['cape-north'], missions: ['first-orbit'] },
    inspiration: [
      { company: 'baltic', vehicle: 'baltic-hammer', note: 'first object to cross 100 km (1944)' },
      { company: 'other', vehicle: 'featherwing-1', note: 'first privately built crewed craft past 100 km, twice in two weeks (2004)' }] },
  { id: 'first-orbit', rung: 'orbit', mission: 'first-orbit', vehicle: 'needle', site: 'atoll',
    goal: { text: 'Reach a stable orbit', kind: 'orbit' },
    cost: 10, reward: { cash: 40, sci: 12, rep: 10 }, unlock: { vehicles: ['swift'], missions: ['booster-landing'] },
    inspiration: [
      { company: 'spacey', vehicle: 'sparrow-1', note: 'first privately developed liquid rocket to orbit, on the 4th try (2008-09-28, spec:sparrow-1)' },
      { company: 'redstar', vehicle: 'rodnik', note: 'lineage of the first artificial satellite launcher (1957)' }] },
  { id: 'booster-landing', rung: 'booster', mission: null, vehicle: 'swift', site: 'cape-north',
    goal: { text: 'Fly the booster back and land it upright', kind: 'booster-landed' },
    cost: 15, reward: { cash: 60, sci: 10, rep: 10 }, unlock: { sites: ['lz1'], missions: ['constellation-batch'] },
    inspiration: [
      { company: 'spacey', vehicle: 'heron-9', note: 'first orbital-class booster landed back at the launch site (2015)' },
      { company: 'spacey', vehicle: 'heron-heavy', note: 'two side boosters landing side by side (2018-02-06, spec:heron-heavy)' },
      { company: 'blueh', vehicle: 'new-glendale', note: 'heavy booster landed at sea on its 2nd flight (2025)' }] },
  { id: 'constellation-batch', rung: 'constellation-batch', mission: 'constellation-batch', vehicle: 'swift', site: 'cape-north',
    goal: { text: 'Loft a satellite stack and dispense it', kind: 'mission-complete' },
    cost: 10, reward: { cash: 90, sci: 15, rep: 10 }, unlock: { vehicles: ['heron'], sites: ['cape-heritage'], missions: ['crew-dock'] },
    inspiration: [
      { company: 'spacey', vehicle: 'heron-9', note: 'flat-packed broadband satellite batches of ~60 per launch (from 2019)' }] },
  { id: 'crew-dock', rung: 'crew-dock', mission: 'crew-dock', vehicle: 'heron', site: 'cape-heritage',
    goal: { text: 'Take a crew to the station and dock', kind: 'mission-complete' },
    cost: 50, reward: { cash: 140, sci: 25, rep: 12 }, unlock: { vehicles: ['atlas', 'selene'], missions: ['lunar-landing'] },
    inspiration: [
      { company: 'spacey', vehicle: 'heron-9-crew', note: 'first commercial crew flight to the station (2020-05-30, spec:heron-9-crew)' },
      { company: 'redstar', vehicle: 'rodnik', note: 'decades of crew ferry flights to stations' },
      { company: 'rocketwell', vehicle: 'space-truck', note: 'winged orbiter that assembled the station (1998-2011)' },
      { company: 'jade', vehicle: 'jade-lantern-2f', note: 'crew launches to a national station (from 2003)' }] },
  { id: 'lunar-landing', rung: 'moon', mission: 'lunar-landing', vehicle: 'selene', site: 'cape-heritage',
    goal: { text: 'Land on the Moon', kind: 'landed', body: 'moon' },
    cost: 200, reward: { cash: 250, sci: 60, rep: 25 }, unlock: { vehicles: ['titan', 'ares'], sites: ['gulf-port'], missions: ['mars-ship'] },
    inspiration: [
      { company: 'nosa', vehicle: 'saturnine-v', note: 'six crewed Moon landings (1969-1972)' },
      { company: 'jade', vehicle: 'jade-lantern-5', note: 'robotic lunar sample return (2020)' },
      { company: 'rocketwell', vehicle: 'super-lift', note: 'uncrewed lunar test flight (2022)' },
      { company: 'redstar', vehicle: 'moonhammer', note: 'the Moon rocket that never succeeded (what-if)' }] },
  { id: 'mars-ship', rung: 'mars', mission: 'mars-ship', vehicle: 'ares', site: 'gulf-port',
    goal: { text: 'Reach Mars', kind: 'visited', body: 'mars' },
    cost: 250, reward: { cash: 400, sci: 100, rep: 30 }, unlock: { missions: ['venus'] },
    inspiration: [
      { company: 'jade', vehicle: 'jade-lantern-5', note: 'orbiter, lander and rover in one launch (2020)' },
      { company: 'ulx', vehicle: 'atlantean-v', note: 'car-sized rovers landed on Mars (2011, 2020)' },
      { company: 'blueh', vehicle: 'new-glendale', note: 'twin small Mars orbiters (2025)' },
      { company: 'spacey', vehicle: 'colossus', note: 'fully reusable Mars ship (planned, never flown: ESTIMATE)' }] },
];

// Inspiration ids above (neutral, from the studio roster plan; tier-S rows land with roster PRs #15-#25).
export const INSPIRATION_COMPANIES = ['spacey', 'baltic', 'nosa', 'other', 'redstar', 'blueh', 'rocketwell', 'jade', 'ulx'];
export const INSPIRATION_VEHICLES = ['hopper-h', 'baltic-hammer', 'redrock', 'featherwing-1', 'sparrow-1', 'rodnik', 'jade-lantern-2f', 'jade-lantern-5', 'moonhammer', 'heron-9', 'heron-heavy',
  'new-glendale', 'heron-9-crew', 'space-truck', 'long-stride-2f', 'saturnine-v', 'long-stride-5', 'super-lift', 'n-won', 'atlantean-v', 'colossus'];
