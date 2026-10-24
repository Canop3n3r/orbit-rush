// f5.4 sandbox launch-from-anywhere picker (Home 📍 button): world → preset base or tap a spot on the map.
import { SITES, GAS } from '../sites.js?v=f5.8u';
const KEY = 'orbitRush.site.v1';
export function loadSite() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.body ? s : null; } catch (e) { return null; } }
export function saveSite(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) { } }
export const siteLabel = (s, BODIES) => s ? `${s.name} · ${BODIES[s.body].name}` : 'Classic pad · Earth';
export function createSitePicker({ BODIES, onPick }) {
  const el = document.createElement('div'); el.id = 'sitePick'; el.className = 'hidden';
  const order = Object.values(BODIES).filter(b => !GAS.has(b.id)).sort((a, b) => (a.parent === 'sun' ? 0 : 1) - (b.parent === 'sun' ? 0 : 1)).map(b => b.id); { const top = ['earth', 'moon', 'mars'].filter(id => order.includes(id)); order.splice(0, order.length, ...top, ...order.filter(id => !top.includes(id))); } // f5.8g: Earth, Moon, Mars first
  el.innerHTML = `<div class="spBox"><div class="spHead"><b>Launch site</b><button class="spX" aria-label="Close">✕</button></div>
    <div class="spBodies">${order.map((id, i) => `<button data-b="${id}"${i >= 3 ? ' class="spB2"' : ''}>${BODIES[id].name}</button>`).join('')}${(() => { const ex = order.slice(3), grp = {}; ex.forEach(id => { const par = BODIES[id].parent, k = !par || par === 'sun' ? 'Planets' : 'Moons of ' + (BODIES[par] ? BODIES[par].name : par); (grp[k] = grp[k] || []).push(id); }); return `<select class="spWSel" aria-label="More worlds"><option value="">More worlds…</option>${Object.keys(grp).map(k => `<optgroup label="${k}">${grp[k].map(id => `<option value="${id}">${BODIES[id].name}</option>`).join('')}</optgroup>`).join('')}</select>`; })()}</div>
    <div class="spInfo"></div><div class="spSites"></div>
    <canvas class="spMap" width="640" height="320" aria-label="Tap a spot to launch from there"></canvas><div class="spHint">Tap the map to pick any spot</div>
    <div class="spAct"><button class="spMore" aria-expanded="false">More…</button></div></div>`;
  document.body.appendChild(el);
  let body = 'earth', pick = null; const q = s => el.querySelector(s), cv = q('.spMap'), g = cv.getContext('2d');
  const info = id => { const b = BODIES[id], gs = b.mu / (b.R * b.R), day = b.omega ? Math.abs(2 * Math.PI / b.omega / 3600) : 0;
    return `${b.name}: gravity ${(gs / 9.80665).toFixed(2)} g · ${b.atm ? 'atmosphere' : 'no air'} · day ${day > 48 ? (day / 24).toFixed(1) + ' d' : day.toFixed(1) + ' h'}`; };
  // f5.4k (QA 4): the map shows the world's real texture (equirectangular, lon -180..180) when one ships; else the colour band
  const TEX = { earth: 'earth_day', moon: 'moon', mars: 'mars', mercury: 'mercury', venus: 'venus' }, texC = {};
  const texOf = id => { if (!TEX[id]) return null; if (texC[id]) return texC[id]; const im = new Image(); texC[id] = im; im.onload = () => { im.ok = true; if (body === id) draw(); }; im.src = new URL('../assets/tex/' + TEX[id] + '_1k.jpg', import.meta.url).href; return im; };
  const draw = () => { const b = BODIES[body], c = '#' + b.color.toString(16).padStart(6, '0'), W = cv.width, H = cv.height;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#222'); gr.addColorStop(0.5, c); gr.addColorStop(1, '#222'); g.fillStyle = gr; g.fillRect(0, 0, W, H); const im = texOf(body); if (im && im.ok) g.drawImage(im, 0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; for (let k = 1; k < 12; k++) { g.beginPath(); g.moveTo(k * W / 12, 0); g.lineTo(k * W / 12, H); g.stroke(); } for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(0, k * H / 6); g.lineTo(W, k * H / 6); g.stroke(); }
    const dot = (lat, lon, col, r) => { const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    for (const s of SITES[body] || []) dot(s[2], s[3], '#fff', 5); if (pick && pick.body === body) dot(pick.lat, pick.lon, '#ff4060', 9); };
  const render = () => { el.querySelectorAll('.spBodies button').forEach(x => x.classList.toggle('on', x.dataset.b === body)); { const ws = q('.spWSel'); if (ws) { ws.value = order.indexOf(body) >= 3 ? body : ''; ws.classList.toggle('on', order.indexOf(body) >= 3); } } q('.spInfo').textContent = info(body);
    q('.spSites').innerHTML = (body === 'earth' ? `<button class="spReset${pick ? '' : ' on'}">Classic pad</button>` : '') + (SITES[body] || []).map((s, i) => `<button data-i="${i}" class="${pick && pick.body === body && pick.id === s[0] ? 'on' : ''}${i >= (body === 'earth' ? 3 : 4) ? ' spX2' : ''}">${s[1]}</button>`).join(''); q('.spMore').hidden = !(SITES[body] || []).length; draw(); const ob = q('.spBodies .on'); if (ob) { const r = q('.spBodies'); r.scrollLeft = Math.max(0, ob.offsetLeft - r.clientWidth / 2 + ob.offsetWidth / 2); } }; // f5.8d (QA): 4 pads + More… (the rest + the map)
  const choose = s => { pick = s; saveSite(s); render(); onPick(s); };
  q('.spWSel').onchange = e => { if (e.target.value) { body = e.target.value; render(); } }; /* f5.8h (QA P2): the other 15 worlds are one grouped picker, not 23 chips */ q('.spBodies').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('spWorlds')) { const m = el.classList.toggle('worlds'); b.textContent = m ? 'Fewer' : 'More worlds…'; b.setAttribute('aria-expanded', m); return; } body = b.dataset.b; render(); };
  q('.spSites').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.classList.contains('spReset')) { pick = null; saveSite(null); onPick(null); show(false); return; } const s = SITES[body][+b.dataset.i]; choose({ body, id: s[0], name: s[1], lat: s[2], lon: s[3] }); };
  cv.onclick = e => { const r = cv.getBoundingClientRect(), lon = ((e.clientX - r.left) / r.width) * 360 - 180, lat = 90 - ((e.clientY - r.top) / r.height) * 180;
    choose({ body, id: 'spot', name: `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`, lat: +lat.toFixed(3), lon: +lon.toFixed(3) }); };
  q('.spX').onclick = () => show(false); q('.spMore').onclick = () => { const m = el.classList.toggle('more'); q('.spMore').textContent = m ? 'Less' : 'More…'; q('.spMore').setAttribute('aria-expanded', m); }; 
  const anchor = () => { /* f5.8m/n: the sheet opens right at the 📍 button: beside it in landscape, under the hero button on desktop, bottom sheet pulled up to within ~70 px on a portrait phone */
    const box = q('.spBox'), b = document.getElementById('hSite'); if (!box) return; for (const k of ['position', 'left', 'top', 'bottom', 'right', 'margin', 'height', 'max-height', 'margin-bottom']) box.style.removeProperty(k);
    if (!b || !b.offsetWidth) return; const r = b.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, im = 'important', land = matchMedia('(orientation:landscape)').matches, set = (k, v) => box.style.setProperty(k, v, im);
    if (!land) { if (box.getBoundingClientRect().top > r.bottom + 70) { const cur = box.getBoundingClientRect().top - (r.bottom + 70); set('margin-bottom', Math.round(cur) + 'px'); } return; }
    set('position', 'fixed'); set('margin', '0');
    if (innerHeight < 501 && r.right + 8 + w <= innerWidth) { set('left', Math.round(r.right + 8) + 'px'); set('top', Math.round(Math.max(8, Math.min(r.top, innerHeight - h - 8))) + 'px'); set('bottom', 'auto'); return; }
    set('left', Math.round(Math.max(8, Math.min(r.left, innerWidth - w - 8))) + 'px');
    if (r.top > innerHeight / 2 && r.top - 8 - h >= 8) { set('top', 'auto'); set('bottom', Math.round(innerHeight - r.top + 8) + 'px'); } else { set('top', Math.round(Math.max(8, Math.min(r.bottom + 8, innerHeight - h - 8))) + 'px'); set('bottom', 'auto'); } };
  const show = v => { if (v) { el.classList.remove('more'); { const sel = loadSite(); el.classList.toggle('worlds', !!sel && order.indexOf(sel.body) >= 3); } q('.spMore').textContent = 'More…'; pick = loadSite(); body = pick ? pick.body : 'earth'; render(); } el.classList.toggle('hidden', !v); if (v) setTimeout(() => anchor(), 0); };
  return { el, show, choose, get on() { return !el.classList.contains('hidden'); } };
}
