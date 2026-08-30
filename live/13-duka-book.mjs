// PHASE 13 (server running): the SME layer over HTTP — the Duka book
// (logged sales, derived totals, idempotent offline writes), pooled
// restocks on the Group Buy engine, and the escrow records read layer.
const B = 'http://127.0.0.1:4173/ingest';
let pass=0, fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));} };
const call = async (p,m='GET',b,token) => {
  const headers = {};
  if (b) headers['content-type']='application/json';
  if (token) headers.authorization = 'Bearer '+token;
  const r = await fetch(B+p,{method:m,headers,body:b?JSON.stringify(b):undefined});
  let j=null; try{ j=await r.json(); }catch{}
  return { status:r.status, body:j };
};
console.log('=== PHASE 13: the Duka book, pools and escrow records, over HTTP ===');
const uniq = Date.now().toString(36);

let r = await call('/api/shop/mine/book');
check('the book is members-only (401)', r.status===401, r.status);
const duka = (await call('/api/auth/register','POST',{ handle:'duka_'+uniq, password:'a good passphrase' },null)).body;

// Shop with stock, then sales.
r = await call('/api/shop/mine','PUT',{
  name:'Kilimani Duka', tagline:'Everyday things', orderNumber:'+254700111222',
  items:[ { name:'Cooking oil (L)', priceKes:350, stockQty:6 }, { name:'Unga 2kg', priceKes:210, stockQty:20 } ]
}, duka.token);
check('the shop carries stock counts', r.status===201 && r.body?.shop?.items?.[0]?.stockQty===6, JSON.stringify(r.body?.shop?.items?.[0]));

r = await call('/api/shop/mine/sales','POST',{ name:'Cooking oil (L)', qty:5, unitKes:350, clientKey:'live-'+uniq }, duka.token);
check('a sale logs over HTTP', r.status===201 && r.body?.sale?.amountKes===1750, r.status+' '+JSON.stringify(r.body?.sale));
r = await call('/api/shop/mine/sales','POST',{ name:'Cooking oil (L)', qty:5, unitKes:350, clientKey:'live-'+uniq }, duka.token);
check('the offline replay is a no-op through the proxy too', r.status===200 && r.body?.replayed===true);

r = await call('/api/shop/mine/book','GET',undefined, duka.token);
check('today is derived from the logged rows', r.body?.today?.kes===1750, JSON.stringify(r.body?.today));
check('low stock is derived', r.body?.lowStock?.some((i)=>i.name==='Cooking oil (L)' && i.remaining===1), JSON.stringify(r.body?.lowStock));
check('the book states its honesty about WhatsApp', /yours to record/.test(r.body?.note ?? ''));

// A pooled restock on the real engine.
r = await call('/api/shop/mine/pool','POST',{ itemName:'Unga 2kg', unitCostKes:180, goalUnits:5, myUnits:2 }, duka.token);
check('a pool opens as a Group Buy', r.status===201 && r.body?.pool?.targetAmount===900 && r.body?.pool?.total===360, JSON.stringify(r.body?.pool).slice(0,120));
check('the pool call is forwardable WhatsApp', (r.body?.share?.text ?? '').includes('*RESTOCK POOL*') && (r.body?.share?.waMe ?? '').startsWith('https://wa.me/254700111222?text='));
const poolId = r.body.pool.id;
const neighbour = (await call('/api/auth/register','POST',{ handle:'duka2_'+uniq, password:'a good passphrase' },null)).body;
r = await call(`/api/engine/group-buys/${poolId}/contribute`,'POST',{ memberRef:'Neighbour duka', amount:540 }, neighbour.token);
check('a neighbour pools in and the engine reaches the target itself', r.body?.stageChanged===true && r.body?.total===900, JSON.stringify(r.body).slice(0,100));

// Escrow records across patterns.
r = await call('/api/escrows/mine','GET',undefined, duka.token);
check('at target the pool is not yet HELD', r.body?.rows?.find((x)=>x.refId===poolId)?.state==='pending', JSON.stringify(r.body?.rows));
await call(`/api/engine/group-buys/${poolId}/stage`,'POST',{ to:'escrow' }, duka.token);
r = await call('/api/escrows/mine','GET',undefined, duka.token);
check('escrow lock is visible as a record', r.body?.rows?.find((x)=>x.refId===poolId)?.state==='locked' && r.body?.totals?.heldKes===900, JSON.stringify(r.body?.totals));
await call(`/api/engine/group-buys/${poolId}/stage`,'POST',{ to:'dispatched' }, duka.token);
await call(`/api/engine/group-buys/${poolId}/stage`,'POST',{ to:'delivered' }, duka.token);
r = await call('/api/escrows/mine','GET',undefined, duka.token);
check('delivery releases the record', r.body?.rows?.find((x)=>x.refId===poolId)?.state==='released' && r.body?.totals?.heldKes===0, JSON.stringify(r.body?.totals));

console.log(`\nPHASE 13 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
