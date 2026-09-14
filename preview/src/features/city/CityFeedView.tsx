import React, { useState } from 'react';
import {
  ShoppingBag,
  Users,
  Lock,
  ArrowRight,
  Clock,
  Store,
  Bike,
  Plus
} from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import { DiscoveryHead } from './DiscoveryHead';
import { MuseumGallery } from './MuseumGallery';
import { PublicSpaces } from './PublicSpaces';
import { WairoDispatchPanel } from './WairoDispatchPanel';
import { EventsHub } from '../../components/EventsHub';
import { Marketplace } from '../../components/Marketplace';
import { Circles } from '../../components/Circles';
import { Vault } from '../../components/vault/Vault';
import { soundEngine } from '../../utils/SoundEngine';

export interface CityFeedViewProps {
  initialSubTab?: 'all' | 'events' | 'marketplace' | 'circles' | 'vault';
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}

type CitySubTab = 'all' | 'events' | 'marketplace' | 'circles' | 'vault';

export const CityFeedView: React.FC<CityFeedViewProps> = ({
  initialSubTab = 'all',
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
  // toast). The event appears in the Events hub once published.
  const [hostOpen, setHostOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState({ title: '', description: '', location: '', startsAt: '', price: '' });
  const [eventBusy, setEventBusy] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventsKey, setEventsKey] = useState(0);

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
    // Publish so it actually shows up in the Events hub (drafts are private).
    const published = await briefApi.campaignAction(created.data.id, 'publish');
    setEventBusy(false);
    if (!published.ok) {
      setEventError(`Event saved as a draft, but publishing failed: ${published.error ?? 'unknown'}`);
      return;
    }
    setHostOpen(false);
    setEventDraft({ title: '', description: '', location: '', startsAt: '', price: '' });
    setEventsKey((k) => k + 1);
    setActiveSubTab('events');
    showToast(`"${created.data.title}" is now live in Events.`);
  };

  const subTabs: Array<{ id: CitySubTab; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'events', label: 'Events' },
    { id: 'marketplace', label: 'Market' },
    { id: 'circles', label: 'Circles' },
    { id: 'vault', label: 'Vault' }
  ];

  return (
    <div className={`space-y-6 max-w-4xl mx-auto ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* ── CITY FEED HEAD — clean premium light header ── */}
      <DiscoveryHead
        eyebrow="Discover"
        title="Everything happening around you"
        subtitle="Events, marketplace drops, community circles and vaults — from people nearby."
        segments={subTabs}
        activeSegmentId={activeSubTab}
        onSegmentChange={(id) => { soundEngine.play('tap'); setActiveSubTab(id as CitySubTab); }}
      />

      {/* ── MOUNTED CITIZEN SURFACES ── */}
      <div className="space-y-6">
        {/* ALL CITY STREAM VIEW */}
        {activeSubTab === 'all' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Top Events Section — the museum gallery (swiping inventory, not feed) */}
            <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Events around you
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); setEventError(null); setHostOpen(true); }}
                      className="text-xs font-bold text-[color:var(--color-primary)] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Host</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('events')}
                      className="text-xs font-bold text-[color:var(--color-primary)] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <span>All filters</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <MuseumGallery />
            </section>

            {/* Marketplace Section */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShoppingBag className="w-4 h-4 text-[color:var(--color-accent)]" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Community Marketplace & Second-Hand Drops
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={openSelling}
                      className="text-xs font-bold text-[color:var(--color-accent)] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post a listing</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('marketplace')}
                      className="text-xs font-bold text-[color:var(--color-accent)] hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Explore Market</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs">
                  <Marketplace />
                </div>
            </section>

            {/* Public Spaces Section — projects owners chose to make discoverable */}
            <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4 text-[color:var(--color-primary)]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                  Public Spaces
                </h3>
              </div>
              <PublicSpaces onOpenSpace={(id) => onOpenSpace?.(id)} />
            </section>

            {/* WAIRO Rider Dispatch — route riders to onboarded shops */}
            <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
              <div className="flex items-center space-x-2">
                <Bike className="w-4 h-4 text-[color:var(--color-primary)]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                  WAIRO · Rider Dispatch
                </h3>
              </div>
              <WairoDispatchPanel />
            </section>

            {/* Community Circles & Vault Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-[color:var(--color-primary)]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Community Circles & Mutual Aid
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('circles')}
                    className="text-[11px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                  >
                    All Circles →
                  </button>
                </div>
                <Circles />
              </section>

              <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-[color:var(--color-text)]" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                      Vault & Special Drops
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('vault')}
                    className="text-[11px] font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer"
                  >
                    Open Vault →
                  </button>
                </div>
                <Vault />
              </section>
            </div>
          </div>
        )}

        {/* SPECIFIC SUB-TABS */}
        {activeSubTab === 'events' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                🎟️ Events & Festivals
              </h3>
              <button
                type="button"
                onClick={() => { soundEngine.play('tap'); setEventError(null); setHostOpen(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer"
                style={{ background: 'var(--color-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Host an event
              </button>
            </div>
            <EventsHub key={eventsKey} />
          </div>
        )}

        {activeSubTab === 'marketplace' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[color:var(--color-text)]">
                🛍️ Marketplace
              </h3>
              <button
                type="button"
                onClick={openSelling}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white cursor-pointer"
                style={{ background: 'var(--color-accent)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Post a listing
              </button>
            </div>
            <Marketplace key={marketplaceKey} initialSection={marketplaceSection} />
          </div>
        )}

        {activeSubTab === 'circles' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Circles />
          </div>
        )}

        {activeSubTab === 'vault' && (
          <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs animate-fadeIn">
            <Vault />
          </div>
        )}
      </div>

      {/* ── HOST AN EVENT (real createCampaign -> publish) ── */}
      {hostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
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
                className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[color:var(--color-text-muted)]">
              It is published immediately and appears in Events &amp; Festivals for everyone.
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
