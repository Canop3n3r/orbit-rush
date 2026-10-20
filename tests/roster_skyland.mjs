// Roster 'skyland': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_skyland.mjs
import { ROSTER_SKYLAND, ENGINES_SKYLAND } from '../vehicles/roster/skyland.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_skyland', ROSTER_SKYLAND, ENGINES_SKYLAND);
