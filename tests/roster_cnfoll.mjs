// Roster 'cnfoll': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_cnfoll.mjs
import { ROSTER_CNFOLL, ENGINES_CNFOLL } from '../vehicles/roster/cnfoll.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_cnfoll', ROSTER_CNFOLL, ENGINES_CNFOLL);
