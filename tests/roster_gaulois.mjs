// Roster 'gaulois': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_gaulois.mjs
import { ROSTER_GAULOIS, ENGINES_GAULOIS } from '../vehicles/roster/gaulois.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_gaulois', ROSTER_GAULOIS, ENGINES_GAULOIS);
