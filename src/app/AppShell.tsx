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
import { soundEngine } from '../utils/SoundEngine';

export interface AppShellProps {
  initialTab?: BriefNavigationTab;
  initialSpaceId?: string | null;
  onNavigateLegacyTab?: (tab: string) => void;
  className?: string;
}

export const AppShell: React.FC<AppShellProps> = ({
  initialTab = 'pipeline',
  initialSpaceId = null,
  onNavigateLegacyTab,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<BriefNavigationTab>(initialTab);
  const [activeSpace, setActiveSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    try {
      const res = await briefApi.listMySpaces();
      if (res.ok && res.data?.spaces && res.data.spaces.length > 0) {
        setActiveSpace(res.data.spaces[0]);
      } else {
        // Fallback default space for Amina if offline or unseeded
        setActiveSpace({
          id: 'spc_amina_cakes_1',
          ownerId: 'usr_amina',
          vendorId: 'vend_amina_1',
          name: "Amina's Cakes",
          type: 'side_hustle',
          goal: 'Get my first 20 customers',
          targetValueKes: 100000,
          status: 'active',
          capabilities: ['commerce', 'communication', 'ledger', 'activity'],
          metrics: {
            revenueKes: 84200,
            customerCount: 23,
            activeOrdersCount: 7,
            totalOrdersCount: 19,
            offersCount: 3
          },
          offers: [
            {
              id: 'list_bday_1',
              vendorId: 'vend_amina_1',
              title: 'Birthday Cake',
              description: 'Custom 2-tier celebration cake for 10-15 people',
              price: 4500,
              currency: 'KES',
              type: 'product',
              status: 'active',
              quantityAvailable: 10,
              locationName: 'Kilimani, Nairobi',
              objectId: 'obj_bday_1',
              media: [],
              tags: ['cakes', 'birthday'],
              category: 'food',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            } as unknown as Listing
          ],
          recentActivities: [
            {
              id: 'act_1',
              spaceId: 'spc_amina_cakes_1',
              kind: 'space_created',
              title: "Created Space: Amina's Cakes",
              description: 'Goal: Get my first 20 customers',
              createdAt: new Date().toISOString()
            },
            {
              id: 'act_2',
              spaceId: 'spc_amina_cakes_1',
              kind: 'offer_published',
              title: 'Published offer: Birthday Cake',
              description: 'KES 4,500 · Live and accepting orders',
              createdAt: new Date().toISOString()
            }
          ],
          recentConversations: [
            {
              id: 'cnv_1',
              spaceId: 'spc_amina_cakes_1',
              customerName: 'Mary Wanjiku',
              customerContact: '+254712345678',
              offerTitle: 'Birthday Cake',
              offerPriceKes: 4500,
              status: 'converted',
              messages: [
                { id: 'm1', from: 'customer', sender: 'Mary Wanjiku', text: 'Can you make it for Saturday?', at: new Date().toISOString() },
                {
                  id: 'm2',
                  from: 'owner',
                  sender: "Amina's Cakes",
                  text: 'Quotation: 2-Tier Chocolate Birthday Cake — KES 5,200',
                  quote: {
                    id: 'quot_1',
                    title: '2-Tier Chocolate Birthday Cake',
                    priceKes: 5200,
                    notes: 'Including Saturday Kilimani delivery',
                    status: 'sent',
                    createdAt: new Date().toISOString()
                  },
                  at: new Date().toISOString()
                }
              ],
              quotes: [
                {
                  id: 'quot_1',
                  title: '2-Tier Chocolate Birthday Cake',
                  priceKes: 5200,
                  notes: 'Including Saturday Kilimani delivery',
                  status: 'sent',
                  createdAt: new Date().toISOString()
                }
              ],
              paymentPrompts: [
                {
                  id: 'pay_1',
                  phoneNumber: '+254712345678',
                  amountKes: 5200,
                  description: 'Birthday Cake Order',
                  status: 'paid',
                  receipt: 'QJ891234AB',
                  createdAt: new Date().toISOString()
                }
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  // Deep link detection on mount / URL change
  useEffect(() => {
    loadSpaces();

    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash.startsWith('#offer/')) {
        const offerId = hash.replace('#offer/', '');
        const targetOffer = activeSpace?.offers?.find((o) => o.id === offerId);
        if (targetOffer) {
          setActivePublicOffer(targetOffer);
          setPublicOfferModalOpen(true);
        }
      } else if (hash === '#city' || hash === '#events') {
        setActiveTab('city');
      }
    }
  }, [initialSpaceId]);

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
    if (activeTab === 'city') {
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

  return (
    <div className={`min-h-screen w-full bg-[#F0EDE8] text-[#1A1F2E] font-sans flex ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* 4-Tab Navigation (Desktop Sidebar / Mobile Bottom Dock) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onCreateAction={handleContextualFab}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-28 md:pb-6 overflow-y-auto min-h-screen">
        {/* Legacy Home Surface Compatibility for tests */}
        {activeTab === 'home' ? (
          <HomeSurface
            userName="Amina"
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

            {/* ── TAB 2: PIPELINE (Primary Seller Workspace + Integrated City Highlights) ── */}
            {(activeTab === 'pipeline' || activeTab === 'spaces' || activeTab === 'activity') && activeSpace && (
              <PipelineView
                space={activeSpace}
                onRefresh={loadSpaces}
                onViewCityFeed={() => setActiveTab('city')}
                onShareOffer={(t) => showToast(`Share link for "${t}" copied!`)}
              />
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
                <span className="text-[10px] font-black uppercase tracking-wider text-[#93EE34] bg-[#1A1F2E] px-2 py-0.5 rounded-full">
                  City Feed Post
                </span>
                <h3 className="text-base font-black text-[#1A1F2E] mt-1">Share with Nairobi</h3>
              </div>
              <button
                type="button"
                onClick={() => setCityPostModalOpen(false)}
                className="text-xs text-[#64748B] hover:text-[#1A1F2E]"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[#64748B]">
              Post an event, a marketplace drop, or an EPL matchday challenge to the Nairobi public feed.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCityPostModalOpen(false);
                  showToast('Opening event creator');
                }}
                className="p-3 rounded-2xl bg-[#FAFAF8] hover:bg-[#1A1F2E] hover:text-white transition-all text-xs font-bold border border-black/5 text-center"
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
                className="p-3 rounded-2xl bg-[#FAFAF8] hover:bg-[#1A1F2E] hover:text-white transition-all text-xs font-bold border border-black/5 text-center"
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
                <span className="text-[10px] font-black uppercase tracking-wider text-[#5B2EA6]">
                  Quick Manual Order
                </span>
                <h3 className="text-base font-black text-[#1A1F2E]">New Walk-in Customer</h3>
              </div>
              <button
                type="button"
                onClick={() => setManualOrderOpen(false)}
                className="text-xs text-[#64748B] hover:text-[#1A1F2E]"
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
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                required
              />
              <input
                type="tel"
                placeholder="WhatsApp Phone (e.g. 0712345678)"
                value={manualCustomerPhone}
                onChange={(e) => setManualCustomerPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Item Title (e.g. Birthday Cake)"
                  value={manualItemTitle}
                  onChange={(e) => setManualItemTitle(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Price (KES)"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#FAFAF8] text-xs border border-black/5 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-2xl bg-[#1A1F2E] hover:bg-black text-[#93EE34] text-xs font-black shadow-md transition-all cursor-pointer"
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
