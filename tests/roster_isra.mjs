// Roster 'isra': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_isra.mjs
import { ROSTER_ISRA, ENGINES_ISRA } from '../vehicles/roster/isra.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_isra', ROSTER_ISRA, ENGINES_ISRA);
