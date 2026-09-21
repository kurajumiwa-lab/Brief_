// ---------------------------------------------------------------------------
// MANUAL RAIL TESTS
//
//   node test/settlement/manual.mjs
//
// Counts printed at the end are the REAL count of checks run — never a
// claimed total.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-rail-'));
process.env.BRIEF_DATA_DIR = dir;

// ESM imports hoist, so the data dir must be set BEFORE the store loads
// (the tree's own convention — see test/workPayment.mjs).
const { store } = await import('../../src/store.js');
const manual = await import('../../src/settlement/manual.js');
const { RAIL_STATES } = await import('../../src/settlement/rail.js');
const dispatcher = await import('../../src/settlement/dispatcher.js');
const reconciler = await import('../../src/settlement/reconciler.js');

store._reset();

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`); }
};

const log = (msg) => console.log(msg);

// ---------------------------------------------------------------------------
log('\n=== DISPATCHER — manual is the default and fails closed on nonsense ===');
{
  check('default rail is manual', dispatcher.getActiveRailName() === 'manual');
  check('manual is always configured', dispatcher.isConfigured() === true);
  check('manual supports human confirmation', dispatcher.supportsManualConfirmation() === true);
}

// ---------------------------------------------------------------------------
log('\n=== DISBURSE — happy path ===');
{
  const res = await manual.disburse({
    amount: 4500,
    recipient: '+254712345678',
    reference: 'ledger_001',
    idempotencyKey: 'payout:ledger_001',
    note: 'Rider payout for job #4821',
  });

  check('returns an attemptId', Boolean(res.attemptId));
  check('status is in_flight', res.status === RAIL_STATES.IN_FLIGHT);

  const attempt = await manual.getAttempt(res.attemptId);
  check('attempt is stored', Boolean(attempt));
  check('attempt has the right amount', attempt.amount === 4500);
  check('attempt has the right recipient', attempt.recipient === '+254712345678');
  check('attempt direction is out', attempt.direction === 'out');
  check('attempt rail is manual', attempt.rail === 'manual');
}

// ---------------------------------------------------------------------------
log('\n=== IDEMPOTENCY — same key returns the same attempt ===');
{
  const first = await manual.disburse({
    amount: 4500,
    recipient: '+254712345678',
    reference: 'ledger_002',
    idempotencyKey: 'payout:ledger_002',
  });
  const second = await manual.disburse({
    amount: 4500,
    recipient: '+254712345678',
    reference: 'ledger_002',
    idempotencyKey: 'payout:ledger_002',
  });

  check('same attemptId returned', first.attemptId === second.attemptId);
  check('second call is marked deduped', second.deduped === true);
  check(
    'only one row exists for the key',
    store.filter('settlementAttempts', (a) => a.idempotencyKey === 'payout:ledger_002').length === 1
  );
}

// ---------------------------------------------------------------------------
log('\n=== VALIDATION — refusals are honest ===');
{
  const noAmount = await manual.disburse({ recipient: '+254', reference: 'x', idempotencyKey: 'payout:bad1' });
  check('missing amount refused', noAmount.status === 'refused');

  const zeroAmount = await manual.disburse({ amount: 0, recipient: '+254', reference: 'x', idempotencyKey: 'payout:bad2' });
  check('zero amount refused', zeroAmount.status === 'refused');

  const decimal = await manual.disburse({ amount: 100.5, recipient: '+254', reference: 'x', idempotencyKey: 'payout:bad3' });
  check('decimal amount refused', decimal.status === 'refused');

  const noRecipient = await manual.disburse({ amount: 100, reference: 'x', idempotencyKey: 'payout:bad4' });
  check('missing recipient refused', noRecipient.status === 'refused');

  const noKey = await manual.disburse({ amount: 100, recipient: '+254', reference: 'x' });
  check('missing idempotencyKey refused', noKey.status === 'refused');
}

// ---------------------------------------------------------------------------
log('\n=== MARK SENT — settles an outbound attempt ===');
{
  const res = await manual.disburse({
    amount: 340,
    recipient: '+254712345678',
    reference: 'ledger_003',
    idempotencyKey: 'payout:ledger_003',
  });

  const marked = await manual.markSent(res.attemptId, {
    providerRef: 'MPESA-ABC123',
    note: 'Sent via M-Pesa at 14:32',
    by: 'admin_001',
  });

  check('status is settled', marked.status === RAIL_STATES.SETTLED);

  const attempt = await manual.getAttempt(res.attemptId);
  check('providerRef recorded', attempt.providerRef === 'MPESA-ABC123');
  check('adminNote recorded', attempt.adminNote === 'Sent via M-Pesa at 14:32');
  check('completedBy recorded', attempt.completedBy === 'admin_001');
  check('completedAt set', Boolean(attempt.completedAt));
}

// ---------------------------------------------------------------------------
log('\n=== MARK SENT — idempotent on repeat ===');
{
  const res = await manual.disburse({
    amount: 500,
    recipient: '+254700000001',
    reference: 'ledger_004',
    idempotencyKey: 'payout:ledger_004',
  });
  const first = await manual.markSent(res.attemptId, { by: 'admin_001' });
  const second = await manual.markSent(res.attemptId, { by: 'admin_001' });
  check('first call settles', first.status === RAIL_STATES.SETTLED);
  check('second call is deduped, not re-settled', second.deduped === true);
}

// ---------------------------------------------------------------------------
log('\n=== MARK FAILED — settles with reason ===');
{
  const res = await manual.disburse({
    amount: 200,
    recipient: '+254700000002',
    reference: 'ledger_005',
    idempotencyKey: 'payout:ledger_005',
  });
  const failed = await manual.markFailed(res.attemptId, {
    reason: 'Recipient number not on M-Pesa',
    by: 'admin_001',
  });
  check('status is failed', failed.status === RAIL_STATES.FAILED);
  const attempt = await manual.getAttempt(res.attemptId);
  check('failureReason recorded', attempt.failureReason === 'Recipient number not on M-Pesa');
}

// ---------------------------------------------------------------------------
log('\n=== MARK FAILED — requires a reason ===');
{
  const res = await manual.disburse({
    amount: 100,
    recipient: '+254700000003',
    reference: 'ledger_006',
    idempotencyKey: 'payout:ledger_006',
  });
  const refused = await manual.markFailed(res.attemptId, {});
  check('missing reason refused', refused.status === 'refused');
}

// ---------------------------------------------------------------------------
log('\n=== CANNOT TRANSITION OUT OF A TERMINAL STATE ===');
{
  const res = await manual.disburse({
    amount: 100,
    recipient: '+254700000004',
    reference: 'ledger_007',
    idempotencyKey: 'payout:ledger_007',
  });
  await manual.markSent(res.attemptId, { by: 'admin_001' });
  const tryFailed = await manual.markFailed(res.attemptId, { reason: 'x' });
  check('cannot mark sent→failed', tryFailed.status === 'refused');
}

// ---------------------------------------------------------------------------
log('\n=== COLLECT — happy path ===');
{
  const res = await manual.collect({
    amount: 1020,
    payer: '+254712345678',
    reference: 'order_4821',
    idempotencyKey: 'collection:order_4821',
    instructions: 'Pay KES 1,020 to the shop via M-Pesa.',
  });
  check('returns an attemptId', Boolean(res.attemptId));
  check('status is in_flight', res.status === RAIL_STATES.IN_FLIGHT);
  check('instructions returned', typeof res.instructions === 'string');

  const attempt = await manual.getAttempt(res.attemptId);
  check('direction is in', attempt.direction === 'in');
  check('payer recorded', attempt.payer === '+254712345678');
}

// ---------------------------------------------------------------------------
log('\n=== COLLECT + MARK RECEIVED ===');
{
  const res = await manual.collect({
    amount: 500,
    payer: '+254700000005',
    reference: 'order_5001',
    idempotencyKey: 'collection:order_5001',
  });
  const marked = await manual.markReceived(res.attemptId, {
    providerRef: 'MPESA-XYZ',
    by: 'admin_001',
  });
  check('collection settles', marked.status === RAIL_STATES.SETTLED);
  const attempt = await manual.getAttempt(res.attemptId);
  check('providerRef recorded on collection', attempt.providerRef === 'MPESA-XYZ');
}

// ---------------------------------------------------------------------------
log('\n=== RECONCILE — nothing stuck on fresh rows ===');
{
  const result = await manual.reconcile({});
  check('reconcile returns a result', Boolean(result));
  check('rail name is manual', result.rail === 'manual');
  check('no stale rows found', result.mismatches.length === 0, `found ${result.mismatches.length}`);
}

// ---------------------------------------------------------------------------
log('\n=== RECONCILE + ESCALATE — finds a stuck in_flight attempt, once ===');
{
  // Insert an attempt with a createdAt 30 hours ago.
  const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
  store.insert('settlementAttempts', {
    id: 'sat_stuck_test',
    rail: 'manual',
    direction: 'out',
    amount: 750,
    currency: 'KES',
    recipient: '+254700000006',
    reference: 'ledger_008',
    idempotencyKey: 'payout:ledger_008',
    note: null,
    status: RAIL_STATES.IN_FLIGHT,
    providerRef: null,
    adminNote: null,
    completedBy: null,
    failureReason: null,
    createdAt: thirtyHoursAgo,
    updatedAt: thirtyHoursAgo,
    completedAt: null,
  });

  const result = await manual.reconcile({});
  const stuck = result.mismatches.find((m) => m.attemptId === 'sat_stuck_test');
  check('stuck attempt is found', Boolean(stuck));
  check('age is reported', stuck?.ageHours >= 29);
  check('resolution is escalate', stuck?.resolution === 'escalate');

  // The reconciler turns the mismatch into ONE open escalation row, and a
  // second sweep does not duplicate it.
  await reconciler.runOnce();
  await reconciler.runOnce();
  const escalations = store.filter('settlementEscalations', (e) => e.attemptId === 'sat_stuck_test' && e.status === 'open');
  check('exactly one open escalation after two sweeps', escalations.length === 1, `found ${escalations.length}`);
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(52)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
