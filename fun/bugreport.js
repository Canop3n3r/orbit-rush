// f5.9-18: in-game bug reports. Shake the phone (opt-in in Settings; iOS asks for motion permission when you turn it on) or pick
// 🐞 Report a bug in the flight ☰ menu / Settings. The card grabs a screenshot of the game view (retake / remove), takes a short note
// and sends { note, build, viewport, state, shot } to a configurable endpoint. No endpoint (or offline / a failed send) → the report
// waits in a small local queue and goes out the next time an endpoint is reachable. Nothing about the backend lives in the repo:
// the endpoint is DEFAULT_CFG below; localStorage 'or_bug_cfg' = { url, headers } (or ?bugcfg=<url-encoded JSON> once) overrides it.
export const QKEY = 'or_bug_queue', CKEY = 'or_bug_cfg', SKEY = 'or_bug_shake', QMAX = 8;
const store = () => { try { return window.localStorage; } catch (e) { return null; } };
export function loadCfg(ls = store(), def = DEFAULT_CFG) { try { const c = JSON.parse(ls && ls.getItem(CKEY) || 'null'); return c && typeof c.url === 'string' && /^https:\/\/|^http:\/\/localhost/.test(c.url) ? { url: c.url, headers: c.headers && typeof c.headers === 'object' ? c.headers : {} } : def; } catch (e) { return def; } }
export function loadQueue(ls = store()) { try { const q = JSON.parse(ls && ls.getItem(QKEY) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; } }
export function saveQueue(q, ls = store()) { const keep = q.slice(-QMAX); for (let n = keep.length; n >= 0; n--) { try { ls && ls.setItem(QKEY, JSON.stringify(keep.slice(keep.length - n))); return n; } catch (e) { /* quota: drop the oldest */ } } return 0; }
export function makeReport({ note, build, state, shot, now = Date.now(), vw = innerWidth, vh = innerHeight, dpr = devicePixelRatio || 1, ua = navigator.userAgent }) {
  return { id: now.toString(36) + Math.random().toString(36).slice(2, 7), t: new Date(now).toISOString(), note: String(note || '').slice(0, 2000), build, viewport: { w: vw, h: vh, dpr }, ua: String(ua).slice(0, 300), state: state || {}, shot: shot || null };
}
// f5.9-18: the live backend (Supabase project orbit-rush-bugs). The publishable key is public by design: anon may only INSERT rows into
// bug_reports and upload into the private bug-shots bucket (no reads). A localStorage 'or_bug_cfg' still overrides it (tests, staging).
export const DEFAULT_CFG = { kind: 'supabase', url: 'https://cetngoryccizrnlbusxo.supabase.co', key: 'sb_publishable_PQfCkugePubmoiBkoy39eA_yxmE_7I_' }; // gitleaks:allow (publishable key, public by design: insert-only RLS, no reads)
const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
export function shotBytes(dataUrl) { const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || ''); if (!m) return null; const bin = atob(m[2]), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { type: m[1], ext: m[1] === 'image/jpeg' ? 'jpg' : m[1].slice(6), bytes: u }; }
export function supaRow(rep, path) { return { message: rep.note || '', build: rep.build || '', viewport: rep.viewport || null, state: { ...(rep.state || {}), id: rep.id, t: rep.t, ua: rep.ua }, screenshot_path: path || null }; }
export async function supaSend(cfg, rep, fetchFn = fetch) { const h = { apikey: cfg.key }; let path = null; const sb = shotBytes(rep.shot);
  if (sb && sb.bytes.length <= 3e6) { const name = `${rep.shotId || (rep.shotId = uuid())}.${sb.ext}`; const r = await fetchFn(`${cfg.url}/storage/v1/object/bug-shots/${name}`, { method: 'POST', headers: { ...h, 'content-type': sb.type, 'x-upsert': 'false' }, body: sb.bytes });
    if (r && (r.ok || r.status === 409)) path = name; /* the row still goes in without a picture if the upload is refused */ }
  const r2 = await fetchFn(`${cfg.url}/rest/v1/bug_reports`, { method: 'POST', headers: { ...h, 'content-type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(supaRow(rep, path)) });
  if (!r2 || !r2.ok) throw new Error('HTTP ' + (r2 ? r2.status : '?')); return true; }
export async function postReport(cfg, rep, fetchFn = fetch) { if (cfg.kind === 'supabase') return supaSend(cfg, rep, fetchFn); const r = await fetchFn(cfg.url, { method: 'POST', headers: { 'content-type': 'application/json', ...cfg.headers }, body: JSON.stringify(rep) }); if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : '?')); return true; }
export async function flushQueue({ cfg = loadCfg(), ls = store(), fetchFn = fetch } = {}) { if (!cfg) return { sent: 0, left: loadQueue(ls).length }; const q = loadQueue(ls); let sent = 0;
  while (q.length) { try { await postReport(cfg, q[0], fetchFn); q.shift(); sent++; saveQueue(q, ls); } catch (e) { break; } } saveQueue(q, ls); return { sent, left: q.length }; }
// shake: |a| above ~2.4 g three times inside 1.2 s, then a 3 s cool-down
export function shakeDetector(onShake, { thr = 24, n = 3, win = 1200, cool = 3000 } = {}) { let hits = [], last = -1e9;
  return (ax, ay, az, t) => { if (t - last < cool) return false; const m = Math.hypot(ax || 0, ay || 0, az || 0); if (m < thr) return false; hits = hits.filter(h => t - h < win); hits.push(t); if (hits.length >= n) { hits = []; last = t; onShake(); return true; } return false; }; }

export function createBugReporter({ build, getState, capture, toast = () => { } }) {
  const ls = store(); { const m = /[?&]bugcfg=([^&]+)/.exec(location.search); if (m) { try { const c = JSON.parse(decodeURIComponent(m[1])); if (c && c.url) ls && ls.setItem(CKEY, JSON.stringify(c)); } catch (e) { } } }
  const el = document.createElement('div'); el.id = 'bugCard'; el.className = 'hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Report a bug');
  el.innerHTML = `<div class="bgBox"><div class="bgH"><b>🐞 Report a bug</b><button class="bgX" aria-label="Close">✕</button></div>
    <div class="bgShot"><img alt="Screenshot of the game"><span class="bgNo">No screenshot</span><div class="bgSB"><button data-a="retake">↻ Retake</button><button data-a="drop">Remove</button></div></div>
    <textarea maxlength="2000" rows="3" placeholder="What went wrong? (optional)"></textarea>
    <div class="bgMeta"></div><div class="bgF"><button data-a="cancel">Cancel</button><button data-a="send" class="on">Send</button></div></div>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s), img = q('img'); let shot = null, state = {}, busy = false;
  const setShot = s => { shot = s; img.src = s || ''; el.classList.toggle('noShot', !s); };
  const grab = () => new Promise(res => { const was = !el.classList.contains('hidden'); if (was) el.style.visibility = 'hidden'; capture(s => { if (was) el.style.visibility = ''; res(s); }); });
  async function open() { if (busy) return; state = (() => { try { return getState() || {}; } catch (e) { console.warn('[Orbit Rush] bug state', e); return {}; } })(); setShot(await grab()); q('textarea').value = '';
    q('.bgMeta').textContent = `${build} · ${innerWidth}×${innerHeight} · ${[state.rocket, state.phase, state.alt != null ? 'alt ' + state.alt : '', state.speed != null ? state.speed : ''].filter(Boolean).join(' · ')}`; el.classList.remove('hidden'); }
  const close = () => el.classList.add('hidden');
  async function send() { if (busy) return; busy = true; const rep = makeReport({ note: q('textarea').value, build, state, shot }); const cfg = loadCfg(ls); let ok = false;
    if (cfg) { try { await postReport(cfg, rep); ok = true; } catch (e) { } }
    if (!ok) { const qq = loadQueue(ls); qq.push(rep); const kept = saveQueue(qq, ls); if (!kept || !loadQueue(ls).some(r => r.id === rep.id)) { const lite = { ...rep, shot: null }; const q2 = loadQueue(ls); q2.push(lite); saveQueue(q2, ls); } }
    busy = false; close(); toast(ok ? '🐞 Bug report sent — thank you' : '🐞 Bug report saved — it will send when reports are connected'); if (ok) flushQueue({ cfg, ls }).catch(() => { }); }
  el.addEventListener('click', e => { if (e.target === el) return close(); const a = e.target.closest('button'); if (!a) return; if (a.classList.contains('bgX') || a.dataset.a === 'cancel') close(); else if (a.dataset.a === 'retake') grab().then(setShot); else if (a.dataset.a === 'drop') setShot(null); else if (a.dataset.a === 'send') send(); });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
  // shake
  const det = shakeDetector(() => { if (el.classList.contains('hidden')) open(); }); let motionOn = false;
  const onMotion = e => { const a = e.accelerationIncludingGravity || e.acceleration; if (a) det(a.x, a.y, a.z, performance.now()); };
  function setShake(on) { if (on && !motionOn) { window.addEventListener('devicemotion', onMotion); motionOn = true; } else if (!on && motionOn) { window.removeEventListener('devicemotion', onMotion); motionOn = false; } try { ls && ls.setItem(SKEY, on ? '1' : '0'); } catch (e) { } }
  async function enableShake(on) { if (on && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { try { if (await DeviceMotionEvent.requestPermission() !== 'granted') { setShake(false); return false; } } catch (e) { setShake(false); return false; } } setShake(on); return on; }
  if (ls && ls.getItem(SKEY) === '1' && !(typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function')) setShake(true); // iOS needs a tap to re-grant, so it stays off until Settings
  // Settings block (injected whenever the settings body is rebuilt)
  const sb = document.getElementById('setBody'); const inject = () => { if (!sb || sb.querySelector('#bugSg')) return; const host = sb.querySelector('details.qMore') || sb.querySelector('.setGrid section') || sb; /* under More, so the phone Settings stays within its word budget */ const d = document.createElement('div'); d.className = 'sg'; d.id = 'bugSg';
    d.innerHTML = `<h4>Bug reports</h4><label><input type="checkbox" id="bugShake" ${motionOn ? 'checked' : ''}> Shake the phone to report a bug</label><button id="bugOpenS">🐞 Report a bug</button>`; host.appendChild(d);
    d.querySelector('#bugShake').onchange = async e => { e.target.checked = await enableShake(e.target.checked); }; d.querySelector('#bugOpenS').onclick = () => { const st = document.getElementById('settings'); st && st.classList.add('hidden'); open(); }; };
  if (sb) { new MutationObserver(inject).observe(sb, { childList: true }); inject(); }
  setTimeout(() => flushQueue({ ls }).catch(() => { }), 4000);
  return { open, close, send, el, queue: () => loadQueue(ls), flush: () => flushQueue({ ls }), setShake: enableShake, get shot() { return shot; } };
}
