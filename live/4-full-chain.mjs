// ---------------------------------------------------------------------------
// LIVE: THE WHOLE CHAIN, TWO REAL ACTORS, THROUGH THE PRODUCTION BUILD
//
//   Identity -> Object -> Campaign -> Participation -> Listing -> Order
//     -> Fulfilment -> Payment -> Transaction -> Ledger -> Settlement -> Payout
//
// and the Arena / Fantasy surfaces alongside it.
//
// Everything below goes over HTTP through :4173/ingest -- the production
// bundle's proxy -- so this exercises the exact path a browser uses. No
// domain-layer shortcuts: real authentication now makes two genuine actors
// possible over the wire.
// ---------------------------------------------------------------------------

const B = 'http://127.0.0.1:4173/ingest';
let pass = 0, fail = 0;
const check = (n, c, d = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d ? ' -> ' + d : '')); }
};
const call = async (p, m = 'GET', body, token) => {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(B + p, { method: m, headers, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
};
const uniq = Date.now().toString(36);

console.log('=== IDENTITY ===');
let r = await call('/api/auth/register', 'POST', { handle: `seller_${uniq}`, password: 'a good passphrase', displayName: 'Mama Njeri' });
check('seller registers', r.status === 201, JSON.stringify(r.body).slice(0, 120));
const S = r.body;
r = await call('/api/auth/register', 'POST', { handle: `buyer_${uniq}`, password: 'a good passphrase', displayName: 'Otieno' });
check('buyer registers', r.status === 201);
const Bu = r.body;
check('two distinct identities', S.user.id !== Bu.user.id);
check('no password material returned', !/passwordHash|passwordSalt/.test(JSON.stringify(S)));

r = await call('/api/auth/me', 'GET', undefined, S.token);
check('the server confirms who the seller is', r.body?.user?.id === S.user.id);
r = await call('/api/auth/me', 'GET', undefined, 'forged-token');
check('a forged token is refused (401)', r.status === 401);

console.log('\n=== OBJECT -> CAMPAIGN -> PARTICIPATION ===');
// The classifier requires two independent signals (time / place / price /
// contact / url) before it will mint an object. That refusal is a FEATURE --
// a note with no signal is not an object -- so the text here carries real ones.
r = await call('/api/brief-it/save', 'POST', { text: `Night market ${uniq} at Yaya Centre rooftop, Saturday 6pm - 10pm, entry KSh 200. Call 0722123456.` }, S.token);
check('an object is captured from plain text', r.status === 200 || r.status === 201);
const objectId = r.body?.result?.objectId;
check('it has an id', Boolean(objectId), JSON.stringify(r.body?.result).slice(0, 160));

// The same refusal, proven rather than assumed.
r = await call('/api/brief-it/save', 'POST', { text: `just some idle chatter ${uniq} with nothing in it` }, S.token);
check('a signal-free note is REFUSED, not stored as an object',
  r.body?.result?.created === false && /not object worthy/.test(r.body?.result?.reason ?? ''));

r = await call('/api/campaigns', 'POST', { objectId, title: `Night Market ${uniq}`, type: 'event', capacity: 2 }, S.token);
check('a campaign wraps it', r.status === 201, JSON.stringify(r.body).slice(0, 140));
const camp = r.body.campaign;
check('it starts as draft', camp.status === 'draft');
r = await call(`/api/public/campaigns/${camp.publicSlug}`);
check('a draft is NOT publicly reachable', r.status === 404);

await call(`/api/campaigns/${camp.id}/publish`, 'POST', {}, S.token);
r = await call(`/api/public/campaigns/${camp.publicSlug}`);
check('once published the link works with NO auth', r.status === 200);
const pubv = JSON.stringify(r.body);
check('the public view leaks no ownerId', !/ownerId/.test(pubv));
check('and no attendee roster', !/attendeeRef|registrations/.test(pubv));

r = await call(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: '0711000001', name: 'Walk-in' });
check('a stranger participates without an account', r.status === 200 || r.status === 201);
await call(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: '0711000002', name: 'Second' });
r = await call(`/api/public/campaigns/${camp.publicSlug}/register`, 'POST', { attendeeRef: '0711000003', name: 'Third' });
check('capacity is ENFORCED (409 when full)', r.status === 409, `got ${r.status}`);

console.log('\n=== LISTING -> ORDER (two real actors) ===');
await call('/api/vendors', 'POST', { displayName: 'Mama Njeri Groceries', contactMethod: '0722 000111' }, S.token);
r = await call('/api/listings', 'POST', { title: 'Crate of tomatoes', type: 'product', price: 2500, currency: 'KES', quantityAvailable: 20 }, S.token);
check('the seller lists a product', r.status === 201);
const listing = r.body.listing;
check('it starts as draft', listing.status === 'draft');
await call(`/api/listings/${listing.id}/status`, 'POST', { status: 'active' }, S.token);
r = await call('/api/listings');
check('it becomes publicly discoverable', r.body.listings.some((l) => l.id === listing.id));

r = await call(`/api/listings/${listing.id}`, 'PATCH', { price: 1 }, Bu.token);
check('the BUYER cannot edit the seller\'s price', r.status === 403 || r.status === 404, `got ${r.status}`);

r = await call('/api/orders', 'POST', { listingId: listing.id, quantity: 2, price: 1, total: 1 }, Bu.token);
check('the buyer orders', r.status === 201, JSON.stringify(r.body).slice(0, 140));
const order = r.body.order;
check('the client-sent price was IGNORED (total 5000)', order.total === 5000, `total=${order.total}`);
check('the order is not paid', order.paid !== true);

const key = `live-${uniq}`;
const [c1, c2] = await Promise.all([
  call('/api/orders', 'POST', { listingId: listing.id, quantity: 1, idempotencyKey: key }, Bu.token),
  call('/api/orders', 'POST', { listingId: listing.id, quantity: 1, idempotencyKey: key }, Bu.token)
]);
check('concurrent duplicate keys yield ONE order', c1.body?.order?.id === c2.body?.order?.id);

console.log('\n=== FULFILMENT (seller-only) ===');
r = await call(`/api/orders/${order.id}/fulfil`, 'POST', {}, Bu.token);
check('the buyer cannot fulfil (403)', r.status === 403, `got ${r.status}`);
r = await call(`/api/orders/${order.id}/stage`, 'POST', { stage: 'accepted' }, S.token);
check('the seller advances the stage', r.status === 200);
r = await call(`/api/orders/${order.id}/stage`, 'POST', { stage: 'settled' }, S.token);
check('the stage path cannot reach settled', r.status === 400);
r = await call(`/api/orders/${order.id}/fulfil`, 'POST', {}, S.token);
check('the seller fulfils', r.status === 200);
check('fulfilment did NOT mark it paid', r.body?.order?.paid !== true);

console.log('\n=== PAYMENT (no provider: honest refusal) ===');
r = await call(`/api/orders/${order.id}/pay`, 'POST', { phone: '0722000111' }, Bu.token);
check('paying returns 503, not a fake success', r.status === 503, `got ${r.status}`);
check('it states nothing was charged', r.body?.charged === false);
check('it names the missing provider', /no payment provider/i.test(r.body?.reason ?? ''));
check('an intent exists for audit', Boolean(r.body?.intent?.id));
check('the intent amount is server-derived', r.body?.intent?.amount === 5000, `got ${r.body?.intent?.amount}`);
r = await call(`/api/orders/${order.id}/pay`, 'POST', { phone: '0722000111' }, S.token);
check('the seller cannot pay on the buyer\'s behalf', r.status === 400, `got ${r.status}`);

r = await call(`/api/orders/${order.id}/settle`, 'POST', {}, S.token);
check('settlement is refused without real money', r.status === 400, `got ${r.status}`);

console.log('\n=== WEBHOOK SECURITY ===');
r = await call('/api/webhooks/tuma/anything', 'POST', { status: 'completed', checkout_request_id: 'ws_X', result_code: 0 });
check('the payment webhook fails CLOSED (403)', r.status === 403, `got ${r.status}`);
check('and leaks no detail', JSON.stringify(r.body) === '{"error":"rejected"}');

console.log('\n=== LEDGER / SETTLEMENT / PAYOUT ===');
r = await call('/api/economic/reconcile', 'GET', undefined, S.token);
check('settlement reconciliation is balanced', r.body?.reconciliation?.balanced === true);
r = await call('/api/economic/payments/reconcile', 'GET', undefined, S.token);
check('payment reconciliation is balanced', r.body?.reconciliation?.balanced === true);
r = await call('/api/vendors/me/earnings', 'GET', undefined, S.token);
check('earnings are real zeros, not invented money', r.body?.earnings?.net === 0);
check('payout is unavailable', r.body?.earnings?.payoutAvailable === false);
check('and the reason is stated', /provider/i.test(r.body?.earnings?.payoutReason ?? ''));
r = await call('/api/vendors/me/payouts', 'POST', { phone: '0722000111' }, S.token);
check('requesting a payout is refused (503), not queued', r.status === 503 || r.status === 400, `got ${r.status}`);

console.log('\n=== ARENA (server-persisted, no wallet) ===');
r = await call('/api/arena/challenges', 'POST', { gameId: 'efootball', stake: 'friendly' }, S.token);
check('a challenge is created', r.status === 201);
const chal = r.body.challenge;
r = await call('/api/arena/challenges?gameId=efootball');
check('another actor SEES it (real persistence)', r.body.challenges.some((c) => c.id === chal.id));
r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, S.token);
check('you cannot accept your own challenge', r.status === 400);
r = await call(`/api/arena/challenges/${chal.id}/accept`, 'POST', {}, Bu.token);
check('the other player accepts', r.status === 201);
const match = r.body.match;
check('a match exists with no winner', match.winnerPlayerId === null);
r = await call(`/api/arena/matches/${match.id}/report`, 'POST', { winnerPlayerId: S.user.id, scoreLine: '3-1' }, S.token);
check('a result can be reported', r.status === 200);
check('reporting alone does NOT set a winner', r.body.match.winnerPlayerId === null);
r = await call(`/api/arena/matches/${match.id}/confirm`, 'POST', {}, S.token);
check('the reporter cannot self-confirm', r.status === 400);
r = await call(`/api/arena/matches/${match.id}/confirm`, 'POST', {}, Bu.token);
check('the opponent confirms and a winner exists', r.body.match.winnerPlayerId === S.user.id);
r = await call('/api/arena/contests/x/stake', 'POST', { amount: 500 }, S.token);
check('the real-money gate still refuses (403)', r.status === 403);
check('naming unmet requirements', Array.isArray(r.body?.requirements));

console.log('\n=== FANTASY 11 ===');
r = await call('/api/fantasy/rules');
check('scoring rules are published', r.status === 200 && r.body.scoring.assist === 3);
r = await call('/api/fantasy/competitions', 'POST', { title: `Weekend XI ${uniq}`, kickoffAt: new Date(Date.now() + 3600_000).toISOString() }, S.token);
check('a competition is created', r.status === 201);
const comp = r.body.competition;
r = await call(`/api/fantasy/competitions/${comp.id}/players`, 'POST', { name: 'Ringer', position: 'FWD', club: 'Gor' }, Bu.token);
check('a participant cannot add to the player pool (403)', r.status === 403, `got ${r.status}`);
r = await call(`/api/fantasy/competitions/${comp.id}/paid-entry`, 'POST', { amount: 200 }, Bu.token);
check('paid fantasy hits the SAME compliance gate (403)', r.status === 403);
check('with the same machine-readable code', r.body?.code === 'compliance_gate');

console.log('\n=== SIGNALS: one activity layer ===');
r = await call('/api/signals');
const kinds = [...new Set((r.body?.signals ?? []).map((s) => s.type))];
check('commerce signals recorded', kinds.includes('order_placed'));
check('arena signals use the SAME layer', kinds.includes('arena_challenge_opened'));
check('arena results too', kinds.includes('arena_result_confirmed'));
check('NO settled signal, because nothing settled', !kinds.includes('order_settled'));
check('NO paid signal, because nothing was paid', !kinds.includes('order_paid'));

console.log('\n=== OPERATIONS ===');
r = await call('/api/ready');
check('readiness is 200 and checks real state', r.status === 200 && r.body.checks.length >= 3);
r = await call('/api/ops/diagnostics', 'GET', undefined, S.token);
check('diagnostics are available', r.status === 200 && Number.isFinite(r.body?.counts?.users));
r = await call('/api/capabilities');
check('capabilities admit no payment provider', r.body?.payments?.configured === false);
check('capabilities report auth as configured', r.body?.auth?.configured === true);
check('capabilities admit arena money is off', r.body?.arenaMoney?.enabled === false);


console.log('\n=== AUCTION (live, production build) ===');
{
  // A third actor, so winner and loser are genuinely different people.
  const third = (await call('/api/auth/register', 'POST', { handle: `bidder_${uniq}`, password: 'a good passphrase' })).body;

  let a = await call('/api/listings', 'POST', { title: 'Signed jersey', type: 'product', price: 1000, currency: 'KES', quantityAvailable: 1 }, S.token);
  const aucListing = a.body.listing;
  await call(`/api/listings/${aucListing.id}/status`, 'POST', { status: 'active' }, S.token);

  a = await call('/api/auctions', 'POST', { listingId: aucListing.id, startingPrice: 500, reservePrice: 800, endsAt: new Date(Date.now() + 120000).toISOString() }, S.token);
  check('an auction is created over a real listing', a.status === 201, JSON.stringify(a.body).slice(0, 140));
  const auc = a.body.auction;
  await call(`/api/auctions/${auc.id}/open`, 'POST', {}, S.token);

  a = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 600 }, Bu.token);
  check('a bid is accepted', a.status === 201, `got ${a.status}`);
  a = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 400 }, third.token);
  check('an under-bid is refused', a.status === 400);
  a = await call(`/api/auctions/${auc.id}/bids`, 'POST', { amount: 1200 }, third.token);
  check('a higher bid takes the lead', a.status === 201 && a.body.auction.currentPrice === 1200);

  // A bid is not money.
  a = await call('/api/economic/reconcile', 'GET', undefined, S.token);
  check('BIDS CREATED NO LEDGER ACTIVITY', a.body?.reconciliation?.balanced === true);
  a = await call('/api/vendors/me/earnings', 'GET', undefined, S.token);
  check('and no seller earnings', a.body?.earnings?.net === 0);

  // Bidder privacy over the wire.
  a = await call(`/api/auctions/${auc.id}`, 'GET', undefined, Bu.token);
  check('a rival bidder cannot see who else is bidding',
    !JSON.stringify(a.body).includes(third.user.id), JSON.stringify(a.body).slice(0, 160));
  a = await call(`/api/auctions/${auc.id}/bids`, 'GET', undefined, Bu.token);
  check('and cannot read the bid list (403)', a.status === 403);

  a = await call(`/api/auctions/${auc.id}/close`, 'POST', {}, S.token);
  check('the seller closes it and it SOLD (reserve met)', a.body?.sold === true);
  check('the winner is the highest bidder', a.body?.auction?.winnerId === third.user.id);

  a = await call(`/api/auctions/${auc.id}/order`, 'POST', {}, Bu.token);
  check('the LOSER cannot raise the winner order (403)', a.status === 403, `got ${a.status}`);
  a = await call(`/api/auctions/${auc.id}/order`, 'POST', {}, third.token);
  check('the winner raises an ORDINARY order', a.status === 201);
  check('priced at the winning bid, not the listing price', a.body?.order?.total === 1200, String(a.body?.order?.total));
  const aucOrder = a.body.order;

  // It joins the ordinary money chain -- and is refused just as honestly.
  a = await call(`/api/orders/${aucOrder.id}/pay`, 'POST', { phone: '0722000111' }, third.token);
  check('the auction order pays through the ORDINARY route', a.status === 503);
  check('with no fake success', a.body?.charged === false);

  a = await call('/api/signals');
  const k = (a.body?.signals ?? []).map((s) => s.type);
  check('auction signals share the ONE activity layer', k.includes('bid_placed') && k.includes('auction_closed'));
}

console.log(`\n${'='.repeat(52)}\nLIVE PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
