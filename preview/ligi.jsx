const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true });
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;

// ---------------------------------------------------------------------------
// LIGI — the African fantasy football screen.
//
// What this suite is really checking: that the screen REPORTS a game the
// server runs, and never runs it itself. So it asserts there is no button that
// sets a line or settles a week, that the cash slot prints its refusal instead
// of hiding, and that an empty table says why it is empty.
// ---------------------------------------------------------------------------

const KICKOFF = new Date(Date.now() + 2*24*60*60*1000).toISOString();

const LINES = [
  { playerId:'fply_1', name:'Michael Olunga', position:'FWD', club:'Gor Mahia', line:6.5, basis:'median_of_3', history:[9,6,4] },
  { playerId:'fply_2', name:'Ayub Timbe',     position:'MID', club:'Tusker',    line:4.5, basis:'position_baseline', history:[] },
  { playerId:'fply_3', name:'Ian Otieno',     position:'GK',  club:'Bandari',   line:2.5, basis:'position_baseline', history:[] }
];

const OVERVIEW = {
  game: { id:'ligi', name:'Ligi', tagline:'Fantasy football over African leagues.', priority:true },
  leagues: [
    { id:'caf_cl', name:'CAF Champions League', country:'Africa', tier:'continental' },
    { id:'ke_fkf_pl', name:'FKF Premier League', country:'Kenya', tier:'domestic' },
    { id:'ng_npfl', name:'Nigeria Premier Football League', country:'Nigeria', tier:'domestic' },
    { id:'za_psl', name:'DStv Premiership', country:'South Africa', tier:'domestic' },
    { id:'eg_pl', name:'Egyptian Premier League', country:'Egypt', tier:'domestic' }
  ],
  rules: { house: {
    weeklyUnits:100, rollover:false, modes:['over_under','spread','confidence'],
    payout:{}, spreadHandicapStep:0.5, baselineLine:{GK:2.5,DEF:3.5,MID:4.5,FWD:4.5},
    lineHistoryWindow:5, streakWinRule:'a week counts as won when your net units are positive and your eleven matched the median',
    unitsAreNotMoney:true
  }, squad:{}, scoring:{} },
  slots: [
    { id:'free', label:'Free seat', stakeKind:'units', available:true, detail:'100 staking units a week. No cash value, no rollover.' },
    { id:'cash', label:'Cash seat', stakeKind:'cash', available:false, priceKes:500,
      detail:'Refused until this deployment is licensed.',
      compliance:{ enabled:false, unmet:['Gaming licence','Age verification','KYC','Payment rail','Responsible gaming'],
        requirements:[
          { id:'licence', label:'Gaming licence (BCLB)', met:false, detail:'not held' },
          { id:'age', label:'Age verification', met:false, detail:'no provider' },
          { id:'kyc', label:'KYC on payouts', met:false, detail:'no provider' },
          { id:'rail', label:'Licensed payment rail', met:false, detail:'not configured' },
          { id:'rg', label:'Responsible gaming controls', met:false, detail:'not built' }
        ] } }
  ],
  season: { id:'lgs_1', leagueId:'ke_fkf_pl', leagueName:'FKF Premier League', country:'Kenya',
    name:'FKF Premier League · Season 1', startsAt:KICKOFF, endsAt:KICKOFF, gameweekCount:10,
    cashSlotPriceKes:500, status:'running' },
  seasons: [],
  gameweek: {
    gameweek: { id:'lgw_1', seasonId:'lgs_1', competitionId:'fcmp_1', index:3,
      opensAt:KICKOFF, kickoffAt:KICKOFF, resultsDueAt:KICKOFF, status:'open', houseLines:LINES, settledAt:null },
    locked:false,
    pool:[
      { id:'fply_1', name:'Michael Olunga', position:'FWD', club:'Gor Mahia', price:0 },
      { id:'fply_2', name:'Ayub Timbe', position:'MID', club:'Tusker', price:0 },
      { id:'fply_3', name:'Ian Otieno', position:'GK', club:'Bandari', price:0 }
    ],
    houseLines: LINES,
    readiness: { ready:false, needed:3, missing:3, reason:'match stats for 3 of 3 players have not arrived' },
    entryCount: 7,
    me: null
  },
  table: [],
  streaks: []
};

let entered = false;

global.fetch = async (url, init) => {
  const path = String(url);
  const method = String(init?.method ?? 'GET').toUpperCase();
  const send = (b) => ({ ok:true, status:200, text:async()=>JSON.stringify(b), json:async()=>b });
  const deny = (s,b) => ({ ok:false, status:s, text:async()=>JSON.stringify(b), json:async()=>b });

  if (path.includes('/api/ligi/gameweeks/') && path.endsWith('/enter') && method==='POST') {
    const slot = JSON.parse(init.body||'{}').slot;
    // The gate is the product working correctly. It must reach the screen.
    if (slot === 'cash') return deny(403, {
      error:'real-money entry is not available in this deployment',
      requirements: OVERVIEW.slots[1].compliance.requirements
    });
    entered = true;
    return send({ created:true, entry:{ id:'lge_1', gameweekId:'lgw_1', userId:'u1', slot:'free',
      stakeKind:'units', unitsBankroll:100, teamPoints:null, unitsStaked:0, unitsReturned:null,
      netUnits:null, won:null, settledAt:null } });
  }
  if (path.includes('/api/ligi')) {
    const view = JSON.parse(JSON.stringify(OVERVIEW));
    if (entered) {
      view.gameweek.me = {
        entry:{ id:'lge_1', gameweekId:'lgw_1', userId:'u1', slot:'free', stakeKind:'units',
          unitsBankroll:100, teamPoints:null, unitsStaked:0, unitsReturned:null, netUnits:null, won:null, settledAt:null },
        team:null, wagers:[], unitsRemaining:100
      };
    }
    return send(view);
  }
  if (path.includes('/api/arena/status')) return send({ arenaMoney:{ enabled:false, requirements:[] } });
  if (path.includes('/api/arena/games')) return send({ games:[{ id:'efootball', name:'eFootball', platform:'mobile' }], activity:{} });
  return { ok:false, status:404, text:async()=>'{}', json:async()=>({}) };
};

async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});
    await act(async()=>{await new Promise(r=>setTimeout(r,0));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  console.log('=== Ligi has PRIORITY LISTING on the shelf ===');
  const cards=Array.from(document.querySelectorAll('[data-shelf-id]'));
  check('the shelf rendered', cards.length>0, String(cards.length));
  check('LIGI IS THE FIRST CARD ON THE SHELF', cards[0]?.getAttribute('data-shelf-id')==='ligi',
    cards[0]?.getAttribute('data-shelf-id')||'none');
  check('the card says it is African football', /African/i.test(text(cards[0]||document.createElement('div'))));
  check('the card says it is free to play', /free/i.test(text(cards[0]||document.createElement('div'))));

  console.log('\n=== The shelf card opens Ligi, not the Arena lobby ===');
  await click(cards[0]);
  let b=body();
  check('the Ligi screen opened', /Ligi/.test(b) && /African fantasy football/i.test(b));
  check('the league is a real African competition', /FKF Premier League/.test(b));

  console.log('\n=== It reports a game that runs itself ===');
  check('the automation is stated', /open, lock, price and settle on their own/i.test(b));
  check('NO BUTTON SETS A LINE', !Array.from(document.querySelectorAll('button')).some(x=>/set (the )?line/i.test(text(x))));
  check('NO BUTTON SETTLES A WEEK', !Array.from(document.querySelectorAll('button')).some(x=>/^settle/i.test(text(x))));
  check('the gameweek number is the server\'s', /3 of 10/.test(b));
  check('missing results are counted, not guessed', /3 missing/.test(b));

  console.log('\n=== Two slots, both stated honestly ===');
  const free=document.querySelector('[data-slot="free"]');
  const cash=document.querySelector('[data-slot="cash"]');
  check('the free slot is offered', Boolean(free) && /100 staking units/.test(text(free)));
  check('the free slot says units are not cash', /no cash value/i.test(text(free)));
  check('the cash slot is LISTED, not hidden', Boolean(cash));
  check('the cash slot is marked refused', /Refused/i.test(text(cash||document.createElement('div'))));
  check('the cash slot names the licence it lacks', /Gaming licence/i.test(text(cash||document.createElement('div'))));
  check('the cash price is a statement, not a charge', /KES 500/.test(text(cash||document.createElement('div'))));

  console.log('\n=== Taking the cash seat prints the server\'s refusal ===');
  const cashBtn=Array.from(document.querySelectorAll('[data-slot="cash"] button'))[0];
  check('there is a cash seat button to try', Boolean(cashBtn));
  if (cashBtn) await click(cashBtn);
  b=body();
  check('THE REFUSAL IS SHOWN TO THE USER', /cannot take a cash stake/i.test(b));
  check('the refusal lists the unmet requirements', /Age verification/.test(b) && /Responsible gaming/i.test(b));

  console.log('\n=== The free seat works and opens the game ===');
  const freeBtn=Array.from(document.querySelectorAll('[data-slot="free"] button'))[0];
  if (freeBtn) await click(freeBtn);
  b=body();
  check('a seat gives a squad picker', /Your eleven/.test(b));
  check('the house line is shown with its basis', /median of 3/i.test(b) || /position baseline/i.test(b));
  check('the derived line is printed', /6\.5/.test(b));
  check('the weekly bankroll is shown', /100 units left/.test(b));
  check('over and under are both offered', Boolean(btn('Over')) && Boolean(btn('Under')));
  check('the confidence stack is offered', Boolean(btn('Confidence stack')));

  console.log('\n=== Both ladders exist, and empty is explained ===');
  check('a season ladder tab exists', Boolean(btn('Season')));
  check('a week-streak ladder tab exists', Boolean(btn('Week streaks')));
  check('an empty table says why it is empty', /No week has settled yet/.test(b));
  await click(btn('Week streaks'));
  b=body();
  check('the streak rule is published on the empty state', /net units are positive/.test(b));

  console.log('\n=== Nothing pretends to be money ===');
  const ligiText = text(document.querySelector('[data-testid="ligi"]') || document.createElement('div'));
  check('units are called what they are', /Units are a scoring device/.test(ligiText));
  check('THE GAME ITSELF CLAIMS NO PAYOUT', !/withdraw|cash out|winnings/i.test(ligiText));
  check('and it says why real money is refused', /until this deployment holds a gaming licence/i.test(ligiText));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
