// Roster 'firefly': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_firefly.mjs
import { ROSTER_FIREFLY, ENGINES_FIREFLY } from '../vehicles/roster/firefly.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_firefly', ROSTER_FIREFLY, ENGINES_FIREFLY);
