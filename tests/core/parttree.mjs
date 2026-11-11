// Part tree: one vessel is parts with a spec id, a parent, an attach node, and per-part state.
// Run: node tests/core/parttree.mjs
import { PartTree } from '../../core/parttree.js';

let pass = 0, fail = 0;
const ok = (c, m, x = '') => { if (c) { pass++; console.log('  ✔', m, x); } else { fail++; console.log('  ✘', m, x); } };
const fuelOf = (tree, spec) => tree.toJSON().find(p => p.spec === spec).state.fuel;

console.log('1. A tree is parts linked by parent and attach node');
{
  const tree = new PartTree();
  const root = tree.add({ spec: 'probe-core', state: { elec: 80 } });
  const tank = tree.add({ spec: 'tank-m', parent: root.uid, attachNode: 'bottom', state: { fuel: 20 } });
  const eng = tree.add({ spec: 'kero-dv', parent: tank.uid, attachNode: 'bottom', state: { n: 1 } });
  ok(root.uid === 1 && tank.uid === 2 && eng.uid === 3, 'uids are assigned in order when omitted');
  ok(root.parent === null && root.attachNode === null && tank.attachNode === 'bottom' && tank.parent === 1, 'the root has no parent; a child names the node it hangs from');
  ok(tree.root.uid === 1 && tree.children(1).length === 1 && tree.children(1)[0].uid === 2, 'children are derived from the parent link');
  ok(tree.get(3).spec === 'kero-dv' && tree.get(3).state.fuel === undefined && tree.get(2).state.fuel === 20, 'spec id and per-part state stay on the part');
  const caller = { fuel: 4 };
  tree.add({ spec: 'rcs', parent: 1, attachNode: 'radial', state: caller });
  caller.fuel = 0;
  ok(tree.get(4).state.fuel === 4, 'state is copied off the caller object');
  let dup = false; try { tree.add({ uid: 1, spec: 'x', parent: 1, attachNode: 'bottom' }); } catch (e) { dup = /uid/i.test(e.message); }
  ok(dup, 'a repeated uid is rejected');
  let orphan = false; try { tree.add({ spec: 'x', parent: 99, attachNode: 'bottom' }); } catch (e) { orphan = /parent/i.test(e.message); }
  ok(orphan, 'a parent that is not in the tree is rejected');
  let second = false; try { tree.add({ spec: 'other-root' }); } catch (e) { second = /root/i.test(e.message); }
  ok(second, 'a second root is rejected');
  const back = PartTree.fromJSON(tree.toJSON());
  ok(JSON.stringify(back.toJSON()) === JSON.stringify(tree.toJSON()), 'JSON round-trips uid, spec, parent, attach node and state');
  let bad = false; try { PartTree.fromJSON([{ uid: 1, spec: 'a', parent: 2 }, { uid: 2, spec: 'b', parent: 1 }]); } catch (e) { bad = /parent|cycle|root/i.test(e.message); }
  ok(bad, 'a cycle is rejected');
}

console.log('2. Split detaches a subtree; merge joins two trees at an attach node');
{
  const tree = PartTree.fromJSON([
    { uid: 1, spec: 'probe-core', parent: null, attachNode: null, state: { elec: 80 } },
    { uid: 2, spec: 'upper-tank', parent: 1, attachNode: 'bottom', state: { fuel: 8 } },
    { uid: 3, spec: 'sep', parent: 2, attachNode: 'bottom', state: {} },
    { uid: 4, spec: 'booster-tank', parent: 3, attachNode: 'bottom', state: { fuel: 40 } },
    { uid: 5, spec: 'kero-d', parent: 4, attachNode: 'bottom', state: { n: 9 } },
    { uid: 6, spec: 'side-tank', parent: 4, attachNode: 'radial', state: { fuel: 12 } },
  ]);
  const { kept, dropped } = tree.split(3);
  ok(tree.toJSON().length === 6, 'split returns two trees and leaves the source alone');
  ok(kept.root.spec === 'probe-core' && kept.toJSON().every(p => p.uid !== 3 && p.uid !== 4 && p.uid !== 6), 'the kept tree is the part above the split');
  ok(dropped.root.uid === 3 && dropped.root.parent === null && dropped.root.attachNode === null, 'the detached part becomes the root of the new tree');
  ok(fuelOf(dropped, 'booster-tank') === 40 && fuelOf(dropped, 'side-tank') === 12 && fuelOf(kept, 'upper-tank') === 8, 'fuel on both sides is the fuel those parts already had');
  ok(dropped.get(6).attachNode === 'radial' && dropped.get(6).parent === 4, 'a radial child stays attached inside the detached tree');
  let missing = false; try { tree.split(42); } catch (e) { missing = /part/i.test(e.message); }
  ok(missing, 'splitting a missing part is rejected');

  const probe = new PartTree();
  probe.add({ uid: 1, spec: 'probe-core', state: { elec: 10, fuel: 1 } });
  // The guest root is the port that docks. Everything else hangs off that port.
  const pod = new PartTree();
  pod.add({ uid: 1, spec: 'dock-port', state: { fuel: 0.2 } });
  pod.add({ uid: 2, spec: 'crew-pod', parent: 1, attachNode: 'top', state: { elec: 40 } });
  const joined = probe.merge(pod, { hostUid: 1, attachNode: 'dock' });
  ok(probe.toJSON().length === 1 && pod.toJSON().length === 2, 'merge returns a new tree and leaves both sources alone');
  const port = joined.toJSON().find(p => p.spec === 'dock-port');
  const crew = joined.toJSON().find(p => p.spec === 'crew-pod');
  ok(port && port.parent === 1 && port.attachNode === 'dock' && port.state.fuel === 0.2, 'the guest root hangs off the host part on the dock node, fuel unchanged');
  ok(crew && crew.parent === port.uid && crew.attachNode === 'top' && crew.state.elec === 40, 'the rest of the guest tree keeps its shape after uids move');
  ok(joined.toJSON().every((p, i, a) => a.findIndex(q => q.uid === p.uid) === i), 'uids are unique after a colliding guest is renumbered');
  const again = joined.merge(PartTree.fromJSON([{ uid: 7, spec: 'can', parent: null, state: { fuel: 3 } }]), { hostUid: port.uid });
  ok(again.get(7).parent === port.uid && again.get(7).attachNode === 'dock' && again.get(7).state.fuel === 3, 'a guest whose uids are free keeps them');
  let noHost = false; try { probe.merge(pod, { hostUid: 9 }); } catch (e) { noHost = /host|part/i.test(e.message); }
  ok(noHost, 'merging onto a missing part is rejected');
}

console.log(`\nparttree: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
