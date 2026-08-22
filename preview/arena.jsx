const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

// The server-backed Arena: challenges + games come from these routes. Players,
// venues, tournaments and the leaderboard are also server routes now — left
// unmocked (404) so the Arena renders their honest empty states, proving the
// client no longer ships a fabricated fixture layer.
global.fetch = async (url) => {
  const path = String(url);
  const send = (b) => ({ ok:true, status:200, text:async()=>JSON.stringify(b), json:async()=>b });
  if (path.includes('/api/arena/status')) return send({ arenaMoney: { enabled:false, requirements: [] } });
  if (path.includes('/api/arena/games')) return send({ games: [
    { id:'efootball', name:'eFootball', platform:'mobile' },
    { id:'cod_mobile', name:'COD Mobile', platform:'mobile' },
    { id:'other', name:'Other', platform:'any' }
  ], activity: {} });
  if (path.includes('/api/arena/challenges/') && path.endsWith('/accept')) {
    return send({ challenge: { id:'chl_real', status:'accepted' }, match: { id:'mtch_real', status:'scheduled' }, reused:false });
  }
  if (path.includes('/api/arena/challenges')) {
    return send({ challenges: [
      { id:'chl_nyabs_1', gameId:'efootball', mode:'1v1', createdBy:'ply_nyabs', stake:'entry_fee', entryFeeKes:100, openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:00:00Z' },
      { id:'chl_mike_1', gameId:'efootball', mode:'1v1', createdBy:'ply_mike', stake:'friendly', openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:10:00Z' }
    ] });
  }
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

  console.log('=== Arena is a gathering place, not a competition ===');
  await click(btn('Play'));
  let b=body();
  check('Arena opens', /Gather with people to play/i.test(b));
  check('not framed as a competition', /Not a competition/i.test(b));

  console.log('\n=== Game portals present (Game Theme Engine) ===');
  check('eFootball portal present', b.includes('eFootball'));
  check('COD portal present', b.includes('Call of Duty'));
  check('Other portal present', b.includes('Other'));

  console.log('\n=== Server-backed challenges, not fixtures ===');
  await click(btn('Challenges'));
  b=body();
  check('a real challenge is listed', /1v1/.test(b) && /Friendly|Entry fee|Ranked/.test(b));
  check('entry fee shown from the server row', /KES 100/.test(b));
  check('challenge row has an Accept verb', Boolean(btn('Accept')));

  console.log('\n=== No fabricated economy remains ===');
  check('no fake player names', !/Nyabs|Jay|Kip|Wanjiku/.test(body()));
  check('no gift cards / vouchers', !/Carrefour|Safaricom|Java House/.test(body()));
  check('no fake points balance', !/Arena Points/.test(body()));
  check('no account marketplace', !/Established eFootball account/.test(body()));

  console.log('\n=== Tournaments + leaderboard read the server (empty is honest) ===');
  await click(btn('Tournaments'));
  b=body();
  check('tournaments honest empty state', /No tournaments yet/.test(b));
  await click(btn('Leaderboard'));
  b=body();
  check('leaderboard honest empty state', /No confirmed results yet/.test(b));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
