// f5.2 manual flying across the ladder missions: AUTO stays off, the pilot steers (stick/SAS direction + throttle) and
// presses STAGE (twice = confirm) when a stage is spent. Each press pair separates exactly one stage and the next one
// lights. In orbit, the transfer uses the player's map planner (plan node + Execute), never the mission director.
import { Flight } from '../flight.js?v=f5.3b2';
import * as P from '../physics.js?v=f5.3b2';
import * as C from '../physics/patched.js?v=f5.3b2';
import { qrot } from '../physics/vec.js?v=f5.3b2';
import { SHOWROOM } from '../fun/showroom.js?v=f5.3b2';
import { LADDER } from '../fun/ladder.js?v=f5.3b2';
import { qualifying } from '../fun/mispick.js?v=f5.3b2';
import { cloneDesign } from '../parts.js?v=f5.3b2';
import { pickBase } from '../fun/stagemap.js?v=f5.3b2';
import { specFor } from '../fun/specstack.js?v=f5.3b2';
import { STAGE_KEYS, HEIGHTS } from '../gfx/vehicles/stage_keys.js?v=f5.3b2';
const houses = Object.keys(STAGE_KEYS).map(id => ({ model: id, name: id, base: pickBase(STAGE_KEYS[id], HEIGHTS[id] || 50) })).filter(h => SHOWROOM.some(r => r.id === h.base) && !specFor(h.model));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('FAIL', m); } };
const V = { add: (a, b) => a.map((x, i) => x + b[i]), sc: (a, k) => a.map(x => x * k), dot: (a, b) => a.reduce((t, x, i) => t + x * b[i], 0), norm: a => { const l = Math.hypot(...a); return a.map(x => x / l); } };
const T0 = P.tFromDate(Date.UTC(2026, 9, 19, 15));
function press(F) { const a = F.stagePress(); if (a === 'armed') { F.realT = (F.realT || 0) + 0.1; return F.stagePress(); } return a; }
function fly(design, target) {
  const F = new Flight(design, {}, { t0: T0 }); F.setAuto(false, true); const v = F.v; let autoSeen = false, presses = 0, seps = 0, lit = 0, cur = 0;
  press(F);
  let ph = 'up', dt = 1 / 30, kick = 0.4, lastTilt = 0, kicked = false, f0 = 0, burned = true;
  for (let i = 0; i < 30 * 1500 && !F.flags.dead; i++) {
    const up = V.norm(v.r), h = F.alt, o = P.orbitOf(v);
    if (ph === 'up') { // the pilot flies the HUD ascent cue by hand: SAS hold on the cue direction, throttle to the cue (AUTO stays off)
      const gd = P.autoGuide(v); v.input = { pitch: 0, yaw: 0, roll: 0 }; v.sas = 'stab'; v.sasHold = h < 300 ? up : gd.dir; v.ut = gd.throttle;
      if (gd.phase === 'done' || o.pe > 150000) { v.ut = 0; break; } }
    else if (ph === 'coast') { v.sas = 'prograde'; v.ut = 0; if (V.dot(v.v, up) < 15) ph = 'circ'; }
    else if (ph === 'circ') { v.sas = 'prograde'; v.ut = 1; if (o.pe > 150000) { v.ut = 0; break; } }
    if (v.stages[v.cur].fuel <= 0 && v.cur < F.last && F.canStage()) { presses++; const r = press(F); if (r === 'stage') seps++; }
    if (v.cur !== cur) { cur = v.cur; f0 = v.stages[v.cur].fuel; burned = false; }
    if (!burned && v.cur > 0 && v.stages[v.cur].fuel < f0 - 1e-6) { burned = true; lit++; } // the new stage really burned
    if (F.autoOn || v.auto) autoSeen = true; F.advance(dt); if (process.env.DBG && i % 450 === 0) console.log(ph, Math.round(h / 1000), 'ap', Math.round(o.ap / 1000), 'pe', Math.round(o.pe / 1000), 'cur', v.cur, 'fuel', v.stages[v.cur].fuel.toFixed(1), v.sas);
  }
  const o2 = P.orbitOf(v), res = { F, autoSeen, presses, seps, lit, orbit: !F.flags.dead && o2.pe > 140000, why: F.flags.dead || ph + ' Ap ' + Math.round((o2.ap) / 1000) + ' Pe ' + Math.round((o2.pe) / 1000) };
  if (res.orbit && target) { // player's map planner: plan the transfer node, Execute
    const pl = C.planFull(F.body, v.r, v.v, F.tAbs, target, { minWait: 1200, burn: F.burnModel() }); res.planned = !!(pl && pl.reaches);
    if (res.planned) { F.target = pl.target; F.addNode(pl.tuned); F.setExec(true);
      let execSeps = 0, seps0 = seps, fixes = 0;
      for (let i = 0; i < 3e6 && !F.flags.dead && !(F.goals[target]); i++) { if (!F.exec && !F.nodes.length) { if (!F.warpToSOI()) { if (fixes++ >= 3) break; /* the map's Fix button: a correction node, then Execute */ const cn = C.correctionNode(F.body, v.r, v.v, F.tAbs, pl.target, { peAlt: pl.target === 'moon' ? 100000 : 300000, tol: pl.target === 'moon' ? 60000 : 3e6 }); if (!cn) break; F.addNode(cn.node); F.setExec(true); } } if (v.stages[v.cur].fuel <= 0 && v.cur < F.last && F.exec) { presses++; if (press(F) === 'stage') seps++; } if (v.cur !== cur) { execSeps += v.cur - cur - (seps - seps0); seps0 = seps; cur = v.cur; f0 = v.stages[v.cur].fuel; burned = false; } if (!burned && v.stages[v.cur].fuel < f0 - 1e-6) { burned = true; lit++; } if (F.autoOn) autoSeen = true; F.advance(1 / 30); if (process.env.DBG && i % 3000 === 0) console.log('xfer', i, F.exec, F.nodes.length, F.body && F.body.name, Math.round(F.alt / 1000), v.cur, v.stages[v.cur].fuel.toFixed(1)); }
      res.arrived = !!F.goals[target]; res.autoSeen = res.autoSeen || autoSeen; res.presses = presses; res.seps = seps; res.lit = lit; res.execSeps = execSeps; res.fixes = fixes; res.end = [F.exec, F.nodes.length, Math.round(F.alt / 1000), v.cur, v.stages[v.cur].fuel.toFixed(1), F.flags.dead || ''].join(' '); } }
  return res;
}
const ids = [...new Set(LADDER.filter(c => c.how === 'mission').map(c => c.mission))];
for (const id of ids.filter(x => !process.env.ONLY || x === process.env.ONLY)) { const q = qualifying(id, SHOWROOM, houses);
  for (const r of q.slice(0, +(process.env.N || 3))) { const base = SHOWROOM.find(x => x.id === r.base), d = { ...cloneDesign(base.design), name: r.name }; const t = id === 'moon' ? 'moon' : id;
    const R = fly(d, t);
    ok(!R.autoSeen, `${id}/${r.name}: AUTO never on`); ok(R.orbit, `${id}/${r.name}: hand-flown to orbit (${R.presses} STAGE presses, ${R.seps} separations; ${R.why})`);
    ok(R.seps + (R.execSeps || 0) === R.F.v.cur && R.lit >= R.seps, `${id}/${r.name}: every separation dropped one stage and the next one lit (${R.lit} lit / ${R.seps} STAGE + ${R.execSeps || 0} by the node Execute)`);
    if (R.orbit) ok(R.arrived, `${id}/${r.name}: map planner node flown to ${t} (goal tracked on this rocket: ${JSON.stringify(R.F.goals[t] || null)}; ${R.fixes || 0} map fixes; end ${R.end})`); } }
console.log(`manual: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
