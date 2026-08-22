// ---------------------------------------------------------------------------
// GROUP UI
//
// The group detail surface: unanswered questions, the /brief digest, and the
// commitment that Brief reads a group without posting into it. Mounts the
// extracted <ConnectedGroups> with test-owned fixtures -- see grouphost.cjs
// for why the full-app mount no longer supplies this data.
// ---------------------------------------------------------------------------
const { bootGroups } = require('./grouphost.cjs');
const { FIXTURE_OBJECTS } = require('./fixtures.cjs');

async function main(){
  // Objects are supplied because /find falls back to the wider Brief graph
  // when a group holds no answer -- and must label that result as coming from
  // outside the group.
  const h = await bootGroups({ objects: FIXTURE_OBJECTS });
  const { text, body, click, btn, setVal, submit, askInput, act, dom } = h;
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  // Your chats lists first; open one to reach its detail.
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
  await setVal(inp,'/find inspection');
  await submit(inp);
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
