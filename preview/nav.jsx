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
  // Secondary controls live outside the primary navs; scope to them so a
  // destination name that also exists as a section (Arena) is unambiguous.
  const sub=t=>Array.from(document.querySelectorAll('button'))
    .filter(b=>!b.closest('nav[aria-label="Primary"]'))
    .find(b=>text(b)===t||text(b).startsWith(t));
  const goto=async(d,s)=>{const x=btn(d); if(x) await click(x); if(s){const y=sub(s)||btn(s); if(y) await click(y);} };
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  // The nav bar is the first row of buttons under the header.
  const navLabels=()=>Array.from(document.querySelectorAll('button'))
    .map(b=>text(b))
    .filter(t=>/^(Nearby|Arena|My Layer|Workflows|Intelligence|Tea|Today|Pursuits|Quests|Group|Inbox|Sources)/.test(t));

  console.log('=== Five doors, not twelve ===');
  const top=['Nearby','Arena','My Layer','Workflows','Pulse'];
  for(const t of top) check(`${t} is a destination`, !!btn(t));
  const strays=['Tea','Today','Sources','Inbox','Group','Quests','Pursuits'];
  // These must NOT be top-level: they may appear as sub-sections only.
  await click(btn('Pulse'));
  const introBody=body();
  for(const t of strays){
    check(`${t} is not a top-level tab`, !new RegExp(`^${t}`).test(introBody.slice(0,400)), t);
  }

  console.log('\n=== Every destination answers one question ===');
  await click(btn('Nearby'));
  check('Nearby = discovery', /Everything Happening Around You/i.test(body()));
  await click(btn('Arena'));
  check('Arena = play/compete', /Players looking for a game/i.test(body()));
  await click(btn('My Layer'));
  check('My Layer = personal', /Your Layer|Things you.ve kept/i.test(body()));
  await click(btn('Workflows'));
  check('Workflows = actions', /Things you can actually do/i.test(body()));
  await click(btn('Pulse'));
  check('Pulse = insight', /What.s changing around you/i.test(body()));

  console.log('\n=== Nearby holds discovery sections ===');
  await click(btn('Nearby'));
  for(const s of ['Everything','Tea','Today','Pursuits','Quests'])
    check(`Nearby > ${s}`, !!btn(s));
  await goto('Nearby','Tea');
  check('Tea content preserved', /What Nairobi is talking about|Morning|Evening/i.test(body()));
  await goto('Nearby','Quests');
  check('Quests content preserved', /Open quests/i.test(body()));

  console.log('\n=== My Layer absorbs personal content ===');
  await click(btn('My Layer'));
  for(const s of ['Saved','Activity','Arena','Points','Groups'])
    check(`My Layer > ${s}`, !!sub(s));
  await goto('My Layer','Groups');
  check('Groups preserved', /Your Groups/i.test(body()));
  await goto('My Layer','Activity');
  check('Activity uses real relationships', /My Activity/i.test(body())&&/saved|watched/i.test(body()));
  await goto('My Layer','Arena');
  check('My Layer > Arena keeps match history', /My Matches/i.test(body()));
  check('My Layer > Arena shows rank and points', /Rank/i.test(body())&&/Arena Points/i.test(body()));
  await goto('My Layer','Points');
  check('both currencies shown separately', /Brief Points/i.test(body())&&/Arena Points/i.test(body()));
  check('points not summed into one total', !/Total points/i.test(body()));

  console.log('\n=== Workflows holds operational tools ===');
  await click(btn('Workflows'));
  for(const s of ['Active','Completed','Inbox','Sources']) check(`Workflows > ${s}`, !!sub(s));
  await goto('Workflows','Active');
  check('Active journeys keep steps + progress', /Register|Steps|Progress|Hygiene/i.test(body()));
  await goto('Workflows','Completed');
  check('Completed is a real filter, not a new screen', /Completed|Nothing finished/i.test(body()));
  await goto('Workflows','Sources');
  check('Sources preserved', /A channel is not the information/i.test(body()));
  await goto('Workflows','Inbox');
  check('Inbox preserved', /Inbox/i.test(body()));

  console.log('\n=== No duplicate rooms ===');
  await goto('Nearby','Quests');
  check('rewards not duplicated in Quests', !/Carrefour/.test(body()));
  check('Quests points to Arena', /Redeem points for gift cards and vouchers in Arena/i.test(body()));
  await goto('Arena','Rewards');
  check('Arena is the single redemption surface', /Carrefour/.test(body()));

  console.log('\n=== Returning to a tab resets to its main section ===');
  await goto('Nearby','Pursuits');
  await click(btn('Arena'));
  await click(btn('Nearby'));
  check('Nearby returns to Everything', /Everything Happening Around You/i.test(body()));

  console.log('\n=== Availability is state, not navigation ===');
  await click(btn('Arena'));
  const arenaTop=body().slice(0,300);
  check('Available/Busy/Offline not in nav row', !/^(Available|Busy|Offline)/.test(arenaTop));
  check('availability still works inside Arena', !!btn('Available'));

  console.log('\n=== Persistent rail + mobile bar ===');
  const navs=Array.from(document.querySelectorAll('nav[aria-label="Primary"]'));
  check('two primary navs (rail + bottom bar)', navs.length===2, `found ${navs.length}`);
  const rail=navs.find(n=>(n.className||'').includes('md:flex'));
  const bar=navs.find(n=>(n.className||'').includes('md:hidden'));
  check('rail hidden on mobile widths', !!rail && rail.className.includes('hidden'));
  check('rail is sticky and full height', !!rail && /sticky/.test(rail.className));
  check('bottom bar fixed to viewport bottom', !!bar && /fixed/.test(bar.className)&&/bottom-0/.test(bar.className));
  check('rail has exactly 5 doors', !!rail && rail.querySelectorAll('button').length===5, rail?String(rail.querySelectorAll('button').length):'no rail');
  check('bar has exactly 5 doors', !!bar && bar.querySelectorAll('button').length===5);

  console.log('\n=== Both navs stay in sync ===');
  const railBtns=()=>Array.from(rail.querySelectorAll('button'));
  const barBtns=()=>Array.from(bar.querySelectorAll('button'));
  await click(barBtns()[1]);
  check('tapping bottom bar changes destination', /Players looking for a game/i.test(body()));
  check('rail reflects the same active item', railBtns()[1].getAttribute('aria-current')==='page');
  check('bar reflects the same active item', barBtns()[1].getAttribute('aria-current')==='page');
  await click(railBtns()[0]);
  check('clicking rail changes destination', /Everything Happening Around You/i.test(body()));
  check('bar follows the rail', barBtns()[0].getAttribute('aria-current')==='page');
  check('only one item is current at a time', railBtns().filter(b=>b.getAttribute('aria-current')==='page').length===1);

  console.log('\n=== Icons carry labels, not decoration alone ===');
  check('every rail item has an icon', rail.querySelectorAll('svg').length>=5);
  check('every rail item has a text label', railBtns().every(b=>text(b).length>0));
  check('bar uses short label for My Layer', barBtns().some(b=>text(b)==='Mine'));
  check('rail uses the full label', railBtns().some(b=>text(b).startsWith('My Layer')));
  check('each door has a hint for hover', railBtns().every(b=>(b.getAttribute('title')||'').length>0));

  console.log('\n=== Pulse, not Intelligence ===');
  check('Pulse is the label', !!btn('Pulse'));
  check('no Intelligence in navigation', !railBtns().some(b=>/Intelligence/.test(text(b))));
  await click(btn('Pulse'));
  check('Pulse body says Pulse', /Pulse/.test(body()));
  check('no AI department framing', !/AI Intelligence|Intelligence Department|AI Insights/i.test(body()));

  console.log('\n=== Secondary nav still nested, not promoted ===');
  await click(btn('Arena'));
  check('Arena secondary sections present', !!btn('Play Now')&&!!btn('Challenges')&&!!btn('Tournaments'));
  check('Arena sections are not in the rail', !railBtns().some(b=>/Tournaments|Challenges/.test(text(b))));

  console.log('\n=== Pulse secondary: Now | Local | Groups | Signals ===');
  await click(btn('Pulse'));
  for(const s of ['Now','Local','Groups','Signals']) check(`Pulse > ${s}`, !!sub(s));
  check('Pulse secondary is not in the rail', !railBtns().some(b=>/Signals|Local/.test(text(b))));
  await goto('Pulse','Now');
  // Brief no longer ships seeded posts, so with no ingested reports the
  // honest state is the empty message -- not a fabricated bulletin.
  check('Now states plainly that nothing has been reported',
    /Nothing new has been reported yet today/i.test(body()));
  await goto('Pulse','Signals');
  check('Signals keeps freshness metrics', /Freshness/i.test(body()));
  check('Signals explains freshness without AI framing', !/\bAI\b|assistant|chatbot|machine learning/i.test(body()));
  await goto('Pulse','Groups');
  check('Pulse groups are the user\'s own', /Brief has\s+not posted anything|only reads groups you/i.test(body()));
  check('Pulse never claims to have joined a group', !/we joined|auto-joined|Brief joined/i.test(body()));

  console.log('\n=== Arena entry point shows availability ===');
  await click(btn('Arena'));
  check('availability node at Arena entry', /players? available now/i.test(body()));
  check('Find Match action present', !!sub('Find Match'));
  check('availability is not a nav item', !railBtns().some(b=>/Available|Busy|Offline/.test(text(b))));

  console.log('\n=== Active state does not rely on colour alone ===');
  await click(btn('Nearby'));
  const cur=railBtns().find(b=>b.getAttribute('aria-current')==='page');
  check('active item is machine-readable', !!cur);
  check('active item has a non-colour marker', !!cur && /bg-\[#102117\]|font-extrabold/.test(cur.className));
  check('active item renders an edge indicator', !!cur && cur.querySelectorAll('span').length>=1);

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
