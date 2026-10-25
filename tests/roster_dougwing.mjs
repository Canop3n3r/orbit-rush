// Roster 'dougwing': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_dougwing.mjs
import { ROSTER_DOUGWING, ENGINES_DOUGWING } from '../vehicles/roster/dougwing.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_dougwing', ROSTER_DOUGWING, ENGINES_DOUGWING);
