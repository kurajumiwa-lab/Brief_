import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../api/types';
import * as briefApi from '../api/briefApi';
import { Navigation, BriefNavigationTab } from './Navigation';
import { HomeSurface } from '../features/home/HomeSurface';
import { PipelineView } from '../features/spaces/PipelineView';
import { SpaceMoney } from '../features/spaces/SpaceMoney';
import { CatalogView } from '../features/spaces/CatalogView';
import { CityFeedView } from '../features/city/CityFeedView';
import { CreateFlowModal } from '../features/spaces/CreateFlowModal';
import { PublicOfferModal } from '../features/offers/PublicOfferModal';
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
  const [spaceError, setSpaceError] = useState('');
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authed, setAuthed] = useState<boolean>(true);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [firstRun, setFirstRun] = useState<boolean>(false);
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
      } else if (hash === 'entity' || hash.startsWith('entity/')) {
        const id = decodeURIComponent(hash.slice(7));
        if (id) { setEntityId(id); setActiveTab('you'); }
      } else {
        const tabs: Record<string, BriefNavigationTab> = { home: 'home', city: 'city', events: 'city', spaces: 'pipeline', pipeline: 'pipeline', discover: 'city', catalog: 'catalog', activity: 'activity', ledger: 'ledger', partners: 'partners', you: 'you' };
        if (tabs[hash]) { setEntityId(null); setActiveTab(tabs[hash]); }
        else if (!hash) setActiveTab(initialTab);
      }
    };
    navigate();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [initialSpaceId, initialTab]);

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
  const handleContextualFab = () => {
    soundEngine.play('heavyTap');
    if (activeTab === 'requests' || activeTab === 'supply') {
      requestPath('new');
    } else if (activeTab === 'city') {
      // Contextual on City: Post an Event, Listing, or Ticket
      setCityPostModalOpen(true);
    } else if (activeTab === 'catalog') {
      // Contextual on Catalog: Add Offer (Skips to Step 2)
      setCreateFlowInitialStep(2);
      setCreateFlowOpen(true);
    } else if (activeTab === 'ledger') {
      // Contextual on Ledger: Log Outflow
      showToast('Log an outflow via the quick category buttons above');
    } else {
      // Contextual on Pipeline: New Order / Quote
      setManualOrderOpen(true);
    }
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpace || !manualCustomerName.trim()) return;

    soundEngine.play('reward');
    try {
      const convRes = await briefApi.createSpaceConversation(activeSpace.id, {
        customerName: manualCustomerName.trim(),
        customerContact: manualCustomerPhone.trim() || '+254700000000',
        message: `Walk-in inquiry for ${manualItemTitle.trim() || 'Custom Order'}`
      });

      if (convRes.ok && convRes.data?.conversation) {
        const conv = convRes.data.conversation;
        if (manualPrice && Number(manualPrice) > 0) {
          await briefApi.createSpaceQuote(activeSpace.id, conv.id, {
            title: manualItemTitle.trim() || 'Custom Order',
            priceKes: Number(manualPrice),
            notes: 'Walk-in customer order'
          });
        }
        showToast(`Order created for ${manualCustomerName}`);
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
        onCreateAction={handleContextualFab}
        spaceName={activeSpace?.name || 'Your Brief'}
        revenueKes={activeSpace?.metrics?.revenueKes ?? 0}
        offersCount={activeSpace?.offers?.length ?? 0}
        pendingInquiriesCount={activeSpace?.recentConversations?.filter((c) => c.status !== 'converted').length ?? 0}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-28 md:pb-6 overflow-y-auto min-h-screen">
        {activeTab === 'requests' ? <RequestsWorkspace route={requestRoute} /> : activeTab === 'supply' ? <SupplyWorkspace route={supplyRoute || 'mine'} /> : null}
        {['pipeline', 'spaces', 'ledger', 'catalog'].includes(activeTab) && !activeSpace && (
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
            onExploreDiscover={() => setActiveTab('city')}
            onGetPaid={() => setActiveTab('ledger')}
          />
        ) : (
          <div>
            {/* ── TAB 1: CITY (Full Citizen Experience) ── */}
            {(activeTab === 'city' || activeTab === 'discover') && (
              <CityFeedView onOpenSpace={(id) => setActiveTab('pipeline')} />
            )}

            {/* ── TAB 2: SPACES (Primary Seller Workspace + Integrated City Highlights) ── */}
            {(activeTab === 'pipeline' || activeTab === 'spaces') && activeSpace && (
              <PipelineView
                space={activeSpace}
                onRefresh={loadSpaces}
                onViewCityFeed={() => setActiveTab('city')}
                onShareOffer={(t) => showToast(`Share link for "${t}" copied!`)}
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
              />
            )}
          </div>
        )}
      </main>

      {/* Citizen Post Dialog on City Tab */}
      {cityPostModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 border border-black/5 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--color-primary)] bg-[color:var(--color-text)] px-2 py-0.5 rounded-full">
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
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4 border border-black/5 animate-scaleIn">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--color-primary)]">
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

      {/* Customer-Facing Public Offer View */}
      {publicOfferModalOpen && activePublicOffer && activeSpace && (
        <PublicOfferModal
          isOpen={publicOfferModalOpen}
          offer={activePublicOffer}
          spaceName={activeSpace.name}
          onClose={() => setPublicOfferModalOpen(false)}
          onInquirySent={() => showToast('Inquiry submitted to seller!')}
        />
      )}
    </div>
  );
};

export default AppShell;
