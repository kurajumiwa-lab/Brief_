// ---------------------------------------------------------------------------
// GROUP ACCESS CONTROL
//
// Who may see a group, whose content stays sealed, and what revocation
// destroys. Batch 1 emptied ALL_GROUPS/GROUP_MESSAGES in the product (groups
// are derived from real server sources now), so this suite mounts the
// extracted <ConnectedGroups> with test-owned fixtures and the REAL access
// helpers. The rules under test are unchanged.
// ---------------------------------------------------------------------------
const { bootGroups } = require('./grouphost.cjs');

async function main(){
  const h = await bootGroups();
  const { text, body, click, btn, setVal, submit, askInput, act, dom } = h;
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  let b=body();
  console.log('=== ONLY the user\'s own groups ===');
  check('says "Your Groups"', b.includes('Your Groups'));
  check('no Discover/Popular/Communities framing', !/Discover Groups|Popular Groups|Communities|Suggested/i.test(b));
  check('member group listed', b.includes('Kilimani Traders'));
  check('second member group listed', b.includes('KU Medical Students'));
  check('authorised group listed', b.includes('Westlands Business Forum'));

  console.log('\n=== Groups the user CANNOT access never appear ===');
  check('pending group hidden', !b.includes('Riverside Estate'));
  check('revoked group hidden', !b.includes('Old Market Vendors'));
  check("stranger's group hidden", !b.includes('Mombasa Fisheries'));

  console.log('\n=== Their CONTENT never leaks either ===');
  check('no wholesale tomatoes (revoked)', !b.includes('tomatoes'));
  check('no tilapia (stranger group)', !b.includes('tilapia'));
  check('no pending-group plumber rec', !b.includes('0714555444'));

  console.log('\n=== Open a group: only its own information ===');
  await click(btn('Open'));
  b=body();
  check('shows membership plainly', b.includes("You're a member"));
  check('kilimani content present', b.includes('business permit'));
  check('OTHER group content absent', !b.includes('OSCE'), 'cross-group leak');
  check('inaccessible content still absent', !b.includes('tilapia')&&!b.includes('tomatoes'));

  console.log('\n=== Ask Brief: plain question, no syntax needed ===');
  const inp=document.querySelector('input[placeholder="Ask something about this group..."]');
  check('Ask Brief input present', !!inp);
  await setVal(inp,'who knows a plumber');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('answers from this group', b.includes('From this group'));
  check('finds the plumber question', b.includes('Who knows a plumber'));

  console.log('\n=== Cross-group search does NOT reach other groups ===');
  await setVal(inp,'OSCE');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('does not surface KU content from Kilimani', !b.includes('OSCE revision workshop'), 'LEAK');

  console.log('\n=== Multimodal: same model, honest about images ===');
  await setVal(inp,'clean-up');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('image caption became findable info', b.includes('Community clean-up meetup'));
  await setVal(inp,'50W solar kit');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('document content searchable', b.includes('18,500')||b.includes('18500'), b.slice(0,200));

  console.log('\n=== Save keeps provenance, never claims authorship ===');
  await setVal(inp,'permit');
  await act(async()=>{inp.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('shows source attribution inline', /From Kilimani Traders/i.test(b));
  const save=btn('Save to My Layer');
  check('Save to My Layer offered', !!save);
  const vs=btn('View source');
  check('View source offered', !!vs);
  if(save){await click(save); b=body();
    check('save confirms it kept the source', /Saved to My Layer with its source/i.test(b));}
  if(vs){await click(vs); b=body();
    check('view source names group + date, invents no link', /Kilimani Traders/i.test(b) && !/http/i.test(b));}

  console.log('\n=== Author retention respects group setting ===');
  await click(btn('Back to your groups'));
  const opens=Array.from(document.querySelectorAll('button')).filter(x=>text(x)==='Open');
  await click(opens[1]);
  b=body();
  check('opened KU Medical Students', b.includes('KU Medical Students'));
  const inp2=document.querySelector('input[placeholder="Ask something about this group..."]');
  await setVal(inp2,'OSCE');
  await act(async()=>{inp2.closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
  b=body();
  check('KU content now visible in ITS group', b.includes('OSCE'));
  check('author names withheld (retainAuthors false)', !b.includes('Brenda')&&!b.includes('Dennis'));

  console.log('\n=== Revoking access removes the group and its data ===');
  await click(btn('Back to your groups'));
  const rev=Array.from(document.querySelectorAll('button')).find(x=>text(x)==="Revoke Brief's access");
  await click(rev);
  b=body();
  check('revoked group disappears', !b.includes('Kilimani Traders'), 'still listed');
  check('other groups unaffected', b.includes('KU Medical Students'));
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
