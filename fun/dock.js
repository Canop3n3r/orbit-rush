// f5.9a: the two-border layout. A top bar and a bottom bar hold EVERY flight control; panels open as drawers between/over them, never in the middle of the view.
// Any element can ask for a slot with data-dock="top-left|top-center|top-right|bottom-attitude|bottom-left|bottom-center|bottom-right" (set when it is created, markup stays isolated);
// the table below docks the controls that already exist. A MutationObserver adopts late arrivals; ResizeObservers publish --topH / --botH for drawers.
const SLOTS = { 'top-left': 'tbL', 'top-center': 'tbC', 'top-right': 'tbR', 'bottom-attitude': 'bbT', 'bottom-left': 'bbL', 'bottom-center': 'bbC', 'bottom-right': 'bbR' };
const TABLE = [ // [selector, slot]; order inside a slot = table order
  ['#craftTag', 'top-left'], ['#wDn,#wVal,#wUp', 'top-left'], ['#hintS', 'top-center'],
  ['#ignite', 'top-center'], ['#mapBar', 'top-center'], ['#pTake', 'top-center'], ['#gcamBtn,#camBtn', 'top-right'], ['#dMap,#mMap', 'top-right'], ['#dMenuBtn,#mMenuBtn', 'top-right'],
  ['#navSasT', 'bottom-attitude'], ['#navRd', 'bottom-attitude'], ['#plain', 'bottom-left'], ['#nav', 'bottom-center'], ['#dCtl,#mright', 'bottom-right'], ['#relBtn', 'bottom-right'],
];
const $ = id => document.getElementById(id);
export function createDock() {
  if ($('topBar')) return;
  document.body.classList.add('u59');
  const mk = (id, kids) => { const e = document.createElement('div'); e.id = id; e.innerHTML = kids.map(k => `<div id="${k}"></div>`).join(''); document.body.appendChild(e); return e; };
  const top = mk('topBar', ['tbL', 'tbC', 'tbR']), bot = mk('botBar', ['bbT', 'bbL', 'bbC', 'bbR']);
  const place = (e, slot) => { const s = $(SLOTS[slot]); if (s && e.parentElement !== s && !e.contains(s)) s.appendChild(e); };
  const sweep = () => {
    for (const [sel, slot] of TABLE) document.querySelectorAll(sel).forEach(e => place(e, slot));
    document.querySelectorAll('[data-dock]').forEach(e => { if (!e.closest('#topBar,#botBar')) place(e, e.dataset.dock); });
  };
  sweep();
  new MutationObserver(() => sweep()).observe(document.body, { childList: true, subtree: true });
  const pub = () => { const r = document.documentElement.style; r.setProperty('--topH', (top.offsetHeight || 0) + 'px'); const nv = $('nav'), bb = bot.getBoundingClientRect(), nq = nv && nv.getBoundingClientRect(); const bulge = bot.offsetHeight && nq && nq.width ? Math.max(0, Math.round(bb.top - nq.top + 6)) : 0; r.setProperty('--botH', ((bot.offsetHeight || 0) + bulge) + 'px'); }; // f5.9j: the navball arches above the bar, so sheets and framing treat the bulge as part of the bottom border
  if (window.ResizeObserver) { const ro = new ResizeObserver(pub); ro.observe(top); ro.observe(bot); } else window.addEventListener('resize', pub); window.addEventListener('resize', pub); setInterval(pub, 700); // the bulge follows the viewport (and the nav showing/hiding), not only the bar's own box
  const pubMap = () => { const mb = $('mapBurn'); document.documentElement.style.setProperty('--mapBotH', (mb && getComputedStyle(mb).display !== 'none' ? Math.round(mb.getBoundingClientRect().height) : 0) + 'px'); }; // fixed elements have no offsetParent
  const hookMap = () => { const m = $('mapBurn'); if (!m || m === hookMap.el) return; hookMap.el = m; if (window.ResizeObserver) new ResizeObserver(pubMap).observe(m); new MutationObserver(pubMap).observe(m, { attributes: true, attributeFilter: ['class'] }); pubMap(); };
  hookMap(); new MutationObserver(hookMap).observe(document.body, { childList: true });
  pub();
  return { top, bot, sweep };
}
