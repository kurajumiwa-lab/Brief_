// PHASE 3: public distribution. An outsider with only a link must be able to
// use it, and must NOT be able to see privileged backend information.
const B='http://127.0.0.1:4173/ingest';
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};
const call=async(p,m='GET',b,token=TOKEN)=>{const h={};if(b)h['content-type']='application/json';if(token)h.authorization='Bearer '+token;const r=await fetch(B+p,{method:m,headers:h,body:b?JSON.stringify(b):undefined});let j=null;try{j=await r.json();}catch{}return{status:r.status,body:j};};

console.log('=== PHASE 3: public campaign -> open -> participate -> signal ===');

// The organiser is a REAL identity. This script runs against the PRODUCTION
// build, where the development fallback is off, and capture and campaign
// creation are authoring acts that refuse an anonymous caller. The previous
// version of this script posted as nobody, so it could only ever pass against
// a dev server. Everything a STRANGER does below still carries no token.
let TOKEN = null;
const organiser = await call('/api/auth/register','POST',{ handle:'org_'+Date.now().toString(36), password:'a good passphrase', displayName:'Kilimani Organiser' }, null);
check('the organiser registers over HTTP', organiser.status===201, JSON.stringify(organiser.body).slice(0,140));
TOKEN = organiser.body.token;

// An organiser captures something real, then distributes it.
const uniq = Date.now();
let r = await call('/api/brief-it/save','POST',{ text:`Kilimani Night Market ${uniq} this Saturday 6pm at Yaya Centre rooftop. Entry 200 bob. Food, thrift and live sets.` });
check('object captured from plain text', r.status===200||r.status===201, JSON.stringify(r.body).slice(0,160));
check('capture was not a duplicate', r.body?.duplicate===false, JSON.stringify(r.body).slice(0,140));
const objectId = r.body?.result?.objectId;
check('an object id exists', Boolean(objectId), JSON.stringify(r.body).slice(0,200));

// Re-capturing the SAME text must dedupe rather than create a twin object.
const again = await call('/api/brief-it/save','POST',{ text:`Kilimani Night Market ${uniq} this Saturday 6pm at Yaya Centre rooftop. Entry 200 bob. Food, thrift and live sets.` });
check('re-capturing identical text is deduped', again.body?.duplicate===true, JSON.stringify(again.body).slice(0,140));

r = await call('/api/campaigns','POST',{ objectId, title:'Kilimani Night Market', audience:'public' });
check('campaign created', r.status===201, JSON.stringify(r.body).slice(0,200));
const camp = r.body?.campaign;
// A campaign starts as DRAFT and is not publicly reachable until published.
check('campaign starts as draft', camp?.status==='draft', `status=${camp?.status}`);
const slug = camp?.publicSlug;
check('campaign has a public slug', Boolean(slug), JSON.stringify(camp).slice(0,200));

r = await call(`/api/public/campaigns/${slug}`, 'GET', undefined, null);
check('an UNPUBLISHED campaign does not resolve publicly', r.status===404, `got ${r.status}`);

r = await call(`/api/campaigns/${camp.id}/publish`,'POST',{});
check('organiser publishes it', r.status===200, JSON.stringify(r.body).slice(0,140));

// THE PUBLIC VIEW. This is what a stranger receives -- and they carry NO
// token, because that is the whole point of a shared link.
r = await call(`/api/public/campaigns/${slug}`, 'GET', undefined, null);
check('public link resolves without auth', r.status===200, `got ${r.status}`);
const pubv = r.body?.campaign ?? r.body;
const raw = JSON.stringify(pubv);
check('public view shows the title', /Kilimani Night Market/.test(raw));
check('NO ownerId leaked', !/ownerId/.test(raw), raw.slice(0,200));
check('NO registrant roster leaked', !/registrations|attendees|roster/i.test(raw), raw.slice(0,200));
check('NO internal source ids leaked', !/sourceId|sourceMemberships/.test(raw));
check('NO raw item / pipeline internals leaked', !/rawItem|capturedBy/.test(raw));

// A stranger participates.
r = await call(`/api/public/campaigns/${slug}/register`,'POST',{ attendeeRef:'0711222333', name:'Achieng' }, null);
check('a stranger can register', r.status===200||r.status===201, JSON.stringify(r.body).slice(0,160));
const reg = JSON.stringify(r.body);
check('registration does not echo the roster back', !/registrations\[|attendees/i.test(reg));

// Invalid and expired handling.
r = await call('/api/public/campaigns/not-a-real-slug', 'GET', undefined, null);
check('unknown slug -> 404, no detail leaked', r.status===404, `got ${r.status}`);
check('404 body leaks nothing', !/ownerId|sourceId/.test(JSON.stringify(r.body)));
r = await call('/api/public/campaigns/not-a-real-slug/register','POST',{ name:'X' }, null);
check('cannot register to an unknown campaign', r.status===404, `got ${r.status}`);
r = await call(`/api/public/campaigns/${slug}/register`,'POST',{}, null);
check('registration validates input', r.status===400, `got ${r.status}`);

// Registering twice with the same contact must not create a duplicate
// attendee -- the roster is a fact, not a counter to inflate.
const before = (await call(`/api/campaigns/${camp.id}/registrations`)).body?.registrations?.length ?? 0;
await call(`/api/public/campaigns/${slug}/register`,'POST',{ attendeeRef:'0711222333', name:'Achieng' }, null);
const after = (await call(`/api/campaigns/${camp.id}/registrations`)).body?.registrations?.length ?? 0;
check('re-registering the same contact does not duplicate', after===before, `${before} -> ${after}`);

// The organiser CAN see the roster; the public cannot.
r = await call(`/api/campaigns/${camp.id}`);
check('organiser sees their own campaign', r.status===200, `got ${r.status}`);
const owned = JSON.stringify(r.body);
check('organiser view includes participation counts', /registration|participant|count/i.test(owned), owned.slice(0,200));

// Signals recorded the real interaction, and only the real one.
r = await call('/api/signals');
const kinds=(r.body?.signals||[]).map(s=>s.type);
check('a campaign interaction signal was recorded', kinds.some(k=>/campaign|register/i.test(k)), [...new Set(kinds)].join(','));
check('no fabricated view/engagement inflation', !kinds.includes('campaign_impression_batch'));

console.log(`\n${'='.repeat(52)}\nPHASE 3 PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
