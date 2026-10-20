// Roster 'northp': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_northp.mjs
import { ROSTER_NORTHP, ENGINES_NORTHP } from '../vehicles/roster/northp.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_northp', ROSTER_NORTHP, ENGINES_NORTHP);
