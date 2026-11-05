// Per-rocket propellant strip. One pill per fuel tank (not one bar per stage), aft on the left and the nose
// on the right. A radial booster stage is drawn as a pair beside the core. The pill width is the tank's
// capacity; the fill is that stage's remaining propellant, updated every frame. Dropped stages collapse.
// This replaces the old S1/S2 fuel columns.
export function rocketTanks(v) {
  if (!v || !v.stages) return [];
  const cur = v.cur || 0, out = [];
  v.stages.forEach((st, i) => {
    const parts = (st.parts || []).filter(p => p && p.kind === 'tank' && p.fuelCap > 0);
    const caps = parts.length ? parts.map(p => p.fuelCap) : (st.fuelMax > 0 ? [st.fuelMax] : []);
    if (!caps.length) return;
    const frac = st.fuelMax > 0 ? Math.max(0, Math.min(1, (st.fuel || 0) / st.fuelMax)) : 0;
    const spent = i < cur, radial = !!st.radial;
    caps.forEach((cap, k) => out.push({
      stage: i, tank: k, cap, frac, radial, pair: radial && caps.length === 1, spent, active: i === cur,
      low: !spent && frac < 0.15, label: radial ? 'B' : 'S' + (i + 1),
    }));
  });
  return out;
}
function groupsOf(tanks) {
  const g = [];
  for (const t of tanks) {
    let row = g[g.length - 1];
    if (!row || row.stage !== t.stage) { row = { stage: t.stage, radial: t.radial, label: t.label, cap: 0, pills: [], spent: t.spent, active: t.active, low: t.low, frac: t.frac }; g.push(row); }
    row.cap += t.cap; row.spent = t.spent; row.active = t.active; row.low = t.low; row.frac = t.frac;
    if (t.pair) row.pills.push(t.cap, t.cap); else row.pills.push(t.cap);
  }
  return g;
}
export function createTankViz() {
  const el = document.createElement('div'); el.id = 'tankViz'; el.dataset.dock = 'top-center'; el.className = 'hidden';
  el.setAttribute('role', 'img'); el.setAttribute('aria-label', 'Propellant by tank');
  document.body.appendChild(el);
  let sig = '';
  const build = tanks => {
    const g = groupsOf(tanks);
    const core = g.reduce((a, s) => a + (s.radial || s.spent ? 0 : s.cap), 0) || 1;
    el.innerHTML = g.map(s => {
      const flex = s.spent ? 0.22 : s.radial ? Math.max(0.35, s.cap / core * 2.2) : Math.max(0.45, s.cap / core * 8);
      const pills = s.pills.map(c => `<div class="tk" style="flex:${c} 1 0"><i></i></div>`).join('');
      return `<div class="tkS${s.radial ? ' rad' : ''}" data-i="${s.stage}" style="flex:${flex.toFixed(2)} 1 0">${pills}<b>${s.label}</b></div>`;
    }).join('') + '<div class="tkNose"></div>';
  };
  return {
    el,
    tick(v, on) {
      const tanks = rocketTanks(v);
      const show = !!(on && tanks.length);
      el.classList.toggle('hidden', !show);
      if (!show) return;
      const s2 = tanks.map(t => t.stage + (t.radial ? 'r' : 'c') + t.tank + ':' + Math.round(t.cap) + (t.pair ? 'p' : '')).join('|');
      if (s2 !== sig) { sig = s2; build(tanks); }
      const by = new Map(); for (const t of tanks) if (!by.has(t.stage)) by.set(t.stage, t);
      let label = 'Propellant';
      el.querySelectorAll('.tkS').forEach(k => {
        const t = by.get(+k.dataset.i); if (!t) return;
        k.classList.toggle('spent', t.spent); k.classList.toggle('act', t.active && !t.spent); k.classList.toggle('low', t.low && !t.spent);
        const pc = t.spent ? 0 : t.frac * 100;
        k.querySelectorAll('i').forEach(e => { e.style.width = pc.toFixed(1) + '%'; });
        const bit = t.spent ? 'dropped' : Math.round(t.frac * 100) + '%';
        k.title = `${t.radial ? 'Boosters' : 'Stage ' + (t.stage + 1)}: ${bit}`;
        label += ', ' + t.label + ' ' + bit;
      });
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
    },
  };
}
