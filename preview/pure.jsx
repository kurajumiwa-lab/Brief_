// Phase 3 note: overlay copy moved into src/screens/OverlaysShell.tsx; the
// invariants asserted here are behavioral, so include that file.
const src = (require('fs').readFileSync(__dirname + '/src/App.tsx','utf8') + '\n' + require('fs').readFileSync(__dirname + '/src/model/core.tsx','utf8') + '\n' + require('fs').readFileSync(__dirname + '/src/screens/OverlaysShell.tsx','utf8'));
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

// --- freshness, re-implemented from the shipped constants to verify the RULES
const DAY=86400000;
function fresh(o,now){
  if(!o.lastVerifiedAt||o.validityWindowDays===undefined)return null;
  const v=new Date(o.lastVerifiedAt); if(isNaN(v))return null;
  const daysAgo=Math.max(0,Math.floor((now-v)/DAY));
  const w=o.validityWindowDays, ratio=w>0?daysAgo/w:1;
  const level=ratio>1?'stale':ratio>0.66?'aging':daysAgo<=7?'recent':'verified';
  return {level,daysAgo};
}
const NOW=new Date('2026-08-15T00:00:00Z');
console.log('=== FRESHNESS: never claims more than the dates support ===');
check('no dates -> null', fresh({},NOW)===null);
check('missing window -> null', fresh({lastVerifiedAt:'2026-08-14T00:00:00Z'},NOW)===null);
check('checked 1d ago, 30d window -> recent', fresh({lastVerifiedAt:'2026-08-14T00:00:00Z',validityWindowDays:30},NOW).level==='recent');
check('checked 20d ago, 30d window -> aging', fresh({lastVerifiedAt:'2026-07-26T00:00:00Z',validityWindowDays:30},NOW).level==='aging');
check('checked 40d ago, 30d window -> stale', fresh({lastVerifiedAt:'2026-07-06T00:00:00Z',validityWindowDays:30},NOW).level==='stale');
check('checked 20d ago, 120d window -> verified (not aging)', fresh({lastVerifiedAt:'2026-07-26T00:00:00Z',validityWindowDays:120},NOW).level==='verified');
check('garbage date -> null', fresh({lastVerifiedAt:'not-a-date',validityWindowDays:30},NOW)===null);

console.log('\n=== SOURCE CODE GUARANTEES ===');
check('EXPLICIT_LINK_FLOOR present and >= 100', /EXPLICIT_LINK_FLOOR = 100/.test(src));
check('ingestion fields added', /sourceId\?: string/.test(src)&&/sourceMessageId\?: string/.test(src)&&/ingestedAt\?: string/.test(src));
// sourceType now composes the shared SourceType union plus 'user'.
check("sourceType allows all channels + 'user'", /sourceType\?: SourceType \| 'user'/.test(src) && /'telegram' \| 'whatsapp' \| 'web' \| 'rss' \| 'api' \| 'manual'/.test(src));
check('ingestion fields NOT rendered in UI', !/selectedObjectForDetail\.(sourceId|sourceMessageId|ingestedAt)/.test(src));
check('watched verb added', /verb: 'watched'/.test(src));
check('SaveLabel optional on relationship', /label\?: SaveLabel/.test(src));
check('no graph database / external dep', !/require\(['"]graphlib|from ['"]graphlib/.test(src));
check('diffObjects ignores timestamps', !/CHANGE_FIELDS[\s\S]{0,400}lastVerifiedAt/.test(src));
check('duplicates never auto-merge', !/\.splice\(|mergeObjects|autoMerge/.test(src));
check('share has no promo language', !/AI-powered|Check out this amazing|Discover more on Brief/i.test(src));
check('no invented URLs in new objects', !/kikao\.co\.ke|example\.com|solar-install/.test(src));
check('Kikao has no fabricated phone', !/id_kikao_hardware[\s\S]{0,600}contactPhone/.test(src));
check('trust score framed as signal not guarantee', /not a guarantee of accuracy/.test(src));

console.log('\n=== DUPLICATE DETECTION (dice bigram) ===');
const norm=t=>t.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function sim(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;if(a===b)return 1;if(a.length<2||b.length<2)return 0;
 const bg=v=>{const m=new Map();for(let i=0;i<v.length-1;i++){const g=v.slice(i,i+2);m.set(g,(m.get(g)||0)+1);}return m;};
 const A=bg(a),B=bg(b);let sh=0;A.forEach((c,g)=>{const o=B.get(g);if(o)sh+=Math.min(c,o);});
 return (2*sh)/((a.length-1)+(b.length-1));}
check('identical titles -> 1.0', sim('Kikao Hardware','Kikao Hardware')===1);
check('punctuation/case ignored', sim('Kikao Hardware','KIKAO  HARDWARE!')===1);
check('near-dup detected >=0.82', sim('Maji Mazuri Farmers Market','Maji Mazuri Farmers Market ')>=0.82);
check('different businesses NOT flagged', sim('Kikao Hardware','Green Harvest Farmers Co-op')<0.82, String(sim('Kikao Hardware','Green Harvest Farmers Co-op').toFixed(2)));
check('same words diff business not over-eager', sim('Solar Pack Installation Support','Portable Solar Lighting Pack')<0.82);
console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail?1:0);
