// PHASE 9 (server running): paying Brief through Pochi la Biashara, over
// HTTP through the production build's proxy. Pochi has no developer API —
// the flow is manual at the seams and honest at every state:
//   the price is the server catalog, the member submits the M-PESA code,
//   the fee is PENDING until finance confirms it, and one code is one
//   payment ever.
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
console.log('=== PHASE 9: Pochi la Biashara service fees, over HTTP ===');
const uniq = Date.now().toString(36);

// 1. The gate.
let r = await call('/api/fees/mine','GET',undefined,null);
check('anonymous GET /api/fees/mine is 401', r.status===401, r.status);

// 2. A member sees the terms: catalog price, Pochi honestly absent.
const reg = async (handle) => (await call('/api/auth/register','POST',{ handle, password:'a good passphrase' },null)).body;
// The confirmer is registered FIRST so the revenue check can read a
// baseline: live phases rerun against a persistent store, and yesterday's
// confirmed fees must still be counted — a delta, not an absolute.
let fin = await reg('livefin9');
if (!fin?.token) fin = (await call('/api/auth/login','POST',{ handle:'livefin9', password:'a good passphrase' },null)).body;
const BASELINE = (await call('/api/fees/all','GET',undefined, fin.token)).body?.confirmedRevenueKes ?? 0;
const MEMBER = await reg('feemember_'+uniq);
TOKEN = MEMBER.token;
r = await call('/api/fees/mine');
check('mine returns catalog and rows', r.status===200 && Array.isArray(r.body?.services) && Array.isArray(r.body?.fees));
check('the Pochi number is honestly null when not configured', r.body?.pochi===null, JSON.stringify(r.body?.pochi));
const svc = (r.body?.services??[]).find((x)=>x.key==='store_monthly');
check('the catalog carries the server-side price', !!svc && svc.amountKes>0, JSON.stringify(r.body?.services));

// 3. The amount cannot come from the client.
r = await call('/api/fees/pay','POST',{ service:'gold_tier', mpesaCode:'Q'+uniq.toUpperCase() });
check('an unknown service is refused (400)', r.status===400, r.status);
const CODE = ('QJD'+uniq.toUpperCase()+'X').slice(0,10);
r = await call('/api/fees/pay','POST',{ service:'store_monthly', mpesaCode:CODE, amountKes:1 });
check('a payment records PENDING', r.status===201 && r.body?.fee?.status==='pending', JSON.stringify(r.body).slice(0,140));
check('the amount is the CATALOG amount, not the posted one', r.body?.fee?.amountKes===svc.amountKes, JSON.stringify(r.body?.fee?.amountKes));
const FEE = r.body.fee.id;
r = await call('/api/fees/pay','POST',{ service:'store_monthly', mpesaCode:CODE });
check('the same M-PESA code cannot be recorded twice (409)', r.status===409, r.status);

// 4. Only finance confirms a code.
r = await call(`/api/fees/${FEE}/respond`,'POST',{ accept:true }, MEMBER.token);
check('a member cannot confirm their own code (403 finance)', r.status===403 && r.body?.requiredCapability==='finance', JSON.stringify(r.body).slice(0,120));
r = await call(`/api/fees/${FEE}/respond`,'POST',{ accept:true }, fin.token);
check('finance confirms the code', r.status===200 && r.body?.fee?.status==='confirmed', JSON.stringify(r.body?.fee).slice(0,140));

// 5. The member is told.
r = await call('/api/notifications');
check('the member was notified of the confirmation', (r.body?.notifications??[]).some((n)=>/confirmed/i.test(n.title??'')), JSON.stringify(r.body).slice(0,140));

// 6. Refusal keeps the reason; a refused code stays locked.
r = await call('/api/fees/pay','POST',{ service:'promotion_weekly', mpesaCode:'SBK'+uniq.toUpperCase() });
const SECOND = r.body.fee.id;
r = await call(`/api/fees/${SECOND}/respond`,'POST',{ accept:false }, fin.token);
check('refusing without a reason is refused (400)', r.status===400, r.status);
r = await call(`/api/fees/${SECOND}/respond`,'POST',{ accept:false, note:'code not found in the M-PESA statement' }, fin.token);
check('finance refuses with a reason that stays on the row', r.status===200 && /statement/.test(r.body?.fee?.refusedReason??''), JSON.stringify(r.body?.fee).slice(0,160));
r = await call('/api/fees/pay','POST',{ service:'store_monthly', mpesaCode:'SBK'+uniq.toUpperCase() });
check('a refused code stays locked (409)', r.status===409, r.status);

// 7. Revenue is derived from rows, finance-only.
r = await call('/api/fees/all','GET',undefined, MEMBER.token);
check('the finance ledger is finance-only (403)', r.status===403, r.status);
r = await call('/api/fees/all','GET',undefined, fin.token);
check('confirmed revenue grows by exactly this run\'s confirmed fee', r.body?.confirmedRevenueKes===BASELINE+svc.amountKes, `baseline ${BASELINE} + ${svc.amountKes} vs ${r.body?.confirmedRevenueKes}`);

console.log(`\nPHASE 9 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
