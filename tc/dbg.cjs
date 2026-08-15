const INTENT=new Set(['find','show','get','look','looking','search','watch','monitor','track','want','need','me','my','a','an','the','for','near','nearby','around','this','that','week','today','tomorrow','good','best','cheapest','cheap','any','some','one','ones','thing','things','please','where','what','is','are','in','on','at','to','of','and']);
const terms=q=>Array.from(new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2&&!INTENT.has(w))));
console.log('terms("50W solar kit") =',terms('50W solar kit'));
const hay='kikao hardware price list. kikao hardware price list. solar panel, battery, lighting kit, inverter. 50w solar kit ksh 18,500.';
for(const t of terms('50W solar kit')) console.log(t,'->',hay.includes(t));
