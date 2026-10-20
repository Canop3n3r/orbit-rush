// Career campaign data: ONE ordered table (edit here when milestone dates move). Order follows first-flight
// dates from the specs sheet (missions_data, first-flight table; neutral ids). Money/reputation numbers are
// game balance, not real prices.
export const CAREER = [
  // tier, vehicle id (vehicles/catalog.js), first flight (UTC, spec row), unlock rule, contracts flown on it.
  // Each contract's mission data names the same vehicle id (tests/campaign.mjs checks it).
  { tier: 1, vehicleId: 'sparrow-1', firstFlight: '2008-09-28', note: 'first orbit (spec:sparrow-1); first launch 2006-03-24',
    unlock: { start: true }, contracts: ['practice', 'first-orbit'] },
  { tier: 2, vehicleId: 'heron-heavy', firstFlight: '2018-02-06', note: 'spec:heron-heavy first flight (demo payload)',
    unlock: { rep: 10, after: ['first-orbit'] }, contracts: ['roadster-helio', 'gto-comsat'] },
  { tier: 3, vehicleId: 'heron-9', firstFlight: '2018-05-12', note: 'spec:heron-9 final block first flight (2018-05-12 20:14 UTC)',
    unlock: { rep: 25, after: ['roadster-helio'] }, contracts: ['constellation-batch', 'rideshare', 'sso-rideshare'] },
  { tier: 4, vehicleId: 'heron-9-crew', firstFlight: '2020-05-30', note: 'spec:heron-9-crew first crewed flight',
    unlock: { rep: 45, after: ['constellation-batch'] }, contracts: ['crew-dock', 'station-rendezvous'] },
  { tier: 5, vehicleId: 'colossus-v3', firstFlight: '2026-05-22', note: 'spec:colossus#v3 first flight (Flight 12); earlier blocks flew from 2023-04-20, first catch 2024-10-13',
    unlock: { rep: 70, after: ['station-rendezvous'] }, contracts: ['tower-catch', 'refuel', 'super-heavy-catch', 'ship-transfer', 'lunar-landing', 'mars-ship'] },
  { tier: 6, vehicleId: 'colossus-v4', firstFlight: null, note: 'spec:colossus#v4 not flown (in development): locked as a future tier',
    unlock: { future: true }, contracts: [] },
];
// Contract terms per mission (game balance). cost = launch cost charged when you fly; reward/rep on success.
export const CONTRACTS = {
  // practice: always flyable, free, tiny reward, never reputation (the anti-softlock floor)
  'practice': { mission: 'first-orbit', cost: 0, reward: 5, rep: 0, practice: true },
  'first-orbit': { cost: 10, reward: 35, rep: 10 },
  'constellation-batch': { cost: 10, reward: 40, rep: 10 }, 'rideshare': { cost: 20, reward: 60, rep: 8 }, 'refuel': { cost: 20, reward: 55, rep: 7 },
  'roadster-helio': { cost: 45, reward: 90, rep: 12 }, 'gto-comsat': { cost: 55, reward: 150, rep: 10 }, // tier 2 affordable after ~2 tier-1 wins
  'sso-rideshare': { cost: 30, reward: 90, rep: 10 }, 'tower-catch': { cost: 30, reward: 80, rep: 8 },
  'crew-dock': { cost: 50, reward: 140, rep: 12 }, 'station-rendezvous': { cost: 50, reward: 160, rep: 15 },
  'super-heavy-catch': { cost: 90, reward: 220, rep: 15 }, 'ship-transfer': { cost: 120, reward: 260, rep: 15 },
  'lunar-landing': { cost: 200, reward: 500, rep: 25 }, 'mars-ship': { cost: 250, reward: 650, rep: 30 },
};
export const START = { money: 50, rep: 0 };
export const MAX_REP = 1000, FAIL_REP = 3;
export const REPEAT_REWARD = 0.2;   // repeating a finished contract: 20% of the reward, no reputation
export const missionOf = id => (Object.hasOwn(CONTRACTS, id) && CONTRACTS[id].mission) || id;
export const cheapestCost = () => Math.min(...Object.values(CONTRACTS).filter(c => !c.practice).map(c => c.cost));
export const tierOfMission = id => CAREER.find(t => t.contracts.includes(id)) || null;
