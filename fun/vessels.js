// Vessel switching for Flight (f6.2): which vessel you fly, parking and taking control, power, deploying carried craft, and the
// battery / power model of a piloted craft. Installed on Flight.prototype by flight.js (installVessels) so this stays one file.
// The rules in plain words (also in plans/CRAFT_SWITCH.md):
//  - Every vessel left in space is a fleet record (fun/fleet.js). The one you fly is Flight.v; every other vessel coasts on a Kepler orbit.
//  - You can switch while coasting in space (above the rails altitude, return burn not under way). A payload waits until the booster has landed; a separated stage or that booster can be taken.
//  - Switching never changes the game clock, time warp is dropped to x1, and a flight ends only on Home / Recover / destruction.
import * as P from '../physics.js?v=f5.8y';
import * as C from '../physics/patched.js?v=f5.8y';
import { Fleet, packVehicle, vehicleFor, describeVessel, advanceEnergy, sunlit, tumbleOf, batteryPct, muOfBody } from './fleet.js?v=f5.9-32';
import { craftTypeFor, buildCraftVehicle, typeOf, PROPULSION, engineDv } from '../data/craft_types.js?v=f5.8y';
const V = P.V;
const recFor = veh => { const c = veh && veh.craft ? typeOf(veh.craft.type) : null; return c && c.shield && c.chute ? { capsule: true, shield: true, chute: true, shieldId: 'ablator' } : { capsule: false, shield: false, chute: false, shieldId: null }; };
const lastPowOf = v => { let k = 0; v.stages.forEach((s, i) => { if (s.eng && s.eng.tv > 0) k = i; }); return k; };
// OR-002: the name of a piece that just left the rocket. Returning boosters keep the A/B id the sim already gave them.
function sepName(piece, returning) {
  if (returning) return piece.id ? `Booster ${piece.id}` : 'Booster';
  if (piece.radial > 1) return 'Side boosters';
  if (piece.radial) return 'Booster';
  if ((piece.stageIndex | 0) === 0) return 'Spent booster';
  return `Stage ${(piece.stageIndex | 0) + 1}`;
}
// One flyable stage: the dropped piece's real tanks and engine, not a fresh generic craft. A booster that has left
// the core is a single rocket (the radial flag would hide it beside a core that is no longer there).
function stageVehicle(parent, piece, name) {
  const st = piece.stages[0], parts = (st.parts || []).map(p => ({ ...p }));
  const eng = st.eng ? { ...st.eng } : { tv: 0, ispSl: 1, ispVac: 1, gimbal: 0 };
  const stage = { dry: st.dry || 0, fuel: st.fuel || 0, fuelMax: st.fuelMax || st.fuel || 0, eng, n: st.n || 1, fins: st.fins || 0, parts };
  const dir = piece.dir && V.len(piece.dir) > 1e-6 ? V.norm(piece.dir) : V.qrot(parent.q || [1, 0, 0, 0], [0, 1, 0]);
  const m = stage.dry + stage.fuel;
  return { r: piece.r.slice(), v: piece.v.slice(), q: V.qFromTo([0, 1, 0], dir), w: [0, 0, 0], throttle: 0, ut: 0, clamped: false,
    stages: [stage], cur: 0, payload: 0, fairing: 0, rcsFuel: 0, rcsOn: false, sas: 'stab', input: { pitch: 0, yaw: 0, roll: 0 }, trans: [0, 0, 0],
    mult: 1, qk: 0, aoa: 0, cdA: piece.cdA || parent.cdA || 3, auto: false, body: parent.body || 'earth', earthRot: parent.earthRot !== false,
    clock: piece.clock || parent.clock || 0, site: parent.site, chute: { state: 'stowed', t: 0 }, chuteCdA: 0, specArea: parent.specArea,
    craft: { type: 'stage', name, house: null, m, power: true, noPower: true, solid: false, lit: false, brown: false, elec: 0, elecMax: 0, solarW: 0, idleW: 0, engW: 0, sun: 1 } };
}

export function installVessels(Flight) {
  const M = Flight.prototype;
  // the rocket you launched is vessel 1: it keeps flying as the spent stage after its payload leaves
  M.initFleet = function (design) {
    this.fleet = new Fleet(); this.craftHint = {};
    const o = this.fleet.add({ name: (design && design.name) || 'Rocket', type: 'stage', origin: true, r: this.v.r, v: this.v.v, t: this.tAbs, body: this.body, m: P.massOf(this.v), house: design && design.model });
    this.fleet.activeId = o.id; this.originId = o.id; };
  // what the rocket deployed: a fleet record with the craft type chosen from the launcher and the payload (data/craft_types.js)
  M.onPayloadReleased = function (rec) {
    const d = this.design || {}, info = { ...(this.craftHint || {}), model: d.model, name: d.name, partIds: (d.parts || []).map(p => p.id), hasSpec: !!d.spec, payloadKg: this.craftHint && this.craftHint.payloadKg };
    const type = craftTypeFor(info), T = typeOf(type), o = this.fleet.add({ name: T.name, type, origin: false, r: rec.r, v: rec.v, t: rec.t, body: rec.body || this.body, m: rec.m, house: (this.craftHint && this.craftHint.house) || d.model || null, power: true });
    rec.craft = type; rec.vesselId = o.id; rec.house = o.house; return o; };
  M.linkReleased = function (rec) { const o = rec && this.fleet.get(rec.vesselId); if (!o) return; if (rec.saved) { o.worldId = rec.saved.id; o.name = rec.saved.name; } };
  // OR-002: separation does not delete the piece. It becomes a fleet craft (type stage) with the tanks and engine it
  // left with, so the craft list, [ ] and the map tracking list can see it and you can fly it. A returning booster
  // stays on its own sim (keep) until you take it or it is lost; a spent stage coasts on rails until it comes down.
  M.keepSeparated = function (piece, opts = {}) {
    if (!this.fleet || !piece || !piece.stages || !piece.stages[0] || !piece.r) return null;
    const returning = !!opts.returning, name = opts.name || sepName(piece, returning), house = (this.design && this.design.model) || null;
    const veh = stageVehicle(this.v, piece, name); veh.craft.house = house;
    const o = this.fleet.add({ name, type: 'stage', origin: false, separated: true, returning, keep: returning, boosterState: returning ? 'flying' : null,
      r: piece.r, v: piece.v, q: veh.q, w: [0, 0, 0], t: this.tAbs, body: this.body, m: veh.craft.m, house, power: true, veh: packVehicle(veh) });
    piece.vesselId = o.id; this.call('vesselSeparated', o); return o;
  };
  // the live booster sim is the position of a returning craft. Taking one stops that sim and hands you the stage vehicle.
  M.handOff = function (o) {
    if (!o) return; const all = this.boosters && this.boosters.length ? this.boosters : this.booster ? [this.booster] : [];
    for (const b of all) if (b.vesselId === o.id && b.state === 'flying') {
      o.r = b.r.slice(); o.v = b.v.slice(); o.t = this.tAbs; o.body = this.body;
      if (b.dir && V.len(b.dir) > 1e-6) o.q = V.qFromTo([0, 1, 0], V.norm(b.dir));
      if (o.veh && o.veh.stages && o.veh.stages[0] && b.stages && b.stages[0]) { o.veh.stages[0].fuel = b.stages[0].fuel; o.veh.r = o.r.slice(); o.veh.v = o.v.slice(); if (o.q) o.veh.q = o.q.slice(); }
      b.state = 'craft'; b.throttle = 0; b.ut = 0; o.keep = false; o.returning = false; o.boosterState = 'craft'; this.call('boosterCraft', b);
    }
  };
  M.syncSeparated = function () {
    if (!this.fleet) return; const all = this.boosters && this.boosters.length ? this.boosters : this.booster ? [this.booster] : [];
    for (const b of all) {
      const o = b.vesselId && this.fleet.get(b.vesselId); if (!o || b.state === 'craft') continue;
      o.r = b.r.slice(); o.v = b.v.slice(); o.t = this.tAbs; o.body = this.body;
      if (b.dir && V.len(b.dir) > 1e-6) o.q = V.qFromTo([0, 1, 0], V.norm(b.dir));
      o.returning = b.state === 'flying' || b.state === 'landed'; o.keep = o.returning; o.lost = b.state === 'lost'; o.boosterState = b.state;
      if (o.veh && o.veh.stages && o.veh.stages[0] && b.stages && b.stages[0]) { o.veh.stages[0].fuel = b.stages[0].fuel; o.veh.r = o.r.slice(); o.veh.v = o.v.slice(); if (o.q) o.veh.q = o.q.slice(); }
    }
  };
  M.seedFleet = function (objs, worldType) { // payloads left in space by earlier flights (the saved world list)
    let n = 0; for (const w of objs || []) { if (this.fleet.list.some(o => o.worldId === w.id)) continue;
      const type = w.craft || (worldType && worldType(w)) || 'comsat', o = this.fleet.add({ name: w.name || typeOf(type).name, type, origin: false, r: w.r, v: w.v, t: w.t, body: w.body || 'earth', m: w.m > 0 ? w.m : typeOf(type).mass, worldId: w.id, house: w.house || w.model || null, fuel: w.fuel, mono: w.mono, elec: w.elec, power: w.power !== false, q: w.q, veh: null });
      n++; void o; } return n; };

  M.fleetSnapshot = function () { return { list: this.fleet.list, seq: this.fleet.seq, activeId: this.fleet.activeId, originId: this.originId }; };
  M.restoreFleet = function (d) { if (!d || !Array.isArray(d.list)) { this.initFleet(this.design); return; } const f = new Fleet(); f.list = JSON.parse(JSON.stringify(d.list)); f.seq = d.seq || f.list.length; f.activeId = d.activeId; this.fleet = f; this.originId = d.originId || (f.list.find(o => o.origin) || {}).id; };
  // ---- queries ----
  M.vesselList = function () { const t = this.tAbs; return this.fleet.list.map(o => describeVessel(this.fleet, o, t, o.id === this.fleet.activeId ? this.v : null)); };
  M.activeVessel = function () { return this.fleet.active; };
  M.vesselCount = function () { return this.fleet.list.length; };
  M.canSwitch = function (target) {
    const v = this.v, b = this.booster; if (this.flags.dead) return { ok: false, why: 'The craft is destroyed' };
    if (!this.ignited || v.clamped) return { ok: false, why: 'Launch first: nothing to switch to on the pad' };
    // a separated stage you already took may be down in the air, or parked after it touched down:
    // you can still leave it. The park only freezes the vehicle you are sitting in.
    const visiting = !!(this.fleet && this.fleet.active && this.fleet.active.separated);
    const o = target && target.id ? target : null;
    const flying = (b && b.state === 'flying') || (this.boosters && this.boosters.some(x => x.state === 'flying'));
    if (!visiting && flying && !(o && o.separated)) return { ok: false, why: 'Land the booster first' };
    if (this.parked && !visiting) return { ok: false, why: 'This craft is parked on the ground' };
    if (!visiting && this.ret && this.ret.phase !== 'coast') return { ok: false, why: 'Finish the return first' };
    if (!visiting && this.alt < C.railsAltOf(this.body)) return { ok: false, why: 'Switch craft above ' + Math.round(C.railsAltOf(this.body) / 1000) + ' km, out of the air' };
    return { ok: true, why: '' };
  };
  M.vesselIndex = function (dir) { const L = this.fleet.list, i = L.findIndex(o => o.id === this.fleet.activeId); return L.length ? (i + dir + L.length) % L.length : -1; };

  // ---- switching ----
  M.packCtx = function () { return { nodes: this.nodes, ret: this.ret, lastPow: this.lastPow, rec: this.rec, orbitSnap: this.orbitSnap, ignited: this.ignited }; };
  M.parkActive = function () { // write the flown vessel back to its record
    const v = this.v, o = this.fleet.active; if (!o) return null; const c = v.craft;
    v.throttle = 0; v.ut = 0; v.thrust = 0; v.input = { pitch: 0, yaw: 0, roll: 0 }; v.trans = [0, 0, 0]; v.steerDir = null;
    const on = !c || (c.power !== false && !c.brown); if (!on && (!v.w || P.V.len(v.w) < 1e-6)) v.w = tumbleOf(o.id); // an unpowered vessel drifts and slowly turns
    Object.assign(o, { veh: packVehicle(v), ctx: this.packCtx(), r: v.r.slice(), v: v.v.slice(), q: v.q.slice(), w: (v.w || [0, 0, 0]).slice(), t: this.tAbs, body: this.body, power: c ? c.power !== false : true,
      m: P.massOf(v), type: c ? c.type : 'stage' });
    this.call('vesselParked', o); return o; };
  M.takeVessel = function (o) { // make record o the flown vessel
    const t = this.tAbs, veh = vehicleFor(o, t, this.t0, this.v.earthRot !== false), ctx = o.ctx;
    veh.site = this.v.site; const wasBody = this.body; this.v = veh;
    this.nodes = ctx ? ctx.nodes : []; this.ret = ctx ? ctx.ret : null; this.orbitSnap = ctx ? ctx.orbitSnap : null; this.rec = ctx ? ctx.rec : recFor(veh);
    this.lastPow = ctx ? ctx.lastPow : lastPowOf(veh); this.ignited = true; this.autoOn = false; this.exec = false; this.warpTarget = null; this.autoWarp = false; this.setWarp(0, true);
    this.fleet.activeId = o.id; this._soiC = null; this.stageArm = -1;
    if (o.body && o.body !== wasBody) this.call('soi', wasBody, o.body);
    P.stepVehicle(veh, 0); this.call('vesselSwitched', { to: o, craft: !!veh.craft }); return veh; };
  M.switchTo = function (id, quiet) {
    const o = this.fleet.get(id); if (!o) { if (!quiet) this.toast('No such vessel', '#ffb35c'); return false; }
    if (o.id === this.fleet.activeId) { if (!quiet) this.toast('You are already flying ' + o.name, '#9cc3ff'); return false; }
    const ck = this.canSwitch(o); if (!ck.ok) { if (!quiet) this.toast(ck.why, '#ffb35c'); return false; }
    const grounded = !!this.parked;
    this.handOff(o); const from = this.parkActive();
    if (grounded) {
      this.parked = null; if (this.flags) this.flags.landed = 0; // the landing belonged to the craft we just left
      if (from && from.separated) from.keep = true; // on the ground: do not prune it as a burn-up
    }
    this.takeVessel(o);
    if (!quiet) this.toast(`🎮 You now fly ${o.name}` + (from ? ` · ${from.name} coasts` : ''), '#7dffa6'); return true; };
  M.cycleVessel = function (dir = 1) {
    const L = this.fleet.list, n = L.length; if (n < 2) { this.toast('Only one craft in space: release a payload first', '#ffb35c'); return false; }
    const start = L.findIndex(o => o.id === this.fleet.activeId);
    for (let k = 1; k < n; k++) { const o = L[(start + dir * k + n * 8) % n]; if (o.returning && o.boosterState === 'flying') continue; return this.switchTo(o.id); }
    this.toast('Land the booster first', '#ffb35c'); return false; };
  M.returnToOrigin = function () { return this.originId && this.fleet.get(this.originId) ? this.switchTo(this.originId) : false; };

  // ---- power ----
  M.setPower = function (on, quiet) {
    const v = this.v, c = v.craft; if (!c) { if (!quiet) this.toast('This rocket stage has no power switch: its engine is its control', '#9cc3ff'); return false; }
    if (c.noPower) { if (!quiet) this.toast('This craft has no power system', '#ffb35c'); return false; }
    c.power = !!on; if (!on) { v.ut = 0; v.throttle = 0; v.steerDir = null; v.sasHold = null; v.holdAtt = null; this.exec = false; if (!c.lit) v.thrust = 0; }
    else if (c.brown) { if (!quiet) this.toast('Battery empty: the craft wakes when the panels have charged it', '#ffb35c'); }
    if (!quiet) this.toast(on ? '⚡ Power ON: wheels, engine and radios awake' : '⏻ Power OFF: the craft drifts (it keeps its orbit)', on ? '#7dffa6' : '#ffb35c'); return true; };
  M.togglePower = function () { const c = this.v.craft; return this.setPower(c ? c.power === false : true); };
  // another vessel's switch, from the list (it does not change who you fly)
  M.setVesselPower = function (id, on) { const o = this.fleet.get(id); if (!o) return false; if (id === this.fleet.activeId) return this.setPower(on);
    if (o.veh && o.veh.craft && o.veh.craft.noPower) return false; o.power = !!on; if (o.veh && o.veh.craft) o.veh.craft.power = !!on;
    if (!on && !(o.w && P.V.len(o.w) > 1e-6)) o.w = tumbleOf(o.id); else if (on) o.w = [0, 0, 0];
    this.toast(`${on ? '⚡' : '⏻'} ${o.name} power ${on ? 'ON' : 'OFF'}`, on ? '#7dffa6' : '#ffb35c'); return true; };

  // ---- electricity and the one-shot solid motor, once per physics step. Returns whether the craft is awake. ----
  M.craftTick = function (dt) {
    const v = this.v, c = v.craft; if (!c) return true;
    const T = typeOf(c.type), pr = PROPULSION[T.prop] || PROPULSION.none; let on = c.power !== false && !c.brown;
    if (!c.noPower) {
      c._st = (c._st || 0) - dt; if (c._st <= 0 || c.sun === undefined) { c._st = 20; try { c.sun = sunlit(this.body, v.r, v.v, this.tAbs, 0, 1); } catch (e) { c.sun = 1; } }
      const gen = c.solarW * (c.sun === undefined ? 1 : c.sun), draw = on ? c.idleW + c.engW * (v.throttle || 0) : 0;
      c.elec = Math.max(0, Math.min(c.elecMax, c.elec + (gen - draw) * dt / 3600));
      const was = c.brown; if (c.elec <= 0 && gen < draw) c.brown = true; else if (c.brown && c.elec > 0.05 * c.elecMax && gen >= 0) c.brown = false;
      if (c.brown !== was) { this.toast(c.brown ? '⚡ Battery empty: the craft is dark until the sun charges it' : '⚡ Power restored', c.brown ? '#ff6262' : '#7dffa6'); on = c.power !== false && !c.brown; }
    }
    const s = v.stages[v.cur];
    if (on && pr.restart === false && s && s.eng && s.eng.tv > 0) { // solid motor: light it once, it burns to empty
      if (!c.lit && v.ut > 0 && s.fuel > 0) { c.lit = true; this.toast('🔥 Solid motor lit: it cannot be shut off', '#ffb35c'); }
      if (c.lit) { if (s.fuel <= 0) { c.lit = false; v.ut = 0; v.throttle = 0; this.toast('Solid motor burned out', '#9cc3ff'); } else { v.ut = 1; v.throttle = 1; } }
    }
    if (!on) { if (!(c.lit && pr.restart === false && s && s.fuel > 0)) { v.throttle = 0; } }
    return on || (c.lit && pr.restart === false && !!s && s.fuel > 0);
  };
  M.craftRails = function (dt) { const v = this.v, c = v.craft; if (c) advanceEnergy(c, this.body, v.r, v.v, this.tAbs, dt, 0); };

  // ---- deploying a carried craft (the rideshare dispenser lets its cubesats go) ----
  M.canDeploy = function () { const c = this.v.craft; return !!(c && typeOf(c.type).carries && (c.carried === undefined ? typeOf(c.type).carries.n : c.carried) > 0 && c.power !== false && !c.brown); };
  M.deployChild = function () {
    const v = this.v, c = v.craft; if (!this.canDeploy()) return false; const T = typeOf(c.type), k = T.carries; c.carried = (c.carried === undefined ? k.n : c.carried) - 1;
    const nose = P.noseOf(v), side = V.norm(V.cross(nose, V.norm(v.r))), n = k.n - c.carried, ang = n / k.n * Math.PI * 2, out = V.norm(V.add(V.scale(side, Math.cos(ang)), V.scale(V.norm(v.r), Math.sin(ang)))), cm = typeOf(k.type).mass;
    const o = this.fleet.add({ name: `${typeOf(k.type).name} ${n} of ${k.n}`, type: k.type, origin: false, r: V.addS(v.r, out, 1.5), v: V.addS(v.v, out, 0.6), t: this.tAbs, body: this.body, m: cm, house: c.house, power: true });
    this.call('vesselDeployed', o); this.toast(`🛰 ${o.name} deployed. Switch to it with ]`, '#7dffb0'); return o; };
  M.craftStage = function () { const c = this.v.craft; if (c && typeOf(c.type).carries && this.v.cur >= this.last) return this.deployChild() ? 'deploy' : (this.toast(c.power === false ? 'Power the craft on first' : 'Nothing left to deploy', '#ffb35c'), 'none'); return null; };

  // ---- losing the flown vessel without ending the flight (a payload re-enters; the rocket stage is still up there) ----
  M.loseVessel = function (reason) {
    const cur = this.fleet.active; if (!cur || !this.v.craft || this.fleet.list.length < 2) return false;
    this.fleet.remove(cur.id); this.call('vesselLost', cur, reason); this.toast(`💥 ${cur.name} lost — ${reason}`, '#ff6262');
    const next = this.fleet.get(this.originId) || this.fleet.list[0]; this.v.throttle = this.v.ut = 0; this.takeVessel(next); this.toast(`🎮 You now fly ${next.name}`, '#7dffa6'); return true; };
  // once per frame: vessels that came down are gone
  M.fleetTick = function () {
    this.syncSeparated(); if (this.fleet.list.length < 2) return; const gone = this.fleet.prune(this.tAbs);
    for (const o of gone) { this.call('vesselGone', o); if (!o.lost) this.toast(`${o.name} re-entered and burned up`, '#ffb35c'); } };
  M.craftHintText = function () {
    const v = this.v, c = v.craft; if (!c) return '';
    if (c.type === 'stage') { const dv = Math.round(Math.max(0, engineDv(v)) * 2.23694); return `Flying ${c.name} · ${dv} mph of Δv left · [ ] switch craft`; }
    const T = typeOf(c.type), pr = PROPULSION[T.prop], dv = engineDv(v);
    if (c.power === false) return `${c.name} is OFF — press - to power it on`;
    if (c.brown) return `${c.name}: battery empty — waiting for sunlight`;
    if (v.thrust > 0) return `${pr.name} burning · ${Math.round(dv)} m/s of Δv left`;
    return `Flying ${c.name} · ${pr.name} · ${Math.round(dv * 2.23694)} mph of Δv left · [ ] switch craft`; };
}
export { recFor, lastPowOf, buildCraftVehicle, batteryPct, muOfBody, engineDv };
