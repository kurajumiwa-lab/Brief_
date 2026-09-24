// Disposable end-to-end product walkthrough, NOT a security certification.
// Always creates an isolated temporary store; never connects to the preview or production store.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.NODE_ENV = 'test';
process.env.BRIEF_DEV_AUTH = '0';
process.env.BRIEF_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-workspace-walkthrough-'));
const { default: app } = await import('../server/src/index.js');
const { qualifyGroupCreator } = await import('../server/test/group-fixtures.mjs');
const server = app.listen(0);
const call = async (url, token, method = 'GET', body, expected = 200) => {
  const r = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { ...(token ? {authorization: `Bearer ${token}`} : {}), ...(body ? {'content-type':'application/json'} : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json();
  assert.equal(r.status, expected, `${method} ${url}: ${JSON.stringify(data)}`); return data;
};
let serial = 0;
try {
  const owner = await call('/api/auth/register', null, 'POST', {handle:'walkthrough_owner', password:'disposable walkthrough passphrase'},201);
  const member = await call('/api/auth/register', null, 'POST', {handle:'walkthrough_member', password:'disposable walkthrough passphrase'},201);
  const shop = (await call('/api/spaces', owner.token, 'POST', {name:'Disposable private shell', type:'business', mode:'retail'},201)).space;
  assert.equal(shop.visibility,'private'); assert.equal(shop.offers.length,0);
  qualifyGroupCreator(owner.user.id);
  const group = (await call('/api/circles', owner.token, 'POST', {name:'Disposable purpose group',hostSpaceId:shop.id,directory:{listed:true,location:'QA area',industry:'QA',purposes:['table_banking','group_buy','events']}},201)).circle;
  const directory = await call('/api/groups/directory'); assert.ok(directory.groups.some(g=>g.id===group.id));
  assert.ok(!JSON.stringify(directory).includes(owner.user.id));
  await call(`/api/groups/${group.id}/admission`, member.token,'POST',{});
  const admissions = await call(`/api/groups/${group.id}/admission`,owner.token);
  await call(`/api/groups/${group.id}/admission/decide`,owner.token,'POST',{id:admissions.requests[0].id,approve:true,reason:'Accept requested group membership only.'});
  console.log('Directory → request → coordinator admission. Private shop shell still unpublished.');
  const setup = async (purpose, config) => {
    let w=(await call(`/api/groups/${group.id}/workspaces`,owner.token,'POST',{purpose,name:`Walkthrough ${purpose}`,requestId:`walkthrough-${++serial}`})).workspace;
    await call(`/api/group-workspaces/${w.id}/setup`,owner.token,'PATCH',config);
    w=(await call(`/api/group-workspaces/${w.id}/activate`,owner.token,'POST',{})).workspace;
    return w;
  };
  const enroll = async w => {
    let v=(await call(`/api/group-workspaces/${w.id}`,member.token)).workspace;
    assert.equal(v.resourceId,null,'group membership is not native participation');
    await call(`/api/group-workspaces/${w.id}/participation`,member.token,'POST',{});
    v=(await call(`/api/group-workspaces/${w.id}`,owner.token)).workspace;
    await call(`/api/group-workspaces/${w.id}/participation/decide`,owner.token,'POST',{participantId:v.requests[0].id,approve:true,reason:'Approve explicitly requested participation.'});
  };
  const action = async (w, action, extra={}, token=owner.token) => (await call(`/api/group-workspaces/${w.id}/actions`,token,'POST',{action,reason:'Disposable walkthrough record; no live transaction.',...extra})).workspace;
  const bank=await setup('table_banking',{contributionAmount:100,cycleDays:30});
  await enroll(bank);
  await call(`/api/table-banking/${bank.resourceId}/contributions`,member.token,'POST',{amount:100,idempotencyKey:'walkthrough-bank-contribution'},201);
  const ledger=await call(`/api/table-banking/${bank.resourceId}`,member.token); assert.equal(ledger.summary.totalContributed,100);
  await action(bank,'archive');
  console.log('Table banking: private setup → active → requested/approved financial membership → contribution record → archived history.');
  const buy=await setup('group_buy',{targetAmount:100});
  await enroll(buy);
  let bv=await action(buy,'contribute',{amount:100,source:'cash',requestId:'walkthrough-buy-contribution'},member.token);
  assert.equal(bv.state,'target_met');
  for (const stage of ['ordered','dispatched','delivered','close']) bv=await action(buy,stage);
  assert.equal(bv.state,'closed');
  console.log('Group buy: private setup → funding records → recorded target met → order → dispatch → delivery → closed. No escrow or money-out.');
  const event=await setup('events',{startsAt:new Date(Date.now()+3600000).toISOString(),endsAt:new Date(Date.now()+7200000).toISOString(),price:0,capacity:5,description:'Disposable event',location:'QA only'});
  assert.equal(event.state,'draft');
  await action(event,'publish');
  let ev=(await call(`/api/group-workspaces/${event.id}/participation`,member.token,'POST',{})).workspace;
  assert.equal(ev.registration.status,'registered');
  await action(event,'start');
  await action(event,'checkin',{registrationId:ev.registration.id});
  ev=await action(event,'close');assert.equal(ev.state,'closed');
  console.log('Events: draft → explicit public publication → attendee registration → live → owner check-in → closed. Attendees receive no organizer authority.');
  await call(`/api/spaces/${shop.id}/team/members`,owner.token,'POST',{handle:'walkthrough_member',role:'manager'});
  await call(`/api/spaces/${shop.id}/team/brand`,member.token,'PATCH',{name:'Disposable manager-edited brand'});
  const team=await call(`/api/spaces/${shop.id}/team`,member.token);assert.equal(team.permissions.manageMoney,false);assert.equal(team.permissions.editBrand,true);
  console.log('Shop manager: scoped brand operation succeeds; workspace authority remains separate.');
  console.log(`Walkthrough complete. Disposable data: ${process.env.BRIEF_DATA_DIR}`);
} finally { await new Promise(resolve=>server.close(resolve)); }
