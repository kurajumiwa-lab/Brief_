import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { SpaceHeader } from './SpaceHeader';
import { SpaceOffers } from './SpaceOffers';
import { SpaceActivity } from './SpaceActivity';
import { SpacePeople } from './SpacePeople';
import { SpaceMoney } from './SpaceMoney';
import { SpaceDispatches } from './SpaceDispatches';
import { CreateOfferModal } from './CreateOfferModal';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceShellProps {
  spaceId: string;
  onBack?: () => void;
  onShare?: (space: Space) => void;
  className?: string;
}

export const SpaceShell: React.FC<SpaceShellProps> = ({
  spaceId,
  onBack,
  onShare,
  className = ''
}) => {
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'offers' | 'people' | 'cargo' | 'activity' | 'money'>('overview');
  const [createOfferOpen, setCreateOfferOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadSpace = async () => {
    setIsLoading(true);
    try {
      const res = await briefApi.getSpace(spaceId);
      if (res.ok && res.data?.space) {
        setSpace(res.data.space);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSpace();
  }, [spaceId]);

  const handlePublishOffer = async (offerId: string) => {
    if (!space) return;
    try {
      const res = await briefApi.publishSpaceOffer(space.id, offerId);
      if (res.ok) {
        showToast('Offer published and live!');
        loadSpace();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish offer');
    }
  };

  const handleOfferCreated = (newOffer: Listing) => {
    showToast(`Created offer: "${newOffer.title}"`);
    loadSpace();
  };

  if (isLoading && !space) {
    return (
      <div className="p-10 text-center text-xs text-[#64748B]">
        Loading space...
      </div>
    );
  }

  if (!space) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-sm font-bold text-[#1A1F2E]">Space not found</p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-full bg-gray-200 text-xs font-bold text-[#1A1F2E] cursor-pointer"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  const tabs: Array<{ id: 'overview' | 'offers' | 'people' | 'cargo' | 'activity' | 'money'; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'offers', label: `Offers (${space.offers?.length || 0})` },
    { id: 'people', label: `Chats (${space.recentConversations?.length || 0})` },
    { id: 'cargo', label: 'Cargo' },
    { id: 'activity', label: 'Activity' },
    { id: 'money', label: 'Money' }
  ];

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <SpaceHeader
        space={space}
        onBack={onBack}
        onAddOffer={() => setCreateOfferOpen(true)}
        onCreateOrder={() => showToast('Select an offer or conversation to create an order')}
        onShare={() => onShare?.(space) || showToast(`Share link for ${space.name} copied!`)}
      />

      {/* Tabs */}
      <div className="flex items-center space-x-1.5 border-b border-black/5 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              soundEngine.play('tap');
              setActiveTab(tab.id);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#1A1F2E] text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#1A1F2E] hover:bg-black/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fadeIn">
          <SpaceOffers
            offers={space.offers}
            onAddOffer={() => setCreateOfferOpen(true)}
            onPublishOffer={handlePublishOffer}
            onShareOffer={(o) => showToast(`Link for "${o.title}" copied!`)}
          />

          <SpaceActivity
            activities={space.recentActivities}
          />

          <SpacePeople
            spaceId={space.id}
            conversations={space.recentConversations}
            customers={space.recentConversations?.map((c) => ({
              name: c.customerName,
              contact: c.customerContact
            }))}
            onMessage={(c) => showToast(`Opening chat with ${c.name}`)}
            onRefresh={loadSpace}
          />
        </div>
      )}

      {activeTab === 'offers' && (
        <div className="animate-fadeIn">
          <SpaceOffers
            offers={space.offers}
            onAddOffer={() => setCreateOfferOpen(true)}
            onPublishOffer={handlePublishOffer}
            onShareOffer={(o) => showToast(`Link for "${o.title}" copied!`)}
          />
        </div>
      )}

      {activeTab === 'people' && (
        <div className="animate-fadeIn">
          <SpacePeople
            spaceId={space.id}
            conversations={space.recentConversations}
            customers={space.recentConversations?.map((c) => ({
              name: c.customerName,
              contact: c.customerContact
            }))}
            onMessage={(c) => showToast(`Opening chat with ${c.name}`)}
            onRefresh={loadSpace}
          />
        </div>
      )}

      {activeTab === 'cargo' && (
        <div className="animate-fadeIn">
          <SpaceDispatches
            spaceId={space.id}
            spaceName={space.name}
            onRefresh={loadSpace}
          />
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="animate-fadeIn">
          <SpaceActivity
            activities={space.recentActivities}
          />
        </div>
      )}

      {activeTab === 'money' && (
        <div className="animate-fadeIn">
          <SpaceMoney
            spaceId={space.id}
            revenueKes={space.metrics?.revenueKes}
            pendingKes={0}
            ordersCount={space.metrics?.totalOrdersCount}
            onViewLedger={() => showToast('Opening authoritative ledger')}
          />
        </div>
      )}

      {/* Modals */}
      {createOfferOpen && (
        <CreateOfferModal
          isOpen={createOfferOpen}
          spaceId={space.id}
          onClose={() => setCreateOfferOpen(false)}
          onOfferCreated={handleOfferCreated}
        />
      )}
    </div>
  );
};

export default SpaceShell;
