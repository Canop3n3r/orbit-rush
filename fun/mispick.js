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
