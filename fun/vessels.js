// Vessel switching for Flight (f6.2): which vessel you fly, parking and taking control, power, deploying carried craft, and the
// battery / power model of a piloted craft. Installed on Flight.prototype by flight.js (installVessels) so this stays one file.
// The rules in plain words (also in plans/CRAFT_SWITCH.md):
//  - Every vessel left in space is a fleet record (fun/fleet.js). The one you fly is Flight.v; every other vessel coasts on a Kepler orbit.
//  - You can switch only while coasting in space (above the rails altitude, engines off, booster not flying, return burn not under way).
//  - Switching never changes the game clock, time warp is dropped to x1, and a flight ends only on Home / Recover / destruction.
import * as P from '../physics.js?v=f5.8y';
import * as C from '../physics/patched.js?v=f5.8y';
import { Fleet, packVehicle, vehicleFor, describeVessel, advanceEnergy, sunlit, tumbleOf, batteryPct, muOfBody } from './fleet.js?v=f5.8y';
import { craftTypeFor, buildCraftVehicle, typeOf, PROPULSION, engineDv } from '../data/craft_types.js?v=f5.8y';
const V = P.V;
const recFor = veh => { const c = veh && veh.craft ? typeOf(veh.craft.type) : null; return c && c.shield && c.chute ? { capsule: true, shield: true, chute: true, shieldId: 'ablator' } : { capsule: false, shield: false, chute: false, shieldId: null }; };
const lastPowOf = v => { let k = 0; v.stages.forEach((s, i) => { if (s.eng && s.eng.tv > 0) k = i; }); return k; };

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
  M.canSwitch = function () {
    const v = this.v, b = this.booster; if (this.flags.dead) return { ok: false, why: 'The craft is destroyed' };
    if (!this.ignited || v.clamped) return { ok: false, why: 'Launch first: nothing to switch to on the pad' };
    if ((b && b.state === 'flying') || this.boosters.some(x => x.state === 'flying')) return { ok: false, why: 'Land the booster first' };
    if (this.parked) return { ok: false, why: 'This craft is parked on the ground' };
    if (this.ret && this.ret.phase !== 'coast') return { ok: false, why: 'Finish the return first' };
    if (this.alt < C.railsAltOf(this.body)) return { ok: false, why: 'Switch craft above ' + Math.round(C.railsAltOf(this.body) / 1000) + ' km, out of the air' };
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
    const ck = this.canSwitch(); if (!ck.ok) { if (!quiet) this.toast(ck.why, '#ffb35c'); return false; }
    const from = this.parkActive(); this.takeVessel(o);
    if (!quiet) this.toast(`🎮 You now fly ${o.name}` + (from ? ` · ${from.name} coasts` : ''), '#7dffa6'); return true; };
  M.cycleVessel = function (dir = 1) { const n = this.fleet.list.length; if (n < 2) { this.toast('Only one craft in space: release a payload first', '#ffb35c'); return false; }
    const i = this.vesselIndex(dir); return this.switchTo(this.fleet.list[i].id); };
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
    if (this.fleet.list.length < 2) return; const gone = this.fleet.prune(this.tAbs);
    for (const o of gone) { this.call('vesselGone', o); this.toast(`${o.name} re-entered and burned up`, '#ffb35c'); } };
  M.craftHintText = function () {
    const v = this.v, c = v.craft; if (!c) return ''; const T = typeOf(c.type), pr = PROPULSION[T.prop], dv = engineDv(v);
    if (c.power === false) return `${c.name} is OFF — press - to power it on`;
    if (c.brown) return `${c.name}: battery empty — waiting for sunlight`;
    if (v.thrust > 0) return `${pr.name} burning · ${Math.round(dv)} m/s of Δv left`;
    return `Flying ${c.name} · ${pr.name} · ${Math.round(dv * 2.23694)} mph of Δv left · [ ] switch craft`; };
}
export { recFor, lastPowOf, buildCraftVehicle, batteryPct, muOfBody, engineDv };
