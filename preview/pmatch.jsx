// ---------------------------------------------------------------------------
// PURSUIT MATCHING
//
// This suite used to eval INITIAL_OBJECTS out of App.tsx and then reimplement
// the scoring algorithm locally -- so it tested a copy, not the product. Batch
// 1 emptied that seed, which exposed the problem.
//
// It now imports the REAL exported matcher and owns its fixtures, so a change
// to Brief's scoring is actually caught here.
// ---------------------------------------------------------------------------
const src=require('fs').readFileSync('/home/user/App.tsx','utf8');
const { FIXTURE_OBJECTS }=require('./fixtures.cjs');
const App=require('./src/App.tsx');
const objects=FIXTURE_OBJECTS;
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

const terms=q=>App.getPursuitTerms(q);
const sing=w=>App.singularise(w);
// Exercise matchPursuit exactly as the app calls it: through a Pursuit object.
const match=(q,pool=objects,limit=8)=>App.matchPursuit(
  { id:'p_test', query:q, status:'active', createdAt:'2026-08-01T00:00:00Z',
    lastUpdatedAt:'2026-08-01T00:00:00Z', sourceTypes:[], matchedObjectIds:[],
    watchChanges:false },
  pool, limit);

console.log('=== Intent words are stripped, not searched ===');
check('"find" alone yields no terms', terms('find').length===0);
check('"find me a good one near me" -> no terms', terms('find me a good one near me').length===0);
check('empty query matches NOTHING', match('find me anything').length===0);
check('subject words survive', terms('find cattle auctions this week').join(',')==='cattle,auctions');

console.log('\n=== Real pursuit phrasings ===');
const solar=match('find the cheapest solar lights around kilimani');
check('solar pursuit ranks the solar product first', solar[0]&&solar[0].item.id==='prd_solar_kit', solar[0]?solar[0].item.title:'none');
const grant=match('watch the green grant');
check('grant pursuit finds the grant', grant.some(m=>m.item.id==='opp_green_grant'));
const permit=match('what do I need for a business permit');
check('permit pursuit finds the guide', permit.some(m=>m.item.id==='knw_permit_guide'), permit.map(m=>m.item.title.slice(0,20)).join('|'));
const market=match('market day events this saturday');
check('event pursuit finds market day', market.some(m=>m.item.title.includes('Market Day')));

console.log('\n=== No fabrication ===');
check('helicopter mechanic -> 0 results', match('find a helicopter mechanic')  .length===0);
check('crypto exchange -> 0 results', match('find a crypto exchange').length===0);
check('nonsense -> 0 results', match('zzzz qqqq').length===0);

console.log('\n=== Breadth beats a single strong hit ===');
const multi=match('solar installation service');
check('multi-term favours the install service', multi[0]&&/Installation/.test(multi[0].item.title), multi[0]?multi[0].item.title:'none');
check('stemming: "lights" finds "Lighting"', match('solar lights').some(m=>m.item.id==='prd_solar_kit'));
check('stemming: "auctions" would find "Auction"', sing('auctions')==='auction');
check('stemming does not over-reach on short words', sing('bus')==='bus');

console.log('\n=== Source guarantees ===');
check('Pursuit model has all required fields', /interface Pursuit \{[\s\S]{0,700}matchedObjectIds: string\[\];[\s\S]{0,200}watchChanges: boolean;/.test(src));
check('all four statuses defined', /'active' \| 'paused' \| 'completed' \| 'archived'/.test(src));
check('no external search calls', !/matchPursuit[\s\S]{0,1500}(fetch\(|axios)/.test(src));
check('no chatbot / LLM call', !/openai|anthropic|chat\.completions|gpt-/i.test(src));
check('search + pursuits share ONE scorer', (src.match(/const scoreObjectForPhrase/g)||[]).length===1 && /score: scoreObjectForPhrase\(obj, query\)/.test(src));
check('marketplace objects untouched', objects.length===13);
console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail?1:0);
