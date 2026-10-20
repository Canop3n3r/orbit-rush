// f5.1h (Aaron): missions fly the rocket the player picked or built. Never swap it silently; AUTO is opt-in.
// qualifying(): the picker rockets that can do a mission (the showroom rocket made for it, plus the house rockets
// that fly on its stack); the mission card lists them with the player's current rocket first.
export function qualifying(id, show, houseBase = []) {
  const ok = show.filter(r => r.mission === id || r.alt === id || (id === 'orbit' && r.check === 'mission:orbit'));
  const ids = new Set(ok.map(r => r.id));
  return [...ok.map(r => ({ key: 'o:' + r.id, name: r.name, base: r.id, model: r.model || null })),
    ...houseBase.filter(h => ids.has(h.base)).map(h => ({ key: 'h:' + h.model, name: h.name, base: h.base, model: h.model }))];
}
// the launch plan for a mission card choice: exactly the chosen design (deep copy), AUTO only if asked
export function launchPlan(design, auto) { return { design: JSON.parse(JSON.stringify(design)), auto: !!auto }; }
export const autoNote = (auto, name) => auto ? `AUTO mission: the director flies your ${name}. Tap ✋ to take over.` : `You fly your ${name}. AUTO is off (press F / AUTO to turn it on).`;
// f5.2 (QA f5.1h P1): the card's default. The player's rocket stays selected when it qualifies. Otherwise the
// recommended rocket is preselected and a visible line says why; the player can tap back to their own rocket.
// cur = { name, model, ok (valid design), sub (suborbital) }; q = qualifying() rows, recommended first.
export function cardChoice(q, cur, needOrbit = true) {
  const qual = !!cur && cur.ok && !(needOrbit && cur.sub) && q.some(x => x.name === cur.name || (cur.model && x.model === cur.model));
  const mine = cur && cur.ok ? { key: 'mine', name: cur.name || 'Your rocket', mine: true, qual } : null;
  const others = q.filter(x => !(cur && (x.name === cur.name || (cur.model && x.model === cur.model))));
  if (qual || !others.length) return { list: [...(mine ? [mine] : []), ...others], sel: mine ? 'mine' : others[0] && others[0].key, note: '' };
  const rec = others[0], why = cur && cur.sub && needOrbit ? 'can’t reach orbit' : 'isn’t built for this';
  return { list: [rec, ...(mine ? [mine] : []), ...others.slice(1)], sel: rec.key, note: mine ? `${mine.name} ${why}; using ${rec.name}` : '' };
}
