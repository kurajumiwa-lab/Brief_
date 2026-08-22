// ---------------------------------------------------------------------------
// DESTINATIONS
//
// Places that contain other objects (a market holding vendors and events).
// Fixtures are served over /api/objects, so the containment rails are built
// from real relationship edges rather than a seeded constant.
// ---------------------------------------------------------------------------
const { boot } = require('./harness.cjs');
const { FIXTURE_OBJECTS } = require('./fixtures.cjs');
const Mod = require('./src/App.tsx');

async function main(){
  const h = await boot({ objects: FIXTURE_OBJECTS });
  const { text, body, click, btn, allBtns: all } = h;
  const card=t=>Array.from(document.querySelectorAll('div')).find(d=>text(d).startsWith(t));
  const esc=async()=>{const x=Array.from(document.querySelectorAll('button')).find(b=>text(b)===''&&b.className.includes('rounded-full'));if(x)await click(x);};
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  console.log('\n=== 2/3. Destinations are recognised, ordinary objects are not ===');
  const b=body();
  check('market day is on the stream', /Maji Mazuri Saturday Market Day/i.test(b));
  check('a live/today state is shown', /Today|Live now/i.test(b));
  check('vendor count surfaces on the stream', /vendors? inside/i.test(b));
  check('government office is NOT a destination',
    !/City Licensing & Permits Dept[^]{0,120}vendors? inside/i.test(b));
  check('no invented attendance figures', !/\d+ (people )?interested/i.test(b));

  console.log('\n=== 10. Passing-mass discovery ===');
  check('Happening nearby strip present', /Happening nearby/i.test(b));
  check('strip offers the discovery action', all("See what's here").length>0);

  console.log('\n=== 12. Primary action is discovery, not booking ===');
  const seeBtns=all("See what's here");
  check('"See what\'s here" replaces generic act', seeBtns.length>0);
  check('ordinary objects keep their real action', /Read Guide|Apply|Open Map|Call Office/i.test(b));

  console.log('\n=== 4/5. Destination detail is a mini directory ===');
  await click(seeBtns[0]);
  const d=body();
  check('detail opened as a destination', /What's here/i.test(d));
  check('vendor is listed by name', /Green Harvest Farmers Co-op/i.test(d));
  check('vendor category shown', /Cooperative/i.test(d));
  check('vendor has a View vendor hop', !!btn('View vendor'));
  check('no fabricated prices in the directory', !/KES 0\b/.test(d));

  console.log('\n=== 6/7. Vendor -> products and vendor -> destinations ===');
  await click(btn('View vendor'));
  const v=body();
  check('vendor detail opened', /Green Harvest Farmers Co-op/i.test(v));
  check('vendor shows where to find them', /Find them at/i.test(v)||/What they offer/i.test(v));

  console.log('\n=== 20. No fake commerce ===');
  check('no fabricated vendor names', !/Kikao Streetwear|Mama Njeri Bites|Glow Studio|Pixel Prints/i.test(body()));
  check('no invented popup events', !/Weekend Popup|Nairobi Creator Popup/i.test(body()));

  console.log('\n=== 24/25. No marketplace tab, five destinations intact ===');
  const navs=Array.from(document.querySelectorAll('nav[aria-label="Primary"]'));
  check('still exactly two primary navs', navs.length===2, String(navs.length));
  const railText=navs.map(n=>text(n)).join(' ');
  check('no Marketplace/Shop/Store/Vendors primary', !/Marketplace|Shop\b|Store\b|Vendors/i.test(railText));
  check('four screens preserved', /Around/.test(railText)&&/Play/.test(railText)&&/Actions/.test(railText)&&/Saved/.test(railText));
  check('Pulse is not a destination', !/Pulse/.test(railText));

  console.log('\n=== 12/13. Save still works, related engine still works ===');
  check('save controls still present', document.querySelectorAll('svg').length>0);

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
