import './test-env.mjs';
import assert from 'node:assert/strict';
process.env.BRIEF_DEV_AUTH = '0';
const { store } = await import('../src/store.js');
const spaces = await import('../src/domain/space.js');
const { default: app } = await import('../src/index.js');
store._reset();
const server = app.listen(0);
let count=0;
const test=async(name,fn)=>{await fn();count++;console.log('PASS '+name);};
const call=async(path,token,method='GET',body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,body:await r.json()};};
const register=async handle=>(await call('/api/auth/register',null,'POST',{handle,password:'a long test passphrase'})).body;
try {
 const owner=await register('team_owner'), manager=await register('team_manager'),staff=await register('team_staff'),stranger=await register('team_stranger');
 const shop=spaces.createSpace({ownerId:owner.user.id,name:'First shop',type:'business'});
 const sibling=spaces.createSpace({ownerId:owner.user.id,name:'Second shop',type:'business'});
 spaces.createSpaceOffer(shop.id,{title:'Tea',price:100,callerId:owner.user.id});
 const base=`/api/spaces/${shop.id}/team`;
 await test('only owner can assign roles; body identities cannot forge authority',async()=>{
   assert.equal((await call(base)).status,401);
   assert.equal((await call(base,stranger.token)).status,403);
   assert.equal((await call(base+'/members',stranger.token,'POST',{handle:'team_staff',role:'manager',ownerId:owner.user.id})).status,403);
   assert.equal((await call(base+'/members',owner.token,'POST',{handle:'team_manager',role:'manager'})).status,200);
   assert.equal((await call(base+'/members',owner.token,'POST',{handle:'team_staff',role:'staff'})).status,200);
   assert.equal((await call(base+'/members',manager.token,'POST',{handle:'team_staff',role:'manager'})).status,403);
   assert.equal((await call(base+'/members',owner.token,'POST',{handle:'team_owner',role:'staff'})).status,403);
 });
 await test('roles apply to one shop and return a limited catalog, not money or customer data',async()=>{
   const r=await call(base,staff.token);assert.equal(r.body.role,'staff');assert.equal(r.body.offers[0].title,'Tea');
   assert.ok(!('metrics' in r.body.shop));assert.ok(!('recentConversations' in r.body.shop));
   assert.equal((await call(`/api/spaces/${sibling.id}/team`,staff.token)).status,403);
   const mine=(await call('/api/shop-teams',manager.token)).body.shops;
   assert.deepEqual(mine.map(s=>s.id),[shop.id]);
 });
 await test('manager edits brand but cannot alter ownership, money or staff roles',async()=>{
   assert.equal((await call(base+'/brand',staff.token,'PATCH',{name:'Staff changed it'})).status,403);
   assert.equal((await call(base+'/brand',manager.token,'PATCH',{name:'Managed shop',image:null,goal:'Local products'})).status,200);
   assert.equal(store.find('spaces',s=>s.id===shop.id).name,'Managed shop');
   const activity=store.filter('spaceActivities',a=>a.kind==='brand_updated').at(-1);
   assert.equal(activity.actorId,manager.user.id);
   assert.equal((await call(base+'/brand',manager.token,'PATCH',{ownerId:manager.user.id})).status,400);
   assert.equal((await call(base+'/brand',manager.token,'PATCH',{image:'javascript:alert(1)'})).status,400);
   assert.equal((await call(`/api/spaces/${shop.id}`,manager.token,'PATCH',{visibility:'public'})).status,400);
 });
 await test('role updates are idempotent, audited and revocation takes effect immediately',async()=>{
   const before=store.all('roleAssignments').length;
   await call(base+'/members',owner.token,'POST',{handle:'team_staff',role:'staff'});
   assert.equal(store.all('roleAssignments').length,before);
   await call(base+'/members',owner.token,'POST',{handle:'team_manager',role:'remove'});
   assert.equal((await call(base,manager.token)).status,403);
   assert.equal((await call(base+'/brand',manager.token,'PATCH',{name:'Revoked'})).status,403);
   assert.deepEqual((await call('/api/shop-teams',manager.token)).body.shops,[]);
   assert.ok(store.find('spaceActivities',a=>a.kind==='team_role_changed'&&a.metadata.after===null&&a.actorId===owner.user.id));
   await call(base+'/members',owner.token,'POST',{handle:'team_manager',role:'staff'});
   assert.equal((await call(base,manager.token)).body.role,'staff');
   assert.equal((await call(base+'/brand',manager.token,'PATCH',{name:'Old manager'})).status,403);
 });
 console.log(`\nPASS ${count}`);
} finally { await new Promise(r=>server.close(r)); }
