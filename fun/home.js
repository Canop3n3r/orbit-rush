// f5.8 (Aaron): ONE home screen. The 3D rocket on the pad is the hero preview; a scrollable gallery of rocket cards
// (thumbnails baked from the game's own models) with region chips + search sits beside it (desktop/landscape) or under it
// (portrait). Tap a card = select it; Fly, launch site and Build sit on the hero bar. No arrows, no carousel, no separate picker.
const $ = id => document.getElementById(id);
export function createHome({ list, onSelect, onFly, onMission, onBuild, onMissions, onAtlas, onGear, locked = () => false, hidden = () => false, onCareer = () => {} }) {
  const el = document.createElement('div'); el.id = 'home'; el.className = 'hidden';
  el.innerHTML = `<div id="hTop"><div class="hLogo">ORBIT <b>RUSH</b></div><span class="hTopR"><button id="hnCareer" aria-label="Career progress" title="Career progress">🏆</button><button id="hGear" aria-label="Settings" title="Settings">⚙</button></span></div>
  <div id="hCard"><div class="hRow"><div><div id="hName"></div><div id="hRole"></div></div></div>
    <div class="hRow hAct"><button id="hFly">Fly</button><button id="hnBuild" aria-label="Build" title="Build / customize">🔧</button><button id="hMis"></button></div></div>
  <div id="hGal" aria-label="Rockets"></div>
  <nav id="hNav" class="hidden"><button id="hnFly" class="on">🚀<span>Fly</span></button><button id="hnMis">🎯<span>Missions</span></button><button id="hnAtlas">🪐<span>Atlas</span></button></nav>`;
  document.body.appendChild(el);
  let i = 0, on = false;
  const set = (k, quiet) => { const n = list.length; k = ((k % n) + n) % n; for (let s = 0; s < n && hidden(k); s++) k = (k + 1) % n; i = k; const r = list[i];
    $('hName').textContent = r.name; $('hRole').textContent = r.role;
    $('hMis').textContent = r.mission ? r.missionLabel + ' ▸' : ''; $('hMis').classList.toggle('hidden', !r.mission);
    const lk = locked(i); $('hFly').textContent = lk ? '🔒 LOCKED' : 'Fly'; $('hFly').classList.toggle('locked', lk); el.classList.toggle('lockedV', lk);
    if (!quiet) onSelect(i); };
  const tap = (id, fn) => { $(id).onclick = e => { e.currentTarget.blur(); fn(); }; };
  tap('hFly', () => onFly(i)); tap('hMis', () => (list[i].mission ? onMission(i) : onBuild(i)));
  tap('hnFly', () => {}); tap('hnBuild', () => onBuild(i)); tap('hnMis', () => onMissions()); tap('hnAtlas', () => onAtlas()); tap('hnCareer', () => onCareer()); tap('hGear', () => onGear());
  document.addEventListener('keydown', e => { if (!on || e.target.closest && e.target.closest('input,select,textarea')) return; if (e.code === 'Enter') onFly(i); });
  return { el, set, refresh: () => set(i, true), get index() { return i; }, get on() { return on; },
    show(v) { on = !!v; el.classList.toggle('hidden', !on); document.body.classList.toggle('home', on); } };
}
