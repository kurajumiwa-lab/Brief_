import React, { useState } from 'react';
import type { Listing } from '../../api/types';
import {
  Tag,
  Plus,
  Share2,
  CheckCircle2,
  ShoppingBag,
  ArrowUpRight,
  MessageCircle,
  Eye,
  Check,
  TrendingUp,
  Copy
} from 'lucide-react';
import { soundEngine } from '../../utils/SoundEngine';

export interface CatalogViewProps {
  offers: Listing[];
  onAddOffer: () => void;
  onPublishOffer?: (offerId: string) => void;
  onShareOffer?: (offer: Listing) => void;
  className?: string;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  offers = [],
  onAddOffer,
  onPublishOffer,
  onShareOffer,
  className = ''
}) => {
  const [offerStatuses, setOfferStatuses] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const togglePause = (offerId: string, currentStatus: string) => {
    soundEngine.play('tap');
    setOfferStatuses((prev) => ({
      ...prev,
      [offerId]: prev[offerId] === 'paused' || currentStatus === 'paused' ? 'active' : 'paused'
    }));
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
        <div className="p-8 rounded-3xl bg-white border border-black/5 text-center space-y-3 shadow-sm">
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
            const currentStat = offerStatuses[offer.id] || offer.status;
            const isDraft = currentStat === 'draft';
            const isPaused = currentStat === 'paused';
            const price = (offer as any).priceKes ?? offer.price ?? 0;
            const stock = offer.quantityAvailable;

            return (
              <div
                key={offer.id}
                className={`p-4 rounded-3xl bg-white border border-black/5 shadow-2xs flex flex-col justify-between space-y-3 transition-all ${
                  isPaused ? 'opacity-60 bg-[color:var(--color-surface)]' : ''
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="text-base shrink-0">🎂</span>
                      <span className="text-xs font-black text-[color:var(--color-text)] leading-tight truncate">
                        {offer.title}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          isDraft
                            ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-warning)]'
                            : isPaused
                            ? 'bg-zinc-200 text-zinc-700'
                            : 'bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)]'
                        }`}
                      >
                        {isPaused ? 'PAUSED' : isDraft ? 'DRAFT' : 'ACTIVE'}
                      </span>
                      <span className="text-[9px] font-mono text-[color:var(--color-text-muted)] bg-[color:var(--color-surface)] px-1.5 py-0.5 rounded-md">
                        {stock == null ? 'Stock not specified' : `${stock} in stock`}
                      </span>
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

                    <button
                      type="button"
                      onClick={() => togglePause(offer.id, offer.status)}
                      className="p-1.5 rounded-xl bg-[color:var(--color-surface)] hover:bg-black/5 text-[color:var(--color-text-muted)] text-[10px] font-bold transition-colors cursor-pointer"
                      title={isPaused ? 'Activate offer' : 'Pause offer'}
                    >
                      {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(offer)}
                      className="px-2.5 py-1 rounded-xl bg-[color:var(--color-primary-subtle)] hover:bg-[color:var(--color-primary-subtle)] text-[color:var(--color-text)] text-[10px] font-bold transition-colors cursor-pointer flex items-center space-x-1"
                      title="Copy PublicOfferModal link"
                    >
                      {copiedId === offer.id ? (
                        <>
                          <Check className="w-3 h-3 text-[color:var(--color-success)]" />
                          <span className="text-[color:var(--color-success)]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3 h-3 text-[color:var(--color-text)]" />
                          <span>Share Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default CatalogView;
