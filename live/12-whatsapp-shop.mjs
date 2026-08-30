// PHASE 12 (server running): the WhatsApp shop, over HTTP through the
// production proxy. Brief builds the shop; WhatsApp IS the shop; the
// output is real WhatsApp formatting + a wa.me link; publishing is gated
// on a CONFIRMED store-service row (Pochi la Biashara, operator-confirmed).
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
console.log('=== PHASE 12: the WhatsApp shop, over HTTP ===');
const uniq = Date.now().toString(36);

// 1. Gate + honest blank.
let r = await call('/api/shop/mine');
check('the shop is members-only (401)', r.status===401, r.status);
const seller = (await call('/api/auth/register','POST',{ handle:'shopkeeper_'+uniq, password:'a good passphrase' },null)).body;
r = await call('/api/shop/mine','GET',undefined,seller.token);
check('a new member starts with a blank draft and an inactive store', r.body?.shop?.id===null && r.body?.store?.active===false && r.body?.store?.priceKes===250, JSON.stringify(r.body?.store));

// 2. Validation refuses, with reasons.
r = await call('/api/shop/mine','PUT',{ name:'M', orderNumber:'+254712345678', items:[{name:'Sukuma',priceKes:50}] }, seller.token);
check('a too-short name is refused', r.status===400 && /name/.test(r.body?.error??''), JSON.stringify(r.body).slice(0,80));
r = await call('/api/shop/mine','PUT',{ name:'Mama Njeria Fresh', orderNumber:'not-a-phone', items:[{name:'Sukuma',priceKes:50}] }, seller.token);
check('an unreachable order number is refused', r.status===400 && /phone/.test(r.body?.error??''));

// 3. Save + the exact WhatsApp output.
r = await call('/api/shop/mine','PUT',{
  name:'Mama Njeria Fresh', tagline:'Fresh groceries, Kilimani', orderNumber:'+254 712 345 678',
  items:[
    { name:'Sukuma Wiki', priceKes:50 },
    { name:'Tomatoes (kg)', priceKes:120, note:'organic' },
    { name:'Free-range eggs (tray)', priceKes:450 }
  ]
}, seller.token);
check('the draft saves over HTTP', r.status===201 && r.body?.shop?.status==='draft', JSON.stringify(r.body?.shop).slice(0,100));
const text = r.body?.share?.text ?? '';
check('the text uses WhatsApp\'s real formatting', text.includes('*Mama Njeria Fresh*') && text.includes('_Fresh groceries, Kilimani_') && text.includes('Sukuma Wiki — *KES 50*'), JSON.stringify(text.slice(0,80)));
const waMe = r.body?.share?.waMe ?? '';
check('the wa.me link is the order number + the encoded catalog', waMe.startsWith('https://wa.me/254712345678?text=') && decodeURIComponent(waMe.split('text=')[1]??'')===text, waMe.slice(0,60));
check('a draft is honestly not shareable', r.body?.share?.shareable===false);

// 4. The publish gate, end to end, through the real Pochi flow.
r = await call('/api/shop/mine/publish','POST',{}, seller.token);
check('publishing without the service is refused (409)', r.status===409, r.status);
check('the refusal is machine-readable about what is needed', r.body?.requiresService==='store_monthly' && /KES 250/.test(r.body?.error??''), JSON.stringify(r.body).slice(0,120));
const code = 'WS'+Math.random().toString(36).toUpperCase().slice(2,10);
const fee = (await call('/api/fees/pay','POST',{ service:'store_monthly', mpesaCode:code }, seller.token)).body.fee;
r = await call('/api/shop/mine/publish','POST',{}, seller.token);
check('a PENDING Pochi code does not open the gate', r.status===409, r.status);
// finance confirms: the deployment operator (BRIEF_FINANCE=liveop, see live/README).
let op = await call('/api/auth/register','POST',{ handle:'liveop', password:'live operator passphrase' },null);
if (op.status!==201) op = await call('/api/auth/login','POST',{ handle:'liveop', password:'live operator passphrase' },null);
r = await call(`/api/fees/${fee.id}/respond`,'POST',{ accept:true }, op.body?.token);
check('finance confirms the M-Pesa code', r.status===200 && r.body?.fee?.status==='confirmed', JSON.stringify(r.body?.fee?.status));
r = await call('/api/shop/mine/publish','POST',{}, seller.token);
check('publishing works after confirmation', r.status===200 && r.body?.shop?.status==='published' && r.body?.share?.shareable===true, JSON.stringify(r.body?.shop?.status));
check('the store service is derived active with an end date', r.body?.store?.active===true && Boolean(r.body?.store?.activeUntil));
r = await call('/api/shop/mine/publish','POST',{}, seller.token);
check('publishing twice is an idempotent no-op', r.status===200 && r.body?.changed===false);

// 5. Edit in place, then the honest off-switch.
r = await call('/api/shop/mine','PUT',{ name:'Mama Njeria Fresh', tagline:'Fresh groceries, Kilimani', orderNumber:'+254 712 345 678', items:[{ name:'Sukuma Wiki', priceKes:60 }] }, seller.token);
check('saving again edits the same shop', r.status===201 && r.body?.share?.text?.includes('*KES 60*'));
r = await call('/api/shop/mine/unpublish','POST',{}, seller.token);
check('unpublishing returns to draft', r.status===200 && r.body?.shop?.status==='draft' && r.body?.share?.shareable===false);

console.log(`\nPHASE 12 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
