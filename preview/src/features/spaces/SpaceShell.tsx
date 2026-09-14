import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { ArrowLeft, Archive, RotateCcw, Globe, Lock, Link2 } from 'lucide-react';
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
  const [busy, setBusy] = useState<boolean>(false);

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

  const setVisibility = async (visibility: 'private' | 'unlisted' | 'public') => {
    if (!space) return;
    setBusy(true);
    const res = await briefApi.updateSpace(space.id, { visibility });
    setBusy(false);
    if (res.ok) {
      setSpace(res.data.space);
      showToast(visibility === 'public'
        ? 'Space is now public — anyone can discover it.'
        : visibility === 'unlisted'
        ? 'Space is unlisted — reachable by link only.'
        : 'Space is private — only you can see it.');
    } else {
      showToast(res.error ?? 'Could not change visibility.');
    }
  };

  const toggleArchive = async () => {
    if (!space) return;
    setBusy(true);
    const next = space.status === 'archived' ? 'active' : 'archived';
    const res = await briefApi.updateSpace(space.id, { status: next });
    setBusy(false);
    if (res.ok) {
      setSpace(res.data.space);
      showToast(next === 'archived' ? `Archived "${space.name}".` : `Restored "${space.name}".`);
    } else {
      showToast(res.error ?? 'Could not update that space.');
    }
  };

  if (isLoading && !space) {
    return (
      <div className="p-10 text-center text-xs text-[color:var(--color-text-muted)]">
        Loading space...
      </div>
    );
  }

  if (!space) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="text-sm font-bold text-[color:var(--color-text)]">Space not found</p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-full bg-gray-200 text-xs font-bold text-[color:var(--color-text)] cursor-pointer"
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

  const vis = space?.visibility ?? 'private';

  return (
    <div className={`space-y-4 max-w-2xl mx-auto ${className}`}>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[color:var(--color-text)] text-white text-xs font-bold shadow-2xl animate-fadeIn border border-white/10">
          {toastMsg}
        </div>
      )}

      {/* Space identity + controls (this is the "portal", not a register) */}
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onBack?.(); }}
            className="flex items-center gap-1 text-xs font-bold text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Spaces
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShare?.(space!)}
              disabled={!space}
              className="p-2 rounded-full bg-white text-[color:var(--color-text)] shadow-2xs border border-black/5 hover:bg-gray-100 transition-all cursor-pointer"
              aria-label="Share space"
              title="Share"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleArchive}
              disabled={busy || !space}
              className="p-2 rounded-full bg-white text-[color:var(--color-text)] shadow-2xs border border-black/5 hover:bg-gray-100 transition-all cursor-pointer"
              aria-label={space?.status === 'archived' ? 'Restore space' : 'Archive space'}
              title={space?.status === 'archived' ? 'Restore' : 'Archive'}
            >
              {space?.status === 'archived' ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight leading-tight">
            {space?.name ?? 'Space'}
          </h1>
          <p className="text-xs text-[color:var(--color-text-muted)]">
            {space?.goal || (space?.type ?? 'business').replace('_', ' ')}
          </p>
        </div>

        {/* Visibility — the owner decides who can discover this space */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[color:var(--color-text-muted)]">Visibility</span>
          {(['private', 'unlisted', 'public'] as const).map((v) => {
            const active = vis === v;
            const Icon = v === 'private' ? Lock : v === 'unlisted' ? Link2 : Globe;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                disabled={busy}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  active ? 'bg-[color:var(--color-primary)] text-[color:var(--accent-ink)]' : 'bg-white text-[color:var(--color-text-muted)] border border-black/5 hover:text-[color:var(--color-text)]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {v === 'private' ? 'Private' : v === 'unlisted' ? 'Unlisted' : 'Public'}
              </button>
            );
          })}
        </div>
      </header>

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
                    ? 'bg-[color:var(--color-text)] text-white shadow-xs'
                    : 'text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-black/5'
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
          className="px-3 py-1.5 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--accent-ink)] text-xs font-bold shadow-xs transition-all cursor-pointer"
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
