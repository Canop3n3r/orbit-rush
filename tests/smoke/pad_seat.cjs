// f5.9-20 (owner: "the launch mount lets rockets sink into it"): on every pad site, every rocket's base sits on the mount deck
// (within 15 cm) and no pad art rises inside the rocket's footprint above its base. Rays are cast down the rocket axis and
// around its rim against the site art only.
//   U=http://localhost:8960/ [SITES=capen,gulf,atoll,cape,coast36] [ALL=1] node tests/smoke/pad_seat.cjs
const pw = require(process.env.PW || '/workspace/pwt/node_modules/playwright-core');
const GPU = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const URL = process.env.U || 'http://localhost:8960/', SITES = (process.env.SITES || 'capen,gulf,atoll,cape,coast36').split(',');
const PRE = { capen: ['North Coast Complex', 28.5619, -80.5772], gulf: ['Bay Starport', 25.9972, -97.4166], atoll: ['Atoll Range', 9.0477, 167.7433], cape: ['Heritage Complex', 28.6084, -80.6043], coast36: ['Coast Pad 36', 28.4711, -80.5378] };
(async () => { const br = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: GPU }); let bad = 0, n = 0; const ok = (t, m) => { if (!t || process.env.V) console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; n++; };
  for (const [si, id] of SITES.entries()) { const p = PRE[id]; const pg = await br.newPage({ viewport: { width: 1000, height: 700 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.addInitScript(s => { try { localStorage.setItem('or_seen_welcome', '1'); localStorage.setItem('orbitRush.site.v1', s); } catch (e) { } }, JSON.stringify({ body: 'earth', id, name: p[0], lat: p[1], lon: p[2] }));
    await pg.goto(URL + '?noacademy&fx=low'); await pg.waitForFunction(() => window.__game && !document.getElementById('loading'), null, { timeout: 300000 }); await pg.waitForTimeout(2500);
    const count = await pg.evaluate(() => document.querySelectorAll('#picker .pkC').length);
    const all = !!process.env.ALL, idx = all ? [...Array(count).keys()] : [...new Set([0, 1, 3, 5, Math.floor(count / 3), Math.floor(count / 2), Math.floor(count * 0.75), count - 1])].filter(k => k < count);
    for (const i of idx) { const r = await pg.evaluate(async i => { const T = await import('three/webgpu'), G = window.__game, c = document.querySelectorAll('#picker .pkC')[i]; if (!c) return { skip: 1 }; c.click();
        for (let k = 0; k < 40; k++) { await new Promise(r => setTimeout(r, 100)); }
        let site = null; G.scn.scene.traverse(o => { if (!site && o.isLOD && /^siteLOD:/.test(o.name) && o.visible && !/lz1/.test(o.name)) site = o; }); if (!site) return { nosite: 1 };
        const R = G.rocketG; R.updateWorldMatrix(true, true); site.updateWorldMatrix(true, true); const up = new T.Vector3().setFromMatrixColumn(site.matrixWorld, 1).normalize();
        const ctr = new T.Vector3().setFromMatrixPosition(R.matrixWorld); let base = Infinity, top = -Infinity, rad = 0; const v = new T.Vector3();
        R.traverseVisible(m => { let q = m; while (q && q !== R) { if (/^(sat-|sat$|payload)/i.test(q.name || '')) return; q = q.parent; } /* the payload rides inside the fairing */ if (!m.isMesh || !m.geometry || (m.material && (m.material.transparent || m.material.depthWrite === false))) return; const pos = m.geometry.attributes.position; if (!pos) return; const st = Math.max(1, Math.floor(pos.count / 400));
          for (let j = 0; j < pos.count; j += st) { v.fromBufferAttribute(pos, j).applyMatrix4(m.matrixWorld).sub(ctr); const h = v.dot(up); base = Math.min(base, h); top = Math.max(top, h); rad = Math.max(rad, v.clone().addScaledVector(up, -h).length()); } });
        const lvl = site.levels[0].object, rc = new T.Raycaster(), from = (dx) => { const o = ctr.clone().addScaledVector(up, dx ? base + 3 : top + 5); /* the rim rays look for anything the base sinks into (the low 3 m); towers and arms beside the rocket are fine */ if (dx) o.add(dx); rc.set(o, up.clone().negate()); rc.far = top + 40; const h = rc.intersectObject(lvl, true)[0]; return h ? h.point.clone().sub(ctr).dot(up) : -Infinity; };
        const deck = from(null), side = new T.Vector3(1, 0, 0); side.addScaledVector(up, -side.dot(up)); if (side.lengthSq() < 1e-6) side.set(0, 0, 1).addScaledVector(up, -up.z); side.normalize(); const side2 = new T.Vector3().crossVectors(up, side);
        let rim = -Infinity; for (let a = 0; a < 12; a++) { const t = a / 12 * Math.PI * 2; const rr = Math.min(rad, 8); /* PAD_CLEAR: wings and wide orbiters may overhang the pad apron */ for (const f of [0.5, 0.95]) rim = Math.max(rim, from(side.clone().multiplyScalar(Math.cos(t) * rr * f).addScaledVector(side2, Math.sin(t) * rr * f))); }
        return { name: c.querySelector('b') ? c.querySelector('b').textContent : i, base: +base.toFixed(2), deck: +deck.toFixed(2), rim: +rim.toFixed(2), rad: +rad.toFixed(1) }; }, i);
      if (r.skip) continue; if (r.nosite) { ok(false, `${id}: site art not loaded`); break; }
      ok(Math.abs(r.base - r.deck) < 0.15, `${id} ${r.name}: base ${r.base} on deck ${r.deck}`); ok(r.rim < r.base + 0.15, `${id} ${r.name}: nothing inside the footprint (r ${r.rad} m) in the low 3 m above the base (highest ${r.rim})`); }
    ok(!errs.length, `${id}: no page errors ${errs.slice(0, 2).join(' | ')}`); await pg.close(); }
  await br.close(); console.log(bad ? `pad_seat: ${bad} FAIL of ${n}` : `pad_seat: all ok (${n})`); process.exit(bad ? 1 : 0); })().catch(e => { console.log('FATAL', e.message); process.exit(1); });
