// Mission catalog. Each mission lives in its own file (missions/<id>.js, default export) so branches adding
// missions never collide. Missing files are skipped, so this list is identical on every missions branch.
export const MISSION_IDS = ['constellation-batch', 'tower-catch', 'crew-dock', 'refuel', 'rideshare'];
export async function loadMissions() {
  const out = [];
  for (const id of MISSION_IDS) { try { out.push((await import(`./${id}.js`)).default); } catch (e) { /* not on this branch */ } }
  return out;
}
