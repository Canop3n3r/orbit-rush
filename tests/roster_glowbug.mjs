// Roster 'glowbug': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_glowbug.mjs
import { ROSTER_GLOWBUG, ENGINES_GLOWBUG } from '../vehicles/roster/glowbug.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_glowbug', ROSTER_GLOWBUG, ENGINES_GLOWBUG);
