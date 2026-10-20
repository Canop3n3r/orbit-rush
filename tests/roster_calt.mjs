// Roster vehicles of company 'calt' vs the ascent loss model (vehicles/roster/loss.js). Run: node tests/roster_calt.mjs
import { ROSTER_CALT, ENGINES_CALT } from '../vehicles/catalog.js';
import { checkRoster } from './roster_check.mjs';
checkRoster('roster_calt', ROSTER_CALT, ENGINES_CALT);
