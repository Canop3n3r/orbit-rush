// Roster vehicles of company 'ulx' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_ulx.mjs
import { ROSTER_ULX, ENGINES_ULX } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_ulx', ROSTER_ULX, ENGINES_ULX);
