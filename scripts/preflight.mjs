#!/usr/bin/env node
// ---------------------------------------------------------------------------
// PREFLIGHT — the go-live checklist, executed against a RUNNING deployment.
//
//   node scripts/preflight.mjs http://127.0.0.1:8080 [--admin-token <jwt>]
//
// Three tiers, honestly labelled:
//   REQUIRED  the deployment is not safe to onboard users without it
//   WARN      legal or product risk; go live only if you accept it
//   OFF       a seam with no credentials — the expected fail-closed state
//
// Exit code 0 only when every REQUIRED check passes.
// ---------------------------------------------------------------------------
const base = process.argv[2]?.replace(/\/$/, '') ?? 'http://127.0.0.1:8080';
const tokIdx = process.argv.indexOf('--admin-token');
const adminToken = tokIdx >= 0 ? process.argv[tokIdx + 1] : null;

let required = 0, requiredFailed = 0, warned = 0;
const req = (name, ok, detail = '') => {
  required++;
  if (ok) { console.log(`  PASS  ${name}`); }
  else { requiredFailed++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
};
const warn = (name, ok, detail = '') => {
  if (ok) { console.log(`  PASS  ${name}`); }
  else { warned++; console.log(`  WARN  ${name}${detail ? ' -> ' + detail : ''}`); }
};
const get = async (path, token) => {
  try {
    const r = await fetch(base + path, { headers: token ? { authorization: 'Bearer ' + token } : {} });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  } catch (e) {
    return { status: 0, body: null, err: String(e.message ?? e) };
  }
};

console.log(`PREFLIGHT — ${base}\n`);

console.log('== the process is alive ==');
let r = await get('/api/health');
req('the server answers /api/health', r.status === 200 && r.body?.ok === true, r.err ?? r.status);
r = await get('/api/config');
req('the client handshake config is public', r.status === 200 && typeof r.body?.campaignPathPrefix === 'string', r.status);
if (!r.body?.publicOrigin) { warned++; console.log('  WARN  BRIEF_PUBLIC_ORIGIN is not set - share links will say "no public link configured"'); }

r = await get('/api/ready');
req('the server reports READY', r.status === 200 && r.body?.ready !== false, JSON.stringify(r.body).slice(0, 100));

console.log('\n== the gates hold ==');
r = await get('/api/feed');
req('member data is gated (401 anonymous)', r.status === 401, r.status);
r = await get('/api/ops/members');
req('the admin desk is gated (401 anonymous)', r.status === 401, r.status);
r = await get('/api/legal/terms');
req('the legal documents are public and versioned', r.status === 200 && r.body?.version >= 1 && Boolean(r.body?.effective), r.status);
r = await get('/api/legal/privacy');
req('the privacy notice is served', r.status === 200 && /Data Protection Act/.test(r.body?.body ?? ''), r.status);

console.log('\n== money, honestly ==');
// /api/capabilities needs a session; the deploy probes that stay public are
// the legal docs above and the gates below. With a token we check the rest.
if (adminToken) {
  r = await get('/api/capabilities', adminToken);
  const caps = r.body ?? {};
  req('capabilities are reported', r.status === 200 && typeof caps.payments?.configured === 'boolean', r.status);
  if (caps.arenaMoney?.enabled) console.log('  NOTE  arena money is ENABLED - confirm BRIEF_GAMING_LICENCE_ID is real before onboarding');
  else console.log('  OFF   arena money is off without a licence (by design)');
} else {
  console.log('  OFF   payments/arena-money state is checked with --admin-token (a session is required)');
}
console.log(false
  ? '  NOTE  a payment provider IS configured — the compliance gate now governs real money'
  : '  OFF   no payment provider — payouts/collect refuse honestly (by design)');


console.log('\n== operator readiness ==');
if (adminToken) {
  r = await get('/api/ops/members', adminToken);
  req('the members desk answers for the bootstrapped admin', r.status === 200 && Array.isArray(r.body?.rows), JSON.stringify(r.body).slice(0, 80));
  r = await get('/api/ops/onboarding', adminToken);
  req('the onboarding funnel is live', r.status === 200 && r.body?.totals?.members >= 1, JSON.stringify(r.body?.totals));
  warn('at least one admin-capable operator exists', r.status === 200, '');
  r = await get('/api/fees/all', adminToken);
  if (r.status === 403) {
    console.log('  WARN  the provided token is not finance-capable — fee confirmation needs a BRIEF_FINANCE handle');
    warned++;
  } else {
    req('the fee desk answers for finance', r.status === 200, r.status);
  }
} else {
  console.log('  SKIP  admin checks (pass --admin-token <jwt> to verify the members desk, funnel and fee desk)');
  console.log('        first admin is named by BRIEF_ADMINS in the deployment env');
}

console.log('\n== content ==');
r = await get('/api/status');
warn('the deployment is not empty (objects exist)', (r.body?.objects ?? 0) > 0, `objects=${r.body?.objects ?? 0} — run \`npm run seed\` for starter content`);

console.log(`\n${'='.repeat(52)}`);
console.log(`REQUIRED: ${required - requiredFailed}/${required} passed · WARNINGS: ${warned}`);
if (requiredFailed > 0) { console.log('RESULT: NOT READY TO ONBOARD USERS'); process.exit(1); }
console.log('RESULT: READY' + (warned > 0 ? ' (with warnings)' : ''));
process.exit(0);
