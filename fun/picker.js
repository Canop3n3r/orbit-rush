// f5.1h: the grouped rocket picker (Aaron-confirmed direction). One sheet: the Orbit Rush Originals first, then one
// section per fictional launch house with its art models. The part builder sits behind the Sandbox toggle.
export const HOUSES = [
  ['spacey', 'Spacey'], ['civspace', 'Civil Space Agency'], ['arion', 'Arion Space'], ['albion', 'Albion Rocket Establishment'],
  ['baltic', 'Baltic Test Range'], ['bluehz', 'Blue Horizon'], ['bolt', 'Bolt Labyrinth'], ['convex', 'ConVar Astro'], ['dougwing', 'Doug-Wing Aerospace'],
  ['gaulois', 'Gaulois Spatial'], ['irg', 'Independent Rocketeers Guild'], ['isra', 'ISRA'], ['jade', 'Jade Sky Academy'], ['jaxo', 'JAXO'],
  ['krasnaya', 'Krasnaya Orbita Bureau'], ['krunov', 'Krunov Machine Works'], ['lingvolt', 'Ling-Volt Scout Co.'], ['martell', 'Martell Marietta'],
  ['orbitron', 'Orbitron Sciences'], ['rocketwell', 'RocketWell Orbiter Systems'], ['southstar', 'Southstar Design Bureau'], ['unilift', 'Unilift Alliance'],
];
// which flyable showroom stack a house model rides on (physics flies the part stack; the art is the hero model)
export const baseFor = h => (h < 30 ? 'needle' : h < 80 ? 'swift' : h < 115 ? 'atlas' : 'heavy'); // 'heavy' = the super-heavy Originals card (main.js resolves it)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// sets: { house: [model ids] }; originals: [{ i, name, role, locked }]; name(id) -> display name
// one-line role for a house card from the model height (m)
export const roleFor = h => (h < 30 ? 'Small launcher' : h < 60 ? 'Medium launcher' : h < 80 ? 'Medium-heavy' : h < 115 ? 'Heavy lifter' : 'Super-heavy') + ' · ' + Math.round(h) + ' m';
// f5.2 (QA f5.1h): one-word section names (budget: picker group_words ≤ 2)
export const SHORT = { spacey: 'Spacey', civspace: 'Civil', arion: 'Arion', albion: 'Albion', baltic: 'Baltic', bluehz: 'Horizon', bolt: 'Bolt', convex: 'ConVar', dougwing: 'Doug-Wing',
  gaulois: 'Gaulois', irg: 'Guild', isra: 'ISRA', jade: 'Jade', jaxo: 'JAXO', krasnaya: 'Krasnaya', krunov: 'Krunov', lingvolt: 'Ling-Volt', martell: 'Martell', orbitron: 'Orbitron',
  rocketwell: 'RocketWell', southstar: 'Southstar', unilift: 'Unilift' };
// size class from the stack the rocket really flies on (one rule for every card, so a rocket never gets two sizes)
export const CLASS_OF = { pip: 'Sounding rocket', needle: 'Small launcher', swift: 'Medium launcher', heron: 'Medium launcher', atlas: 'Heavy lifter', 'booster-2': 'Heavy lifter', heavy: 'Super-heavy' }; // any other base is the super-heavy Originals stack
export function pickerHTML({ originals, sets, name, sandbox, role = () => '', locked = () => false }) {
  const card = (attr, nm, sub, lk) => `<button class="pkC${lk ? ' lk' : ''}" ${attr}><b>${lk ? '🔒 ' : ''}${esc(nm)}</b><small>${esc(sub)}</small></button>`;
  let h = `<div class="pkH"><b>Rockets</b><button id="pkSandbox" class="pkSw" role="switch" aria-checked="${sandbox ? 'true' : 'false'}"><i></i>Sandbox</button><button id="pkClose" aria-label="Close">✕</button></div>`;
  h += `<section><h4>Originals</h4><div class="pkG">${originals.map(o => card(`data-i="${o.i}"`, o.name, o.role, o.locked)).join('')}</div></section>`;
  const dup = new Set(originals.map(o => o.name.toLowerCase())); // f5.2: a rocket already in Originals is not listed again under its house
  const lockedFold = (cards) => cards.length ? `<details class="pkLk"><summary>🔒 ${cards.length} more locked</summary><div class="pkG">${cards.join('')}</div></details>` : '';
  for (const [k] of HOUSES) { const ids = (sets[k] || []).filter(id => !dup.has(String(name(id)).toLowerCase())); if (!ids.length) continue;
    const open = ids.filter(id => !locked(id)), shut = ids.filter(id => locked(id));
    h += `<section><h4>${esc(SHORT[k] || k)}</h4>${open.length ? `<div class="pkG">${open.map(id => card(`data-m="${esc(id)}"`, name(id), role(id), false)).join('')}</div>` : ''}${lockedFold(shut.map(id => card(`data-m="${esc(id)}"`, name(id), role(id), true)))}</section>`; }
  if (sandbox) h += `<section><h4>Sandbox</h4><div class="pkG"><button class="pkC" id="pkBuild"><b>🔧 Build your own</b><small>Part builder</small></button></div></section>`;
  return h;
}
