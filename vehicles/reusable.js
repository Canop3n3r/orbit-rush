// Booster reusability (Aaron f5.3): a stage is reusable only when its catalog/roster entry says reusable: true.
// Reads the per-stage reusable flag (engines-1, #46): only the heron/colossus house and the new-glendale first stage are; every other booster is expended.
import { VEHICLES, ROSTER_BLUEH } from './catalog.js?v=f5.8e';
const ALL = [...VEHICLES, ...ROSTER_BLUEH];
const ALIAS = { 'titan-ss-v3': 'colossus-v3', 'titan-ss-v4': 'colossus-v4' };
export function stageReusable(model, i = 0) {
  const id = ALIAS[model] || model; if (!id) return false;
  const v = ALL.find(x => x.id === id) || (/^colossus-/.test(id) ? ALL.find(x => x.id === 'colossus-v3') : null);
  return !!(v && v.stages && v.stages[i] && v.stages[i].reusable);
}
// design-level answer: explicit design.reusable wins; a hero model reads the catalog; custom builds (no model) keep legs-based recovery
export function designReusable(d) {
  if (!d) return false; if (typeof d.reusable === 'boolean') return d.reusable;
  if (d.model) return stageReusable(d.model, 0);
  return true;
}
