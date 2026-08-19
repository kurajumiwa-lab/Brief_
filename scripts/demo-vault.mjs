#!/usr/bin/env node
// ---------------------------------------------------------------------------
// THE VAULT — demonstration journey
//
// A deterministic, seeded walk of the full architecture through the REAL
// domain layer. No fake payments, no decorative UI: every step runs the same
// code the server runs, and the Tuma provider is an explicit TEST ADAPTER
// (a stubbed fetch) — the directive's sanctioned way to exercise the rail
// without a live Tuma account.
//
//   node scripts/demo-vault.mjs
// ---------------------------------------------------------------------------

process.env.BRIEF_DATA_DIR = '/tmp/brief-demo-data';
process.env.HANDOFF_SECRET = 'demo-handoff-secret';
process.env.TUMA_EMAIL = 'demo@brief.example';
process.env.TUMA_API_KEY = 'tuma_demo_key';
process.env.TUMA_WEBHOOK_SECRET = 'demo-webhook-secret';
process.env.BRIEF_PUBLIC_ORIGIN = 'https://brief.example.com';

// A test adapter for Tuma: returns the real response shapes the connector
// expects, so the payment rail is genuinely exercised without a live account.
const tumaAdapter = async (url, opts) => {
  if (url.endsWith('/auth/token')) {
    return { ok: true, status: 200, json: async () => ({ success: true, data: { token: 'jwt.demo.token' } }) };
  }
  if (url.endsWith('/payment/stk-push')) {
    return {
      ok: true, status: 200,
      json: async () => ({
        success: true, message: 'sent',
        data: { checkout_request_id: 'ws_CO_DEMO', merchant_request_id: 'mr_demo', customer_message: 'Check your phone' }
      })
    };
  }
  throw new Error('unexpected URL ' + url);
};

const { store } = await import('../server/src/store.js');
const vault = await import('../server/src/domain/vault.js');
const footsteps = await import('../server/src/domain/footsteps.js');
const handoff = await import('../server/src/domain/handoff.js');
const vendors = await import('../server/src/domain/vendor.js');
const listings = await import('../server/src/domain/listing.js');
const orders = await import('../server/src/domain/order.js');
const payment = await import('../server/src/domain/payment.js');
const ledger = await import('../server/src/domain/ledger.js');

store._reset();

const line = () => console.log('─'.repeat(64));
const step = (s) => console.log(`\n▸ ${s}`);

step('1. Host creates a private gathering');
const v = vault.createVault({
  ownerId: 'usr_host', type: 'gathering', title: 'Rooftop Saturday',
  description: 'A rooftop gathering in Kilimani', visibility: 'invite_only', location: 'Kilimani'
});
console.log(`   vault ${v.id}  slug=${v.slug}  (${v.visibility})`);

step('2. A vendor exists, with a listing');
const vendor = vendors.createVendor({ ownerId: 'usr_vendor', displayName: 'Catering Co' });
const listing = listings.createListing({ vendorId: vendor.id, title: 'Platters', type: 'service', price: 3000, currency: 'KES', quantityAvailable: 10 });
listings.transitionListing(listing.id, 'active');
console.log(`   vendor=${vendor.displayName}  listing="${listing.title}" KES ${listing.price}`);

step('3. Guest discovers the gathering through a link and enters (no account)');
const entry = vault.publicEnter(v.slug, { name: 'Wanjiku', channel: 'web' });
console.log(`   entered as ${entry.participant.name} (${entry.participant.role}), got an entry token`);

step('4. Guest RSVPs, then asks a question; the host responds');
footsteps.recordFootstep({ vaultId: v.id, kind: 'rsvp_created', actorName: 'Wanjiku', channel: 'web' });
footsteps.recordFootstep({ vaultId: v.id, kind: 'question_asked', actorName: 'Wanjiku', channel: 'web', narrative: 'Wanjiku asked about the dress code' });
footsteps.recordFootstep({ vaultId: v.id, kind: 'host_responded', actorName: 'Host', channel: 'web', narrative: 'Host replied: smart casual' });

step('5. Guest requests an extra service; Brief routes it to the vendor');
const req = vault.createRequest('usr_host', { vaultId: v.id, participantId: entry.participant.id, description: '10 extra chairs', kind: 'service' });
vault.routeRequest('usr_host', { requestId: req.id, vendorId: vendor.id });
console.log(`   request "${req.description}" routed to ${vendor.displayName}`);

step('6. Vendor accepts the request');
vault.acceptRequest('usr_vendor', { requestId: req.id });
console.log(`   status=${store.find('vaultRequests', (r) => r.id === req.id).status}`);

step('7. An order is created and linked to the vault');
const order = orders.createOrder({ listingId: listing.id, buyerId: 'usr_host', quantity: 1 });
vault.linkVault('usr_host', v.id, { kind: 'order', id: order.id });
console.log(`   order ${order.id} total=KES ${order.total}`);

step('8. Payment is initiated through Tuma (test adapter)');
const { intent } = payment.createIntent({ orderId: order.id, payerId: 'usr_host', phone: '0722000111' });
const init = await payment.requestPayment(intent.id, { fetchImpl: tumaAdapter });
console.log(`   ${init.ok ? 'authorized' : 'failed'}  providerRef=${init.providerRef}`);

step('9. Tuma callback arrives; Brief verifies and settles exactly once');
const confirmed = payment.confirmPayment({ providerRef: init.providerRef, succeeded: true, amount: order.total, receipt: 'REC_DEMO' });
orders.attachTransaction(order.id, confirmed.transactionId);
vault.emitOrderFootsteps(order.id, 'payment_settled', { actorId: 'usr_host', value: order.total, dedupeKey: `pay:settled:${init.providerRef}` });
console.log(`   ledger tx=${confirmed.transactionId}  status=${confirmed.transaction.status}`);
const dup = payment.confirmPayment({ providerRef: init.providerRef, succeeded: true, amount: order.total, receipt: 'REC_DEMO' });
console.log(`   duplicate callback → ${dup.duplicate ? 'idempotent no-op (safe)' : 'BUG: double-settled'}`);

step('10. Guest continues through another channel (handoff)');
const h = handoff.createHandoff({ vaultId: v.id, participantId: entry.participant.id, purpose: 'handoff', fromChannel: 'web', toChannel: 'telegram' });
const resolved = handoff.resolveHandoff(h.token);
console.log(`   handoff resolved → same vault=${resolved.vaultId === v.id}  same participant=${resolved.participantId === entry.participant.id}`);
footsteps.recordFootstep({ vaultId: v.id, kind: 'channel_changed', actorName: 'Wanjiku', channel: 'telegram', dedupeKey: `handoff:${entry.participant.id}:${v.id}` });

line();
console.log('\nTHE VAULT TIMELINE (the complete journey):\n');
for (const f of footsteps.listFootsteps(v.id).footsteps) {
  const t = new Date(f.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
  console.log(`  ${t}  [${f.category.padEnd(8)}] ${f.narrative}`);
}

line();
const hostView = vault.vaultView('usr_host', v.id);
const vendorView = vault.vaultView('usr_vendor', v.id);
const guestView = vault.vaultView(entry.participant.id, v.id);
const pubView = vault.vaultView(null, v.id);

console.log('\nSCOPED VIEWS:');
console.log(`  host   sees participants=${hostView.participants.length} requests=${hostView.requests.length} links=${hostView.links.length}`);
console.log(`  vendor sees requests=${vendorView.requests.length}  participants leaked=${vendorView.participants !== undefined ? 'YES (BUG)' : 'no'}`);
console.log(`  guest  sees participant=${guestView.participant?.name ?? '—'}  roster leaked=${guestView.participants !== undefined ? 'YES (BUG)' : 'no'}`);
console.log(`  public sees participants leaked=${pubView.participants !== undefined ? 'YES (BUG)' : 'no'}`);

// The invariants that matter.
const checks = [
  ['one vault for the whole journey', store.all('vaults').length === 1],
  ['no duplicate participant from handoff', store.all('vaultParticipants').filter((p) => p.name === 'Wanjiku').length === 1],
  ['one ledger transaction', store.all('ledgerTransactions').length === 1],
  ['order paid + settled', orders.getOrder(order.id).paid === true],
  ['payment settled footstep present', footsteps.listFootsteps(v.id).footsteps.some((f) => f.kind === 'payment_settled')],
  ['vendor sees only scoped requests', vendorView.requests.length === 1]
];

console.log('\nINVARIANTS:');
let ok = true;
for (const [name, pass] of checks) {
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
  if (!pass) ok = false;
}
console.log(`\n${ok ? 'DEMO PASSED' : 'DEMO FAILED'}`);
process.exit(ok ? 0 : 1);
