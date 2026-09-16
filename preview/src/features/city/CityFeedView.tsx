import React, { useState } from 'react';
import {
  Users,
  Lock,
  ArrowRight,
  Store,
  Bike,
  Plus,
  CalendarPlus
} from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import { DiscoveryHead } from './DiscoveryHead';
import { MuseumGallery } from './MuseumGallery';
import { EventsHub } from '../../components/EventsHub';
import { Marketplace } from '../../components/Marketplace';
import { ErrandsLobby } from './ErrandsLobby';
import { Circles } from '../../components/Circles';
import { DiscoverCategoryGrid } from './DiscoverCategoryGrid';
import { DiscoverFeatured } from './DiscoverFeatured';
import type { DiscoverFeatured as FeaturedItem, DiscoverSummary } from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// DISCOVER — the shop window.
//
// The tile grid is the navigation. That is the one thing the old Discover
// layout got right and the chip row lost: a tile is thumb-reachable and it can
// carry a number, so you know whether a room is worth opening before you tap.
// Marketplace sits top-left and is the default room, because a market is what
// this network can settle today.
//
// What was NOT restored: the old layout's CONTENT. The screens under
// preview/src/screens/ are driven by a hardcoded array — a "Kilimani Weekend
// Creators Market" with "over 40 verified creative vendors", a borrowed
// Unsplash photograph, a phone number that reaches nobody and a Telegram handle
// nobody runs. It is not in the production tree at all (main.jsx mounts
// AppShell). Copying it would have been the single fastest way to make Brief
// dishonest, so the featured card here is built from rows: a real listing or a
// published event, its own photo or a plain tint, counted orders or counted
// registrations, and a chip naming the rule that chose it. A zero on a tile is
// printed as a zero.
//
// Room names are the nouns of the product, not marketing: Circles (not
// "Communities"), Events, Marketplace, Errands — plus "Everything at once" for
// anyone who wants all four in one scroll.
// ---------------------------------------------------------------------------

export interface CityFeedViewProps {
  initialSubTab?: 'marketplace' | 'events' | 'circles' | 'errands' | 'all';
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}

type CitySubTab = 'marketplace' | 'events' | 'circles' | 'errands' | 'all';

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'marketplace',
  onOpenSpace,
  className = ''
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CitySubTab>(initialSubTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // The tiles' numbers and the featured slot, from one read. Refreshed when the
  // tab comes back to the foreground — and by the Re-read button — rather than
  // on a 30-second timer, because a timer would imply a feed Brief does not have.
  const [summary, setSummary] = useState<DiscoverSummary | null>(null);
  const [summaryBusy, setSummaryBusy] = useState(false);

  const loadSummary = React.useCallback(async () => {
    setSummaryBusy(true);
    const res = await briefApi.getDiscoverSummary();
    setSummaryBusy(false);
    if (res.ok) setSummary(res.data);
  }, []);

  React.useEffect(() => {
    void loadSummary();
    const onVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') void loadSummary();
    };
    window.addEventListener('focus', onVisible);
    return () => window.removeEventListener('focus', onVisible);
  }, [loadSummary]);

  const openFeatured = (item: FeaturedItem) => {
    soundEngine.play('tap');
    if (typeof window === 'undefined') return;
    if (item.kind === 'event') window.open(`/c/${item.id}`, '_self');
    else window.location.hash = `offer/${encodeURIComponent(item.id)}`;
  };

  // Marketplace deep-link: "Post a listing" opens Marketplace on its Selling
  // section (which holds the real create-vendor / create-listing flow).
  const [marketplaceSection, setMarketplaceSection] = useState<'browse' | 'orders' | 'selling'>('browse');
  const [marketplaceKey, setMarketplaceKey] = useState(0);

  // Host-an-event form (a REAL createCampaign -> publish flow, not a dead
  // toast). The event appears in the gallery once published.
  const [hostOpen, setHostOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: '', description: '', location: '', startsAt: '', price: '' });
  const [eventBusy, setEventBusy] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventsKey, setEventsKey] = useState(0);
  const [galleryKey, setGalleryKey] = useState(0);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const openSelling = () => {
    soundEngine.play('tap');
    setMarketplaceSection('selling');
    setMarketplaceKey((k) => k + 1);
    setActiveSubTab('marketplace');
  };

  const hostEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDraft.title.trim()) { setEventError('Give your event a title.'); return; }
    setEventBusy(true);
    setEventError(null);
    const created = await briefApi.createCampaign({
      title: eventDraft.title.trim(),
      type: 'event',
      description: eventDraft.description.trim() || undefined,
      location: eventDraft.location.trim() || null,
      startsAt: eventDraft.startsAt || null,
      price: eventDraft.price.trim() === '' ? 0 : Number(eventDraft.price)
    });
    if (!created.ok) {
      setEventBusy(false);
      setEventError(created.error ?? 'Could not create the event.');
      return;
    }
    // Publish so it actually shows up in the case (drafts are private).
    const published = await briefApi.campaignAction(created.data.id, 'publish');
    setEventBusy(false);
    if (!published.ok) {
      setEventError(`Event saved as a draft, but publishing failed: ${published.error ?? 'unknown'}`);
      return;
    }
    setHostOpen(false);
    setEventDraft({ title: '', description: '', location: '', startsAt: '', price: '' });
    setEventsKey((k) => k + 1);
    setGalleryKey((k) => k + 1);
    setActiveSubTab('events');
    showToast(`"${created.data.title}" is now live in the case.`);
  };

  // The room names and their counts live in ONE place: GET
  // /api/discover/summary. The grid below renders that, so a label can never
  // disagree with the number under it.

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── HEAD ── */}
      <DiscoveryHead
        eyebrow="Discover"
        title="What's happening nearby"
        subtitle="Marketplace first: what people here are selling, hosting, organising and needing carried."
        segments={[]}
        activeSegmentId={activeSubTab}
        onSegmentChange={() => {}}
      />

      {/* ── THE TILES: this screen's only primary navigation ── */}
      <DiscoverCategoryGrid
        tiles={summary?.tiles ?? [
          { key: 'marketplace', label: 'Marketplace', count: 0, unit: 'live offer' },
          { key: 'events', label: 'Events', count: 0, unit: 'published' },
          { key: 'circles', label: 'Circles', count: 0, unit: 'you could join' },
          { key: 'errands', label: 'Errands', count: 0, unit: 'open' }
        ]}
        active={activeSubTab}
        allActive={activeSubTab === 'all'}
        onSelect={(k) => setActiveSubTab(k)}
        onSelectAll={() => setActiveSubTab('all')}
      />
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px]" style={{ color: '#9CA3AF' }}>
          {summary ? summary.note : 'Counts are read from the rows on this screen, not seeded to fill the tiles.'}
        </p>
      </div>

      {/* ── THE ROOMS ── */}
      <div className="space-y-6">
        {(activeSubTab === 'marketplace' || activeSubTab === 'all') && (
          <div className="space-y-5 animate-fadeIn">
            <DiscoverFeatured
              featured={summary?.featured ?? null}
              asOf={summary?.asOf ?? null}
              busy={summaryBusy}
              onOpen={openFeatured}
              onRefresh={() => void loadSummary()}
              onPost={openSelling}
            />
            <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                  The counter
                </h3>
                <button
                  type="button"
                  onClick={openSelling}
                  className="text-[11px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                >
                  Sell something →
                </button>
              </div>
              <Marketplace key={marketplaceKey} initialSection={marketplaceSection} />
            </section>
          </div>
        )}

        {activeSubTab === 'events' && (
          <div className="space-y-5 animate-fadeIn">
            <section className="space-y-1.5">
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                Events around you
              </h3>
              <MuseumGallery key={galleryKey} />
            </section>
            <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs">
              <EventsHub key={eventsKey} />
            </div>
          </div>
        )}

        {activeSubTab === 'circles' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
              Circles
            </h3>
            <p className="text-[11px] -mt-1" style={{ color: '#6B7280' }}>
              Groups with a door: members, shared work, a pot whose progress moves only when money actually
              settles. The count on the tile is circles you could join right now.
            </p>
            <Circles />
          </div>
        )}

        {activeSubTab === 'errands' && (
          <div className="animate-fadeIn">
            <ErrandsLobby />
          </div>
        )}

        {/* The 'all' scroll finishes with the two rooms that are not inventory,
            so nobody has to hunt for them. */}
        {activeSubTab === 'all' && (
          <div className="space-y-5">
            <section className="space-y-1.5">
              <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                Events around you
              </h3>
              <MuseumGallery key={galleryKey} />
            </section>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>Circles</h3>
                <Circles />
              </section>
              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-2">
                <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>Errands</h3>
                <p className="text-[11px]" style={{ color: '#6B7280' }}>
                  The board lives in its own room, where a carrier can take it.
                </p>
                <button type="button" onClick={() => setActiveSubTab('errands')} className="text-[11px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                  Open the lobby →
                </button>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* ── FLOATING ACTION GROUP — the two real ways to add something.
          Above the dock (z-50 for the sheets, so this stays reachable) and
          every button posts to a real endpoint. ── */}
      <div className={`fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2 ${activeSubTab === 'errands' ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setEventError(null); setHostOpen(true); }}
          className="inline-flex items-center gap-1.5 pl-3 pr-4 py-2.5 rounded-full text-xs font-black shadow-lg cursor-pointer active:scale-95 transition"
          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
        >
          <CalendarPlus className="w-4 h-4" />
          Host an event
        </button>
        <button
          type="button"
          onClick={openSelling}
          className="inline-flex items-center gap-1.5 pl-3 pr-4 py-2.5 rounded-full text-xs font-black bg-white border shadow-lg cursor-pointer active:scale-95 transition"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          <Plus className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
          Post a listing
        </button>
      </div>

      {/* ── HOST AN EVENT (real createCampaign -> publish) ── */}
      {hostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 border border-black/5 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--color-primary)]">
                  Host an event
                </span>
                <h3 className="text-base font-black text-[color:var(--color-text)] mt-1">Put your event on the public feed</h3>
              </div>
              <button
                type="button"
                onClick={() => { setHostOpen(false); setEventError(null); }}
                className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[color:var(--color-text-muted)]">
              It is published immediately and appears in the case for everyone.
            </p>

            {eventError && <p role="alert" className="text-xs font-bold text-[color:var(--color-danger)]">{eventError}</p>}

            <form onSubmit={hostEvent} className="space-y-3">
              <input
                type="text"
                placeholder="Event title (e.g. Kilimani Street Market)"
                aria-label="Event title"
                value={eventDraft.title}
                onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
                required
              />
              <input
                type="text"
                placeholder="Location (e.g. Kilimani, Nairobi)"
                aria-label="Event location"
                value={eventDraft.location}
                onChange={(e) => setEventDraft((d) => ({ ...d, location: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
              />
              <input
                type="datetime-local"
                aria-label="Event start"
                value={eventDraft.startsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, startsAt: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
              />
              <textarea
                placeholder="Description (what happens, who it is for)"
                aria-label="Event description"
                value={eventDraft.description}
                onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none resize-none"
              />
              <input
                type="number"
                min="0"
                placeholder="Entry price (KES, 0 = free)"
                aria-label="Event price"
                value={eventDraft.price}
                onChange={(e) => setEventDraft((d) => ({ ...d, price: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
              />

              <button
                type="submit"
                disabled={eventBusy}
                className="w-full py-2.5 rounded-2xl bg-[color:var(--color-primary)] hover:opacity-90 text-white text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {eventBusy ? 'Publishing…' : 'Publish event'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityFeedView;
