import React, { useState, useEffect } from 'react';
import type { Space, Listing } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { ArrowLeft, Archive, RotateCcw, Globe, Lock, Link2, Pencil } from 'lucide-react';
import type { ListingUpdate } from '../../api/types';
import { PipelineView } from './PipelineView';
import { SpaceOperatingPanel } from './SpaceOperatingPanel';
import { SpaceMoney } from './SpaceMoney';
import { CatalogView } from './CatalogView';
import { CreateFlowModal } from './CreateFlowModal';
import { soundEngine } from '../../utils/SoundEngine';
import { needsAttention } from '../home/spaceSignals';

export interface SpaceShellProps {
  spaceId: string;
  initialTab?: 'pipeline' | 'ledger' | 'catalog' | 'operating';
  onBack?: () => void;
  onShare?: (space: Space) => void;
  className?: string;
}

export type SpaceSurfaceTab =
  | 'pipeline' | 'ledger' | 'catalog' | 'operating'
  | 'overview' | 'offers' | 'people' | 'cargo' | 'activity' | 'money';

export const SpaceShell: React.FC<SpaceShellProps> = ({
  spaceId,
  initialTab = 'pipeline',
  onBack,
  onShare,
  className = ''
}) => {
  const [space, setSpace] = useState<Space | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // A freshly created space (nothing answered yet) opens on its own file, so
  // the first thing a vendor sees is the set of questions, not an empty inbox.
  const [activeTab, setActiveTab] = useState<SpaceSurfaceTab>(initialTab);
  const [createFlowOpen, setCreateFlowOpen] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  // The identity editor: a space is NOT frozen by publishing. Its name, goal,
  // target and cover stay editable by the owner, and the public directory is
  // derived per read, so the next look shows the change.
  const [identityOpen, setIdentityOpen] = useState<boolean>(false);
  const [identity, setIdentity] = useState<{ name: string; goal: string; target: string; image: string | null }>({
    name: '', goal: '', target: '', image: null
  });
  const [identityBusy, setIdentityBusy] = useState<boolean>(false);
  const [identityError, setIdentityError] = useState<string | null>(null);

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

  const openIdentity = () => {
    soundEngine.play('tap');
    setIdentity({
      name: space?.name ?? '',
      goal: space?.goal ?? '',
      target: space?.targetValueKes ? String(space.targetValueKes) : '',
      image: space?.image ?? null
    });
    setIdentityError(null);
    setIdentityOpen(true);
  };

  const saveIdentity = async () => {
    if (!space) return;
    if (!identity.name.trim()) { setIdentityError('A space needs a name.'); return; }
    setIdentityBusy(true);
    setIdentityError(null);
    const res = await briefApi.updateSpace(space.id, {
      name: identity.name.trim(),
      goal: identity.goal.trim(),
      // null clears the target rather than silently meaning "zero".
      targetValueKes: identity.target.trim() === '' ? null : Number(identity.target),
      image: identity.image
    });
    setIdentityBusy(false);
    if (res.ok) {
      setSpace(res.data.space);
      setIdentityOpen(false);
      showToast(space.visibility === 'public'
        ? 'Saved. Your space is public, so the directory shows this on the next read.'
        : 'Saved.');
      // No refetch: PATCH returns the fully hydrated row, and re-reading it
      // straight back is how a UI ends up briefly showing the OLD name.
    } else {
      setIdentityError(res.error ?? 'Could not save those changes.');
    }
  };

  /**
   * Lifecycle moves go through the server's transition table. `changed:false`
   * is reported for what it is — a no-op, not a second publication — and a
   * refusal returns its reason so the card can show it.
   */
  const offerStatus = async (offerId: string, next: 'active' | 'paused' | 'sold_out' | 'archived') => {
    const res = await briefApi.setListingStatus(offerId, next);
    if (!res.ok) return res.error ?? 'That move was refused.';
    if (res.data.changed === false) showToast('It was already in that state — nothing changed.');
    loadSpace();
    return null;
  };

  const saveOffer = async (offerId: string, patch: ListingUpdate) => {
    const res = await briefApi.updateListing(offerId, patch);
    if (!res.ok) return res.error ?? 'Could not save that offer.';
    showToast('Offer saved.');
    loadSpace();
    return null;
  };

  /**
   * Sharing, honestly. A space has no page of its own — a public space is
   * found in the directory — so there is no "your space link" to copy, and the
   * button used to claim one. Now: copy what actually works, or say why there
   * is nothing to copy yet.
   */
  const copyText = async (value: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      /* the fallback below is the honest path */
    }
    return false;
  };

  const shareSpace = async () => {
    if (!space) return;
    soundEngine.play('tap');
    if (space.visibility !== 'public') {
      showToast(`This space is ${space.visibility}, so there is nothing public to share yet. Set it to Public first.`);
      return;
    }
    const url = `${window.location.origin}${window.location.pathname}#discover`;
    const copied = await copyText(url);
    showToast(copied
      ? 'Copied the Discover link — people find public spaces in its Spaces list. A space has no page of its own.'
      : `Copy it yourself: ${url}`);
    onShare?.(space);
  };

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

  // 4 Surfaces: the three operational ones, plus the maintained SPACE FILE.
  // The fourth is the one that keeps a space alive between orders — the schema,
  // its editorial queue, and how the pipeline is reading it. Its badge count is
  // the number of REAL open items the server derived, not a notification tally.
  const openItems = space?.editorialOpen ?? 0;
  const tabs: Array<{ id: 'pipeline' | 'ledger' | 'catalog' | 'operating'; label: string }> = [
    { id: 'operating', label: openItems > 0 ? `Space · ${openItems}` : 'Space' },
    { id: 'pipeline', label: 'Inbox' },
    { id: 'ledger', label: 'Money' },
    { id: 'catalog', label: `Offers (${space.offers?.length || 0})` }
  ];

  // Map legacy tabs to the consolidated surfaces
  const currentTab = (
    activeTab === 'overview' || activeTab === 'people' || activeTab === 'cargo' || activeTab === 'activity'
      ? 'pipeline'
      : activeTab === 'money'
      ? 'ledger'
      : activeTab === 'offers'
      ? 'catalog'
      : activeTab
  ) as 'pipeline' | 'ledger' | 'catalog' | 'operating';

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
              onClick={() => void shareSpace()}
              disabled={!space}
              className="p-2 rounded-full bg-white text-[color:var(--color-text)] shadow-2xs border border-black/5 hover:bg-gray-100 transition-all cursor-pointer"
              aria-label="Copy the link that reaches this space"
              title="Copy link"
            >
              <Link2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={openIdentity}
              disabled={busy}
              className="inline-flex items-center gap-1 p-2 rounded-full bg-white text-[color:var(--color-text)] shadow-2xs border border-black/5 hover:bg-gray-100 transition-all cursor-pointer"
              aria-label="Edit this space"
              title="Edit name, goal, target"
            >
              <Pencil className="w-4 h-4" />
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

        {/* NEXT STEP — one obvious action, derived from real rows. Not a menu. */}
        {space && (
          <div className="p-3 rounded-2xl bg-[color:var(--color-primary-subtle)] border border-[color:var(--color-primary)] space-y-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-[color:var(--color-primary)]">▶ Next step</span>
            {(space.offers?.length ?? 0) === 0 ? (
              <p className="text-xs font-bold text-[color:var(--color-text)]">Add your first offer to make this space sellable.</p>
            ) : (
              <p className="text-xs font-bold text-[color:var(--color-text)]">
                {(() => {
                  const items = needsAttention(space);
                  if (items.length === 0) return 'All caught up — open your inbox or add another offer.';
                  const first = items[0];
                  return first.label.charAt(0).toUpperCase() + first.label.slice(1) + '.';
                })()}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCreateFlowOpen(true)}
                className="px-3 py-1.5 rounded-full bg-[color:var(--color-primary)] text-[color:var(--accent-ink)] text-xs font-bold cursor-pointer"
              >
                Add an offer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pipeline')}
                className="px-3 py-1.5 rounded-full bg-white text-[color:var(--color-text)] text-xs font-bold border border-black/10 cursor-pointer"
              >
                Open inbox
              </button>
            </div>
          </div>
        )}

        {identityOpen && (
          <div className="p-4 rounded-2xl border space-y-3" style={{ borderColor: 'var(--color-primary)' }}>
            <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
              Edit this space
            </p>
            <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Publishing does not freeze anything. These stay yours to change, and the public directory
              reads the current row on each look — there is no copy to update.
            </p>
            <input
              type="text"
              aria-label="Space name"
              value={identity.name}
              onChange={(e) => setIdentity((v) => ({ ...v, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-xs border border-black/10 bg-white"
            />
            <input
              type="text"
              aria-label="Space goal"
              value={identity.goal}
              onChange={(e) => setIdentity((v) => ({ ...v, goal: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-xs border border-black/10 bg-white"
            />
            <input
              type="number"
              min={0}
              aria-label="Monthly target"
              placeholder="Monthly target (KES)"
              value={identity.target}
              onChange={(e) => setIdentity((v) => ({ ...v, target: e.target.value }))}
              className="w-40 px-3 py-2 rounded-xl text-xs font-mono border border-black/10 bg-white"
            />
            {identityError && <p className="text-[11px] font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>{identityError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={identityBusy}
                onClick={() => void saveIdentity()}
                className="px-3.5 py-2 rounded-full text-[11px] font-black cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
              >
                {identityBusy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => { setIdentityOpen(false); setIdentityError(null); }}
                className="px-3.5 py-2 rounded-full text-[11px] font-bold cursor-pointer border border-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

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
            onShareOffer={(o) => showToast(`Link for "${o.title}" copied — buyers sign in to open it.`)}
            onOfferStatus={(id, next) => offerStatus(id, next)}
            onSaveOffer={(id, patch) => saveOffer(id, patch)}
          />
        </div>
      )}

      {/* ── SURFACE 4: THE SPACE FILE — schema, editorial queue, pipeline ── */}
      {currentTab === 'operating' && (
        <div className="animate-fadeIn">
          <SpaceOperatingPanel
            spaceId={space.id}
            maintenance={space.maintenance ?? null}
            onSwitchTab={(t) => setActiveTab(t)}
            onChanged={loadSpace}
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
