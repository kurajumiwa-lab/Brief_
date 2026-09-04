// ECON — Brief Points remain honest (a record, not currency).
const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
require('./suiteauth.cjs').installSuiteSession();
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

global.fetch = async (url) => {
  const path = String(url);
  const send = (b) => ({ ok:true, status:200, text:async()=>JSON.stringify(b), json:async()=>b });
  return { ok:false, status:404, text:async()=>'{}', json:async()=>({}) };
};

async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  console.log('=== Brief Points remain honest (a record, not currency) ===');
  await click(btn('My Layer'));
  await click(btn('Points'));
  check('points stated honestly: contributions are not cash, referral cash is pool-backed',
    /One level deep/i.test(body()) && /No entry fee/i.test(body()) && /backed by money Brief actually earned/i.test(body()));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
