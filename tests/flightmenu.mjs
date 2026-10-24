import { MENU_ITEMS, menuHTML, homeLabel } from '../fun/flightmenu.js';
let p = 0, f = 0; const t = (c, m) => { if (c) { p++; console.log('  ✔ ' + m); } else { f++; console.log('  ✘ ' + m); } };
const keys = MENU_ITEMS.map(i => i.k).filter(Boolean), labels = MENU_ITEMS.map(i => i.l);
t(MENU_ITEMS.length <= 9 && MENU_ITEMS.filter(i => !i.b && !i.gcam).length <= 7, `≤ 7 items (+ 🎥 Ground cam, f5.8i) without a booster (${MENU_ITEMS.filter(i => !i.b && !i.gcam).length})`);
t(new Set(keys).size === keys.length && labels.filter(l => /home/i.test(l)).length === 1, 'no duplicate keys, one Home');
t(!keys.includes('Comma') && !keys.includes('KeyT') && !keys.includes('KeyM'), 'no warp −/+ or MAP (the top bar has them)');
t(labels.every(l => /[A-Za-z]{3}/.test(l)), 'every button has a word label (no icon-only)');
t(!/data-b="1"/.test(menuHTML()) && MENU_ITEMS.filter(i => !i.abort && !i.gcam).length <= 6 && MENU_ITEMS.filter(i => i.abort).length <= 1 && homeLabel(true) !== homeLabel(false), 'f5.7j: no booster items (tap the inset), ≤6 entries + the AUTO-only ⛔ Abort (f5.8f); Return label flips to Cancel');
console.log(`flightmenu: ${p} passed, ${f} failed`); process.exit(f ? 1 : 0);
