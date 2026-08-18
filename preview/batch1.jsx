// ---------------------------------------------------------------------------
// BUILD BATCH 1 -- honesty, consolidation and client wiring.
//
// Guards the things this batch fixed, so they cannot silently come back:
//   1. Nearby renders SERVER objects. No seeded content anywhere.
//   2. Pulse derives what it can and says "Not measured" (with a reason) for
//      what it cannot. The old invented civic figures must never return.
//   3. The derived wallet and ledger are surfaced, with payouts explicitly
//      unavailable using the server's own reason.
//   4. Circles -- the single community primitive -- render server-derived
//      target progress.
// ---------------------------------------------------------------------------
const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;
const fs=require('fs');
const appSrc=fs.readFileSync(__dirname+'/src/App.tsx','utf8');
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

(async()=>{
  dom.window.open=()=>null;
  const OBJS=[{id:'o1',type:'experience',title:'Kilimani Night Market',category:'Market',
    summary:'12 vendors, entry KES 300.',locationName:'Maji Mazuri Grounds',publication:'public',
    verificationStatus:'verified',lastVerifiedAt:new Date().toISOString(),validityWindowDays:30,
    createdAt:new Date().toISOString(),provenance:[{sourceId:'s1',platform:'telegram'}],relationships:[]}];
  global.fetch=async(url)=>{
    const u=String(url);
    const j=(b)=>({ok:true,status:200,text:async()=>JSON.stringify(b),json:async()=>b});
    if(u.includes('/api/objects')) return j({objects:OBJS});
    if(u.includes('/api/economic/wallet')) return j({balance:4500,pending:1200,currency:'KES',transactionCount:3,provider:{configured:false,provider:null,reason:'No payment provider is connected.'}});
    if(u.includes('/api/transactions')) return j({transactions:[{id:'t1',amount:4500,currency:'KES',type:'ticket',status:'settled',description:'Ticket sale',counterparty:null,circleId:null,objectId:null,metadata:{},history:[],createdAt:'2026-08-16T10:00:00Z',updatedAt:'2026-08-16T10:00:00Z'}],provider:{configured:false,provider:null,reason:'x'}});
    if(u.includes('/api/circles')) return j({circles:[{id:'c1',name:'Kilimani Traders',description:'Traders circle',type:'treasury',status:'active',visibility:'private',sourceId:null,goal:'Shared stall fund',targetValue:50000,deadline:null,completionCriteria:null,parentCircleId:null,createdAt:'2026-08-01T00:00:00Z',updatedAt:'2026-08-01T00:00:00Z',currentValue:12500,contributorCount:4,progressPct:25,settledCount:4,blockCount:2,memberCount:6}]});
    if(u.includes('/api/sources')) return j({sources:[]});
    if(u.includes('/api/campaigns')) return j({campaigns:[]});
    if(u.includes('/api/config')) return j({publicOrigin:null});
    return {ok:false,status:404,text:async()=>'{}',json:async()=>({})};
  };
  dom.window.fetch=global.fetch;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  await act(async()=>{await new Promise(r=>setTimeout(r,10));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));

  console.log('=== 1. The stream is server-backed, not seeded ===');
  check('server object appears in the stream', body().includes('Kilimani Night Market'));
  check('no seeded market', !body().includes('Maji Mazuri Farmers'));
  check('no seeded permit guide', !body().includes('knw_permit_guide'));

  console.log('\n=== 2. Pulse: derived, or honestly absent ===');
  await click(btn('Pulse')); await click(btn('Signals'));
  let b=body();
  check('freshness section present', /Freshness/.test(b));
  check('unmeasurable metrics say Not measured', /Not measured/.test(b));
  check('a reason is given, not a blank', /Brief does not track business outcomes/i.test(b));
  check('no invented businesses-helped figure', !b.includes('412'));
  check('no invented contributions figure', !b.includes('1450'));
  check('no invented freshness percentage', !b.includes('97.4'));
  check('no invented events-attended figure', !b.includes('620'));

  console.log('\n=== 3. Money: derived wallet, honest payouts ===');
  await click(btn('Workflows')); await click(btn('Money'));
  await act(async()=>{await new Promise(r=>setTimeout(r,10));});
  b=body();
  check('available balance shown', b.includes('4,500'));
  check('pending kept separate from available', b.includes('1,200'));
  check('states the row count it derives from', /Derived from 3 transactions/i.test(b));
  check('missing provider stated plainly', /No payment provider connected/i.test(b));
  check('payouts explicitly unavailable', /Disbursements are not implemented/i.test(b));

  console.log('\n=== 4. Circles: one community primitive ===');
  await click(btn('My Layer')); await click(btn('Circles'));
  await act(async()=>{await new Promise(r=>setTimeout(r,10));});
  b=body();
  check('circle listed', b.includes('Kilimani Traders'));
  check('server-derived progress rendered', b.includes('25%'));
  check('progress cites settled contributions', /from 4 settled contributions/i.test(b));

  console.log('\n=== 5. Source guards ===');
  check('INITIAL_TOWN_HEALTH is gone', !/INITIAL_TOWN_HEALTH/.test(appSrc));
  check('BriefGroup type is retired', !/BriefGroup(\[|;|,| =|>)/.test(appSrc));
  check('civic metrics are derived, not stored', /deriveTownHealth/.test(appSrc));
  check('a metric cannot carry a value while unavailable',
    /available: false; reason: string/.test(appSrc));
  check('five destinations only',
    (appSrc.match(/\{ id: '(nearby|arena|mylayer|workflows|pulse)'/g)||[]).length===5);

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
})();
