import './test-env.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
process.env.BRIEF_DEV_AUTH = '0';
process.env.BRIEF_PUBLIC_ORIGIN = 'https://moderation.test';
const { store } = await import('../src/store.js');
const auth = await import('../src/domain/auth.js');
const spaces = await import('../src/domain/space.js');
const page = await import('../src/domain/spacePublicPage.js');
const moderation = await import('../src/domain/spaceModeration.js');
const guardians = await import('../src/domain/guardians.js');
const { default: app } = await import('../src/index.js');
store._reset();
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log('PASS ' + name); };
const user = (handle, platformRoles = []) => {
  const u = auth.createUser({ handle, password: 'isolated moderation passphrase' });
  store.update('users', u.id, { platformRoles });
  return { ...u, token: auth.issueSession(u.id).token };
};
const owner = user('mod_owner'), reviewer = user('mod_reviewer', ['reviewer']);
const admin = user('mod_admin', ['admin']), visitor = user('mod_visitor');
const viewer = user('mod_viewer', ['viewer']), operator = user('mod_operator', ['operator']), finance = user('mod_finance', ['finance']);
let serial = 0;
const fixture = () => {
  const space = spaces.createSpace({ ownerId: owner.id, name: `Moderation shop ${++serial}`, type: 'business', visibility: 'public' });
  const report = page.reportSpace(space.slug, { reason: 'The published description is misleading', reporterId: visitor.id });
  return { space, reportId: report.id };
};
const options = (over = {}) => ({ actorId: reviewer.id, outcome: 'upheld', reason: 'Reviewed the page and confirmed the report.', idempotencyKey: `request-${++serial}`, ...over });
const row = (c, id) => store.lookup(c, id);
const audits = () => store.filter('auditLog', r => r.objectType === 'spaceModeration');
const persisted = () => JSON.parse(fs.readFileSync(store._file, 'utf8'));
const protectedCollections = ['users', 'vendors', 'listings', 'orders', 'paymentIntents', 'payouts', 'ledgerTransactions', 'attributions', 'referralEvents', 'referralConversions'];
const protectedState = () => Object.fromEntries(protectedCollections.map(c => [c, structuredClone(store.all(c))]));
const server = app.listen(0);
const call = async (path, { token, method = 'GET', body, key } = {}) => {
  const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  return { status: r.status, headers: r.headers, body: r.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
};
try {
  await test('unit: pending → upheld → hidden → reinstated, preserving the original report decision', () => {
    const { space, reportId } = fixture();
    assert.equal(row('spaceAbuseReports', reportId).handledAt, null);
    const beforeCreated = row('spaceAbuseReports', reportId).createdAt;
    const decision = moderation.reviewReport(reportId, options());
    assert.equal(decision.outcome, 'upheld'); assert.ok(decision.handledAt);
    assert.equal(row('spaces', space.id).visibility, 'private');
    assert.equal(row('spaces', space.id).status, 'active');
    assert.equal(row('spaceAbuseReports', reportId).createdAt, beforeCreated);
    const restored = moderation.reinstatePage(space.id, options({ holdId: decision.holdId, reason: 'The public page has been corrected.' }));
    assert.equal(restored.visibility, 'public'); assert.ok(restored.reinstatedAt);
    assert.equal(row('spaceAbuseReports', reportId).outcome, 'upheld');
    assert.equal(row('spaceAbuseReports', reportId).handledAt, decision.handledAt);
    const log = audits().filter(a => a.objectId === space.id);
    assert.deepEqual(log.map(a => a.action), ['space.moderation.upheld', 'space.moderation.reinstate']);
    for (const a of log) { assert.equal(a.actorId, reviewer.id); assert.ok(a.reason.trim()); assert.ok(a.at && a.createdAt); assert.ok(a.before && a.after); }
    assert.equal(log[0].before.page.visibility, 'public'); assert.equal(log[0].after.page.visibility, 'private');
    assert.equal(log[1].after.visibility, 'public');
    const disk = persisted();
    assert.equal(disk.spaces.find(x => x.id === space.id).publicPageModeration.reinstatedAt, restored.reinstatedAt);
    assert.equal(disk.auditLog.find(x => x.id === restored.actionId).actorId, reviewer.id);
  });
  await test('unit: pending → dismissed changes neither page nor economic state', () => {
    const { space, reportId } = fixture();
    const before = structuredClone(row('spaces', space.id)), protectedBefore = protectedState();
    const r = moderation.reviewReport(reportId, options({ outcome: 'dismissed', reason: 'The evidence does not support this report.' }));
    assert.equal(r.outcome, 'dismissed'); assert.ok(r.handledAt);
    assert.deepEqual(row('spaces', space.id), before); assert.deepEqual(protectedState(), protectedBefore);
    assert.equal(row('spaceAbuseReports', reportId).handledBy, reviewer.id);
    assert.equal(audits().at(-1).action, 'space.moderation.dismissed');
    assert.equal(persisted().spaceAbuseReports.find(x => x.id === reportId).outcome, 'dismissed');
  });
  await test('unit: authorization and self-review are enforced in the domain, not just routes', () => {
    const { space, reportId } = fixture();
    const before = fs.readFileSync(store._file, 'utf8');
    for (const actorId of [null, owner.id, visitor.id, viewer.id, operator.id, finance.id]) {
      assert.throws(() => moderation.reviewReport(reportId, options({ actorId })), e => [401, 403].includes(e.status));
      assert.throws(() => moderation.reinstatePage(space.id, options({ actorId, holdId: 'forged' })), e => [401, 403].includes(e.status));
    }
    assert.equal(fs.readFileSync(store._file, 'utf8'), before);
    store.update('users', owner.id, { platformRoles: ['reviewer'] });
    assert.throws(() => moderation.reviewReport(reportId, options({ actorId: owner.id })), e => e.code === 'self_review');
    assert.throws(() => moderation.reinstatePage(space.id, options({ actorId: owner.id, holdId: 'forged' })), e => e.code === 'self_review');
    store.update('users', owner.id, { platformRoles: [] });
  });
  await test('unit: empty, whitespace, nontext and oversized reasons refuse before any writes', () => {
    const { space, reportId } = fixture();
    const decision = moderation.reviewReport(reportId, options());
    const other = fixture();
    const before = fs.readFileSync(store._file, 'utf8');
    for (const reason of [undefined, null, '', ' \n ', 12, {}, 'x'.repeat(1001)]) {
      assert.throws(() => moderation.reviewReport(other.reportId, options({ reason, outcome: 'dismissed' })), e => e.status === 400);
      assert.throws(() => moderation.reinstatePage(space.id, options({ reason, holdId: decision.holdId })), e => e.status === 400);
    }
    assert.equal(fs.readFileSync(store._file, 'utf8'), before);
  });
  await test('unit: retries are durable no-ops; repeated/conflicting decisions cannot rewrite history', () => {
    const { space, reportId } = fixture();
    const input = options();
    const decision = moderation.reviewReport(reportId, input);
    const before = fs.readFileSync(store._file, 'utf8');
    assert.deepEqual(moderation.reviewReport(reportId, input), { ...decision, replayed: true });
    assert.equal(fs.readFileSync(store._file, 'utf8'), before);
    for (const over of [{ outcome: 'dismissed' }, { reason: 'Different reason' }]) assert.throws(() => moderation.reviewReport(reportId, { ...input, ...over }), e => e.code === 'idempotency_conflict');
    assert.throws(() => moderation.reviewReport(reportId, options()), e => e.code === 'already_reviewed');
    const restoreInput = options({ holdId: decision.holdId });
    moderation.reinstatePage(space.id, restoreInput);
    const reinstated = fs.readFileSync(store._file, 'utf8');
    assert.equal(moderation.reinstatePage(space.id, restoreInput).replayed, true);
    assert.equal(moderation.reviewReport(reportId, input).replayed, true);
    assert.equal(row('spaces', space.id).visibility, 'public', 'retry of old uphold cannot re-hide a reinstated page');
    assert.equal(fs.readFileSync(store._file, 'utf8'), reinstated);
    assert.throws(() => moderation.reinstatePage(space.id, options({ holdId: decision.holdId })), e => e.code === 'stale_hold');
  });
  await test('unit: dismissal cannot lift another hold; stale reinstatement cannot defeat a later uphold', () => {
    const { space, reportId } = fixture();
    const first = moderation.reviewReport(reportId, options());
    const second = page.reportSpace(space.slug, { reporterId: visitor.id, reason: 'A second report after review' }).id;
    moderation.reviewReport(second, options({ outcome: 'dismissed' }));
    assert.equal(row('spaces', space.id).publicPageModeration.holdId, first.holdId);
    const reinstateInput = options({ holdId: first.holdId });
    moderation.reinstatePage(space.id, reinstateInput);
    const third = page.reportSpace(space.slug, { reporterId: visitor.id, reason: 'A later separate report' }).id;
    const newer = moderation.reviewReport(third, options());
    assert.notEqual(newer.holdId, first.holdId);
    assert.equal(moderation.reinstatePage(space.id, reinstateInput).replayed, true);
    assert.equal(row('spaces', space.id).visibility, 'private', 'retry returns historical result, not a new publication');
    assert.throws(() => moderation.reinstatePage(space.id, options({ holdId: first.holdId })), e => e.code === 'stale_hold');
  });
  await test('unit: archive is independent; reinstatement refuses to reactivate an archived shop', () => {
    const { space, reportId } = fixture();
    const decision = moderation.reviewReport(reportId, options());
    spaces.updateSpace(space.id, { status: 'archived' }, { callerId: owner.id });
    assert.throws(() => moderation.reinstatePage(space.id, options({ holdId: decision.holdId })), e => e.code === 'inactive_space');
    spaces.updateSpace(space.id, { status: 'active' }, { callerId: owner.id });
    assert.equal(row('spaces', space.id).visibility, 'private');
    assert.throws(() => spaces.updateSpace(space.id, { visibility: 'public' }, { callerId: owner.id }), /hidden by moderation/);
    assert.throws(() => spaces.updateSpace(space.id, { visibility: 'unlisted' }, { callerId: owner.id }), /hidden by moderation/);
    moderation.reinstatePage(space.id, options({ holdId: decision.holdId, actorId: admin.id }));
    assert.equal(row('spaces', space.id).visibility, 'public');
  });
  await test('unit: all three actions preserve guardian flags/freezes, accounts, listings, orders and rewards', () => {
    for (const reportTotal of [3, 6]) {
      const { space, reportId } = fixture();
      for (let i = 1; i < reportTotal; i++) page.reportSpace(space.slug, { reason: 'Independent complaint', reporterId: `test_reporter_${i}` });
      const link = { id: `test_guardian_${reportTotal}`, spaceId: space.id, status: 'active', expiresAt: '2099-01-01T00:00:00.000Z' };
      store.insert('attributions', link);
      store.insert('orders', { id: `test_order_${reportTotal}`, vendorId: space.vendorId, spaceId: space.id, status: 'paid', total: 1500 });
      store.insert('referralEvents', { id: `test_reward_${reportTotal}`, kind: 'guardian_order', points: 12 });
      const before = protectedState(), status = guardians.effectiveStatus(link);
      const first = moderation.reviewReport(reportId, options());
      assert.deepEqual(protectedState(), before); assert.deepEqual(guardians.effectiveStatus(link), status);
      const another = store.find('spaceAbuseReports', r => r.spaceId === space.id && !r.handledAt);
      moderation.reviewReport(another.id, options({ outcome: 'dismissed' }));
      assert.deepEqual(protectedState(), before); assert.deepEqual(guardians.effectiveStatus(link), status);
      moderation.reinstatePage(space.id, options({ holdId: first.holdId }));
      assert.deepEqual(protectedState(), before); assert.deepEqual(guardians.effectiveStatus(link), status);
      const offer = spaces.createSpaceOffer(space.id, { title: 'Still able to sell', price: 40, callerId: owner.id });
      spaces.publishSpaceOffer(space.id, offer.id, { callerId: owner.id });
      assert.equal(row('listings', offer.id).status, 'active');
    }
  });
  await test('unit: audit insertion failure and disk failure roll back report, visibility and history together', () => {
    const { space, reportId } = fixture();
    const before = fs.readFileSync(store._file, 'utf8');
    const insert = store.insert;
    store.insert = function(c, r) { if (c === 'auditLog') throw new Error('simulated audit failure'); return insert.call(this, c, r); };
    try { assert.throws(() => moderation.reviewReport(reportId, options()), /simulated audit failure/); }
    finally { store.insert = insert; }
    assert.equal(fs.readFileSync(store._file, 'utf8'), before);
    assert.equal(row('spaceAbuseReports', reportId).handledAt, null); assert.equal(row('spaces', space.id).visibility, 'public');
    const write = fs.writeFileSync;
    fs.writeFileSync = () => { throw new Error('simulated disk full'); };
    try { assert.throws(() => moderation.reviewReport(reportId, options()), /simulated disk full/); }
    finally { fs.writeFileSync = write; }
    assert.equal(fs.readFileSync(store._file, 'utf8'), before);
    assert.equal(row('spaceAbuseReports', reportId).handledAt, null); assert.equal(row('spaces', space.id).visibility, 'public');
  });
  await test('HTTP: complete hidden/reinstated lifecycle across HTML, JSON, directory, sitemap and owner projection', async () => {
    const { space, reportId } = fixture();
    const reviewPath = `/api/ops/space-reports/${reportId}/review`;
    const body = { outcome: 'upheld', reason: 'Confirmed misleading public information.', actorId: owner.id };
    const decision = await call(reviewPath, { token: reviewer.token, method: 'POST', body, key: 'http-lifecycle-uphold' });
    assert.equal(decision.status, 200); assert.equal(decision.body.handledBy, reviewer.id, 'body identity is ignored');
    for (const path of [`/s/${space.slug}`, `/api/public/spaces/${space.slug}`, `/api/public/spaces/${space.slug}/page`]) assert.equal((await call(path)).status, 404);
    const html = await call(`/s/${space.slug}`); assert.equal(html.headers.get('x-robots-tag'), 'noindex'); assert.match(html.headers.get('cache-control'), /no-store/);
    assert.ok(!(await call('/api/public/spaces')).body.spaces.some(s => s.id === space.id));
    assert.ok(!page.publicSlugs().some(s => s.id === space.id || s.slug === space.slug));
    assert.ok(!(await call('/sitemap-spaces.xml')).body.includes(`/s/${space.slug}`));
    const face = await call(`/api/spaces/${space.id}/public-page`, { token: owner.token });
    assert.equal(face.body.open, false); assert.match(face.body.reason, /hidden following review/); assert.equal(face.body.reports.upheld, 1);
    const republish = await call(`/api/spaces/${space.id}`, { token: owner.token, method: 'PATCH', body: { visibility: 'public', publicPageModeration: null } });
    assert.ok(republish.status >= 400); assert.equal(row('spaces', space.id).visibility, 'private');
    // A page takedown is not a selling suspension.
    const offer = spaces.createSpaceOffer(space.id, { title: 'Allowed while page hidden', price: 50, callerId: owner.id });
    spaces.publishSpaceOffer(space.id, offer.id, { callerId: owner.id });
    assert.equal(row('listings', offer.id).status, 'active');
    const restorePath = `/api/ops/spaces/${space.id}/reinstate-page`;
    const beforeBadRestore = fs.readFileSync(store._file, 'utf8');
    assert.equal((await call(restorePath, { token: admin.token, method: 'POST', body: { holdId: decision.body.holdId, reason: ' ' }, key: 'http-empty-reinstate' })).status, 400);
    assert.equal(fs.readFileSync(store._file, 'utf8'), beforeBadRestore);
    const restoreBody = { reason: 'The owner corrected the public page.', holdId: decision.body.holdId };
    const restored = await call(restorePath, { token: admin.token, method: 'POST', body: restoreBody, key: 'http-lifecycle-reinstate' });
    assert.equal(restored.status, 200); assert.equal((await call(`/s/${space.slug}`)).status, 200);
    assert.equal((await call(`/api/public/spaces/${space.slug}/page`)).status, 200);
    assert.ok((await call('/sitemap-spaces.xml')).body.includes(`/s/${space.slug}`));
    assert.ok((await call('/api/public/spaces')).body.spaces.some(s => s.id === space.id));
    assert.equal((await call(restorePath, { token: admin.token, method: 'POST', body: restoreBody, key: 'http-lifecycle-reinstate' })).body.replayed, true);
  });
  await test('HTTP: pending → dismissed, mandatory reasons and idempotency keys, unknown outcomes and missing resources', async () => {
    const { space, reportId } = fixture();
    const path = `/api/ops/space-reports/${reportId}/review`;
    for (const body of [{ outcome: 'dismissed' }, { outcome: 'dismissed', reason: ' ' }, { outcome: 'suspend', reason: 'No such action' }]) assert.equal((await call(path, { token: reviewer.token, method: 'POST', body, key: 'http-invalid-action' })).status, 400);
    const body = { outcome: 'dismissed', reason: 'Insufficient evidence for the complaint.' };
    assert.equal((await call(path, { token: reviewer.token, method: 'POST', body })).status, 400);
    const r = await call(path, { token: reviewer.token, method: 'POST', body, key: 'http-dismiss-one' });
    assert.equal(r.status, 200); assert.equal(r.body.outcome, 'dismissed'); assert.ok(r.body.handledAt);
    assert.equal((await call(`/s/${space.slug}`)).status, 200);
    assert.equal((await call(path, { token: reviewer.token, method: 'POST', body, key: 'http-dismiss-one' })).body.replayed, true);
    assert.equal((await call(path, { token: reviewer.token, method: 'POST', body, key: 'http-dismiss-repeat' })).status, 409);
    assert.equal((await call('/api/ops/space-reports/missing/review', { token: reviewer.token, method: 'POST', body, key: 'missing-report-key' })).status, 404);
  });
  await test('HTTP: self-review is refused, parallel duplicates are idempotent, and revoked reviewers cannot replay', async () => {
    const { space, reportId } = fixture();
    const path = `/api/ops/space-reports/${reportId}/review`;
    const input = { token: reviewer.token, method: 'POST', body: { outcome: 'upheld', reason: 'Confirmed after inspection.' }, key: 'http-concurrent-uphold' };
    store.update('users', owner.id, { platformRoles: ['admin'] });
    assert.equal((await call(path, { ...input, token: owner.token })).status, 403);
    store.update('users', owner.id, { platformRoles: [] });
    const before = audits().length;
    const replies = await Promise.all([call(path, input), call(path, input)]);
    assert.deepEqual(replies.map(r => r.status), [200, 200]);
    assert.equal(replies.filter(r => r.body.replayed).length, 1);
    assert.equal(audits().length, before + 1);
    store.update('users', reviewer.id, { platformRoles: [] });
    assert.equal((await call(path, input)).status, 403, 'authorization precedes idempotency replay');
    store.update('users', reviewer.id, { platformRoles: ['reviewer'] });
    const restore = { token: admin.token, method: 'POST', body: { holdId: replies[0].body.holdId, reason: 'Confirmed correction.' }, key: 'http-concurrent-reinstate' };
    const restored = await Promise.all([call(`/api/ops/spaces/${space.id}/reinstate-page`, restore), call(`/api/ops/spaces/${space.id}/reinstate-page`, restore)]);
    assert.deepEqual(restored.map(r => r.status), [200, 200]);
    assert.equal(restored.filter(r => r.body.replayed).length, 1);
    assert.equal(audits().length, before + 2);
  });
  await test('HTTP: ordinary users, owner, ops viewer, operator and finance cannot review, reinstate or read the queue', async () => {
    const { space, reportId } = fixture();
    for (const u of [null, owner, visitor, viewer, operator, finance]) {
      const token = u?.token, expected = u ? 403 : 401;
      assert.equal((await call('/api/ops/space-reports', { token })).status, expected);
      for (const path of [`/api/ops/space-reports/${reportId}/review`, `/api/ops/spaces/${space.id}/reinstate-page`]) {
        assert.equal((await call(path, { token, method: 'POST', body: { outcome: 'upheld', reason: 'Attempt forged reviewer identity', actorId: reviewer.id, platformRoles: ['admin'], holdId: 'fake' }, key: 'unauthorized-key' })).status, expected);
      }
    }
    assert.equal(row('spaceAbuseReports', reportId).handledAt, null);
    const q = await call('/api/ops/space-reports', { token: reviewer.token });
    assert.equal(q.status, 200); assert.ok(q.body.reports.find(r => r.id === reportId && r.outcome === 'pending'));
  });
  await test('persistence: a fresh process sees the report, hold, audit and replay key after restart', () => {
    const { space, reportId } = fixture(); const input = options();
    const r = moderation.reviewReport(reportId, input);
    const disk = persisted();
    assert.equal(disk.spaceAbuseReports.find(x => x.id === reportId).handledAt, r.handledAt);
    assert.equal(disk.auditLog.find(x => x.id === r.actionId).idempotencyKey, input.idempotencyKey);
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import {store} from ${JSON.stringify(new URL('../src/store.js', import.meta.url).href)};
      import {reviewReport} from ${JSON.stringify(new URL('../src/domain/spaceModeration.js', import.meta.url).href)};
      assert.equal(store.lookup('spaces', ${JSON.stringify(space.id)}).visibility,'private');
      assert.equal(reviewReport(${JSON.stringify(reportId)},${JSON.stringify(input)}).replayed,true);
    `], { env: process.env, encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
  });
  console.log(`\nPASS ${count}`);
} finally { await new Promise(r => server.close(r)); }
