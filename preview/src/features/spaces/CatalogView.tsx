import React, { useState } from 'react';
import type { Listing, ListingUpdate } from '../../api/types';
import { Tag, Plus, ShoppingBag, X } from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';
import { MicroBadge } from '../../ui/MicroBadge';
import { ContextMenu } from '../../ui/ContextMenu';

// ---------------------------------------------------------------------------
// CATALOG VIEW — the seller's own offers, with REAL controls.
//
// Two rules this screen exists to honour:
//
//   1. NOTHING HERE IS COSMETIC. This used to carry a Pause/Resume button that
//      only flipped local React state — the offer stayed live to buyers, so
//      the control was a lie with a checkmark. Status now goes through
//      POST /api/listings/:id/status and the card re-renders from the row the
//      server sends back. A no-op is reported as a no-op (`changed: false`).
//
//   2. AN OFFER IS EDITABLE AFTER PUBLISHING, WITHIN ITS LAWFUL MOVES.
//      Content (title, description, price, stock, place) PATCHes the listing;
//      the lifecycle moves through the transition table. `archived` is
//      terminal by design — withdrawn offers do not come back, because orders
//      already placed refer to what the listing was. Re-listing means a new
//      offer, and the UI says so instead of offering a button that would be
//      refused.
//
// The transition map below is a COURTESY, so a menu never offers what the
// server will refuse. The server stays authoritative and its refusal is shown
// word for word.
// ---------------------------------------------------------------------------

type LifecycleMove = 'active' | 'paused' | 'sold_out' | 'archived';

const NEXT_MOVES: Record<string, Array<{ to: LifecycleMove; label: string; tone?: 'default' | 'danger' }>> = {
  // A draft has nothing to pause — it is already invisible to buyers. It can
  // be published (the inline primary action) or withdrawn.
  draft: [{ to: 'archived', label: 'Withdraw this offer', tone: 'danger' }],
  active: [
    { to: 'paused', label: 'Pause — hidden from buyers' },
    { to: 'sold_out', label: 'Mark sold out' },
    { to: 'archived', label: 'Withdraw this offer', tone: 'danger' }
  ],
  paused: [
    { to: 'active', label: 'Resume — live again' },
    { to: 'archived', label: 'Withdraw this offer', tone: 'danger' }
  ],
  sold_out: [
    { to: 'active', label: 'Back in stock — relist' },
    { to: 'archived', label: 'Withdraw this offer', tone: 'danger' }
  ],
  archived: []
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'DRAFT', active: 'ACTIVE', paused: 'PAUSED', sold_out: 'SOLD OUT', archived: 'WITHDRAWN'
};

export interface CatalogViewProps {
  offers: Listing[];
  onAddOffer: () => void;
  onPublishOffer?: (offerId: string) => void;
  onShareOffer?: (offer: Listing) => void;
  /** A real lifecycle move. Resolves to an error string, or null on success. */
  onOfferStatus?: (offerId: string, next: LifecycleMove) => Promise<string | null | undefined> | void;
  /** A real content edit. Resolves to an error string, or null on success. */
  onSaveOffer?: (offerId: string, patch: ListingUpdate) => Promise<string | null | undefined> | void;
  /** The ids the VENDOR pinned to the front of this catalog. */
  featured?: string[];
  className?: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  offers = [],
  onAddOffer,
  onPublishOffer,
  onShareOffer,
  onOfferStatus,
  onSaveOffer,
  featured,
  className = ''
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ListingUpdate>({});
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const move = async (offerId: string, to: LifecycleMove) => {
    soundEngine.play('tap');
    if (!onOfferStatus) return;
    setBusy(true);
    const err = await onOfferStatus(offerId, to);
    setBusy(false);
    // A refusal stays on the card it belongs to — the server's words, not ours.
    setRowError((p) => (err ? { ...p, [offerId]: String(err) } : (() => { const n = { ...p }; delete n[offerId]; return n; })()));
  };

  const startEdit = (offer: Listing) => {
    soundEngine.play('tap');
    setDraft({
      title: offer.title,
      description: offer.description ?? '',
      price: offer.price,
      currency: offer.currency ?? 'KES',
      quantityAvailable: offer.quantityAvailable ?? null,
      locationName: (offer as { locationName?: string }).locationName ?? null
    });
    setEditingId(offer.id);
  };

  const saveEdit = async (offerId: string) => {
    if (!onSaveOffer) return;
    setBusy(true);
    const err = await onSaveOffer(offerId, draft);
    setBusy(false);
    if (err) {
      setRowError((p) => ({ ...p, [offerId]: String(err) }));
      return;
    }
    setEditingId(null);
    setRowError((p) => { const n = { ...p }; delete n[offerId]; return n; });
  };

  const handleCopyLink = (offer: Listing) => {
    soundEngine.play('tap');
    const shareUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/#offer/${offer.id}`
      : `https://brief.africa/offers/${offer.id}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
    }
    setCopiedId(offer.id);
    setTimeout(() => setCopiedId(null), 2500);
    onShareOffer?.(offer);
  };

  return (
    <section className={`space-y-4 max-w-2xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Tag className="w-4 h-4 text-[color:var(--color-primary)]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
            Catalog & Offers ({offers.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onAddOffer();
          }}
          className="px-3.5 py-1.5 rounded-full bg-[color:var(--color-text)] hover:bg-black text-[color:var(--color-primary)] font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Add Offer</span>
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="p-8 rounded-3xl bg-[color:var(--color-paper)] border border-black/5 text-center space-y-3 shadow-sm">
          <ShoppingBag className="w-8 h-8 text-[color:var(--color-text-muted)] mx-auto opacity-40" />
          <p className="text-xs font-bold text-[color:var(--color-text)]">No offers created yet</p>
          <p className="text-[11px] text-[color:var(--color-text-muted)] max-w-sm mx-auto">
            Add your goods or skills to publish them to your public catalog and generate WhatsApp share links.
          </p>
          <button
            type="button"
            onClick={onAddOffer}
            className="px-4 py-2 rounded-full bg-[color:var(--color-text)] text-[color:var(--color-primary)] text-xs font-bold shadow-xs cursor-pointer"
          >
            Create First Offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {offers.map((offer) => {
            // Status is read from the row the server returned — never from a
            // local optimistic flip, which is how a control ends up lying.
            const currentStat = offer.status;
            const isDraft = currentStat === 'draft';
            const isPaused = currentStat === 'paused';
            const isArchived = currentStat === 'archived';
            const pinned = (featured ?? []).includes(offer.id);
            const mediaUrl = (offer.media ?? [])[0]
              ? (/^https?:|^\/api\//.test((offer.media as string[])[0])
                  ? (offer.media as string[])[0]
                  : `/api/media/file/${(offer.media as string[])[0]}`)
              : ((offer as { image?: string | null }).image ?? null);
            // An action with nowhere to go is a lie with an icon, so lifecycle
            // moves are offered only when the host wired the real transition.
            const moves = onOfferStatus ? (NEXT_MOVES[currentStat] ?? []) : [];
            const price = (offer as any).priceKes ?? offer.price ?? 0;
            const stock = offer.quantityAvailable;

            return (
              <div
                key={offer.id}
                className={`rounded-3xl overflow-hidden bg-[color:var(--color-paper)] border shadow-2xs flex flex-col justify-between transition-all ${
                  isPaused ? 'opacity-60 bg-[color:var(--color-surface)]' : ''
                } ${pinned ? 'ring-2' : ''}`}
                style={{
                  borderColor: 'var(--brief-line)',
                  ...(pinned ? { boxShadow: '0 0 0 2px var(--color-primary)' } : {})
                }}
              >
                {/* The photo, when there is one. A real photo of the actual
                    goods, or no photo at all: never a stock image standing in
                    for a shop nobody has photographed. */}
                <div className="relative h-28 w-full" style={{ background: 'var(--color-well)' }}>
                  {mediaUrl ? (
                    <img src={mediaUrl} alt={offer.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#C4C7CE' }}>
                        no photo yet
                      </span>
                    </div>
                  )}
                  {pinned && (
                    <span
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                      style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                    >
                      Pinned
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-base shrink-0">🎂</span>
                      <span className="text-xs font-black text-[color:var(--color-text)] leading-tight truncate">
                        {offer.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      {/* Metadata offloaded to micro-badges: status + stock,
                          one line, token-based (bronze border per spec). */}
                      <MicroBadge tone={isPaused || isDraft || isArchived ? "warning" : "success"}>
                        {STATUS_LABEL[currentStat] ?? String(currentStat).toUpperCase()}
                      </MicroBadge>
                      <MicroBadge tone="neutral">
                        {stock == null ? "Stock not specified" : `${stock} in stock`}
                      </MicroBadge>
                    </div>
                  </div>

                  {offer.description && (
                    <p className="text-[11px] text-[color:var(--color-text-muted)] line-clamp-2">
                      {offer.description}
                    </p>
                  )}


                </div>

                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                  <span className="text-sm font-black text-[color:var(--color-text)]">
                    {offer.currency || 'KES'} {price.toLocaleString()}
                  </span>

                  <div className="flex items-center space-x-1.5">
                    {/* The consequential PRIMARY action stays inline. */}
                    {isDraft && onPublishOffer && (
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.play('reward');
                          onPublishOffer(offer.id);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[color:var(--color-text)] text-[color:var(--color-primary)] text-[10px] font-bold hover:bg-black transition-all cursor-pointer"
                      >
                        Publish
                      </button>
                    )}

                    {!isArchived && onSaveOffer && (
                      <button
                        type="button"
                        onClick={() => (editingId === offer.id ? setEditingId(null) : startEdit(offer))}
                        className="px-2.5 py-1 rounded-xl border border-black/10 text-[10px] font-bold text-[color:var(--color-text)] hover:bg-black/5 transition-all cursor-pointer"
                      >
                        {editingId === offer.id ? 'Close' : 'Edit'}
                      </button>
                    )}
                    {isArchived && (
                      <span className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                        Withdrawn — a new offer re-lists it
                      </span>
                    )}

                    {/* Secondary actions collapse behind a context menu. */}
                    <ContextMenu
                      ariaLabel={`Actions for ${offer.title}`}
                      actions={[
                        {
                          label: copiedId === offer.id ? "Link copied" : "Share link",
                          onSelect: () => handleCopyLink(offer)
                        },
                        ...moves.map((m) => ({
                          label: m.label,
                          tone: m.tone,
                          onSelect: () => void move(offer.id, m.to)
                        }))
                      ]}
                    />
                  </div>
                </div>

                {rowError[offer.id] && (
                  <p className="text-[10px] font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
                    {rowError[offer.id]}
                  </p>
                )}

                {editingId === offer.id && (
                  <div className="pt-3 border-t border-black/5 space-y-2">
                    <input
                      type="text"
                      aria-label="Offer title"
                      value={draft.title ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-xs border border-black/10 bg-[color:var(--color-paper)]"
                    />
                    <textarea
                      aria-label="Offer description"
                      rows={2}
                      value={draft.description ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-[11px] border border-black/10 bg-[color:var(--color-paper)] resize-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        aria-label="Offer price"
                        value={draft.price ?? 0}
                        onChange={(e) => setDraft((d) => ({ ...d, price: Number(e.target.value) }))}
                        className="w-28 px-3 py-2 rounded-xl text-xs font-mono border border-black/10 bg-[color:var(--color-paper)]"
                      />
                      <input
                        type="number"
                        min={0}
                        aria-label="Stock available"
                        placeholder="stock"
                        value={draft.quantityAvailable ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, quantityAvailable: e.target.value === '' ? null : Number(e.target.value) }))}
                        className="w-24 px-3 py-2 rounded-xl text-xs font-mono border border-black/10 bg-[color:var(--color-paper)]"
                      />
                      <input
                        type="text"
                        aria-label="Offer location"
                        placeholder="Place (optional)"
                        value={draft.locationName ?? ''}
                        onChange={(e) => setDraft((d) => ({ ...d, locationName: e.target.value }))}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs border border-black/10 bg-[color:var(--color-paper)]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit(offer.id)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-black cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                      >
                        {busy ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border border-black/10"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
                        Buyers see the new price on their next look
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CatalogView;
