#!/usr/bin/env node
// ---------------------------------------------------------------------------
// SEEDED SMOKE TEST — trace the deployed journey through the REAL HTTP API
//
// Seeds realistic demo content, boots the production server on an ephemeral
// port, and verifies the exact path a first-time user would hit:
//
//   / → SPA shell · /api/health · register → session · /api/objects (Nearby,
//   non-empty) · /api/objects/:id (trust enrichments) · /api/listings ·
//   /api/public/campaigns/:slug · register → ticketCode · ticket lookup
//   (host-scoped) · capabilities
//
// The app gate requires a signed-in session for private routes, so the smoke
// registers a real user first and carries the session token — exactly like the
// client does. Stops honestly at the payment provider (no credentials, no
// fake success). Exits non-zero on any failed assertion.
// ---------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.NODE_ENV = 'production';
process.env.BRIEF_DATA_DIR = '/tmp/brief-seed-smoke';
// The server binds at import time; give it a port that is definitely free so
// this smoke never collides with a running instance on 8787.
process.env.PORT = String(20000 + Math.floor(Math.random() * 20000));

// Seed in-process into the SAME store the server will use (the CLI wrapper
// calls the same domain service — this keeps it to one process).
const { store } = await import(path.join(ROOT, 'server', 'src', 'store.js'));
const { runSeed } = await import(path.join(ROOT, 'server', 'src', 'domain', 'seed.js'));
store._reset();
runSeed();

const { default: app } = await import(path.join(ROOT, 'server', 'src', 'index.js'));
const srv = app.listen(0);
const port = srv.address().port;
const B = `http://127.0.0.1:${port}`;

let pass = 0, fail = 0;
const check = (n, c, d = '') => { if (c) { pass++; console.log('  PASS  ' + n); } else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); } };

const call = async (p, method = 'GET', body, token) => {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${B}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => null) };
};

let r;

// 1. Root serves the SPA.
const rootRes = await fetch(`${B}/`);
check('GET / serves the SPA shell', rootRes.status === 200 && (await rootRes.text()).includes('<div id="root">'), 'status ' + rootRes.status);

// 2. Health.
r = await call('/api/health');
check('GET /api/health returns ok', r.status === 200 && r.body?.ok === true);

// 3. A real session, exactly as the client establishes one.
const signup = await call('/api/auth/register', 'POST', { handle: `smoke${Date.now()}`, password: 'a good passphrase', displayName: 'Smoke Tester' });
check('register signs the smoke user in', signup.status === 201 && typeof signup.body?.token === 'string', 'status ' + signup.status);
const token = signup.body?.token;

// 4. Discovery is NON-EMPTY after seeding (authenticated — the app gate).
r = await call('/api/objects', 'GET', undefined, token);
check('GET /api/objects returns seeded objects', r.status === 200 && Array.isArray(r.body?.objects) && r.body.objects.length > 0, `count=${r.body?.objects?.length}`);
const first = r.body?.objects?.[0];

// 5. Trust projection rides on the feed: provenance + verification on every row.
if (first) {
  check('feed rows carry source names', Array.isArray(first.sourceNames) && first.sourceNames.length > 0, JSON.stringify(first.sourceNames));
  check('feed rows carry verification status', ['unverified', 'source_confirmed', 'cross_source_confirmed', 'community_confirmed'].includes(first.verificationStatus), first.verificationStatus);
  check('feed rows carry a publication time', typeof first.publishedAt === 'string', String(first.publishedAt));
}

// 6. Open one object — the detail carries trust enrichments.
if (first) {
  r = await call(`/api/objects/${first.id}`, 'GET', undefined, token);
  check('GET /api/objects/:id opens one object', r.status === 200 && Boolean(r.body?.object?.title));
  check('detail carries corrections (trust layer)', Array.isArray(r.body?.object?.corrections), JSON.stringify(r.body?.object?.corrections));
  check('detail carries open report count (trust layer)', Number.isInteger(r.body?.object?.openReportCount), String(r.body?.object?.openReportCount));
}

// 7. The public feed is anonymous-reachable and carries the trust projection.
r = await call('/api/public/feed');
check('GET /api/public/feed is anonymous', r.status === 200 && r.body?.feed, 'status ' + r.status);
const pubRow = r.body?.feed?.discovery?.[0] ?? r.body?.feed?.hero?.[0];
check('public feed rows carry source names', Boolean(pubRow) && Array.isArray(pubRow.sourceNames), JSON.stringify(pubRow?.sourceNames));

// 8. Marketplace.
r = await call('/api/listings', 'GET', undefined, token);
check('GET /api/listings returns seeded listings', r.status === 200 && Array.isArray(r.body?.listings) && r.body.listings.length > 0, `count=${r.body?.listings?.length}`);

// 9 + 10. Public campaign page + registration → a real ticket code.
const publicCampaign = store.filter('campaigns', (c) => c.status === 'live')[0];
if (publicCampaign) {
  r = await call(`/api/public/campaigns/${publicCampaign.publicSlug}`);
  check('GET /api/public/campaigns/:slug returns the projection', r.status === 200 && r.body?.campaign?.title === publicCampaign.title);

  r = await call(`/api/public/campaigns/${publicCampaign.publicSlug}/register`, 'POST', { attendeeRef: 'smoke-user', name: 'Smoke Tester' });
  const reg = r.body?.registration;
  check('public register returns a ticket code', r.status === 201 && typeof reg?.ticketCode === 'string', JSON.stringify(reg));

  // 11. Ticket lookup is host-scoped: a fresh host (not the owner) is honestly refused.
  const host = await call('/api/auth/register', 'POST', { handle: `smokehost${Date.now()}`, password: 'a good passphrase' });
  if (host.body?.token) {
    r = await call(`/api/tickets/${reg.ticketCode}`, 'GET', undefined, host.body.token);
    check('ticket lookup is host-scoped (404 for non-owner)', r.status === 404, 'status ' + r.status);
  }
}

// 12. Capabilities reports the honest payment state.
r = await call('/api/capabilities', 'GET', undefined, token);
check('GET /api/capabilities reports payments honestly', r.status === 200 && r.body?.payments?.configured === false);

srv.close();
console.log(`\nSmoke: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
