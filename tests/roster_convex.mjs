// Roster 'convex': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_convex.mjs
import { ROSTER_CONVEX, ENGINES_CONVEX } from '../vehicles/roster/convex.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_convex', ROSTER_CONVEX, ENGINES_CONVEX);
