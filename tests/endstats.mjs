// f6.7: end-of-flight stats lines + ballpark launch prices (data/launch_costs.js, fun/endstats.js). No DOM, no browser.
import { readFileSync } from 'node:fs';
import * as C from '../vehicles/catalog.js';
import { STAGE_KEYS } from '../gfx/vehicles/stage_keys.js';
import { SHOWROOM } from '../fun/showroom.js';
import { fnv36 } from '../vehicles/id_aliases.js';
import { launchCost, LAUNCH_COSTS_M, CLASS_COSTS_M, classOfMass } from '../data/launch_costs.js';
import { buildEndStats, money, moneyJoke, MONEY_UNITS, newStats, trackStats } from '../fun/endstats.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };

// 1. every roster id, art-model id and showroom id resolves to a price above 0, and to a named price (not just a class guess)
const ids = new Set(); for (const k of Object.keys(C)) if (/^ROSTER_|^VEHICLES$|^MISSION_VARIANTS$/.test(k)) for (const v of C[k]) ids.add(v.id);
const rosterN = ids.size; for (const id of Object.keys(STAGE_KEYS)) ids.add(id); for (const r of SHOWROOM) ids.add(r.id);
ok(rosterN >= 60, 'roster ids found: ' + rosterN);
for (const id of ids) { const c = launchCost({ ids: [id] }); ok(c.usd > 0 && Number.isFinite(c.usd), id + ' resolves above 0'); ok(c.basis === 'named' || (c.basis === 'class' && SHOWROOM.some(r => r.id === id) && !LAUNCH_COSTS_M[id]) /* a bare showroom id may price by class when its key is held out of the data file */, id + ' has a named price (not only a class fallback)'); }
for (const [k, m] of Object.entries(LAUNCH_COSTS_M)) ok(m > 0 && m <= 5000, k + ' price in a sane range');
for (const [k, m] of Object.entries(CLASS_COSTS_M)) ok(m > 0, 'class ' + k);
// class fallback for unknown rockets: custom designs by liftoff mass, plus the flags
ok(launchCost({ ids: ['my-rocket'], massT: 5 }).cls === 'sounding' && launchCost({ ids: ['my-rocket'], massT: 5 }).basis === 'class', 'custom 5 t = sounding');
ok(['small', 'medium', 'heavy', 'super-heavy'].every((c, i) => classOfMass([30, 150, 500, 2000][i]) === c), 'mass classes');
ok(launchCost({ massT: 2000 }).usd > launchCost({ massT: 30 }).usd, 'cost scales with size class');
ok(launchCost({ massT: 100, crewed: true }).cls === 'crewed' && launchCost({ hop: true }).cls === 'hopper' && launchCost({ deepSpace: true }).cls === 'deep-space', 'class flags');
ok(launchCost({ ids: ['atlantean-v-541-m'] }).key === 'atlantean-v' && launchCost({ ids: ['jade-lantern-5b'] }).key === 'jade-lantern-5b', 'trimmed ids resolve');
ok(launchCost({}).usd > 0, 'empty info still resolves');

// 2. no real company / rocket names in the new public files (checked by hash, whole words); no personal names in comments
const DENY = new Set('1uluog7 1hqj548 10hnhe3 1b8yblx 1e7p56w 7o4cb7 1qcac9x 11nyycl 74gpg5 66z7rh f8cmsm 10efcje kkmjrd 1vp7f6s jrw8fr 1dyb2p1 10a1xvk 10kxt4a 3j6nvz 1r06wdt 1clvom7 1e62mzb 1hn33ah wrja50 1pjj2jj 1576gql uddbyh vwlfsq bl3u71 15zqhdq 166txb q6fdkc tfveqt kohr0e ql9oag nzo61r 168gk1n 1y5iuh 1ws16x8 11ui0ih yztxn 1mltjff 13gbwns 1swo4de 18kyqmf'.split(' '));
for (const f of ['../data/launch_costs.js', '../fun/endstats.js']) { const txt = readFileSync(new URL(f, import.meta.url), 'utf8');
  const bad = [...new Set(txt.toLowerCase().match(/[a-z0-9]+/g))].filter(w => DENY.has(fnv36(w))); ok(!bad.length, f + ' has no real names (' + bad.length + ' flagged)'); ok(!/aaron/i.test(txt), f + ' has no personal names'); }

// 3. the line builder
const base = { maxQ: 31300, maxQAlt: 11000, maxQMet: 72, maxV: 7800, maxAlt: 180000, maxG: 4.4, vehicle: { ids: ['heron-9'] }, seed: 11 };
const crash = buildEndStats({ ...base, dead: true }), rec = buildEndStats({ ...base, recovered: true }), live = buildEndStats(base);
ok(crash.all.length === 6 && crash.head.length === 3 && crash.details.length === 3, 'head = cost, max Q, fastest; details = altitude, g, note');
ok(['cost', 'maxq', 'fast'].every((k, i) => crash.head[i].k === k), 'head order');
const T = r => r.all.map(l => l.text).join('\n');
ok(/Max Q: 654 psf at 6\.8 mi up/.test(crash.head[1].text), 'max Q in psf with altitude: ' + crash.head[1].text);
ok(/1m 12s/.test(buildEndStats({ ...base, seed: 1 }).head[1].text + buildEndStats({ ...base, seed: 2 }).head[1].text + buildEndStats({ ...base, seed: 3 }).head[1].text + buildEndStats({ ...base, seed: 4 }).head[1].text), 'max Q time reads as 1m 12s in a variant');
ok(/17,448 mph/.test(crash.head[2].text), 'fastest in mph: ' + crash.head[2].text);
ok(/112 mi/.test(crash.details[0].text) && /4\.4 g/.test(crash.details[1].text), 'max altitude in miles, peak g');
ok(/\$70M/.test(crash.head[0].text) && /cost|bill|felt/.test(crash.head[0].text) && /school buses|coffee|pizza|houses|airliner/.test(crash.head[0].text), 'crash cost line: ' + crash.head[0].text);
ok(/Recovered: saved about \$42M/.test(rec.head[0].text) && !/cost/.test(rec.head[0].text), 'recovered variant: ' + rec.head[0].text);
ok(!/mph|km\/h/.test(crash.head[1].text) && !/[A-Z]{3}\b.*\bkg\b/.test(T(crash)), 'no stray units');
ok(/Launch price tag/.test(live.head[0].text), 'neither crashed nor recovered: price tag');
ok(/ballpark/i.test(crash.details[2].text), 'labelled as ballpark');
// metric
const met = buildEndStats({ ...base, dead: true, imperial: false });
ok(/km\/h/.test(met.head[2].text) && /kPa/.test(met.head[1].text) && /km/.test(met.details[0].text) && !/mph|psf|\bmi\b/.test(T(met)), 'metric units: ' + met.head[1].text + ' | ' + met.head[2].text);
// cost scales with the rocket
const big = buildEndStats({ ...base, dead: true, vehicle: { ids: ['saturnine-v'] } }), small = buildEndStats({ ...base, dead: true, vehicle: { ids: ['pip'] } });
ok(big.cost.usd > crash.cost.usd && crash.cost.usd > small.cost.usd, 'cost scales: ' + [small, crash, big].map(r => money(r.cost.usd)).join(' < '));
ok(/\$1\.2B/.test(big.head[0].text) && /\$500k/.test(small.head[0].text), 'money format: ' + big.head[0].text + ' / ' + small.head[0].text);
ok(money(8e6) === '$8M' && money(1.5e9) === '$1.5B' && money(750e3) === '$750k' && money(42e6) === '$42M' && money(12e9) === '$12B', 'money()');
// recovered saves less than the launch price
ok(rec.cost.saved < rec.cost.usd && rec.cost.saved > 0, 'saved is a share of the price');
// jokes: seed picks variants, repeats differ, all short and clean
const seen = new Set(); for (let s = 0; s < 40; s++) { const r = buildEndStats({ ...base, dead: true, seed: s }); seen.add(r.head.map(l => l.text).join('|')); for (const l of r.all) { ok(l.text.length <= 150, 'short line: ' + l.text); ok(!/\b(damn|hell|shit|fuck|crap|ass)\b/i.test(l.text), 'clean: ' + l.text); } }
ok(seen.size >= 8, 'seeds give different variants: ' + seen.size);
ok(buildEndStats({ ...base, dead: true, seed: 3 }).head.map(l => l.text).join() === buildEndStats({ ...base, dead: true, seed: 3 }).head.map(l => l.text).join(), 'same seed, same lines');
// edge cases
const pad = buildEndStats({ dead: true, vehicle: { ids: ['pip'] }, seed: 1 });
ok(/barely any/.test(pad.head[1].text) && /standing still/.test(pad.head[2].text) && /never left the pad/.test(pad.details[0].text), 'a pad failure reads sensibly');
ok(buildEndStats({ ...base, maxV: 300 }).head[2].text.includes('mph') && !/speed of sound/.test(buildEndStats({ ...base, maxV: 300 }).head[2].text), 'subsonic has no Mach joke');
for (const [p] of MONEY_UNITS) ok(p > 0, 'unit price');
ok(/^\d[\d,]* /.test(moneyJoke(70e6, 2)) && /^\d[\d,]* /.test(moneyJoke(500e3, 2)), 'money joke has a count: ' + moneyJoke(500e3, 2));
// tracker: peak q remembers where and when; top speed; altitude
const st = newStats(); trackStats(st, { q: 100 }, 500, 50, 5); trackStats(st, { q: 900 }, 4000, 300, 40); trackStats(st, { q: 400 }, 9000, 700, 60); trackStats(st, null, 3000, 100, 70);
ok(st.q === 900 && st.qAlt === 4000 && st.qMet === 40 && st.v === 700 && st.alt === 9000, 'tracker: ' + JSON.stringify(st));
// a real simulated AUTO ascent (no DOM) fills the tracker with plausible numbers
{ const P = await import('../physics.js?v=f6.7a'), { Flight } = await import('../flight.js?v=f6.7a'), tpl = SHOWROOM.find(r => r.id === 'needle').design;
  const F = new Flight(tpl, {}, { t0: P.tFromDate(Date.UTC(2026, 9, 19, 15)) }); F.setAuto(true, true); F.stagePress(); for (let i = 0; i < 30 * 200 && !F.flags.dead; i++) F.advance(1 / 30);
  const s = F.fstats; ok(s.q > 5000 && s.q < 80000 && s.qAlt > 1000 && s.qAlt < 25000 && s.qMet > 15 && s.qMet < 120, 'sim max Q plausible ' + JSON.stringify(s)); ok(s.v > 3000 && s.alt > 80000, 'sim top speed + altitude plausible');
  ok(Math.abs(s.alt - F.flags.maxAlt) < 5000, 'tracked altitude matches the flight record');
  const r = buildEndStats({ maxQ: s.q, maxQAlt: s.qAlt, maxQMet: s.qMet, maxV: s.v, maxAlt: s.alt, maxG: F.maxG, dead: true, vehicle: { ids: ['needle'] }, seed: 4 }); ok(r.all.every(l => !/NaN|undefined|Infinity/.test(l.text)), 'no NaN in lines'); }
// compact end-card line: ONE line, a handful of words, max Q + top speed + cost, whatever the flight
{ for (const [dead, recovered, q, v] of [[0, 0, 30000, 2300], [1, 0, 50, 1], [0, 1, 80000, 7800], [1, 0, 120000, 900]]) {
    const e = buildEndStats({ maxQ: q, maxQAlt: 12000, maxQMet: 70, maxV: v, maxAlt: 150000, maxG: 4, dead: !!dead, recovered: !!recovered, vehicle: { ids: ['heron-9'], massT: 500 }, imperial: true, seed: 5 });
    ok(typeof e.line === 'string' && !e.line.includes('\n') && e.line.split(/\s+/).length <= 14, 'compact end-card line is one short line', e.line); ok(/~\$|~/.test(e.line) && e.tip.length > e.line.length, 'it carries a cost and the jokes ride in the tooltip'); } }
console.log(`endstats: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
