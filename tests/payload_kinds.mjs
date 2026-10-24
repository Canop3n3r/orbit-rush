// Payload look per flight (rockets-pass-1): mission, constellation and roster rockets pick a payload; crew stacks pick none.
import { payloadKindFor, BY_MISSION, KINDS, NO_PAYLOAD, OWN_PAYLOAD } from '../gfx/vehicles/payload_kinds.js';
let bad = 0; const ok = (t, m) => { console.log((t ? 'ok   ' : 'FAIL ') + m); if (!t) bad++; };
ok(payloadKindFor({ missionId: 'constellation-batch', hasSpec: true, model: 'heron-9-v11' }) === 'flatpack', 'constellation mission -> flat-pack sats');
ok(payloadKindFor({ missionId: 'gto-comsat', model: 'x' }) === 'comsat', 'gto mission -> comsat');
ok(payloadKindFor({ missionId: 'sso-rideshare', model: 'x' }) === 'rideshare', 'rideshare mission -> dispenser');
ok(payloadKindFor({ missionId: 'roadster-helio', model: 'x' }) === 'roadster', 'roadster mission -> roadster');
ok(payloadKindFor({ partIds: ['crew', 'fairing'], model: 'x' }) === null, 'crew stack carries no extra payload');
ok(payloadKindFor({ constellation: true, model: 'x' }) === 'flatpack', 'constellation flag -> flat-pack');
ok(payloadKindFor({ partIds: ['probe'], model: 'x' }) === 'probe', 'probe part -> probe');
const a = payloadKindFor({ hasSpec: true, model: 'heron-9-v11' }), b = payloadKindFor({ hasSpec: true, model: 'heron-9-v11' });
ok(a === b && KINDS.includes(a), 'roster pick is stable per model');
ok(new Set(['a1', 'bb', 'ccc', 'dddd', 'e5', 'ffffff', 'g7g'].map(m => payloadKindFor({ hasSpec: true, model: m }))).size > 1, 'roster rockets do not all carry the same bus');
ok(Object.values(BY_MISSION).every(k => KINDS.includes(k)), 'every mission kind is a known kind');
ok(NO_PAYLOAD.test('titanus-2-icbm') && !NO_PAYLOAD.test('heron-9-v11'), 'warhead noses skipped');
ok(OWN_PAYLOAD.test('capsule') && OWN_PAYLOAD.test('lander') && !OWN_PAYLOAD.test('payload'), 'own-payload stage names');
process.exit(bad ? 1 : 0);
