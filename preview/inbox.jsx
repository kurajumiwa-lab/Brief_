const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

async function main(){
  dom.window.open=()=>null;

  // Brief no longer ships seeded objects: the stream is server-backed. Serve
  // ONE real object so duplicate detection and link suggestion have something
  // to compare an incoming message against -- which is the point of these
  // assertions. Served over /api/objects, exercising the real load path.
  const SERVER_OBJECTS=[{
    id:'obj_maji_mazuri', type:'place', title:'Maji Mazuri Farmers & Artisans Market',
    category:'Marketplace', summary:'Fresh organic produce, handcrafts, and open vendor trade.',
    locationName:'Maji Mazuri Grounds, Kilimani', publication:'public',
    verificationStatus:'verified', createdAt:'2026-08-01T08:00:00Z', provenance:[], relationships:[]
  }];
  // The review queue now READS the server. Messages are served from
  // /api/raw-items rather than a constant compiled into the client.
  const { FIXTURE_RAW_ITEMS, FIXTURE_INBOX_SOURCES }=require('./fixtures.cjs');
  global.fetch=async(url)=>{
    const u=String(url);
    const json=(body)=>({ok:true,status:200,text:async()=>JSON.stringify(body),json:async()=>body});
    if(u.includes('/api/raw-items')) return json({rawItems:FIXTURE_RAW_ITEMS});
    if(u.includes('/api/objects')) return json({objects:SERVER_OBJECTS});
    if(u.includes('/api/campaigns')) return json({campaigns:[]});
    if(u.includes('/api/sources')) return json({sources:FIXTURE_INBOX_SOURCES});
    if(u.includes('/api/config')) return json({publicOrigin:null});
    return {ok:false,status:404,text:async()=>'{}',json:async()=>({})};
  };
  dom.window.fetch=global.fetch;

  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  await act(async()=>{await new Promise(r=>setTimeout(r,0));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  const goto=async(dest,section)=>{
    const d=Array.from(document.querySelectorAll('button')).find(b=>text(b)===dest||text(b).startsWith(dest));
    if(d) await click(d);
    if(section){
      const sBtn=Array.from(document.querySelectorAll('button')).find(b=>text(b)===section||text(b).startsWith(section));
      if(sBtn) await click(sBtn);
    }
  };
  const cards=()=>Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  const baseline=cards().length;
  console.log('=== A message does NOT become a post ===');
  // The stream now reflects the server exactly: one object in, one card out.
  // No seeds, and nothing invented to pad the grid.
  check('stream renders exactly what the server returned', baseline===1, String(baseline));

  await goto('Actions','Inbox');
  check('Inbox tab opens', body().includes('Messages from connected sources'));
  check('empty state is honest', body().includes('never as published objects'));

  await click(btn('Fetch messages'));
  const inbox=body();
  check('messages parsed into drafts', inbox.includes('Solar installation'));
  check('raw message shown beside the draft', inbox.includes('asking for a friend'));

  console.log('\n=== Parsed, but NOT published ===');
  await click(btn('Around'));
  const afterFetch=cards().length;
  check('stream UNCHANGED after parsing', afterFetch===baseline, `${baseline} -> ${afterFetch}`);
  await goto('Actions','Inbox');

  console.log('\n=== Provenance + honesty on drafts ===');
  check('shows source channel', inbox.includes('Nairobi Traders (Telegram)')||inbox.includes('Kilimani Notices (WhatsApp)'));
  check('shows parse confidence', /\d+% parsed/.test(inbox));
  check('states unverified', inbox.includes('Unverified. No trust score until reviewed.'));
  check('flags unclear type on chatter', inbox.includes('Type unclear'));
  check('warns on low-signal message', inbox.includes('could not be determined'));
  check('flags possible duplicate of the server object', inbox.includes('Possible duplicate'));
  check('shows extracted phone', inbox.includes('0712345678'));
  check('shows extracted price', inbox.includes('4500'));
  check('shows extracted deadline', inbox.includes('30 September'));
  check('suggests a real connection', inbox.includes('Message names')||inbox.includes('Stated location matches'));

  console.log('\n=== Publishing is the only path in ===');
  const pub=btn('Publish to Brief');
  check('publish control present', !!pub);
  if(pub) await click(pub);
  await click(btn('Around'));
  const afterPublish=cards().length;
  check('stream grew by exactly 1', afterPublish===baseline+1, `${baseline} -> ${afterPublish}`);
  check('published object is searchable in stream', body().includes('Solar installation'));

  console.log('\n=== Published object stays honest ===');
  const nc=cards().find(c=>text(c).includes('Solar installation'));
  if(nc){ await click(nc);
    const m=document.querySelector('.fixed.inset-0.z-50'); const mt=m?text(m):'';
    check('opens as a normal Brief object', mt.includes('Solar installation'));
    check('NOT marked verified', !mt.includes('VERIFIED'));
    check('no invented trust score', !/\b9[0-9]%\b/.test(mt), mt.slice(0,150));
    check('no freshness claim (never verified)', !mt.includes('Recently verified'));
    check('carries its extracted phone', mt.includes('0712345678'));
    if(m) await click(m);
  }

  console.log('\n=== Discard removes from review, adds nothing ===');
  await goto('Actions','Inbox');
  const before=cards().length;
  const disc=btn('Discard');
  if(disc) await click(disc);
  await click(btn('Around'));
  check('discard publishes nothing', cards().length===before||cards().length===afterPublish);
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
