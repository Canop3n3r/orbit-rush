// f5.9-44: STAGE stays lit while a stage remains, and is hidden once nothing is left — including orbit before RELEASE.
// Orbit must not show STAGE and RELEASE as two live actions. RELEASE stays on screen (≥40px) after STAGE is gone.
//   U=http://127.0.0.1:8958/ [VP=390x844,844x390,1280x800] node tests/smoke/stage_orbit.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--enable-unsafe-webgpu','--enable-features=Vulkan','--use-vulkan=swiftshader','--use-webgpu-adapter=swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'];
const URL = process.env.U || 'http://127.0.0.1:8958/', VPS = (process.env.VP || '390x844,844x390,1280x800').split(','), M = process.env.M || 'colossus-v4';
const withQ = (u, extra) => { const i = u.indexOf('?'), base = i < 0 ? u : u.slice(0, i), have = new URLSearchParams(i < 0 ? '' : u.slice(i + 1));
  for (const [k, v] of new URLSearchParams(extra)) if (!have.has(k)) have.set(k, v); const s = have.toString(); return s ? base.replace(/\/*$/, '/') + '?' + s : base; };
const GO = withQ(URL, 'v=stage-orbit&webgl&noacademy&fx=low');
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const census = () => { const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; for (let q = e; q && q !== document.body; q = q.parentElement) { const c = getComputedStyle(q); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } return true; };
  const lab = b => (b.textContent || b.id || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  const bs = [...document.querySelectorAll('#topBar button,#botBar button,#gcamBtn')].filter(vis);
  const stage = [document.getElementById('mStage'), document.getElementById('dStage')].find(e => e && e.offsetWidth > 0);
  const rel = document.getElementById('relBtn'); const rr = rel && rel.getBoundingClientRect();
  const F = window.__game.F;
  return { n: bs.length, labs: bs.map(lab), stageW: stage ? stage.offsetWidth : 0, rel: !!(rr && rr.width >= 40 && rr.height >= 40 && rr.left >= 0 && rr.top >= 0 && rr.right <= innerWidth + 1 && rr.bottom <= innerHeight + 1), relBox: rr ? [Math.round(rr.left), Math.round(rr.top), Math.round(rr.width), Math.round(rr.height)] : null, cur: F.v.cur, last: F.last, orbit: !!F.flags.orbit, released: !!F.released, left: !!(F.v && F.v.cur < F.last) }; };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU });
  for (const vp of VPS) { const [W, H] = vp.split('x').map(Number), touch = Math.min(W, H) < 700;
    const pg = await br.newPage({ viewport: { width: W, height: H }, isMobile: touch, hasTouch: touch }); pg.setDefaultTimeout(600000);
    await pg.addInitScript(() => { try { localStorage.setItem('or_seen_welcome', '1'); } catch (e) {} });
    await pg.goto(GO); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 600000 });
    await pg.evaluate(m => { const c = document.querySelector(`.pkC[data-m="${m}"]`) || document.querySelector(`.pkC[data-th="${m}"]`); if (!c) throw new Error('no card ' + m); c.click(); }, M);
    await pg.click('#hFly'); await pg.waitForTimeout(1500);
    const mid = await pg.evaluate(async () => { const G = window.__game, F = G.F; F.stagePress(); F.setAuto(true, true);
      for (let i = 0; i < 90000 && !F.flags.dead; i++) { F.realT += 0.02; F.step(0.02); if (F.ignited && F.v.cur < F.last && F.alt > 400) break; }
      return { cur: F.v.cur, last: F.last, dead: !!F.flags.dead, alt: F.alt | 0 }; });
    await pg.waitForTimeout(400);
    const a = await pg.evaluate(census);
    ok(mid.cur < mid.last && !mid.dead && a.stageW > 4 && a.left, `${vp} STAGE stays while a stage remains (cur ${mid.cur}/${mid.last}, alt ${mid.alt}, w ${a.stageW})`);
    await pg.evaluate(() => { const F = window.__game.F; for (let i = 0; i < 90000 && !F.flags.dead && !(F.flags.orbit && F.v.guid === 'done' && !(F.v.cur < F.last)); i++) { F.realT += 0.02; F.step(0.02); } });
    await pg.waitForFunction(() => { const F = window.__game.F; if (!(F.flags.orbit && !(F.v.cur < F.last))) return false; const stage = [document.getElementById('mStage'), document.getElementById('dStage')].find(e => e && e.offsetWidth > 0); return !stage && document.body.classList.contains('noStage'); }, null, { timeout: 4000 }).catch(() => {});
    const b = await pg.evaluate(census);
    const both = b.labs.some(t => /STAGE/i.test(t)) && b.labs.some(t => /RELEASE/i.test(t));
    ok(b.orbit && !b.released && !b.left && b.stageW === 0 && !both && b.rel, `${vp} orbit hides STAGE and keeps RELEASE on screen (${b.n} controls: ${b.labs.join(', ')}; cur ${b.cur}/${b.last} left ${b.left} orbit ${b.orbit}; rel ${JSON.stringify(b.relBox)})`);
    await pg.close(); }
  await br.close(); console.log(bad ? `FAIL ${bad}` : 'stage_orbit OK'); process.exit(bad ? 1 : 0); })().catch(e => { console.error(e); process.exit(1); });
