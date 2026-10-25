// Roster 'southstar': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_southstar.mjs
import { ROSTER_SOUTHSTAR, ENGINES_SOUTHSTAR } from '../vehicles/roster/southstar.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_southstar', ROSTER_SOUTHSTAR, ENGINES_SOUTHSTAR);
