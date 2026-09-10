import React from 'react';
import { Plus, Tag, Share2, Check, ExternalLink, Sparkles } from 'lucide-react';
import type { Listing } from '../../api/types';
import { soundEngine } from '../../utils/SoundEngine';

export interface SpaceOffersProps {
  offers: Listing[];
  onAddOffer?: () => void;
  onPublishOffer?: (offerId: string) => void;
  onSelectOffer?: (offer: Listing) => void;
  onShareOffer?: (offer: Listing) => void;
  className?: string;
}

export const SpaceOffers: React.FC<SpaceOffersProps> = ({
  offers = [],
  onAddOffer,
  onPublishOffer,
  onSelectOffer,
  onShareOffer,
  className = ''
}) => {
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Tag className="w-4 h-4 text-[color:var(--color-primary)]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[color:var(--color-text)]">
            Offers ({offers.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onAddOffer?.();
          }}
          className="text-xs font-bold text-[color:var(--color-primary)] hover:underline cursor-pointer flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Offer</span>
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white border border-dashed border-gray-300 text-center space-y-2">
          <p className="text-xs text-[color:var(--color-text-muted)]">
            No offers added to this space yet.
          </p>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onAddOffer?.();
            }}
            className="px-4 py-2 rounded-full bg-[color:var(--color-primary)] text-[color:var(--accent-ink)] font-bold text-xs shadow-sm hover:bg-[color:var(--color-primary-strong)] transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[color:var(--color-primary)]" />
            <span>Add your first offer</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {offers.map((offer) => {
            const isPublished = offer.status === 'active';
            return (
              <div
                key={offer.id}
                className="p-4 rounded-2xl bg-white border border-black/5 shadow-2xs hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-black text-[color:var(--color-text)] truncate">
                      {offer.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full ${
                        isPublished
                          ? 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-success)] border border-[color:var(--color-border)]'
                          : 'bg-[color:var(--color-surface-elevated)] text-[color:var(--color-warning)] border border-[color:var(--color-border)]'
                      }`}
                    >
                      {offer.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[color:var(--color-text-muted)]">
                    <span className="font-bold text-[color:var(--color-text)]">
                      {offer.currency || 'KES'} {(offer.price || 0).toLocaleString()}
                    </span>
                    {offer.description && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-xs">{offer.description}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end pt-1 sm:pt-0">
                  {!isPublished && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.play('heavyTap');
                        onPublishOffer?.(offer.id);
                      }}
                      className="px-3.5 py-1.5 rounded-full bg-[color:var(--color-primary)] hover:bg-[color:var(--color-primary-strong)] text-[color:var(--color-text)] font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-2xs"
                    >
                      Publish
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.play('tap');
                      onShareOffer?.(offer);
                    }}
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-[color:var(--color-text)] transition-all cursor-pointer"
                    title="Share public link"
                    aria-label="Share public link"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SpaceOffers;
