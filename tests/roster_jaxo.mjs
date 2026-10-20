// Roster 'jaxo': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_jaxo.mjs
import { ROSTER_JAXO, ENGINES_JAXO } from '../vehicles/roster/jaxo.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_jaxo', ROSTER_JAXO, ENGINES_JAXO);
