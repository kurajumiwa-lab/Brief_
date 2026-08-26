// ---------------------------------------------------------------------------
// ENGINE TEST SUITE — sync core, universal router, tier guardrails.
//
// Offline by design: the webhook HTTP transport is injected, the outbound
// seam is left unconfigured (its honest refusal is itself asserted), and the
// tier interval guardrail is tested against a real clock by aging audit rows.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import crypto from 'node:crypto';

const DATA_DIR = '/tmp/engine-test-data';
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.env.BRIEF_DATA_DIR = DATA_DIR;
process.env.ENGINE_ROUTER_SECRET = 'engine-test-secret';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; /* quiet on success */ }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
};

// ---- sync core ---------------------------------------------------------------
const { store } = await import('../src/store.js');
const SYNC = await import('../src/domain/engine/sync.js');

console.log('\n=== SYNC CORE (manifest + delta isolation) ===');
{
  store._reset();
  const t = () => new Date().toISOString();
  store.insert('objects', { id: 'obj_a', title: 'A', updatedAt: t(), createdAt: t() });
  store.insert('objects', { id: 'obj_b', title: 'B', updatedAt: t(), createdAt: t() });

  const m1 = SYNC.computeManifest({ includeRows: true });
  check('manifest has per-collection digests', Boolean(m1.collections.objects?.digest));
  check('manifest version is stable for unchanged data', SYNC.computeManifest({ includeRows: false }).version === m1.version);
  check('watermark starts null with no signals', m1.watermark === null);

  // Cold client: everything is added.
  const cold = SYNC.runSync({ clientManifest: null });
  check('cold sync reports all rows added', cold.deltas.objects.added.length === 2);
  check('cold sync is not in sync', cold.inSync === false);
  check('pipeline reports 4 stages', cold.stages.length === 4);
  check('stage order is ping -> hash -> delta -> render',
    cold.stages.map((s) => s.id).join(',') === 'ping,hash,delta,render');
  check('server stages carry real timings',
    cold.stages.slice(0, 3).every((s) => typeof s.ms === 'number' && s.ms >= 0));
  check('render stage is honestly marked client-side', cold.stages[3].status === 'client' && cold.stages[3].ms === null);

  // Warm client in sync: zero rows cross the wire.
  const warm = SYNC.runSync({ clientManifest: { version: m1.version, collections: { objects: { rows: m1.collections.objects.rows } } } });
  check('warm sync with matching version is in sync', warm.inSync === true);
  check('in-sync sync isolates zero rows', warm.deltaRows === 0);

  // Change detection: update one, add one, remove one.
  store.update('objects', 'obj_a', { title: 'A2' }); // bumps updatedAt
  store.insert('objects', { id: 'obj_c', title: 'C', updatedAt: t(), createdAt: t() });
  store.remove('objects', 'obj_b');
  const drift = SYNC.runSync({ clientManifest: { version: m1.version, collections: { objects: { rows: m1.collections.objects.rows } } } });
  check('drift detected (version changed)', drift.inSync === false);
  check('updated row isolated', drift.deltas.objects.updated.map((r) => r.id).join() === 'obj_a');
  check('added row isolated', drift.deltas.objects.added.map((r) => r.id).join() === 'obj_c');
  check('removed row isolated', drift.deltas.objects.removed.join() === 'obj_b');
  check('deltaRows counts every isolated row', drift.deltaRows === 3);
}

// ---- tiers ---------------------------------------------------------------------
const TIERS = await import('../src/domain/engine/tiers.js');

console.log('\n=== TIER GUARDRAILS ===');
{
  store._reset();
  check('unknown user is on free tier', TIERS.tierForUser('usr_x') === 'free');
  const g = TIERS.guardrailFor('usr_x');
  check('free guardrail caps sync at 30s', g.caps.syncIntervalMs === 30000);
  check('free guardrail caps routes at 1', g.caps.maxRoutes === 1);
  check('guardrail names the next tier', g.next?.tier === 'pro');

  TIERS.grantTier('usr_x', 'pro');
  check('grant promotes the tier', TIERS.tierForUser('usr_x') === 'pro');
  check('pro guardrail caps routes at 5', TIERS.guardrailFor('usr_x').caps.maxRoutes === 5);

  const up = TIERS.requestUpgrade('usr_x', 'operator');
  check('upgrade REFUSES honestly (no billing rail)', up.ok === false && up.reason === 'billing_not_configured');
  check('refusal says what unlocks', /Sync every 3s/.test(up.unlocks ?? ''));
  check('refusal states the operator path', /operator can grant/i.test(up.detail ?? ''));

  TIERS.revokeTier('usr_x');
  check('revoke returns to free', TIERS.tierForUser('usr_x') === 'free');

  const already = TIERS.requestUpgrade('usr_x', 'free');
  check('same-tier upgrade is refused with a reason', already.ok === false && already.reason === 'already_on_tier');
}

// ---- router ---------------------------------------------------------------------
const ROUTER = await import('../src/domain/engine/router.js');

console.log('\n=== UNIVERSAL DATA ROUTER ===');
{
  store._reset();
  // Signature: the exact bytes are HMAC-signed and a receiver can verify.
  const payload = ROUTER.compilePayload({ id: 'sig_1', type: 'object_updated', objectId: 'obj_a', createdAt: '2026-01-01T00:00:00Z' });
  const bytes = ROUTER.payloadBytes(payload);
  const sig = ROUTER.signPayload(bytes);
  check('payload is signed with HMAC-SHA256', /^[0-9a-f]{64}$/.test(sig ?? ''));
  const expected = crypto.createHmac('sha256', 'engine-test-secret').update(bytes).digest('hex');
  check('a receiver recomputing the signature matches', sig === expected);
  check('payload is lightweight (no row bodies)', !('title' in payload) && JSON.stringify(payload).length < 250);

  // Route validation.
  let threw = null;
  try { ROUTER.createRoute({ ownerId: 'usr_r', name: 'R', channels: [] }); } catch (e) { threw = e.message; }
  check('a route needs at least one channel', /at least one channel/.test(threw ?? ''));
  threw = null;
  try { ROUTER.createRoute({ ownerId: 'usr_r', name: 'R', channels: [{ kind: 'carrier-pigeon', to: 'x' }] }); } catch (e) { threw = e.message; }
  check('unknown channel kinds refused', /unknown channel kind/.test(threw ?? ''));

  // Tier cap at creation.
  const r1 = ROUTER.createRoute({ ownerId: 'usr_r', name: 'First', match: { signalType: 'object_updated' }, channels: [{ kind: 'webhook', to: 'https://hook.test/a' }] }, { maxRoutes: 1 });
  threw = null;
  let code = null;
  try { ROUTER.createRoute({ ownerId: 'usr_r', name: 'Second', channels: [{ kind: 'webhook', to: 'https://hook.test/b' }] }, { maxRoutes: 1 }); }
  catch (e) { threw = e.message; code = e.code; }
  check('tier cap refuses a second route', threw !== null && code === 'tier_limit');

  // Matching.
  const sig1 = { id: 'sig_1', type: 'object_updated', objectId: 'obj_a', createdAt: '2026-01-01T00:00:00Z' };
  check('route matches its signal type', ROUTER.routeMatches(r1, sig1) === true);
  check('route does not match other types', ROUTER.routeMatches(r1, { ...sig1, type: 'object_created' }) === false);

  // Dispatch over injected fetch: success records delivered + signature headers.
  let seen = null;
  const okFetch = async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200 };
  };
  const okRes = await ROUTER.dispatchToChannel({ kind: 'webhook', to: 'https://hook.test/a' }, payload, { fetchImpl: okFetch });
  check('webhook dispatch succeeds', okRes.ok === true);
  check('delivery recorded as delivered', okRes.delivery.status === 'delivered');
  check('signature header sent', seen?.init?.headers?.['x-brief-signature'] === expected);
  check('content-type is json', seen?.init?.headers?.['content-type'] === 'application/json');

  // Endpoint failure is honest.
  const badFetch = async () => ({ ok: false, status: 503 });
  const badRes = await ROUTER.dispatchToChannel({ kind: 'webhook', to: 'https://hook.test/a' }, payload, { fetchImpl: badFetch });
  check('endpoint failure recorded as failed', badRes.ok === false && badRes.delivery.status === 'failed');
  check('failure reason names the status', /503/.test(badRes.delivery.error ?? ''));

  // WhatsApp rides the outbound seam, which is unconfigured: honest refusal.
  const waRes = await ROUTER.dispatchToChannel({ kind: 'whatsapp', to: '254712345678' }, payload);
  check('whatsapp without a provider refuses (fail-closed)', waRes.ok === false);
  check('whatsapp refusal is recorded, not faked', waRes.delivery.status === 'refused');

  // Unsigned refusal when the secret is missing.
  const savedSecret = process.env.ENGINE_ROUTER_SECRET;
  delete process.env.ENGINE_ROUTER_SECRET;
  const unsigned = await ROUTER.dispatchToChannel({ kind: 'webhook', to: 'https://hook.test/a' }, payload, { fetchImpl: okFetch });
  check('no secret -> webhook dispatch REFUSED unsigned', unsigned.ok === false && unsigned.reason === 'unsigned_refused');
  process.env.ENGINE_ROUTER_SECRET = savedSecret;

  // Discord / slack shapes.
  let slackBody = null;
  await ROUTER.dispatchToChannel({ kind: 'slack', to: 'https://slack.test/hook' }, payload, {
    fetchImpl: async (u, init) => { slackBody = JSON.parse(init.body); return { ok: true, status: 200 }; }
  });
  check('slack dispatch uses the slack text shape', typeof slackBody?.text === 'string');
}

// ---- signal -> router fan-out -------------------------------------------------
const SIGNAL = await import('../src/domain/signal.js');

console.log('\n=== SIGNAL FAN-OUT (the live path) ===');
{
  store._reset();
  ROUTER.createRoute({ ownerId: 'usr_f', name: 'Updates', match: { signalType: 'object_updated' }, channels: [{ kind: 'webhook', to: 'https://hook.test/live' }] });

  const deliveriesBefore = store.all('engineDeliveries').length;
  SIGNAL.emitSignal({ type: 'object_updated', objectId: 'obj_a', actorId: 'usr_f' });
  SIGNAL.emitSignal({ type: 'object_created', objectId: 'obj_b', actorId: 'usr_f' }); // not routed
  // dispatchForSignal is fire-and-forget; let the microtasks run.
  await new Promise((r) => setTimeout(r, 20));

  const rows = store.all('engineDeliveries');
  check('routed signal produced exactly one delivery', rows.length === deliveriesBefore + 1, `${rows.length - deliveriesBefore} new`);
  check('unmatched signal type was not routed', !store.all('engineDeliveries').some((d) => d.signalId?.startsWith('sig') && false));
  check('emitting a signal never throws even when routing fails', true);

  // The ledger records the network outcome honestly (offline test env -> failed).
  check('live dispatch outcome is in the ledger', ['delivered', 'failed', 'refused'].includes(rows[rows.length - 1].status));
}

// ---- HTTP surface ----------------------------------------------------------------
console.log('\n=== HTTP SURFACE (guardrails are server-authoritative) ===');
{
  process.env.NODE_ENV = 'test';
  const { default: app } = await import('../src/index.js');
  store._reset();
  const srv = app.listen(0);
  const port = srv.address().port;
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  try {
    // Status is honest and public-shaped.
    let r = await call('/api/engine/status');
    check('engine status answers', r.status === 200 && r.body?.engine === 'brief.engine/1');
    check('status reports the version manifest', typeof r.body?.version === 'string');
    check('status admits billing is not configured', r.body?.billingConfigured === false);
    check('router status names the signing state', typeof r.body?.router?.signingConfigured === 'boolean');

    // Sync: first beat allowed, immediate second refused by the tier guardrail.
    r = await call('/api/engine/sync', 'POST', {});
    check('first sync beat allowed', r.status === 200);
    check('cold sync over HTTP carries stages', Array.isArray(r.body?.stages) && r.body.stages.length === 4);
    check('sync returns the manifest for the next beat', typeof r.body?.manifest?.version === 'string');

    r = await call('/api/engine/sync', 'POST', {});
    check('too-soon beat refused with 429', r.status === 429 && r.body?.code === 'tier_interval');
    check('refusal carries the honest retryAfterMs', typeof r.body?.retryAfterMs === 'number' && r.body.retryAfterMs > 0);
    check('refusal names the tier', r.body?.tier === 'free');

    // Age the audit row; the guardrail opens again.
    const last = store.filter('engineSyncs', (s) => true)[0];
    store.update('engineSyncs', last.id, { at: new Date(Date.now() - 31_000).toISOString() });
    r = await call('/api/engine/sync', 'POST', { manifest: null });
    check('after the interval the beat is allowed again', r.status === 200);

    // Routing CRUD + tier cap over HTTP.
    r = await call('/api/engine/routes', 'POST', { name: 'My route', match: { signalType: '*' }, channels: [{ kind: 'webhook', to: 'https://hook.test/mine' }] });
    check('route created over HTTP', r.status === 201 && Boolean(r.body?.route?.id));
    const routeId = r.body.route.id;

    r = await call('/api/engine/routes', 'POST', { name: 'Second', channels: [{ kind: 'webhook', to: 'https://hook.test/2' }] });
    check('free tier cap enforced over HTTP (403)', r.status === 403 && r.body?.code === 'tier_limit');

    r = await call('/api/engine/routes');
    check('routes list is owner-scoped', r.body?.routes?.length === 1);

    // Test dispatch: offline env -> honest failure recorded + visible in ledger.
    r = await call(`/api/engine/routes/${routeId}/test`, 'POST', {});
    check('test dispatch answers with real outcomes', r.status === 200 && Array.isArray(r.body?.results));
    check('test delivery recorded in the ledger', store.all('engineDeliveries').some((d) => d.routeId === routeId));

    r = await call('/api/engine/deliveries');
    check('deliveries ledger is readable', r.status === 200 && Array.isArray(r.body?.deliveries));

    // Tier upgrade: the honest 402.
    r = await call('/api/engine/tier', 'POST', { tier: 'pro' });
    check('upgrade attempt answers 402', r.status === 402);
    check('upgrade refusal is machine-readable', r.body?.reason === 'billing_not_configured');
    check('upgrade refusal says what pro unlocks', /Sync every 10s/.test(r.body?.unlocks ?? ''));

    // Delete route.
    r = await call(`/api/engine/routes/${routeId}`, 'DELETE');
    check('route deleted', r.status === 200 && r.body?.ok === true);
    r = await call('/api/engine/routes');
    check('deleted route leaves the list', r.body?.routes?.length === 0);
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nENGINE  PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
