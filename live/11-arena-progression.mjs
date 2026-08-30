// PHASE 11 (server running): the Arena retention layer, over HTTP through
// the production proxy. XP/Coins are POINTS (they buy nothing, cash out
// nowhere); every number is derived from confirmed matches and claimed
// missions; the live strip counts real things only.
const B = 'http://127.0.0.1:4173/ingest';
let pass=0, fail=0;
const check=(n,c,d='')=>{ if(c){pass++;console.log('  PASS  '+n);} else {fail++;console.log('  FAIL  '+n+(d?' -> '+d:''));} };
let TOKEN = null;
const call = async (p,m='GET',b,token=TOKEN) => {
  const headers = {};
  if (b) headers['content-type']='application/json';
  if (token) headers.authorization = 'Bearer '+token;
  const r = await fetch(B+p,{method:m,headers,body:b?JSON.stringify(b):undefined});
  let j=null; try{ j=await r.json(); }catch{}
  return { status:r.status, body:j };
};
console.log('=== PHASE 11: Arena progression, over HTTP ===');
const uniq = Date.now().toString(36);

// 1. Gate.
let r = await call('/api/arena/progress/me','GET',undefined,null);
check('progress is members-only (401)', r.status===401, r.status);

// 2. Two players, one confirmed match — the earning moment.
const reg = async (handle) => (await call('/api/auth/register','POST',{ handle:handle+'_'+uniq, password:'a good passphrase' },null)).body;
const A = await reg('arenaa'); const Bp = await reg('arenab');
await call('/api/arena/players','POST',{ gameId:'efootball', gamerTag:'AA'+uniq.slice(-4) }, A.token);
await call('/api/arena/players','POST',{ gameId:'efootball', gamerTag:'BB'+uniq.slice(-4) }, Bp.token);
const ch = (await call('/api/arena/challenges','POST',{ gameId:'efootball', mode:'1v1', stake:'friendly', openForHours:2 }, A.token)).body.challenge;
const acc = await call(`/api/arena/challenges/${ch.id}/accept`,'POST',{}, Bp.token);
const mid = acc.body.match.id;
await call(`/api/arena/matches/${mid}/report`,'POST',{ winnerPlayerId: A.user.id, scoreLine:'2-0' }, A.token);
r = await call(`/api/arena/matches/${mid}/confirm`,'POST',{}, Bp.token);
check('the confirming player sees their own earnings', r.body?.yourRewards?.xp===30, JSON.stringify(r.body?.yourRewards));

// 3. Winner earned more; both are derived.
r = await call('/api/arena/progress/me','GET',undefined, A.token);
check('the winner earned 100 XP + 25 Coins', r.body?.profile?.totalXp===100 && r.body?.profile?.totalCoins===25, JSON.stringify(r.body?.profile));
check('rating is a justified replay (winner above 1000)', r.body?.players?.[0]?.stats?.rating>1000, JSON.stringify(r.body?.players?.[0]?.stats));
r = await call('/api/arena/progress/me','GET',undefined, Bp.token);
check('the loser earned participation XP only', r.body?.profile?.totalXp===30 && r.body?.profile?.totalCoins===0, JSON.stringify(r.body?.profile));

// 4. Missions: derived, claimable once.
r = await call('/api/arena/progress/me','GET',undefined, A.token);
check('play_1 is claimable after one confirmed match', r.body?.missions?.find((x)=>x.key==='play_1')?.claimable===true, JSON.stringify(r.body?.missions?.map((m)=>m.key+':'+m.progress)));
r = await call('/api/arena/missions/win_2/claim','POST',{}, A.token);
check('an incomplete mission refuses with the reason', r.status===400, JSON.stringify(r.body).slice(0,100));
r = await call('/api/arena/missions/play_1/claim','POST',{}, A.token);
check('claiming play_1 grants +50 XP', r.status===201 && r.body?.profile?.totalXp===150, JSON.stringify(r.body?.profile).slice(0,100));
r = await call('/api/arena/missions/play_1/claim','POST',{}, A.token);
check('once per day', r.status===400 && /already claimed/.test(r.body?.error ?? ''), JSON.stringify(r.body).slice(0,100));

// 5. The live strip counts real things.
r = await call('/api/arena/live','GET',undefined, A.token);
check('the strip counts real activity', r.body?.playersActiveLastHour>=2, JSON.stringify(r.body));
check('the season carries its clock', r.body?.season?.id==='season-01' && r.body?.season?.daysRemaining>0);

// 6. Season leaderboard + YOU.
r = await call('/api/arena/season/leaderboard','GET',undefined, A.token);
check('the season leaderboard ranks XP', r.body?.rows?.length>=2 && r.body?.rows[0].xp>=r.body?.rows[1].xp, JSON.stringify(r.body?.rows?.slice(0,2)));
check('the YOU row is the caller\'s own', r.body?.you?.userId===A.user.id && r.body?.you?.rank===1, JSON.stringify(r.body?.you));

// 7. A repeated opponent becomes a rival.
const ch2 = (await call('/api/arena/challenges','POST',{ gameId:'efootball', mode:'1v1', stake:'friendly', openForHours:2 }, Bp.token)).body.challenge;
const acc2 = await call(`/api/arena/challenges/${ch2.id}/accept`,'POST',{}, A.token);
await call(`/api/arena/matches/${acc2.body.match.id}/report`,'POST',{ winnerPlayerId: Bp.user.id }, Bp.token);
await call(`/api/arena/matches/${acc2.body.match.id}/confirm`,'POST',{}, A.token);
r = await call('/api/arena/progress/me','GET',undefined, A.token);
check('a repeated opponent is a rival with a true record',
  (r.body?.rivals ?? []).some((x)=>x.userId===Bp.user.id && x.played===2 && x.iWon===1), JSON.stringify(r.body?.rivals));

console.log(`\nPHASE 11 RESULT: ${pass} passed / ${fail} failed`);
process.exit(fail?1:0);
