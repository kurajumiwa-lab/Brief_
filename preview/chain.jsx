// ---------------------------------------------------------------------------
// RELATIONSHIP CHAINS
//
// Walks object -> object edges through the detail rails. Batch 1 removed the
// seeded graph, so the fixtures are served over /api/objects and arrive
// through the real objectFromServer adapter -- which now maps the server's
// relationship verbs onto the client's typed edge fields.
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');
const { FIXTURE_OBJECTS } = require('./fixtures.cjs');

async function main() {
  const h = await boot({ objects: FIXTURE_OBJECTS });
  const { text, click, document: doc } = h;
  const modal = () => document.querySelector('.fixed.inset-0.z-50');
  const modalText = () => { const m = modal(); return m ? text(m) : ''; };
  let pass=0, fail=0;
  const check=(n,c,d='')=>{ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n+(d?'  -> '+d:''));} };

  // open the Solar Kit from the stream
  const cards = Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  const solar = cards.find(c => text(c).includes('Portable Solar Lighting Pack'));
  check('Solar Kit card present in stream', !!solar);
  await click(solar);
  check('Solar Kit detail opened', modalText().includes('Portable Solar Lighting Pack'));

  // Walk: Solar Kit -> Kikao Hardware -> Solar Install -> Kilimani Hub
  const hops = ['Kikao Hardware', 'Solar Pack Installation Support', 'Kilimani Innovation Hub'];
  for (const target of hops) {
    const tiles = Array.from(modal().querySelectorAll('button'));
    const tile = tiles.find(b => text(b).includes(target));
    check(`related rail offers "${target}"`, !!tile,
      tile ? '' : 'tiles: ' + tiles.map(b=>text(b).slice(0,26)).filter(Boolean).slice(0,6).join(' | '));
    if (!tile) break;
    await click(tile);
    check(`navigated to "${target}"`, modalOpenHas(target), modalText().slice(0,80));
  }
  function modalOpenHas(t){ return !!modal() && modalText().includes(t); }

  // Kikao renders safely with no image / no metadata
  const kikaoCards = Array.from(document.querySelectorAll('div.grid > div[class*="cursor-pointer"]'));
  const kikao = kikaoCards.find(c => text(c).includes('Kikao Hardware'));
  if (kikao) {
    await click(kikao);
    const t = modalText();
    check('Kikao detail renders without image/metadata', !!modal() && t.includes('Kikao Hardware'));
    check('no NaN / undefined / [object Object] leaked', !/NaN|undefined|\[object Object\]/.test(t), t.slice(0,120));
    // NB: the old pattern /KES\s*(?![\d])/ matched every valid price too --
    // \s* backtracks to zero width, so "KES 18,500" satisfied it. The intent
    // is "KES not followed by a number", which is what this asserts.
    check('no empty "KES" price shown', !/KES(?!\s*[\d])/.test(t));
    // Detail header renders the TYPE label by existing design; category lives on the card.
    check('detail shows Identity type label', t.includes('Identity'));
    // Stream cards render the type badge, not category (existing design):
    // category surfaces on related tiles. Assert it where it actually lives.
    check('card shows type badge + no broken image', text(kikao).includes('Identity') && !kikao.querySelector('img'));
    check('imageless card still shows category', text(kikao).includes('Hardware Supplier'), text(kikao).slice(0,140));
    check('imageless card still shows VERIFIED', text(kikao).toUpperCase().includes('VERIFIED'));
    const closeBtns = Array.from(modal().querySelectorAll('button')).filter(b => b.querySelector('svg') && !text(b));
    check('imageless detail has a close button', closeBtns.length > 0);
    check('imageless detail shows category chip', t.includes('Hardware Supplier'));
    check('creator/provider name present', t.includes('Kikao Hardware'));
    check('location is Kilimani Hardware Lab', t.includes('Kilimani Hardware Lab'));
    // The action label now comes from the object's TYPE, not from a stored
    // string: the server has no actionLabel column, so an identity object
    // gets the identity verb. Still no transactional verb on an identity --
    // which is what this assertion has always really been guarding.
    check('primary action is not a fake transaction',
      /View|Open Map/.test(t) && !/Buy|Purchase started|Booking started/.test(t), t.slice(0,160));
    // Trust is deliberately ABSENT. The server stores no trust score, and
    // Brief does not invent one -- per the rule that trust is an evidence
    // list, never a number. A mirrored "97%" here would be fabricated.
    check('no invented trust percentage', !/\b\d{1,3}% trusted\b/.test(t), t.slice(0,160));
  }
  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e => { console.error(e); process.exit(1); });
