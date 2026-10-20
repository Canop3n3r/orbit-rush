// Roster 'martell': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_martell.mjs
import { ROSTER_MARTELL, ENGINES_MARTELL } from '../vehicles/roster/martell.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_martell', ROSTER_MARTELL, ENGINES_MARTELL);
