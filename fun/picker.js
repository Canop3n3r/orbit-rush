// f5.1h: the grouped rocket picker (Aaron-confirmed direction). One sheet: the Orbit Rush Originals first, then one
// section per fictional launch house with its art models. The part builder sits behind the Sandbox toggle.
export const HOUSES = [
  ['spacey', 'Spacey'], ['civspace', 'Civil Space Agency'], ['arion', 'Arion Space'], ['albion', 'Albion Rocket Establishment'],
  ['baltic', 'Baltic Test Range'], ['bluehz', 'Blue Horizon'], ['bolt', 'Bolt Labyrinth'], ['cnfoll', 'Orient Commercial Launch Collective'], ['convex', 'ConVar Astro'], ['dougwing', 'Doug-Wing Aerospace'], ['expl', 'Expl Space'], ['galen', 'Galen Space'],
  ['gaulois', 'Gaulois Spatial'], ['irg', 'Independent Rocketeers Guild'], ['isra', 'ISRA'], ['jade', 'Jade Sky Academy'], ['jaxo', 'JAXO'],
  ['krasnaya', 'Krasnaya Orbita Bureau'], ['krunov', 'Krunov Machine Works'], ['levant', 'Levant Aerospace'], ['lingvolt', 'Ling-Volt Scout Co.'], ['martell', 'Martell Marietta'],
  ['orbitron', 'Orbitron Sciences'], ['rocketwell', 'RocketWell Orbiter Systems'], ['skyland', 'Skyland Space'], ['southstar', 'Southstar Design Bureau'], ['unilift', 'Unilift Alliance'],
];
// f5.4j: launch houses by region (one-word headings)
export const REGIONS = [
  ['Americas', ['spacey', 'civspace', 'bluehz', 'rocketwell', 'unilift', 'martell', 'convex', 'dougwing', 'orbitron', 'bolt', 'expl', 'irg']],
  ['Europe', ['arion', 'gaulois', 'albion', 'baltic']],
  ['Eurasia', ['krasnaya', 'krunov', 'southstar']],
  ['Asia', ['cnfoll', 'galen', 'jade', 'lingvolt', 'jaxo', 'isra', 'skyland', 'levant']],
];
// filter the open picker: matching cards show, their houses open; empty input restores the folded view
export function filterPicker(root, q) { q = String(q || '').trim().toLowerCase();
  for (const c of root.querySelectorAll('.pkC')) c.classList.toggle('pkHide', !!q && !c.textContent.toLowerCase().includes(q) && !(c.closest('.pkCo') && c.closest('.pkCo').querySelector('summary').textContent.toLowerCase().includes(q)));
  for (const d of root.querySelectorAll('details.pkCo,details.pkLk')) { const any = d.querySelector('.pkC:not(.pkHide)'); if (q) d.open = !!any; else d.open = false; d.classList.toggle('pkHide', !!q && !any); }
  for (const sct of root.querySelectorAll('section')) sct.classList.toggle('pkHide', !!q && !sct.querySelector('.pkC:not(.pkHide)')); }
// which flyable showroom stack a house model rides on (physics flies the part stack; the art is the hero model)
export const baseFor = h => (h < 30 ? 'needle' : h < 80 ? 'swift' : h < 115 ? 'atlas' : 'heavy'); // 'heavy' = the super-heavy Originals card (main.js resolves it)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// sets: { house: [model ids] }; originals: [{ i, name, role, locked }]; name(id) -> display name
// one-line role for a house card from the model height (m)
export const roleFor = h => (h < 30 ? 'Small launcher' : h < 60 ? 'Medium launcher' : h < 80 ? 'Medium-heavy' : h < 115 ? 'Heavy lifter' : 'Super-heavy') + ' · ' + Math.round(h) + ' m';
// f5.2 (QA f5.1h): one-word section names (budget: picker group_words ≤ 2)
export const SHORT = { spacey: 'Spacey', civspace: 'Civil', arion: 'Arion', albion: 'Albion', baltic: 'Baltic', bluehz: 'Horizon', bolt: 'Bolt', cnfoll: 'Orient', convex: 'ConVar', dougwing: 'Doug-Wing', expl: 'Expl', galen: 'Galen',
  gaulois: 'Gaulois', irg: 'Guild', isra: 'ISRA', jade: 'Jade', jaxo: 'JAXO', krasnaya: 'Krasnaya', krunov: 'Krunov', levant: 'Levant', lingvolt: 'Ling-Volt', martell: 'Martell', orbitron: 'Orbitron',
  rocketwell: 'RocketWell', skyland: 'Skyland', southstar: 'Southstar', unilift: 'Unilift' };
// size class from the stack the rocket really flies on (one rule for every card, so a rocket never gets two sizes)
export const CLASS_OF = { pip: 'Sounding rocket', needle: 'Small launcher', swift: 'Medium launcher', heron: 'Medium launcher', atlas: 'Heavy lifter', 'booster-2': 'Heavy lifter', heavy: 'Super-heavy' }; // any other base is the super-heavy Originals stack
export function pickerHTML({ originals = [], pinned = {}, sets, name, sandbox, role = () => '', locked = () => false }) {
  const card = (attr, nm, sub, lk) => `<button class="pkC${lk ? ' lk' : ''}" ${attr}><b>${lk ? '🔒 ' : ''}${esc(nm)}</b><small>${esc(sub)}</small></button>`;
  let h = `<div class="pkH"><b>Rockets</b><button id="pkSandbox" class="pkSw" role="switch" aria-checked="${sandbox ? 'true' : 'false'}"><i></i>Sandbox</button><button id="pkClose" aria-label="Close">✕</button></div>`;
  h += `<input id="pkQ" type="search" placeholder="Search rockets or makers" aria-label="Search rockets" autocomplete="off">`;
  if (originals.length) h += `<section><h4>Originals</h4><div class="pkG">${originals.map(o => card(`data-i="${o.i}"`, o.name, o.role, o.locked)).join('')}</div></section>`;
  const dup = new Set(originals.map(o => o.name.toLowerCase())); // f5.2: a rocket already in Originals is not listed again under its house
  const lockedFold = (cards) => cards.length ? `<details class="pkLk"><summary>🔒 ${cards.length} more locked</summary><div class="pkG">${cards.join('')}</div></details>` : '';
  // f5.4j (QA declutter): 4 regions instead of 28 sections; each launch house folds (tap to open) and a search box filters every card
  for (const [rg, keys] of REGIONS) { let body = '', n = 0;
    for (const k of keys) { const ids = (sets[k] || []).filter(id => !dup.has(String(name(id)).toLowerCase())), pin = pinned[k] || []; if (!ids.length && !pin.length) continue;
      const open = ids.filter(id => !locked(id)), shut = ids.filter(id => locked(id)); n += ids.length + pin.length;
      body += `<details class="pkCo" data-h="${esc(k)}"><summary>${esc(SHORT[k] || k)} <small>${open.length + pin.length}${shut.length ? ' · 🔒' + shut.length : ''}</small></summary>${pin.length ? `<div class="pkG">${pin.map(o => card(`data-i="${o.i}"`, o.name, o.role, o.locked)).join('')}</div>` : ''}${open.length ? `<div class="pkG">${open.map(id => card(`data-m="${esc(id)}"`, name(id), role(id), false)).join('')}</div>` : ''}${lockedFold(shut.map(id => card(`data-m="${esc(id)}"`, name(id), role(id), true)))}</details>`; }
    if (body) h += `<section class="pkR"><h4>${rg}</h4>${body}</section>`; }
  if (sandbox) h += `<section><h4>Sandbox</h4><div class="pkG"><button class="pkC" id="pkBuild"><b>🔧 Build your own</b><small>Part builder</small></button></div></section>`;
  return h;
}
