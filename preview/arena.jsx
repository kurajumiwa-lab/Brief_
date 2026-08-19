const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/src/App.tsx','utf8');
const code=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
// The compliance gate is fetched, not hardcoded. Serve the same shape the
// server returns so the suite tests the real rendering path.
const ARENA_MONEY_OFF = {
  enabled: false,
  unmet: ['gaming_licence','age_verification','kyc','payment_rail','responsible_gaming'],
  requirements: [
    { id:'gaming_licence', label:'Gambling/gaming licence (BCLB or equivalent)', met:false, detail:'not set' },
    { id:'age_verification', label:'Verified 18+ age checks on participants', met:false, detail:'none' },
    { id:'kyc', label:'Identity verification for payouts', met:false, detail:'none' },
    { id:'payment_rail', label:'Licensed payment provider able to hold and disburse stakes', met:false, detail:'none' },
    { id:'responsible_gaming', label:'Deposit limits, self-exclusion and problem-gambling referral', met:false, detail:'not implemented' }
  ],
  reason: 'Real-money contests are unavailable: ... Free and ranked matches are unaffected.'
};
global.fetch = async (url) => {
  const path = String(url);
  const send = (b) => ({ ok:true, status:200, text:async()=>JSON.stringify(b), json:async()=>b });
  if (path.includes('/api/arena/status')) return send({ arenaMoney: ARENA_MONEY_OFF });
  // The real Arena is server-backed now: challenges come from these routes.
  if (path.includes('/api/arena/games')) return send({ games: [
    { id:'efootball', name:'eFootball', platform:'mobile' },
    { id:'fc_mobile', name:'FC Mobile', platform:'mobile' },
    { id:'pubg_mobile', name:'PUBG Mobile', platform:'mobile' },
    { id:'cod_mobile', name:'COD Mobile', platform:'mobile' },
    { id:'other', name:'Other', platform:'any' }
  ], activity: {} });
  if (path.includes('/api/arena/challenges/') && path.endsWith('/accept')) {
    return send({ challenge: { id:'chl_real', status:'accepted' }, match: { id:'mtch_real', status:'scheduled' }, reused:false });
  }
  if (path.includes('/api/arena/challenges')) {
    return send({ challenges: [
      { id:'chl_nyabs_1', gameId:'efootball', mode:'1v1', createdBy:'ply_nyabs', stake:'entry_fee', entryFeeKes:100, openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:00:00Z' },
      { id:'chl_mike_1', gameId:'efootball', mode:'1v1', createdBy:'ply_mike', stake:'friendly', openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:10:00Z' },
      { id:'chl_kip_1', gameId:'efootball', mode:'2v2', createdBy:'ply_kip', stake:'ranked', openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:20:00Z' },
      { id:'chl_jay_1', gameId:'efootball', mode:'1v1', createdBy:'ply_jay', stake:'friendly', openUntil:'2099-01-01T00:00:00Z', status:'open', createdAt:'2026-08-15T09:30:00Z' }
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

  console.log('=== Arena is its own world, not a gaming feed ===');
  await click(btn('Play'));
  let b=body();
  check('Arena tab opens', b.includes('Arena')&&b.includes('Live lobby'));
  check('no social feed mechanics', !/\b(likes?|comments?|followers?|streak|leaderboard)\b/i.test(b));
  check('says it is not a feed', /Not a feed/i.test(b));

  console.log('\n=== Game-agnostic, not an eFootball clone ===');
  check('eFootball present', b.includes('eFootball'));
  check('FC Mobile present', b.includes('FC Mobile'));
  check('PUBG present', b.includes('PUBG'));
  check('COD present', b.includes('COD'));
  check('Other present', b.includes('Other'));

  console.log('\n=== Live lobby shows real open challenges ===');
  check('Nyabs listed', b.includes('Nyabs'));
  check('entry fee shown', b.includes('KES 100'));
  check('friendly labelled distinctly', b.includes('Friendly'));
  check('ranked labelled distinctly', b.includes('Ranked'));
  check('2v2 partner request', b.includes('2v2'));

  console.log('\n=== Switching game changes the lobby ===');
  await click(btn('PUBG'));
  b=body();
  check('no eFootball challenges under PUBG', !b.includes('KES 100'));
  check('honest empty state', /No open challenges for PUBG/i.test(b));
  await click(btn('eFootball'));

  console.log('\n=== Accepting a challenge creates a match ===');
  check('own challenge is not acceptable', /Your challenge/i.test(body()));
  const accept=Array.from(document.querySelectorAll('button')).find(x=>text(x)==='Accept');
  await click(accept);
  b=body();
  check('match record created', b.includes('Your matches'));
  check('result NOT invented', /Result not confirmed by both players/i.test(b));

  console.log('\n=== Account trading boundary ===');
  b=body();
  check('account listing refused', /Not available in Arena/i.test(b));
  check('states the reason', /does not permit account transfers/i.test(b));
  check('refused listing hides its price', !b.includes('8000'));
  check('legitimate listings still allowed', /cup entry/i.test(b) && /coaching/i.test(b));

  console.log('\n=== Player card: per-game identity, honest stats ===');
  const jay=Array.from(document.querySelectorAll('button')).find(x=>text(x)==='Jay');
  if(jay){await click(jay);b=body();
    check('player card opens', b.includes('Rating'));
    check('shows gamer tag not Brief account', b.includes('JayZeroSix'));
    check('win rate computed', b.includes('68.9%')||b.includes('%'));
  } else {check('player card opens',false,'no Jay button');check('shows gamer tag',false);check('win rate',false);}

  console.log('\n=== Venues: real places, honest fields ===');
  await click(btn('Back to Arena'));
  b=body();
  check('Nearby section present', b.includes('Nearby'));
  check('venue listed', b.includes('GameHub Kilimani'));
  check('distance shown', b.includes('1.2 km'));
  check('stations shown', /3 of 8 stations free/i.test(b));
  check('price shown', b.includes('KES 150'));
  check('event tonight shown', /16-player cup/i.test(b));
  check('sparse venue omits unknown fields', b.includes('Corner Play Ngara'));
  const ngara=b.slice(b.indexOf('Corner Play Ngara'), b.indexOf('Corner Play Ngara')+180);
  check('sparse venue invents no price/hours', !/KES \d+\/hr/.test(ngara)&&!/open until/.test(ngara), ngara.slice(0,90));

  console.log('\n=== The mark is dynamic, not decorative ===');
  const svgs=Array.from(document.querySelectorAll('svg[role="img"]'));
  check('glyphs rendered as inline SVG', svgs.length>0);
  const labels=svgs.map(x=>x.getAttribute('aria-label')||'');
  check('glyph reports live count for busy venue', labels.some(l=>/^3 playing eFootball at GameHub/i.test(l)), labels.join(' | ').slice(0,140));
  check('glyph reports zero for empty venue', labels.some(l=>/^0 playing eFootball at Pixel Lounge/i.test(l)));
  const busy=svgs.find(x=>/GameHub/i.test(x.getAttribute('aria-label')||''));
  const idle=svgs.find(x=>/Pixel Lounge/i.test(x.getAttribute('aria-label')||''));
  const arc=el=>Array.from(el.querySelectorAll('circle')).map(c=>c.getAttribute('stroke-dasharray')||'').join(',');
  check('busy venue draws a live arc', /[1-9]/.test(arc(busy)));
  check('empty venue draws no live arc', !/^\s*$/.test(arc(idle)) ? /2 4/.test(arc(idle)) : false);
  check('empty venue glyph is muted', (idle.innerHTML||'').includes('#48484A'));
  check('game chip carries live count', /eFootball \(\d+\)/.test(b));

  console.log('\n=== Switching game re-reads the venue counts ===');
  await click(btn('COD'));
  b=body();
  const codLabels=Array.from(document.querySelectorAll('svg[role="img"]')).map(x=>x.getAttribute('aria-label')||'');
  check('COD count differs from eFootball', codLabels.some(l=>/^1 playing Call of Duty Mobile at GameHub/i.test(l)), codLabels.join(' | ').slice(0,140));
  check('venue without COD is dropped', !b.includes('Corner Play Ngara'));
  await click(btn('eFootball'));

  console.log('\n=== No fabricated publisher branding ===');
  check('no trademarked logo files referenced', !/konami|logo\.(png|svg|jpg)|brandfetch|seeklogo/i.test(code));
  check('glyphs are Brief-drawn SVG', /GameGlyphShape/.test(code));

  console.log('\n=== No gambling framing in v1 ===');
  check('no betting language', !/\b(bet|betting|odds|wager|stake your|payout)\b/i.test(body()));

  console.log('\n=== Source guards ===');
  check('GameIdentity separate from Brief account', /interface GameIdentity/.test(code)&&/playerId: string/.test(code));
  check('transfer policy is a closed union', /officially_transferable/.test(code)&&/not_supported/.test(code));
  check('canListInArena gates account sales', /canListInArena/.test(code));
  check('reuses ObjectRelationship, no second graph', /edges: ObjectRelationship\[\]/.test(code));
  check('verified never defaulted true', !/verified: true,?\s*\n\s*\}/.test(code.split('ARENA_IDENTITIES')[0]));
  check('group->arena bridge keeps source', /detectMatchRequest/.test(code)&&/source\?: SourceReference/.test(code));


  console.log('\n=== Real money is gated, and the reason is stated ===');
  await click(btn('Play'));
  b=body();
  check('Arena states Brief does not handle match money', /does not handle match money/i.test(b));
  check('entry fees are named as player-to-player', /between players/i.test(b));
  check('no winnings claim', /pays out no winnings/i.test(b));
  check('the missing licence is named', /licence/i.test(b));
  check('age verification named', /18\+/.test(b));
  check('KYC named', /Identity verification/i.test(b));
  check('payment rail named', /payment provider/i.test(b));
  check('responsible gaming named', /self-exclusion/i.test(b));
  // The failure mode this replaces.
  check('does NOT say coming soon', !/coming soon/i.test(b));
  check('no wallet balance is shown in Arena', !/wallet|balance/i.test(b));
  check('no deposit or top-up affordance', !Array.from(document.querySelectorAll('button')).some(x=>/deposit|top ?up|withdraw/i.test(text(x))));
  // Free play is a real product and must remain usable.
  check('friendly matches still available', /Friendly/.test(b));
  check('challenge buttons still work', Boolean(btn('Challenge')));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
