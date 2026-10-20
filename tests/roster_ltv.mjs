// Roster 'ltv': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_ltv.mjs
import { ROSTER_LTV, ENGINES_LTV } from '../vehicles/roster/ltv.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_ltv', ROSTER_LTV, ENGINES_LTV);
