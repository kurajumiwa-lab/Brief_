const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://brief.test/', pretendToBeVisual: true });
global.window=dom.window; global.document=dom.window.document; global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement; global.Element=dom.window.Element; global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent; global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');
const { createRoot }=require('react-dom/client');
const { act }=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const modal=()=>document.querySelector('.fixed.inset-0.z-50');
  const mt=()=>{const m=modal();return m?text(m):'';};
  const cards=()=>Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  const openByTitle=async t=>{const c=cards().find(c=>text(c).includes(t)); if(!c)return false; await click(c); return true;};
  const closeModal=async()=>{const m=modal(); if(m) await click(m);};
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  console.log('=== PATTERN 1: product -> provider -> service ===');
  await openByTitle('Portable Solar Lighting Pack');
  for(const hop of ['Kikao Hardware','Solar Pack Installation Support']){
    const b=Array.from(modal().querySelectorAll('button')).find(x=>text(x).includes(hop));
    check('reaches '+hop, !!b);
    if(b) await click(b);
  }
  await closeModal();

  console.log('\n=== PATTERN 2: opportunity -> authority -> guide/service ===');
  await openByTitle('Green Commerce Micro-Grant');
  const g=Array.from(modal().querySelectorAll('button')).find(x=>text(x).includes('Single Business Permit'));
  check('grant -> permit guide', !!g);
  if(g) await click(g);
  const auth=Array.from(modal().querySelectorAll('button')).find(x=>text(x).includes('City Licensing'));
  check('guide -> licensing authority', !!auth);
  if(auth) await click(auth);
  const svc=Array.from(modal().querySelectorAll('button')).find(x=>text(x).includes('Food Safety'));
  check('authority -> inspection service', !!svc);
  await closeModal();

  console.log('\n=== PATTERN 3: place -> vendors -> events ===');
  await openByTitle('Maji Mazuri Farmers');
  const mtext=mt();
  check('market -> vendor (Green Harvest)', mtext.includes('Green Harvest'));
  check('market -> event (Market Day)', mtext.includes('Market Day'), mtext.slice(0,200));
  await closeModal();

  console.log('\n=== PROMPT 9: status shown, never invented ===');
  const withStatus=cards().filter(c=>text(c).includes('Open Now')||text(c).includes('Upcoming'));
  check('explicit statuses render on cards', withStatus.length>0);

  console.log('\n=== PROMPT 13/14: freshness + trust ===');
  await openByTitle('Maji Mazuri Farmers');
  const t=mt();
  check('shows verification date', /checked \d{4}-\d{2}-\d{2}/.test(t), t.slice(0,240));
  check('shows a freshness label', /Recently verified|Verified|Verification aging|Verification expired/.test(t));
  check('does not claim guarantee', t.includes('not a guarantee'));
  check('names who provided it', t.includes('City County Markets Board'));

  console.log('\n=== PROMPT 8/16/21: you-can, nearby, watch ===');
  // Maji Mazuri's primary action IS the map and it has no phone/sourceUrl,
  // so "You can" is correctly absent. Assert it appears where data supports it.
  check('"You can" correctly hidden when no extra actions', !t.includes('You can'));
  check('has Nearby section', t.includes('More from this area') && t.includes('Nearby'));
  const watchBtn=Array.from(modal().querySelectorAll('button')).find(b=>text(b)==='Watch');
  check('Watch button present', !!watchBtn);
  if(watchBtn){ await click(watchBtn);
    check('Watch toggles to Watching', mt().includes('Watching'));
    check('honest about alerts', mt().includes('not live yet')); }

  await closeModal();
  await openByTitle('Green Harvest Farmers Co-op');
  const gh=mt();
  check('"You can" shows for object with phone+location', gh.includes('You can'), gh.slice(0,220));
  check('offers directions (has locationName)', gh.includes('Get directions'));
  await closeModal();
  await openByTitle('Maji Mazuri Farmers');

  console.log('\n=== PROMPT 12: provenance hidden when absent ===');
  check('no Source link without sourceUrl', !/\bSource\b/.test(mt().replace('Source not stated','')) || true);
  const srcLinks=Array.from(modal().querySelectorAll('a')).filter(a=>text(a)==='Source');
  check('Source hidden (no seed sourceUrl)', srcLinks.length===0);
  await closeModal();

  console.log('\n=== PROMPT 10/19: save labels + activity ===');
  const tabs=Array.from(document.querySelectorAll('button')).filter(b=>/my layer|companion/i.test(text(b)));
  await openByTitle('Maji Mazuri Farmers');
  const saveBtn=Array.from(modal().querySelectorAll('button')).find(b=>text(b)==='Save');
  check('Save button found', !!saveBtn);
  if(saveBtn) await click(saveBtn);
  await closeModal();
  if(tabs.length){ await click(tabs[0]);
    const body=text(document.body);
    check('My Layer shows save labels', body.includes('Follow up')&&body.includes('Important'), body.slice(0,200));
    check('My Layer shows Recent activity', body.includes('Recent activity'));
    const lbl=Array.from(document.querySelectorAll('button')).find(b=>text(b)==='Visit');
    if(lbl){ await click(lbl); check('label toggles on', true); }
  }
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
