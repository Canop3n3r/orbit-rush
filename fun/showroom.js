// f2h: the home-screen rocket showroom. Nine original prebuilt rockets, each with a role it really flies with AUTO
// (checked in tests/showroom.mjs): reach space, orbit, land the booster, Moon, Mars, Venus, orbit-and-home, hop.
// No DOM here: the card bars are derived from the same stats the hangar uses.
import { TEMPLATES, designStats, cloneDesign } from '../parts.js?v=f5.1a';
import { setHeavyBase } from './stagemap.js?v=f5.8f';
const P = (id, n) => (n ? { id, n } : { id });
const T = n => TEMPLATES.find(t => t.name === n);
// check: what tests/showroom.mjs verifies.  space: AUTO apoapsis > 100 km · orbit: AUTO reaches a stable orbit ·
// booster: orbit + the booster lands itself · hop: a suborbital hop (Ap 20–100 km) · mission:<id>: the one-tap director mission succeeds
export const SHOWROOM = [
  { id: 'pip', name: 'Pip', role: 'Sounding rocket · touch space', check: 'space', difficulty: 0.1, mission: null,
    design: { name: 'Pip', parts: [P('chute'), P('probe'), P('tank-n'), P('tank-n'), P('tank-n'), P('mule'), P('fins')] } },
  { id: 'needle', name: 'Needle', role: 'Slim two-stage orbiter', check: 'orbit', difficulty: 0.3, mission: null,
    design: { name: 'Needle', parts: [P('fairing'), P('probe'), P('tank-n'), P('tank-n'), P('lark'), P('dec'), P('tank-n'), P('tank-n'), P('tank-n'), P('tank-n'), P('tank-n'), P('tank-n'), P('tank-n'), P('tank-n'), P('thumper'), P('fins')] } },
  { id: 'swift', name: 'Swift', role: 'Reusable booster · lands itself', check: 'booster', difficulty: 0.35, mission: null, tpl: 'Light & fast' },
  { id: 'heron', name: 'Heron', role: 'Crew capsule · orbit and splash down', check: 'mission:orbit', difficulty: 0.45, mission: 'orbit', tpl: 'Orbit & home' },
  { id: 'atlas', name: 'Bulwark', role: 'Heavy lifter · 2 side boosters', check: 'orbit', difficulty: 0.5, mission: null,
    design: { name: 'Bulwark', parts: [P('fairing'), P('sat'), P('sat'), P('probe'), P('tank-m'), P('tank-s'), P('lark', 2), P('dec'), P('tank-xl'), P('tank-l'), P('mule', 3), P('fins'), P('rdec', 2), P('tank-r'), P('tank-r'), P('thumper', 3)] } },
  { id: 'selene', name: 'Selene', role: 'Three-stage Moon rocket + lander', check: 'mission:moon', difficulty: 0.7, mission: 'moon', tpl: 'Moon lander' },
  { id: 'ares', name: 'Red Arrow', role: 'Mars lander stack (also Venus)', check: 'mission:mars', difficulty: 0.8, mission: 'mars', alt: 'venus', tpl: 'Mars explorer' },
  { id: 'titan', name: 'Colossus', role: 'Super-heavy · 5-engine cluster', check: 'orbit', difficulty: 0.6, mission: null,
    design: { name: 'Colossus', parts: [P('fairing'), P('sat'), P('sat'), P('probe'), P('tank-w'), P('mule', 5), P('dec'), P('tank-w'), P('tank-w'), P('tank-w'), P('bison', 5), P('fins')] } },
  { id: 'hopper', name: 'Sandpiper', house: 'spacey', role: 'Test hopper · hop and land on the pad', check: 'mission:hop', difficulty: 0.2, mission: 'hop',
    design: { name: 'Sandpiper', hop: true, parts: [P('chute'), P('crew'), P('tank-n'), P('mule'), P('fins')] } },
];
for (const r of SHOWROOM) if (r.tpl) { const t = T(r.tpl); r.design = { ...cloneDesign(t), name: r.name }; r.tplName = r.tpl; }
// f4: hero models (gfx/vehicles, Rocket Art Bot) for the catalog-inspired rockets; physics still flies the part stack
export const MODEL_OF = { needle: 'sparrow-1', swift: 'heron-9', heron: 'heron-9-crew', atlas: 'heron-heavy', titan: 'titan-ss-v3' };
Object.assign(MODEL_OF, { selene: 'selene', ares: 'ares' }); // f5.1h (QA f5.1e): Selene and Red Arrow fly their own art
for (const r of SHOWROOM) if (MODEL_OF[r.id]) { r.model = MODEL_OF[r.id]; r.design.model = r.model; }
for (const r of SHOWROOM) if (r.check === 'space' || r.check === 'mission:hop') r.design.sub = true; // f5.1h: suborbital by role
{ const h = SHOWROOM.find(r => /colossus|ss-v3/.test(r.model || '')); if (h) setHeavyBase(h.id); } // f5.1h: the super-heavy stack for big house rockets
// fleet-1 (Aaron 10-22): the Originals group is retired. Pip, Selene and Red Arrow stay only as internal physics stacks
// (house rockets and tests fly on them) and never show on Home or in the picker; the hopper joins the Spacey house as Sandpiper.
export const RETIRED = new Set(['pip', 'selene', 'ares']);
export const DEFAULT_ID = 'swift'; // Heron-9: the default rocket on a fresh load or when a save points at a retired one
export const RTLS = new Set(['swift', 'atlas']); // f4: these fly back to the landing zone (boostback + RTLS) instead of a droneship
for (const r of SHOWROOM) if (RTLS.has(r.id)) r.design.recovery = 'rtls';
const clamp = x => Math.max(0.06, Math.min(1, x));
// three card bars, 0..1: power = liftoff thrust (log scale), range = total Δv, difficulty = hand-rated piloting skill
export function bars(r) {
  const s = designStats(r.design), thrust = s.twr * s.mass * 9.81; // kN at liftoff
  return { power: clamp((Math.log10(Math.max(100, thrust)) - 2.4) / (4.3 - 2.4)), range: clamp(s.total / 16000), difficulty: clamp(r.difficulty) };
}
export const missionLabel = { hop: 'Hop & land', orbit: 'Orbit & home', moon: 'Moon landing', mars: 'Mars', venus: 'Venus flyby' };
// f5.1h: extra flyable stacks for house rockets whose stage shape no showroom rocket has (staging audit)
const PAY = [P('fairing'), P('sat'), P('sat'), P('probe')], CORE = [P('tank-xl'), P('tank-l'), P('mule', 3), P('fins')], RAD = [P('rdec', 2), P('tank-r'), P('tank-r'), P('thumper', 3)];
export const EXTRA_STACKS = {
  'booster-2': { name: 'Booster 2-stage', design: { name: 'Booster 2-stage', parts: [...PAY, P('tank-s'), P('lark'), P('dec'), P('tank-m'), P('tank-s'), P('lark', 2), P('dec'), ...CORE, ...RAD] } },
};
