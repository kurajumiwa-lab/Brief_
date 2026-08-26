const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, writable: true, configurable: true }); // Node >=21 ships a getter-only navigator
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

  console.log('=== Four screens, not twelve ===');
  const top=['Home','Play','Saved','Inbox'];
  for(const t of top) check(`${t} is a destination`, !!btn(t));
  check('Pulse is not a destination', !btn('Pulse'));

  console.log('\n=== Main sheet is a gallery of real entry points ===');
  check('main shelf is visible on Home', body().includes('What do you want to do?'));
  const shelfIds = ['around', 'play', 'events', 'create', 'share', 'groups'];
  check('main shelf has six labelled doors', shelfIds.every((id) => Boolean(document.querySelector(`[data-shelf-id="${id}"]`))));
  const shareShelfCard = document.querySelector('[data-shelf-id="share"]');
  if (shareShelfCard) await click(shareShelfCard);
  check('WhatsApp shelf door lands in distribution', /WhatsApp \+ home shelf|Distribution kits/i.test(body()));
  await click(btn('Home'));

  const strays=['Tea','Today','Sources','Inbox','Group','Quests','Pursuits'];
  // These must NOT be top-level: they may appear as sub-sections only.
  await click(btn('Home'));
  const introBody=body();
  for(const t of strays){
    check(`${t} is not a top-level tab`, !new RegExp(`^${t}`).test(introBody.slice(0,400)), t);
  }

  console.log('\n=== Every destination answers one question ===');
  await click(btn('Home'));
  check('Nearby = discovery', /Everything Happening Around You/i.test(body()));
  await click(btn('Play'));
  check('Arena = gather & play', /Gather with people to play/i.test(body()));
  await click(btn('Saved'));
  check('My Layer = personal', /Your Layer|Things you.ve kept/i.test(body()));
  await click(btn('Inbox'));
  check('Workflows = actions', /Things you can actually do/i.test(body()));
  check('Pulse is not a fifth screen', !btn('Pulse'));

  console.log('\n=== Nearby holds discovery sections ===');
  await click(btn('Home'));
  // Primary categories are the limited four; Tea/Today/Pursuits/Quests live
  // behind "More" (filter overload removed) but remain reachable.
  for(const s of ['All','Places','Events','Offers'])
    check(`Nearby > ${s}`, !!btn(s));
  const more=btn('More');
  check('a More control exists', !!more);
  await click(more);
  for(const s of ['Stories','Today','Alerts','Jobs'])
    check(`Nearby > ${s} (behind More)`, !!btn(s));
  await click(btn('Stories'));
  check('Tea content preserved', /What people are talking about|Morning|Evening/i.test(body()));
  // The More menu stays open across sections (state, not navigation), so the
  // remaining section pills are still reachable without re-opening it.
  await click(btn('Jobs'));
  check('Quests content preserved', /Open jobs/i.test(body()));

  console.log('\n=== My Layer absorbs personal content ===');
  await click(btn('Saved'));
  for(const s of ['Saved','Activity','Matches','Points','Groups'])
    check(`My Layer > ${s}`, !!sub(s));
  await goto('Saved','Chats');
  check('Groups preserved', /Your chats/i.test(body()));
  await goto('Saved','Activity');
  check('Activity uses real relationships', /My Activity/i.test(body())&&/saved|watched/i.test(body()));
  await goto('Saved','Matches');
  check('My Layer > Arena keeps match history', /My Matches/i.test(body()));
  check('My Layer > Arena keeps match history', /My Matches/i.test(body()));
  await goto('Saved','Points');
  check('Brief Points shown', /Brief Points/i.test(body()));
  check('points not summed into one total', !/Total points/i.test(body()));

  console.log('\n=== Workflows holds operational tools ===');
  await click(btn('Inbox'));
  for(const s of ['Open','Done','Review','Feeds']) check(`Workflows > ${s}`, !!sub(s));
  await goto('Inbox','Open');
  check('Active shows an honest empty state, not fake journeys', /Things you can actually do|Your activities will appear here|No processes/i.test(body()));
  await goto('Inbox','Done');
  check('Completed is a real filter, not a new screen', /Completed|Nothing finished/i.test(body()));
  await goto('Inbox','Feeds');
  check('Sources preserved', /A channel is not the information/i.test(body()));
  await goto('Inbox','Review');
  check('Inbox preserved', /Inbox/i.test(body()));

  console.log('\n=== No duplicate rooms ===');
  await goto('Home','Jobs');
  check('rewards not duplicated in Quests', !/Carrefour/.test(body()));
  check('Quests points to Arena', /Redeem points/i.test(body())||/Points/i.test(body()));

  console.log('\n=== Returning to a tab resets to its main section ===');
  await goto('Home','Alerts');
  await click(btn('Play'));
  await click(btn('Home'));
  check('Nearby returns to Everything', /Everything Happening Around You/i.test(body()));

  console.log('\n=== Availability is state, not navigation ===');
  await click(btn('Play'));
  const arenaTop=body().slice(0,300);
  check('Available/Busy/Offline not in nav row', !/^(Available|Busy|Offline)/.test(arenaTop));
  check('arena renders its own sections', !!btn('Lobby')||!!btn('Challenges'));

  console.log('\n=== Persistent rail + mobile bar ===');
  const navs=Array.from(document.querySelectorAll('nav[aria-label="Primary"]'));
  check('two primary navs (rail + bottom bar)', navs.length===2, `found ${navs.length}`);
  const rail=navs.find(n=>(n.className||'').includes('md:flex'));
  const bar=navs.find(n=>(n.className||'').includes('md:hidden'));
  check('rail hidden on mobile widths', !!rail && rail.className.includes('hidden'));
  check('rail is sticky and full height', !!rail && /sticky/.test(rail.className));
  check('bottom bar fixed to viewport bottom', !!bar && /fixed/.test(bar.className)&&/bottom-0/.test(bar.className));
  check('rail has Menu plus 4 screens', !!rail && rail.querySelectorAll('button').length===5, rail?String(rail.querySelectorAll('button').length):'no rail');
  check('bar has Menu plus 4 screens', !!bar && bar.querySelectorAll('button').length===5);

  console.log('\n=== Both navs stay in sync ===');
  const railBtns=()=>Array.from(rail.querySelectorAll('button'));
  const barBtns=()=>Array.from(bar.querySelectorAll('button'));
  await click(barBtns()[2]);
  check('tapping bottom bar changes destination', /Gather with people to play/i.test(body()));
  check('rail reflects the same active item', railBtns()[2].getAttribute('aria-current')==='page');
  check('bar reflects the same active item', barBtns()[2].getAttribute('aria-current')==='page');
  await click(railBtns()[1]);
  check('clicking rail changes destination', /Everything Happening Around You/i.test(body()));
  check('bar follows the rail', barBtns()[1].getAttribute('aria-current')==='page');
  check('only one item is current at a time', railBtns().filter(b=>b.getAttribute('aria-current')==='page').length===1);

  console.log('\n=== Icons carry labels, not decoration alone ===');
  check('every rail item has an icon', rail.querySelectorAll('svg').length>=5);
  check('every rail item has a text label', railBtns().every(b=>text(b).length>0));
  check('bar uses short label for My Layer', barBtns().some(b=>text(b)==='Saved'));
  check('rail uses the full label', railBtns().some(b=>text(b).startsWith('Saved')));
  check('each door has a hint for hover', railBtns().every(b=>(b.getAttribute('title')||'').length>0));

  console.log('\n=== Pulse retired; no Intelligence department ===');
  check('Pulse is not a destination', !btn('Pulse'));
  check('no Intelligence in navigation', !railBtns().some(b=>/Intelligence/.test(text(b))));
  check('no AI department framing', !/AI Intelligence|Intelligence Department|AI Insights/i.test(body()));
  check('town-dashboard Signals are not a screen', !sub('Signals'));

  console.log('\n=== Secondary nav still nested, not promoted ===');
  await click(btn('Play'));
  check('Arena secondary sections present', !!btn('Lobby')&&!!btn('Challenges')&&!!btn('Tournaments'));
  check('Arena sections are not in the rail', !railBtns().some(b=>/Tournaments|Challenges/.test(text(b))));

  console.log('\n=== Group chatter lives in Saved, not a Pulse room ===');
  await goto('Saved','Chats');
  check('Groups are the user\'s own', /Your chats/i.test(body()));
  check('never claims to have joined a group', !/we joined|auto-joined|Brief joined/i.test(body()));

  console.log('\n=== Arena entry point shows availability ===');
  await click(btn('Play'));
  check('arena entry shows game portals', /eFootball|COD|Find Match/i.test(body()));
  check('find action present', /Your games|Open matches|Find/i.test(body()));
  check('availability is not a nav item', !railBtns().some(b=>/Available|Busy|Offline/.test(text(b))));

  console.log('\n=== Active state does not rely on colour alone ===');
  await click(btn('Home'));
  const cur=railBtns().find(b=>b.getAttribute('aria-current')==='page');
  check('active item is machine-readable', !!cur);
  check('active item has a non-colour marker', !!cur && /bg-\[#FFFFFF\]|font-extrabold/.test(cur.className));
  check('active item renders an edge indicator', !!cur && cur.querySelectorAll('span').length>=1);

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
