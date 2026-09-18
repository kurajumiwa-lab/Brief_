import React from 'react';
import * as briefApi from '../api/briefApi';
import type { Block, Circle, Member, MemberEvidence, Signal } from '../api/types';
import { CircleTarget } from './circle/CircleTarget';
import { CircleTasks } from './circle/CircleTasks';
import { CopyId } from '../ui/CopyId';
import { roomSurface } from '../features/city/room';
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
  /** Whose eyes the room is rendered through. Left unset by the surfaces that
   *  mount this on purpose — a default like `'usr_me'` silently makes a fabricated
   *  id mean "you", which is how "Assigned to you" gets attached to a stranger's
   *  work. When it is not passed, the session decides. */
  currentUserId?: string | null;
}

export function Circles({ currentUserId = null }: CirclesProps = {}) {
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
  // "You", resolved from the session rather than guessed. null until it answers:
  // a room that invents your id would also invent your rights.
  const [selfId, setSelfId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (currentUserId) return;
    let live = true;
    void briefApi.whoAmI().then((res) => { if (live && res.ok) setSelfId(res.data?.id ?? null); });
    return () => { live = false; };
  }, [currentUserId]);
  const meId = currentUserId ?? selfId;
  // The room's own history, read on demand: what changed, who did it, and the
  // reason where a reason was required. It is the record the room is FOR.
  const [roomHistory, setRoomHistory] = React.useState<briefApi.CircleHistoryRow[] | null>(null);
  const [welcomeDraft, setWelcomeDraft] = React.useState<string | null>(null);
  const [listingRoom, setListingRoom] = React.useState(false);
  const [listReason, setListReason] = React.useState('');
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
    // History is read with the room rather than lazily per panel: the header,
    // the activity tab and the "what changed" line all need the same rows, and
    // three fetches for one truth is three chances to disagree.
    const hist = await briefApi.getCircleHistory(id, { limit: 30 });
    setRoomHistory(hist.ok ? hist.data.history : null);
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
    const row = meId ? members.find((m) => m.userId === meId) : null;
    return row ? row.role : null;
  }, [detail.circle, members, meId]);

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

  const handleCancelTask = (blockId: string, reason: string) =>
    run(blockId, () => briefApi.cancelTask(openId as string, blockId, reason));

  const handleReopenTask = (blockId: string, reason: string) =>
    run(blockId, () => briefApi.reopenTask(openId as string, blockId, reason));

  const handleVerifyTask = (blockId: string) =>
    run(blockId, () => briefApi.verifyTask(openId as string, blockId));

  const handleTaskDue = (blockId: string, dueAt: string, reason: string) =>
    run(blockId, () => briefApi.editTask(openId as string, blockId, { dueAt, reason }));

  /** Pin the welcome. One sentence the room chooses for itself — the difference
   *  between a database row and a place somebody wants to be in. */
  const handlePinWelcome = async () => {
    if (!openId || welcomeDraft == null) return;
    setGovBusy('welcome');
    setNotice(null);
    const res = await briefApi.pinWelcome(openId, welcomeDraft);
    setGovBusy(null);
    if (!res.ok) { setNotice(res.error); return; }
    setWelcomeDraft(null);
    setNotice('Pinned for everyone in the room.');
    await loadDetail(openId);
  };

  /** Open the room to the list. The server demands a reason, because the people
   *  already inside are the ones whose private room is being made findable. */
  const handleListRoom = async () => {
    if (!openId) return;
    const reason = listReason.trim();
    if (!reason) return;
    setGovBusy('listing');
    setNotice(null);
    const nextVisibility = detail.circle?.visibility === 'discoverable' ? 'invite_only' : 'discoverable';
    const res = await briefApi.setCircleVisibility(openId, nextVisibility, reason);
    setGovBusy(null);
    if (!res.ok) { setNotice(res.error); return; }
    setListingRoom(false);
    setListReason('');
    setNotice(nextVisibility === 'invite_only' ? 'Taken off the list.' : 'Listed — share the link below.');
    await loadDetail(openId);
  };

  const handleVote = (blockId: string, option: string) =>
    run(blockId, () => briefApi.castVote(openId as string, blockId, option), () =>
      setVotedIds((prev) => (prev.includes(blockId) ? prev : [...prev, blockId]))
    );

  const handleCloseVote = (blockId: string) =>
    run(blockId, () => briefApi.closeVote(openId as string, blockId));

  const handleCancelVote = (blockId: string, reason: string) =>
    run(blockId, () => briefApi.cancelVote(openId as string, blockId, reason));

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

  /** The one place a userId becomes a human being. Every panel that names a
   *  person goes through here, so "no raw ids in the room" is one rule, not six. */
  const nameOf = (userId?: string | null): string | null => {
    if (!userId) return null;
    const m = members.find((x) => x.userId === userId);
    return m?.displayName || (m?.handle ? `@${m.handle}` : null);
  };

  // Invitations go by @handle and the server resolves the person, so no screen
  // in this app ever asks a human to type or read a `usr_…` key.
  const handleInviteMember = (handle: string, role: Member['role']) =>
    govern('invite', () => briefApi.inviteMember(openId as string, handle, role), `@${handle.replace(/^@/, '')} is now a member of this room.`);

  const handleSetRole = (userId: string, role: Member['role'], reason: string) =>
    govern(userId, () => briefApi.setMemberRole(openId as string, userId, role, reason), `${nameOf(userId) ?? 'A member'} is now ${role}.`);

  const handleRemoveMember = (userId: string, reason: string) =>
    govern(userId, () => briefApi.removeMember(openId as string, userId, reason), `${nameOf(userId) ?? 'That member'} has been removed, with the reason in the room's history.`);

  const handleTransfer = (userId: string) =>
    govern(userId, () => briefApi.transferCoordinator(openId as string, userId), `${nameOf(userId) ?? 'A new coordinator'} holds the room now.`);

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
      className="bg-[color:var(--color-paper)] border border-[var(--brief-line)] rounded-2xl p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[var(--brief-ink)]">{circle.name}</p>
          <p className="text-[9px] text-[var(--ink-60)] mt-0.5">
            {TYPE_LABEL[circle.type] ?? circle.type} &middot; {circle.status}
            {circle.viewerRole ? ` \u00b7 you are ${circle.viewerRole}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
          {mode === 'joinable' && (
            <button
              onClick={() => void handleJoin(circle.id)}
              disabled={busyId === circle.id}
              className="px-3 py-1.5 rounded-xl bg-[#4F46E5] text-[var(--accent-ink)] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
            >
              {busyId === circle.id ? 'Joining…' : 'Join'}
            </button>
          )}
          {mode === 'mine' && (
            <button
              onClick={() => void handleLeave(circle.id)}
              disabled={busyId === circle.id}
              className="px-3 py-1.5 rounded-xl border border-[var(--brief-line)] text-[10px] font-bold text-[var(--ink-60)] cursor-pointer disabled:opacity-50"
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
            className="px-3 py-1.5 rounded-xl bg-[#4F46E5] text-[var(--accent-ink)] font-extrabold text-[10px] cursor-pointer"
          >
            Open
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-[10px] text-[var(--ink-60)]">
          {circle.memberCount} {circle.memberCount === 1 ? 'member' : 'members'}
        </span>
        <span className="text-[10px] text-[var(--ink-60)]">
          {circle.blockCount} {circle.blockCount === 1 ? 'block' : 'blocks'}
        </span>
        {circle.contributorCount > 0 && (
          <span className="text-[10px] text-[var(--ink-60)]">
            {circle.contributorCount} contributing
          </span>
        )}
        {mode === 'closed' && (
          <span className="text-[10px] text-[var(--ink-60)]">
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
            <h2 className="text-lg font-extrabold" style={{ color: 'var(--color-text)' }}>Circles</h2>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="shrink-0 px-3 py-2 rounded-xl bg-[#4F46E5] text-[var(--accent-ink)] font-extrabold text-[10px] cursor-pointer"
          >
            {showCreate ? 'Cancel' : 'Start a circle'}
          </button>
        </div>

        {notice && (
          <div className="border border-[var(--brief-line)] bg-[color:var(--color-paper)] rounded-xl px-3 py-2">
            <p className="text-[10px] text-[var(--brief-ink)] leading-snug">{notice}</p>
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="bg-[color:var(--color-paper)] border border-[var(--brief-line)] rounded-2xl p-4 space-y-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Circle name"
              className="w-full rounded-xl border border-[var(--brief-line)] px-3 py-2 text-[12px] text-[var(--brief-ink)]"
            />
            <input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="What is it for? (optional)"
              className="w-full rounded-xl border border-[var(--brief-line)] px-3 py-2 text-[12px] text-[var(--brief-ink)]"
            />
            <input
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="Money target, if it has one (optional)"
              inputMode="decimal"
              className="w-full rounded-xl border border-[var(--brief-line)] px-3 py-2 text-[12px] text-[var(--brief-ink)]"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-3 py-2 rounded-xl bg-[#4F46E5] text-[var(--accent-ink)] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
            >
              {creating ? 'Starting…' : 'Start circle'}
            </button>
            <p className="text-[10px] text-[var(--ink-70)]">
              You become its coordinator, so you can add other people.
            </p>
          </form>
        )}

        {(list.status === 'loading' || list.status === 'idle') && (
          <p className="text-xs text-[var(--ink-60)]">Loading...</p>
        )}

        {list.status === 'error' && (
          <div className="border border-[var(--brief-line)] bg-[color:var(--color-paper)] rounded-2xl p-4">
            <p className="text-[11px] text-[var(--brief-ink)] leading-snug">
              Couldn't load circles. {list.error}
            </p>
            <button
              onClick={load}
              className="mt-2 text-[10px] font-extrabold text-[var(--brief-ink)] cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {list.status === 'ready' && circles.length === 0 && (
          <div className="border border-dashed border-[var(--brief-line)] rounded-2xl p-8 text-center">
            <p className="text-xs text-[var(--ink-60)]">
              There are no circles here yet.
            </p>
            <p className="text-[10px] text-[var(--ink-60)] mt-1">
              Start one, or join an open one when somebody starts it.
            </p>
          </div>
        )}

        {mine.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-60)]">
              Circles you are in ({mine.length})
            </h3>
            {mine.map((circle) => card(circle, 'mine'))}
          </div>
        )}

        {list.status === 'ready' && mine.length === 0 && circles.length > 0 && (
          <div className="border border-dashed border-[var(--brief-line)] rounded-2xl p-6 text-center">
            <p className="text-xs text-[var(--ink-60)]">
              You are not part of any Circle yet.
            </p>
            <p className="text-[10px] text-[var(--ink-60)] mt-1">
              The ones below are open — joining takes one press.
            </p>
          </div>
        )}

        {joinable.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-60)]">
              Open to join ({joinable.length})
            </h3>
            {joinable.map((circle) => card(circle, 'joinable'))}
          </div>
        )}

        {closed.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--ink-60)]">
              Invite only ({closed.length})
            </h3>
            {closed.map((circle) => card(circle, 'closed'))}
          </div>
        )}
      </section>
    );
  }

  // --- the room itself ------------------------------------------------------
  //
  // Full screen, not a card inside a browse page. A circle is a place you go to,
  // and a place you can only see through a 55vw column of somebody else's layout
  // is a record, not a room. The overlay covers the app chrome (nav and floating
  // actions) and carries its own bottom padding, so the last row in any list here
  // is reachable by a thumb and not parked under a button.
  return (
    <section
      className="fixed inset-0 z-50 overflow-y-auto space-y-4 px-4 pt-4 pb-40 sm:pb-32"
      style={{ background: 'var(--color-bg)' }}
    >
      <button
        onClick={() => {
          setOpenId(null);
          setNotice(null);
          setExpandedMember(null);
        }}
        className="text-[10px] text-[var(--brief-ink)] cursor-pointer"
      >
        Back to your circles
      </button>

      {detail.status === 'loading' && (
        <p className="text-xs text-[var(--ink-60)] mt-2">Loading...</p>
      )}

      {detail.status === 'error' && (
        <p className="text-[11px] text-[var(--brief-ink)] mt-2">
          Couldn't load this circle. {detail.error}
        </p>
      )}

      {detail.status === 'ready' && open && (
        <>
          <header className="mt-1">
            {/* A cover the room chose, or the room's own plaster. Never a
                placeholder that apologises for itself. */}
            <div
              className="relative h-[92px] w-full rounded-3xl overflow-hidden"
              style={{ background: roomSurface() }}
            >
              <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3">
                <span className="min-w-0">
                  <span className="block text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--color-text-muted)' }}>
                    {open.visibility === 'invite_only' ? 'A private room' : open.visibility === 'discoverable' ? 'Listed room' : 'Open room'}
                    {' · '}{open.memberCount} {open.memberCount === 1 ? 'member' : 'members'}
                  </span>
                  <h2 className="text-[22px] font-extrabold leading-tight truncate" style={{ color: 'var(--brief-ink)' }}>
                    {open.name}
                  </h2>
                </span>
                {myRole ? (
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.72)', color: 'var(--color-primary)' }}>
                    {myRole}
                  </span>
                ) : null}
              </span>
            </div>

            {/* The pinned welcome is the room's identity — one sentence the
                coordinator writes and everyone reads first. Set it, and the
                metadata line nobody asked for is gone. */}
            {(open.welcome || welcomeDraft != null || myRole === 'coordinator') && (
              <div className="mt-2 rounded-2xl p-3" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}>
                {welcomeDraft == null ? (
                  <p className="text-[13px] leading-snug" style={{ color: 'var(--brief-ink)' }}>
                    {open.welcome ?? <span style={{ color: 'var(--color-text-muted)' }}>No welcome note yet — one line for whoever walks in.</span>}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={welcomeDraft}
                      onChange={(e) => setWelcomeDraft(e.target.value.slice(0, 400))}
                      rows={2}
                      maxLength={400}
                      aria-label="welcome note"
                      placeholder="Meet at the gate by 7. Bring the pump."
                      className="w-full px-2.5 py-2 rounded-xl text-[12px] resize-none"
                      style={{ background: 'var(--color-well)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePinWelcome}
                        disabled={govBusy === 'welcome' || !welcomeDraft.trim()}
                        className="px-3 py-1.5 rounded-xl font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                        style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', border: 'none' }}
                      >
                        Pin it
                      </button>
                      <button onClick={() => setWelcomeDraft(null)} className="px-2 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer" style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none' }}>
                        Cancel
                      </button>
                      <span className="ml-auto text-[9px] font-mono" style={{ color: 'var(--color-text-muted)' }}>{400 - welcomeDraft.length}</span>
                    </div>
                  </div>
                )}
                {welcomeDraft == null && myRole === 'coordinator' && (
                  <button onClick={() => setWelcomeDraft(open.welcome ?? '')} className="mt-1.5 text-[10px] font-black cursor-pointer" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}>
                    {open.welcome ? 'Edit' : 'Write one'}
                  </button>
                )}
              </div>
            )}

            {/* What is live in the room, in one card, with the one action that
                moves it. A vote closing, then open work, then nothing — and
                "nothing" is said as nothing, not padded. */}
            {(() => {
              const votes = detail.blocks.filter((b) => b.type === 'vote' && !b.tally?.closed && !b.tally?.cancelled);
              const openTasks = detail.blocks.filter((b) => b.type === 'task' && (b.task?.status ?? 'open') === 'open');
              const vote = votes[0] ?? null;
              const card = (children: React.ReactNode, label: string) => (
                <div className="mt-2 rounded-2xl p-3" style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)' }}>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--color-primary)' }}>{label}</p>
                  {children}
                </div>
              );
              if (vote) {
                const t = vote.tally;
                const closing = t?.closesAt ? Math.max(0, Math.round((Date.parse(t.closesAt) - Date.now()) / 3600000)) : null;
                return card(
                  <>
                    <p className="text-[14px] font-extrabold mt-1" style={{ color: 'var(--brief-ink)' }}>{vote.content}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {t ? `${t.totalVotes} of ${t.eligibleCount} voted` : 'no ballots yet'}
                      {closing != null ? ` · closes in ${closing}h` : ''}
                      {t?.quorum ? ` · quorum ${t.quorum}` : ''}
                    </p>
                  </>,
                  'A decision is open'
                );
              }
              if (openTasks.length) {
                return card(
                  <>
                    <p className="text-[14px] font-extrabold mt-1" style={{ color: 'var(--brief-ink)' }}>
                      {openTasks.length} {openTasks.length === 1 ? 'job' : 'jobs'} nobody has taken
                    </p>
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{openTasks[0].content}</p>
                  </>,
                  'Work waiting'
                );
              }
              return null;
            })()}

            <div className="mt-2 flex items-center justify-between gap-3">
              {myRole ? (
                <button
                  onClick={() => void handleLeave(open.id)}
                  disabled={busyId === open.id}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold cursor-pointer disabled:opacity-50"
                  style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none' }}
                >
                  {busyId === open.id ? 'Leaving…' : 'Leave'}
                </button>
              ) : open.canJoin ? (
                <button
                  onClick={() => void handleJoin(open.id)}
                  disabled={busyId === open.id}
                  className="px-3 py-1.5 rounded-xl bg-[#4F46E5] text-[var(--accent-ink)] font-extrabold text-[10px] cursor-pointer disabled:opacity-50"
                >
                  {busyId === open.id ? 'Joining…' : 'Join room'}
                </button>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Invite only — ask a coordinator</span>
              )}

              {/* The join link. Real origin, real code, copy-on-tap: no vanity
                  domain is claimed, because Brief.app is not ours to promise. */}
              {open.joinCode && (myRole || open.visibility !== 'invite_only') && (
                <CopyId
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/#join/${open.joinCode}`}
                  label="join link"
                />
              )}
            </div>

            {/* Listing is the coordinator's call, and it costs a reason. */}
            {myRole === 'coordinator' && (
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setListingRoom((v) => !v)}
                  className="text-[10px] font-black cursor-pointer"
                  style={{ color: 'var(--color-primary)', background: 'none', border: 'none', padding: 0 }}
                >
                  {open.visibility === 'discoverable' ? 'Take it off the list' : 'List it so people can find it'}
                </button>
                {listingRoom && (
                  <span className="flex items-center gap-1.5 w-full">
                    <input
                      value={listReason}
                      onChange={(e) => setListReason(e.target.value)}
                      maxLength={300}
                      aria-label="reason for listing this room"
                      placeholder="why should the list show this room? your members see this"
                      className="min-w-0 flex-1 px-2.5 py-1.5 rounded-xl text-[10px]"
                      style={{ background: 'var(--color-well)', color: 'var(--color-text)', boxShadow: 'inset 0 0 0 1px var(--brief-line)' }}
                    />
                    <button
                      onClick={handleListRoom}
                      disabled={govBusy === 'listing' || !listReason.trim()}
                      className="px-3 py-1.5 rounded-xl font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
                      style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)', border: 'none' }}
                    >
                      {open.visibility === 'discoverable' ? 'Unlist' : 'List it'}
                    </button>
                  </span>
                )}
              </div>
            )}
          </header>

          {/* Section rail. Same visual language as the rest of Brief. */}
          <div className="flex gap-1.5 flex-wrap">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold cursor-pointer ${
                  section === s.id
                    ? 'bg-[#4F46E5] text-[var(--accent-ink)]'
                    : 'bg-[color:var(--color-paper)] border border-[var(--brief-line)] text-[var(--ink-70)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* A refused action reports the server's own reason. */}
          {notice && (
            <div className="border border-[var(--brief-line)] bg-[color:var(--color-paper)] rounded-xl px-3 py-2">
              <p className="text-[10px] text-[var(--brief-ink)] leading-snug">{notice}</p>
            </div>
          )}

          {section === 'overview' && (
            <div className="space-y-4">
              {open.description && (
                <p className="text-[11px] text-[var(--ink-60)] leading-snug">{open.description}</p>
              )}

              {/* What the room is working towards, in its own words — one line,
                  with the money that has actually settled under it. Not a table
                  of fields: a sentence and a figure. */}
              {open.goal && (
                <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-black uppercase tracking-wider text-[9px]" style={{ color: 'var(--color-primary)' }}>Working towards </span>
                  {open.goal}
                </p>
              )}

              {/* What is in the room: notes, pins, anything the group put on the
                  wall. Tasks and votes have their own panels; this is the rest. */}
              <div>
                <h3 className="text-[11px] font-extrabold text-[var(--ink-60)] mb-2">In the room</h3>
                {detail.blocks.filter((b) => b.type !== 'task' && b.type !== 'vote').length === 0 ? (
                  <p className="text-xs text-[var(--ink-60)]">Nothing pinned yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.blocks
                      .filter((b) => b.type !== 'task' && b.type !== 'vote')
                      .map((block) => (
                        <div key={block.id} className="bg-[color:var(--color-paper)] rounded-2xl p-3" style={{ boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}>
                          <p className="text-[9px] text-[var(--brief-ink)]">{block.type}</p>
                          <p className="text-xs text-[var(--brief-ink)] mt-1">{block.content}</p>
                          {block.sources.length > 0 && block.sources[0].sourceName && (
                            <p className="text-[9px] text-[var(--ink-60)] mt-1">via {block.sources[0].sourceName}</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* What changed, in the room's own words. Each line is one append:
                  the act, the actor's name where it is public, and the reason
                  where one was required. */}
              <div>
                <h3 className="text-[11px] font-extrabold text-[var(--ink-60)] mb-2">What changed</h3>
                {roomHistory == null ? (
                  <p className="text-xs text-[var(--ink-60)]">The history could not be read.</p>
                ) : roomHistory.length === 0 ? (
                  <p className="text-xs text-[var(--ink-60)]">Nothing has changed yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {roomHistory.slice(0, 6).map((row) => (
                      <li key={row.id} className="flex items-baseline gap-2">
                        <span className="w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--color-primary)' }} />
                        <span className="min-w-0 flex-1 text-[11px] leading-snug text-[var(--brief-ink)]">{row.text}</span>
                        <span className="shrink-0 text-[9px] font-mono text-[var(--ink-60)]">{row.at.slice(5, 10)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {open.targetValue != null && (
                <div>
                  <h3 className="text-[11px] font-extrabold text-[var(--ink-60)] mb-2">Target</h3>
                  <CircleTarget circle={open} />
                </div>
              )}
            </div>
          )}

          {section === 'tasks' && (
            <CircleTasks
              blocks={detail.blocks}
              currentUserId={meId ?? undefined}
              myRole={myRole}
              busyId={busyId}
              onAssign={handleAssign}
              onRelease={handleRelease}
              onComplete={handleComplete}
              nameOf={nameOf}
              onCancel={handleCancelTask}
              onReopen={handleReopenTask}
              onVerify={handleVerifyTask}
              onDue={handleTaskDue}
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
              onCancel={handleCancelVote}
            />
          )}

          {section === 'members' && (
            <CircleMembers
              members={members}
              evidence={evidence}
              expandedId={expandedMember}
              onToggle={handleToggleMember}
              canGovern={myRole === 'coordinator'}
              currentUserId={meId ?? undefined}
              busyUserId={govBusy}
              onInvite={handleInviteMember}
              onRole={handleSetRole}
              onRemove={handleRemoveMember}
              onTransfer={handleTransfer}
            />
          )}

          {section === 'activity' && <CircleActivity signals={detail.signals} />}
        </>
      )}
    </section>
  );
}
