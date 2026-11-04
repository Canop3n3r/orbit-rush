// f5.9-22 (owner): per-rocket tank gauge in the top bar. One tank per stage, laid out like the rocket on its side
// (first stage on the left, nose on the right); radial booster stages are a pair of slim tanks beside the core.
// Each fills and drains from the live propellant (stage.fuel / stage.fuelMax); spent stages go grey and hollow.
export function createTankViz() {
  const el = document.createElement('div'); el.id = 'tankViz'; el.dataset.dock = 'top-center'; el.className = 'hidden';
  el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Propellant by stage');
  document.body.appendChild(el);
  let sig = '';
  const build = st => {
    const w = st.map(s => Math.sqrt(Math.max(1, s.fuelMax || 1)));
    const core = st.map((s, i) => (s.radial ? 0 : w[i])).reduce((a, b) => a + b, 0) || 1;
    el.innerHTML = st.map((s, i) => {
      const flex = s.radial ? Math.max(0.35, w[i] / core * 2.2) : Math.max(0.5, w[i] / core * 10);
      const tk = `<div class="tk"><i></i></div>`;
      return `<div class="tkS${s.radial ? ' rad' : ''}${(s.fuelMax || 0) > 0 ? '' : ' dry'}" data-i="${i}" style="flex:${flex.toFixed(2)} 1 0">${s.radial ? tk + tk : tk}<b>${s.radial ? 'B' : 'S' + (i + 1)}</b></div>`;
    }).join('') + '<div class="tkNose"></div>';
  };
  return {
    el,
    tick(v, on, boosterStage) {
      el.classList.toggle('hidden', !on || !v || !v.stages || !v.stages.length);
      if (el.classList.contains('hidden')) return;
      const s2 = v.stages.map(s => `${s.radial ? 'r' : 'c'}${Math.round(s.fuelMax || 0)}`).join(',');
      if (s2 !== sig) { sig = s2; build(v.stages); }
      const kids = el.querySelectorAll('.tkS');
      v.stages.forEach((st, i) => {
        const k = kids[i]; if (!k) return;
        const src = i === 0 && boosterStage ? boosterStage : st, spent = i < v.cur && !(i === 0 && boosterStage);
        const f = src.fuelMax > 0 ? Math.max(0, Math.min(1, src.fuel / src.fuelMax)) : 0;
        k.classList.toggle('spent', spent); k.classList.toggle('act', i === v.cur);
        k.classList.toggle('low', !spent && src.fuelMax > 0 && f < 0.15);
        const pc = spent ? 0 : f * 100;
        k.querySelectorAll('i').forEach(e => { e.style.width = pc.toFixed(1) + '%'; });
        k.title = `${st.radial ? 'Boosters' : 'Stage ' + (i + 1)}: ${spent ? 'dropped' : src.fuelMax > 0 ? Math.round(f * 100) + '%' : 'no tank'}`;
      });
    },
  };
}
