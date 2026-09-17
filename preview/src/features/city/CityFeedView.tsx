import React, { useState } from 'react';
import * as briefApi from '../../api/briefApi';
import { DiscoveryHead } from './DiscoveryHead';
import { DiscoverFeed } from './DiscoverFeed';
import type { DiscoverRoom } from './taxonomy';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// DISCOVER — the one shop window.
//
// This file used to hold its own room state, its own tile grid, its own
// featured card and its own copy of the marketplace / gallery / circles /
// errands surfaces. It now holds ONE thing: the legacy Discover screen's
// composition (2x2 switcher, big full-bleed cards, a detail sheet, a floating
// Create pill) fed by real rows. The legacy screens under preview/src/screens/
// render the same component, so there is no second Discover to drift from the
// first — that was the "unified app" ask.
//
// What did NOT come across from the legacy screen: its data. INITIAL_DISCOVER_
// POSTS was a fiction array (an invented market claiming "over 40 verified
// creative vendors", Unsplash photographs of other people's goods, phone numbers
// and Telegram handles that reach nobody). The shape was worth keeping; the
// invented content was not, and it is gone from the tree.
// ---------------------------------------------------------------------------

export interface CityFeedViewProps {
  /**
   * Which room the board opens on. 'all' is the default: the mixed supply view
   * with the four flow tiles on top of it, so the marketplace is the first thing
   * on screen either way. The taxonomy's own note is that All exists for the
   * person who does not yet know which flow they want.
   */
  initialSubTab?: DiscoverRoom;
  /** Kept for the shell's contract; a space is opened from You → Spaces now. */
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'all',
  className = ''
}) => {
  const [room, setRoom] = useState<DiscoverRoom>(initialSubTab);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // The two loops that put something on this board for real. Both write rows.
  const [hostOpen, setHostOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: '', description: '', location: '', startsAt: '', price: '' });
  const [eventBusy, setEventBusy] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  // No second create-form. The counter is where a listing (and the shop it
  // belongs to) is actually written, so "Post a listing" lands on its Selling
  // tab instead of mimicking it with a half-copied form.
  const [counterSection, setCounterSection] = useState<'browse' | 'orders' | 'selling'>('browse');
  const [counterKey, setCounterKey] = useState(0);

  const openSelling = () => {
    soundEngine.play('tap');
    setRoom('all');
    setCounterSection('selling');
    setCounterKey((k) => k + 1);
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
    const published = await briefApi.campaignAction(created.data.id, 'publish');
    setEventBusy(false);
    if (!published.ok) {
      setEventError(`Event saved as a draft, but publishing failed: ${published.error ?? 'unknown'}`);
      return;
    }
    setHostOpen(false);
    setEventDraft({ title: '', description: '', location: '', startsAt: '', price: '' });
    setRoom('events');
    showToast(`"${created.data.title}" is published and on the board.`);
  };

  return (
    <div className={`space-y-5 max-w-xl mx-auto ${className}`}>
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      <DiscoveryHead
        eyebrow="Discover"
        title="What's happening nearby"
        subtitle="What people here are selling, hosting, organising and needing carried — read from what they actually published."
        segments={[]}
        activeSegmentId={room}
        onSegmentChange={() => {}}
      />

      <DiscoverFeed
        room={room}
        onRoomChange={(r) => setRoom(r)}
        onPostListing={openSelling}
        counterSection={counterSection}
        counterKey={counterKey}
        onHostEvent={() => { soundEngine.play('tap'); setEventError(null); setHostOpen(true); }}
      />

      {/* ── HOST AN EVENT — the real createCampaign → publish loop ── */}
      {hostOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(24,19,12,0.6)' }}>
          <div className="w-full max-w-md bg-[color:var(--color-paper)] rounded-3xl overflow-hidden p-6 space-y-4 brief-lift-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                  Host an event
                </span>
                <h3 className="text-base font-black mt-1" style={{ color: 'var(--brief-ink)' }}>Put your event on the board</h3>
              </div>
              <button
                type="button"
                onClick={() => { setHostOpen(false); setEventError(null); }}
                className="text-xs font-bold cursor-pointer"
                style={{ color: 'var(--brief-muted)' }}
              >
                Cancel
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--brief-muted)' }}>
              It publishes immediately, so it appears on Discover and in the case for everyone. Nobody gets a
              seeded audience: registrations count people who actually registered.
            </p>

            {eventError && <p role="alert" className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>{eventError}</p>}

            <form onSubmit={hostEvent} className="space-y-3">
              <input
                type="text"
                placeholder="Event title (e.g. Kilimani Street Market)"
                aria-label="Event title"
                value={eventDraft.title}
                onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs border"
                style={{ background: 'var(--color-well)', boxShadow: 'var(--room-light-dim), inset 0 0 0 1px var(--brief-line)' }}
                required
              />
              <input
                type="text"
                placeholder="Location (e.g. Kilimani, Nairobi)"
                aria-label="Event location"
                value={eventDraft.location}
                onChange={(e) => setEventDraft((d) => ({ ...d, location: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs border"
                style={{ background: 'var(--color-well)', boxShadow: 'var(--room-light-dim), inset 0 0 0 1px var(--brief-line)' }}
              />
              <input
                type="datetime-local"
                aria-label="Event start"
                value={eventDraft.startsAt}
                onChange={(e) => setEventDraft((d) => ({ ...d, startsAt: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs border"
                style={{ background: 'var(--color-well)', boxShadow: 'var(--room-light-dim), inset 0 0 0 1px var(--brief-line)' }}
              />
              <textarea
                placeholder="Description (what happens, who it is for)"
                aria-label="Event description"
                value={eventDraft.description}
                onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs border resize-none"
                style={{ background: 'var(--color-well)', boxShadow: 'var(--room-light-dim), inset 0 0 0 1px var(--brief-line)' }}
              />
              <input
                type="number"
                min={0}
                placeholder="Entry price (KES, 0 = free)"
                aria-label="Event price"
                value={eventDraft.price}
                onChange={(e) => setEventDraft((d) => ({ ...d, price: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border"
                style={{ background: 'var(--color-well)', boxShadow: 'var(--room-light-dim), inset 0 0 0 1px var(--brief-line)' }}
              />
              <button
                type="submit"
                disabled={eventBusy}
                className="w-full py-2.5 rounded-2xl text-xs font-black cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
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
