// PHASE 10 (server running): the referral machine, over HTTP through the
// production proxy. The three structural rules, proven live:
//   depth ONE level · no entry fee · cash only from a revenue-backed pool.
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
console.log('=== PHASE 10: referrals with a mathematical edge, over HTTP ===');
const uniq = Date.now().toString(36);

// 1. The gate.
let r = await call('/api/referrals/mine','GET',undefined,null);
check('anonymous /api/referrals/mine is 401', r.status===401, r.status);

// 2. A brings B; B brings C. Depth stops at one.
const reg = async (handle, ref) => (await call('/api/auth/register','POST',{ handle:handle+'_'+uniq, password:'a good passphrase', ...(ref?{ref}:{}) },null)).body;
const A = await reg('refa');
TOKEN = A.token;
r = await call('/api/referrals/mine');
const ACODE = r.body?.code;
check('the code is derived from the handle', /^REFA/.test(ACODE ?? ''), ACODE);
check('the surface states the one-level cap', r.body?.maxDepth===1);

const Bm = await reg('refb', ACODE);
r = await call('/api/referrals/mine');
check('a real signup credits the direct referrer once', r.body?.balance?.earned===100, JSON.stringify(r.body?.balance));

const BCODE = (await call('/api/referrals/mine','GET',undefined,Bm.token)).body?.code;
const Cm = await reg('refc', BCODE);
r = await call('/api/referrals/mine');
check("B's own referral does NOT credit A — depth stops at one", r.body?.balance?.earned===100, JSON.stringify(r.body?.balance));

// 3. A purchase earns points for the buyer and the referrer, once per order.
const S = await reg('refseller');
await call('/api/vendors','POST',{ displayName:'Live Ref Seller', description:'goods', contactMethod:'0700 000000' }, S.token);
const mk = await call('/api/listings','POST',{ title:'Crate of tomatoes', description:'Grade A', type:'product', price:10000, currency:'KES', locationName:'Wote' }, S.token);
await call(`/api/listings/${mk.body.listing.id}/status`,'POST',{ status:'active' }, S.token);
const o1 = await call('/api/orders','POST',{ listingId: mk.body.listing.id, quantity:1 }, Bm.token);
await call(`/api/orders/${o1.body.order.id}/fulfil`,'POST',{}, S.token);
r = await call('/api/referrals/mine');
check("A earns for B's fulfilled order", r.body?.balance?.earned===600, JSON.stringify(r.body?.balance));
r = await call('/api/referrals/mine','GET',undefined,Bm.token);
check('B earns for their own fulfilled order', r.body?.balance?.earned===600, JSON.stringify(r.body?.balance));

// 4. Event traffic: a share link visit, deduped per visitor per day.
r = await call('/api/referrals/share');
check('the share builder returns a styled WhatsApp message + wa.me link', typeof r.body?.message==='string' && /wa\.me\//.test(r.body?.waMe ?? ''), JSON.stringify(r.body).slice(0,140));
const camp = await call('/api/campaigns','POST',{ title:'Referral Night '+uniq, description:'x', type:'event', startsAt:new Date(Date.now()+86400000).toISOString() }, A.token);
await call(`/api/campaigns/${camp.body.campaign.id}/publish`,'POST',{}, A.token);
const owned = await call(`/api/campaigns/${camp.body.campaign.id}`,'GET',undefined,A.token);
const slug = owned.body?.campaign?.publicSlug;
await call(`/api/public/campaigns/${slug}?via=${ACODE}`,'GET');
await call(`/api/public/campaigns/${slug}?via=${ACODE}`,'GET');
r = await call('/api/referrals/mine');
check('link traffic counts once per visitor per day', r.body?.balance?.earned===601, JSON.stringify(r.body?.balance));
await call(`/api/public/campaigns/${slug}/register`,'POST',{ attendeeRef:'guest-'+uniq, via:ACODE }, null);
r = await call('/api/referrals/mine');
check('an event registration through the link earns once', r.body?.balance?.earned===626, JSON.stringify(r.body?.balance));

// 5. The pool: cash only from real confirmed revenue. Live phases rerun
// against a persistent store, so everything here is a DELTA. (The
// empty-pool refusal is proven in the server suite against a clean store.)
let fin = await call('/api/auth/register','POST',{ handle:'livefin9', password:'a good passphrase' },null);
if (!fin.body?.token) fin = await call('/api/auth/login','POST',{ handle:'livefin9', password:'a good passphrase' },null);
fin = fin.body; // the deployment bootstrap names this exact handle finance-capable
r = await call('/api/referrals/mine');
const POOL0 = r.body?.pool?.availableKes ?? 0;
r = await call('/api/referrals/convert','POST',{ points: 999999 }, A.token);
check('converting beyond your earned points is refused honestly', r.status===400 && /points available/.test(r.body?.error ?? ''), JSON.stringify(r.body).slice(0,120));
const payer = await reg('refpayer');
const payer2 = await reg('refpayer2');
for (const px of [payer, payer2]) {
  const fee = await call('/api/fees/pay','POST',{ service:'store_monthly', mpesaCode:'RF'+Math.random().toString(36).toUpperCase().slice(2,10) }, px.token);
  await call(`/api/fees/${fee.body.fee.id}/respond`,'POST',{ accept:true }, fin.token);
}
r = await call('/api/referrals/mine');
check('confirmed fees grow the pool by their fixed fraction (delta +50)', r.body?.pool?.availableKes === POOL0 + 50, `${POOL0} -> ${r.body?.pool?.availableKes}`);
r = await call('/api/referrals/convert','POST',{ points: 500 }, A.token);
check('a conversion inside the pool goes PENDING for manual payout', r.status===201 && r.body?.conversion?.status==='pending' && r.body?.conversion?.kes===50, JSON.stringify(r.body).slice(0,140));
const conv = r.body?.conversion?.id;
r = await call('/api/referrals/mine');
check('the pending payout draws the pool down by exactly its shillings', r.body?.pool?.availableKes === POOL0, JSON.stringify(r.body?.pool));
r = await call(`/api/referrals/conversions/${conv}/respond`,'POST',{ accept:true }, A.token);
check('a member cannot confirm their own payout (403 finance)', r.status===403, r.status);
r = await call(`/api/referrals/conversions/${conv}/respond`,'POST',{ accept:true }, fin.token);
check('finance confirms the manual M-Pesa payout', r.status===200 && r.body?.conversion?.status==='confirmed', JSON.stringify(r.body?.conversion).slice(0,140));
r = await call('/api/referrals/all','GET',undefined, fin.token);
check('the invariant holds live: paid never exceeds backing', r.body?.pool?.paidOrPromisedKes <= r.body?.pool?.backingKes, JSON.stringify(r.body?.pool));

console.log(`\nPHASE 10 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
