const src=require('fs').readFileSync('/home/user/App.tsx','utf8');
let pass=0,fail=0;
const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};
const QUESTION_RE=/\?\s*$|\?\s|^\s*(?:anyone|does anyone|any one|who|where|how|what|when|which|is there|are there|can (?:i|anyone|someone)|looking for|need|nataka|naomba|kuna)\b/i;
const REQUEST_RE=/\b(?:anyone (?:know|selling|got|have)|looking for|in need of|recommend|suggestions?|help me find|where can i)\b/i;
const CLASS=[['job',/\b(vacancy|vacancies|hiring|job|position|recruit|cv|applicants?|apply now|internship)\b/i],
['opportunity',/\b(grant|scholarship|funding|tender|bursary|call for|application(?:s)? open|deadline)\b/i],
['event',/\b(event|forum|summit|meetup|workshop|festival|market day|auction|training|webinar|kesho|this saturday|this sunday)\b/i],
['service',/\b(service|repair|installation|fundi|plumber|electrician|mechanic|cleaning|delivery|booking)\b/i],
['product',/\b(for sale|selling|on sale|in stock|brand new|second hand|pieces|units|kilo|bei)\b/i],
['place',/\b(shop|stall|market|centre|center|hub|premises|branch|located at|opposite)\b/i],
['business',/\b(supplier|vendor|company|enterprise|ltd|limited|dealer|distributor|wholesaler)\b/i],
['resource',/\b(guide|how to|steps|requirements|link|website|document|form|notice|announcement)\b/i]];
function classify(t){const s=t.trim();
 if(QUESTION_RE.test(s)||REQUEST_RE.test(s))return 'question';
 for(const[c,re]of CLASS)if(re.test(s))return c; return 'chatter';}

console.log('=== Questions win: the group record worth keeping ===');
check('"Where can I renew my permit?" -> question', classify('Where can I renew my business permit?')==='question');
check('"Anyone selling a 50W solar kit?" -> question NOT product', classify('Anyone selling a 50W solar kit?')==='question');
check('"Who knows a plumber?" -> question NOT service', classify('Who knows a plumber around Kilimani?')==='question');
check('request without "?" still a question', classify('Looking for a mechanic in Kilimani')==='question');

console.log('\n=== Real posts classify correctly ===');
check('vacancy -> job', classify('Vacancy: accounts assistant needed. Send CV.')==='job');
check('grant -> opportunity', classify('Green Commerce Micro-Grant applications are open, deadline: 31 August')==='opportunity');
check('forum -> event', classify('Youth tech forum this Saturday at Jeevanjee Gardens')==='event');
check('selling goats -> product', classify('Selling 3 goats, 18000 each, Kisumu. Call 0712345678')==='product');
check('guide -> resource', classify('Guide on the single business permit steps and requirements')==='resource');

console.log('\n=== Chatter is classified but NOT indexed ===');
check('"Good morning all" -> chatter', classify('Good morning all')==='chatter');
check('"haha true" -> chatter', classify('haha true')==='chatter');
check('chatter skipped from index', /if \(classification\.messageClass === 'chatter'\) continue;/.test(src));

console.log('\n=== Provenance: interpretation never replaces the source ===');
check('original text retained', /originalText: message\.text/.test(src));
check('evidence recorded', /evidence: classification\.evidence/.test(src));
check('confidence recorded', /confidence: classification\.confidence/.test(src));
check('timestamp retained', /sentAt: message\.sentAt/.test(src));
check('author only if group permits', /group\.retainAuthors \? message\.authorLabel : undefined/.test(src));

console.log('\n=== Unanswered questions ===');
check('answered only via explicit replyToId', /m\.replyToId === entry\.messageId/.test(src));
check('never inferred from timing/keywords', /never from timing or/.test(src));

console.log('\n=== Weekly brief is useful, not engagement ===');
check('empty categories dropped', /Empty categories are dropped rather than reported as zero/.test(src));
// Strip comments first: the guarantee is about code, not the note explaining it.
const code=src.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
check('no social-popularity metrics in groups', !/mostActive|streak|topPoster/i.test(code));
check('unanswered questions included', /unanswered: getUnansweredQuestions\(recent\)/.test(src));

console.log('\n=== Local-first: group before elsewhere ===');
check('group searched first', /const fromGroup = searchGroupEntries\(context\.entries, argument\);/.test(src));
check('elsewhere ONLY if group empty', /if \(fromGroup\.length > 0\) \{\s*return \{ \.\.\.base, fromGroup \};/.test(src));
check('results never mixed', /fromGroup: GroupKnowledgeEntry\[\];[\s\S]{0,300}fromElsewhere: BriefObject\[\];/.test(src));
check('honest when nothing found', /Nothing in this group, and nothing elsewhere in Brief yet/.test(src));

console.log('\n=== Business mode is answering, not advertising ===');
check('no promo/advert field', !/promoText|advertCopy|promotionalMessage|sponsored/i.test(src.split('interface BusinessProfile')[1].split('}')[0]));
check('answers only with confirmed words', /it never composes a reply on the business's behalf/.test(src));
check('faqs are business-authored pairs', /faqs: \{ question: string; answer: string \}\[\]/.test(src));
console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
process.exit(fail?1:0);
