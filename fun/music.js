// Orbit Rush f6.3 — procedural music (WebAudio only, no sample files, nothing to license).
//   menu  : quiet lofi / ambient-electronic beat, ~94 bpm, A minor, for Home, the rocket picker, the pause screen and the end card
//   space : calm ambient synth score for flight above the atmosphere: slow pads, a deep drone, sparse soft arps through a delay
// Track trim: the beat is mostly short hits, the pads are sustained, so the beat is trimmed up (x2) and the score down (x0.5) to sit at a similar loudness. One track plays at a time; switching crossfades. `mbus` (owned by the caller) carries the music volume (~ -18 dB at the default setting).
export const MUSIC_BASE = 0.25; // bus gain at slider 1.0; the default slider 0.5 is 0.125 = about -18 dB
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const N = { A: 9, B: 11, C: 0, D: 2, E: 4, F: 5, G: 7, Bb: 10 }; const note = (n, oct) => N[n] + 12 * (oct + 1);
export function createMusic(getCtx) {
  let enabled = true, vol = 0.5, cur = null, notes = 0, want = null, wantLevel = 1, cache = null, lastCtx = null, an = null, anFor = null;
  const C = () => { const c = getCtx(); return c && c.ac && c.mbus ? c : null; };
  function shared(c) { // per-context noise + reverb impulse
    if (cache && lastCtx === c.ac) return cache; lastCtx = c.ac; const ac = c.ac, sr = ac.sampleRate;
    const nz = ac.createBuffer(1, sr, sr), nd = nz.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const cr = ac.createBuffer(1, sr * 4, sr), cd = cr.getChannelData(0); // vinyl crackle: sparse pops with a short decay
    for (let k = 0; k < 70; k++) { const at = (Math.random() * (cd.length - 400)) | 0, a = (0.25 + Math.random() * 0.75) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 220; j++) cd[at + j] += a * Math.exp(-j / 28) * (j % 2 ? 0.6 : 1); }
    const rl = Math.floor(sr * 3.2), ri = ac.createBuffer(2, rl, sr); for (let ch = 0; ch < 2; ch++) { const d = ri.getChannelData(ch); for (let i = 0; i < rl; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / rl, 2.6); }
    return (cache = { nz, cr, ri });
  }
  function mk(c, fade) { // track skeleton: out gain -> mbus, a dry bus, a reverb send, and a list of persistent nodes to stop on dispose
    const ac = c.ac, S = shared(c), t = ac.currentTime, out = ac.createGain(); out.gain.setValueAtTime(0.0001, t); out.connect(c.mbus);
    const dry = ac.createGain(), send = ac.createGain(), rev = ac.createConvolver(); rev.buffer = S.ri; send.gain.value = 0.3; const rg = ac.createGain(); rg.gain.value = 0.9; dry.connect(out); dry.connect(send); send.connect(rev); rev.connect(rg); rg.connect(out);
    return { ac, S, out, dry, send, rev, persist: [], timer: 0, born: t, fade };
  }
  // ---- generic voices ----
  function voice(T, f, t0, dur, type, peak, atk, dst, detune = 0, lp) {
    const ac = T.ac, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; if (detune) o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + atk); g.gain.exponentialRampToValueAtTime(0.0001, t0 + atk + dur); o.connect(g); let tail = g; if (lp) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = lp; g.connect(b); tail = b; } tail.connect(dst || T.dry); o.start(t0); o.stop(t0 + atk + dur + 0.1); notes++; return g;
  }
  function noiseHit(T, t0, dur, freq, type, peak, q = 1) { const ac = T.ac, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = T.S.nz; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(peak, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(g); g.connect(T.dry); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05); notes++; }
  function kick(T, t0, v = 0.9) { const ac = T.ac, o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(125, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14); g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38); o.connect(g); g.connect(T.dry); o.start(t0); o.stop(t0 + 0.42); notes++; }
  // ---- menu beat ----
  const MENU_BPM = 94, SIXT = 60 / MENU_BPM / 4;
  // Am9 | Fmaj7 | Dm9 | Em7 : bass root, chord tones
  const PROG = [[note('A', 1), [note('A', 3), note('C', 4), note('E', 4), note('G', 4), note('B', 4)]], [note('F', 1), [note('F', 3), note('A', 3), note('C', 4), note('E', 4)]],
    [note('D', 1) + 12, [note('D', 3), note('F', 3), note('A', 3), note('C', 4), note('E', 4)]], [note('E', 1) + 12, [note('E', 3), note('G', 3), note('B', 3), note('D', 4)]]];
  const PENT = [note('A', 4), note('C', 5), note('D', 5), note('E', 5), note('G', 5), note('A', 5)];
  function startMenu(c) {
    const T = mk(c, 1.6), ac = T.ac; T.kind = 'menu';
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; T.dry.disconnect(); T.dry.connect(lp); lp.connect(T.out); lp.connect(T.send); // lofi dulling on everything
    const vc = ac.createBufferSource(), vf = ac.createBiquadFilter(), vg = ac.createGain(); vc.buffer = T.S.cr; vc.loop = true; vf.type = 'highpass'; vf.frequency.value = 1800; vg.gain.value = 0.05; vc.connect(vf); vf.connect(vg); vg.connect(T.out); vc.start(); T.persist.push(vc);
    T.next = ac.currentTime + 0.15; T.step = 0;
    T.tick = () => { const now = ac.currentTime; while (T.next < now + 0.45) { const s = T.step % 64, bar = (s / 16) | 0, i = s % 16, sw = (i % 2) ? SIXT * 0.22 : 0, t0 = T.next + sw, ch = PROG[bar];
        if (i === 0 || i === 10 && bar % 2 === 1 || i === 7 && bar % 2 === 0) kick(T, t0, i === 0 ? 0.95 : 0.7);
        if (i === 4 || i === 12) { noiseHit(T, t0, 0.2, 1900, 'bandpass', 0.32, 0.8); voice(T, 185, t0, 0.09, 'triangle', 0.18, 0.002); }
        if (i % 2 === 0) noiseHit(T, t0, 0.045, 8000, 'highpass', (i % 4 === 2 ? 0.1 : 0.15) * (0.7 + Math.random() * 0.6)); else if (Math.random() < 0.2) noiseHit(T, t0, 0.03, 8000, 'highpass', 0.05);
        if (i === 0 || i === 6 || i === 10) voice(T, mtof(i === 6 ? ch[0] + 7 : ch[0]), t0, i === 0 ? 0.7 : 0.35, 'sine', i === 0 ? 0.5 : 0.32, 0.01);
        if (i === 0 || (i === 10 && bar % 2 === 0)) ch[1].forEach((m, k) => { const tk = t0 + k * 0.014, v = i === 0 ? 0.075 : 0.05; voice(T, mtof(m), tk, i === 0 ? 2.4 : 1.1, 'sine', v, 0.015, T.dry, -4); voice(T, mtof(m), tk, i === 0 ? 2.0 : 0.9, 'triangle', v * 0.55, 0.02, T.dry, 5); });
        if (bar % 2 === 1 && i % 2 === 0 && Math.random() < 0.22) voice(T, mtof(PENT[(Math.random() * PENT.length) | 0]), t0, 0.9, 'sine', 0.06, 0.01);
        T.next += SIXT; T.step++; } };
    return T;
  }
  // ---- space score ----
  const SP_CH = [ // Dm(add9) | Bbmaj7#11 | Fmaj9 | Cadd9/E : a slow, open Dorian-ish loop
    { bass: note('D', 2), pad: [note('D', 3), note('A', 3), note('E', 4), note('F', 4)], arp: [note('D', 5), note('F', 5), note('A', 5), note('E', 5), note('C', 6)] },
    { bass: note('Bb', 1), pad: [note('Bb', 2), note('F', 3), note('A', 3), note('D', 4)], arp: [note('D', 5), note('F', 5), note('A', 5), note('E', 6)] },
    { bass: note('F', 1) + 12, pad: [note('F', 3), note('A', 3), note('C', 4), note('E', 4)], arp: [note('C', 5), note('E', 5), note('A', 5), note('G', 5)] },
    { bass: note('C', 2), pad: [note('G', 2), note('C', 3), note('E', 3), note('D', 4)], arp: [note('E', 5), note('G', 5), note('D', 5), note('C', 6)] }];
  const CH_SEC = 11;
  function startSpace(c) {
    const T = mk(c, 3), ac = T.ac; T.kind = 'space'; T.send.gain.value = 0.55;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6; T.pad = ac.createGain(); T.pad.gain.value = 1; T.pad.connect(lp); lp.connect(T.dry);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.045; lg.gain.value = 380; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(); T.persist.push(lfo);
    const dl = ac.createDelay(2), fb = ac.createGain(), df = ac.createBiquadFilter(), dgn = ac.createGain(); dl.delayTime.value = 0.82; fb.gain.value = 0.42; df.type = 'lowpass'; df.frequency.value = 1800; dgn.gain.value = 0.6; T.arp = ac.createGain(); T.arp.connect(T.dry); T.arp.connect(dl); dl.connect(df); df.connect(fb); fb.connect(dl); df.connect(dgn); dgn.connect(T.dry);
    const dr = ac.createOscillator(), drg = ac.createGain(); dr.type = 'sine'; dr.frequency.value = mtof(note('D', 1)); drg.gain.value = 0.28; dr.connect(drg); drg.connect(T.dry); dr.start(); T.persist.push(dr);
    const wob = ac.createOscillator(), wg = ac.createGain(); wob.frequency.value = 0.07; wg.gain.value = 0.1; wob.connect(wg); wg.connect(drg.gain); wob.start(); T.persist.push(wob);
    T.nextCh = ac.currentTime + 0.1; T.ci = 0; T.nextArp = ac.currentTime + 4;
    T.tick = () => { const now = ac.currentTime;
      if (T.nextCh < now + 0.5) { const t0 = T.nextCh, ch = SP_CH[T.ci % 4], rel = CH_SEC + 3;
        voice(T, mtof(ch.bass), t0, rel - 4, 'sine', 0.22, 4, T.pad);
        ch.pad.forEach((m, k) => { [-7, 6].forEach(d => voice(T, mtof(m), t0 + k * 0.4, rel - 3.5, 'sawtooth', 0.035, 3.5, T.pad, d)); voice(T, mtof(m + 12), t0 + k * 0.4, rel - 3, 'sine', 0.02, 4, T.pad); });
        T.cur = ch; T.nextCh += CH_SEC; T.ci++; }
      while (T.cur && T.nextArp < now + 0.5) { if (Math.random() < 0.6) { const m = T.cur.arp[(Math.random() * T.cur.arp.length) | 0]; voice(T, mtof(m), T.nextArp, 3.2, 'sine', 0.05 + Math.random() * 0.02, 0.012, T.arp); voice(T, mtof(m) * 2, T.nextArp, 1.2, 'triangle', 0.012, 0.01, T.arp); }
        T.nextArp += 1.1 + Math.random() * 2.3; } };
    return T;
  }
  function dispose(T, delay) { if (!T) return; clearInterval(T.timer); T.timer = 0; const ac = T.ac, t = ac.currentTime; try { T.out.gain.cancelScheduledValues(t); T.out.gain.setValueAtTime(Math.max(0.0001, T.out.gain.value), t); T.out.gain.linearRampToValueAtTime(0.0001, t + delay); } catch (e) { }
    setTimeout(() => { for (const n of T.persist) { try { n.stop(); } catch (e) { } } try { T.out.disconnect(); } catch (e) { } T.dead = true; }, delay * 1000 + 150); }
  function applyBus() { const c = C(); if (!c) return; try { c.mbus.gain.setTargetAtTime(enabled ? vol * MUSIC_BASE : 0, c.ac.currentTime, 0.05); } catch (e) { } }
  const api = {
    get enabled() { return enabled; }, get volume() { return vol; }, get mode() { return cur ? cur.kind : 'off'; },
    configure(o) { if (o.enabled !== undefined) enabled = !!o.enabled; if (o.volume !== undefined) vol = Math.max(0, Math.min(1, +o.volume)); applyBus(); },
    // kind: 'menu' | 'space' | null; level (0..1) scales the track (space music rises with the thinning air)
    set(kind, level = 1) {
      want = kind; wantLevel = level; const c = C(); if (!c || c.ac.state !== 'running') return; if (!enabled) kind = null;
      if (cur && cur.kind !== kind) { dispose(cur, cur.kind === 'space' ? 2.5 : 1.4); cur = null; }
      if (!cur && kind) { const me = cur = kind === 'menu' ? startMenu(c) : startSpace(c); me.tick(); me.timer = setInterval(() => { try { if (me === cur) me.tick(); } catch (e) { } }, 100); applyBus(); }
      if (cur) cur.out.gain.setTargetAtTime(Math.max(0.0001, Math.min(1, level)) * (cur.kind === 'menu' ? 2 : 0.5), c.ac.currentTime, (cur.fade || 1) / 3);
    },
    stop(fade = 0.4) { if (cur) { dispose(cur, fade); cur = null; } want = null; },
    probe() { const c = getCtx(); let rms = 0; try { if (c && c.mbus) { if (!an || anFor !== c.mbus) { an = c.ac.createAnalyser(); an.fftSize = 2048; c.mbus.connect(an); anFor = c.mbus; } const b = new Float32Array(an.fftSize); an.getFloatTimeDomainData(b); let s = 0; for (const x of b) s += x * x; rms = Math.sqrt(s / b.length); } } catch (e) { } return { mode: api.mode, want, level: cur ? cur.out.gain.value : 0, notes, enabled, volume: vol, bus: c && c.mbus ? c.mbus.gain.value : -1, rms, ctx: c && c.ac ? c.ac.state : 'none' }; },
  };
  return api;
}
