// Roster 'levant': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_levant.mjs
import { ROSTER_LEVANT, ENGINES_LEVANT } from '../vehicles/roster/levant.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_levant', ROSTER_LEVANT, ENGINES_LEVANT);
