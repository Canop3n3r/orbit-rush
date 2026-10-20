// Roster 'albion': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_albion.mjs
import { ROSTER_ALBION, ENGINES_ALBION } from '../vehicles/roster/albion.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_albion', ROSTER_ALBION, ENGINES_ALBION);
