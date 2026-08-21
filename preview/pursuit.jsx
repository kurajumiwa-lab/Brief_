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

  // Objects are server-backed now (no seeds), and pursuit matching is only
  // meaningful against a real corpus. Serve the two objects these assertions
  // match on, plus one deliberate non-match to prove intent words do not
  // match everything.
  const SERVER_OBJECTS=[
    {id:'prd_solar', type:'product', title:'Portable Solar Lighting Pack',
     category:'Energy', summary:'Solar lighting kit with panel and battery. Cheap to run.',
     locationName:'Kilimani', publication:'public', verificationStatus:'verified',
     metadata:{price:4500,currency:'KES'}, createdAt:'2026-08-01T08:00:00Z',
     provenance:[], relationships:[]},
    {id:'opp_grant', type:'opportunity', title:'Green Commerce Micro-Grant',
     category:'Funding', summary:'Micro-grant for green commerce traders. Applications open.',
     locationName:'Nairobi', publication:'public', verificationStatus:'verified',
     metadata:{deadline:'2026-09-30'}, createdAt:'2026-08-01T08:00:00Z',
     provenance:[], relationships:[]},
    {id:'plc_park', type:'place', title:'Jeevanjee Gardens',
     category:'Park', summary:'Public gardens in the city centre.',
     locationName:'Nairobi CBD', publication:'public', verificationStatus:'verified',
     createdAt:'2026-08-01T08:00:00Z', provenance:[], relationships:[]}
  ];
  global.fetch=async(url)=>{
    const u=String(url);
    const json=(body)=>({ok:true,status:200,text:async()=>JSON.stringify(body),json:async()=>body});
    if(u.includes('/api/objects')) return json({objects:SERVER_OBJECTS});
    if(u.includes('/api/campaigns')) return json({campaigns:[]});
    if(u.includes('/api/sources')) return json({sources:[]});
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
  const type=async(el,v)=>{await act(async()=>{
    const setter=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
    setter.call(el,v); el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  const submit=async f=>{await act(async()=>{f.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});};
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  console.log('=== Pursuits surface ===');
  await click(btn('Around'));
  await click(btn('More')); // section pills live behind More now
  await click(btn('Pursuits'));
  check('tab opens', body().includes('Things you have asked Brief'));
  check('honest empty state', body().includes('Nothing being pursued yet'));
  check('states it only searches what it holds', body().includes('searches only what it already holds'));

  console.log('\n=== Natural language matching ===');
  const input=document.querySelector('input[placeholder="find a plumber near me"]');
  await type(input,'find cheap solar lights near kilimani');
  await submit(input.closest('form'));
  let b=body();
  check('pursuit created', b.includes('find cheap solar lights near kilimani'));
  check('matches the solar product', b.includes('Portable Solar Lighting Pack'), b.slice(0,300));
  check('intent words did not match everything', !b.includes('Jeevanjee Gardens'));

  console.log('\n=== "watch ..." implies monitoring ===');
  await type(input,'watch the green grant');
  await submit(input.closest('form'));
  b=body();
  check('second pursuit created', b.includes('watch the green grant'));
  check('auto-flagged as watching', b.includes('watching'));
  check('matched the grant object', b.includes('Green Commerce Micro-Grant'));

  console.log('\n=== Honest empty result, not fabricated ===');
  await type(input,'find a helicopter mechanic');
  await submit(input.closest('form'));
  b=body();
  check('pursuit saved even with no results', b.includes('find a helicopter mechanic'));
  check('says nothing matching yet', b.includes('Nothing matching yet'));
  check('promises to keep matching later', b.includes('Keep this pursuit open') && b.includes('Nothing useful yet.'));
  check('did NOT invent a result', !b.includes('Helicopter'));

  console.log('\n=== Status lifecycle ===');
  const arch=Array.from(document.querySelectorAll('button')).filter(x=>text(x)==='archived')[0];
  check('status controls present', !!arch);
  if(arch){ await click(arch); check('status changes to archived', body().includes('archived')); }

  console.log('\n=== Entry point: failed search -> pursuit ===');
  await click(btn('Around'));
  const search=document.querySelector('input[placeholder="Search nearby places, jobs, services..."]');
  await type(search,'zzzz nonexistent thing');
  b=body();
  check('empty search offers a pursuit', b.includes('Keep pursuing'), b.slice(0,200));
  const keep=Array.from(document.querySelectorAll('button')).find(x=>text(x).startsWith('Keep pursuing'));
  if(keep){ await click(keep);
    check('creates pursuit from failed search', body().includes('zzzz nonexistent thing')); }

  console.log('\n=== Handing off clears the search box ===');
  await click(btn('Around'));
  const s2=document.querySelector('input[placeholder="Search nearby places, jobs, services..."]');
  check('search cleared after handoff', s2.value==='', `value="${s2.value}"`);

  console.log('\n=== Entry point: object detail -> pursuit ===');
  const cards=Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  if(cards[0]){ await click(cards[0]);
    const m=document.querySelector('.fixed.inset-0.z-50');
    const p=Array.from(m.querySelectorAll('button')).find(x=>text(x)==='Pursue');
    check('detail has Pursue action', !!p);
    if(p){ await click(p); check('detail pursuit created', body().includes('Pursuits (')); } }

  console.log('\n=== Marketplace preserved ===');
  await click(btn('Around'));
  check('stream still renders objects', document.querySelectorAll('div.grid > div[class*="cursor-pointer"]').length>0);
  await goto('Actions','Inbox');
  check('Inbox still present', /Inbox/.test(body()));
  await click(btn('Around'));
  check('My Layer still present', !!btn('Saved'));
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
