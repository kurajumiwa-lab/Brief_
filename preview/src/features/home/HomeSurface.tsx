import React, { useState, useEffect } from 'react';
import {
  Plus,
  ArrowRight,
  MessageCircle,
  ShoppingBag,
  Package,
  Archive,
  RotateCcw,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import type { MyCommitments, MyPosition, MyReciprocity } from '../../api/briefApi';
import { CreateSpaceModal } from '../spaces/CreateSpaceModal';
import { soundEngine } from '../../utils/SoundEngine';
import { attentionQueue, needsAttention, splitSpaces } from './spaceSignals';
import { MuseumGallery } from '../city/MuseumGallery';
import { SignalBar } from './SignalBar';
import { WorldStrip } from './WorldStrip';
import { StakesLine } from './StakesLine';
import { NextMoveCard } from './NextMoveCard';
import { StandingLine } from './StandingLine';
import { CirclesStrip } from './CirclesStrip';
import { PositionCard } from './PositionCard';
import { CommitmentsCard } from './CommitmentsCard';
import { ReciprocityCard } from './ReciprocityCard';

// ---------------------------------------------------------------------------
// HOME — three zones, one glance (§9 of the reformation).
//
//   1. What is the world doing?   → SignalBar   (real rows, snapshot-stamped)
//                              + WorldStrip     (a public provider, dated)
//   2. What should I do?          → NextMoveCard (one decision, derived)
//   3. What is out there?         → MuseumGallery (real published events)
//
// Everything else sits behind a tap: commerce lives in Discover → Market,
// space management is collapsed under "Run your spaces", and the position /
// commitments / reciprocity detail cards carry the full derivation below the
// fold. The greeting uses the name on the session — never a placeholder name,
// and never "Position #7 · Sector 4": no row in this store holds a rank, a
// sector or a queue, so the standing line shows real counts instead.
// ---------------------------------------------------------------------------

export interface HomeSurfaceProps {
  userName?: string;
  onOpenSpace: (spaceId: string) => void;
  onExploreDiscover?: (subTab?: 'bulk' | 'direct' | 'niche' | 'group' | 'events' | 'circles' | 'errands' | 'all') => void;
  onGetPaid?: () => void;
  onOpenSpaces?: () => void;
  /** Pulse — the ledger's own numbers — now lives on the Activity tab. */
  onOpenPulse?: () => void;
  /** Open the one screen that holds the explanations (You → How Brief works). */
  onOpenHow?: () => void;
  className?: string;
}

export const HomeSurface: React.FC<HomeSurfaceProps> = ({
  userName = 'there',
  onOpenSpace,
  onExploreDiscover,
  onOpenHow,
  onGetPaid,
  onOpenSpaces,
  onOpenPulse,
  className = ''
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [createSpaceOpen, setCreateSpaceOpen] = useState<boolean>(false);
  const [archivedOpen, setArchivedOpen] = useState<boolean>(false);
  const [manageOpen, setManageOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // The three derived reads, fetched ONCE here and handed to the cards that
  // render them — one read per screen, so no two surfaces can disagree.
  const [position, setPosition] = useState<MyPosition | null>(null);
  const [commitments, setCommitments] = useState<MyCommitments | null>(null);
  const [reciprocity, setReciprocity] = useState<MyReciprocity | null>(null);
  const [circleCount, setCircleCount] = useState<number | null>(null);
  // A visitor with no session has no ledger to read. That is not an error, so
  // the card stays silent instead of shouting "could not be read".
  const [positionDenied, setPositionDenied] = useState<boolean | undefined>(undefined);
  const [sessionName, setSessionName] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSpaces = async () => {
    setIsLoading(true);
    try {
      const res = await briefApi.listMySpaces();
      if (res.ok && res.data?.spaces) {
        setSpaces(res.data.spaces);
      }
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    let live = true;
    void Promise.all([
      briefApi.whoAmI(),
      briefApi.getMyPosition(),
      briefApi.getMyCommitments(),
      briefApi.getMyReciprocity(),
      briefApi.getCircles()
    ]).then(([me, pos, cmts, recip, cir]) => {
      if (!live) return;
      if (me.ok && me.data?.displayName) setSessionName(me.data.displayName);
      setPosition(pos.ok ? pos.data : null);
      setPositionDenied(!pos.ok && (pos as { status?: number }).status === 401);
      setCommitments(cmts.ok ? cmts.data : null);
      setReciprocity(recip.ok ? recip.data : null);
      // "My circles" counts only rows the session is actually a member of —
      // the list is public, so membership is read from the server's viewerRole.
      setCircleCount(cir.ok ? cir.data.filter((c) => Boolean(c.viewerRole)).length : null);
    });
    return () => { live = false; };
  }, []);

  const handleSpaceCreated = (newSpace: Space) => {
    showToast(`Space "${newSpace.name}" created!`);
    loadSpaces();
    onOpenSpace(newSpace.id);
  };

  const setStatus = async (space: Space, status: 'active' | 'archived') => {
    setBusyId(space.id);
    const res = await briefApi.updateSpace(space.id, { status });
    setBusyId(null);
    if (res.ok) {
      showToast(status === 'archived' ? `Archived "${space.name}".` : `Restored "${space.name}".`);
      loadSpaces();
    } else {
      showToast(res.error ?? 'Could not update that space.');
    }
  };

  const { active, archived } = splitSpaces(spaces);
  const queue = attentionQueue(active);
  // Upkeep is DERIVED by the server from each space's own rows (a field past
  // its cadence, a never-answered question, a reply owed, a draft offer). Home
  // only adds those counts up — it invents no urgency and no reward for it.
  const upkeepBySpace = new Map(active.map((sp) => [sp.id, sp.editorialOpen ?? 0]));
  const upkeepItems = [...upkeepBySpace.values()].reduce((n, x) => n + x, 0);
  const spacesWithUpkeep = [...upkeepBySpace.values()].filter((n) => n > 0).length;

  const ATTENTION_ICON: Record<string, React.ReactNode> = {
    conversation: <MessageCircle className="w-3 h-3" />,
    offer: <ShoppingBag className="w-3 h-3" />,
    order: <Package className="w-3 h-3" />
  };

  return (
    <div className={`space-y-5 max-w-2xl mx-auto ${className}`}>
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── ZONE 0 — WHO YOU ARE. Real name from the session, real counts. ── */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-black text-[color:var(--color-text)] tracking-tight">
          Hi {sessionName || userName}
        </h1>
        {/* The hook, loss-framed but only as far as a row will carry it: a lost
            quote is a real event, an unposted offer is a real absence, and a
            quiet week is said as a quiet week. No invented "you are losing
            KES 40,000", and no claim about staff hours Brief cannot see. */}
        <StakesLine
          onOpenHow={onOpenHow}
          position={position}
          spaces={spaces}
          loading={isLoading}
          failed={position === null && !isLoading}
          onOpenDiscover={() => onExploreDiscover?.('all')}
          onPostOffer={() => onOpenSpaces?.()}
        />
        <StandingLine position={position} commitments={commitments} reciprocity={reciprocity} />
      </div>

      {/* ── ZONE 1 — WHAT THE WORLD IS DOING ── */}
      <SignalBar onOpenPulse={() => (onOpenPulse ? onOpenPulse() : onExploreDiscover?.('all'))} />

      {/* Zone 1's other half. The ledger is the user's; this is the country's —
          so a first week in Brief has something true to read instead of four
          zeros. Every sentence here came from the provider, not from this file. */}
      <WorldStrip />

      {/* ── ZONE 2 — WHAT YOU SHOULD DO NEXT ── */}
      <NextMoveCard position={position} denied={positionDenied} />

      {/* ── ZONE 3 — WHAT IS OUT THERE (inventory, not a feed) ── */}
      <section className="space-y-1.5" aria-label="What's out there">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
            What&rsquo;s out there
          </h2>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onExploreDiscover?.('all'); }}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
          >
            Browse everything
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <MuseumGallery />
      </section>

      {/* ── PERSONAL CONTEXT — you are part of things, not only a browser ── */}
      <CirclesStrip
        spaces={active.length}
        circles={circleCount ?? 0}
        needsYou={queue.length}
        onView={() => {
          soundEngine.play('tap');
          if (queue.length > 0) onOpenSpace(queue[0].space.id);
          else onOpenSpaces?.();
        }}
      />

      {/* ── BELOW THE FOLD: the full derivation, then management ── */}
      <div className="space-y-4 pt-1">
        <PositionCard position={position} />
        <CommitmentsCard commitments={commitments} />
        <ReciprocityCard reciprocity={reciprocity} />
      </div>

      <div className="p-3 rounded-2xl bg-[color:var(--color-primary-subtle)]" style={{ boxShadow: 'var(--lift-signal)' }}>
        <p className="text-[12px] leading-snug" style={{ color: "var(--color-text)" }}>
          <strong style={{ color: "var(--color-primary)" }}>Tip:</strong> a space is your project — add an offer, take orders, track the money. Make it <strong>Public</strong> to be found by others, or keep it <strong>Private</strong>.
        </p>
      </div>

      {/* ── RUN YOUR SPACES — management, collapsed by default: it is work,
             not the thing you came to see. ── */}
      <section className="rounded-2xl brief-card bg-[color:var(--color-paper)]" aria-label="Run your spaces">
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setManageOpen((v) => !v); }}
          aria-expanded={manageOpen}
          className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        >
          <span className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
            Run your spaces{active.length > 0 ? ` (${active.length})` : ''}
            {queue.length > 0 && (
              <span className="ml-2 font-bold normal-case" style={{ color: 'var(--color-primary)' }}>
                {queue.length} need{queue.length === 1 ? 's' : ''} you
              </span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${manageOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} />
        </button>

        {manageOpen && (
          <div className="px-4 pb-4 space-y-5">
            {isLoading ? (
              <p className="text-xs text-[color:var(--color-text-muted)]">Reading your spaces…</p>
            ) : spaces.length === 0 ? (
              /* A single create affordance, only when there is genuinely nothing yet. */
              <div className="p-6 rounded-3xl bg-[color:var(--color-paper)] border border-dashed text-center space-y-3" style={{ boxShadow: 'var(--room-light), var(--lift-1)' }}>
                <p className="text-sm font-bold text-[color:var(--color-text)]">
                  You don&rsquo;t have a space yet.
                </p>

                <button
                  type="button"
                  onClick={() => { soundEngine.play('heavyTap'); setCreateSpaceOpen(true); }}
                  className="px-5 py-2.5 rounded-full bg-[color:var(--color-primary)] text-[color:var(--accent-ink)] font-bold text-xs inline-flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create your first space</span>
                </button>
              </div>
            ) : (
              <>
                {/* ── NEEDS YOUR ATTENTION — the real check-in queue, never mock ── */}
                <div className="space-y-2" aria-label="Needs your attention">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      Needs your attention
                    </h3>
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setCreateSpaceOpen(true); }}
                      className="text-xs font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> New space
                    </button>
                  </div>

                  {queue.length === 0 ? (
                    <div className="p-3 rounded-2xl bg-[color:var(--color-paper)] brief-lift-1 flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[color:var(--color-success)]" />
                      <span className="text-xs font-bold text-[color:var(--color-text)]">All caught up.</span>
                      <span className="text-[11px] text-[color:var(--color-text-muted)]">No open conversations, draft offers or orders to fulfil.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {queue.map(({ space, items }) => (
                        <button
                          key={space.id}
                          type="button"
                          onClick={() => { soundEngine.play('tap'); onOpenSpace(space.id); }}
                          className="w-full text-left p-3.5 rounded-2xl bg-[color:var(--color-paper)] brief-lift-1 transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[color:var(--color-text)]">{space.name}</span>
                            <ArrowRight className="w-4 h-4 text-gray-400" />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((it) => (
                              <span key={it.kind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)] text-[11px] font-bold">
                                {ATTENTION_ICON[it.kind]} {it.label}
                              </span>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── MY SPACES ── */}
                <div className="space-y-2" aria-label="My spaces">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-[color:var(--color-text-muted)]">
                      Active spaces
                      {upkeepItems > 0 && (
                        <span className="ml-1.5 normal-case font-bold" style={{ color: 'var(--color-primary)' }}>
                          · {upkeepItems} open item{upkeepItems === 1 ? '' : 's'} across {spacesWithUpkeep} space{spacesWithUpkeep === 1 ? '' : 's'}
                        </span>
                      )}
                    </h3>
                    {onGetPaid && (
                      <button
                        type="button"
                        onClick={() => { soundEngine.play('tap'); onGetPaid(); }}
                        className="text-[12px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                      >
                        Money →
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {active.map((s) => {
                      const attention = needsAttention(s);
                      return (
                        <div
                          key={s.id}
                          className="p-3 rounded-2xl bg-[color:var(--color-paper)] brief-lift-1 transition-all flex items-center justify-between gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                            className="flex-1 text-left flex items-center space-x-2.5 cursor-pointer"
                          >
                            <span className="text-lg">🌱</span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-[color:var(--color-text)] block truncate">
                                {s.name}
                              </span>
                              <span className="text-[11px] text-[color:var(--color-text-muted)] block">
                                {attention.length === 0
                                  ? 'All caught up'
                                  : attention.map((a) => a.label).join(' · ')}
                                {(upkeepBySpace.get(s.id) ?? 0) > 0 &&
                                  ` · ${upkeepBySpace.get(s.id)} question${upkeepBySpace.get(s.id) === 1 ? '' : 's'} in the space file`}
                              </span>
                              {s.maintenance?.state && s.maintenance.state !== 'unstarted' && (
                                <span
                                  className="text-[11px] font-black uppercase tracking-wider"
                                  style={{
                                    color:
                                      s.maintenance.state === 'fresh' ? 'var(--color-success)'
                                        : s.maintenance.state === 'active' ? 'var(--color-primary)'
                                          : s.maintenance.state === 'stale' ? 'var(--color-warning)'
                                            : 'var(--color-danger)'
                                  }}
                                >
                                  {s.maintenance.state}
                                  {s.maintenance.ageHours != null
                                    ? ` · ${s.maintenance.ageHours < 24 ? `${s.maintenance.ageHours}h` : `${Math.round(s.maintenance.ageHours / 24)}d`} since any change`
                                    : ''}
                                </span>
                              )}
                            </div>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => setStatus(s, 'archived')}
                            aria-label={`Archive ${s.name}`}
                            title="Archive"
                            className="shrink-0 p-2 rounded-full text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-gray-100 transition-all cursor-pointer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── ARCHIVED — collapsed, restorable ── */}
                {archived.length > 0 && (
                  <div className="space-y-2" aria-label="Archived spaces">
                    <button
                      type="button"
                      onClick={() => setArchivedOpen((v) => !v)}
                      className="w-full flex items-center justify-between text-xs font-bold text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] cursor-pointer"
                    >
                      <span>Archived ({archived.length})</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${archivedOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {archivedOpen && (
                      <div className="space-y-2">
                        {archived.map((s) => (
                          <div key={s.id} className="p-3 rounded-2xl bg-[color:var(--color-well)] border border-dashed flex items-center justify-between gap-2 opacity-70">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span className="text-lg">🗄️</span>
                              <span className="text-xs font-bold text-[color:var(--color-text)] truncate">{s.name}</span>
                            </div>
                            <button
                              type="button"
                              disabled={busyId === s.id}
                              onClick={() => setStatus(s, 'active')}
                              aria-label={`Restore ${s.name}`}
                              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-subtle)] transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" /> Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Create Space Modal */}
      {createSpaceOpen && (
        <CreateSpaceModal
          isOpen={createSpaceOpen}
          onClose={() => setCreateSpaceOpen(false)}
          onSpaceCreated={handleSpaceCreated}
        />
      )}
    </div>
  );
};

export default HomeSurface;
