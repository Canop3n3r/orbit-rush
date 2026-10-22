// f2h home screen: a rocket showroom. The 3D rocket on the pad is the hero; a slim glass card shows the name,
// role and three bars, one big FLY and one small mission button. Bottom: Fly · Build · Missions · Atlas. Gear: settings.
const $ = id => document.getElementById(id);
export function createHome({ list, onSelect, onFly, onMission, onBuild, onMissions, onAtlas, onGear, locked = () => false, hidden = () => false, onCareer = () => {} }) {
  const el = document.createElement('div'); el.id = 'home'; el.className = 'hidden';
  el.innerHTML = `<div id="hTop"><div class="hLogo">ORBIT <b>RUSH</b></div><span class="hTopR"><button id="hnCareer" aria-label="Career progress" title="Career progress">🏆</button><button id="hGear" aria-label="Settings" title="Settings">⚙</button></span></div>
  <button id="hPrev" class="hArr" aria-label="Previous rocket">‹</button><button id="hNext" class="hArr" aria-label="Next rocket">›</button>
  <div id="hCard"><div class="hRow"><div><div id="hName"></div><div id="hRole"></div></div></div>
    <div class="hRow hAct"><button id="hFly">Fly</button><button id="hMis"></button></div><div id="hDots">${list.map((_, i) => `<i data-i="${i}"${hidden(i) ? ' class="hidden"' : ''}></i>`).join('')}</div></div>
  <nav id="hNav"><button id="hnFly" class="on">🚀<span>Fly</span></button><button id="hnBuild">🔧<span>Build</span></button><button id="hnMis">🎯<span>Missions</span></button><button id="hnAtlas">🪐<span>Atlas</span></button></nav>`;
  document.body.appendChild(el);
  let i = 0, on = false;
  const set = (k, quiet) => { const n = list.length, dir = k < i ? -1 : 1; k = (k + n) % n; for (let s = 0; s < n && hidden(k); s++) k = (k + dir + n) % n; i = k; const r = list[i];
    $('hName').textContent = r.name; $('hRole').textContent = r.role;
    $('hMis').textContent = r.mission ? r.missionLabel + ' ▸' : ''; $('hMis').classList.toggle('hidden', !r.mission); // QA f5.1c: Customize lives in Build (🔧) $('hMis').title = r.mission ? 'One-tap mission: the director flies it, you watch (or take over)' : 'Open it in the builder as a copy';
    const lk = locked(i); $('hFly').textContent = lk ? '🔒 LOCKED' : 'Fly'; $('hFly').classList.toggle('locked', lk); el.classList.toggle('lockedV', lk);
    [...$('hDots').children].forEach((d, j) => d.classList.toggle('on', j === i));
    if (!quiet) onSelect(i); };
  const tap = (id, fn) => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; };
  tap('hPrev', () => set(i - 1)); tap('hNext', () => set(i + 1)); tap('hFly', () => onFly(i)); tap('hMis', () => (list[i].mission ? onMission(i) : onBuild(i)));
  tap('hnFly', () => {}); tap('hnBuild', () => onBuild(i)); tap('hnMis', () => onMissions()); tap('hnAtlas', () => onAtlas()); tap('hnCareer', () => onCareer()); tap('hGear', () => onGear());
  $('hDots').onclick = e => { const d = e.target.closest('i'); if (d) set(+d.dataset.i); };
  // swipe anywhere that is not a control
  let sx = null, sy = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button,#hCard')) return; sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', e => { if (sx === null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) set(i + (dx < 0 ? 1 : -1)); });
  document.addEventListener('keydown', e => { if (!on || e.target.closest && e.target.closest('input,select,textarea')) return; if (e.code === 'ArrowRight') set(i + 1); else if (e.code === 'ArrowLeft') set(i - 1); else if (e.code === 'Enter') onFly(i); });
  return { el, set, refresh: () => set(i, true), get index() { return i; }, get on() { return on; },
    show(v) { on = !!v; el.classList.toggle('hidden', !on); document.body.classList.toggle('home', on); } };
}
