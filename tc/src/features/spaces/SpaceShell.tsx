import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { PipelineView } from './PipelineView';
import { SpaceMoney } from './SpaceMoney';
import { CatalogView } from './CatalogView';
import { CreateFlowModal } from './CreateFlowModal';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceShellProps {
  spaceId: string;
  initialTab?: 'pipeline' | 'ledger' | 'catalog';
  onBack?: () => void;
  onShare?: (space: Space) => void;
  className?: string;
}

export type SpaceSurfaceTab = 'pipeline' | 'ledger' | 'catalog' | 'overview' | 'offers' | 'people' | 'cargo' | 'activity' | 'money';

export const SpaceShell: React.FC<SpaceShellProps> = ({
  spaceId,
  initialTab = 'pipeline',
  onBack,
  onShare,
  className = ''
}) => {
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<SpaceSurfaceTab>(initialTab);
  const [createFlowOpen, setCreateFlowOpen] = useState<boolean>(false);
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
        showToast('Offer published and live in catalog!');
        loadSpace();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to publish offer');
    }
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

  // 3 Consolidated Surfaces
  const tabs: Array<{ id: 'pipeline' | 'ledger' | 'catalog'; label: string }> = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'catalog', label: `Catalog (${space.offers?.length || 0})` }
  ];

  // Map legacy tabs to the 3 consolidated surfaces
  const currentTab = (
    activeTab === 'overview' || activeTab === 'people' || activeTab === 'cargo' || activeTab === 'activity'
      ? 'pipeline'
      : activeTab === 'money'
      ? 'ledger'
      : activeTab === 'offers'
      ? 'catalog'
      : activeTab
  ) as 'pipeline' | 'ledger' | 'catalog';

  return (
    <div className={`space-y-4 max-w-2xl mx-auto ${className}`}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1A1F2E] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Surface Navigation Selector */}
      <div className="flex items-center justify-between pb-1 border-b border-black/5">
        <div className="flex items-center space-x-1.5">
          {tabs.map((tab) => {
            const isSelected = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  soundEngine.play('tap');
                  setActiveTab(tab.id);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#1A1F2E] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#1A1F2E] hover:bg-black/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCreateFlowOpen(true)}
          className="px-3 py-1.5 rounded-full bg-[#5B2EA6] hover:bg-[#4a2489] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
        >
          + Add Offer
        </button>
      </div>

      {/* ── SURFACE 1: PIPELINE (Primary Landing) ── */}
      {currentTab === 'pipeline' && (
        <div className="animate-fadeIn">
          <PipelineView
            space={space}
            onRefresh={loadSpace}
            onShareOffer={(t) => showToast(`Link for "${t}" copied!`)}
          />
        </div>
      )}

      {/* ── SURFACE 2: LEDGER (Financial Truth) ── */}
      {currentTab === 'ledger' && (
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

      {/* ── SURFACE 3: CATALOG (What You Sell) ── */}
      {currentTab === 'catalog' && (
        <div className="animate-fadeIn">
          <CatalogView
            offers={space.offers}
            onAddOffer={() => setCreateFlowOpen(true)}
            onPublishOffer={handlePublishOffer}
            onShareOffer={(o) => showToast(`Share link for "${o.title}" copied!`)}
          />
        </div>
      )}

      {/* Unified Create Flow Modal */}
      {createFlowOpen && (
        <CreateFlowModal
          isOpen={createFlowOpen}
          existingSpaceId={space.id}
          onClose={() => setCreateFlowOpen(false)}
          onCompleted={(updatedSpace) => {
            setSpace(updatedSpace);
            showToast('Catalog offer added and published!');
            loadSpace();
          }}
        />
      )}
    </div>
  );
};

export default SpaceShell;
