// Roster vehicles of company 'jade' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_jade.mjs
import { ROSTER_JADE, ENGINES_JADE } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_jade', ROSTER_JADE, ENGINES_JADE);
