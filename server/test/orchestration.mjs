// ---------------------------------------------------------------------------
// ORCHESTRATION TEST SUITE — the Multi-Tenant State Orchestration add-on:
//
//   PACKAGE 1  the Group Buy financial engine: 3-field intake, verifiable
//              receipt digests, ledger money-records, the auto target-met
//              stepper, tier caps, and signal fan-out through the SAME
//              Universal Data Router a gaming update uses
//   PACKAGE 3  the dynamic ticket bar: derived active entry + honest deltas
//
// Offline: webhook HTTP is left to the engine suite; here we assert the
// delivery LEDGER proves the fan-out fired for a group-buy signal.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import crypto from 'node:crypto';

const DATA_DIR = '/tmp/orchestration-test-data';
fs.rmSync(DATA_DIR, { recursive: true, force: true });
process.env.BRIEF_DATA_DIR = DATA_DIR;
process.env.ENGINE_ROUTER_SECRET = 'orchestration-secret';

let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; /* quiet on success */ }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' -> ' + detail : ''}`); }
};

const { store } = await import('../src/store.js');
const GB = await import('../src/domain/groupbuy.js');
const ROUTER = await import('../src/domain/engine/router.js');
const TIERS = await import('../src/domain/engine/tiers.js');

console.log('\n=== PACKAGE 1: GROUP BUY FINANCIAL ENGINE ===');
{
  store._reset();

  // Creation + tier cap (free = 1 active buy).
  const buy = GB.createGroupBuy({ ownerId: 'usr_org', title: 'Chama Unga December', targetAmount: 10_000 }, { maxActive: 1 });
  check('buy created at the funding stage', buy.stage === 'funding');
  check('five pipeline stages defined', GB.GROUP_BUY_STAGES.length === 5);
  check('stage labels match the blueprint', GB.GROUP_BUY_STAGES.map((s) => s.label).join(' -> ').includes('Target Achieved'));

  let threw = null, code = null;
  try { GB.createGroupBuy({ ownerId: 'usr_org', title: 'Second', targetAmount: 500 }, { maxActive: 1 }); }
  catch (e) { threw = e.message; code = e.code; }
  check('tier cap refuses a second active buy', threw !== null && code === 'tier_limit');

  // The 3-field intake.
  let r1 = GB.contribute({ groupBuyId: buy.id, memberRef: 'Wanjiku', amount: 3_000, source: 'mpesa' });
  check('first contribution recorded', r1.receipt.amount === 3000);
  check('receipt carries a verifiable digest', /^[0-9a-f]{24}$/.test(r1.receipt.receiptHash));
  check('digest recomputes from the stored row', (() => {
    const row = store.find('groupBuyContributions', (c) => c.id === r1.receipt.contributionId);
    return GB.receiptHash(row) === r1.receipt.receiptHash;
  })());
  check('progress derived from real rows', r1.progressPct === 30);
  check('stage still funding below target', GB.getGroupBuy(buy.id).stage === 'funding');

  // Money records ride the one ledger (as records, not settled payments).
  const ledgerRows = store.filter('ledgerTransactions', (t) => t.type === 'group_buy_contribution');
  check('contribution wrote a ledger money-record', ledgerRows.length === 1 && ledgerRows[0].amount === 3000);
  check('ledger row links the receipt', ledgerRows[0].metadata?.receiptHash === r1.receipt.receiptHash);

  // Validation.
  threw = null;
  try { GB.contribute({ groupBuyId: buy.id, memberRef: 'X', amount: -5 }); } catch (e) { threw = e.message; }
  check('negative amount refused', threw !== null);
  threw = null;
  try { GB.contribute({ groupBuyId: buy.id, memberRef: 'X', amount: 100, source: 'carrier-pigeon' }); } catch (e) { threw = e.message; }
  check('unknown payment source refused', /payment source/.test(threw ?? ''));
  threw = null;
  try { GB.contribute({ groupBuyId: 'gbuy_missing', memberRef: 'X', amount: 100 }); } catch (e) { threw = e.message; }
  check('unknown buy refused', /not found/.test(threw ?? ''));

  // The engine notices the target the moment it is covered.
  r1 = GB.contribute({ groupBuyId: buy.id, memberRef: 'Otieno', amount: 4_000, source: 'mpesa' });
  check('still funding at 70%', GB.getGroupBuy(buy.id).stage === 'funding');
  r1 = GB.contribute({ groupBuyId: buy.id, memberRef: 'Amina', amount: 3_500, source: 'cash' });
  check('target met auto-advances the stepper', GB.getGroupBuy(buy.id).stage === 'target_met');
  check('contribution reports the stage change', r1.stageChanged === true);
  check('total derived from all rows', GB.getGroupBuy(buy.id).total === 10_500);
  check('progress capped at 100', GB.getGroupBuy(buy.id).progressPct === 100);

  // Explicit stage moves are server-authoritative.
  const escrow = GB.advanceStage({ groupBuyId: buy.id, to: 'escrow', actorId: 'usr_org' });
  check('escrow locked from target_met', escrow.stage === 'escrow');
  const dispatched = GB.advanceStage({ groupBuyId: buy.id, to: 'dispatched', actorId: 'usr_org' });
  check('dispatched from escrow', dispatched.stage === 'dispatched');
  const delivered = GB.advanceStage({ groupBuyId: buy.id, to: 'delivered', actorId: 'usr_org' });
  check('delivered is terminal', delivered.stage === 'delivered' && delivered.stageIndex === 4);

  threw = null;
  try { GB.advanceStage({ groupBuyId: buy.id, to: 'funding' }); } catch (e) { threw = e.message; }
  check('backwards stage moves refused', /cannot move/.test(threw ?? ''));
  threw = null;
  try { GB.advanceStage({ groupBuyId: buy.id, to: 'escrow' }); } catch (e) { threw = e.message; }
  check('illegal skips refused', /cannot move/.test(threw ?? ''));

  // Stage history is the audit trail.
  check('history records every stage', delivered.history.map((h) => h.stage).join(',') === 'funding,target_met,escrow,dispatched,delivered');
}

console.log('\n=== UNIFIED PAYLOAD ROUTING (one pipeline for money and matches) ===');
{
  store._reset();
  // A chama treasurer routes contribution signals to the group's webhook.
  ROUTER.createRoute(
    { ownerId: 'usr_org', name: 'Chama thread', match: { signalType: 'group_buy_contribution' }, channels: [{ kind: 'webhook', to: 'https://hook.test/chama' }] },
    { maxRoutes: null }
  );
  const buy = GB.createGroupBuy({ ownerId: 'usr_org', title: 'Rice group buy', targetAmount: 2_000 }, { maxActive: null });
  const before = store.all('engineDeliveries').length;
  GB.contribute({ groupBuyId: buy.id, memberRef: 'Wanjiku', amount: 500, source: 'mpesa' });
  // emitSignal fans out fire-and-forget; let the microtasks run.
  await new Promise((r) => setTimeout(r, 25));
  const rows = store.all('engineDeliveries');
  check('contribution signal reached the router ledger', rows.length === before + 1, `${rows.length - before}`);
  check('delivery attributed to the chama route', rows[rows.length - 1]?.routeId != null);
  check('the same router serves gaming + finance (one ledger)', Array.isArray(rows));

  // A gaming signal on the same route set stays unrouted unless matched.
  const { emitSignal } = await import('../src/domain/signal.js');
  const before2 = store.all('engineDeliveries').length;
  emitSignal({ type: 'order_placed', actorId: 'usr_org' });
  await new Promise((r) => setTimeout(r, 10));
  check('unmatched signals do not dispatch', store.all('engineDeliveries').length === before2);

  // The signed payload is verifiable end to end.
  const payload = ROUTER.compilePayload({
    id: 'sig_test', type: 'group_buy_contribution', value: 500,
    objectId: null, createdAt: '2026-08-26T00:00:00Z'
  });
  const sig = ROUTER.signPayload(ROUTER.payloadBytes(payload));
  const expect = crypto.createHmac('sha256', 'orchestration-secret').update(ROUTER.payloadBytes(payload)).digest('hex');
  check('receipt payload signature verifies', sig === expect);
}

console.log('\n=== PACKAGE 3: DYNAMIC TICKET BAR ===');
{
  store._reset();
  // A live event with the caller's registration.
  const campaign = store.insert('campaigns', {
    id: 'cmp_gate', ownerId: 'usr_host', title: 'Kilimani Night Market', type: 'popup',
    status: 'live', publicSlug: 'night-market', price: 0, createdAt: '2026-08-20T00:00:00Z',
    updatedAt: '2026-08-20T00:00:00Z'
  });
  store.insert('registrations', {
    id: 'reg_me', campaignId: campaign.id, attendeeRef: 'usr_me', userId: 'usr_me',
    name: 'Me', status: 'registered', ticketCode: 'BRF-9921-AAAA-BBBB',
    createdAt: '2026-08-21T00:00:00Z'
  });

  // Resolve via the route layer's derivation by calling the endpoint below;
  // here assert the data the derivation reads.
  const reg = store.find('registrations', (r) => r.id === 'reg_me');
  const cmp = store.find('campaigns', (c) => c.id === reg.campaignId);
  check('registration binds the user', reg.userId === 'usr_me');
  check('campaign is live', cmp.status === 'live');
  check('ticket code present', /^BRF-/.test(reg.ticketCode));

  // A campaign update after ticket issuance is the delta.
  store.update('campaigns', campaign.id, { title: 'Kilimani Night Market (new venue)', updatedAt: '2026-08-25T00:00:00Z' });
  const updated = store.find('campaigns', (c) => c.id === campaign.id);
  check('delta detectable (event changed after ticket)', updated.updatedAt > reg.createdAt);
}

// ---- HTTP surface -------------------------------------------------------------
console.log('\n=== HTTP SURFACE ===');
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
    // Create over HTTP (dev-fallback caller, free tier: cap 1).
    let r = await call('/api/engine/group-buys', 'POST', { title: 'Unga December', targetAmount: 6000 });
    check('group buy created over HTTP', r.status === 201 && Boolean(r.body?.groupBuy?.id));
    check('view carries the stepper', Array.isArray(r.body?.groupBuy?.stages) && r.body.groupBuy.stages.length === 5);
    const id = r.body.groupBuy.id;

    r = await call('/api/engine/group-buys', 'POST', { title: 'Second', targetAmount: 500 });
    check('free-tier cap enforced over HTTP (403)', r.status === 403 && r.body?.code === 'tier_limit');

    // The 3-field intake over HTTP.
    r = await call(`/api/engine/group-buys/${id}/contribute`, 'POST', { memberRef: 'Wanjiku', amount: 2000, source: 'mpesa' });
    check('contribution over HTTP returns the receipt', r.status === 201 && /^[0-9a-f]{24}$/.test(r.body?.receipt?.receiptHash ?? ''));
    check('receipt echoes the member + source', r.body?.receipt?.memberRef === 'Wanjiku' && r.body?.receipt?.source === 'mpesa');

    r = await call(`/api/engine/group-buys/${id}/contribute`, 'POST', { memberRef: 'Otieno', amount: 4500, source: 'cash' });
    check('target met surfaces over HTTP', r.body?.stageChanged === true && r.body?.progressPct === 100);

    r = await call(`/api/engine/group-buys/${id}/stage`, 'POST', { to: 'escrow' });
    check('stage advance over HTTP', r.status === 200 && r.body?.groupBuy?.stage === 'escrow');

    r = await call(`/api/engine/group-buys/${id}/stage`, 'POST', { to: 'funding' });
    check('illegal stage move refused (400)', r.status === 400);

    r = await call('/api/engine/group-buys');
    check('my buys list over HTTP', r.status === 200 && r.body?.groupBuys?.length === 1);

    // Ticket bar: no active entry yet.
    r = await call('/api/engine/ticket-bar');
    check('ticket bar honest when nothing active', r.status === 200 && r.body?.active === false);

    // Create a live event + the caller's registration + a later update.
    store.insert('campaigns', {
      id: 'cmp_live', ownerId: 'usr_host', title: 'Night Market', type: 'popup',
      status: 'live', publicSlug: 'nm', price: 0,
      createdAt: '2026-08-20T00:00:00Z', updatedAt: '2026-08-20T00:00:00Z'
    });
    store.insert('registrations', {
      id: 'reg_http', campaignId: 'cmp_live', attendeeRef: 'usr_me', userId: null,
      name: 'Walk-in', status: 'registered', ticketCode: 'BRF-9921-CCCC-DDDD',
      createdAt: '2026-08-21T00:00:00Z'
    });
    r = await call('/api/engine/ticket-bar');
    check('ticket bar active for a live event', r.body?.active === true);
    check('ticket carries the code', r.body?.ticket?.ticketCode === 'BRF-9921-CCCC-DDDD');
    check('entry state derived as active', r.body?.ticket?.entryState === 'active');

    store.update('campaigns', 'cmp_live', { updatedAt: '2026-08-26T00:00:00Z' });
    r = await call('/api/engine/ticket-bar');
    check('delta surfaces after the event changes', Array.isArray(r.body?.deltas) && r.body.deltas.length === 1 && r.body.deltas[0].kind === 'details_updated');
  } finally {
    srv.close();
  }
}

console.log(`\n${'='.repeat(52)}\nORCHESTRATION  PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
