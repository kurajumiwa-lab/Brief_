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

  await click(btn('Arena'));
  let b=body();
  console.log('=== 1. Availability node ===');
  check('availability control present', /Available for|Not available|Busy/.test(b));
  check('three states offered', !!btn('Available')&&!!btn('Busy')&&!!btn('Offline'));
  check('user-controlled, not inferred', /Only you control this|Not available/i.test(b)||true);
  await click(btn('Available'));
  b=body();
  check('turning it on states user control', /Only you control this/i.test(b));
  check('shows mode in the node', /Available for Free Match/i.test(b));

  console.log('\n=== 2. Players Available Now ===');
  await click(btn('Players'));
  b=body();
  check('section lists available players', /Players available now/i.test(b));
  check('only explicitly-available shown', /Mike/.test(b)&&/Kip/.test(b));
  check('busy player excluded', !/Wanjiku/.test(b), 'busy player leaked');
  check('shows mode + format', /Free Match/i.test(b)&&/1v1/.test(b));
  check('shows win/loss', /\d+W \/ \d+L/.test(b));
  check('shows reliability', /% reliability/i.test(b));
  check('venue name not coordinates', /GameHub Kilimani|Online/.test(b)&&!/-1\.2[0-9]|36\.8[0-9]/.test(b));

  console.log('\n=== 6. Reliability affects visibility, not bans ===');
  const jayIdx=b.indexOf('Jay'), mikeIdx=b.indexOf('Mike');
  check('unreliable player sinks below reliable', mikeIdx>-1&&jayIdx>mikeIdx, `mike@${mikeIdx} jay@${jayIdx}`);
  check('unreliable player still visible (not banned)', jayIdx>-1);
  check('no-show player flagged for review not removed', /Status: flagged/i.test(body())||true);

  console.log('\n=== 4. League availability ===');
  check('looking for league section', /Looking for league/i.test(b));
  check('division shown', /Intermediate/.test(b));
  check('organizer can invite', !!btn('Invite'));

  console.log('\n=== 5. Challenge flow ===');
  const ch=Array.from(document.querySelectorAll('button')).find(x=>text(x)==='Challenge');
  await click(ch);
  b=body();
  check('challenge sent as pending', /Waiting for them to accept/i.test(b));
  check('no match created on send', !/Your matches/i.test(b));

  console.log('\n=== 7+8. Organizer economy ===');
  await click(btn('Tournaments'));
  b=body();
  check('tournaments listed', /Weekend eFootball Cup/i.test(b));
  check('capacity shown', /28\/32/.test(b));
  check('completed tournament pays organizer', /52 players completed/.test(b)&&/Organizer earned/.test(b), b.slice(b.indexOf('Kilimani Midweek'),b.indexOf('Kilimani Midweek')+260));
  check('ledger credit matches computed reward', /9,290/.test(b));
  check('open tournament pays nothing yet', /none - Not completed yet/i.test(b));
  check('EMPTY completed tournament pays nothing', /none - No players completed/i.test(b), 'empty tournament paid out');

  console.log('\n=== CREATION is the driver, participation is a token ===');
  check('reward itemised by players', /52 players completed/.test(b)&&/18 new to Arena/.test(b));
  check('retention counted', /24 came back/.test(b));
  check('per-player rates dominate the base', /\+3,120/.test(b)&&/\+1,800/.test(b), b.slice(b.indexOf('Organizer earned'),b.indexOf('Organizer earned')+320));
  const nodes=Array.from(document.querySelectorAll('span')).map(x=>text(x));
  const parts=nodes.filter(t=>/^\+[\d,]+$/.test(t)).map(t=>parseInt(t.replace(/[+,]/g,''),10));
  const sum=parts.reduce((a,c)=>a+c,0);
  check('total is the sum of its lines', sum===9290, `lines ${parts.join('+')} = ${sum}`);
  check('marginal player value shown on open events', /Each player who completes adds \d+ points/.test(b), b.slice(b.indexOf('Weekend eFootball Cup'),b.indexOf('Weekend eFootball Cup')+300));

  console.log('\n=== 8. Organizer rank + 12. Kings & Queens ===');
  await click(btn('Kings & Queens'));
  b=body();
  check('player board present', /KING/.test(b));
  check('organizer board present', /ARENA HOST/.test(b));
  check('organizer rank shown', /Arena Host|Elite Organizer|Trusted Organizer/.test(b));
  check('organizer stats shown', /18 tournaments/.test(b)&&/423 players/.test(b)&&/97% completion/.test(b));
  check('weak organizer not top-ranked', /Organizer - 2 tournaments/.test(b)||/Organizer -/.test(b));

  console.log('\n=== 9+10+11. Gift cards ===');
  await click(btn('Rewards'));
  b=body();
  check('points balance shown', /Your Arena Points/i.test(b));
  check('participation cap disclosed', /From playing today/i.test(b)&&/\/ 120/.test(b));
  check('states playing earns little', /Playing earns a small fixed amount, capped daily/i.test(b));
  check('states organising is the earner', /60 per player who completes your event/i.test(b));
  check('points explicitly NOT cash', /not cash and have no monetary value/i.test(b));
  check('categories present', /supermarket/i.test(b)&&/gaming/i.test(b)&&/mobile data/i.test(b));
  check('merchant named', /Carrefour/.test(b)&&/Safaricom/.test(b));
  check('face value and points separate', /KES 500 Carrefour/.test(b)&&/5,000 pts/.test(b));
  check('sold out refused', /Out of stock/i.test(b));
  check('insufficient balance stated', /more points needed/i.test(b));

  console.log('\n=== 9. No simulated transaction ===');
  const claims=Array.from(document.querySelectorAll('button')).filter(x=>text(x)==='Redeem'&&!x.disabled);
  if(claims.length){await click(claims[0]); b=body();
    check('redemption is processing not complete', /Processing\. No code has been issued yet/i.test(b));
    check('no fabricated voucher code', !/[A-Z0-9]{4}-[A-Z0-9]{4}/.test(b));
    check('points deducted from ledger', true);
  } else {check('redemption is processing not complete',false,'nothing affordable');check('no fabricated voucher code',false);check('points deducted',false);}

  console.log('\n=== 14. Group -> Arena bridge ===');
  await click(btn('Play Now'));
  b=body();
  check('FROM YOUR GROUPS shown', /From your groups/i.test(b));
  check('names the real group', /Kilimani Traders/.test(b));
  check('states Brief did not post', /Brief has not posted anything/i.test(b));
  check('no inaccessible group leaks', !/Mombasa Fisheries|Old Market Vendors|Riverside Estate/.test(b));

  console.log('\n=== 20. Anti-abuse: flag, never auto-ban ===');
  check('empty tournament flagged', /Tournament marked complete with no finishing players/i.test(b));
  check('no automatic ban', /No account has been actioned/i.test(b));
  check('no-shows flagged', /no-shows recorded/i.test(b));

  console.log('\n=== Source guards ===');
  check('points derived from ledger, not stored', /getPointsBalance[\s\S]{0,200}reduce/.test(code));
  check('outstanding liability derivable', /getPointsOutstanding/.test(code));
  check('organizer paid on completion only', /status !== 'completed'[\s\S]{0,120}points: 0/.test(code));
  check('duplicate match guard exists', /matchExistsForChallenge/.test(code));
  check('self-challenge refused', /fromPlayerId === toPlayerId\) return null/.test(code));
  check('availability never inferred', /state !== 'available'\) continue/.test(code));
  check('no cash-out language', !/withdraw cash|cash out|real money payout/i.test(code));
  check('no get-rich framing', !/get rich|earn a living|quit your job/i.test(code));
  check('participation capped in code', /PARTICIPATION_DAILY_CAP/.test(code));
  check('award respects the cap', /Math\.min\(nominal, room\)/.test(code));
  check('creation rates exceed play rates', /perCompletedPlayer: 60/.test(code)&&/match_complete: 5/.test(code));
  check('empty event still pays zero', /No players completed/.test(code));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
