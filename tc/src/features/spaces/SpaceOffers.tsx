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
          <Tag className="w-4 h-4 text-[#5B2EA6]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Offers ({offers.length})
          </h3>
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.play('tap');
            onAddOffer?.();
          }}
          className="text-xs font-bold text-[#5B2EA6] hover:underline cursor-pointer flex items-center space-x-1"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Offer</span>
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="p-6 rounded-2xl bg-white border border-dashed border-gray-300 text-center space-y-2">
          <p className="text-xs text-[#64748B]">
            No offers added to this space yet.
          </p>
          <button
            type="button"
            onClick={() => {
              soundEngine.play('heavyTap');
              onAddOffer?.();
            }}
            className="px-4 py-2 rounded-full bg-[#5B2EA6] text-white font-bold text-xs shadow-sm hover:bg-[#4A238A] transition-all cursor-pointer inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-[#93EE34]" />
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
                    <span className="text-sm font-black text-[#1A1F2E] truncate">
                      {offer.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full ${
                        isPublished
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {offer.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs text-[#64748B]">
                    <span className="font-bold text-[#1A1F2E]">
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
                      className="px-3.5 py-1.5 rounded-full bg-[#93EE34] hover:bg-[#82D62C] text-[#0C221F] font-black text-xs transition-transform active:scale-95 cursor-pointer shadow-2xs"
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
                    className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-[#1A1F2E] transition-all cursor-pointer"
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
