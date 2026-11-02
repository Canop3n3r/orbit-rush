#!/usr/bin/env node
/* Lists new Orbit Rush bug reports. Dev tool, not shipped in the game.
   Needs a SECRET key that is never committed: set SUPABASE_SECRET_KEY in the
   environment or in a gitignored .env.local at the repo root.
   Usage: node tools/bug_inbox.mjs [--all] [--shots] [--limit N]
   Alternative without a key: run this SQL through the Supabase connector:
     select id, created_at, build, viewport, message, screenshot_path
     from public.bug_reports where status = 'new' order by created_at desc; */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
if (existsSync(envFile)) for (const ln of readFileSync(envFile, 'utf8').split('\n')) {
  const m = ln.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const URL_ = process.env.SUPABASE_URL || 'https://cetngoryccizrnlbusxo.supabase.co';
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('Set SUPABASE_SECRET_KEY (env or .env.local). The publishable key cannot read reports.'); process.exit(2); }
const args = process.argv.slice(2), all = args.includes('--all'), shots = args.includes('--shots');
const li = args.indexOf('--limit'), limit = li >= 0 ? +args[li + 1] || 50 : 50;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const q = `${URL_}/rest/v1/bug_reports?select=id,created_at,build,viewport,message,screenshot_path,status${all ? '' : '&status=eq.new'}&order=created_at.desc&limit=${limit}`;
const r = await fetch(q, { headers: H });
if (!r.ok) { console.error('HTTP', r.status, await r.text()); process.exit(1); }
const rows = await r.json();
console.log(`${rows.length} ${all ? '' : 'new '}report(s)`);
for (const b of rows) {
  let shot = b.screenshot_path || '';
  if (shots && shot) {
    const s = await fetch(`${URL_}/storage/v1/object/sign/bug-shots/${shot}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 3600 }) });
    if (s.ok) { const j = await s.json(); shot = `${URL_}/storage/v1${j.signedURL}`; }
  }
  console.log(`- ${b.created_at}  [${b.build || '?'}] ${b.viewport || ''}  ${b.status}\n  ${String(b.message || '').replace(/\s+/g, ' ').slice(0, 300)}${shot ? `\n  shot: ${shot}` : ''}`);
}
