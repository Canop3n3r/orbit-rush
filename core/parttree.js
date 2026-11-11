// A vessel is a tree of parts. Each part has a uid, a spec id (from vehicles/ data, or a
// legacy part id when that is all a save has), a parent, the attach node it hangs from, and
// its own state (fuel, charge, and whatever else that part carries).
// Split detaches a subtree (decoupling). Merge hangs one tree off a part of another (docking).
// Nothing here imports the renderer or the page.

const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

function asPart(p, { assignUid } = {}) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('not a part');
  if (typeof p.spec !== 'string' || !p.spec) throw new Error('part needs a spec id');
  let uid = p.uid == null ? null : p.uid;
  if (uid != null && (!Number.isInteger(uid) || uid < 1)) throw new Error('bad uid ' + uid);
  const parent = p.parent == null ? null : p.parent;
  if (parent != null && (!Number.isInteger(parent) || parent < 1)) throw new Error('bad parent ' + parent);
  const attachNode = parent == null ? null : (p.attachNode == null || p.attachNode === '' ? 'bottom' : String(p.attachNode));
  const state = p.state == null ? {} : clone(p.state);
  if (state == null || typeof state !== 'object' || Array.isArray(state)) throw new Error('bad part state');
  return { uid, spec: p.spec, parent, attachNode, state };
}

function indexParts(parts) {
  const by = new Map();
  let roots = 0;
  for (const p of parts) {
    if (by.has(p.uid)) throw new Error('duplicate uid ' + p.uid);
    by.set(p.uid, p);
    if (p.parent == null) roots++;
  }
  if (parts.length && roots !== 1) throw new Error(roots === 0 ? 'cycle or no root' : 'more than one root');
  for (const p of parts) {
    if (p.parent != null && !by.has(p.parent)) throw new Error('missing parent ' + p.parent);
    const seen = new Set();
    let cur = p;
    while (cur.parent != null) {
      if (seen.has(cur.uid)) throw new Error('cycle at uid ' + cur.uid);
      seen.add(cur.uid);
      cur = by.get(cur.parent);
    }
  }
  return by;
}

export class PartTree {
  constructor(parts = []) {
    const list = [];
    const by = new Map();
    for (const raw of parts) {
      const p = asPart(raw);
      if (p.uid == null) p.uid = nextUid(by);
      if (by.has(p.uid)) throw new Error('duplicate uid ' + p.uid);
      if (p.parent == null) {
        if ([...by.values()].some(q => q.parent == null)) throw new Error('more than one root');
      } else if (!by.has(p.parent)) throw new Error('missing parent ' + p.parent);
      list.push(p);
      by.set(p.uid, p);
    }
    this._parts = list;
    this._by = by;
  }
  get root() {
    return this._parts.find(p => p.parent == null) || null;
  }
  get(uid) { return this._by.get(uid) || null; }
  children(uid) { return this._parts.filter(p => p.parent === uid); }
  add(raw) {
    const p = asPart(raw);
    if (p.uid == null) p.uid = nextUid(this._by);
    if (this._by.has(p.uid)) throw new Error('duplicate uid ' + p.uid);
    if (p.parent == null) {
      if (this.root) throw new Error('more than one root');
    } else if (!this._by.has(p.parent)) throw new Error('missing parent ' + p.parent);
    this._parts.push(p);
    this._by.set(p.uid, p);
    return p;
  }
  toJSON() { return this._parts.map(p => ({ uid: p.uid, spec: p.spec, parent: p.parent, attachNode: p.attachNode, state: clone(p.state) })); }
  static fromJSON(list) {
    if (!Array.isArray(list)) throw new Error('not a part list');
    if (!list.length) return new PartTree();
    const parts = list.map(p => {
      const c = asPart(p);
      if (c.uid == null) throw new Error('part needs a uid');
      return c;
    });
    indexParts(parts);
    const tree = new PartTree();
    tree._parts = parts;
    tree._by = new Map(parts.map(p => [p.uid, p]));
    return tree;
  }
  // Detach the subtree at uid. The detached part becomes the root of the new tree.
  // The receiver is left unchanged.
  split(uid) {
    const part = this.get(uid);
    if (!part) throw new Error('no part ' + uid);
    const drop = new Set();
    const walk = id => { drop.add(id); for (const c of this.children(id)) walk(c.uid); };
    walk(uid);
    const kept = [], dropped = [];
    for (const p of this.toJSON()) {
      if (!drop.has(p.uid)) kept.push(p);
      else dropped.push(p.uid === uid ? { ...p, parent: null, attachNode: null } : p);
    }
    return { kept: PartTree.fromJSON(kept), dropped: PartTree.fromJSON(dropped) };
  }
  // Hang other's root off hostUid. Colliding uids on the guest are renumbered.
  // Both receivers are left unchanged.
  merge(other, { hostUid, attachNode = 'dock' } = {}) {
    if (!(other instanceof PartTree)) throw new Error('no guest tree');
    if (!other.root) throw new Error('guest tree is empty');
    const host = this.get(hostUid);
    if (!host) throw new Error('no host part ' + hostUid);
    const guest = other.toJSON();
    const used = new Set(this._parts.map(p => p.uid));
    if (guest.some(p => used.has(p.uid))) {
      let n = Math.max(0, ...used, ...guest.map(p => p.uid)) + 1;
      const map = new Map(guest.map(p => [p.uid, n++]));
      for (const p of guest) {
        p.uid = map.get(p.uid);
        if (p.parent != null) p.parent = map.get(p.parent);
      }
    }
    const root = guest.find(p => p.parent == null);
    root.parent = host.uid;
    root.attachNode = attachNode;
    return PartTree.fromJSON(this.toJSON().concat(guest));
  }
}

function nextUid(by) {
  let n = 0;
  for (const id of by.keys()) if (id > n) n = id;
  return n + 1;
}
