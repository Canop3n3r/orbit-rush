// Roster vehicles of company 'arion' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_arion.mjs
import { ROSTER_ARION, ENGINES_ARION } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_arion', ROSTER_ARION, ENGINES_ARION);
