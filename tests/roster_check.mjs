// Shared checker for roster vehicles (identical on every roster branch). Payloads vs sourced figures at ±TOL; a vehicle
// listed with knownGap is reported, not failed, and must still miss (so a fixed gap gets promoted to a hard test).
import { modelPayload, TOL } from '../vehicles/roster/loss.js';
export function checkRoster(name, VEH, E) {
  let pass = 0, fail = 0, gaps = 0, estPass = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✔', m); } else { fail++; console.log('  ✘', m); } };
  for (const [id, e] of Object.entries(E)) ok(e.unsourced ? e.ispVac === 0 && /^spec:/.test(e.src) : e.ispVac > 0 && e.tVac > 0 && (e.tSl === 0 || (e.tSl <= e.tVac && e.ispSl < e.ispVac)) && /^spec:/.test(e.src), `engine ${id}: SL ≤ vac, neutral spec ref`);
  for (const v of VEH) {
    ok(/^[a-z0-9-]+$/.test(v.id) && v.name && v.company && /^spec:/.test(v.src), `${v.id}: neutral id, parody name "${v.name}", ${v.src}`);
    ok(v.stages.every(s => s.recovery && s.dry > 0 && s.prop > 0 && s.burn > 0 && Object.keys(s.engines).every(k => E[k])), `${v.id}: stages have engines, masses, burn, recovery`);
    for (const md of v.modes) {
      const r = modelPayload(v, E, md), err = r.payload / md.payload - 1, tag = `${v.id} [${md.variant}] ${(r.payload / 1000).toFixed(2)} t vs sourced ${(md.payload / 1000).toFixed(2)} t (${(err * 100).toFixed(0)}%)`;
      if (r.unsourced) { gaps++; ok(!!md.knownGap, `UNMODELLED ${v.id} [${md.variant}]: vacuum Isp unsourced for ${r.unsourced.join(', ')} (no invented figure; data request) ${md.knownGap || 'needs a knownGap'}`); continue; }
      if (md.modeMismatch) { gaps++; ok(err >= -TOL, `MODE MISMATCH ${tag}: ${md.modeMismatch} (model flies the easier expendable case, so it must be ≥ sourced −${TOL * 100}%; not a full pass)`); }
      else if (md.knownGap) { gaps++; ok(Math.abs(err) > TOL, `KNOWN GAP ${tag}: ${md.knownGap}`); }
      else { const est = [...new Set(v.stages.flatMap(s => Object.keys(s.engines).filter(k => E[k].ispEstimated)))];
        if (est.length && Math.abs(err) <= TOL) { estPass++; console.log('  ~', `PASS (estimated Isp: ${est.join(', ')}; not a sourced pass) ${tag}`); }
        else ok(Math.abs(err) <= TOL, `${tag} within ±${TOL * 100}%`); }
    }
  }
  console.log(`\n${name}: ${pass} passed, ${fail} failed, ${gaps} known gaps, ${estPass} pass (estimated Isp)`); if (fail) process.exit(1);
}
