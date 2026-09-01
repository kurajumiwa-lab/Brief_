import React from 'react';
import type { Block, MemberRole } from '../../api/types';

/**
 * CIRCLE VOTES.
 *
 * Votes are Blocks of type 'vote'. The tally on `block.tally` is recomputed
 * server-side from the ballot rows on every read -- this component renders it
 * and never counts anything itself.
 *
 * Rules held here:
 *
 *   - `pct === null` (nobody has voted) renders as a dash, not 0%. A zero
 *     percentage would imply a measured result rather than an absent one.
 *   - A tie has no leader, and none is displayed. The server returns
 *     `leader: null` and the UI does not pick a winner to fill the space.
 *   - One member, one vote. A second attempt is refused by the server with a
 *     409; the UI reflects that a ballot was already cast rather than
 *     silently replacing it.
 *   - Every declared option is shown even at zero votes, so a result never
 *     hides what was rejected.
 */

const OPERATIONAL: MemberRole[] = ['coordinator', 'contributor', 'scout', 'logistics'];

export interface CircleVotesProps {
  blocks: Block[];
  myRole: MemberRole | null;
  busyId: string | null;
  /** Block ids the viewer has cast a ballot in this session. */
  votedIds: string[];
  onVote: (blockId: string, option: string) => void;
  onClose: (blockId: string) => void;
}

export function CircleVotes({
  blocks,
  myRole,
  busyId,
  votedIds,
  onVote,
  onClose
}: CircleVotesProps) {
  const votes = blocks.filter((b) => b.type === 'vote');

  if (votes.length === 0) {
    return (
      <div>
        <Heading>Votes</Heading>
        <p className="text-xs text-[#F7F7F8]/60">No votes in this circle.</p>
      </div>
    );
  }

  const canVote = myRole !== null && OPERATIONAL.includes(myRole);
  const isCoordinator = myRole === 'coordinator';

  const active = votes.filter((v) => !v.tally?.closed);
  const closed = votes.filter((v) => v.tally?.closed);

  const row = (vote: Block) => {
    const tally = vote.tally;
    const busy = busyId === vote.id;
    const alreadyVoted = votedIds.includes(vote.id);
    const isClosed = Boolean(tally?.closed);

    return (
      <div
        key={vote.id}
        className="bg-[#12151A] border border-[#222630] rounded-2xl p-3 space-y-2"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-extrabold text-[#F7F7F8] min-w-0">
            {vote.content}
          </p>
          {isClosed && (
            <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#222630] text-[#F7F7F8]/60">
              closed
            </span>
          )}
        </div>

        {/* Turnout, from real rows on both sides. */}
        <p className="text-[10px] text-[#F7F7F8]/60">
          {tally?.totalVotes ?? 0} of {tally?.eligibleCount ?? 0} eligible{' '}
          {(tally?.eligibleCount ?? 0) === 1 ? 'member' : 'members'} voted
        </p>

        <div className="space-y-1.5">
          {(tally?.results ?? []).map((r) => {
            const isLeader = tally?.leader === r.option;
            return (
              <div key={r.option} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`text-[11px] ${
                      isLeader ? 'text-[#F7F7F8] font-extrabold' : 'text-[#F7F7F8]/60'
                    }`}
                  >
                    {r.option}
                  </span>
                  <span className="text-[10px] text-[#F7F7F8]/60 shrink-0">
                    {r.count} {r.count === 1 ? 'vote' : 'votes'}
                    {/* Dash, not 0%: nobody has voted, so there is no share
                        to report. */}
                    {r.pct === null ? ' \u00b7 --' : ` \u00b7 ${Math.round(r.pct)}%`}
                  </span>
                </div>
                <div className="h-1 bg-[#171A20] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isLeader ? 'bg-[#FF5A1F]' : 'bg-[#222630]'}`}
                    style={{ width: `${r.pct ?? 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Only a strict winner is announced. A tie says so. */}
        {isClosed && (
          <p className="text-[10px] text-[#F7F7F8]">
            {tally?.leader
              ? `Result: ${tally.leader}`
              : (tally?.totalVotes ?? 0) === 0
              ? 'Closed with no votes cast.'
              : 'Closed with no clear result.'}
          </p>
        )}

        {!isClosed && canVote && !alreadyVoted && (
          <div className="flex flex-wrap gap-2 pt-1">
            {(tally?.results ?? []).map((r) => (
              <button
                key={r.option}
                onClick={() => onVote(vote.id, r.option)}
                disabled={busy}
                className="px-3 py-1.5 rounded-xl bg-[#12151A] border border-[#222630] text-[#F7F7F8] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
              >
                {busy ? '...' : `Vote ${r.option}`}
              </button>
            ))}
          </div>
        )}

        {!isClosed && alreadyVoted && (
          <p className="text-[10px] text-[#F7F7F8]">
            You have voted. One vote per member.
          </p>
        )}

        {!isClosed && myRole === 'observer' && (
          <p className="text-[10px] text-[#F7F7F8]/60">Observers cannot vote.</p>
        )}

        {!isClosed && isCoordinator && (
          <button
            onClick={() => onClose(vote.id)}
            disabled={busy}
            className="text-[10px] font-extrabold text-[#F7F7F8] cursor-pointer disabled:opacity-50"
          >
            Close this vote
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <Heading>Votes</Heading>

      {active.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Open &middot; {active.length}</SubHeading>
          {active.map(row)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Closed &middot; {closed.length}</SubHeading>
          {closed.map(row)}
        </div>
      )}
    </div>
  );
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[11px] font-extrabold text-[#F7F7F8]/60">
    {children}
  </h3>
);

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-[#F7F7F8]/60">{children}</p>
);
