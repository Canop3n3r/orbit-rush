// Roster vehicles of company 'rlab' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_rlab.mjs
import { ROSTER_RLAB, ENGINES_RLAB } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_rlab', ROSTER_RLAB, ENGINES_RLAB);
