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
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
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
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  await goto('My Layer','Groups');
  // The group tab now lists Your Groups first; open one to reach its detail.
  await click(btn('Open'));
  let b=body();
  console.log('=== Brief earns its place ===');
  check('group tab opens', b.includes('Kilimani Traders'));
  check('states it does not post or promote', /does not post,? promote,? (or|and) message/i.test(b));
  check('no advertising UI', !/sponsor|advertis|promote your|reach customers|boost/i.test(b));

  console.log('\n=== Unanswered questions surfaced ===');
  check('shows questions still waiting', b.includes('questions still waiting'));
  check('permit question preserved', b.includes('Where can I renew my business permit?'));
  check('plumber question preserved', b.includes('Who knows a plumber around Kilimani?'));
  check('ANSWERED solar question excluded', !/questions still waiting[\s\S]{0,400}Anyone selling a 50W solar kit/.test(b));

  console.log('\n=== /brief weekly digest ===');
  await click(btn('/brief'));
  b=body();
  check('shows "This week in the group"', b.includes('This week in the group'));
  check('counts opportunities', b.includes('Opportunities'));
  check('counts jobs', b.includes('Jobs'));
  check('no engagement metrics', !/most active|top poster|streak|impressions/i.test(b));

  console.log('\n=== /jobs and /events ===');
  await click(btn('/jobs'));
  b=body();
  check('/jobs finds the vacancy', b.includes('accounts assistant'));
  check('shows original message text', b.includes('Send CV to the office'));
  await click(btn('/events'));
  b=body();
  check('/events finds the forum', b.includes('Youth tech forum'));

  console.log('\n=== Local-first, clearly separated ===');
  await click(btn('/find solar'));
  b=body();
  check('answers from this group', b.includes('From this group'));
  check('finds the solar question', b.includes('Anyone selling a 50W solar kit?'));
  check('shows the ANSWER alongside it', b.includes('Kikao Hardware has 50W systems'), b.slice(0,300));

  const inp=document.querySelector('input[placeholder="Ask something about this group..."]');
  const setVal=async(el,v)=>{await act(async()=>{
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,v);
    el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  await setVal(inp,'/find inspection');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('falls back to wider Brief', /From your Brief information/i.test(b), b.slice(0,200));
  check('labels it as NOT from this group', /\(not this group\)/i.test(b));

  await setVal(inp,'/find helicopter');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  check('honest when truly nothing', body().includes('Nothing in this group, and nothing elsewhere'));

  console.log('\n=== Provenance in results ===');
  await click(btn('/jobs'));
  b=body();
  check('shows author', b.includes('Njeri'));
  check('shows date', /2026-08-1[0-9]/.test(b));
  check('shows extracted entity', b.includes('deadline:')||b.includes('contact:'));

  console.log('\n=== Admin metrics are operational only ===');
  b=body();
  check('messages processed', b.includes('Messages processed'));
  check('information extracted', b.includes('Information extracted'));
  check('questions answered tracked', b.includes('Questions answered'));
  check('no impressions/engagement', !/impressions:|engagement rate|active users|reach:/i.test(b));
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
