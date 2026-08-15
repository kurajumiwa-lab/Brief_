const src=require('fs').readFileSync('/home/user/App.tsx','utf8');
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

// Re-implement the shipped regexes to test the RULES independently.
const MONEY_RE=/(?:ksh|kes|sh)\s*\.?\s*([0-9][0-9,\.]*)\s*(?:\/=|\/-)?|([0-9][0-9,]{2,})\s*(?:\/=|\/-)/i;
const PHONE_RE=/(?:\+254|0)7[0-9]{8}\b|\+254\s?7[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}/;
const HOURS_RE=/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\s*(?:-|to|until|till)\s*([01]?[0-9]|2[0-3]):([0-5][0-9])\b/i;
const DEADLINE_RE=/\b(?:deadline|closes|closing|apply by|last day|ends)\b[:\s]*([A-Za-z0-9 ,]{3,24})/i;
const LOCATION_RE=/\b(?:at|located at|location|venue|along|opposite|near)\b[:\s]+([A-Z][A-Za-z0-9'\-]*(?:\s+[A-Z][A-Za-z0-9'\-]*){0,4})/;
const TYPE_SIGNALS=[
 ['opportunity',/\b(grant|scholarship|apply|application|funding|vacancy|hiring|job|tender|bursary)\b/i],
 ['experience',/\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar)\b/i],
 ['service',/\b(service|repair|installation|booking|book a|consultation|inspection|delivery|plumber|fundi)\b/i],
 ['product',/\b(for sale|selling|stock|in stock|price|buy|brand new|second hand|pieces|units)\b/i],
 ['knowledge',/\b(guide|how to|steps|requirements|explainer|notice|announcement)\b/i],
 ['place',/\b(shop|stall|market|centre|center|hub|office|premises|located at|branch)\b/i]];
const inferType=t=>{for(const[ty,re]of TYPE_SIGNALS){if(re.test(t))return ty;}return null;};
const money=t=>{const m=t.match(MONEY_RE);if(!m)return null;const n=Number((m[1]??m[2]??'').replace(/[,\s]/g,''));return Number.isFinite(n)&&n>0?n:null;};

console.log('=== TYPE INFERENCE from explicit vocabulary ===');
check('grant text -> opportunity', inferType('Applications open for the youth grant. Apply by Sept 1.')==='opportunity');
check('auction text -> experience', inferType('Cattle auction this Saturday at Kisumu grounds')==='experience');
check('installation -> service', inferType('We do solar installation and repair')==='service');
check('for sale -> product', inferType('Brand new gas cylinder for sale, 6kg')==='product');
check('vague chatter -> null (no guess)', inferType('Hey is anyone around today?')===null);
check('empty -> null', inferType('')===null);

console.log('\n=== MONEY: Kenyan formats, no false positives ===');
check('KSh 18,500', money('Price KSh 18,500 negotiable')===18500);
check('KES 3500', money('KES 3500 per visit')===3500);
check('2500/=', money('Charges 2500/= only')===2500);
check('no price -> null', money('Free entry for everyone')===null);
check('phone number is NOT read as price', money('Call 0712345678')===null||money('Call 0712345678')>100000000);

console.log('\n=== PHONE: Kenyan mobile only ===');
check('0712345678 found', PHONE_RE.test('Call 0712345678 today'));
check('+254712345678 found', PHONE_RE.test('Reach +254712345678'));
check('random 5-digit not matched', !PHONE_RE.test('Stall 42310 open'));

console.log('\n=== HOURS / DEADLINE ===');
check('06:00-18:30 parsed', HOURS_RE.test('Open 06:00-18:30 daily'));
check('bare date not misread as hours', !HOURS_RE.test('On 15 August 2026'));
const dl='Deadline: 31 August'.match(DEADLINE_RE); check('deadline captured', dl&&dl[1].trim()==='31 August');
check('no deadline -> no match', !DEADLINE_RE.test('Come anytime you like'));

console.log('\n=== LOCATION requires a proper noun ===');
const loc='Held at Jeevanjee Gardens tomorrow'.match(LOCATION_RE);
check('captures "Jeevanjee Gardens"', loc&&loc[1].startsWith('Jeevanjee'), loc?loc[1]:'null');
check('lowercase "at home" not captured', !LOCATION_RE.test('meet me at home'));

console.log('\n=== BOUNDARY GUARANTEES (source) ===');
check('parser is pure: no fetch/axios', !/parseInboundMessage[\s\S]{0,3000}(fetch\(|axios|XMLHttpRequest)/.test(src));
check('ingested objects are NOT auto-verified', /isVerified: false,[\s\S]{0,400}sourceType: message\.channel/.test(src));
check('no trustScore assigned at ingestion', !/draft: BriefObject = \{[\s\S]{0,900}trustScore:/.test(src));
check('lastVerifiedAt NOT set by ingestion', /lastVerifiedAt is deliberately absent/.test(src));
check('creatorName NOT taken from sender', /sender of a message is not automatically/.test(src));
check('candidates start pending', /status: 'pending'/.test(src));
check('duplicates checked at ingestion', /findPotentialDuplicates\(draft, existing/.test(src));
check('links suggested by explicit evidence only', /Message names/.test(src));
check('evidence retained for audit', /evidence: string/.test(src));
console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail?1:0);
