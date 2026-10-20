// Roster vehicles of company 'blueh' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_blueh.mjs
import { ROSTER_BLUEH, ENGINES_BLUEH } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_blueh', ROSTER_BLUEH, ENGINES_BLUEH);
