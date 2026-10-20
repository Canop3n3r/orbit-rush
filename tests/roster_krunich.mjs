// Roster vehicles of company 'krunich' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_krunich.mjs
import { ROSTER_KRUNICH, ENGINES_KRUNICH } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_krunich', ROSTER_KRUNICH, ENGINES_KRUNICH);
