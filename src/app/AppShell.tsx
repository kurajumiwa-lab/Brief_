import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../../src/api/types';
import * as briefApi from '../api/briefApi';
import { Navigation, BriefNavigationTab } from './Navigation';
import { HomeSurface } from '../features/home/HomeSurface';
import { PipelineView } from '../features/spaces/PipelineView';
import { SpaceMoney } from '../features/spaces/SpaceMoney';
import { CatalogView } from '../features/spaces/CatalogView';
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

  useEffect(() => {
    loadSpaces();
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

  const handleOpenFab = () => {
    if (activeTab === 'catalog') {
      setCreateFlowInitialStep(2);
    } else {
      setCreateFlowInitialStep(1);
    }
    setCreateFlowOpen(true);
  };

  return (
    <div className={`min-h-screen w-full bg-[#F0EDE8] text-[#1A1F2E] font-sans flex ${className}`}>
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* 3-Surface Navigation (Sidebar on desktop, bottom dock on mobile) */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        onCreateAction={handleOpenFab}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-28 md:pb-6 overflow-y-auto min-h-screen">
        {/* Legacy Home Surface Compatibility */}
        {activeTab === 'home' ? (
          <HomeSurface
            userName="Amina"
            onOpenSpace={(id) => {
              setActiveTab('pipeline');
              loadSpaces();
            }}
            onExploreDiscover={() => setActiveTab('catalog')}
            onGetPaid={() => setActiveTab('ledger')}
          />
        ) : loading && !activeSpace ? (
          <div className="p-12 text-center text-xs text-[#64748B]">
            Loading Space...
          </div>
        ) : activeSpace ? (
          <div>
            {/* ── SURFACE 1: PIPELINE (Primary Landing) ── */}
            {(activeTab === 'pipeline' || activeTab === 'spaces' || activeTab === 'activity') && (
              <PipelineView
                space={activeSpace}
                onRefresh={loadSpaces}
                onShareOffer={(t) => showToast(`Share link for "${t}" copied!`)}
              />
            )}

            {/* ── SURFACE 2: LEDGER (Financial Truth) ── */}
            {activeTab === 'ledger' && (
              <SpaceMoney
                spaceId={activeSpace.id}
                revenueKes={activeSpace.metrics?.revenueKes}
                pendingKes={0}
                ordersCount={activeSpace.metrics?.totalOrdersCount}
                onViewLedger={() => showToast('Opening ledger')}
              />
            )}

            {/* ── SURFACE 3: CATALOG (What You Sell) ── */}
            {(activeTab === 'catalog' || activeTab === 'discover') && (
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
        ) : (
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-white text-center space-y-3 mt-12 shadow-sm">
            <h3 className="text-base font-black text-[#1A1F2E]">No Space Created Yet</h3>
            <p className="text-xs text-[#64748B]">Create your first space to start receiving orders and tracking revenue.</p>
            <button
              type="button"
              onClick={() => {
                setCreateFlowInitialStep(1);
                setCreateFlowOpen(true);
              }}
              className="px-4 py-2.5 rounded-full bg-[#1A1F2E] text-[#93EE34] text-xs font-black cursor-pointer"
            >
              + Create Your First Space
            </button>
          </div>
        )}
      </main>

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
