// Orbit Rush f1 — WebAudio sound design (all synthesized, no sample files): wind roar tied to dynamic
// pressure, layered explosions (crack + boom + debris rattle), part-snap clicks, UI ticks and a fanfare, and a
// remembered mute that the engine rumble shares through the master gain.
export function createAudio(getCtx) {
  const KEY = 'orbitrush.mute'; let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } })();
  let wind = null, windF = null;
  const A = () => getCtx(), M = () => getCtx() && getCtx().master;
  function noise(sec) { const ac = A().ac, b = ac.createBuffer(1, Math.max(1, ac.sampleRate * sec) | 0, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  function env(node, t0, a, peak, dec) { const g = A().ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec); node.connect(g); g.connect(M()); return g; }
  function tone(f, dur, type = 'sine', vol = 0.08, t = 0, f2) { const c = A(); if (!c) return; const ac = c.ac, o = ac.createOscillator(), t0 = ac.currentTime + t; o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur); env(o, t0, 0.005, vol, dur); o.start(t0); o.stop(t0 + dur + 0.05); }
  function hiss(dur, freq, vol, t = 0, type = 'lowpass') { const c = A(); if (!c) return; const ac = c.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), t0 = ac.currentTime + t; s.buffer = noise(dur + 0.1); f.type = type; f.frequency.value = freq; s.connect(f); env(f, t0, 0.004, vol, dur); s.start(t0); }
  const api = {
    get muted() { return muted; },
    apply() { const c = A(); if (c && c.master) c.master.gain.value = muted ? 0 : 1; },
    toggleMute() { muted = !muted; try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { } api.apply(); return muted; },
    ui(kind) { if (!A()) return; if (kind === 'fanfare') { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.06, i * 0.09)); } else if (kind === 'snap') { hiss(0.05, 4000, 0.25, 0, 'bandpass'); tone(180, 0.08, 'square', 0.05); } else tone(1200, 0.06, 'sine', 0.04); },
    boom(big, dist = 0) { if (!A()) return; const k = 1 / (1 + dist / 2000), lag = Math.min(3, dist / 343);
      hiss(0.12, 6000, 0.6 * k, lag, 'highpass'); hiss(big ? 2.8 : 1.6, 400, (big ? 1.0 : 0.7) * k, lag); tone(70, big ? 1.6 : 1.0, 'sine', 0.5 * k, lag, 30);
      for (let i = 0; i < 6; i++) hiss(0.08, 2500, 0.15 * k, lag + 0.3 + Math.random() * 1.2, 'bandpass'); },
    // continuous wind roar from dynamic pressure (Pa) and Mach
    wind(q, mach) { const c = A(); if (!c) return; const ac = c.ac;
      if (!wind) { const s = ac.createBufferSource(); s.buffer = noise(2); s.loop = true; windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = 0.7; wind = ac.createGain(); wind.gain.value = 0; s.connect(windF).connect(wind).connect(c.master); s.start(); }
      wind.gain.setTargetAtTime(Math.min(0.35, q / 60000), ac.currentTime, 0.2); windF.frequency.setTargetAtTime(300 + Math.min(2.5, mach || 0) * 900, ac.currentTime, 0.3); },
  };
  return api;
}
