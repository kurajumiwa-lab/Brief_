const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
require('./suiteauth.cjs').installSuiteSession();
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;
async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  // Sections now live inside a bundle, so a jump is destination -> bundle ->
  // sub-section. Feeds is filed under Records.
  const goto=async(dest,...sections)=>{
    const d=Array.from(document.querySelectorAll('button')).find(b=>text(b)===dest||text(b).startsWith(dest));
    if(d) await click(d);
    for(const section of sections){
      const sBtn=Array.from(document.querySelectorAll('button')).find(b=>text(b)===section||text(b).startsWith(section));
      if(sBtn) await click(sBtn);
    }
  };
  const setVal=async(el,v)=>{await act(async()=>{
    const proto=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,v);
    el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  const cards=()=>Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  // Capture now persists server-side via /api/brief-it/save. Stub the API and
  // record calls so the test asserts real persistence, not a local-state echo.
  const calls=[];
  global.fetch = dom.window.fetch = async (url, init) => {
    const u=String(url); const m=(init&&init.method)||'GET';
    calls.push(m+' '+u);
    const send=(o)=>({ok:true,status:200,text:async()=>JSON.stringify(o),json:async()=>o});
    if (u.includes('/api/auth/me')) return send({ user:{ id:'usr_local', handle:'local', displayName:'Local' } });
    if (u.includes('/api/brief-it/save')) return send({ rawItemId:'raw_1', duplicate:false, result:{ created:true } });
    if (u.includes('/api/objects')) return send({ objects:[] });
    // Leave sources/capabilities/status unreachable so the Sources surface
    // honestly reports "Ingestion server not reachable" in this harness.
    return { ok:false, status:404, text:async()=> '{}', json:async()=>({}) };
  };

  const baseline=cards().length;
  console.log('=== CAPTURE: drop something here ===');
  await click(btn('Menu'));
  const cap=btn('New')||btn('Start something');
  check('capture lives on the shelf, not a header', !!cap);
  await click(cap);
  check('shows "Drop something here."', body().includes('Drop something here.'));
  check('shows supporting copy', body().includes('A message, link, listing, event, opportunity or anything worth keeping'));
  // Guard against AI *branding*, not any word containing the letters a-i.
  check('no AI branding', !/\bAI[- ]|artificial intelligence|powered by|smart assistant/i.test(body()));

  const ta=document.querySelector('textarea');
  await setVal(ta,'Plumber available for repair and installation works. Charges from KSh 1,500. Call 0712345678.');
  await click(btn('Read it'));
  let b=body();
  check('classified as Service', b.includes('Service'), b.slice(0,200));
  check('extracted price', b.includes('1500'));
  check('extracted phone', b.includes('0712345678'));
  check('marked unverified', b.includes('Unverified'));
  check('NOT saved before confirmation', !calls.some((c)=>c.startsWith('POST /ingest/api/brief-it/save')));

  await click(btn('Save to Brief'));
  check('saved only after confirmation', calls.some((c)=>c.startsWith('POST /ingest/api/brief-it/save')), calls.join(' | '));

  console.log('\n=== CAPTURE refuses chatter ===');
  await click(btn('Menu'));
  await click(btn('New')||btn('Start something'));
  const ta2=document.querySelector('textarea');
  await setVal(ta2,'Hey everyone good morning');
  await click(btn('Read it'));
  b=body();
  check('refuses to make an object', b.includes('could not make an object'));
  check('explains why', b.includes('conversation')||b.includes('Too short')||b.includes('No recognisable'));
  check('says nothing was saved', b.includes('Nothing was saved'));
  check('offers no Save button', !btn('Save to Brief'));
  await click(btn('Discard'));

  console.log('\n=== SOURCES view ===');
  await goto('Workflows','Records','Feeds');
  b=body();
  // Sources come from the server now; the seeded 'Nairobi Traders' list is
  // gone. With no connector server in this harness the surface must say so
  // rather than list sources Brief is not actually connected to.
  check('sources surface renders without inventing sources',
    !b.includes('Nairobi Traders') && !b.includes('Kilimani Notices'));
  // With no seeded sources and no reachable server, the surface must state
  // the connector situation plainly. (getSourceHealth's derivation is still
  // guarded in parse.jsx -- it is the fake source rows that are gone.)
  check('states the connector situation instead of listing nothing silently',
    /Ingestion server not reachable|Checking\.\.\./i.test(b));
  check('channel is not the information', b.includes('A channel is not the information'));
  check('no technical errors exposed', !/stack|ECONN|undefined is not/i.test(b));

  console.log('\n=== TODAY / daily brief ===');
  await click(btn('Nearby'));
  await click(btn('More')); // section pills live behind More now
  await click(btn('Today'));
  b=body();
  check('today tab renders', b.includes('Only what relates to your pursuits'));
  check('no generic news', !/headline|breaking|trending/i.test(b));
  // "Good morning" is the hero bar's time-of-day greeting (rendered before
  // noon), legitimate product copy rather than filler — so asserting against it
  // made this check flaky by the clock. Assert actual motivational filler only.
  check('no motivational filler', !/You got this|Have a great|You're doing great/i.test(b));

  console.log('\n=== Pursuit: "Nothing useful yet." ===');
  await click(btn('Alerts'));
  const inp=document.querySelector('input[placeholder="find a plumber near me"]');
  await setVal(inp,'find a helicopter mechanic');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('says "Nothing useful yet."', b.includes('Nothing useful yet.'));
  check('offers to keep matching later', b.includes('Keep this pursuit open'));
  const kw=btn('Keep watching');
  check('offers Keep watching', !!kw);
  if(kw){ await click(kw); check('watch conditions appear', body().includes('Tell me about')); 
    check('honest that alerts are not live', body().includes('Alerts are not live yet')); }

  console.log('\n=== Why this appeared ===');
  await click(btn('Nearby'));
  if(cards()[0]){ await click(cards()[0]);
    const m=document.querySelector('.fixed.inset-0.z-50');
    check('why-this-appeared present', text(m).includes('Why this appeared'), text(m).slice(0,120)); }
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
