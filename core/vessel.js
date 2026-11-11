// One vessel: identity, where it is, and the part tree it is made of.
// Situation is a state machine. Flight is not a separate object; it is one of these states.
// Decoupling splits the tree into two vessels. Docking hangs one tree on the other and
// leaves the guest docked, with its parts moved onto the host.

import { PartTree } from './parttree.js';

export const SITUATIONS = Object.freeze(['prelaunch', 'landed', 'flying', 'orbiting', 'escaping', 'docked', 'destroyed']);

// Legal moves. The constructor may start in any situation (a save already there).
const NEXT = {
  prelaunch: ['flying', 'destroyed'],
  landed: ['flying', 'prelaunch', 'destroyed'],
  flying: ['landed', 'orbiting', 'escaping', 'docked', 'destroyed'],
  orbiting: ['flying', 'escaping', 'landed', 'docked', 'destroyed'],
  escaping: ['orbiting', 'flying', 'docked', 'destroyed'],
  docked: ['orbiting', 'flying', 'landed', 'destroyed'],
  destroyed: [],
};

const finite = (x, fallback) => { const n = +x; return Number.isFinite(n) ? n : fallback; };
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const copy3 = a => (Array.isArray(a) ? [0, 1, 2].map(i => finite(a[i], 0)) : [0, 0, 0]);

export const canTransition = (from, to) => (NEXT[from] || []).includes(to);

export class Vessel {
  constructor(rec = {}) {
    this.id = rec.id || 'v0';
    this.name = rec.name || 'Vessel';
    const situation = rec.situation || 'prelaunch';
    if (!SITUATIONS.includes(situation)) throw new Error('unknown situation ' + situation);
    this.situation = situation;
    this.body = rec.body || 'earth';
    const orbit = rec.orbit && typeof rec.orbit === 'object' ? rec.orbit : null;
    this.orbit = {
      epoch: finite(orbit ? orbit.epoch : rec.t, 0),
      r: copy3(orbit ? orbit.r : rec.r),
      v: copy3(orbit ? orbit.v : rec.v),
    };
    const control = rec.control && typeof rec.control === 'object' ? rec.control : null;
    this.control = {
      sas: (control && control.sas) || rec.sas || 'stab',
      throttle: finite(control ? control.throttle : rec.throttle, 0),
    };
    this.nodes = Array.isArray(rec.nodes) ? clone(rec.nodes) : [];
    this.legacy = rec.legacy == null ? null : clone(rec.legacy);
    this.dockedTo = rec.dockedTo || null;
    this.tree = PartTree.fromJSON(Array.isArray(rec.parts) ? rec.parts : []);
  }
  // Snapshot the save shape. Callers that only need to read parts use this too.
  get parts() { return this.tree.toJSON(); }
  transition(next) {
    if (!SITUATIONS.includes(next)) throw new Error('unknown situation ' + next);
    if (next === this.situation) return this;
    if (!canTransition(this.situation, next)) throw new Error('cannot go from ' + this.situation + ' to ' + next);
    this.situation = next;
    return this;
  }
  // Drop the subtree at uid into a new vessel. This vessel keeps the rest.
  split(uid, opts = {}) {
    if (this.situation === 'destroyed') throw new Error('destroyed');
    const { kept, dropped } = this.tree.split(uid);
    this.tree = kept;
    const situation = this.situation === 'prelaunch' || this.situation === 'landed' ? this.situation : 'flying';
    return new Vessel({
      id: opts.id || this.id + ':s' + uid,
      name: opts.name || this.name + ' stage',
      situation,
      body: this.body,
      orbit: this.orbit,
      parts: dropped.toJSON(),
      control: { sas: this.control.sas, throttle: 0 },
      nodes: [],
      legacy: { source: 'split', from: this.id },
    });
  }
  // Move guest's parts onto this tree. Guest stays in the registry as docked, with an empty tree.
  merge(guest, opts = {}) {
    if (!(guest instanceof Vessel)) throw new Error('no guest vessel');
    if (this.situation === 'destroyed' || guest.situation === 'destroyed') throw new Error('destroyed');
    if (!guest.tree.root) throw new Error('guest tree is empty');
    guest.transition('docked');
    const hostUid = opts.hostUid != null ? opts.hostUid : this.tree.root.uid;
    this.tree = this.tree.merge(guest.tree, { hostUid, attachNode: opts.attachNode || 'dock' });
    guest.tree = new PartTree();
    guest.dockedTo = this.id;
    return this;
  }
  toJSON() {
    const o = {
      id: this.id,
      name: this.name,
      situation: this.situation,
      body: this.body,
      orbit: { epoch: this.orbit.epoch, r: this.orbit.r.slice(), v: this.orbit.v.slice() },
      parts: this.parts,
      control: { sas: this.control.sas, throttle: this.control.throttle },
      nodes: clone(this.nodes),
      legacy: this.legacy == null ? null : clone(this.legacy),
    };
    if (this.dockedTo) o.dockedTo = this.dockedTo;
    return o;
  }
  static fromJSON(o) { return new Vessel(o || {}); }
}
