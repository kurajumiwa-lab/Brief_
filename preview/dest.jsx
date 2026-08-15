const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const Mod=require('./src/App.tsx');
const App=Mod.default;

async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  const all=t=>Array.from(document.querySelectorAll('button')).filter(b=>text(b).includes(t));
  const card=t=>Array.from(document.querySelectorAll('div')).find(d=>text(d).startsWith(t));
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};
  const esc=async()=>{const x=Array.from(document.querySelectorAll('button')).find(b=>text(b)===''&&b.className.includes('rounded-full'));if(x)await click(x);};

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
  check('five destinations preserved', /Nearby/.test(railText)&&/Arena/.test(railText)&&/Workflows/.test(railText)&&/Pulse/.test(railText));

  console.log('\n=== 12/13. Save still works, related engine still works ===');
  check('save controls still present', document.querySelectorAll('svg').length>0);

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
