// Roster vehicles of company 'nosa' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_nosa.mjs
import { ROSTER_NOSA, ENGINES_NOSA } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_nosa', ROSTER_NOSA, ENGINES_NOSA);
