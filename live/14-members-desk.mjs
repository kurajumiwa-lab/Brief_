// PHASE 14 (server running): the members desk over HTTP — the admin
// directory for onboarding real people, the derived rung, the honest funnel,
// immediate audited suspension, and reinstatement.
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
console.log('=== PHASE 14: the members desk, over HTTP ===');
const uniq = Date.now().toString(36);

// The deployment admin (BRIEF_OPERATORS=liveop; roles are env-bootstrapped).
let admin = await call('/api/auth/register','POST',{ handle:'liveop', password:'live operator passphrase' },null);
if (admin.status!==201) admin = await call('/api/auth/login','POST',{ handle:'liveop', password:'live operator passphrase' });
const adminToken = admin.body?.token;

const newcomer = (await call('/api/auth/register','POST',{ handle:'new_'+uniq, password:'a good passphrase', displayName:'New Person' },null)).body;

// Gates.
let r = await call('/api/ops/members');
check('the directory is members-only (401)', r.status===401, r.status);
r = await call('/api/ops/members','GET',undefined, newcomer.token);
check('the directory is admin-only (403)', r.status===403, r.status);

// The directory finds the newcomer with their honest rung.
r = await call('/api/ops/members?q='+encodeURIComponent('new_'+uniq),'GET',undefined, adminToken);
check('search finds the new member by name', r.body?.total===1, JSON.stringify(r.body?.total));
const row = r.body?.rows?.[0];
check('a brand-new member has climbed exactly the identity rung', row?.onboarding?.rung==='identity' && row?.onboarding?.latestEvent==='signed_in', JSON.stringify(row?.onboarding));

// The funnel counts real events only.
r = await call('/api/ops/onboarding','GET',undefined, adminToken);
check('the funnel is live over HTTP', r.status===200 && (r.body?.funnel?.signed_in ?? 0)>=1, JSON.stringify(r.body?.funnel));
check('the totals are scans', r.body?.totals?.members>=2, JSON.stringify(r.body?.totals));

// Suspension is immediate, audited, and needs a reason.
r = await call(`/api/ops/members/${newcomer.user.id}/status`,'POST',{ status:'suspended', reason:'x' }, adminToken);
check('a thin reason is refused', r.status===400 && /say why/.test(r.body?.error ?? ''));
r = await call(`/api/ops/members/${newcomer.user.id}/status`,'POST',{ status:'suspended', reason:'onboarding test run — release testing' }, adminToken);
check('suspension takes with sessions revoked now', r.status===200 && r.body?.changed===true && r.body?.sessionsRevoked>=1, JSON.stringify(r.body).slice(0,120));
r = await call('/api/auth/me','GET',undefined, newcomer.token);
check('the suspended member is locked out on the next request', r.status===401, r.status);

// Reinstate — this is a test actor, leave the world as we found it.
r = await call(`/api/ops/members/${newcomer.user.id}/status`,'POST',{ status:'active' }, adminToken);
check('reinstate works', r.status===200 && r.body?.user?.status==='active', JSON.stringify(r.body?.user?.status));
r = await call('/api/auth/login','POST',{ handle:'new_'+uniq, password:'a good passphrase' });
check('the reinstated member signs in again', r.status===200, r.status);

console.log(`\nPHASE 14 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
