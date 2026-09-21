import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../api/types';
import * as briefApi from '../api/briefApi';
import { Navigation, BriefNavigationTab } from './Navigation';
import { AppBelt, readPlace, PLACE_KEY } from './AppBelt';
import { NavSheet, type SheetTarget } from './NavSheet';
import { SearchResults } from '../components/SearchResults';
import { HomeSurface } from '../features/home/HomeSurface';
import { SpaceShell } from '../features/spaces/SpaceShell';
import { SpaceMoney } from '../features/spaces/SpaceMoney';
import { CatalogView } from '../features/spaces/CatalogView';
import { CityFeedView } from '../features/city/CityFeedView';
import type { DiscoverRoom } from '../features/city/taxonomy';
import { SpacesLanding } from '../features/spaces/SpacesLanding';
import { PublicSpacePage } from '../features/spaces/PublicSpacePage';
import { CreateFlowModal } from '../features/spaces/CreateFlowModal';
import { PublicOfferModal } from '../features/offers/PublicOfferModal';
import { JoinRoom } from '../features/city/JoinRoom';
import { SupplyWorkspace } from '../features/supply/SupplyWorkspace';
import { RequestsWorkspace, requestPath } from '../features/requests/RequestsWorkspace';
import { ActivitySurface } from '../features/activity/ActivitySurface';
import { PartnerDesk } from '../features/partner/PartnerDesk';
import { YouSurface } from '../features/you/YouSurface';
import { EntityDetail } from '../features/you/EntityDetail';
import { FirstRunChecklist } from '../features/you/FirstRunChecklist';
import { soundEngine } from '../utils/SoundEngine';
import { SyncStatusDot } from '../ui/SyncStatusDot';

export interface AppShellProps {
  initialTab?: BriefNavigationTab;
  initialSpaceId?: string | null;
  onNavigateLegacyTab?: (tab: string) => void;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  initialTab = 'city',
  initialSpaceId = null,
  onNavigateLegacyTab,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<BriefNavigationTab>(initialTab);
  const [supplyRoute, setSupplyRoute] = useState(() => window.location.hash.replace(/^#\/?supply\/?/, ''));
  const [requestRoute, setRequestRoute] = useState('');
  const [offerLinkId, setOfferLinkId] = useState('');
  // A join link pasted in a WhatsApp group opens a room's landing page for a
  // person with no account and no session. It is NOT a tab: the nav is hidden
  // while it is open, because a stranger deciding whether to join a room should
  // not be looking at the app's own furniture.
  const [joinCode, setJoinCode] = useState('');
  const [spaceLink, setSpaceLink] = useState('');
  const [spaceError, setSpaceError] = useState('');
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  // Where the You tab opens. The ⓘ on a screen deep-links to the audit page
  // rather than putting the explanation in the reader's way.
  const [youSection, setYouSection] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authed, setAuthed] = useState<boolean>(true);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [firstRun, setFirstRun] = useState<boolean>(false);
  // Which Discover segment a jump from Home should land on ('pulse' is the
  // world's numbers; the rest are the browse surfaces).
  // One room per deep link, and the type comes from the taxonomy module so the
  // shell can never name a room the board does not have.
  const [discoverSubTab, setDiscoverSubTab] = useState<DiscoverRoom>('all');
  // The belt's two owned pieces of state: the sheet (the long list of
  // destinations, which is why the band above can stay short) and the search
  // query, which lives in the URL hash so a searched view can be pasted,
  // reloaded and shared like every other surface here.
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [place, setPlace] = useState<string>(readPlace);
  const [firstRunChecked, setFirstRunChecked] = useState<boolean>(false);

  // Modals
  const [createFlowOpen, setCreateFlowOpen] = useState<boolean>(false);
  const [createFlowInitialStep, setCreateFlowInitialStep] = useState<1 | 2>(1);
  const [publicOfferModalOpen, setPublicOfferModalOpen] = useState<boolean>(false);
  const [activePublicOffer, setActivePublicOffer] = useState<Listing | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Manual Walk-in Order State on Pipeline
  const [manualOrderOpen, setManualOrderOpen] = useState<boolean>(false);
  const [manualCustomerName, setManualCustomerName] = useState<string>('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState<string>('');
  const [manualItemTitle, setManualItemTitle] = useState<string>('');
  const [manualPrice, setManualPrice] = useState<string>('');

  // Citizen Post Dialog on City Tab
  const [cityPostModalOpen, setCityPostModalOpen] = useState<boolean>(false);

  /**
   * Where a sheet entry goes. Every target lands on a surface that already
   * exists — a tab, a discover room, or a You section — because a nav item that
   * opened nothing is worse than no nav item.
   */
  const goSheetTarget = (target: SheetTarget) => {
    // Only three destinations are reachable from here: the band owns the rooms
    // and the dock owns the five tabs, so a sheet entry duplicating either would
    // be a third way to do one thing.
    if (target.kind === 'tab') {
      setActiveTab(target.tab);
      window.location.hash = target.tab;
      return;
    }
    setYouSection(target.section);
    setActiveTab('you');
    window.location.hash = 'you';
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSpaces = async () => {
    setLoading(true);
    setSpaceError('');
    try {
      const res = await briefApi.listMySpaces();
      if (res.ok && res.data?.spaces && res.data.spaces.length > 0) {
        setActiveSpace(res.data.spaces[0]);
      } else {
        setActiveSpace(null);
        setSpaceError(res.ok ? '' : res.error);
      }
    } catch {
      setActiveSpace(null);
      setSpaceError('Could not load your spaces. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Deep link detection on mount / URL change
  useEffect(() => {
    loadSpaces();
    briefApi.whoAmI().then(async (res) => {
      setAuthed(res.ok);
      // First-run onboarding: a signed-in member with NO table-banking group
      // yet gets a guided checklist instead of a passive dashboard. Derived
      // from real rows (getMyTableBanking), dismissible once, never re-shown
      // after they dismiss it or once a group exists.
      if (res.ok && !firstRunChecked && typeof window !== 'undefined' && !window.localStorage.getItem('brief.firstRunDismissed')) {
        setFirstRunChecked(true);
        const tb = await briefApi.getMyTableBanking();
        if (tb.ok && tb.data.length === 0) setFirstRun(true);
      }
    });

    const navigate = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'supply' || hash.startsWith('supply/')) {
        setActiveTab('supply');
        setSupplyRoute(hash.slice(7) || 'mine');
      } else if (hash === 'requests' || hash.startsWith('requests/')) {
        setActiveTab('requests');
        try { setRequestRoute(decodeURIComponent(hash.slice(9))); } catch { setRequestRoute('invalid'); }
      } else if (hash.startsWith('space/')) {
        try { setSpaceLink(decodeURIComponent(hash.slice(6))); } catch { setSpaceLink(''); }
      } else if (hash.startsWith('join/')) {
        try { setJoinCode(decodeURIComponent(hash.slice(5))); } catch { setJoinCode(''); }
      } else if (hash.startsWith('offer/')) {
        // Sellers copy this link from their catalog. It resolves to the real
        // public offer view — for a signed-in buyer, because ordering needs a
        // session. It is not presented as an anonymous storefront link.
        try { setOfferLinkId(decodeURIComponent(hash.slice(6))); } catch { setOfferLinkId('invalid'); }
      } else if (hash === 'search' || hash.startsWith('search/')) {
        // #search/<term> is a real surface: it renders /api/search's answer.
        // An empty term clears it rather than showing an empty results card.
        const term = hash === 'search' ? '' : decodeURIComponent(hash.slice(7));
        setSearchQuery(term);
        setEntityId(null);
      } else if (hash === 'entity' || hash.startsWith('entity/')) {
        const id = decodeURIComponent(hash.slice(7));
        if (id) { setEntityId(id); setActiveTab('you'); }
      } else if (hash === '' || (hash && hash !== 'join')) {
        setJoinCode('');
        setSearchQuery('');
        const tabs: Record<string, BriefNavigationTab> = { home: 'home', city: 'city', events: 'city', spaces: 'pipeline', pipeline: 'pipeline', discover: 'city', catalog: 'catalog', activity: 'activity', ledger: 'ledger', partners: 'partners', you: 'you' };
        if (tabs[hash]) { setEntityId(null); setActiveTab(tabs[hash]); }
        else if (!hash) setActiveTab(initialTab);
      }
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [initialSpaceId, initialTab]);

  // The copied #offer/<id> link is answered by reading the listing from the
  // server. A 404 or a signed-out visitor is reported, not papered over.
  useEffect(() => {
    if (!offerLinkId) return;
    let live = true;
    if (offerLinkId === 'invalid') {
      showToast('That offer link is not a valid offer id.');
      setOfferLinkId('');
      return;
    }
    void briefApi.getListing(offerLinkId).then((res) => {
      if (!live) return;
      if (res.ok) {
        setActivePublicOffer(res.data);
        setPublicOfferModalOpen(true);
      } else {
        showToast(res.status === 401
          ? 'Sign in to open that offer — offer links are not anonymous pages yet.'
          : res.error ?? 'That offer is no longer available.');
      }
      if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setOfferLinkId('');
    });
    return () => { live = false; };
  }, [offerLinkId]);

  const handlePublishOffer = async (offerId: string) => {
    if (!activeSpace) return;
    try {
      const res = await briefApi.publishSpaceOffer(activeSpace.id, offerId);
      if (res.ok) {
        showToast('Offer published to catalog!');
        loadSpaces();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish offer');
    }
  };

  // Contextual FAB triggers based on active tab
  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpace || !manualCustomerName.trim()) return;

    soundEngine.play('reward');
    try {
      const convRes = await briefApi.createSpaceConversation(activeSpace.id, {
        customerName: manualCustomerName.trim(),
        // Blank is blank. A contact is what the seller was given, and a recorded
        // walk-in with no number is a real, ordinary state — not a number to invent.
        customerContact: manualCustomerPhone.trim(),
        message: `Walk-in inquiry for ${manualItemTitle.trim() || 'Custom Order'}`
      });

      if (!convRes.ok) {
        // A silent failure here means the seller believes the walk-in is in the
        // book when nothing was written.
        showToast(convRes.error ?? 'The enquiry was not recorded.');
        return;
      }
      if (convRes.data?.conversation) {
        const conv = convRes.data.conversation;
        let quoted = false;
        if (manualPrice && Number(manualPrice) > 0) {
          const q = await briefApi.createSpaceQuote(activeSpace.id, conv.id, {
            title: manualItemTitle.trim() || 'Custom Order',
            priceKes: Number(manualPrice),
            notes: 'Walk-in customer order'
          });
          quoted = q.ok;
          if (!q.ok) showToast(`Enquiry recorded, but the quote was refused: ${q.error ?? 'unknown reason'}`);
        }
        // Not "Order created": what exists now is an enquiry, and maybe a quote.
        // An order is what the customer agrees to, and the ledger will say so.
        if (!quoted && !(manualPrice && Number(manualPrice) > 0)) {
          showToast(`Enquiry recorded for ${manualCustomerName.trim()}. No order yet.`);
        }
        setManualCustomerName('');
        setManualCustomerPhone('');
        setManualItemTitle('');
        setManualPrice('');
        setManualOrderOpen(false);
        loadSpaces();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to create order');
    }
  };

  // First-run onboarding: a signed-in member with no group yet is intercepted
  // by a guided checklist (the "dedicated onboarding state" similar apps use).
  // "Start your group" drops them into the You tab, where the group flow lives;
  // "Skip for now" is remembered so they are never nagged again.
  if (firstRun) {
    return (
      <div className="min-h-screen w-full bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-sans flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <FirstRunChecklist
            groups={[]}
            onStartGroup={() => {
              setFirstRun(false);
              setActiveTab('you');
              if (typeof window !== 'undefined') window.location.hash = '#you';
            }}
            onAddMembers={() => {}}
            onRecordContribution={() => {}}
            onSeeLedger={() => {}}
            onDismiss={() => {
              if (typeof window !== 'undefined') window.localStorage.setItem('brief.firstRunDismissed', '1');
              setFirstRun(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen w-full bg-[color:var(--color-bg)] text-[color:var(--color-text)] font-sans flex ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Persistent, honest sync status: the offline queue's state, not a
          fake "synced". */}
      <div className="fixed top-3 right-3 z-40 md:top-4 md:right-4">
        <SyncStatusDot />
      </div>

      {/* 4-Tab Navigation (Desktop Sidebar / Mobile Bottom Dock) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        spaceName={activeSpace?.name || 'Your Trace'}
        revenueKes={activeSpace?.metrics?.revenueKes ?? 0}
        offersCount={activeSpace?.offers?.length ?? 0}
        pendingInquiriesCount={activeSpace?.recentConversations?.filter((c) => c.status !== 'converted').length ?? 0}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-44 md:pb-8 overflow-y-auto min-h-screen">
        {/* The band: what the sheet is not, in one short row, plus the
            departments rail and the message slot. It lives inside the scroll
            column so it behaves the same on a phone and on a desktop. */}
        <AppBelt
          onOpenSheet={() => setSheetOpen(true)}
          onHome={() => { window.location.hash = ''; setActiveTab('home'); }}
          onOpenRoom={(room) => { setDiscoverSubTab(room); setActiveTab('city'); window.location.hash = 'city'; }}
          onSearch={(term) => { window.location.hash = `search/${encodeURIComponent(term)}`; }}
          activeRoom={activeTab === 'city' ? discoverSubTab : null}
          className="-mx-4 sm:-mx-6 -mt-6 mb-5"
        />
        {activeTab === 'requests' ? <RequestsWorkspace route={requestRoute} /> : activeTab === 'supply' ? <SupplyWorkspace route={supplyRoute || 'mine'} /> : null}
        {/* SPACES with no space open is the STREET: the shopfronts you operate
            and the ones you follow. Circles and vaults are not here — belonging
            and filing are different nouns from operating a business. */}
        {['pipeline', 'spaces'].includes(activeTab) && !activeSpace && (
          <SpacesLanding
            onOpenSpace={(id) => {
              void (async () => {
                const res = await briefApi.getSpace(id);
                if (res.ok && res.data?.space) setActiveSpace(res.data.space);
                else loadSpaces();
              })();
            }}
            onOpenPublicSpace={(slug) => { window.location.hash = `space/${encodeURIComponent(slug)}`; }}
          />
        )}

        {/* A shared space link resolves here, and only here does a view row get
            written — so the vendor's view count means page openings. */}
        {spaceLink && (
          <div className="fixed inset-0 z-40 bg-[color:var(--color-bg)] overflow-y-auto p-4 pb-24">
            <PublicSpacePage
              slug={spaceLink}
              onBack={() => { window.location.hash = ''; setSpaceLink(''); }}
              onOpenOffer={(id) => { window.location.hash = `offer/${encodeURIComponent(id)}`; }}
            />
          </div>
        )}
        {['ledger', 'catalog'].includes(activeTab) && !activeSpace && (
          <section className="max-w-3xl mx-auto py-12">
            <h2 className="text-xl font-bold">{loading ? 'Loading your workspace…' : 'A space for what you offer'}</h2>
            {spaceError ? <><p role="alert" className="my-4">{spaceError}</p><button onClick={loadSpaces}>Retry</button><button className="ml-4 underline" onClick={() => requestPath()}>Sign in through My Requests</button></> : !loading && <><p className="my-4">No business space yet. Create a Request to describe what you need, or create a space for what you sell.</p><button className="px-4 py-3 rounded-xl bg-[color:var(--color-primary)] text-[color:var(--accent-ink)]" onClick={() => { setCreateFlowInitialStep(1); setCreateFlowOpen(true); }}>Create a space</button></>}
          </section>
        )}
        {/* Legacy Home Surface Compatibility for tests */}
        {activeTab === 'home' ? (
          <HomeSurface
            userName="there"
            onOpenSpace={(id) => {
              setActiveTab('pipeline');
              loadSpaces();
            }}
            onExploreDiscover={(sub) => {
              if (sub) setDiscoverSubTab(sub);
              setActiveTab('city');
            }}
            onOpenPulse={() => setActiveTab('activity')}
            onOpenSpaces={() => setActiveTab('pipeline')}
            onGetPaid={() => setActiveTab('ledger')}
            onOpenHow={() => { setYouSection('how'); setActiveTab('you'); }}
            onOpenEarn={() => { setYouSection('earn'); setActiveTab('you'); window.location.hash = 'you'; }}
          />
        ) : (
          <div>
            {/* ── TAB 1: CITY (Full Citizen Experience) ── */}
            {(activeTab === 'city' || activeTab === 'discover') && (
              <CityFeedView
                key={discoverSubTab}
                initialSubTab={discoverSubTab}
                onOpenSpace={(id) => setActiveTab('pipeline')}
              />
            )}

            {/* ── TAB 2: SPACES (the full workspace: build, sell, track) ── */}
            {(activeTab === 'pipeline' || activeTab === 'spaces') && activeSpace && (
              <SpaceShell
                spaceId={activeSpace.id}
                onBack={() => { setActiveSpace(null); setActiveTab('pipeline'); }}
                onShare={() => { /* SpaceShell copies and reports the truth itself */ }}
                onCreateOrder={() => setManualOrderOpen(true)}
              />
            )}

            {/* ── TAB 4: ACTIVITY (the user's own operational inbox) ── */}
            {activeTab === 'activity' && (
              <ActivitySurface onOpenRequests={() => requestPath()} />
            )}

            {/* ── OPERATOR: PARTNER DESK (distribution partners) ── */}
            {activeTab === 'partners' && <PartnerDesk />}

            {/* ── YOU (profile, follows, subscriptions) ── */}
            {activeTab === 'you' && (
              entityId ? (
                <EntityDetail
                  entityId={entityId}
                  authed={authed}
                  onClose={() => { setEntityId(null); window.location.hash = '#you'; }}
                  onRequireAuth={() => showToast('Sign in to follow entities.')}
                />
              ) : (
                <YouSurface
                  key={youSection ?? 'you'}
                  initialSection={(youSection ?? 'profile') as any}
                  onOpenEntity={(id) => { setEntityId(id); window.location.hash = `#entity/${id}`; }}
                  onRequireAuth={() => showToast('Sign in to continue.')}
                />
              )
            )}

            {/* ── TAB 3: LEDGER (Financial Truth) ── */}
            {activeTab === 'ledger' && activeSpace && (
              <SpaceMoney
                spaceId={activeSpace.id}
                revenueKes={activeSpace.metrics?.revenueKes}
                pendingKes={0}
                ordersCount={activeSpace.metrics?.totalOrdersCount}
                onViewLedger={() => showToast('Opening ledger')}
              />
            )}

            {/* ── TAB 4: CATALOG (What You Sell) ── */}
            {activeTab === 'catalog' && activeSpace && (
              <CatalogView
                offers={activeSpace.offers}
                onAddOffer={() => {
                  setCreateFlowInitialStep(2);
                  setCreateFlowOpen(true);
                }}
                onPublishOffer={handlePublishOffer}
                onShareOffer={(o) => {
                  setActivePublicOffer(o);
                  setPublicOfferModalOpen(true);
                }}
                onOfferStatus={async (id, next) => {
                  const res = await briefApi.setListingStatus(id, next as any);
                  if (!res.ok) return res.error ?? 'That move was refused.';
                  loadSpaces();
                  return null;
                }}
                onSaveOffer={async (id, patch) => {
                  const res = await briefApi.updateListing(id, patch);
                  if (!res.ok) return res.error ?? 'Could not save that offer.';
                  loadSpaces();
                  return null;
                }}
              />
            )}
          </div>
        )}
      </main>

      {/* Citizen Post Dialog on City Tab */}
      {cityPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[color:var(--color-paper)] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 border border-black/5 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[color:var(--color-primary)] bg-[color:var(--color-text)] px-2 py-0.5 rounded-full">
                  City Feed Post
                </span>
                <h3 className="text-base font-black text-[color:var(--color-text)] mt-1">Share with Nairobi</h3>
              </div>
              <button
                type="button"
                onClick={() => setCityPostModalOpen(false)}
                className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[color:var(--color-text-muted)]">
              Post an event or a marketplace product drop to the Nairobi public feed.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCityPostModalOpen(false);
                  showToast('Opening event creator');
                }}
                className="p-3 rounded-2xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-text)] hover:text-white transition-all text-xs font-bold border border-black/5 text-center"
              >
                🎟️ Post Event
              </button>
              <button
                type="button"
                onClick={() => {
                  setCityPostModalOpen(false);
                  setCreateFlowInitialStep(2);
                  setCreateFlowOpen(true);
                }}
                className="p-3 rounded-2xl bg-[color:var(--color-surface)] hover:bg-[color:var(--color-text)] hover:text-white transition-all text-xs font-bold border border-black/5 text-center"
              >
                🛍️ Drop Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Order Drawer on Pipeline FAB */}
      {manualOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[color:var(--color-paper)] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 border border-black/5 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-black uppercase tracking-wider text-[color:var(--color-primary)]">
                  Quick Manual Order
                </span>
                <h3 className="text-base font-black text-[color:var(--color-text)]">New Walk-in Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setManualOrderOpen(false)}
                className="text-xs text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="space-y-3">
              <input
                type="text"
                placeholder="Customer Name (e.g. John Kamau)"
                value={manualCustomerName}
                onChange={(e) => setManualCustomerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
                required
              />
              <input
                type="tel"
                placeholder="WhatsApp Phone (e.g. 0712345678)"
                value={manualCustomerPhone}
                onChange={(e) => setManualCustomerPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Item Title (e.g. Birthday Cake)"
                  value={manualItemTitle}
                  onChange={(e) => setManualItemTitle(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Price (KES)"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[color:var(--color-surface)] text-xs border border-black/5 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] text-xs font-black shadow-md transition-all cursor-pointer"
              >
                Create Pipeline Order
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Unified Progressive Create Flow Modal */}
      {createFlowOpen && (
        <CreateFlowModal
          isOpen={createFlowOpen}
          initialStep={createFlowInitialStep}
          existingSpaceId={activeSpace?.id}
          onClose={() => setCreateFlowOpen(false)}
          onCompleted={(space) => {
            setActiveSpace(space);
            showToast(`Space "${space.name}" active!`);
            loadSpaces();
          }}
        />
      )}

      {/* A shared join link, opened cold, before an account exists. */}
      {joinCode && (
        <div className="fixed inset-0 z-[60] overflow-y-auto px-4 py-6" style={{ background: 'var(--color-bg)' }}>
          <JoinRoom
            code={joinCode}
            signedIn={authed}
            onRequireAuth={() => showToast('Sign in or create an account to join a room.')}
            onOpenCircles={() => { setJoinCode(''); window.location.hash = 'city'; setActiveTab('city'); }}
          />
        </div>
      )}

      {/* The long list of destinations, held in one place so the band above
          stays short and the screens below stay uncluttered. */}
      <NavSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        place={place}
        onSetPlace={(next) => {
          setPlace(next);
          try {
            if (next) window.localStorage.setItem(PLACE_KEY, next);
            else window.localStorage.removeItem(PLACE_KEY);
          } catch {
            showToast('This browser will not store the area, so the forecast stays on the default.');
          }
        }}
        onGo={(target) => goSheetTarget(target)}
      />

      {/* #search/<term>: the belt's box resolves here, on the real /api/search
          surface. A view that nothing can reach would have been a decoration,
          and a decoration in a search box is the fastest way to teach someone
          that the numbers on this app are also decorative. */}
      {searchQuery && (
        <div className="fixed inset-0 z-[60] overflow-y-auto px-4 py-6" style={{ background: 'var(--color-bg)' }} role="dialog" aria-modal="true" aria-label={`Search results for ${searchQuery}`}>
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Search · {searchQuery}
              </p>
              <button
                type="button"
                onClick={() => { window.location.hash = ''; setSearchQuery(''); }}
                className="text-[12px] font-bold underline cursor-pointer"
                style={{ color: 'var(--color-primary)' }}
              >
                Back to the app
              </button>
            </div>
            <SearchResults
              query={searchQuery}
              onOpenObject={(o) => {
                // Objects open where the shell already shows an object: the
                // entity page. Anything without an id is left unclickable
                // rather than wired to a view that would show nothing.
                const id = o?.id ?? o?.objectId ?? null;
                if (!id) return;
                setSearchQuery('');
                window.location.hash = `entity/${encodeURIComponent(String(id))}`;
              }}
              onOpenEntity={(entityId) => {
                setSearchQuery('');
                window.location.hash = `entity/${encodeURIComponent(entityId)}`;
              }}
            />
          </div>
        </div>
      )}

      {/* Customer-Facing Public Offer View */}
      {publicOfferModalOpen && activePublicOffer && (
        <PublicOfferModal
          isOpen={publicOfferModalOpen}
          offer={activePublicOffer}
          spaceName={activeSpace?.name ?? 'Trace seller'}
          onClose={() => setPublicOfferModalOpen(false)}
          onInquirySent={() => showToast('Inquiry submitted to seller!')}
        />
      )}
    </div>
  );
};

export default AppShell;
