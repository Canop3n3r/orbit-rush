// f5 career UI: the progress screen (#careerM: ladder, wallet, unlocks, sandbox toggle) and the career block
// of the post-flight results card. Logic lives in fun/ladder.js; names come in through `name` (brand-aware).
import * as L from './ladder.js?v=f5';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function createCareerUI({ store, name, onPlay }) {
  let S = L.load(store);
  const sb = () => L.sandbox(store);
  const rungName = c => name.rung(c), unl = u => u.kind === 'vehicles' ? '🚀 ' + name.vehicle(u.id) : u.kind === 'sites' ? '📍 ' + name.site(u.id) : u.kind === 'parts' ? '🔧 ' + name.part(u.id) : '🎯 ' + name.mission(u.id);
  const unlockList = c => Object.entries(c.unlock).flatMap(([kind, ids]) => ids.map(id => unl({ kind, id })));
  const rw = r => [r.cash ? `💰 $${r.cash}M` : '', r.sci ? `🔬 ${r.sci}` : ''].filter(Boolean).join(' · ');
  const el = document.createElement('div'); el.id = 'careerM'; el.className = 'mbox hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Career progress');
  document.body.appendChild(el);
  function render() {
    S = L.load(store); const nx = L.next(S), done = L.LADDER.filter(c => S.done[c.id]).length, sand = sb();
    const rows = L.LADDER.map((c, i) => { const st = S.done[c.id] ? 'done' : c === nx ? 'next' : 'locked';
      return `<li class="cr ${st}"><span class="crI">${st === 'done' ? '✓' : st === 'next' ? '▶' : i + 1}</span><div class="crT"><b>${esc(rungName(c))}</b><small>${esc(c.goal)} · ${esc(name.vehicle(c.vehicle))}</small>`
        + `<small class="crR">${rw(c.reward)}${unlockList(c).length ? ' → ' + esc(unlockList(c).join(', ')) : ''}</small></div></li>`; }).join('');
    const have = k => L.ALL[k].filter(id => L.isUnlocked(S, k, id, sand));
    el.innerHTML = `<div class="crHead"><h2>Career</h2><button class="crX" aria-label="Close">✕</button></div>
      <div class="crWallet"><span>💰 <b>$${S.cash}M</b></span><span>🔬 <b>${S.sci}</b></span><span>🏁 <b>${done}/${L.LADDER.length}</b></span></div>
      ${nx ? `<div class="crNext"><div><small>NEXT CONTRACT</small><b>${esc(rungName(nx))}</b><small>${esc(nx.goal)}</small></div><button class="crPlay big">Fly ▸</button></div>` : '<div class="crNext"><b>Ladder complete 🎉</b></div>'}
      <ol class="crList">${rows}</ol>
      <div class="crUnl"><small>UNLOCKED</small><div>${have('vehicles').map(id => '🚀 ' + esc(name.vehicle(id))).join(' · ')}</div><div>${have('sites').map(id => '📍 ' + esc(name.site(id))).join(' · ')}</div></div>
      <label class="crSand"><input type="checkbox" ${sand ? 'checked' : ''}> Sandbox: everything unlocked (career progress still counts)</label>`;
    el.querySelector('.crX').onclick = () => show(false);
    const p = el.querySelector('.crPlay'); if (p) p.onclick = () => { show(false); onPlay(nx); };
    el.querySelector('.crSand input').onchange = e => { L.setSandbox(store, e.target.checked); render(); };
  }
  function show(on = true) { if (on) render(); el.classList.toggle('hidden', !on); if (!on) dispatchEvent(new Event('career-change')); }
  // record a flight and return the results-card HTML + the next rung
  function record(r) { S = L.load(store); const out = L.record(S, r); L.save(store, S); return out; }
  function resultsHTML(out) {
    const e = out.earned.length ? `<div class="ecEarn">🏆 ${out.earned.map(c => esc(rungName(c))).join(' · ')} <b>+${rw({ cash: out.cash, sci: out.sci })}</b></div>` : '';
    const u = out.unlocks.length ? `<div class="ecUnl">Unlocked: ${esc(out.unlocks.map(unl).join(', '))}</div>` : '';
    const n = out.next ? `<div class="ecNext">Next: <b>${esc(rungName(out.next))}</b> — ${esc(out.next.goal)} <span class="ecRw">${rw(out.next.reward)}</span></div>` : '<div class="ecNext">Career ladder complete 🎉</div>';
    return `<div class="endCareer">${e}${u}${n}<div class="ecWal">💰 $${S.cash}M · 🔬 ${S.sci}</div></div>`;
  }
  return { el, show, render, record, resultsHTML, get state() { return L.load(store); }, locked: (kind, id) => !L.isUnlocked(L.load(store), kind, id, sb()), next: () => L.next(L.load(store)), unlockedBy: L.unlockedBy };
}
