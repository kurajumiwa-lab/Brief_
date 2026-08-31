// ---------------------------------------------------------------------------
// TRUST & VERIFICATION TEST SUITE
//
// Pins the trust layer: cross-source corroboration, corrections that preserve
// original source evidence, source-level trust influencing ranking/discovery
// only where justified, report reasons covering cancellation/change signals,
// and the detail enrichment contract (corrections + open-report count, never
// reporter identities).
//
//   node test/trust.mjs
// ---------------------------------------------------------------------------

import fs from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.BRIEF_DATA_DIR = `/tmp/brief-trust-${process.pid}`;
fs.rmSync(process.env.BRIEF_DATA_DIR, { recursive: true, force: true });

const { store } = await import('../src/store.js');
const trust = await import('../src/domain/trust.js');
const corrections = await import('../src/domain/corrections.js');
const sourceTrust = await import('../src/domain/sourceTrust.js');
const discovery = await import('../src/domain/discovery.js');
const { storeRawItem, processRawItem } = await import('../src/pipeline/ingest.js');

store._reset();

let pass = 0;
let fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const mkSource = (id, name, type = 'manual') => store.insert('sources', {
  id, name, type, platform: type.split('_')[0],
  accessType: 'public', connectionStatus: 'connected', enabled: false,
  confidence: 0.5, trustStatus: 'normal',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
});

const ingest = (sourceId, externalId, messageId, text) => {
  const { row } = storeRawItem({
    sourceId, externalId, messageId, author: 'trust',
    text, publishedAt: new Date().toISOString(), rawUrl: null
  });
  return processRawItem(row.id);
};

// A real pipeline-ingested object (so provenance exists and verification
// status is derived from it, not invented).
const srcA = mkSource('src_trust_a', 'Trust Source A');
const result = ingest(srcA.id, 'trust:1', 'trust-msg-1',
  'Pop-up market at Kilimani Studio Saturday 4PM-10PM. KES 300 entry. 12 vendors.');
const objId = result.objectId;
const obj = store.find('objects', (o) => o.id === objId);
check('pipeline object created for trust tests', Boolean(obj), objId);

console.log('\n=== CROSS-SOURCE CORROBORATION ===');
{
  // The same story from a second, independent source. The pipeline dedupes at
  // ingestion: the second source corroborates the SAME object, so provenance
  // carries two sources on one row — that is the "Confirmed across 2
  // sources" fact the UI shows.
  const srcB = mkSource('src_trust_b', 'Trust Source B');
  const resB = ingest(srcB.id, 'trust:2', 'trust-msg-2',
    'Pop-up market at Kilimani Studio Saturday 4PM-10PM. KES 300 entry.');
  check('second source merged into the same object', resB.objectId === objId, `${resB.objectId} vs ${objId}`);
  check('both provenance rows attached', store.filter('objectSources', (s) => s.objectId === objId).length === 2);
  const stream = discovery.discoverable({ limit: 50 });
  const rep = stream.find((o) => o.id === objId);
  check('merged object is discoverable', Boolean(rep));
  if (rep) {
    check('feed carries the corroboration count', Number.isInteger(rep.sourceCount) && rep.sourceCount >= 2, JSON.stringify({ sourceCount: rep.sourceCount, sourceNames: rep.sourceNames }));
    check('feed carries source names', Array.isArray(rep.sourceNames) && rep.sourceNames.length >= 2, JSON.stringify(rep.sourceNames));
    check('verification escalates with corroboration', rep.verificationStatus === 'cross_source_confirmed', rep.verificationStatus);
  }

  // The plain (non-ranked) feed path attaches the same trust projection.
  const plain = discovery.enrichTrustFields(store.find('objects', (o) => o.id === objId));
  check('plain rows carry source names', Array.isArray(plain.sourceNames) && plain.sourceNames.length >= 2, JSON.stringify(plain.sourceNames));
  check('plain rows carry a publication time', typeof plain.publishedAt === 'string', String(plain.publishedAt));
  check('plain rows carry verification', plain.verificationStatus === 'cross_source_confirmed', plain.verificationStatus);
}

console.log('\n=== CORRECTIONS (trust layer) ===');
{
  const before = obj.title;
  const r = corrections.correctObject({
    objectId: objId, field: 'title', value: 'Kilimani Studio Pop-up (corrected)',
    operatorId: 'usr_op', reason: 'wrong venue name in source text'
  });
  check('correction applied', r.changed === true && r.correction.status === 'applied');
  check('original value preserved in the row', r.correction.originalValue === before);
  check('corrected value on the object', store.find('objects', (o) => o.id === objId).title === 'Kilimani Studio Pop-up (corrected)');

  const meta = corrections.correctObject({
    objectId: objId, field: 'venue', value: 'Kilimani Studio', isMeta: true,
    operatorId: 'usr_op', reason: 'add venue'
  });
  check('metadata correction applied', store.find('objects', (o) => o.id === objId).metadata?.venue === 'Kilimani Studio');

  let threw = false;
  try {
    corrections.correctObject({ objectId: objId, field: 'secretField', value: 'x', operatorId: 'usr_op' });
  } catch { threw = true; }
  check('unknown field rejected', threw);

  threw = false;
  try {
    corrections.correctObject({ objectId: objId, field: 'type', value: 'not-a-type', operatorId: 'usr_op' });
  } catch { threw = true; }
  check('invalid type rejected', threw);

  threw = false;
  try {
    corrections.correctObject({ objectId: objId, field: 'title', value: '  ', operatorId: 'usr_op' });
  } catch { threw = true; }
  check('empty value rejected', threw);

  const applied = corrections.appliedCorrections(objId);
  check('applied corrections listed for the object', applied.length === 2, String(applied.length));

  const rej = corrections.rejectCorrection(meta.correction.id, 'usr_op', 'applied in error');
  check('correction can be rejected', rej.correction.status === 'rejected' && rej.reused === false);
  check('rejected correction leaves object value intact (no silent rollback)', store.find('objects', (o) => o.id === objId).metadata?.venue === 'Kilimani Studio');
  check('applied list excludes rejected rows', corrections.appliedCorrections(objId).length === 1);
}

console.log('\n=== SOURCE-LEVEL TRUST ===');
{
  const srcC = mkSource('src_trust_c', 'Trust Source C', 'webpage');
  const resC = ingest(srcC.id, 'trust:4', 'trust-msg-4',
    'Coastal crafts fair at Nyali Beach this Saturday 10AM-4PM. KES 200 entry. 30 stalls.');
  const objC = store.find('objects', (o) => o.id === resC.objectId);

  check('default trust is normal', sourceTrust.trustOf(srcC) === 'normal');
  check('object with no demotion ranks normally', sourceTrust.trustOfObject(objC).disabled === false && sourceTrust.trustOfObject(objC).degraded === false);

  // Degraded source: still visible, ranked lower.
  sourceTrust.setSourceTrust(srcC.id, 'usr_op', 'degraded', 'repeated unverified claims');
  check('trust status persisted', store.find('sources', (x) => x.id === srcC.id).trustStatus === 'degraded');
  const degraded = sourceTrust.trustOfObject(objC);
  check('degraded provenance detected', degraded.degraded === true && degraded.disabled === false);
  const beforeDeg = discovery.discoverable({ limit: 50 }).find((o) => o.id === objC.id);
  check('degraded object still discoverable (not hidden)', Boolean(beforeDeg));

  // Disabled source: excluded from the default feed, still in the store.
  sourceTrust.setSourceTrust(srcC.id, 'usr_op', 'disabled', 'source shut down');
  const after = discovery.discoverable({ limit: 50 });
  check('disabled-source object excluded from default feed', !after.some((o) => o.id === objC.id));
  check('disabled-source object row still exists (nothing deleted)', Boolean(store.find('objects', (o) => o.id === objC.id)));

  // The corroborated object (src_a + src_b, both normal) survives untouched.
  check('unrelated object unaffected by another source demotion', after.some((o) => o.id === objId));

  let threw = false;
  try { sourceTrust.setSourceTrust(srcC.id, 'usr_op', 'bogus', 'x'); } catch { threw = true; }
  check('invalid trust status rejected', threw);

  const list = sourceTrust.sourceTrustList();
  check('operator trust list includes standing', list.some((s) => s.id === srcC.id && s.trustStatus === 'disabled'));
}

console.log('\n=== REPORTS / CHANGE SIGNALS ===');
{
  const r1 = trust.reportObject({ objectId: objId, actorId: 'usr_r1', reason: 'wrong_date', note: 'actually Sunday' });
  check('report with change-signal reason accepted', r1.report.reason === 'wrong_date');
  const r2 = trust.reportObject({ objectId: objId, actorId: 'usr_r2', reason: 'cancelled', note: 'postponed' });
  check('cancellation signal accepted', r2.report.reason === 'cancelled');
  const dup = trust.reportObject({ objectId: objId, actorId: 'usr_r1', reason: 'wrong_date' });
  check('one open report per actor (no stacking)', dup.reused === true);
  let threw = false;
  try { trust.reportObject({ objectId: objId, actorId: 'usr_r3', reason: 'made_up' }); } catch { threw = true; }
  check('unknown reason rejected', threw);
  check('open report count is derived, not stored', trust.openReportCount(objId) === 2, String(trust.openReportCount(objId)));
  const target = trust.reportTarget(trust.openReports()[0]);
  check('report target carries title/type, not the row', Boolean(target) && typeof target?.title === 'string' && target?.publication === 'public');
  check('reporter identity never in the target', !('actorId' in (target ?? {})));

  trust.resolveReport(r1.report.id, 'usr_op', 'dismiss');
  check('resolution drops the open count', trust.openReportCount(objId) === 1);
}

console.log('\n=== DETAIL ENRICHMENT CONTRACT ===');
{
  // GET /api/objects/:id attaches corrections + openReportCount (server-side
  // enrichment is unit-checked here; the route test covers the HTTP shape).
  const applied = corrections.appliedCorrections(objId);
  check('detail contract has corrections', Array.isArray(applied));
  check('detail contract has openReportCount', typeof trust.openReportCount(objId) === 'number');
  check('corrections carry original value for honest display', applied.every((c) => 'originalValue' in c && 'correctedValue' in c));
}

console.log('\n=== ROUTE CONTRACT (HTTP) ===');
{
  process.env.BRIEF_ADMINS = 'trust_admin';
  const { default: app } = await import('../src/index.js');
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body, token) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  try {
    const anon = await call('/api/ops/corrections');
    check('ops corrections route is gated for anonymous callers', anon.status === 401 || anon.status === 403, `got ${anon.status}`);

    const reg = await call('/api/auth/register', 'POST', { handle: 'trust_admin', password: 'pw-123456', displayName: 'Trust Admin' });
    check('admin bootstrap account registers', reg.status === 201, `got ${reg.status}`);
    const token = reg.body?.token;

    const list = await call('/api/ops/corrections', 'GET', null, token);
    check('admin can list corrections', list.status === 200 && Array.isArray(list.body?.corrections), `got ${list.status}`);

    const fix = await call('/api/ops/corrections', 'POST', {
      objectId: objId, field: 'venue', value: 'Kilimani Studio', reason: 'HTTP test fix', isMeta: true
    }, token);
    check('admin can apply a correction over HTTP', fix.status === 201 && fix.body?.correction?.originalValue !== null, `got ${fix.status}`);
    check('correction applied to the object', store.find('objects', (o) => o.id === objId).metadata?.venue === 'Kilimani Studio');

    const trustRoute = await call(`/api/ops/sources/${srcA.id}/trust`, 'POST', { status: 'normal', reason: 'HTTP test' }, token);
    check('admin can set source trust over HTTP', trustRoute.status === 200 && trustRoute.body?.source?.trustStatus === 'normal', `got ${trustRoute.status}`);

    const detail = await call(`/api/objects/${objId}`, 'GET', null, token);
    check('detail response carries corrections', Array.isArray(detail.body?.object?.corrections) && detail.body.object.corrections.length >= 2, JSON.stringify(detail.body?.object?.corrections?.length));
    check('detail response carries openReportCount', Number.isInteger(detail.body?.object?.openReportCount));
    check('detail response never leaks reporter identities', !JSON.stringify(detail.body).includes('usr_r1'));

    // A plain member (no capabilities) is refused the moderate surface.
    const member = await call('/api/auth/register', 'POST', { handle: 'trust_member', password: 'pw-123456', displayName: 'Member' });
    const memberToken = member.body?.token;
    const refused = await call('/api/ops/corrections', 'POST', {
      objectId: objId, field: 'title', value: 'hacked', reason: 'x'
    }, memberToken);
    check('non-operator is refused corrections (401/403)', refused.status === 401 || refused.status === 403, `got ${refused.status}`);
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
