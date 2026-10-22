// f5.4 sandbox launch-from-anywhere picker (Home 📍 button): world → preset base or tap a spot on the map.
import { SITES, GAS } from '../sites.js?v=f5.6b';
const KEY = 'orbitRush.site.v1';
export function loadSite() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return s && s.body ? s : null; } catch (e) { return null; } }
export function saveSite(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (e) { } }
export const siteLabel = (s, BODIES) => s ? `${s.name} · ${BODIES[s.body].name}` : 'Classic pad · Earth';
export function createSitePicker({ BODIES, onPick }) {
  const el = document.createElement('div'); el.id = 'sitePick'; el.className = 'hidden';
  const order = Object.values(BODIES).filter(b => !GAS.has(b.id)).sort((a, b) => (a.parent === 'sun' ? 0 : 1) - (b.parent === 'sun' ? 0 : 1)).map(b => b.id);
  el.innerHTML = `<div class="spBox"><div class="spHead"><b>Launch from anywhere</b><span class="spSub">Sandbox: every rocket unlocked</span><button class="spX" aria-label="Close">✕</button></div>
    <div class="spBodies">${order.map(id => `<button data-b="${id}">${BODIES[id].name}</button>`).join('')}</div>
    <div class="spInfo"></div><div class="spSites"></div>
    <canvas class="spMap" width="640" height="320" aria-label="Tap a spot to launch from there"></canvas><div class="spHint">Tap the map to pick any spot</div>
    <div class="spAct"><button class="spReset">Back to Earth (career pad)</button></div></div>`;
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
  const render = () => { el.querySelectorAll('.spBodies button').forEach(x => x.classList.toggle('on', x.dataset.b === body)); q('.spInfo').textContent = info(body);
    q('.spSites').innerHTML = (SITES[body] || []).map((s, i) => `<button data-i="${i}" class="${pick && pick.body === body && pick.id === s[0] ? 'on' : ''}">${s[1]}</button>`).join(''); draw(); };
  const choose = s => { pick = s; saveSite(s); render(); onPick(s); };
  q('.spBodies').onclick = e => { const b = e.target.closest('button'); if (!b) return; body = b.dataset.b; render(); };
  q('.spSites').onclick = e => { const b = e.target.closest('button'); if (!b) return; const s = SITES[body][+b.dataset.i]; choose({ body, id: s[0], name: s[1], lat: s[2], lon: s[3] }); };
  cv.onclick = e => { const r = cv.getBoundingClientRect(), lon = ((e.clientX - r.left) / r.width) * 360 - 180, lat = 90 - ((e.clientY - r.top) / r.height) * 180;
    choose({ body, id: 'spot', name: `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`, lat: +lat.toFixed(3), lon: +lon.toFixed(3) }); };
  q('.spX').onclick = () => show(false); q('.spReset').onclick = () => { pick = null; saveSite(null); onPick(null); show(false); };
  const show = v => { if (v) { pick = loadSite(); body = pick ? pick.body : 'earth'; render(); } el.classList.toggle('hidden', !v); };
  return { el, show, choose, get on() { return !el.classList.contains('hidden'); } };
}
