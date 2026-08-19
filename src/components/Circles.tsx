import React from 'react';
import * as briefApi from '../api/briefApi';
import type { Block, Circle, Member, MemberEvidence, Signal } from '../api/types';
import { CircleTarget } from './circle/CircleTarget';
import { CircleTasks } from './circle/CircleTasks';
import { CircleVotes } from './circle/CircleVotes';
import { CircleActivity } from './circle/CircleActivity';
import { CircleMembers } from './circle/CircleMembers';

/**
 * CIRCLES -- Brief's one community primitive.
 *
 * A Circle is a small operating system for a community: People, Purpose,
 * Place, Blocks, Signals, Targets and economic activity. It is deliberately
 * not another social feed, and deliberately not the same thing as a connected
 * messaging group (see ConnectedGroups.tsx) -- a group is a pipe Brief reads,
 * a Circle is a community that does things.
 *
 * This container owns data and actions; the sections under ./circle/ own
 * presentation. Rules held across all of them:
 *
 *   - Target progress is SERVER-DERIVED from settled transactions. Nothing
 *     here computes it, and the client cannot write it.
 *   - Vote tallies are recomputed server-side from ballot rows on every read.
 *   - Trust is an evidence list, never a score.
 *   - Authority is enforced by the SERVER. Role checks in the UI only avoid
 *     offering actions that would be refused; they are not the protection.
 *   - Empty means empty. Nothing is seeded to make a quiet circle look busy.
 */

const TYPE_LABEL: Record<string, string> = {
  gathering: 'Gathering',
  build: 'Build',
  study: 'Study',
  treasury: 'Treasury',
  match: 'Match',
  target: 'Target'
};

type Section = 'overview' | 'tasks' | 'votes' | 'members' | 'activity';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'votes', label: 'Votes' },
  { id: 'members', label: 'Members' },
  { id: 'activity', label: 'Activity' }
];

export interface CirclesProps {
  /** The viewing user. Defaults to the server's single-user constant. */
  currentUserId?: string;
}

export function Circles({ currentUserId = 'usr_me' }: CirclesProps = {}) {
  const [list, setList] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: Circle[] | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [section, setSection] = React.useState<Section>('overview');

  const [detail, setDetail] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    circle: Circle | null;
    blocks: Block[];
    signals: Signal[];
    error: string | null;
  }>({ status: 'idle', circle: null, blocks: [], signals: [], error: null });

  const [members, setMembers] = React.useState<Member[]>([]);
  const [evidence, setEvidence] = React.useState<
    Record<string, MemberEvidence | 'loading' | 'error'>
  >({});
  const [expandedMember, setExpandedMember] = React.useState<string | null>(null);

  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [votedIds, setVotedIds] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setList((p) => ({ ...p, status: 'loading', error: null }));
    const res = await briefApi.getCircles();
    setList(
      res.ok
        ? { status: 'ready', data: res.data, error: null }
        : { status: 'error', data: null, error: res.error }
    );
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Re-read the open circle from the server after any action.
   *
   * Deliberately a full refetch rather than a local patch: task state, vote
   * tallies and target progress are all server-derived, and mutating a local
   * copy would risk showing a number the server never produced.
   */
  const loadDetail = React.useCallback(async (id: string) => {
    const [res, memberRes] = await Promise.all([
      briefApi.getCircle(id),
      briefApi.getMembers(id)
    ]);
    if (res.ok) {
      setDetail({
        status: 'ready',
        circle: res.data.circle,
        blocks: res.data.blocks,
        signals: res.data.signals,
        error: null
      });
    } else {
      setDetail({
        status: 'error',
        circle: null,
        blocks: [],
        signals: [],
        error: res.error
      });
    }
    setMembers(memberRes.ok ? memberRes.data : []);
  }, []);

  React.useEffect(() => {
    if (!openId) return;
    setDetail({ status: 'loading', circle: null, blocks: [], signals: [], error: null });
    void loadDetail(openId);
  }, [openId, loadDetail]);

  /** The viewer's role in the open circle, or null when not a member. */
  const myRole = React.useMemo(() => {
    const row = members.find((m) => m.userId === currentUserId);
    return row ? row.role : null;
  }, [members, currentUserId]);

  // --- actions --------------------------------------------------------------
  //
  // Each reports the server's own error text on failure. A refused action says
  // why rather than failing silently or pretending it worked.

  const run = async (
    blockId: string,
    fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
    onOk?: () => void
  ) => {
    if (!openId) return;
    setBusyId(blockId);
    setNotice(null);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    onOk?.();
    await loadDetail(openId);
  };

  const handleAssign = (blockId: string) =>
    run(blockId, () => briefApi.assignTask(openId as string, blockId));

  const handleRelease = (blockId: string) =>
    run(blockId, () => briefApi.releaseTask(openId as string, blockId));

  const handleComplete = (blockId: string) =>
    run(blockId, () => briefApi.completeTask(openId as string, blockId));

  const handleVote = (blockId: string, option: string) =>
    run(blockId, () => briefApi.castVote(openId as string, blockId, option), () =>
      setVotedIds((prev) => (prev.includes(blockId) ? prev : [...prev, blockId]))
    );

  const handleCloseVote = (blockId: string) =>
    run(blockId, () => briefApi.closeVote(openId as string, blockId));

  const handleToggleMember = async (userId: string) => {
    if (expandedMember === userId) {
      setExpandedMember(null);
      return;
    }
    setExpandedMember(userId);
    if (evidence[userId] && evidence[userId] !== 'error') return;

    setEvidence((prev) => ({ ...prev, [userId]: 'loading' }));
    const res = await briefApi.getMemberEvidence(openId as string, userId);
    setEvidence((prev) => ({ ...prev, [userId]: res.ok ? res.data : 'error' }));
  };

  const open = detail.circle;

  // --- list view ------------------------------------------------------------
  if (!openId) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-extrabold text-[#F2EFE7]">Circles</h2>
          <p className="text-[11px] text-[#9A9278] leading-snug mt-1">
            Communities you are part of. People, purpose, blocks, signals and
            targets -- with progress derived from real contributions.
          </p>
        </div>

        {(list.status === 'loading' || list.status === 'idle') && (
          <p className="text-xs text-[#9A9278]">Loading...</p>
        )}

        {list.status === 'error' && (
          <div className="border border-[#3A2A1E] bg-[#1A1109] rounded-2xl p-4">
            <p className="text-[11px] text-[#C2A24A] leading-snug">
              Couldn't load circles. {list.error}
            </p>
            <button
              onClick={load}
              className="mt-2 text-[10px] font-extrabold text-[#3E9A66] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {list.status === 'ready' && (list.data ?? []).length === 0 && (
          <div className="border border-dashed border-[#3B372B] rounded-2xl p-8 text-center">
            <p className="text-xs text-[#9A9278]">
              You are not part of any Circle yet.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {(list.data ?? []).map((circle) => (
            <div
              key={circle.id}
              className="bg-[#28261F] border border-[#3B372B] rounded-2xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-[#F2EFE7]">
                    {circle.name}
                  </p>
                  <p className="text-[9px] font-mono uppercase text-[#6F6A58] mt-0.5">
                    {TYPE_LABEL[circle.type] ?? circle.type} &middot; {circle.status}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setOpenId(circle.id);
                    setSection('overview');
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-[#3E9A66] text-[#191714] font-extrabold text-[10px] cursor-pointer"
                >
                  Open
                </button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[10px] text-[#B6AFA0]">
                  {circle.memberCount}{' '}
                  {circle.memberCount === 1 ? 'member' : 'members'}
                </span>
                <span className="text-[10px] text-[#B6AFA0]">
                  {circle.blockCount}{' '}
                  {circle.blockCount === 1 ? 'block' : 'blocks'}
                </span>
                {circle.contributorCount > 0 && (
                  <span className="text-[10px] text-[#B6AFA0]">
                    {circle.contributorCount} contributing
                  </span>
                )}
              </div>

              <CircleTarget circle={circle} compact />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // --- detail view ----------------------------------------------------------
  return (
    <section className="space-y-4">
      <button
        onClick={() => {
          setOpenId(null);
          setNotice(null);
          setExpandedMember(null);
        }}
        className="text-[10px] text-[#7FA98B] cursor-pointer"
      >
        Back to your circles
      </button>

      {detail.status === 'loading' && (
        <p className="text-xs text-[#9A9278] mt-2">Loading...</p>
      )}

      {detail.status === 'error' && (
        <p className="text-[11px] text-[#C2A24A] mt-2">
          Couldn't load this circle. {detail.error}
        </p>
      )}

      {detail.status === 'ready' && open && (
        <>
          <div className="mt-2">
            <h2 className="text-lg font-extrabold text-[#F2EFE7]">{open.name}</h2>
            <p className="text-[9px] font-mono uppercase text-[#6F6A58] mt-0.5">
              {TYPE_LABEL[open.type] ?? open.type} &middot; {open.visibility}
              {myRole ? ` \u00b7 you are ${myRole}` : ' \u00b7 not a member'}
            </p>
            {open.description && (
              <p className="text-[11px] text-[#9A9278] leading-snug mt-1">
                {open.description}
              </p>
            )}
          </div>

          {/* Section rail. Same visual language as the rest of Brief. */}
          <div className="flex gap-1.5 flex-wrap">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer ${
                  section === s.id
                    ? 'bg-[#3E9A66] text-[#191714]'
                    : 'bg-[#28261F] border border-[#3B372B] text-[#B6AFA0]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* A refused action reports the server's own reason. */}
          {notice && (
            <div className="border border-[#3A2A1E] bg-[#1A1109] rounded-xl px-3 py-2">
              <p className="text-[10px] text-[#C2A24A] leading-snug">{notice}</p>
            </div>
          )}

          {section === 'overview' && (
            <div className="space-y-4">
              {open.goal && (
                <div>
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#6F6A58] mb-1">
                    Purpose
                  </h3>
                  <p className="text-[11px] text-[#7FA98B] leading-snug">{open.goal}</p>
                </div>
              )}

              <div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#6F6A58] mb-2">
                  Target
                </h3>
                <CircleTarget circle={open} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[10px] text-[#B6AFA0]">
                  {open.memberCount} {open.memberCount === 1 ? 'member' : 'members'}
                </span>
                <span className="text-[10px] text-[#B6AFA0]">
                  {open.blockCount} {open.blockCount === 1 ? 'block' : 'blocks'}
                </span>
              </div>

              {/* Blocks that are neither tasks nor votes -- notes, pins and
                  anything wrapping an extracted object. */}
              <div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#6F6A58] mb-2">
                  Blocks
                </h3>
                {detail.blocks.filter((b) => b.type !== 'task' && b.type !== 'vote')
                  .length === 0 ? (
                  <p className="text-xs text-[#9A9278]">Nothing posted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.blocks
                      .filter((b) => b.type !== 'task' && b.type !== 'vote')
                      .map((block) => (
                        <div
                          key={block.id}
                          className="bg-[#28261F] border border-[#3B372B] rounded-2xl p-3"
                        >
                          <p className="text-[9px] font-mono uppercase text-[#7FA98B]">
                            {block.type}
                          </p>
                          <p className="text-xs text-[#F2EFE7] mt-1">{block.content}</p>
                          {block.sources.length > 0 && block.sources[0].sourceName && (
                            <p className="text-[9px] font-mono text-[#6F6A58] mt-1">
                              via {block.sources[0].sourceName}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <CircleActivity signals={detail.signals} limit={5} />
            </div>
          )}

          {section === 'tasks' && (
            <CircleTasks
              blocks={detail.blocks}
              currentUserId={currentUserId}
              myRole={myRole}
              busyId={busyId}
              onAssign={handleAssign}
              onRelease={handleRelease}
              onComplete={handleComplete}
            />
          )}

          {section === 'votes' && (
            <CircleVotes
              blocks={detail.blocks}
              myRole={myRole}
              busyId={busyId}
              votedIds={votedIds}
              onVote={handleVote}
              onClose={handleCloseVote}
            />
          )}

          {section === 'members' && (
            <CircleMembers
              members={members}
              evidence={evidence}
              expandedId={expandedMember}
              onToggle={handleToggleMember}
            />
          )}

          {section === 'activity' && <CircleActivity signals={detail.signals} />}
        </>
      )}
    </section>
  );
}
