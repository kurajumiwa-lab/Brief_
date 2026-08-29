// PHASE 8 (server running): MSHIKANO — the cooperation network, over HTTP
// through the production build's proxy, like every other gated-world phase.
// Anchors under test, from the product brief:
//   - four intents: have / need / can_help / looking_for
//   - the unit is the RELATIONSHIP, not the profile: a cooperation only
//     counts when BOTH sides confirm it
//   - trust is earned from confirmed cooperation evidence, never stars
//   - "Who can help?" answers honestly — no invented people, groups stay
//     empty until real groups exist
//   - nothing here is reachable without an account
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
console.log('=== PHASE 8: Mshikano cooperation network, over HTTP ===');
const uniq = Date.now().toString(36);

// 1. The gate comes first — no account, no cooperation network.
for (const p of ['/api/mshikano/posts','/api/mshikano/graph','/api/mshikano/who-can-help?q= mango']) {
  const r = await call(p,'GET',undefined,null);
  check(`anonymous GET ${p.split('?')[0]} is 401`, r.status===401, r.status);
}

// 2. Two members. Anne has mangoes in Makueni; Brian needs them in Nairobi.
const reg = async (handle,name,county,town) => {
  const r = await call('/api/auth/register','POST',{ handle:handle+'_'+uniq, password:'a good passphrase', displayName:name, county, town }, null);
  return r.body.token;
};
const ANNE = await reg('anne','Anne Mango','Makueni','Wote');
const BRIAN = await reg('brian','Brian Gikomba','Nairobi','Gikomba');
check('anne and brian are different identities', ANNE !== BRIAN);

// 3. Intent validation — the four intents are the whole grammar.
let r = await call('/api/mshikano/posts','POST',{ intent:'swap', title:'no such intent' }, ANNE);
check('unknown intent is rejected', r.status===400, r.status);
r = await call('/api/mshikano/posts','POST',{ intent:'have', title:'' }, ANNE);
check('empty post is rejected', r.status===400, r.status);

// 4. Complement matching — HAVE finds NEED, with reasons a human can read.
r = await call('/api/mshikano/posts','POST',{ intent:'have', title:'1 tonne of mangoes ready this week in Wote' }, ANNE);
check('anne posts HAVE mangoes', r.status===201 && r.body.post?.intent==='have', JSON.stringify(r.body).slice(0,120));
const HAVE = r.body.post;
r = await call('/api/mshikano/posts','POST',{ intent:'need', title:'need 800 kg of mangoes for my Gikomba stall' }, BRIAN);
check('brian posts NEED mangoes', r.status===201 && r.body.post?.intent==='need');
const NEED = r.body.post;
r = await call(`/api/mshikano/posts/${HAVE.id}/matches`,'GET',undefined,BRIAN);
const m = (r.body?.matches||[]).find(x=>x.post?.id===NEED.id);
check('HAVE finds its NEED complement', !!m, JSON.stringify(r.body).slice(0,160));
check('the match explains itself with reasons', !!m && Array.isArray(m.reasons) && m.reasons.some(x=>/mango/i.test(x)), JSON.stringify(m?.reasons));
r = await call(`/api/mshikano/posts/${HAVE.id}/matches`,'GET',undefined,ANNE);
check('matches are mutual — anne sees brian too', (r.body?.matches||[]).some(x=>x.post?.id===NEED.id));

// 5. Who can help? — honest answers only.
r = await call('/api/mshikano/who-can-help?q=mangoes','GET',undefined,BRIAN);
check('who can help finds a person with mangoes', (r.body?.people||[]).length>0, JSON.stringify(r.body).slice(0,200));
r = await call('/api/mshikano/who-can-help?q=kyozo+phone+repairs+overnight','GET',undefined,BRIAN);
check('a question nothing matches keeps groups honestly empty', r.body?.counts?.groups===0 && Array.isArray(r.body?.groups) && r.body.groups.length===0, JSON.stringify(r.body?.counts));

// 5b. A REAL circle answers as a group, with its real member count.
r = await call('/api/circles','POST',{ name:'Mango Traders '+uniq, description:'members who help each other move mangoes from Makueni to Nairobi' }, BRIAN);
check('brian starts a real circle', r.status===201, JSON.stringify(r.body).slice(0,140));
r = await call('/api/mshikano/who-can-help?q=mangoes','GET',undefined,BRIAN);
const grp = (r.body?.groups||[]).find((g)=>/Mango Traders/.test(g.name));
check('the circle answers who can help', !!grp, JSON.stringify(r.body?.groups).slice(0,200));
check('the group carries its real member count (the founder)', grp?.members===1, JSON.stringify(grp));

// 6. The relationship unit: propose → only the named partner confirms.
r = await call('/api/mshikano/cooperations','POST',{ postId:NEED.id, partnerUserId:NEED.author.id, summary:'800 kg of anne\'s mangoes to Gikomba' }, ANNE);
check('anne proposes a cooperation', r.status===201 && r.body.cooperation?.status==='pending', JSON.stringify(r.body).slice(0,140));
const COOP = r.body.cooperation;
const OUTSIDER = await reg('outsider','Mystery Third Party','Kisumu','Kisumu');
r = await call(`/api/mshikano/cooperations/${COOP.id}/respond`,'POST',{ accept:true },OUTSIDER);
check('an outsider cannot respond to someone else\'s cooperation', r.status===403, r.status);
r = await call(`/api/mshikano/cooperations/${COOP.id}/respond`,'POST',{ accept:true },ANNE);
check('the proposer cannot self-confirm either', r.status===403, r.status);
r = await call(`/api/mshikano/cooperations/${COOP.id}/respond`,'POST',{ accept:true },BRIAN);
check('brian (the named partner) confirms', r.status===200 && r.body.cooperation?.status==='confirmed', JSON.stringify(r.body).slice(0,140));

// 7. Trust is evidence, not stars.
r = await call(`/api/mshikano/trust/${HAVE.author.id}`,'GET',undefined,BRIAN);
check('anne has confirmed-cooperation evidence', r.body?.evidence?.confirmedCooperations>=1, JSON.stringify(r.body).slice(0,200));
check('trust level moved past "new"', r.body?.level==='cooperating', r.body?.level);
check('the level explains itself in words', typeof r.body?.levelWords==='string' && r.body.levelWords.length>0, r.body?.levelWords);
check('no star ratings anywhere', !JSON.stringify(r.body).includes('star'));

// 8. The graph counts confirmed relationships only.
r = await call('/api/mshikano/graph','GET',undefined,ANNE);
check('anne\'s graph totals one confirmed cooperation', r.body?.totals?.confirmed===1, JSON.stringify(r.body).slice(0,200));
check('the graph names the partner she helped', (r.body?.helped||[]).length===1 && r.body.helped[0]?.with?.id===NEED.author.id);

// 9. Recommendations follow cooperation, carried on the cooperation itself.
r = await call(`/api/mshikano/cooperations/${COOP.id}/recommend`,'POST',{ note:'delivered on time, fair price' }, BRIAN);
check('brian can recommend anne after cooperating', r.status===200 && (r.body.cooperation?.recommendations||[]).length===1, JSON.stringify(r.body).slice(0,200));
r = await call(`/api/mshikano/cooperations/${COOP.id}/recommend`,'POST',{ note:'again' }, BRIAN);
check('but only once per side', r.status===400, r.status);

// 10. A dispute withdraws the credit and keeps the record.
r = await call(`/api/mshikano/cooperations/${COOP.id}/dispute`,'POST',{ reason:'never delivered the second batch' },OUTSIDER);
check('an outsider cannot dispute (403)', r.status===403, r.status);
r = await call(`/api/mshikano/cooperations/${COOP.id}/dispute`,'POST',{ reason:'x' },ANNE);
check('a dispute needs a real reason (400)', r.status===400, r.status);
r = await call(`/api/mshikano/cooperations/${COOP.id}/dispute`,'POST',{ reason:'never delivered the second batch' },ANNE);
check('a partner disputes the cooperation', r.status===200 && r.body?.cooperation?.status==='disputed' && /second batch/.test(r.body?.cooperation?.dispute?.note ?? ''), JSON.stringify(r.body?.cooperation?.dispute));
r = await call('/api/mshikano/cooperations','GET',undefined,ANNE);
check('a disputed cooperation stays listed for the partners', (r.body?.disputed||[]).some((d)=>d.id===COOP.id), JSON.stringify((r.body?.disputed||[]).map((d)=>d.id)));
r = await call('/api/mshikano/graph','GET',undefined,ANNE);
check('the disputed link leaves the confirmed graph', r.body?.totals?.confirmed===0, JSON.stringify(r.body?.totals));
r = await call(`/api/mshikano/trust/${HAVE.author.id}`,'GET',undefined,BRIAN);
check('the dispute is counted as evidence', r.body?.evidence?.disputes>=1, JSON.stringify(r.body?.evidence));

console.log(`\nPHASE 8 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
