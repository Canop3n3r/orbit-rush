// Career ladder: public entry point. Pure logic, no DOM. See docs/career_ladder.md for the API and the event shape.
export { META, ORDER, CLASSES, setLaunchCostSource, launchPrice } from '../data/ladder_meta.js';
export { LADDER, GOALS, STARTERS, goalOf, goalMet, rankOf, rowOf, priceOf } from './ladder.js';
export { goalProgress } from './goal_progress.js';
export { feeOf, failChargeOf, rewardOf, payoutOf, stipendFor, fmtMoney, nextPriceOf, FEE_RATE, FAIL_MULT, BASE_SHARE, START_CASH } from './economy.js';
export { createAutoTracker, DT_CAP } from './auto_tracker.js';
export { blank, load, save, migrate, sanitize, ownedIds, nextInLine, buyNext, isComplete, KEY, VERSION } from './state.js';
export { createCareer } from './session.js';
export { flightStrip, STRIP_KEYS } from './strip.js';
export { simulateCareer, tuningRows } from './sim.js';
