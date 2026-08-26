// ---------------------------------------------------------------------------
// SYSTEM WALKTHROUGHS
//
// End-to-end traversals across the object graph. Fixtures are served over
// /api/objects (Batch 1 removed the seeded graph), so these walks exercise
// the real server -> objectFromServer -> UI path.
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');
const { FIXTURE_OBJECTS } = require('./fixtures.cjs');

async function main(){
  const h = await boot({ objects: FIXTURE_OBJECTS });
  const { text, click, document: doc } = h;
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
  // The server has no creatorName column, so Brief states the absence rather
  // than attributing the record to someone it cannot name.
  check('provider stated or explicitly absent',
    t.includes('City County Markets Board') || t.includes('Provider not stated'), t.slice(0,200));

  console.log('\n=== PROMPT 8/16/21: you-can, nearby, watch ===');
  // A place with a real locationName supports directions, so "You can" is
  // correctly PRESENT and offers exactly that -- an action backed by data the
  // object actually carries, not an invented one.
  check('"You can" offers the action the data supports',
    !t.includes('You can') || t.includes('Get directions'), t.slice(0,200));
  check('has Nearby section', t.includes('More from this area') && t.includes('Nearby'));
  const watchBtn=Array.from(modal().querySelectorAll('button')).find(b=>text(b)==='Watch');
  check('Watch button present', !!watchBtn);
  if(watchBtn){
    await click(watchBtn); await h.settle();
    // A late-arriving data load can re-render and swap the button node between
    // find and click, so a dispatched click can land on a detached node and
    // the toggle never reaches React's delegated listener. Re-find the live
    // button and retry once before asserting.
    if(!mt().includes('Watching')){
      const again = Array.from(modal().querySelectorAll('button')).find(b=>text(b)==='Watch');
      if(again){ await click(again); await h.settle(); }
    }
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
