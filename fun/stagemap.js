// f5.1h staging audit fix: map an art model's stage groups (userData.stages keys) onto the physics stages it flies on.
// Before this, the flight only knew 'booster' / 'upper' (+ heron-heavy sides), so most house models never dropped a stage.
const RADIAL = /^(srb|strap|side|struts|booster[a-z]?\d)/i, KEEP = /^(payload|capsule|les|service|adapter|orbiter|tower|lander|crew|probe|fairing)/i;
const RANK = [[/^(booster|s1|stage1|core|ccb|cbc|et|first)$/i, 1], [/^(s2|stage2|second|transfer)$/i, 2], [/^(s3|stage3|third|kick)$/i, 3], [/^(s4|stage4|fourth)$/i, 4], [/^(upper|dcss|ius)$/i, 9]];
const rankOf = k => { for (const [re, r] of RANK) if (re.test(k)) return r; return 0; };
// model drop groups in drop order: [radials?], then core stages bottom-up
export function modelGroups(keys) {
  const radial = keys.filter(k => RADIAL.test(k) && !KEEP.test(k)), core = keys.filter(k => !RADIAL.test(k) && !KEEP.test(k) && rankOf(k) > 0).sort((a, b) => rankOf(a) - rankOf(b));
  // the top core group rides with the payload on the physics top stage (never dropped)
  return { radial, core: core.slice(0, Math.max(0, core.length - 1)).map(k => [k]), top: core.slice(-1) };
}
// physics shape of a design's stage list (flight order): radial count, droppable core count (stages below the last powered/top stage)
export function physShape(stages) { const last = stages.length - 1; let radial = 0, core = 0; for (let j = 0; j < last; j++) (stages[j].radial ? radial++ : core++); return { radial: radial > 0, core, n: stages.length }; }
// plan[j] = model keys hidden once physics stage j has been dropped (cur > j)
export function dropPlan(keys, stages) {
  const g = modelGroups(keys), plan = stages.map(() => []); const last = stages.length - 1; let ci = 0;
  for (let j = 0; j < last; j++) {
    if (stages[j].radial) { plan[j].push(...g.radial); continue; }
    if (ci < g.core.length) plan[j].push(...g.core[ci++]);
    else if (ci === g.core.length && g.top.length) { plan[j].push(...g.top); ci++; } // e.g. a crew stack: the upper drops, the capsule (payload) flies on
  }
  // a model with no physics radial stage: its radials ride with the first core drop (strap-ons leave with the first stage)
  if (g.radial.length && !stages.some(s => s.radial)) { const j0 = plan.findIndex((p, j) => j < last); if (j0 >= 0) plan[j0].push(...g.radial); }
  const used = new Set(plan.flat()), left = [...g.radial, ...g.core.flat()].filter(k => !used.has(k));
  return { plan, left };
}
// audit: does this model stage cleanly on these physics stages?
export function audit(keys, stages) {
  const g = modelGroups(keys), s = physShape(stages), causes = [];
  if (!keys.length) causes.push('model has no stage groups');
  if (g.radial.length && !s.radial) causes.push('model boosters, stack has none');
  if (!g.radial.length && s.radial) causes.push('stack boosters, model has none');
  if (keys.length && g.core.length > s.core) causes.push(`model has ${g.core.length} core stages, stack drops ${s.core}`);
  if (keys.length && g.core.length + (g.top.length ? 1 : 0) < s.core) causes.push(`stack drops ${s.core} core stages, model has ${g.core.length}`);
  return { ok: !causes.length, causes, model: { radial: g.radial.length, core: g.core.length }, stack: s };
}
// f5.1h: the physics stack a house model flies on, matched to its stage shape (radials + droppable core stages), then size
export function shapeKey(keys) { const g = modelGroups(keys); return (g.radial.length ? 'R' : '') + g.core.length; }
const SHAPES = { 0: ['pip'], 1: ['needle', 'swift'], 2: ['heron', 'selene'], 3: ['ares'], R0: ['atlas'], R1: ['atlas'], R2: ['booster-2'], R3: ['booster-2'], R4: ['booster-2'] };
// the super-heavy showroom rocket (its id predates the public-name audit; resolved from its model)
let HEAVY = 'swift'; export const setHeavyBase = id => { HEAVY = id; };
export function pickBase(keys, h, stacks) { const k = shapeKey(keys), c = SHAPES[k] || SHAPES[k.replace('R', '')] || ['needle'];
  if (k === '1') return h < 30 ? 'needle' : h < 100 ? 'swift' : HEAVY; if (k === '2') return h < 50 ? 'selene' : 'heron'; return c[0]; }
