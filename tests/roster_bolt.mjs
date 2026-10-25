// Roster vehicles of company 'bolt' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_bolt.mjs
import { ROSTER_BOLT, ENGINES_BOLT } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_bolt', ROSTER_BOLT, ENGINES_BOLT);
