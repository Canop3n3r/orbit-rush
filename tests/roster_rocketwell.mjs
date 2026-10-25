// Roster vehicles of company 'rocketwell' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_rocketwell.mjs
import { ROSTER_ROCKETWELL, ENGINES_ROCKETWELL } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_rocketwell', ROSTER_ROCKETWELL, ENGINES_ROCKETWELL);
