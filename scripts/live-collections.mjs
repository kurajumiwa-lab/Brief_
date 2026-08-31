// Live end-to-end verification of the personal Collections layer against the
// running server on 8787, using REAL persisted objects (seeded demo rows) and
// the real HTTP routes. The loop under test is the product loop:
//   discover -> save -> organize -> revisit -> act
// plus the honesty + privacy contracts: refs only (objects never duplicated or
// deleted), private by default, public pages project public items only,
// owner-only modification, and a stable share URL.
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

// ---- Real account ----------------------------------------------------------
const handle = `coll_live_${Date.now() % 100000}`;
let user = await call('/api/auth/register', 'POST', { handle, password: 'pw-123456', displayName: 'Coll Live' });
if (!user.body?.token) {
  user = await call('/api/auth/login', 'POST', { handle, password: 'pw-123456' });
}
const token = user.body?.token;
check('user registers / logs in', Boolean(token), `got ${user.status}`);

// ---- Seed real persisted demo rows (idempotent) ----------------------------
// The seed endpoint needs the admin capability: run the server with
// BRIEF_ADMINS=coll_admin (bootstrap handles), or any stored admin role.
let admin = await call('/api/auth/register', 'POST', { handle: 'coll_admin', password: 'pw-123456', displayName: 'Coll Admin' });
if (!admin.body?.token) {
  admin = await call('/api/auth/login', 'POST', { handle: 'coll_admin', password: 'pw-123456' });
}
const seeded = await call('/api/ops/seed', 'POST', {}, admin.body?.token);
const seededCount = seeded.body?.seeded?.objects ?? seeded.body?.seeded?.count ?? 0;
check('demo objects seeded', seeded.status === 200 && seededCount > 0, `status ${seeded.status}${seeded.status === 403 ? ' (start the server with BRIEF_ADMINS=coll_admin)' : ''}`);

// ---- 1. DISCOVER -----------------------------------------------------------
const feed = await call('/api/me/feed', 'GET', null, token);
const objects = feed.body?.objects ?? [];
check('discover: feed returns real persisted objects', objects.length > 0, `count ${objects.length}`);
const types = [...new Set(objects.map((o) => o.type))];
check('discover: mixed object types available', types.length >= 2, types.join(','));

// ---- 2. SAVE (quick save -> Saved bucket, no collection picked) ------------
const target = objects.find((o) => o.type === 'event') ?? objects[0];
check('discover: picked a real object to save', Boolean(target?.id), 'no target');
const save = await call(`/api/me/saved/${target.id}`, 'POST', {}, token);
check('save: quick save persists into Saved', save.status === 200 && save.body.saved.includes(target.id), `got ${save.status}`);
const save2 = await call(`/api/me/saved/${target.id}`, 'POST', {}, token);
check('save: idempotent (no duplicates)', save2.body.saved.filter((id) => id === target.id).length === 1);
const colls0 = await call('/api/me/collections', 'GET', null, token);
check('organize: fresh user starts with no collections', colls0.status === 200 && colls0.body.collections.length === 0, JSON.stringify(colls0.body?.collections));

// ---- 3. ORGANIZE -----------------------------------------------------------
const create = await call('/api/me/collections', 'POST', { name: 'Weekend Plans', description: 'Where this weekend is going.' }, token);
const col = create.body?.collection;
check('organize: create collection', create.status === 200 && col?.id && col.visibility === 'private', JSON.stringify(col ?? create.status));
const dupName = await call('/api/me/collections', 'POST', { name: 'weekend plans' }, token);
check('organize: duplicate name refused', dupName.status === 400, `got ${dupName.status}`);
const offer = objects.find((o) => o.type === 'offer') ?? objects[1];
const add1 = await call(`/api/me/collections/${col.id}/items`, 'POST', { objectId: target.id }, token);
const add2 = await call(`/api/me/collections/${col.id}/items`, 'POST', { objectId: offer.id }, token);
check('organize: mixed types added (event + offer)', add1.status === 200 && add2.status === 200, `${add1.status}/${add2.status}`);
const addDup = await call(`/api/me/collections/${col.id}/items`, 'POST', { objectId: target.id }, token);
check('organize: duplicate add is a no-op', addDup.body?.added === false && addDup.status === 200, JSON.stringify(addDup.body));
const page1 = await call(`/api/me/collections/${col.id}`, 'GET', null, token);
check('organize: page shows count 2 with real items', page1.body?.collection?.count === 2 && page1.body.collection.items.length === 2, JSON.stringify(page1.body?.collection?.count));
const cover = page1.body?.collection?.cover;
check('organize: cover derived honestly (never fabricated)', ['single', 'mosaic', 'none'].includes(cover?.kind), JSON.stringify(cover));
const listed = await call('/api/me/collections', 'GET', null, token);
check('organize: collection listed with real count', listed.body.collections.some((c) => c.id === col.id && c.count === 2), JSON.stringify(listed.body?.collections));

// ---- 4. REVISIT ------------------------------------------------------------
const rename = await call(`/api/me/collections/${col.id}`, 'PATCH', { name: 'Weekend Ideas' }, token);
check('revisit: rename applies', rename.status === 200 && rename.body.collection.name === 'Weekend Ideas', JSON.stringify(rename.body));
const ids = page1.body.collection.items.map((i) => i.object.id).reverse();
const reorder = await call(`/api/me/collections/${col.id}/items/order`, 'PUT', { objectIds: ids }, token);
const page2 = await call(`/api/me/collections/${col.id}`, 'GET', null, token);
check('revisit: reorder persists', reorder.status === 200 && page2.body.collection.items.map((i) => i.object.id).join(',') === ids.join(','), JSON.stringify(page2.body?.collection?.items?.map((i) => i.object.id)));
check('revisit: item statuses honest (lifecycle from real fields)', page2.body.collection.items.every((i) => i.object.temporal?.status || i.object.status), JSON.stringify(page2.body?.collection?.items?.map((i) => i.object.temporal ?? i.object.status)));

// ---- 5. ACT ----------------------------------------------------------------
// Privacy: anonymous cannot read a private collection.
const anonPrivate = await call(`/api/collections/personal/${col.id}`, 'GET');
check('act: private collection is 404 for anonymous', anonPrivate.status === 404, `got ${anonPrivate.status}`);
// Ownership: another user cannot read or modify it.
const other = await call('/api/auth/register', 'POST', { handle: `coll_other_${Date.now() % 100000}`, password: 'pw-123456', displayName: 'Other' });
const otherRead = await call(`/api/me/collections/${col.id}`, 'GET', null, other.body?.token);
check('act: other user cannot read it (404)', otherRead.status === 404, `got ${otherRead.status}`);
const otherPatch = await call(`/api/me/collections/${col.id}`, 'PATCH', { name: 'hijacked' }, other.body?.token);
check('act: other user cannot modify it (404)', otherPatch.status === 404, `got ${otherPatch.status}`);
// Sharing: make it public -> stable URL + anonymous page with public items only.
const vis = await call(`/api/me/collections/${col.id}`, 'PATCH', { visibility: 'public' }, token);
const share = await call(`/api/me/collections/${col.id}/share`, 'POST', {}, token);
check('act: share returns stable URL', vis.status === 200 && typeof share.body?.url === 'string' && share.body.url.includes(`/collections/${col.id}`), JSON.stringify(share.body));
const anonPublic = await call(`/api/collections/personal/${col.id}`, 'GET');
check('act: public page now readable anonymously', anonPublic.status === 200 && anonPublic.body.collection.name === 'Weekend Ideas', `got ${anonPublic.status}`);
// Cross-check the privacy boundary: every item on the public page must also
// exist in the anonymous public object feed (publicObject projection never
// lets a private/unavailable object through).
const anonObjects = await call('/api/objects?publication=public&limit=200', 'GET');
const anonIds = new Set((anonObjects.body?.objects ?? []).map((o) => o.id));
check('act: public page projects only public objects', anonPublic.body.collection.items.every((i) => anonIds.has(i.object.id)), JSON.stringify(anonPublic.body?.collection?.items?.map((i) => ({ id: i.object.id, inPublic: anonIds.has(i.object.id) }))));
// Remove one item, then delete the whole collection. The underlying objects
// must still exist afterwards (refs only).
const remove = await call(`/api/me/collections/${col.id}/items/${target.id}`, 'DELETE', {}, token);
const page3 = await call(`/api/me/collections/${col.id}`, 'GET', null, token);
check('act: remove item shrinks the page', remove.body?.removed === true && page3.body.collection.count === 1, JSON.stringify(page3.body?.collection?.count));
const stillThere = await call('/api/me/feed', 'GET', null, token);
check('act: removing from collection never deletes the object', stillThere.body.objects.some((o) => o.id === target.id));
const del = await call(`/api/me/collections/${col.id}`, 'DELETE', {}, token);
const gone = await call(`/api/me/collections/${col.id}`, 'GET', null, token);
const anonGone = await call(`/api/collections/personal/${col.id}`, 'GET');
check('act: delete removes the collection everywhere', del.status === 200 && gone.status === 404 && anonGone.status === 404, `${del.status}/${gone.status}/${anonGone.status}`);

console.log(`\n${'='.repeat(52)}\nLIVE COLLECTIONS LOOP: PASSED ${pass}   FAILED ${fail}\n${'='.repeat(52)}`);
process.exit(fail ? 1 : 0);
