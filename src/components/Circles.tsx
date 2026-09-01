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

  // Starting a circle is part of the same loop: until this existed the only
  // way to get a circle was to have one derived from a source.
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newGoal, setNewGoal] = React.useState('');
  const [newTarget, setNewTarget] = React.useState('');
  const [creating, setCreating] = React.useState(false);

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

  /**
   * The viewer's role in the open circle, or null when not a member.
   *
   * The server now states this on the circle itself (`viewerRole`), which is
   * the authoritative answer. The member list is only a fallback for an older
   * API that does not carry the field -- in which case "not a member" is the
   * honest reading rather than a guess.
   */
  const myRole = React.useMemo(() => {
    if (detail.circle && 'viewerRole' in detail.circle) {
      return detail.circle.viewerRole ?? null;
    }
    const row = members.find((m) => m.userId === currentUserId);
    return row ? row.role : null;
  }, [detail.circle, members, currentUserId]);

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

  // --- coordinator governance ------------------------------------------------
  //
  // The members panel used to be read-only: the server had invite / re-role /
  // remove, but no surface ever called them, so a coordinator could not
  // actually coordinate. Each action below is refused by the server for
  // anybody else; the refusal text is shown verbatim.

  const [govBusy, setGovBusy] = React.useState<string | null>(null);

  const govern = async (
    key: string,
    fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
    okNote: string
  ) => {
    if (!openId) return;
    setGovBusy(key);
    setNotice(null);
    const res = await fn();
    setGovBusy(null);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    setNotice(okNote);
    await loadDetail(openId);
  };

  const handleInviteMember = (userId: string, role: Member['role']) =>
    govern('invite', () => briefApi.inviteMember(openId as string, userId, role), `${userId} is now a member of this circle.`);

  const handleSetRole = (userId: string, role: Member['role']) =>
    govern(userId, () => briefApi.setMemberRole(openId as string, userId, role), `${userId} is now ${role}.`);

  const handleRemoveMember = (userId: string) =>
    govern(userId, () => briefApi.removeMember(openId as string, userId), `${userId} was removed from this circle.`);

  /**
   * JOIN A CIRCLE.
   *
   * This is the step the loop never had. The list used to show every circle in
   * the deployment under the heading "Communities you are part of", with no
   * way to join any of them -- so a person who was not a member was told they
   * were one, and a person who wanted to be one had nothing to press.
   *
   * The server decides whether the join is allowed (an open circle, or one
   * with nobody in it yet). A refusal is shown verbatim: "this circle is
   * invite only" is information, and hiding it would leave somebody wondering
   * whether the button is broken.
   */
  const handleJoin = async (id: string) => {
    setBusyId(id);
    setNotice(null);
    const res = await briefApi.joinCircle(id);
    setBusyId(null);
    if (!res.ok) {
      setNotice(res.error ?? 'could not join this circle');
      return;
    }
    setNotice('You have joined this circle.');
    await load();
    if (openId) await loadDetail(openId);
  };

  /**
   * LEAVE A CIRCLE. Self-service, and scoped to your own membership: there is
   * no userId parameter, so this cannot remove anybody else.
   */
  const handleLeave = async (id: string) => {
    setBusyId(id);
    setNotice(null);
    const res = await briefApi.leaveCircle(id);
    setBusyId(null);
    if (!res.ok) {
      setNotice(res.error ?? 'could not leave this circle');
      return;
    }
    setNotice('You have left this circle.');
    await load();
    if (openId === id) setOpenId(null);
    else if (openId) await loadDetail(openId);
  };

  /** Start a circle. The server makes the creator its coordinator. */
  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setNotice(null);
    const res = await briefApi.createCircle({
      name,
      goal: newGoal.trim() || null,
      targetValue: newTarget ? Number(newTarget) : null
    });
    setCreating(false);
    if (!res.ok) {
      setNotice(res.error ?? 'could not start this circle');
      return;
    }
    setNewName('');
    setNewGoal('');
    setNewTarget('');
    setShowCreate(false);
    setNotice('Circle started — you are its coordinator.');
    await load();
  };

  const open = detail.circle;

  // --- list view ------------------------------------------------------------
  //
  // THE LIST USED TO LIE. It rendered every circle in the deployment under the
  // heading "communities you are part of", and its empty state said "you are
  // not part of any Circle yet" -- so it could show you ten circles while
  // claiming you were in none of them. The list is now split by the one fact
  // that matters: whether you are a member.

  const circles = list.data ?? [];
  const mine = circles.filter((c) => c.isMember === true);
  const joinable = circles.filter((c) => c.isMember !== true && c.canJoin === true);
  const closed = circles.filter((c) => c.isMember !== true && c.canJoin !== true);

  /** One circle card. The action depends on the membership the server reports. */
  const card = (circle: Circle, mode: 'mine' | 'joinable' | 'closed') => (
    <div
      key={circle.id}
      className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[#F7F7F8]">{circle.name}</p>
          <p className="text-[9px] text-[#F7F7F8]/60 mt-0.5">
            {TYPE_LABEL[circle.type] ?? circle.type} &middot; {circle.status}
            {circle.viewerRole ? ` \u00b7 you are ${circle.viewerRole}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {mode === 'joinable' && (
            <button
              onClick={() => void handleJoin(circle.id)}
              disabled={busyId === circle.id}
              className="px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
            >
              {busyId === circle.id ? 'Joining…' : 'Join'}
            </button>
          )}
          {mode === 'mine' && (
            <button
              onClick={() => void handleLeave(circle.id)}
              disabled={busyId === circle.id}
              className="px-3 py-1.5 rounded-xl border border-[#222630] text-[10px] font-bold text-[#F7F7F8]/60 cursor-pointer disabled:opacity-50"
            >
              {busyId === circle.id ? 'Leaving…' : 'Leave'}
            </button>
          )}
          <button
            onClick={() => {
              setOpenId(circle.id);
              setSection('overview');
              setNotice(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer"
          >
            Open
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-[10px] text-[#F7F7F8]/60">
          {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className="text-[10px] text-[#F7F7F8]/60">
          {circle.blockCount} {circle.blockCount === 1 ? 'block' : 'blocks'}
        </span>
        {circle.contributorCount > 0 && (
          <span className="text-[10px] text-[#F7F7F8]/60">
            {circle.contributorCount} contributing
          </span>
        )}
        {mode === 'closed' && (
          <span className="text-[10px] text-[#F7F7F8]/60">
            Invite only — a coordinator has to add you
          </span>
        )}
      </div>

      <CircleTarget circle={circle} compact />
    </div>
  );

  if (!openId) {
    return (
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-[#F7F7F8]">Circles</h2>
            <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
              Communities, split by whether you are in them. People, purpose,
              blocks, signals and targets -- with progress derived from real
              contributions.
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="shrink-0 px-3 py-2 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer"
          >
            {showCreate ? 'Cancel' : 'Start a circle'}
          </button>
        </div>

        {notice && (
          <div className="border border-[#222630] bg-[#12151A] rounded-xl px-3 py-2">
            <p className="text-[10px] text-[#F7F7F8] leading-snug">{notice}</p>
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="bg-[#12151A] border border-[#222630] rounded-2xl p-4 space-y-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Circle name"
              className="w-full rounded-xl border border-[#222630] px-3 py-2 text-[12px] text-[#F7F7F8]"
            />
            <input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="What is it for? (optional)"
              className="w-full rounded-xl border border-[#222630] px-3 py-2 text-[12px] text-[#F7F7F8]"
            />
            <input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Money target, if it has one (optional)"
              inputMode="decimal"
              className="w-full rounded-xl border border-[#222630] px-3 py-2 text-[12px] text-[#F7F7F8]"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-3 py-2 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Starting…' : 'Start circle'}
            </button>
            <p className="text-[10px] text-[#F7F7F8]/70">
              You become its coordinator, so you can add other people.
            </p>
          </form>
        )}

        {(list.status === 'loading' || list.status === 'idle') && (
          <p className="text-xs text-[#F7F7F8]/60">Loading...</p>
        )}

        {list.status === 'error' && (
          <div className="border border-[#222630] bg-[#12151A] rounded-2xl p-4">
            <p className="text-[11px] text-[#F7F7F8] leading-snug">
              Couldn't load circles. {list.error}
            </p>
            <button
              onClick={load}
              className="mt-2 text-[10px] font-extrabold text-[#F7F7F8] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {list.status === 'ready' && circles.length === 0 && (
          <div className="border border-dashed border-[#222630] rounded-2xl p-8 text-center">
            <p className="text-xs text-[#F7F7F8]/60">
              There are no circles here yet.
            </p>
            <p className="text-[10px] text-[#F7F7F8]/60 mt-1">
              Start one, or join an open one when somebody starts it.
            </p>
          </div>
        )}

        {mine.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8]/60">
              Circles you are in ({mine.length})
            </h3>
            {mine.map((circle) => card(circle, 'mine'))}
          </div>
        )}

        {list.status === 'ready' && mine.length === 0 && circles.length > 0 && (
          <div className="border border-dashed border-[#222630] rounded-2xl p-6 text-center">
            <p className="text-xs text-[#F7F7F8]/60">
              You are not part of any Circle yet.
            </p>
            <p className="text-[10px] text-[#F7F7F8]/60 mt-1">
              The ones below are open — joining takes one press.
            </p>
          </div>
        )}

        {joinable.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8]/60">
              Open to join ({joinable.length})
            </h3>
            {joinable.map((circle) => card(circle, 'joinable'))}
          </div>
        )}

        {closed.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F7F7F8]/60">
              Invite only ({closed.length})
            </h3>
            {closed.map((circle) => card(circle, 'closed'))}
          </div>
        )}
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
        className="text-[10px] text-[#F7F7F8] cursor-pointer"
      >
        Back to your circles
      </button>

      {detail.status === 'loading' && (
        <p className="text-xs text-[#F7F7F8]/60 mt-2">Loading...</p>
      )}

      {detail.status === 'error' && (
        <p className="text-[11px] text-[#F7F7F8] mt-2">
          Couldn't load this circle. {detail.error}
        </p>
      )}

      {detail.status === 'ready' && open && (
        <>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-extrabold text-[#F7F7F8]">{open.name}</h2>
              <p className="text-[9px] text-[#F7F7F8]/60 mt-0.5">
                {TYPE_LABEL[open.type] ?? open.type} &middot; {open.visibility}
                {myRole ? ` \u00b7 you are ${myRole}` : ' \u00b7 not a member'}
              </p>
            </div>
            {myRole ? (
              <button
                onClick={() => void handleLeave(open.id)}
                disabled={busyId === open.id}
                className="shrink-0 px-3 py-1.5 rounded-xl border border-[#222630] text-[10px] font-bold text-[#F7F7F8]/60 cursor-pointer disabled:opacity-50"
              >
                {busyId === open.id ? 'Leaving…' : 'Leave circle'}
              </button>
            ) : open.canJoin ? (
              <button
                onClick={() => void handleJoin(open.id)}
                disabled={busyId === open.id}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-[#FF5A1F] text-[#0D0F12] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
              >
                {busyId === open.id ? 'Joining…' : 'Join circle'}
              </button>
            ) : (
              <span className="shrink-0 text-[10px] text-[#F7F7F8]/60">
                Invite only
              </span>
            )}
          </div>

          {open.description && (
            <p className="text-[11px] text-[#F7F7F8]/60 leading-snug mt-1">
              {open.description}
            </p>
          )}
          {/* Leaving is honest about what it does and does not undo. */}
          {myRole && (
            <p className="text-[10px] text-[#F7F7F8]/60 mt-1">
              Leaving removes your membership. Work you were holding keeps your
              name on it, and money that settled stays settled.
            </p>
          )}

          {/* Section rail. Same visual language as the rest of Brief. */}
          <div className="flex gap-1.5 flex-wrap">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer ${
                  section === s.id
                    ? 'bg-[#FF5A1F] text-[#0D0F12]'
                    : 'bg-[#12151A] border border-[#222630] text-[#F7F7F8]/70'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* A refused action reports the server's own reason. */}
          {notice && (
            <div className="border border-[#222630] bg-[#12151A] rounded-xl px-3 py-2">
              <p className="text-[10px] text-[#F7F7F8] leading-snug">{notice}</p>
            </div>
          )}

          {section === 'overview' && (
            <div className="space-y-4">
              {open.goal && (
                <div>
                  <h3 className="text-[11px] font-extrabold text-[#F7F7F8]/60 mb-1">
                    Purpose
                  </h3>
                  <p className="text-[11px] text-[#F7F7F8] leading-snug">{open.goal}</p>
                </div>
              )}

              <div>
                <h3 className="text-[11px] font-extrabold text-[#F7F7F8]/60 mb-2">
                  Target
                </h3>
                <CircleTarget circle={open} />
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="text-[10px] text-[#F7F7F8]/60">
                  {open.memberCount} {open.memberCount === 1 ? 'member' : 'members'}
                </span>
                <span className="text-[10px] text-[#F7F7F8]/60">
                  {open.blockCount} {open.blockCount === 1 ? 'block' : 'blocks'}
                </span>
              </div>

              {/* Blocks that are neither tasks nor votes -- notes, pins and
                  anything wrapping an extracted object. */}
              <div>
                <h3 className="text-[11px] font-extrabold text-[#F7F7F8]/60 mb-2">
                  Blocks
                </h3>
                {detail.blocks.filter((b) => b.type !== 'task' && b.type !== 'vote')
                  .length === 0 ? (
                  <p className="text-xs text-[#F7F7F8]/60">Nothing posted yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.blocks
                      .filter((b) => b.type !== 'task' && b.type !== 'vote')
                      .map((block) => (
                        <div
                          key={block.id}
                          className="bg-[#12151A] border border-[#222630] rounded-2xl p-3"
                        >
                          <p className="text-[9px] text-[#F7F7F8]">
                            {block.type}
                          </p>
                          <p className="text-xs text-[#F7F7F8] mt-1">{block.content}</p>
                          {block.sources.length > 0 && block.sources[0].sourceName && (
                            <p className="text-[9px] text-[#F7F7F8]/60 mt-1">
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
              canGovern={myRole === 'coordinator'}
              currentUserId={currentUserId}
              busyUserId={govBusy}
              onInvite={handleInviteMember}
              onRole={handleSetRole}
              onRemove={handleRemoveMember}
            />
          )}

          {section === 'activity' && <CircleActivity signals={detail.signals} />}
        </>
      )}
    </section>
  );
}
