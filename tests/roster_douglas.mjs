// Roster 'douglas': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_douglas.mjs
import { ROSTER_DOUGLAS, ENGINES_DOUGLAS } from '../vehicles/roster/douglas.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_douglas', ROSTER_DOUGLAS, ENGINES_DOUGLAS);
