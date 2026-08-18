// Live integration: the REAL typed client against a REAL running server.
const api = require('./src/api/briefApi.ts');
let pass=0, fail=0;
const check=(n,c,x)=>{ c?pass++:(fail++,console.log('  FAIL: '+n+(x?' -> '+x:''))); };

async function run(){
  console.log('\n=== LIVE INTEGRATION (real server) ===\n');
  let r = await api.getCircles();
  check('circles reachable', r.ok===true, r.ok?'':r.error);
  check('starts empty (no seed data)', r.ok && r.data.length===0);

  const c = await api.createCircle({ name:'School Fees', goal:'Term 3', targetValue:5000 });
  check('createCircle ok', c.ok===true, c.ok?'':c.error);
  const id = c.ok ? c.data.id : '';
  check('new target has zero progress', c.ok && c.data.currentValue===0);
  check('new target pct is 0', c.ok && c.data.progressPct===0);

  // ATTACK: try to fake progress through the real wire.
  const forged = await fetch('/ingest/api/circles/'+id, {
    method:'PATCH', headers:{'content-type':'application/json'},
    body: JSON.stringify({ currentValue: 33750, progressPct: 67.5 })
  });
  check('forged PATCH accepted by HTTP', forged.status===200);
  let after = await api.getCircle(id);
  check('progress UNCHANGED after forgery', after.ok && after.data.circle.currentValue===0);
  check('pct UNCHANGED after forgery', after.ok && after.data.circle.progressPct===0);

  // AUTHORITY: attributing money to another person requires coordinator
  // standing. Self-join first (allowed on a fresh circle), then attribute.
  const selfJoin = await api.joinCircle(id, 'coordinator');
  check('self-join as coordinator', selfJoin.ok===true, selfJoin.ok?'':selfJoin.error);
  check('identity from caller', selfJoin.ok && selfJoin.data.userId==='usr_me');
  check('joinCircle takes no userId', api.joinCircle.length<=2);

  const inv = await api.inviteMember(id,'someone_else_entirely');
  check('coordinator CAN invite', inv.ok===true, inv.ok?'':inv.error);

  // Real money.
  const t = await api.createTransaction({ amount:2500, type:'contribution', counterparty:'jane', circleId:id });
  check('createTransaction ok', t.ok===true, t.ok?'':t.error);
  after = await api.getCircle(id);
  check('unsettled money does not move progress', after.ok && after.data.circle.currentValue===0);

  const illegal = await api.requestTransactionTransition(t.ok?t.data.id:'', 'settled');
  check('created->settled REFUSED', illegal.ok===false);
  check('refusal message from server', !illegal.ok && /invalid transition/.test(illegal.error));

  for (const st of ['pending','confirmed','settled']) {
    await api.requestTransactionTransition(t.ok?t.data.id:'', st);
  }
  after = await api.getCircle(id);
  check('settled money moves progress', after.ok && after.data.circle.currentValue===2500);
  check('pct derived correctly', after.ok && after.data.circle.progressPct===50);
  check('contributor counted', after.ok && after.data.circle.contributorCount===1);

  const targets = await api.getTargets();
  check('getTargets sees it', targets.ok && targets.data.length===1);
  check('target view carries real progress', targets.ok && targets.data[0].currentValue===2500);

  const sig = await api.getSignals({ circleId:id });
  check('target_progressed emitted', sig.ok && sig.data.some(s=>s.type==='target_progressed'));
  check('signal carries the amount', sig.ok && sig.data.some(s=>s.value===2500));

  const w = await api.getWallet();
  check('wallet reflects settled money', w.ok && w.data.balance===2500);
  check('wallet says no provider', w.ok && w.data.provider.configured===false);

  // Coordinator adds jane, then records evidence for her. A member may not
  // verify themselves, so this must be done by the coordinator.
  await api.inviteMember(id,'jane');
  const vr = await api.recordVerification(id,'jane','phone_verified');
  check('coordinator records evidence for jane', vr.ok===true, vr.ok?'':vr.error);
  const selfV = await api.recordVerification(id,'usr_me','identity_verified');
  check('self-verification refused', selfV.ok===false && selfV.status===403);
  const auth = await api.getAuthStatus();
  check('auth reports unconfigured', auth.ok && auth.data.configured===false);

  const ms = await api.getMembers(id);
  const jane = ms.ok ? ms.data.find(m=>m.userId==='jane') : null;
  check('member evidence present', jane && jane.trust.evidence.length===1);
  check('no numeric trust score', jane && !('trustScore' in jane) && !('score' in jane.trust));

  console.log('\n====================================================');
  console.log('PASSED '+pass+'   FAILED '+fail);
  console.log('====================================================\n');
  if(fail>0) process.exit(1);
}
module.exports={run};
