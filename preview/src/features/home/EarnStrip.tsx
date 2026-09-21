// ---------------------------------------------------------------------------
// EARN STRIP — the income rails, on the screen people actually open.
//
// The brief's point: the money rails live on You → Earn, and a member who never
// opens that screen never sees that the rails exist. So the rails get a surface
// here — the SAME three reads EarnSurface uses, from the same endpoints, with no
// second copy of the arithmetic. Two rails are counts of rows, one is a
// conversion rate the server publishes, and every one of them renders as `—`
// when the read failed, never as 0 and never as an estimate.
//
// What this deliberately does not do:
//   * no "you could have earned", no missed-KES, no projection of next month;
//   * no tier, badge, rank or streak on any of it (the pool has none — see
//     `position.js`: "deliberately NO fabricated rider queue, NO tier/badge
//     ladder, NO streak");
//   * no "1 conversion pending" dressed as money in the pocket: a pending
//     conversion is finance's queue, not cash, and it is labelled that way.
// The rate line states the ratio it uses, because a number divided by a rate the
// reader cannot see is not information.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { Coins, Users, Wallet, ArrowRight } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { MyReferrals, FieldAgentOverview, LipaMdogoContract } from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

const EMPTY = '—';
const kes = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? `KES ${n.toLocaleString('en-KE')}` : EMPTY;

type Rail = {
  key: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  /** A real count behind the value, or null when the read failed. */
  sub: string;
  failed: boolean;
};

export function EarnStrip({
  onOpenEarn,
  className = ''
}: {
  onOpenEarn?: () => void;
  className?: string;
}) {
  const [refs, setRefs] = useState<MyReferrals | null>(null);
  const [agent, setAgent] = useState<FieldAgentOverview | null>(null);
  const [contracts, setContracts] = useState<LipaMdogoContract[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Statuses, not booleans. "There is nobody signed in" and "the reads failed"
  // are two different absences and the screen must not say the wrong one: a
  // signed-out visitor gets a sentence about what the rails are, and a member
  // whose reads failed gets dashes plus a way to try again.
  const [statuses, setStatuses] = useState<{ refs: number | null; agent: number | null; contracts: number | null } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all([
      briefApi.myReferrals(),
      briefApi.getMyFieldAgent(),
      briefApi.getMyLipaMdogo()
    ]).then(([r, a, c]) => {
      if (!live) return;
      setLoaded(true);
      // `status` exists only on the failure arm of ApiResult, so read it there.
      setStatuses({
        refs: r.ok ? 200 : r.status,
        agent: a.ok ? 200 : a.status,
        contracts: c.ok ? 200 : c.status
      });
      setRefs(r.ok ? r.data : null);
      setAgent(a.ok ? a.data : null);
      setContracts(c.ok ? c.data : null);
    });
    return () => { live = false; };
  }, [attempt]);

  const allFailed = !!statuses && !refs && !agent && !contracts;
  const signedOut = !!statuses && statuses.refs === 401;
  const anyFailed = !refs || !agent || !contracts;

  const pending = refs?.conversions.filter((x) => x.status === 'pending').length ?? 0;
  const rails: Rail[] = [
    {
      key: 'points',
      icon: <Coins className="w-3.5 h-3.5" />,
      label: 'Points available',
      value: refs ? String(refs.balance.available) : EMPTY,
      // The rate is quoted, never applied here. The server decides what a
      // conversion is worth at the moment it is requested (and refuses when the
      // pool cannot pay); a second copy of that arithmetic on a home screen would
      // be a number that can quietly disagree with the money.
      sub: refs
        ? `100 points = KES ${Math.round(100 * refs.conversion.ptsToKes)} · min ${refs.conversion.minPoints} to convert`
        : 'the pool, when it can be read',
      failed: !refs
    },
    {
      key: 'visits',
      icon: <Users className="w-3.5 h-3.5" />,
      label: 'Field visits',
      value: agent ? `${agent.earnings.approved} approved` : EMPTY,
      sub: agent
        ? `${kes(agent.earnings.approvedKes)} earned · KES ${agent.earnings.feeKes} per approved visit, paid weekly`
        : 'visits to shops, once an operator approves them',
      failed: !agent
    },
    {
      key: 'financing',
      icon: <Wallet className="w-3.5 h-3.5" />,
      label: 'Lipa mdogo',
      value: contracts ? String(contracts.length) : EMPTY,
      sub: contracts
        ? `${contracts.filter((c) => c.maturity === 'overdue').length} overdue · ${contracts.filter((c) => c.maturity === 'matured').length} matured`
        : 'contracts you are party to',
      failed: !contracts
    }
  ];

  // Three cards of zeros is not information, it is furniture. When every rail
  // read successfully AND every rail has nothing in it, the honest screen is the
  // absence of this section — and the moment one rail has a row, the whole strip
  // appears with its real numbers. A failed read is NOT treated as zero: it
  // renders, with dashes, because "we could not read it" and "you have nothing"
  // are different facts and must not look alike.
  const nothingAtAll =
    loaded &&
    !anyFailed &&
    (refs?.balance.available ?? 0) === 0 &&
    refs.events.length === 0 &&
    refs.conversions.length === 0 &&
    (agent?.earnings.visits.length ?? 0) === 0 &&
    agent.settlements.length === 0 &&
    (contracts?.length ?? 0) === 0;
  if (nothingAtAll) return null;

  return (
    <section
      className={`rounded-2xl p-3 ${className}`}
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
      aria-label="What you earn through Trace"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
          What you can earn here
        </h2>
        {onOpenEarn && (
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onOpenEarn(); }}
            className="inline-flex items-center gap-1 text-[11px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            Earn
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {signedOut ? (
        <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          Three rails run through here — points from the referral pool, KES 150 for each approved visit to a
          shop you onboard, and the Lipa mdogo contracts you are party to. Sign in and your own figures appear
          in place of this line.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {rails.map((r) => (
            <li key={r.key} className="rounded-xl p-2.5" style={{ background: 'var(--color-primary-subtle)' }}>
              <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {r.icon}
                {r.label}
              </p>
              <p className="mt-1 text-[15px] font-black leading-none" style={{ color: 'var(--color-text)' }}>
                {loaded ? r.value : EMPTY}
              </p>
              <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                {loaded ? r.sub : 'reading your rows'}
              </p>
            </li>
          ))}
        </ul>
      )}

      {loaded && !signedOut && pending > 0 && (
        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          {pending} conversion{pending === 1 ? '' : 's'} waiting on finance. Not cash yet, and not counted as available.
        </p>
      )}

      {allFailed && (
        <p className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          The reads behind these figures did not answer, so nothing here is a count of your earnings.
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setLoaded(false); setStatuses(null); setAttempt((n) => n + 1); }}
            className="font-bold underline cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            Try again
          </button>
        </p>
      )}
    </section>
  );
}

export default EarnStrip;
