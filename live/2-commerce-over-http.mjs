// PHASE 2 (server running): everything a real browser does, over HTTP,
// through the PRODUCTION BUILD's proxy. No domain-layer shortcuts here.
//
// NOTE ON SEEDING. This script used to require Phase 1 (server stopped,
// rival seller written through the domain layer) because callerId() was a
// constant over HTTP and a second actor was impossible. Real authentication
// removed that limitation: the rival seller is now registered over the wire
// like any other user, so buyer and seller are genuinely different people.
// Phase 1 is kept only for backwards compatibility and is no longer needed.
//
const B = 'http://127.0.0.1:4173/ingest';
let pass=0, fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));} };
let TOKEN = null;
const call = async (p,m='GET',b,token=TOKEN) => {
  const headers = {};
  if (b) headers['content-type']='application/json';
  if (token) headers.authorization = 'Bearer '+token;
  const r = await fetch(B+p,{method:m,headers,body:b?JSON.stringify(b):undefined});
  let j=null; try{ j=await r.json(); }catch{}
  return { status:r.status, body:j };
};
console.log('=== PHASE 2: buyer journey over HTTP, production build ===');

const uniq = Date.now().toString(36);

// The rival seller: a real, separate identity.
let reg = await call('/api/auth/register','POST',{ handle:'rival_'+uniq, password:'a good passphrase', displayName:'Kangemi Grocers' }, null);
check('rival seller registers over HTTP', reg.status===201, JSON.stringify(reg.body).slice(0,120));
const SELLER = reg.body.token;
await call('/api/vendors','POST',{ displayName:'Kangemi Grocers', description:'Fresh produce', contactMethod:'0733 444555' }, SELLER);
let mk = await call('/api/listings','POST',{ title:'Crate of tomatoes', description:'Grade A', type:'product',
  price:2500, currency:'KES', quantityAvailable:null, locationName:'Kangemi' }, SELLER);
check('rival seller lists a crate', mk.status===201, JSON.stringify(mk.body).slice(0,120));
const seed = { listingId: mk.body.listing.id };
await call(`/api/listings/${seed.listingId}/status`,'POST',{ status:'active' }, SELLER);

// The buyer: a different identity again.
reg = await call('/api/auth/register','POST',{ handle:'buyer_'+uniq, password:'a good passphrase', displayName:'Live Buyer' }, null);
check('buyer registers over HTTP', reg.status===201);
TOKEN = reg.body.token;
check('buyer and seller are DIFFERENT identities', TOKEN !== SELLER);

let r = await call('/api/listings');
check('rival listing is discoverable', (r.body?.listings||[]).some(l=>l.id===seed.listingId));
const pub = (r.body?.listings||[]).find(l=>l.id===seed.listingId);
check('public listing leaks no ownerId', pub && !('ownerId' in pub), Object.keys(pub||{}).join(','));

// Money is the server's, always.
r = await call('/api/orders','POST',{ listingId:seed.listingId, quantity:2, price:1, total:1, unitPrice:1 });
check('order created', r.status===201, JSON.stringify(r.body).slice(0,140));
const order = r.body?.order;
check('CLIENT-SENT PRICE IGNORED (total=5000)', order?.total===5000, `total=${order?.total}`);
check('unit price taken from the listing', order?.unitPrice===2500);
check('order is not paid on creation', order?.paid!==true);
check('order starts as ordered', order?.status==='ordered', `status=${order?.status}`);

// Idempotency, concurrently, over the wire.
const key='live-'+Date.now();
const [a,b2] = await Promise.all([
  call('/api/orders','POST',{ listingId:seed.listingId, quantity:1, idempotencyKey:key }),
  call('/api/orders','POST',{ listingId:seed.listingId, quantity:1, idempotencyKey:key })
]);
check('concurrent duplicate key -> ONE order id',
  a.body?.order?.id && a.body.order.id === b2.body?.order?.id, `${a.body?.order?.id} vs ${b2.body?.order?.id}`);
r = await call('/api/orders');
const dupes = (r.body?.orders||[]).filter(o=>o.id===a.body?.order?.id);
check('only one such row persisted', dupes.length===1, `found ${dupes.length}`);

// Overflow + validation.
for (const q of [1e308, Number.MAX_SAFE_INTEGER, 1e6, 0, -1, 2.5]) {
  r = await call('/api/orders','POST',{ listingId:seed.listingId, quantity:q });
  check(`quantity ${q} refused`, r.status===400, `got ${r.status}`);
}
r = await call('/api/orders');
check('every stored total is finite', (r.body?.orders||[]).every(o=>Number.isFinite(o.total)));

// Authorization: buyer is not seller.
r = await call(`/api/orders/${order.id}/stage`,'POST',{ stage:'accepted' });
check('buyer cannot advance fulfilment (403)', r.status===403, `got ${r.status}`);
// ...and the seller genuinely can, so the refusal above is authorization and
// not simply a broken endpoint.
r = await call(`/api/orders/${order.id}/stage`,'POST',{ stage:'accepted' }, SELLER);
check('the SELLER can advance it (200)', r.status===200, `got ${r.status}`);
r = await call(`/api/orders/${order.id}/fulfil`,'POST',{});
check('buyer cannot fulfil (403)', r.status===403, `got ${r.status}`);
r = await call(`/api/orders/${order.id}/settle`,'POST',{});
check('buyer cannot settle (403)', r.status===403, `got ${r.status}`);
r = await call('/api/orders/ord_does_not_exist/fulfil','POST',{});
check('unknown order -> 404', r.status===404, `got ${r.status}`);

// Buyer CAN cancel their own order.
r = await call(`/api/orders/${order.id}/cancel`,'POST',{});
check('buyer can cancel their own order', r.status===200, JSON.stringify(r.body).slice(0,120));
check('cancelled status recorded', r.body?.order?.status==='cancelled');
// Repeating a cancel must be an idempotent NO-OP, not an error and not a
// second cancellation. A double tap is normal on a slow connection.
r = await call(`/api/orders/${order.id}/cancel`,'POST',{});
check('cancelling twice is an idempotent no-op', r.status===200 && r.body?.changed===false, `${r.status} changed=${r.body?.changed}`);
check('still cancelled', r.body?.order?.status==='cancelled');
const cancelSignals = ((await call('/api/signals')).body?.signals||[]).filter(x=>x.type==='order_cancelled' && x.metadata?.orderId===order.id);
check('only ONE cancel signal for the two calls', cancelSignals.length===1, `got ${cancelSignals.length}`);

// Economic reads. Reconciliation is a finance capability: use the
// deployment-bootstrapped operator (BRIEF_OPERATORS=liveop, see live/README).
let opReg = await call('/api/auth/register','POST',{ handle:'liveop', password:'live operator passphrase' }, null);
if (opReg.status !== 201) opReg = await call('/api/auth/login','POST',{ handle:'liveop', password:'live operator passphrase' }, null);
const FIN = opReg.body?.token ?? null;
r = await call('/api/economic/reconcile','GET',undefined,FIN);
check('reconciliation live', r.status===200);
check('ledger balanced', r.body?.reconciliation?.balanced===true, JSON.stringify(r.body).slice(0,180));
r = await call('/api/vendors/me/earnings', 'GET', undefined, SELLER);
check('earnings endpoint live', r.status===200, `got ${r.status}`);
// A buyer has no vendor account, so there are no earnings to read.
const buyerEarn = await call('/api/vendors/me/earnings');
check('a non-vendor has no earnings endpoint (404)', buyerEarn.status===404, `got ${buyerEarn.status}`);
check('no invented money', r.body?.earnings?.net===0, JSON.stringify(r.body?.earnings).slice(0,120));
check('payout unavailable and explained', r.body?.earnings?.payoutAvailable===false && /provider/i.test(r.body?.earnings?.payoutReason||''));

// Compliance.
r = await call('/api/arena/contests/x/stake','POST',{ amount:500 });
check('arena stake refused (403)', r.status===403, `got ${r.status}`);
check('refusal is machine-readable', r.body?.code==='compliance_gate');
r = await call('/api/capabilities');
check('capabilities admit no payment provider', r.body?.payments?.configured===false);
check('capabilities admit arena money off', r.body?.arenaMoney?.enabled===false);

// Signals.
r = await call('/api/signals');
const kinds=(r.body?.signals||[]).map(s=>s.type);
check('order_placed signal recorded', kinds.includes('order_placed'), kinds.join(','));
check('order_cancelled signal recorded', kinds.includes('order_cancelled'), kinds.join(','));
check('NO settled signal, because nothing settled', !kinds.includes('order_settled'));

console.log(`\n${'='.repeat(52)}\nPHASE 2 PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
