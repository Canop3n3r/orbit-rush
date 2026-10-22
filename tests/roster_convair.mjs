// Roster 'convair': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_convair.mjs
import { ROSTER_CONVAIR, ENGINES_CONVAIR } from '../vehicles/roster/convair.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_convair', ROSTER_CONVAIR, ENGINES_CONVAIR);
