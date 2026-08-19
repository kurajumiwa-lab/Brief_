#!/usr/bin/env node
// ---------------------------------------------------------------------------
// SEEDED SMOKE TEST — trace the deployed journey through the REAL HTTP API
//
// Seeds realistic demo content, boots the production server on an ephemeral
// port, and verifies the exact path a first-time user would hit:
//
//   / → SPA shell · /api/health · /api/objects (Nearby, non-empty) ·
//   /api/objects/:id · /api/listings · /api/public/campaigns/:slug ·
//   register → ticketCode · ticket lookup (host-scoped) · capabilities
//
// Stops honestly at the payment provider (no credentials, no fake success).
// Exits non-zero on any failed assertion.
// ---------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.NODE_ENV = 'production';
process.env.BRIEF_DATA_DIR = '/tmp/brief-seed-smoke';

// Seed into the same data dir the server will read.
execSync('node scripts/seed-demo.mjs', { cwd: ROOT, env: process.env, stdio: 'inherit' });

const { store } = await import(path.join(ROOT, 'server', 'src', 'store.js'));
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

// 3. Discovery is NON-EMPTY after seeding.
r = await call('/api/objects');
check('GET /api/objects returns seeded objects', r.status === 200 && Array.isArray(r.body?.objects) && r.body.objects.length > 0, `count=${r.body?.objects?.length}`);
const first = r.body?.objects?.[0];

// 4. Open one object.
if (first) {
  r = await call(`/api/objects/${first.id}`);
  check('GET /api/objects/:id opens one object', r.status === 200 && Boolean(r.body?.object?.title));
}

// 5. Marketplace.
r = await call('/api/listings');
check('GET /api/listings returns seeded listings', r.status === 200 && Array.isArray(r.body?.listings) && r.body.listings.length > 0, `count=${r.body?.listings?.length}`);

// 6 + 7. Public campaign page + registration → a real ticket code.
const publicCampaign = store.filter('campaigns', (c) => c.status === 'live')[0];
if (publicCampaign) {
  r = await call(`/api/public/campaigns/${publicCampaign.publicSlug}`);
  check('GET /api/public/campaigns/:slug returns the projection', r.status === 200 && r.body?.campaign?.title === publicCampaign.title);

  r = await call(`/api/public/campaigns/${publicCampaign.publicSlug}/register`, 'POST', { attendeeRef: 'smoke-user', name: 'Smoke Tester' });
  const reg = r.body?.registration;
  check('public register returns a ticket code', r.status === 201 && typeof reg?.ticketCode === 'string', JSON.stringify(reg));

  // 8. Ticket lookup is host-scoped: a fresh host (not the owner) is honestly refused.
  const host = await call('/api/auth/register', 'POST', { handle: `smokehost${Date.now()}`, password: 'a good passphrase' });
  if (host.body?.token) {
    r = await call(`/api/tickets/${reg.ticketCode}`, 'GET', undefined, host.body.token);
    check('ticket lookup is host-scoped (404 for non-owner)', r.status === 404, 'status ' + r.status);
  }
}

// 9. Capabilities reports the honest payment state.
r = await call('/api/capabilities');
check('GET /api/capabilities reports payments honestly', r.status === 200 && r.body?.payments?.configured === false);

srv.close();
console.log(`\nSmoke: ${pass} passed / ${fail} failed`);
process.exit(fail ? 1 : 0);
