// Tracking Station. Lists every vessel, draws them on the existing solar map,
// and time-warps the one universe clock. Fly hands the chosen vessel to today's
// flight view. core/ stays headless; the page lives only in this file.

import { Universe, SAVE_KEY } from '../core/universe.js?v=f5.9-46';
import { advanceUnloaded, coast } from '../core/propagator.js?v=f5.9-46';
import { WARPS } from '../flight.js?v=f5.9-40';
import { describeVessel, mapView, emptyFlight } from './session.js?v=f5.9-46';

function fmtUT(t) {
  t = Math.max(0, Math.floor(+t || 0));
  const d = Math.floor(t / 86400);
  const h = Math.floor(t / 3600) % 24;
  const m = Math.floor(t / 60) % 60;
  const s = t % 60;
  const clock = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
  return d ? 'T+' + d + 'd ' + clock : 'T+' + clock;
}

function fmtWarp(w) {
  if (w >= 1e6) return '×' + (w / 1e6) + 'M';
  if (w >= 1000) return '×' + (w / 1000) + 'k';
  return '×' + w;
}

export function createTracking({ store, map, onFly, onBack }) {
  const scene = {
    universe: null,
    live: false,
    focusId: null,
    wi: 0,
    dirty: false,
    saveT: 1,
    note: '',
    noteT: 0,
    root: null,
    enter() {
      if (scene.live) return;
      scene.live = true;
      let had = null;
      try { had = store.getItem(SAVE_KEY); } catch (e) { had = null; }
      try { scene.universe = Universe.load(store); }
      catch (e) { scene.universe = new Universe(); }
      scene.universe.clock.setMode('rails');
      scene.universe.clock.setWarp(1);
      scene.wi = 0;
      try { advanceUnloaded(scene.universe); } catch (e) { /* a bad vessel must not block the station */ }
      if (had == null) {
        try { scene.universe.save(store); } catch (e) {}
      }
      scene.focusId = scene.universe.activeId && scene.universe.get(scene.universe.activeId) ? scene.universe.activeId : null;
      scene.note = '';
      scene.noteT = 0;
      scene.dirty = false;
      scene.saveT = 1;
      scene.build();
      scene.bindMap();
      document.body.classList.add('tracking');
      scene.onKey = e => { if (e.code === 'Escape') { e.preventDefault(); if (onBack) onBack(); } };
      addEventListener('keydown', scene.onKey);
    },
    exit() {
      if (!scene.live) return;
      scene.live = false;
      if (scene.universe) {
        scene.universe.clock.setWarp(1);
        try { scene.universe.save(store); } catch (e) {}
      }
      if (map && map.setHost) map.setHost(null);
      document.body.classList.remove('tracking');
      if (scene.root) scene.root.remove();
      scene.root = null;
      if (scene.onKey) removeEventListener('keydown', scene.onKey);
    },
    tick(dt) {
      if (!scene.live || !scene.universe) return;
      const clock = scene.universe.clock;
      if (clock.warp > 1) {
        const sim = Math.max(0, dt) * clock.effective;
        let res = null;
        try { res = coast(scene.universe, sim); } catch (e) { res = null; }
        if (res && res.stopped) {
          scene.note = res.stopped.type === 'soi' ? 'Warp stopped: sphere of influence' : 'Warp stopped: surface';
          scene.noteT = 4;
          scene.wi = 0;
        }
        scene.dirty = true;
      } else if (scene.noteT > 0) scene.noteT -= dt;
      if (scene.noteT <= 0) scene.note = '';
      scene.paint();
      scene.saveT -= dt;
      if (scene.dirty && scene.saveT <= 0) {
        try { scene.universe.save(store); } catch (e) {}
        scene.dirty = false;
        scene.saveT = 1;
      }
    },
    build() {
      const root = document.createElement('div');
      root.id = 'trackStation';
      root.innerHTML = '<header class="tsChrome tsHead"><button type="button" id="tsBack">Back</button><h1>TRACKING</h1><span id="tsUT"></span></header><div class="tsGap"></div><section class="tsChrome tsDock"><div id="tsList" class="tsList"></div><p id="tsEmpty" class="tsEmpty" hidden></p><p id="tsNote" class="tsNote" hidden></p><div class="tsWarp"><button type="button" id="tsDown" aria-label="Slower">Slower</button><button type="button" id="tsRate" aria-label="Time warp, tap for real time">×1</button><button type="button" id="tsUp" aria-label="Faster">Faster</button></div><button type="button" id="tsFly" class="tsFly">Fly</button></section>';
      document.body.appendChild(root);
      scene.root = root;
      root.querySelector('#tsBack').onclick = () => { if (onBack) onBack(); };
      root.querySelector('#tsDown').onclick = () => scene.setRate(scene.wi - 1);
      root.querySelector('#tsUp').onclick = () => scene.setRate(scene.wi + 1);
      root.querySelector('#tsRate').onclick = () => scene.setRate(0);
      root.querySelector('#tsFly').onclick = () => scene.fly();
      scene.paint();
    },
    setRate(i) {
      scene.wi = Math.max(0, Math.min(WARPS.length - 1, i));
      scene.universe.clock.setMode('rails');
      scene.universe.clock.setWarp(WARPS[scene.wi]);
      if (scene.wi === 0) scene.note = '';
      scene.dirty = true;
      scene.paint();
    },
    fly() {
      const vessel = scene.universe && scene.universe.get(scene.focusId);
      if (!vessel || vessel.situation === 'destroyed') return;
      scene.universe.clock.setWarp(1);
      try { scene.universe.save(store); } catch (e) {}
      if (onFly) onFly(vessel.id);
    },
    bindMap() {
      if (!map || !map.setHost) return;
      const view = mapView(scene.universe, scene.focusId);
      if (!view) {
        map.setHost({ quiet: true, hideCraft: true, panDrag: true, getF: () => emptyFlight(scene.universe), getSats: () => [], craftLabel: () => 'craft' });
        map.show(true);
        if (map.recenter) map.recenter();
        return;
      }
      scene.focusId = view.focusId;
      map.setHost({
        quiet: true,
        hideCraft: false,
        panDrag: true,
        craftLabel: () => { const v = scene.universe.get(scene.focusId); return v ? v.name : 'craft'; },
        getF: () => { const v = mapView(scene.universe, scene.focusId); return v ? v.flight : emptyFlight(scene.universe); },
        getSats: () => { const v = mapView(scene.universe, scene.focusId); return v ? v.sats : []; },
      });
      map.show(true);
      if (map.recenter) map.recenter();
    },
    select(id) {
      scene.focusId = id;
      scene.universe.setActive(id);
      scene.bindMap();
      scene.paint();
    },
    paint() {
      if (!scene.root || !scene.universe) return;
      const vessels = [...scene.universe.vessels.values()];
      if (!scene.focusId || !scene.universe.get(scene.focusId)) scene.focusId = vessels[0] ? vessels[0].id : null;
      const list = scene.root.querySelector('#tsList');
      const have = list.querySelectorAll('.tsRow');
      const same = have.length === vessels.length && [...have].every((el, i) => el.dataset.id === vessels[i].id);
      if (!same) {
        list.textContent = '';
        for (const vessel of vessels) {
          const line = describeVessel(vessel);
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'tsRow';
          b.dataset.id = vessel.id;
          const name = document.createElement('b');
          name.textContent = line.name;
          const meta = document.createElement('small');
          meta.textContent = line.bodyName + ' · ' + line.situationLabel;
          b.append(name, meta);
          b.onclick = () => scene.select(vessel.id);
          list.appendChild(b);
        }
      } else {
        vessels.forEach((vessel, i) => {
          const line = describeVessel(vessel);
          const b = have[i];
          b.querySelector('b').textContent = line.name;
          b.querySelector('small').textContent = line.bodyName + ' · ' + line.situationLabel;
        });
      }
      list.querySelectorAll('.tsRow').forEach(el => el.classList.toggle('on', el.dataset.id === scene.focusId));
      const empty = scene.root.querySelector('#tsEmpty');
      empty.hidden = vessels.length > 0;
      empty.textContent = 'No craft in space yet. Fly a rocket, or open this again after a quicksave.';
      const note = scene.root.querySelector('#tsNote');
      note.hidden = !scene.note;
      note.textContent = scene.note;
      scene.root.querySelector('#tsUT').textContent = fmtUT(scene.universe.clock.ut);
      const rate = WARPS[scene.wi] || 1;
      if (scene.universe.clock.warp !== rate) {
        const i = WARPS.indexOf(scene.universe.clock.warp);
        scene.wi = i >= 0 ? i : 0;
      }
      const rateBtn = scene.root.querySelector('#tsRate');
      rateBtn.textContent = fmtWarp(scene.universe.clock.warp);
      const focus = scene.universe.get(scene.focusId);
      const fly = scene.root.querySelector('#tsFly');
      const dead = !focus || focus.situation === 'destroyed';
      fly.disabled = dead;
      fly.textContent = !focus ? 'Fly' : (focus.situation === 'destroyed' ? 'Destroyed' : 'Fly ' + focus.name);
    },
  };
  return scene;
}
