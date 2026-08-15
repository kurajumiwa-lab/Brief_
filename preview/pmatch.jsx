const src=require('fs').readFileSync('/home/user/App.tsx','utf8');
const objects=eval(src.match(/const INITIAL_OBJECTS: BriefObject\[\] = (\[[\s\S]*?\n\];)/)[1].replace(/;$/,''));
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};
const INTENT=new Set(['find','show','get','look','looking','search','watch','monitor','track','want','need','me','my','a','an','the','for','near','nearby','around','this','that','week','today','tomorrow','good','best','cheapest','cheap','any','some','one','ones','thing','things','please','where','what','is','are','in','on','at','to','of','and']);
const sing=w=>{if(w.length>4&&w.endsWith('ies'))return w.slice(0,-3)+'y';if(w.length>4&&w.endsWith('es'))return w.slice(0,-2);if(w.length>3&&w.endsWith('s')&&!w.endsWith('ss'))return w.slice(0,-1);return w;};
const terms=q=>Array.from(new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2&&!INTENT.has(w))));
const score=(o,p)=>{const q=p.trim().toLowerCase();if(!q)return 0;
 const t=o.title.toLowerCase(),c=o.category.toLowerCase(),su=o.summary.toLowerCase();
 const l=(o.locationName??'').toLowerCase(),cr=(o.creatorName??'').toLowerCase(),st=(o.metadata?.statusBadge??'').toLowerCase();
 let s=0; if(t===q)s+=100;else if(t.startsWith(q))s+=60;else if(t.includes(q))s+=40;
 if(c===q)s+=30;else if(c.includes(q))s+=18;
 if(o.type.includes(q))s+=16; if(cr.includes(q))s+=12; if(l.includes(q))s+=10; if(st.includes(q))s+=6; if(su.includes(q))s+=4; return s;};
function match(q,pool=objects,limit=8){const T=terms(q); if(!T.length)return [];
 return pool.map(item=>{const st=(o,t)=>{const d=score(o,t);if(d>0)return d;const g=sing(t);return (g!==t&&g.length>2)?score(o,g)*0.9:0;};
  const mt=T.filter(t=>st(item,t)>0);
  if(!mt.length)return{item,score:0,mt};
  let s=mt.reduce((a,t)=>a+st(item,t),0); s*=mt.length/T.length; s+=score(item,q.trim());
  const d=item.metadata?.distanceKm; if(d!==undefined)s+=Math.max(0,2-d/2); return{item,score:s,mt};})
  .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit);}

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
