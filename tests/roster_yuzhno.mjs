// Roster 'yuzhno': payloads vs sourced (GCAT) LEO figures via the shared checker. Run: node tests/roster_yuzhno.mjs
import { ROSTER_YUZHNO, ENGINES_YUZHNO } from '../vehicles/roster/yuzhno.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_yuzhno', ROSTER_YUZHNO, ENGINES_YUZHNO);
