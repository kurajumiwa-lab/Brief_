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
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// DISCOVER — the browse screen, reformed.
//
// What changed and why (from the screenshot review):
//   * the Marketplace block is GONE from the All tab. "COMMUNITY MARKETPLACE &
//     SECOND-HAND DROPS" was clipped mid-word at the fold and its own
//     Browse/My orders/Selling row sat right on top of the bottom navigation.
//     Commerce is a mode, so it lives in its own segment now;
//   * the six category chips + four-row filter panel collapsed into the
//     gallery's one control line, with the deep filters behind a sheet;
//   * result counters ("2 shown") are removed — if you can see the exhibits,
//     you can count them;
//   * the two ways to ADD something became a floating action group, because a
//     primary action should not be orphaned text at the bottom of a scroll;
//   * Pulse is no longer a Discover room: it is "what happened in the ledger",
//     which belongs beside your own activity, so it opens on the Activity tab.
// ---------------------------------------------------------------------------

export interface CityFeedViewProps {
  initialSubTab?: 'events' | 'marketplace' | 'communities' | 'errands';
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}

// Three rooms, nothing else. Circles and the vaults are not inventory to be
// browsed next to a public gallery — they are who you are organised WITH, so
// they live on the coordination screen (Spaces). WAIRO dispatch belongs to
// errands, because a rider you push and an errand you post are the same walk.
// The market's numbers moved to Activity, where "what happened" lives.
type CitySubTab = 'events' | 'marketplace' | 'communities' | 'errands';

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'events',
  onOpenSpace,
  className = ''
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CitySubTab>(initialSubTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  // Four rooms. "Circles" is called Communities here because "circle" is
  // jargon a stranger has to be taught, and belonging needs no lecture. It
  // lives in Discover rather than in Spaces: exploring a neighbourhood is not
  // administering a business.
  const subTabs: Array<{ id: CitySubTab; label: string }> = [
    { id: 'events', label: 'Events' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'communities', label: 'Communities' },
    { id: 'errands', label: 'Errands' }
  ];

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── HEAD — clean premium light header + the section chips ── */}
      <DiscoveryHead
        eyebrow="Discover"
        title="Everything happening around you"
        subtitle="What is on, what is for sale, who to belong with, and what needs carrying."
        segments={subTabs}
        activeSegmentId={activeSubTab}
        onSegmentChange={(id) => { soundEngine.play('tap'); setActiveSubTab(id as CitySubTab); }}
      />

      {/* ── THE THREE ROOMS ── */}
      <div className="space-y-6">
        {activeSubTab === 'events' && (
          <div className="space-y-4 animate-fadeIn">
            {/* THE CASE — swiping inventory, not a feed. */}
            <section className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                  Events around you
                </h3>
              </div>
              <MuseumGallery key={galleryKey} />
            </section>

            {/* The full filter surface, for when the case is not enough. */}
            <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs">
              <EventsHub key={eventsKey} />
            </div>
          </div>
        )}

        {activeSubTab === 'marketplace' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Marketplace key={marketplaceKey} initialSection={marketplaceSection} />
          </div>
        )}

        {activeSubTab === 'communities' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn space-y-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
              Communities
            </h3>
            <p className="text-[11px] -mt-1" style={{ color: '#6B7280' }}>
              Groups with a door: members, shared work, a pot whose progress moves only when money actually
              settles. Nothing here is counted until somebody joins one.
            </p>
            <Circles />
          </div>
        )}

        {activeSubTab === 'errands' && (
          <div className="animate-fadeIn">
            <ErrandsLobby />
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
