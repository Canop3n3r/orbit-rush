// Roster vehicles of company 'rockwell' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_rockwell.mjs
import { ROSTER_ROCKWELL, ENGINES_ROCKWELL } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_rockwell', ROSTER_ROCKWELL, ENGINES_ROCKWELL);
