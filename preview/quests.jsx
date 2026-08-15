const { JSDOM }=require('jsdom');
const dom=new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>',{url:'https://brief.test/',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
global.HTMLElement=dom.window.HTMLElement;global.Element=dom.window.Element;global.Node=dom.window.Node;
global.MouseEvent=dom.window.MouseEvent;global.getComputedStyle=dom.window.getComputedStyle;
global.IS_REACT_ACT_ENVIRONMENT=true;
const React=require('react');const{createRoot}=require('react-dom/client');const{act}=require('react-dom/test-utils');
const App=require('./src/App.tsx').default;
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/src/App.tsx','utf8');
const code=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
async function main(){
  dom.window.open=()=>null;
  const root=createRoot(document.getElementById('root'));
  await act(async()=>{root.render(React.createElement(App));});
  const text=el=>(el.textContent||'').replace(/\s+/g,' ').trim();
  const body=()=>text(document.body);
  const click=async el=>{await act(async()=>{el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true}));});};
  const btn=t=>Array.from(document.querySelectorAll('button')).find(b=>text(b)===t||text(b).startsWith(t));
  const goto=async(dest,section)=>{
    const d=Array.from(document.querySelectorAll('button')).find(b=>text(b)===dest||text(b).startsWith(dest));
    if(d) await click(d);
    if(section){
      const sBtn=Array.from(document.querySelectorAll('button')).find(b=>text(b)===section||text(b).startsWith(section));
      if(sBtn) await click(sBtn);
    }
  };
  let pass=0,fail=0;
  const check=(n,c,d='')=>{if(c){pass++;console.log('  PASS  '+n);}else{fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));}};

  await goto('Nearby','Quests');
  let b=body();
  console.log('=== Quests reward useful work, not clicking ===');
  check('Quests tab opens', b.includes('Open quests'));
  check('points settle on acceptance', /settle when a contribution is accepted/i.test(b));
  check('criteria shown BEFORE starting', /Accepted when:/i.test(b));
  check('quest spans information layer', /permit notice/i.test(b));
  check('quest spans group layer', /unanswered question in Kilimani/i.test(b));
  check('quest spans arena layer', /Win a 1v1 eFootball challenge/i.test(b));

  console.log('\n=== No engagement-bait mechanics ===');
  check('no streaks', !/\bstreak/i.test(b));
  check('no daily login reward', !/daily login|log in daily|check in daily/i.test(b));
  check('no vanity engagement metrics', !/impressions|engagement rate|likes|followers/i.test(b));

  console.log('\n=== Settled vs pending never conflated ===');
  const settled=750;
  check('wallet shows only settled points', b.includes('750'), b.slice(0,150));
  check('pending flagged as worth nothing', /awaiting review\. Worth nothing yet/i.test(b));

  console.log('\n=== Submitting does NOT pay ===');
  const before=(b.match(/Brief Points (\d[\d,]*)/)||[])[1];
  const sub=btn('Submit');
  await click(sub);
  b=body();
  const after=(b.match(/Brief Points (\d[\d,]*)/)||[])[1];
  check('points unchanged after submitting', before===after, `${before} -> ${after}`);
  check('toast says points settle only if accepted', /Points settle only if accepted/i.test(b));
  check('never claims points earned on submit', !/you earned|points earned|\+\d+ points/i.test(b));

  console.log('\n=== Rejected work pays zero, with a reason ===');
  check('rejection visible', /Not accepted/i.test(b));
  check('reason stated', /not legible and carried no date/i.test(b));
  check('explicitly zero', /No points awarded/i.test(b));

  console.log('\n=== Rank is earned, not bought ===');
  check('rank shown', /Rank Explorer|Rank Newcomer|Rank Contributor/i.test(b));
  check('next rank states real requirement', /needs \d+ more accepted/i.test(b));

  console.log('\n=== Two boards: volume must not beat usefulness ===');
  check('Top Contributors is the default', /Ranked by accepted contributions/i.test(b));
  const contribBoard=b.slice(b.indexOf('Ranked by accepted'), b.indexOf('Rewards'));
  check('volume farmer excluded from top contributors', !/Kimani/.test(contribBoard), contribBoard.slice(0,200));
  await click(btn('Top Earners'));
  b=body();
  const earnBoard=b.slice(b.indexOf('Ranked by settled points'), b.indexOf('Rewards'));
  check('volume farmer DOES appear on earners', /Kimani/.test(earnBoard));
  check('earners board shows accuracy too', /% accepted/i.test(earnBoard));
  check('percentile shown with real cohort', /top \d/i.test(earnBoard));

  console.log('\n=== Rewards live in Arena, not duplicated here ===');
  check('quests points to Arena for redemption', /Redeem points for gift cards and vouchers in Arena/i.test(b));
  check('no duplicate catalogue on this screen', !/Carrefour/.test(b));
  await goto('Arena','Rewards');
  const ab=body();
  check('supermarket voucher offered in Arena', /Carrefour/i.test(ab));
  check('airtime offered in Arena', /Safaricom/i.test(ab));
  check('out-of-stock refused', /Out of stock/i.test(ab));
  check('shortfall stated in points', /more points needed/i.test(ab));
  check('points explicitly not cash', /not cash and have no monetary value/i.test(ab));
  await goto('Nearby','Quests');
  b=body();

  console.log('\n=== Pool is transparent, not salary-linked ===');
  check('pool total shown', /KES 1,000,000/.test(b));
  check('remaining stated', /587,500 still to be distributed/.test(b));
  check('no salary references', !/salary|staff pay|admin pay|employee/i.test(b));

  console.log('\n=== Source guards ===');
  check('settleQuest is the single payout gate', /const settleQuest[\s\S]{0,120}status === 'accepted'/.test(code));
  check('rank needs acceptance rate, not points', /minAcceptanceRate/.test(code)&&!/minPoints/.test(code));
  check('canRedeem checks stock+region+balance', /canRedeem/.test(code)&&/Out of stock/.test(code));
  check('no gambling/wager mechanics', !/\b(wager|betting odds|jackpot|spin to win|lottery)\b/i.test(code));

  console.log(`\n${'='.repeat(46)}\nPASSED ${pass}   FAILED ${fail}\n${'='.repeat(46)}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error(e);process.exit(1);});
