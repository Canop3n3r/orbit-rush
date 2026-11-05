// OR-003: grouping and filtering for the map tracking sheet and the craft list.
// Pure: no DOM and no physics. A flight with many craft (a rideshare, a constellation) stays a short
// sheet: bodies, then a family or a class, closed once a group reaches COLLAPSE_AT. The map and the
// craft list both render from this. If the craft-list API is missing it falls back to rail satellites.
export const COLLAPSE_AT = 6;
const FAMILY_RE = /\s*(?:#\s*)?\d+(?:\s+of\s+\d+)?\s*$/i;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function familyOf(name) {
  const s = String(name || 'Craft').replace(FAMILY_RE, '').trim();
  return s || String(name || 'Craft');
}

function normalizeVessel(v) {
  return {
    id: String(v.id), name: v.name || 'Craft', type: v.type || 'sat', cls: v.cls || 'Craft', body: v.body || 'earth', group: v.group || null,
    alt: Number.isFinite(v.alt) ? v.alt : null, active: !!v.active, origin: !!v.origin,
    canFly: v.active ? false : v.canFly !== false, source: 'vessel',
  };
}
function normalizeSat(o) {
  return {
    id: String(o.id || o.name || 'sat'), name: o.name || 'Satellite', type: o.craft || o.type || 'sat',
    cls: o.cls || (o.group === 'constellation' ? 'Constellation' : 'Satellite'), body: o.body || 'earth', group: o.group || null,
    alt: Number.isFinite(o.alt) ? o.alt : null, active: !!o.active, origin: false, canFly: !!o.canFly, source: 'rail',
  };
}
export function rowsFrom({ vessels, sats } = {}) {
  if (Array.isArray(vessels) && vessels.length) return vessels.filter(Boolean).map(normalizeVessel);
  return (Array.isArray(sats) ? sats : []).filter(Boolean).map(normalizeSat);
}
// Prefer the craft list once it knows more than the ship. One ship plus a rail list keeps both.
// A throwing or missing vesselList falls back to the rails (OR-002 may not have landed yet).
export function loadRows({ vessels, sats } = {}) {
  const rails = Array.isArray(sats) ? sats : [];
  if (Array.isArray(vessels) && vessels.length > 1) return rowsFrom({ vessels });
  if (Array.isArray(vessels) && vessels.length === 1) {
    const mine = rowsFrom({ vessels }), extra = rowsFrom({ sats: rails });
    return extra.length ? mine.concat(extra) : mine;
  }
  return rowsFrom({ sats: rails });
}
export function readCraftRows(flight, sats) {
  let vessels = null;
  if (flight && typeof flight.vesselList === 'function') { try { const v = flight.vesselList(); if (Array.isArray(v)) vessels = v; } catch (e) { vessels = null; } }
  return loadRows({ vessels, sats });
}
export function sheetVisible(rows) {
  if (!rows || !rows.length) return false;
  if (rows.length >= 2) return true;
  return !rows[0].active;
}

export function bucketOf(row) {
  const group = row && row.group && row.group !== 'other' ? String(row.group) : '';
  if (group) return { key: 'g:' + group, label: group === 'constellation' ? 'Constellation' : group.charAt(0).toUpperCase() + group.slice(1) };
  const cls = (row && row.cls) || 'Craft';
  return { key: 'c:' + cls, label: cls };
}

export function filterRows(rows, { q = '', chip = 'all', here = null } = {}) {
  const query = String(q || '').trim().toLowerCase();
  return (rows || []).filter(r => {
    if (chip === 'flying' && !r.active) return false;
    if (chip === 'here' && here && r.body !== here) return false;
    if (chip && chip !== 'all' && chip !== 'flying' && chip !== 'here') {
      const b = bucketOf(r);
      if (r.cls !== chip && r.group !== chip && b.label !== chip && familyOf(r.name) !== chip) return false;
    }
    if (!query) return true;
    return `${r.name} ${r.cls || ''} ${r.type || ''} ${r.body || ''} ${r.group || ''} ${familyOf(r.name)}`.toLowerCase().includes(query);
  });
}

export function chipsFor(rows, here) {
  const list = rows || [], chips = [{ id: 'all', label: 'All', n: list.length }];
  const flying = list.filter(r => r.active).length;
  if (flying) chips.push({ id: 'flying', label: 'Flying', n: flying });
  if (here && list.some(r => r.body === here) && list.some(r => r.body !== here)) chips.push({ id: 'here', label: 'Here', n: list.filter(r => r.body === here).length });
  const counts = new Map();
  for (const r of list) { const label = r.cls || 'Craft'; counts.set(label, (counts.get(label) || 0) + 1); }
  for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    if (chips.length >= 6) break;
    chips.push({ id: label, label, n });
  }
  return chips;
}

// Second level is the shared name ("Constellation sat") once three or more match, otherwise the class.
export function groupRows(rows, state = {}) {
  const here = state.here || null, focusKey = state.focusKey || null, force = state.force || {};
  const byBody = new Map();
  for (const r of rows || []) { const b = r.body || 'earth'; if (!byBody.has(b)) byBody.set(b, []); byBody.get(b).push(r); }
  const bodies = [...byBody.keys()].sort((a, b) => (b === here) - (a === here) || a.localeCompare(b));
  return bodies.map(body => {
    const prelim = new Map();
    for (const r of byBody.get(body)) {
      const bkt = bucketOf(r), fam = familyOf(r.name), k = bkt.key + '\n' + fam;
      if (!prelim.has(k)) prelim.set(k, { bkt, fam, rows: [] });
      prelim.get(k).rows.push(r);
    }
    const merged = new Map();
    for (const p of prelim.values()) {
      const useFam = p.rows.length >= 3 && p.fam !== p.bkt.label;
      const key = useFam ? p.bkt.key + '/' + p.fam : p.bkt.key;
      if (!merged.has(key)) merged.set(key, { key, label: useFam ? p.fam : p.bkt.label, rows: [] });
      const g = merged.get(key); g.rows.push(...p.rows); if (useFam) g.label = p.fam;
    }
    const groups = [...merged.values()].map(g => {
      const gk = body + '|' + g.key;
      const holds = g.rows.some(r => (focusKey === 'craft' && r.active) || focusKey === r.id);
      const forced = force[gk];
      const open = forced === 'open' ? true : forced === 'shut' ? false : g.rows.length < COLLAPSE_AT || holds;
      return { key: g.key, label: g.label, rows: g.rows, n: g.rows.length, open };
    });
    groups.sort((a, b) => (b.rows.some(r => r.active) - a.rows.some(r => r.active)) || b.n - a.n || a.label.localeCompare(b.label));
    return { body, groups };
  });
}

export function cycleId(rows, id, dir) {
  if (!rows || !rows.length) return null;
  const step = dir < 0 ? -1 : 1;
  let i = rows.findIndex(r => r.id === id);
  if (i < 0) i = step > 0 ? -1 : 0;
  return rows[(i + step + rows.length) % rows.length].id;
}

function defaultFmt(m) { const k = m / 1000; return (Math.abs(k) < 100 ? k.toFixed(1) : String(Math.round(k))) + ' km'; }

function rowHTML(r, focusKey, fmt) {
  const on = (focusKey === 'craft' && r.active) || focusKey === r.id;
  const alt = Number.isFinite(r.alt) ? fmt(r.alt) : '';
  const tail = r.active ? '<em>Flying</em>' : (r.canFly !== false ? `<button type="button" data-act="fly" data-id="${esc(r.id)}">Fly</button>` : '');
  return `<div class="mtRow${on ? ' on' : ''}${r.active ? ' act' : ''}" data-act="focus" data-id="${esc(r.id)}" role="button" tabindex="0"><b>${esc(r.name)}</b><small>${esc(alt)}</small>${tail}</div>`;
}

// HTML for #mapTrack. `state.open` is the pill (collapsed until tapped). Groups inside follow groupRows.
export function renderSheet(rows, state = {}, opt = {}) {
  const list = rows || [], q = state.q || '', chip = state.chip || 'all', here = state.here || null;
  const fmt = opt.fmtAlt || defaultFmt, bodyName = opt.bodyName || (id => id ? id.charAt(0).toUpperCase() + id.slice(1) : '');
  const filtered = filterRows(list, { q, chip, here });
  const sections = groupRows(filtered, state);
  const chips = list.length >= COLLAPSE_AT ? chipsFor(list, here) : [];
  const parts = [`<h4 title="Open the list. Alt+[ and Alt+] move through craft.">Tracking · ${list.length} <i>${state.open ? '▴' : '▾'}</i></h4><div class="mtBody">`];
  if (list.length >= COLLAPSE_AT) {
    parts.push('<div class="mtBar"><div class="mtChips">');
    for (const c of chips) parts.push(`<button type="button" class="mtChip${c.id === chip ? ' on' : ''}" data-act="chip" data-chip="${esc(c.id)}">${esc(c.label)} ${c.n}</button>`);
    parts.push(`</div><div class="mtFind"><button type="button" class="mtCyc" data-act="cycle" data-dir="-1" title="Previous craft (Alt+[)" aria-label="Previous craft">◀</button><input class="mtQ" type="text" placeholder="Find" value="${esc(q)}" aria-label="Filter craft" autocomplete="off" spellcheck="false"><button type="button" class="mtCyc" data-act="cycle" data-dir="1" title="Next craft (Alt+])" aria-label="Next craft">▶</button></div></div>`);
  }
  parts.push('<div class="mtList">');
  if (!filtered.length) parts.push('<div class="mtEmpty">Nothing matches</div>');
  for (const sec of sections) {
    if (sections.length > 1) parts.push(`<div class="mtSec">${esc(bodyName(sec.body))}</div>`);
    for (const g of sec.groups) {
      const showHead = !g.open || g.n >= 3;
      if (showHead) parts.push(`<button type="button" class="mtG" data-act="group" data-g="${esc(sec.body + '|' + g.key)}" aria-expanded="${g.open ? 'true' : 'false'}">${g.open ? '▾' : '▸'} ${esc(g.label)} · ${g.n}</button>`);
      if (g.open) for (const r of g.rows) parts.push(rowHTML(r, state.focusKey, fmt));
    }
  }
  parts.push('</div></div>');
  return { html: parts.join(''), filtered, sections, chips };
}
