// Roster 'lingvolt': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_lingvolt.mjs
import { ROSTER_LINGVOLT, ENGINES_LINGVOLT } from '../vehicles/roster/lingvolt.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_lingvolt', ROSTER_LINGVOLT, ENGINES_LINGVOLT);
