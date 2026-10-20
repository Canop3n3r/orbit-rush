// Roster vehicles of company 'redstar' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_redstar.mjs
import { ROSTER_REDSTAR, ENGINES_REDSTAR } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_redstar', ROSTER_REDSTAR, ENGINES_REDSTAR);
