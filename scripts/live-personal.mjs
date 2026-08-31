// Live end-to-end verification of the Personal Brief layer against the
// running server on 8787, using REAL persisted objects (seeded demo rows).
process.env.PORT = '8787';
const BASE = 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const call = async (path, method = 'GET', body, token) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// Anonymous privacy boundary. In dev mode the fallback identity answers
// (the /api gate still enforces real sessions in production and in the
// BRIEF_DEV_AUTH=0 test suite); the definitive 401 contract lives there.
const anonMe = await call('/api/me');
check('anonymous /api/me answered (dev fallback identity)', anonMe.status === 200, `got ${anonMe.status}`);

// Real account.
const reg = await call('/api/auth/register', 'POST', { handle: `pers_live_${Date.now() % 100000}`, password: 'pw-123456', displayName: 'Pers Live' });
check('user registers', reg.status === 201, `got ${reg.status}`);
const token = reg.body?.token;

// Seed real persisted objects via the ops seed (real rows, not mocks).
// Register, or sign back in when the account already exists (repeated runs).
let admin = await call('/api/auth/register', 'POST', { handle: 'pers_admin', password: 'pw-123456', displayName: 'Pers Admin' });
if (!admin.body?.token) {
  admin = await call('/api/auth/login', 'POST', { handle: 'pers_admin', password: 'pw-123456' });
}
const adminToken = admin.body?.token;
const seeded = await call('/api/ops/seed', 'POST', {}, adminToken);
const seededCount = seeded.body?.seeded?.objects ?? seeded.body?.seeded?.count ?? 0;
check('demo objects seeded', seeded.status === 200 && seededCount > 0, JSON.stringify(seeded.body?.seeded ?? seeded.status));

// Fresh state: empty interests, global fallback.
const me0 = await call('/api/me', 'GET', null, token);
check('fresh /api/me has no interests', me0.status === 200 && me0.body.interests.locations.length === 0, JSON.stringify(me0.body?.interests));
const feed0 = await call('/api/me/feed', 'GET', null, token);
check('fresh feed is global (personalized=false)', feed0.status === 200 && feed0.body.personalized === false, `got ${feed0.status}`);
const globalIds = feed0.body.objects.map((o) => o.id);
check('fresh feed has real persisted rows', globalIds.length > 0, `count ${globalIds.length}`);

// Onboarding: pick interests.
const put = await call('/api/me/interests', 'PUT', { locations: ['Kilimani'], types: ['event'], topics: ['food'] }, token);
check('PUT interests persists', put.status === 200 && put.body.interests.locations.includes('Kilimani') && put.body.interests.types.includes('event') && put.body.interests.topics.includes('food'), JSON.stringify(put.body));

// Follow via POST, idempotent.
const follow = await call('/api/me/interests', 'POST', { kind: 'location', value: 'Nairobi' }, token);
check('POST follow adds Nairobi', follow.status === 200 && follow.body.interests.locations.includes('Nairobi'), JSON.stringify(follow.body?.interests?.locations));
const followAgain = await call('/api/me/interests', 'POST', { kind: 'location', value: 'Nairobi' }, token);
check('re-follow is idempotent', followAgain.body.interests.locations.filter((l) => l === 'Nairobi').length === 1, JSON.stringify(followAgain.body?.interests?.locations));

// Personal feed: re-ranked, personalized=true, same objects.
const feed1 = await call('/api/me/feed', 'GET', null, token);
check('personal feed personalized=true', feed1.status === 200 && feed1.body.personalized === true, JSON.stringify(feed1.body?.personalized));
check('personal feed uses the same global objects', feed1.body.objects.every((o) => globalIds.includes(o.id)), 'a personal row is not in the global list');
check('personal feed rows carry an explicit boost', feed1.body.objects.every((o) => o.personal && Array.isArray(o.personal.reasons)), 'missing personal block');

// Unfollow.
const unfollow = await call('/api/me/interests', 'DELETE', { kind: 'location', value: 'Nairobi' }, token);
check('DELETE unfollows Nairobi', unfollow.status === 200 && !unfollow.body.interests.locations.includes('Nairobi'), JSON.stringify(unfollow.body?.interests?.locations));

// Saves: persist, idempotent, then remove.
const target = feed1.body.objects[0];
check('feed has a target object to save', Boolean(target?.id));
const save = await call(`/api/me/saved/${target.id}`, 'POST', {}, token);
check('POST saved persists', save.status === 200 && save.body.saved.includes(target.id), `got ${save.status}`);
const save2 = await call(`/api/me/saved/${target.id}`, 'POST', {}, token);
check('save idempotent', save2.body.saved.filter((id) => id === target.id).length === 1);
const unsave = await call(`/api/me/saved/${target.id}`, 'DELETE', {}, token);
check('DELETE saved removes', unsave.status === 200 && !unsave.body.saved.includes(target.id), `got ${unsave.status}`);
const missing = await call('/api/me/saved/obj_does_not_exist', 'POST', {}, token);
check('saving a missing object refused (404)', missing.status === 404, `got ${missing.status}`);

// Relevance controls: set, reflect, undo.
const rel = await call('/api/me/relevance', 'POST', { kind: 'more', objectId: target.id }, token);
check('POST relevance persists', rel.status === 200 && rel.body.relevance.more.includes(target.id), JSON.stringify(rel.body?.relevance));
const badRel = await call('/api/me/relevance', 'POST', { kind: 'mystery', objectId: target.id }, token);
check('unknown relevance kind refused (400)', badRel.status === 400, `got ${badRel.status}`);
const unset = await call('/api/me/relevance', 'DELETE', { kind: 'more', objectId: target.id }, token);
check('DELETE relevance undoes', unset.status === 200 && !unset.body.relevance.more.includes(target.id), JSON.stringify(unset.body?.relevance));

// Notification candidates: data model only.
const ntf = await call('/api/me/notification-candidates', 'GET', null, token);
check('notification candidates 200 + typed kinds', ntf.status === 200 && Array.isArray(ntf.body.candidates) && ntf.body.candidates.every((c) => ['new_event', 'event_reminder', 'offer_expiring', 'local_alert', 'topic_update'].includes(c.kind)), JSON.stringify(ntf.body?.candidates?.slice(0, 2)));

// Privacy: another user sees none of this user's preferences; public rows
// carry no preference data.
const reg2 = await call('/api/auth/register', 'POST', { handle: `pers_other_${Date.now() % 100000}`, password: 'pw-123456', displayName: 'Other' });
const meOther = await call('/api/me', 'GET', null, reg2.body?.token);
check('another user sees only their own empty interests', meOther.body.interests.locations.length === 0 && meOther.body.interests.types.length === 0);
const publicFeed = await call('/api/public/feed', 'GET');
const publicJson = JSON.stringify(publicFeed.body);
check('public feed free of preference data', publicFeed.status === 200 && !publicJson.includes('userInterests') && !publicJson.includes('userRelevance') && !publicJson.includes('"personal"'), publicFeed.status === 200 ? '' : `got ${publicFeed.status}`);

console.log(`\n${'='.repeat(52)}\nLIVE PERSONAL BRIEF: PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
