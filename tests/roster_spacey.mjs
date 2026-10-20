// Roster 'spacey': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_spacey.mjs
import { ROSTER_SPACEY, ENGINES_SPACEY } from '../vehicles/roster/spacey.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_spacey', ROSTER_SPACEY, ENGINES_SPACEY);
