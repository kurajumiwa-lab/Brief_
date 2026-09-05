import React, { useState } from 'react';
import type { Listing } from '../../api/types';
import { Tag, Plus, Share2, CheckCircle2, ShoppingBag, ArrowUpRight } from 'lucide-react';
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
  return (
    <section className={`space-y-4 max-w-2xl mx-auto ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Tag className="w-4 h-4 text-[#5B2EA6]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-[#1A1F2E]">
            Catalog & Offers ({offers.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.play('heavyTap');
            onAddOffer();
          }}
          className="px-3.5 py-1.5 rounded-full bg-[#1A1F2E] hover:bg-black text-[#93EE34] font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Offer</span>
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-black/5 text-center space-y-2 shadow-sm">
          <ShoppingBag className="w-8 h-8 text-[#64748B] mx-auto opacity-40" />
          <p className="text-xs font-bold text-[#1A1F2E]">No offers created yet</p>
          <p className="text-[11px] text-[#64748B] max-w-sm mx-auto">
            Add your goods or skills to publish them to your catalog and share with customers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {offers.map((offer) => {
            const isDraft = offer.status === 'draft';
            const price = (offer as any).priceKes ?? offer.price ?? 0;

            return (
              <div
                key={offer.id}
                className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-black text-[#1A1F2E] leading-tight">
                      {offer.title}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                        isDraft
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#93EE34]/30 text-[#1A1F2E]'
                      }`}
                    >
                      {offer.status}
                    </span>
                  </div>

                  {offer.description && (
                    <p className="text-[11px] text-[#64748B] line-clamp-2">
                      {offer.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-black/5">
                  <span className="text-sm font-black text-[#1A1F2E]">
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
                        className="px-2.5 py-1 rounded-xl bg-[#1A1F2E] text-[#93EE34] text-[10px] font-bold hover:bg-black transition-all cursor-pointer"
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
                      className="p-1.5 rounded-xl bg-[#FAFAF8] hover:bg-black/5 text-[#64748B] transition-colors cursor-pointer"
                      title="Share offer link"
                    >
                      <Share2 className="w-3.5 h-3.5" />
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
