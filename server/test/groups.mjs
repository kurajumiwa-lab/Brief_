import './test-env.mjs';
import assert from 'node:assert/strict';
process.env.BRIEF_DEV_AUTH = '0';
const { store } = await import('../src/store.js');
const auth = await import('../src/domain/auth.js');
const verify = await import('../src/domain/verification.js');
const spaces = await import('../src/domain/space.js');
const { default: app } = await import('../src/index.js');
store._reset();
const server = app.listen(0);
let count = 0;
const test = async (name, fn) => { await fn(); count++; console.log('PASS ' + name); };
const call = async (path, token, method = 'GET', body) => {
  const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
};
const user = async handle => (await call('/api/auth/register', null, 'POST', { handle, password: 'a long test passphrase' })).body;
try {
  const owner = await user('group_host');
  const stranger = await user('group_visitor');
  let shop, identity, listedId, privateId;
  await test('anonymous and unverified accounts cannot create groups or forge host identity', async () => {
    assert.equal((await call('/api/circles', null, 'POST', {name:'Anonymous'})).status, 401);
    const r = await call('/api/circles', stranger.token, 'POST', {name:'Forged',ownerId:owner.user.id,identityVerified:true});
    assert.equal(r.status, 403); assert.equal(store.all('circles').length, 0);
    assert.equal((await call('/api/groups/eligibility', owner.token)).body.eligible, false);
  });
  await test('an active shop alone or a verified identity alone is insufficient', async () => {
    shop = spaces.createSpace({ ownerId: owner.user.id, name:'Host shop', type:'business' });
    assert.equal((await call('/api/circles', owner.token, 'POST', {name:'Unreviewed'})).status, 403);
    const v = verify.submitVerification(stranger.user.id, {kind:'identity'}).record;
    verify.decide('fixture_reviewer', v.id, {decision:'approved'});
    assert.equal((await call('/api/circles', stranger.token, 'POST', {name:'No shop',hostSpaceId:shop.id})).status, 403);
    identity = verify.submitVerification(owner.user.id, {kind:'identity'}).record;
    verify.decide('fixture_reviewer', identity.id, {decision:'approved'});
    assert.equal((await call('/api/groups/eligibility', owner.token)).body.eligible, true);
  });
  await test('private by default; the creator is coordinator and no private room enters the directory', async () => {
    const r = await call('/api/circles', owner.token, 'POST', {name:'Private planning room',hostSpaceId:shop.id});
    assert.equal(r.status, 201); privateId = r.body.circle.id;
    assert.equal(r.body.circle.visibility, 'invite_only'); assert.equal(r.body.circle.viewerRole,'coordinator');
    assert.deepEqual((await call('/api/groups/directory')).body.groups, []);
    assert.deepEqual((await call('/api/circles', stranger.token)).body.circles, []);
  });
  await test('directory opt-in is validated before writing and accepts multiple declared purposes', async () => {
    const before = store.all('circles').length;
    for (const directory of [{listed:'true'}, {purposes:['invented']}, {purposes:[]}, {location:{text:'hidden'}}]) {
      assert.equal((await call('/api/circles', owner.token, 'POST', {name:'Invalid',directory})).status,400);
    }
    assert.equal(store.all('circles').length, before);
    const r = await call('/api/circles', owner.token, 'POST', {name:'Hospitality buyers',description:'Coordinate weekly orders',hostSpaceId:shop.id,directory:{listed:true,location:'Kilimani',industry:'Hospitality',purposes:['group_buy','events']}});
    assert.equal(r.status,201); listedId=r.body.circle.id;
    assert.equal(r.body.circle.visibility,'discoverable');
    assert.deepEqual(r.body.circle.directory.purposes,['group_buy','events']);
  });
  await test('directory filters publish only discovery metadata, never members or books', async () => {
    await call('/api/blocks', owner.token,'POST',{circleId:listedId,type:'note',content:'PRIVATE ACCOUNT NUMBER'});
    store.insert('ledgerTransactions',{id:'private_test_tx',circleId:listedId,status:'settled',amount:987654,counterparty:owner.user.id});
    const pub = (await call('/api/groups/directory?location=kilimani&industry=Hospitality&purpose=events')).body;
    assert.equal(pub.groups.length,1); assert.equal(pub.groups[0].hostName,'Host shop');
    const json=JSON.stringify(pub);
    for (const secret of ['PRIVATE ACCOUNT NUMBER','987654',owner.user.id,'private_test_tx','Private planning room']) assert.ok(!json.includes(secret),secret);
    assert.equal((await call('/api/groups/directory?location=Mombasa')).body.groups.length,0);
    assert.equal((await call('/api/groups/directory?purpose=table_banking')).body.groups.length,0);
    const code=store.find('circles',c=>c.id===listedId).joinCode;
    const preview=await call(`/api/circles/join/${code}`);
    assert.equal(preview.status,200);assert.equal(preview.body.circle.currentValue,null);assert.equal(preview.body.circle.targetValue,null);
    assert.equal(pub.groups[0].canJoin,false,'listing is not automatic admission');
    for (const path of [`/api/circles/${listedId}`,`/api/circles/${listedId}/members`]) assert.equal((await call(path,stranger.token)).status,403);
    assert.deepEqual((await call(`/api/blocks?circleId=${listedId}`,stranger.token)).body.blocks,[]);
    assert.deepEqual((await call(`/api/signals?circleId=${listedId}`,stranger.token)).body.signals,[]);
  });
  await test('joining opens the workspace; a private group still refuses a stranger',async()=>{
    assert.equal((await call(`/api/circles/${privateId}/members`,stranger.token,'POST',{})).status,403);
    assert.equal((await call(`/api/circles/${listedId}/members`,stranger.token,'POST',{})).status,403);
    assert.equal((await call(`/api/circles/${listedId}/members`,owner.token,'POST',{userId:stranger.user.id})).status,201);
    const own=await call(`/api/circles/${listedId}`,stranger.token);
    assert.equal(own.status,200); assert.equal(own.body.blocks[0].content,'PRIVATE ACCOUNT NUMBER');
    assert.equal((await call(`/api/circles/${listedId}`,stranger.token,'PATCH',{visibility:'open',reason:'I want to publish'})).status,403);
  });
  await test('unlisting requires a reason and immediately removes the directory row',async()=>{
    assert.equal((await call(`/api/circles/${listedId}`,owner.token,'PATCH',{visibility:'invite_only'})).status,400);
    assert.equal((await call('/api/groups/directory')).body.groups.length,1);
    assert.equal((await call(`/api/circles/${listedId}`,owner.token,'PATCH',{visibility:'invite_only',reason:'Return to private planning'})).status,200);
    assert.equal((await call('/api/groups/directory')).body.groups.length,0);
    assert.ok(store.find('circleRevisions',r=>r.circleId===listedId && r.actorId===owner.user.id && r.field==='visibility'));
  });
  await test('an existing directory entry can be edited and legacy groups explicitly opt in',async()=>{
    const patch={directory:{listed:true,location:'Westlands',industry:'Retail',purposes:['coordination']},visibility:'discoverable'};
    assert.equal((await call(`/api/circles/${listedId}`,owner.token,'PATCH',patch)).status,400);
    assert.equal((await call(`/api/circles/${listedId}`,owner.token,'PATCH',{...patch,reason:'New meeting location'})).status,200);
    assert.equal((await call('/api/groups/directory?location=Westlands')).body.groups.length,1);
    patch.directory.location='Ngara';
    assert.equal((await call(`/api/circles/${listedId}`,owner.token,'PATCH',{...patch,reason:'Correct the meeting location'})).status,200);
    assert.equal((await call('/api/groups/directory?location=Ngara')).body.groups.length,1);
    assert.equal((await call('/api/groups/directory?location=Westlands')).body.groups.length,0);
    const changes=store.filter('circleRevisions',r=>r.circleId===listedId&&r.field==='directory');
    assert.equal(changes.at(-1).before.location,'Westlands');assert.equal(changes.at(-1).after.location,'Ngara');
  });
  await test('archive and revoked identity close creation eligibility without destroying existing groups',async()=>{
    store.update('spaces',shop.id,{status:'archived'});
    assert.equal((await call('/api/circles',owner.token,'POST',{name:'Archived host'})).status,403);
    store.update('spaces',shop.id,{status:'active'});
    store.update('verificationRecords',identity.id,{status:'revoked'});
    assert.equal((await call('/api/circles',owner.token,'POST',{name:'Revoked host'})).status,403);
    assert.equal((await call(`/api/circles/${listedId}`,owner.token)).status,200);
  });
  console.log(`\nPASS ${count}`);
} finally { await new Promise(r=>server.close(r)); }
