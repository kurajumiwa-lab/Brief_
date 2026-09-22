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
  ChevronDown,
  Store,
  CalendarDays,
  Users,
  Bike,
  Truck
} from 'lucide-react';
import type { Space, Circle } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import type { MyCommitments, MyPosition, MyReciprocity, DiscoverFeedItem, EventListing } from '../../api/briefApi';
import { CreateSpaceModal } from '../spaces/CreateSpaceModal';
import { FLOW_ACCENT } from '../city/DiscoverFeed';
import { soundEngine } from '../../utils/SoundEngine';
import { attentionQueue, needsAttention, splitSpaces } from './spaceSignals';
import { SignalBar } from './SignalBar';
import { PlannedWeather } from './PlannedWeather';
import { EarnStrip } from './EarnStrip';
import { StakesLine } from './StakesLine';
import { NextMoveCard } from './NextMoveCard';
import { StandingLine } from './StandingLine';
import { CirclesStrip } from './CirclesStrip';

// ---------------------------------------------------------------------------
// HOME — the landing, in the pattern the mock it was copied from uses.
//
//   1. WHO YOU ARE — the greeting, the stakes line, your standing. Real
//      name from the session, real counts, one derived read.
//   2. THE MODE TILES — six visual tiles, not chips: Shops, Events, Circles,
//      Errands, Runs, Group Buys. A tile is a picture with a word under it,
//      the way that storefront does it — a chip row is for filters, and a
//      filter row up here would be a second navigation for what the board
//      already picks.
//   3. THE HERO — "What's moving today". Real pulse facts only, stamped,
//      and it HIDEs itself to a single quiet line when the ledger is empty:
//      a hero that invents a number is the exact thing this product refuses.
//   4. THREE SHELVES, side-scrolling, each with a title and an "All →":
//        Open now         — the supply board's top rows
//        From your groups — the circles you are actually in
//        Happening today  — the events starting today
//      Each shelf is the top of a real list; "All →" is the one place that
//      list is, and an empty shelf is not rendered, because an empty shelf
//      with a title is the broken-screen tell this app deleted everywhere.
//   5. THE FOLD — what you should do next, your income rails, the weather
//      (on a planned day only), and "Run your spaces" collapsed: it is work,
//      not the thing you came to see.
//
// What is NOT here: a "What's out there" section (the shelf already is the
// browse), a 0-SETTLED-ORDERS hero (a zero is not a number, it is the
// absence of rows), a featured card nobody picked, or any count that is not a
// row the server answered with.
// ---------------------------------------------------------------------------

export interface HomeSurfaceProps {
  /** Jump to You → Earn. The rails are surfaced on Home; the acting is done on
      Earn, which is where the conversion control and its refusals live. */
  onOpenEarn?: () => void;
  userName?: string;
  onOpenSpace: (spaceId: string) => void;
  onExploreDiscover?: (subTab?: 'bulk' | 'direct' | 'niche' | 'group' | 'events' | 'circles' | 'errands' | 'all', startRun?: boolean) => void;
  onGetPaid?: () => void;
  onOpenSpaces?: () => void;
  /** Group buys — the shell's one overlay for the portal. */
  onOpenGroupBuys?: () => void;
  /** Pulse — the ledger's own numbers — lives in the drawer's check-in. */
  onOpenPulse?: () => void;
  /** Open the one screen that holds the explanations (You → How Brief works). */
  onOpenHow?: () => void;
  className?: string;
}

const money = (n: number, currency: string) => `${currency} ${Number(n).toLocaleString('en-KE')}`;
const timeOf = (iso: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

export const HomeSurface: React.FC<HomeSurfaceProps> = ({
  userName = 'there',
  onOpenSpace,
  onExploreDiscover,
  onOpenHow,
  onGetPaid,
  onOpenSpaces,
  onOpenGroupBuys,
  onOpenPulse,
  onOpenEarn,
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
  const [circles, setCircles] = useState<Circle[]>([]);
  // A visitor with no session has no ledger to read. That is not an error, so
  // the card stays silent instead of shouting "could not be read".
  const [positionDenied, setPositionDenied] = useState<boolean | undefined>(undefined);
  const [sessionName, setSessionName] = useState<string | null>(null);

  // The three shelves. Each is the top of a REAL list; each is hidden when
  // empty; each "All →" points at the one place the list is.
  const [feed, setFeed] = useState<DiscoverFeedItem[]>([]);
  const [todayEvents, setTodayEvents] = useState<EventListing[]>([]);

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
      // "From your groups" counts only rows the session is actually a member of
      // — the list is public, so membership is read from the server's viewerRole.
      setCircles(cir.ok ? cir.data : []);
    });
    return () => { live = false; };
  }, []);

  // The shelves, read once. "Open now" is the supply board's top; "Happening
  // today" is the events row from start-of-day to now (an event is in the past
  // the moment its window passes, so the shelf never shows a "tonight" that is
  // already yesterday).
  useEffect(() => {
    let live = true;
    void briefApi.getDiscoverSummary().then((res) => {
      if (live && res.ok) setFeed(res.data.feed.slice(0, 8));
    });
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    void briefApi.browseEvents({ from: start.toISOString(), to: now.toISOString(), limit: 12 }).then((res) => {
      if (live && res.ok) setTodayEvents(res.data.events.slice(0, 8));
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
  const myCircles = circles.filter((c) => Boolean(c.viewerRole)).slice(0, 8);

  const ATTENTION_ICON: Record<string, React.ReactNode> = {
    conversation: <MessageCircle className="w-3 h-3" />,
    offer: <ShoppingBag className="w-3 h-3" />,
    order: <Package className="w-3 h-3" />
  };

  // ── THE MODE TILES — six doors, pictures with words. The test id is the
  // contract: `doorways.jsx` asserts exactly these six, in this order, and
  // that no chip row competes with them.
  const MODES: Array<{ id: string; label: string; icon: React.ReactNode; act: () => void }> = [
    { id: 'shops', label: 'Shops', icon: <Store className="w-5 h-5" />, act: () => onOpenSpaces?.() },
    { id: 'events', label: 'Events', icon: <CalendarDays className="w-5 h-5" />, act: () => onExploreDiscover?.('events') },
    { id: 'circles', label: 'Circles', icon: <Users className="w-5 h-5" />, act: () => onExploreDiscover?.('circles') },
    { id: 'errands', label: 'Errands', icon: <Bike className="w-5 h-5" />, act: () => onExploreDiscover?.('errands') },
    { id: 'runs', label: 'Runs', icon: <Truck className="w-5 h-5" />, act: () => onExploreDiscover?.('errands', true) },
    { id: 'groupBuys', label: 'Group Buys', icon: <Package className="w-5 h-5" />, act: () => onOpenGroupBuys?.() }
  ];

  const ShelfHead: React.FC<{ title: string; onAll: () => void }> = ({ title, onAll }) => (
    <div className="flex items-center justify-between pb-2.5">
      <h2 className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <button
        type="button"
        onClick={() => { soundEngine.play('tap'); onAll(); }}
        className="text-[12px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
        style={{ color: 'var(--color-primary)' }}
      >
        All <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <div className={`space-y-5 max-w-2xl mx-auto ${className}`}>
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── ZONE 0 — WHO YOU ARE. Real name from the session, real counts. ── */}
      <div className="space-y-1.5">
        <h1 className="text-2xl sm:text-3xl font-black text-[color:var(--color-text)] tracking-tight">
          Hi {sessionName || userName}
        </h1>
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

      {/* ── THE MODE TILES — the six doors of the board, as pictures. ── */}
      <section data-testid="mode-tiles" aria-label="Ways in" className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => { soundEngine.play('tap'); m.act(); }}
            className="flex flex-col items-center gap-1.5 rounded-2xl py-3.5 cursor-pointer transition-all"
            style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
          >
            <span
              className="w-10 h-10 rounded-2xl grid place-items-center"
              style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
            >
              {m.icon}
            </span>
            <span className="text-[12px] font-bold" style={{ color: 'var(--color-text)' }}>{m.label}</span>
          </button>
        ))}
      </section>

      {/* ── THE HERO — what's moving today. Real pulse facts, stamped, and a
             link to the whole list. The bar inside rotates one fact; the
             drawer's check-in is where they all stand. ── */}
      <section
        aria-label="What's moving today"
        className="rounded-3xl p-4 space-y-3"
        style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-2), inset 0 0 0 1px var(--brief-line)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold tracking-tight" style={{ color: 'var(--color-text)' }}>
            What&rsquo;s moving today
          </h2>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onOpenPulse?.(); }}
            className="text-[12px] font-bold inline-flex items-center gap-0.5 cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            What&rsquo;s moving <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <SignalBar onOpenPulse={() => onOpenPulse?.()} />
      </section>

      {/* ── OPEN NOW — the board's top, sideways. Hidden when empty. ── */}
      {feed.length > 0 && (
        <section aria-label="Open now" className="space-y-0">
          <ShelfHead title="Open now" onAll={() => onExploreDiscover?.('all')} />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1" data-testid="open-now-tiles">
            {feed.map((f) => {
              // The tile is tinted by the row's real flow — the same four
              // accents the feed uses, so a bulk row is blue on both shelves.
              // A row with a real photo always beats a tint; a row with no
              // flow gets the neutral slate, never a guessed colour.
              const tint = (f.flow && FLOW_ACCENT[f.flow]) || '#64748B';
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onExploreDiscover?.('all'); }}
                  aria-label={`Open ${f.title}`}
                  data-testid={`open-now-tile-${f.id}`}
                  className="relative shrink-0 w-44 h-44 text-left rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-[0.98]"
                  style={{ background: tint, boxShadow: 'var(--lift-1)' }}
                >
                  {f.mediaUrl ? (
                    <>
                      <img src={f.mediaUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0) 30%, rgba(15,23,42,0.72) 100%)' }}
                      />
                    </>
                  ) : (
                    <span aria-hidden className="absolute right-3 top-3 opacity-70">
                      {f.kind === 'event' ? <CalendarDays className="w-5 h-5 text-white" /> : <Package className="w-5 h-5 text-white" />}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 p-3 block">
                    <span className="block text-[13px] font-bold text-white leading-tight truncate">{f.title}</span>
                    <span className="block text-[11px] font-semibold text-white/90 truncate mt-0.5">
                      {f.priceLabel || (f.kind === 'event' ? 'Event' : 'Listing')}
                    </span>
                    {f.location && (
                      <span className="block text-[10px] text-white/70 truncate mt-0.5">{f.location}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── FROM YOUR GROUPS — the circles you are actually in. ── */}
      {myCircles.length > 0 && (
        <section aria-label="From your groups" className="space-y-0">
          <ShelfHead title="From your groups" onAll={() => onExploreDiscover?.('circles')} />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {myCircles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { soundEngine.play('tap'); onExploreDiscover?.('circles'); }}
                className="shrink-0 w-52 text-left p-3 rounded-2xl cursor-pointer transition-all"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
              >
                <p className="text-[12px] font-bold leading-tight truncate" style={{ color: 'var(--color-text)' }}>{c.name}</p>
                {c.goal ? (
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{c.goal}</p>
                ) : null}
                <p className="text-[11px] font-mono mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  {c.memberCount} member{c.memberCount === 1 ? '' : 's'}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── HAPPENING TODAY — events whose window is today, on the clock. ── */}
      {todayEvents.length > 0 && (
        <section aria-label="Happening today" className="space-y-0">
          <ShelfHead title="Happening today" onAll={() => onExploreDiscover?.('events')} />
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
            {todayEvents.map((e) => (
              <a
                key={e.slug}
                href={`/c/${e.slug}`}
                className="shrink-0 w-48 text-left rounded-2xl overflow-hidden transition-all"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
              >
                {e.coverImageUrl ? (
                  <div className="h-24 w-full overflow-hidden" style={{ background: 'var(--color-well)' }}>
                    <img src={e.coverImageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <div className="p-2.5 space-y-0.5">
                  <p className="text-[12px] font-bold leading-tight truncate" style={{ color: 'var(--color-text)' }}>{e.title}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {timeOf(e.startsAt) ? `${timeOf(e.startsAt)} · ` : ''}
                    {e.price > 0 ? money(e.price, e.currency ?? 'KES') : 'Free'}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── THE FOLD ──────────────────────────────────────────────────── */}

      {/* Weather, and only where it is useful: a week of forecast for a member
          with nothing planned is what every other app prints, so it is what
          nobody reads. This renders one line where a dated forecast fact lands on
          a day the member already committed to, and renders nothing otherwise. */}
      <PlannedWeather />

      {/* The income rails used to exist only behind You → Earn, which most
          members never open. Same three reads, same endpoints, no second copy of
          the arithmetic. */}
      <EarnStrip onOpenEarn={() => onOpenEarn?.()} />

      {/* WHAT YOU SHOULD DO NEXT — one derived decision, nothing else. */}
      <NextMoveCard position={position} denied={positionDenied} />

      {/* PERSONAL CONTEXT — you are part of things, not only a browser */}
      <CirclesStrip
        spaces={active.length}
        circles={myCircles.length}
        needsYou={queue.length}
        onView={() => {
          soundEngine.play('tap');
          if (queue.length > 0) onOpenSpace(queue[0].space.id);
          else onOpenSpaces?.();
        }}
      />

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
