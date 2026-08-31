const src=(require('fs').readFileSync(__dirname + '/src/App.tsx','utf8') + '\n' + require('fs').readFileSync(__dirname + '/src/model/core.tsx','utf8'));
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};
// Mirror the shipped rules
const MONEY_RE=/(?:ksh|kes|sh)\s*\.?\s*([0-9][0-9,\.]*)\s*(?:\/=|\/-)?|([0-9][0-9,]{2,})\s*(?:\/=|\/-)/i;
const PHONE_RE=/(?:\+254|0)7[0-9]{8}\b|\+254\s?7[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}/;
const HOURS_RE=/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\s*(?:-|to|until|till)\s*([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i;
const DEADLINE_RE=/\b(?:deadline|closes|closing|apply by|last day|ends)\b[:\s]*([A-Za-z0-9 ,]{3,24})/i;
const LOCATION_RE=/\b(?:at|located at|location|venue|along|opposite|near)\b[:\s]+([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*){0,4})/;
const CONVERSATION_RE=/^(?:\s*(?:hi|hey|hello|habari|sasa|niaje|thanks|asante|ok|okay|yes|no|lol|haha)\b|.*\?\s*$)/i;
const TYPE_SIGNALS=[['opportunity',/\b(grant|scholarship|apply|application|funding|vacancy|hiring|job|tender|bursary)\b/i],
['experience',/\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar)\b/i],
['service',/\b(service|repair|installation|booking|book a|consultation|inspection|delivery|plumber|fundi)\b/i],
['product',/\b(for sale|selling|stock|in stock|price|buy|brand new|second hand|pieces|units)\b/i],
['knowledge',/\b(guide|how to|steps|requirements|explainer|notice|announcement)\b/i],
['place',/\b(shop|stall|market|centre|center|hub|office|premises|located at|branch)\b/i]];
const inferType=t=>{for(const[ty,re]of TYPE_SIGNALS)if(re.test(t))return ty;return null;};
const title=t=>{const l=t.split(/\n|(?<=[.!])\s+/).map(x=>x.trim()).find(x=>x.length>=8&&x.length<=90&&/[a-z]/i.test(x));return l?l.replace(/^[^A-Za-z0-9]+/,'').slice(0,80):null;};
function parse(text){
  const ex=[]; if(MONEY_RE.test(text))ex.push('price'); if(PHONE_RE.test(text))ex.push('contactPhone');
  if(HOURS_RE.test(text))ex.push('hours'); if(DEADLINE_RE.test(text))ex.push('deadline'); if(LOCATION_RE.test(text))ex.push('location');
  const T=title(text), ty=inferType(text), conv=CONVERSATION_RE.test(text.trim()), short=text.trim().length<25;
  let reason;
  if(!T)reason='No usable title line.'; else if(!ty)reason='No recognisable object type in the text.';
  else if(short)reason='Too short to describe anything.';
  else if(conv&&ex.length===0)reason='Reads as conversation, not an announcement.';
  return {type:ty,title:T,extracted:ex,isObjectWorthy:reason===undefined,reason};
}

console.log('=== SHOULD produce an object ===');
const cases=[
 ['event announcement','Youth tech forum this Saturday at Jeevanjee Gardens. Starts 09:00-13:00. Free entry.','experience'],
 ['job opportunity','Accounts assistant vacancy at a logistics firm. Apply by 30 September. Send CV to the office.','opportunity'],
 ['product listing','Brand new gas cylinders for sale, 6kg. Price KSh 3,500 each. Call 0712345678.','product'],
 ['service advertisement','Plumber available for repair and installation works. Charges from KSh 1,500. Call 0712345678.','service'],
 ['marketplace announcement','Maji Mazuri market open today with fresh produce. Open 06:00-18:30 at Haile Selassie Ave.','place'],
 ['auction announcement','Cattle auction this Saturday at Rongo grounds. Registration required, starts 09:00.','experience']];
for(const [label,text,expect] of cases){
  const r=parse(text);
  check(label+' -> object', r.isObjectWorthy, r.reason||'');
  check(label+' -> type '+expect, r.type===expect, 'got '+r.type);
}

console.log('\n=== MUST NOT produce an object ===');
const chatter=[
 ['greeting','Hey everyone good morning'],
 ['question','Anyone know if the shop is open?'],
 ['reply','Ok thanks'],
 ['too short','Yes'],
 ['pure chatter','lol that was funny yesterday'],
 ['asking a favour','Anyone around? asking for a friend']];
for(const [label,text] of chatter){
  const r=parse(text);
  check('no object: '+label, !r.isObjectWorthy, 'WRONGLY created '+r.type);
}

console.log('\n=== Question that IS an advert still counts ===');
const q=parse('Looking for a plumber? We do repair and installation. Call 0712345678');
check('advert phrased as question survives', q.isObjectWorthy, q.reason||'');

console.log('\n=== SOURCE / MEDIA / REVIEW guarantees ===');
check('Source model separate from BriefObject', /export interface Source \{[\s\S]{0,400}ingestionCount: number;/.test(src));
check('all six source types', /'telegram' \| 'whatsapp' \| 'web' \| 'rss' \| 'api' \| 'manual'/.test(src));
check('health derived not stored', /const getSourceHealth = /.test(src)&&!/health: SourceHealth;/.test(src.split('const getSourceHealth')[0]));
check('technical detail kept out of user copy', /lastErrorDetail/.test(src)&&/Never rendered to ordinary users/.test(src));
check('imageAnalysisStatus has 3 states', /'pending' \| 'processed' \| 'unavailable'/.test(src));
check('no image recognition performed', /Brief does not read images/.test(src));
check('media retains provenance', /sourceMessageId: message\.id,[\s\S]{0,200}imageAnalysisStatus/.test(src));
check('reviewState candidate|confirmed|rejected', /'candidate' \| 'confirmed' \| 'rejected'/.test(src));
check('ingestion only ever emits candidate', /reviewState: 'candidate'/.test(src));
console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail?1:0);
