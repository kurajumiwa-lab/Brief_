// ECON — the Arena economy suite. The fabricated client-side points/redemption
// economy (gift cards, XP, reliability, account marketplace) was removed in the
// "kill the mock data" sweep. The Arena is now the server's real entities, so
// this suite now asserts what the redesign keeps: money is never invented, the
// compliance gate stays, and Brief Points are an honest record, not currency.
const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

global.fetch = async (url) => {
  const path = String(url);
  const send = (b) => ({ ok:true, status:200, text:async()=>JSON.stringify(b), json:async()=>b });
  if (path.includes('/api/arena/status')) return send({ arenaMoney: { enabled:false, requirements: [] } });
  if (path.includes('/api/arena/games')) return send({ games: [{ id:'efootball', name:'eFootball', platform:'mobile' }], activity: {} });
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

  console.log('=== The fabricated economy is gone ===');
  await click(btn('Arena'));
  check('no points balance', !/Arena Points/.test(body()));
  check('no gift cards', !/Carrefour|Safaricom|Java House|IMAX/.test(body()));
  check('no redemption surface', !/Redeem in Arena/.test(body()));
  check('no fake reliability/ratings', !/% reliability|W \/ \d+L/.test(body()));

  console.log('\n=== Brief Points remain honest (a record, not currency) ===');
  await click(btn('My Layer'));
  await click(btn('Points'));
  check('points stated as not cash', /not cash and have no monetary value/i.test(body()));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
