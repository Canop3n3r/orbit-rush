// Roster 'orbitron': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_orbitron.mjs
import { ROSTER_ORBITRON, ENGINES_ORBITRON } from '../vehicles/roster/orbitron.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_orbitron', ROSTER_ORBITRON, ENGINES_ORBITRON);
