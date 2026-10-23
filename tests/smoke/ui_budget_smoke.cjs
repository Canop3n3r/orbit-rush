// UI budget smoke (Playtest QA Bot) — step 1 of playtest/ui_ideal_path_2026-10-20.md (sections 6 + 8).
//   node tests/smoke/ui_budget_smoke.cjs [baseUrl] [--report] [--vp 390x844,844x390] [--shots dir] [--json out.json]
// Per screen it measures controls / words / UI coverage (and taps open→liftoff) and compares them with the spec budgets.
// Counting rules = playtest/ui_audit_menus.cjs: only controls/text that are topmost at their centre count; UI% = 8 px grid
// of points whose topmost element has an opaque-ish surface (or is a control). Default = report-only (always exit 0,
// prints PASS/FAIL per budget). f5.1h: picker_group_words + builder_gated measured on the grouped picker (#picker, Sandbox switch). --strict exits 1 if fewer budgets pass than the ratchet baseline (UI_BASELINE, default 57 since QA f5.7c). Needs playwright-core (PW_CORE=) + Chrome (CHROME=).
const PW = process.env.PW_CORE || (() => { try { return require.resolve('playwright-core'); } catch (e) { return '/workspace/pwt/node_modules/playwright-core'; } })();
const { chromium } = require(PW);
const args = process.argv.slice(2), flag = k => { const i = args.indexOf(k); return i >= 0 ? (args.splice(i, 1), true) : false; };
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
const report = flag('--report'), strict = flag('--strict') || !report, /* f5.6z (QA f5.6x): --strict (ratchet at UI_BASELINE 43) is the default; --report = report-only */ shots = opt('--shots'), jsonOut = opt('--json');
const vps = (opt('--vp') || '390x844,844x390').split(',');
const base = args[0] || 'https://canop3n3r.github.io/orbit-rush/';
const GPU = ['--use-angle=swiftshader', '--ignore-gpu-blocklist'];

// Budgets (spec section 6). ui = [phone, desktop] max UI%. null = not budgeted.
const B = {
  first_run:    { controls: 5, words: 3, ui: [12, 8], note: '0 extra screens: must already be Home' },
  home:         { controls: 5, words: 3, ui: [12, 8] },
  settings:     { controls: 8, words: 30, ui: [70, 70] },
  build:        { controls: 14, words: 12, ui: [35, 25], below: 0 },
  hud_auto:     { controls: 5, words: 6, ui: [10, 6] },
  orbit_toast:  { words: 5, ui: [6, 6] },
  map:          { controls: 6, words: 10, ui: [10, 6] },
  photo:        { controls: 3, words: 0, ui: [8, 8] },
  end_card:     { controls: 3, words: 6, ui: [15, 10] },
};

/* f5.7m (QA f5.7j P2): split ui% the way the walk counts it: pointer-events:none HUD and the canvas-drawn inset pane both count */
const SPLIT_ON = () => { const st = document.createElement('style'); st.id = 'uibSplit'; st.textContent = '*{pointer-events:auto!important} #spPane{background:rgba(0,0,0,.3)!important}'; document.head.appendChild(st); };
const SPLIT_OFF = () => { const st = document.getElementById('uibSplit'); st && st.remove(); };
/* QA f5.7m: poll up to 8 s for the readout to change (SwiftShader at ~1 fps can skip a 700 ms window, which made this row flip on the same build) */
const navLive = async (ev, w) => { const rd = () => ev(() => { const n = document.getElementById('nav'), t = n ? n.textContent : ''; const r = n ? n.getBoundingClientRect() : { width: 0 }; return { vis: r.width > 20 && getComputedStyle(n).display !== 'none', t }; }); const a = await rd(); await ev(() => { const F = window.__game.F; for (let i = 0; i < 120; i++) F.advance(1 / 60); }); let b = await rd(); for (let k = 0; k < 16 && a.vis && b.vis && a.t === b.t; k++) { await w(500); b = await rd(); } return a.vis && b.vis && a.t !== b.t; };
function measure() {
  const top = e => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; { const d = e.closest('details:not([open])'); if (d && !e.closest('summary')) return false; } /* f5.7n: folded <details> content is not on screen */ if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2)); const h = document.elementFromPoint(x, y); return h && (h === e || e.contains(h) || (h.contains(e) && h !== document.body && h !== document.documentElement && getComputedStyle(e).visibility !== 'hidden')); }; /* f5.7n: a point landing on <body> (behind a sheet / hidden layer) does not count everything under it */
  const ctl = [...document.querySelectorAll('button,select,input,a[href],[role=button]')].filter(top);
  const below = [...document.querySelectorAll('button,select,input')].filter(e => { const r = e.getBoundingClientRect(); if (!r.width) return false; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden') return false; } return r.top >= innerHeight; }).length;
  let words = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const e = n.parentElement; if (!e || /SCRIPT|STYLE|OPTION/.test(e.tagName) || !top(e)) continue; words += (n.textContent.match(/[A-Za-z0-9][\w'.:%/-]*/g) || []).length; }
  const solid = e => { for (let p = e; p && p !== document.body; p = p.parentElement) { if (p.tagName === 'CANVAS') return false; const c = getComputedStyle(p), r = p.getBoundingClientRect(); const full = r.width * r.height > innerWidth * innerHeight * 0.9; const bg = c.backgroundColor.match(/[\d.]+/g); const a = bg ? (bg.length > 3 ? +bg[3] : 1) : 0; if ((a > 0.15 || c.backgroundImage !== 'none' || c.backdropFilter !== 'none') && !(full && a < 0.5 && c.backdropFilter === 'none')) return true; if (/BUTTON|INPUT|SELECT/.test(p.tagName)) return true; } return false; };
  let ui = 0, tot = 0; for (let y = 4; y < innerHeight; y += 8) for (let x = 4; x < innerWidth; x += 8) { tot++; const e = document.elementFromPoint(x, y); if (e && solid(e)) ui++; }
  const fr = document.getElementById('frSb'); const modal = [...document.querySelectorAll('.modal')].some(m => !m.classList.contains('hidden') && m.offsetParent) || !!(fr && fr.offsetParent);
  return { controls: ctl.length, belowFold: below, words, uiPct: Math.round(1000 * ui / tot) / 10, modal };
}

// Spec-gap checks (ideal path rev 2): end card vs HUD/rocket, LAUNCH size + thumb zone, company-group label words, Sandbox gate.
// The flight camera isn't exposed on window.__game, so the rocket's screen centre is approximated by the viewport centre
// (chase cam keeps the vehicle centred); swap in a projected point once __game exposes one (__game.rocketScreen?.()).
function extra() {
  const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; for (let p = e; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; } return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
  const top = e => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return h && (h === e || e.contains(h)); };
  const G = window.__game; let rc = null; try { rc = G && G.rocketScreen && G.rocketScreen(); } catch (e) {}
  const rocket = rc && isFinite(rc.x) ? { x: rc.x, y: rc.y, src: 'projected' } : { x: innerWidth / 2, y: innerHeight / 2, src: 'viewport-centre' };
  const end = document.getElementById('end'); let endUp = vis(end), endCover = null;
  if (endUp) { const r = end.getBoundingClientRect(); endCover = rocket.x >= r.left && rocket.x <= r.right && rocket.y >= r.top && rocket.y <= r.bottom; }
  // touch HUD lives in #mob (#mtop/#mleft/#mright); count a control if it's visible and not covered by another surface (same
  // rule as measure(): the hit element may be the control's own container when HUD controls go pointer-events:none)
  const hudSel = '#hud button,#touch button,#warpBar button,#ctl button,#navball,#bars,#tele,#mtop button,#mleft,#mright button,#mThr,#mWarp,#mMap,#mStage,#mAuto,#mChute';
  const shown = e => { if (top(e)) return true; const r = e.getBoundingClientRect(); const h = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!h && h.contains(e); };
  const hudVis = [...new Set(document.querySelectorAll(hudSel))].filter(e => vis(e) && shown(e)).map(e => (e.id || e.textContent.trim().split(/\s+/)[0] || e.tagName).slice(0, 10));
  const L = ['hLaunch', 'launch', 'hFly', 'launchBtn'].map(i => document.getElementById(i)).find(vis); let launch = null;
  if (L) { const r = L.getBoundingClientRect(); launch = { id: L.id, h: Math.round(r.height), cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  // f5.1h: the grouped rocket picker (#picker, f5.1f) labels each launch house with a section heading (<h4>) — that is the company group label
  const groups = [...document.querySelectorAll('[data-company],.co-chip,.company-chip,#picker section > h4')].filter(vis).map(e => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim(), w: ((e.textContent || '').match(/[A-Za-z0-9][\w'.:%/-]*/g) || []).length }));
  const builder = ['hnBuild', 'buildBtn', 'builder', 'pkBuild'].map(i => document.getElementById(i)).filter(vis).map(e => e.id); // pkBuild = the picker's '🔧 Build your own' (Sandbox only)
  const st = G && G.settings || {}; const sbKey = Object.keys(st).find(k => /sandbox/i.test(k));
  const sbUi = [...document.querySelectorAll('label,[role=switch],input[type=checkbox]')].some(e => vis(e) && /sandbox/i.test(e.textContent || e.getAttribute('aria-label') || e.name || e.id || '')); // a settings toggle, not the welcome modal's "Sandbox — just let me fly" button
  // f5.1g: Sandbox is a switch in the picker header (#pkSandbox, role=switch) stored in localStorage 'orbitrush.sandbox', not a settings key
  const sw = document.getElementById('pkSandbox'); let ls = null; try { ls = localStorage.getItem('orbitrush.sandbox'); } catch (e) {}
  const sbPk = sw ? { key: 'pkSandbox', on: sw.getAttribute('aria-checked') === 'true' } : null;
  return { endUp, endCover, hudVis, rocketSrc: rocket.src, launch, W: innerWidth, H: innerHeight, groups, builder, sandbox: sbKey ? { key: sbKey, on: !!st[sbKey] } : sbPk || (sbUi ? { key: 'ui', on: null } : null), sandboxLS: ls };
}

const browser2 = (br, phone, W, H) => br.newContext(phone ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: W, height: H } });
async function runVp(br, vp) {
  const [W, H] = vp.split('x').map(Number), phone = Math.min(W, H) < 600, tag = phone ? (W < H ? 'pp' : 'pl') : 'd' + W;
  const ctx = await br.newContext(phone ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: W, height: H } });
  const pg = await ctx.newPage(); const ev = (f, a) => pg.evaluate(f, a), wait = ms => pg.waitForTimeout(ms); const M = {}, rows = [];
  // f5.3b7 (QA): a page error (e.g. f5.3b7 'payloadT is not defined' when ▦ renders the picker) used to pass silently; now a row
  const perrs = []; pg.on('pageerror', e => perrs.push(e.message.split('\n')[0]));
  // f5.1d: modals/end card fade in with CSS animations (fUp/fPop, 0.22-0.3 s) that take >1.5 s at software-GPU frame rates, so the
  // evidence screenshot showed the screen underneath at opacity 0; finish those entry animations first (counts were already right).
  const settle = () => ev(() => { for (const a of document.getAnimations()) if (/^(fUp|fPop)$/.test(a.animationName || '')) try { a.finish(); } catch (e) {} });
  const m = async l => { try { await settle(); M[l] = await ev(measure); M[l].x = await ev(extra); if (shots) await pg.screenshot({ path: `${shots}/uib_${tag}_${l}.png` }); } catch (e) { M[l] = { err: e.message.split('\n')[0] }; } };
  const hide = () => ev(() => document.querySelectorAll('.modal').forEach(x => x.classList.add('hidden')));
  const step = async (l, f, ms) => { try { await f(); await wait(ms); await m(l); } catch (e) { M[l] = { err: e.message.split('\n')[0] }; } };
  const load = async () => { await pg.goto(base, { waitUntil: 'load' }); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await wait(2500); };

  // taps open→liftoff (fresh storage): tap the most "go" control on screen each step, real taps, until liftoff (≤6 taps, 10 s/step)
  await load();
  let taps = 0, path = [];
  try {
    for (; taps < 6;) {
      const up = await ev(() => { const F = window.__game.F; return !!(F && (F.flags.liftoff || (F.alt || 0) > 20)); }); if (up) break;
      const sel = await ev(() => { const vis = e => e && e.offsetParent && (() => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h && (h === e || e.contains(h)); })();
        const ids = ['frSb', 'hLaunch', 'hFly', 'launchBtn']; for (const i of ids) if (vis(document.getElementById(i))) return '#' + i;
        const st = [...document.querySelectorAll('button')].find(b => /^\s*(STAGE|LAUNCH|IGNITE)/i.test(b.textContent) && vis(b)); if (st) { st.setAttribute('data-uib', st.textContent.trim().split(/\s+/)[0]); return '[data-uib]'; } return null; });
      if (!sel) break; const b = await pg.$(sel); const bx = await b.boundingBox(); phone ? await pg.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2) : await pg.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2);
      taps++; path.push(sel === '[data-uib]' ? await ev(() => document.querySelector('[data-uib]').getAttribute('data-uib')) : sel); await ev(() => { const e = document.querySelector('[data-uib]'); e && e.removeAttribute('data-uib'); });
      await pg.waitForFunction(() => { const F = window.__game.F; return F && (F.flags.liftoff || (F.alt || 0) > 20); }, null, { timeout: 4000 }).catch(() => {});
    }
  } catch (e) { path.push('ERR ' + e.message.split('\n')[0]); }
  const lifted = await ev(() => { const F = window.__game.F; return !!(F && (F.flags.liftoff || (F.alt || 0) > 20)); }).catch(() => false);

  // screens (same flow as playtest/ui_audit_menus.cjs + ui_audit.cjs), fresh storage
  await ctx.clearCookies(); await ev(() => localStorage.clear()); await load();
  await m('first_run');
  // f5.1c: the welcome's #frSb is "🚀 Fly now" (launches), so close the welcome without launching to measure Home; taps_to_liftoff above still taps #frSb for real
  await step('home', async () => { await ev(() => { const fr = document.getElementById('firstRun'); if (fr) fr.classList.add('hidden'); const b = document.getElementById('frSb'); if (b && b.offsetParent && !/fly now/i.test(b.textContent)) b.click(); for (const s of ['#acClose', '#lessonSkip']) { const c = document.querySelector(s); c && c.offsetParent && c.click(); } }); await hide(); }, 1000);
  // f5.1f: the grouped rocket picker (▦ #hPick on Home). Measured for the picker_group_words + builder_gated checks (no budget row of its own yet)
  await step('picker', async () => { await ev(() => { const b = document.getElementById('hPick'); if (b) b.click(); }); }, 1200);
  const pickerCards = await ev(() => [...document.querySelectorAll('#picker .pkC')].filter(e => e.offsetParent).length).catch(() => 0); // f5.3b7: did ▦ actually open the picker?
  await ev(() => { const c = document.getElementById('pkClose'); c && c.offsetParent && c.click(); });
  await step('settings', async () => { await ev(() => document.getElementById('hGear').click()); await wait(600); await ev(() => { const b = [...document.querySelectorAll('#hGearM button')].find(b => /settings/i.test(b.textContent)); b && b.click(); }); }, 1000);
  // f5.1f: the Build tab only shows with Sandbox on; otherwise go the real way: ▦ picker → Sandbox switch → 🔧 Build your own
  /* f5.7q (QA f5.7n): site picker chips at normal height */
  const XR = {}; try { const has = await ev(() => { const b = document.getElementById('hSite'); if (!b) return false; b.click(); return true; }); if (has) { await wait(900); XR.site = await ev(() => { const bs = [...document.querySelectorAll('#sitePick .spBodies button')].filter(b => b.offsetWidth); const sp = [...document.querySelectorAll('#sitePick .spSites button')].filter(b => b.offsetWidth); return { maxH: bs.length ? Math.round(Math.max(...bs.map(b => b.getBoundingClientRect().height))) : null, below: sp.filter(b => b.getBoundingClientRect().bottom > innerHeight).length }; }); if (shots) await pg.screenshot({ path: `${shots}/uib_${tag}_sites.png` }); await ev(() => { const x = document.querySelector('#sitePick .spX'); x && x.click(); }); await wait(500); } } catch (e) { XR.site = { err: e.message.split('\n')[0] }; }
  await step('build', async () => { await hide(); const tab = await ev(() => { const b = document.getElementById('hnBuild'); return !!(b && b.offsetParent); });
    if (tab) await ev(() => document.getElementById('hnBuild').click());
    else { await ev(() => document.getElementById('hPick').click()); await wait(800); await ev(() => document.getElementById('pkSandbox').click()); await wait(800); await ev(() => document.getElementById('pkBuild').click()); } }, 2500);
  try { XR.rows = await ev(() => [...document.querySelectorAll('#stack .prow')].filter(r => { const b = r.getBoundingClientRect(); if (b.height < 4 || b.top < 0 || b.bottom > innerHeight) return false; const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return h && h.closest('.prow') === r; }).length); } catch (e) { }
  // f5.1d: Home now opens on Pip (sounding rocket, can't orbit), so hud_auto → end_card measured a crash; pick the first orbital
  // showroom rocket (Sparrow-1 'needle', else index 1) before FLY, and only press Space if FLY didn't already ignite (1-tap AUTO).
  await step('hud_auto', async () => { await hide(); await ev(() => document.getElementById('homeBack').click()); await wait(800);
    await ev(() => { const G = window.__game, L = G.home ? G.home().list : []; const i = L.findIndex(r => r.id === 'needle'); G.homeSet && G.homeSet(i >= 0 ? i : 1); }); await wait(800);
    await ev(() => document.getElementById('hFly').click()); await wait(3000);
    await ev(() => { const G = window.__game; if (!G.F.ignited) G.press('Space'); }); await wait(300); await ev(() => { const F = window.__game.F; F.setAuto(true); for (let i = 0; i < 60 * 40; i++) F.advance(1 / 60); }); }, 2500);
  await step('orbit_toast', () => ev(() => { const F = window.__game.F; for (let i = 0; i < 60 * 900 && !F.flags.orbit; i++) F.advance(1 / 60); }), 1500);
  await step('map', async () => { await wait(3000); await hide(); await ev(() => { const e = document.getElementById('end'); e && e.classList.add('hidden'); window.__game.press('KeyM'); }); }, 2500); // orbit popup may land late; the map budget is measured without it
  try { XR.map = await ev(() => { const u = document.getElementById('mapUI'); return u ? u.innerText : ''; }); } catch (e) { }
  await step('photo', async () => { await ev(() => window.__game.press('KeyM')); await wait(400); await ev(() => window.__game.fun.photo.toggle()); }, 1500);
  await step('end_card', async () => { await ev(() => { window.__game.fun.photo.toggle(); window.__game.F.deorbit(); }); await wait(300); await ev(() => { const F = window.__game.F; for (let i = 0; i < 60 * 2700 && !F.flags.recovered && !F.flags.dead; i++) F.advance(1 / 60); }); await wait(1500);
    await ev(() => { const F = window.__game.F, e = document.getElementById('end'); if (e && (F.flags.recovered || F.flags.dead)) e.classList.remove('hidden'); }); }, 2500); // undo the map-step hide
  await ctx.close();
  // f5.6z (QA f5.6x proposal): orbit split + orbit end card. Heron-9 (swift) on AUTO: the split while the booster lands / at orbit
  // (upper card has Ap/Pe/Δv, one LANDED, no "ALT 0 ft"), then RELEASE → End flight → the orbit end card (no live HUD behind it).
  const OS = {}; { const c2 = await browser2(br, phone, W, H), p2 = await c2.newPage(); p2.on('pageerror', e => perrs.push(e.message.split('\n')[0])); const ev2 = f => p2.evaluate(f), w2 = ms => p2.waitForTimeout(ms);
    try { await p2.goto(base + (base.includes('?') ? '&' : '?') + 'noacademy&fx=low', { timeout: 300000 }); await p2.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await w2(1500);
      await ev2(() => { const fr = document.getElementById('firstRun'); fr && fr.classList.add('hidden'); const G = window.__game, i = G.home().list.findIndex(r => r.id === 'swift'); G.homeSet(i); }); await w2(800);
      await ev2(() => document.getElementById('hFly').click()); await w2(2500); await ev2(() => { const G = window.__game; G.press('KeyF'); if (!G.F.ignited) G.press('Space'); }); await w2(800);
      /* f5.7j (QA f5.7i): split view during ascent, 20 s after staging: booster inset + the normal big upper HUD */
      if (await ev2(() => { const F = window.__game.F; for (let i = 0; i < 60 * 900; i++) { F.advance(1 / 60); if (F.booster && F.booster.state === 'flying') { for (let j = 0; j < 60 * 20; j++) F.advance(1 / 60); return true; } } return false; })) { await w2(900);
        OS.units = await ev2(() => { let u = 'imperial'; try { u = (JSON.parse(localStorage.getItem('orbitrush.settings.v1') || 'null') || {}).units || 'imperial'; } catch (e) { } const t = ['plain', 'nav', 'strip', 'strip2', 'spCardB', 'mhud'].map(id => { const e = document.getElementById(id); return e && e.offsetWidth ? e.innerText : ''; }).join(' '); const bad = u === 'metric' ? /\b(mph|mi|ft|ft\/s)\b/ : /\b(km|km\/h|m\/s|km\/s)\b/; return { u, bad: (t.match(bad) || [null])[0] }; });
        await ev2(SPLIT_ON); OS.asc = await ev2(measure); await ev2(SPLIT_OFF); OS.asc.navLive = await navLive(ev2, w2); OS.asc.big = await ev2(() => { const v = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 20 && cs.display !== 'none' && cs.visibility !== 'hidden'; }; return (v('plain') || v('mhud')) && v('nav'); });
        if (shots) await p2.screenshot({ path: `${shots}/uib_${tag}_ascent_split.png`, timeout: 180000 }); }
      const at = await ev2(() => { const F = window.__game.F; for (let i = 0; i < 60 * 1500; i++) { F.advance(1 / 60); if (F.booster && F.booster.state === 'landed') return 'booster landed'; if (F.flags.orbit && F.booster && F.booster.state === 'flying') return 'orbit'; } return 'timeout'; }); await w2(600);
      OS.split = await ev2(() => { const sp = document.getElementById('split'), on = !!sp && !sp.classList.contains('hidden'), t = on ? sp.textContent : '', u = (document.getElementById('spHud1R') || {}).textContent || '';
        return { on, upper: (/Ap/.test(u) && /Δv/.test(u)) || document.body.classList.contains('pip') /* f5.7j: inset layout keeps the main HUD */, landed: (t.match(/LANDED/g) || []).length, alt0: /ALT\s*-?0 ft/.test(t) }; }); OS.split.at = at;
      if (shots) await p2.screenshot({ path: `${shots}/uib_${tag}_orbit_split.png`, timeout: 180000 });
      await ev2(() => { const F = window.__game.F; for (let i = 0; i < 60 * 1500 && !(F.flags.orbit && F.v.guid === 'done'); i++) F.advance(1 / 60); }); await w2(100);
      // f5.7c QA: RELEASE must stay put while the landed booster's pane closes (it jumped ~250 px, so a real tap at that moment missed:
      // QA f5.7c rubric 390/844 lost the payload), and a real tap (touch on phone) on it must release the payload.
      const rel = () => ev2(() => { const b = document.getElementById('relBtn'), sp = document.getElementById('split'); if (!b || b.classList.contains('hidden')) return null; const r = b.getBoundingClientRect(); if (r.width < 2) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: b.textContent, split: !!sp && !sp.classList.contains('hidden') && sp.getBoundingClientRect().width > 1, released: !!window.__game.F.released }; });
      let r0 = null, r1 = null; for (let k = 0; k < 40; k++) { const r = await rel(); if (r && !r0) r0 = r; if (r) r1 = r; if (r0 && r && !r.split && (r0.split || k > 12)) break; await w2(150); } /* f5.7e: also measured when the pane already closed before orbit (RELEASE must still not move) */ await w2(1000); r1 = (await rel()) || r1;
      OS.relMove = r0 && r1 ? { px: Math.round(Math.hypot(r1.x - r0.x, r1.y - r0.y)), from: [Math.round(r0.x), Math.round(r0.y)], to: [Math.round(r1.x), Math.round(r1.y)], split0: r0.split, split1: r1.split } : null;
      if (r1 && /RELEASE/.test(r1.t)) { if (phone) await p2.touchscreen.tap(r1.x, r1.y); else await p2.mouse.click(r1.x, r1.y); await w2(1200); OS.relTap = await ev2(() => !!window.__game.F.released); }
      await ev2(() => { const b = document.getElementById('relBtn'); b && /RELEASE/.test(b.textContent) && b.click(); }); await w2(1200); await ev2(() => { const b = document.getElementById('relBtn'); b && /End flight/i.test(b.textContent) && b.click(); }); await w2(3000);
      await ev2(() => { const e = document.getElementById('end'); if (e && e.classList.contains('hidden')) window.__game.press('Escape'); }); await w2(500);
      await p2.evaluate(() => { for (const a of document.getAnimations()) try { a.finish(); } catch (e) {} });
      OS.end = await ev2(measure); OS.end.x = await ev2(extra); if (shots) await p2.screenshot({ path: `${shots}/uib_${tag}_end_card_orbit.png`, timeout: 180000 });
    } catch (e) { OS.err = e.message.split('\n')[0]; } finally { await c2.close(); } }

  // f5.7m (QA f5.7j): Heron Heavy (two side boosters) must get the same inset + big HUD
  let HV = null; { const c3 = await browser2(br, phone, W, H), p3 = await c3.newPage(); p3.on('pageerror', e => perrs.push(e.message.split('\n')[0])); const ev3 = f => p3.evaluate(f), w3 = ms => p3.waitForTimeout(ms);
    try { await p3.goto(base + (base.includes('?') ? '&' : '?') + 'noacademy&fx=low', { timeout: 300000 }); await p3.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await w3(1500);
      const ok = await ev3(() => { const fr = document.getElementById('firstRun'); fr && fr.classList.add('hidden'); const G = window.__game, i = G.home().list.findIndex(r => /heavy/i.test(r.id + ' ' + (r.name || ''))); if (i < 0) return false; G.homeSet(i); return true; });
      if (!ok) HV = { err: 'no Heavy on home' }; else { await w3(800); await ev3(() => document.getElementById('hFly').click()); await w3(2500); await ev3(() => { const G = window.__game; G.press('KeyF'); if (!G.F.ignited) G.press('Space'); }); await w3(800);
        const st = await ev3(() => { const F = window.__game.F; for (let i = 0; i < 60 * 900; i++) { F.advance(1 / 60); if (F.booster && F.booster.state === 'flying') { for (let j = 0; j < 60 * 20; j++) F.advance(1 / 60); return true; } } return false; }); await w3(900);
        if (!st) HV = { err: 'no staging' }; else { await ev3(SPLIT_ON); HV = await ev3(measure); await ev3(SPLIT_OFF); Object.assign(HV, await ev3(() => { const v = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 20 && cs.display !== 'none' && cs.visibility !== 'hidden'; }; return { pip: document.body.classList.contains('pip'), big: (v('plain') || v('mhud')) && v('nav') }; }));
          HV.navLive = await navLive(ev3, w3); if (shots) await p3.screenshot({ path: `${shots}/uib_${tag}_heavy_split.png`, timeout: 180000 }); } }
    } catch (e) { HV = { err: e.message.split('\n')[0] }; } finally { await c3.close(); } }
  const di = phone ? 0 : 1;
  const chk = (screen, metric, val, max) => rows.push({ vp, screen, metric, val, max, ok: val != null && val <= max });
  for (const [s, b] of Object.entries(B)) { const r = M[s]; if (!r || r.err) { rows.push({ vp, screen: s, metric: 'measure', val: r ? r.err : 'missing', max: '-', ok: false }); continue; }
    if (b.controls != null) chk(s, 'controls', r.controls, b.controls); if (b.words != null) chk(s, 'words', r.words, b.words);
    if (b.ui) chk(s, 'ui%', r.uiPct, b.ui[di]); if (b.below != null) chk(s, 'belowFold', r.belowFold, b.below);
    if (s === 'first_run') rows.push({ vp, screen: s, metric: 'welcome', val: r.modal ? 'yes' : 'no', max: 'no', ok: !r.modal }); }
  // --- spec-gap checks (rev 2). ok:null = SKIP (counted separately, never a FAIL).
  const X = s => M[s] && M[s].x; const skip = (screen, metric, why) => rows.push({ vp, screen, metric, val: 'SKIP', max: '-', ok: null, info: why });
  const e = X('end_card');
  if (!e || !e.endUp) skip('end_card', 'hud_hidden', 'end card not visible'); else {
    rows.push({ vp, screen: 'end_card', metric: 'hud_hidden', val: e.hudVis.length, max: 0, ok: e.hudVis.length === 0, info: e.hudVis.slice(0, 6).join(',') });
    rows.push({ vp, screen: 'end_card', metric: 'over_rocket', val: e.endCover ? 'yes' : 'no', max: 'no', ok: !e.endCover, info: 'rocket@' + e.rocketSrc }); }
  if (!OS.units) skip('hud_units', 'match', 'no split'); else rows.push({ vp, screen: 'hud_units', metric: 'match_setting', val: OS.units.bad || 'ok', max: 'ok', ok: !OS.units.bad, info: OS.units.u });
  if (XR.map == null) skip('map', 'units', 'no map text'); else { const bad = /\b(km|m\/s|km\/s)\b/.exec(XR.map); rows.push({ vp, screen: 'map', metric: 'units', val: bad ? bad[0] : 'ok', max: 'ok', ok: !bad }); }
  if (!XR.site || XR.site.err || XR.site.maxH == null) skip('sites', 'chip_h', XR.site && XR.site.err || 'no site picker'); else { chk('sites', 'chip_h', XR.site.maxH, 52); chk('sites', 'pads_below', XR.site.below, 0); }
  if (phone) { if (XR.rows == null) skip('build', 'rows_visible', 'not measured'); else rows.push({ vp, screen: 'build', metric: 'rows_visible', val: XR.rows, max: '≥' + (W < H ? 5 : 3), ok: XR.rows >= (W < H ? 5 : 3) }); }
  if (!OS.asc) skip('ascent_split', 'ui%', 'no split during ascent'); else { chk('ascent_split', 'ui%', OS.asc.uiPct, 30); chk('ascent_split', 'controls', OS.asc.controls, 16);
    rows.push({ vp, screen: 'ascent_split', metric: 'big_upper_hud', val: OS.asc.big ? 'yes' : 'no', max: 'yes', ok: OS.asc.big }); rows.push({ vp, screen: 'ascent_split', metric: 'navball_live', val: OS.asc.navLive ? 'yes' : 'no', max: 'yes', ok: OS.asc.navLive }); }
  if (!HV || HV.err) rows.push({ vp, screen: 'heavy_split', metric: 'measure', val: HV ? HV.err : 'missing', max: '-', ok: false }); else { rows.push({ vp, screen: 'heavy_split', metric: 'pip', val: HV.pip ? 'yes' : 'no', max: 'yes', ok: HV.pip }); rows.push({ vp, screen: 'heavy_split', metric: 'big_upper_hud', val: HV.big ? 'yes' : 'no', max: 'yes', ok: HV.big }); chk('heavy_split', 'ui%', HV.uiPct, 30); rows.push({ vp, screen: 'heavy_split', metric: 'navball_live', val: HV.navLive ? 'yes' : 'no', max: 'yes', ok: HV.navLive }); }
  if (OS.err || !OS.split) rows.push({ vp, screen: 'orbit_split', metric: 'measure', val: OS.err || 'missing', max: '-', ok: false });
  else if (!OS.split.on) skip('orbit_split', 'upper_card', `split closed at ${OS.split.at}`);
  else { rows.push({ vp, screen: 'orbit_split', metric: 'upper_card', val: OS.split.upper ? 'yes' : 'no', max: 'yes', ok: OS.split.upper, info: OS.split.at });
    rows.push({ vp, screen: 'orbit_split', metric: 'landed_x', val: OS.split.landed, max: 1, ok: OS.split.landed <= 1 });
    rows.push({ vp, screen: 'orbit_split', metric: 'alt_0ft', val: OS.split.alt0 ? 'yes' : 'no', max: 'no', ok: !OS.split.alt0 }); }
  if (!OS.relMove) skip('orbit_release', 'stays_put', 'RELEASE never seen while the split was open'); else rows.push({ vp, screen: 'orbit_release', metric: 'stays_put', val: OS.relMove.px, max: 24, ok: OS.relMove.px <= 24, info: `px moved ${OS.relMove.from}→${OS.relMove.to} (split ${OS.relMove.split0 ? 'on' : 'off'}→${OS.relMove.split1 ? 'on' : 'off'})` });
  if (OS.relTap == null) skip('orbit_release', 'real_tap', 'no RELEASE to tap'); else rows.push({ vp, screen: 'orbit_release', metric: 'real_tap', val: OS.relTap ? 'yes' : 'no', max: 'yes', ok: OS.relTap, info: (phone ? 'touchscreen' : 'mouse') + ' tap → payload released' });
  if (!OS.end || !OS.end.x || !OS.end.x.endUp) rows.push({ vp, screen: 'end_card_orbit', metric: 'shown', val: 'no', max: 'yes', ok: false, info: OS.err || 'RELEASE → End flight gave no end card' });
  else { chk('end_card_orbit', 'controls', OS.end.controls, 3); chk('end_card_orbit', 'words', OS.end.words, 6);
    rows.push({ vp, screen: 'end_card_orbit', metric: 'hud_hidden', val: OS.end.x.hudVis.length, max: 0, ok: OS.end.x.hudVis.length === 0, info: OS.end.x.hudVis.slice(0, 6).join(',') }); }
  const h = X('home');
  if (!h || !h.launch) rows.push({ vp, screen: 'home', metric: 'launch', val: 'none', max: '-', ok: false, info: 'no LAUNCH/FLY control visible' }); else {
    const portrait = h.H > h.W, inZone = portrait ? h.launch.cy >= h.H * 0.75 : (h.launch.cy >= h.H * 0.5 && h.launch.cx >= h.W * 0.5);
    rows.push({ vp, screen: 'home', metric: 'launch_h', val: h.launch.h, max: '≥64', ok: h.launch.h >= 64, info: '#' + h.launch.id });
    rows.push({ vp, screen: 'home', metric: 'thumb_zone', val: inZone ? 'in' : 'out', max: 'in', ok: inZone, info: portrait ? 'bottom 25%' : 'bottom-right quadrant' }); }
  const gs = ['home', 'picker', 'build'] /* f5.6e: missions_hub retired (no Missions UI) */.flatMap(s => (X(s) && X(s).groups || []).map(g => ({ s, ...g })));
  if (!gs.length) skip('picker', 'group_words', 'no company groups in UI yet ([data-company]/.co-chip)');
  else { const worst = gs.reduce((a, b) => (b.w > a.w ? b : a)); rows.push({ vp, screen: 'picker', metric: 'group_words', val: worst.w, max: 2, ok: worst.w <= 2, info: `${gs.length} groups; worst "${worst.t.slice(0, 24)}" on ${worst.s}` }); }
  const sb = ['settings', 'picker'].map(s => X(s) && X(s).sandbox).find(Boolean), hb = X('home'), pb = X('picker');
  const gated = [...(hb ? hb.builder : []), ...(pb ? pb.builder : [])];
  if (!sb) skip('home', 'builder_gated', 'no Sandbox setting yet' + (hb && hb.builder.length ? ` (builder open on home: ${hb.builder.join(',')})` : ''));
  else if (sb.on === false || sb.on === null) rows.push({ vp, screen: 'home', metric: 'builder_gated', val: gated.length, max: 0, ok: gated.length === 0, info: `Sandbox off (${sb.key}); visible on home+picker: ${gated.join(',') || 'none'}` });
  else skip('home', 'builder_gated', 'Sandbox is on in this profile');
  rows.push({ vp, screen: 'picker', metric: 'opens', val: pickerCards, max: '≥1', ok: pickerCards >= 1, info: 'rocket cards visible after ▦ (#hPick)' });
  rows.push({ vp, screen: 'page', metric: 'errors', val: perrs.length, max: 0, ok: perrs.length === 0, info: [...new Set(perrs)].slice(0, 2).join(' | ') });
  rows.push({ vp, screen: 'taps_to_liftoff', metric: 'taps(fresh)', val: lifted ? taps : `>${taps}`, max: 2, ok: lifted && taps <= 2, info: path.join(' → ') });
  return { vp, metrics: M, taps: { taps, lifted, path }, rows };
}

(async () => {
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  const all = []; for (const vp of vps) all.push(await runVp(br, vp)); await br.close();
  const rows = all.flatMap(a => a.rows); let fails = 0, skips = 0;
  console.log(`UI budget smoke · ${base} · ${strict ? 'STRICT' : 'report-only'}`);
  for (const r of rows) { if (r.ok === null) skips++; else if (!r.ok) fails++; console.log(`${r.ok === null ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'}  ${r.vp.padEnd(8)} ${r.screen.padEnd(16)} ${r.metric.padEnd(12)} ${String(r.val).padStart(6)} / ${/^[≥a-z-]/.test(String(r.max)) ? "" : "≤"}${r.max}${r.info ? '  ' + r.info : ''}`); }
  console.log(`${rows.length - fails - skips}/${rows.length - skips} budgets pass (${skips} skipped)`);
  if (jsonOut) require('fs').writeFileSync(jsonOut, JSON.stringify(all, null, 1));
  // f5.6h (QA ratchet): --strict fails only below the baseline pass count (43 of 74 on f5.6f); raise BASELINE as rows get fixed
  const BASELINE = +(process.env.UI_BASELINE || 94) /* f5.7j: 70/96 at 390+844 after the inset split + ascent_split rows */ /* QA f5.7c: 57/90 pass on live f5.7c (43 old + 12 orbit_split/end_card_orbit + 2 orbit_release real_tap); a 43 floor let 14 rows regress silently */, passN = rows.length - fails - skips;
  if (strict) console.log(`ratchet: ${passN} pass vs baseline ${BASELINE} → ${passN >= BASELINE ? 'OK' : 'REGRESSION'}`);
  process.exit(strict && passN < BASELINE ? 1 : 0);
})().catch(e => { console.error('FATAL', e.message); process.exit(strict ? 1 : 0); });
