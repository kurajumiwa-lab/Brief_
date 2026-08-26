import React from 'react';
import type { Listing } from '../../api/types';

/**
 * One listing in a browse grid.
 *
 * Shows only what the server actually returned. A listing with no location or
 * no stock figure simply omits that line rather than printing "Location: --",
 * which reads as a missing value the seller forgot to fill in.
 *
 * There is no rating, no review count and no "popular" badge: none of those
 * exist in the data, and inventing social proof is the fastest way to make a
 * marketplace dishonest.
 */

const TYPE_LABEL: Record<string, string> = {
  product: 'Product',
  service: 'Service',
  experience: 'Experience',
  event: 'Event'
};

export function money(amount: number, currency: string) {
  // Whole shillings: Brief prices are not fractional, and a trailing ".00"
  // reads like a system that expects cents it never has.
  return `${currency} ${amount.toLocaleString('en-KE', { maximumFractionDigits: 2 })}`;
}

export interface ListingCardProps {
  listing: Listing;
  onOpen: (id: string) => void;
}

export function ListingCard({ listing, onOpen }: ListingCardProps) {
  return (
    <button
      onClick={() => onOpen(listing.id)}
      className="w-full text-left bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-3 space-y-1.5 cursor-pointer hover:border-[#E5E7EB] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-extrabold text-[#111111] min-w-0">{listing.title}</p>
        <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#E5E7EB] text-[#111111]/60">
          {TYPE_LABEL[listing.type] ?? listing.type}
        </span>
      </div>

      <p className="text-sm font-extrabold text-[#111111]">
        {money(listing.price, listing.currency)}
      </p>

      {listing.vendor && (
        <p className="text-[10px] text-[#111111]/60">{listing.vendor.displayName}</p>
      )}

      {/* Optional by design: a mobile service has no single location. */}
      {listing.locationName && (
        <p className="text-[10px] text-[#111111]/40">{listing.locationName}</p>
      )}

      {/* Stock only when it is genuinely tracked. null means "not tracked",
          which is different from zero and must not render as "0 left". */}
      {listing.quantityAvailable !== null && listing.quantityAvailable > 0 && (
        <p className="text-[10px] text-[#111111]/40">{listing.quantityAvailable} available</p>
      )}

      {!listing.orderable && listing.unorderableReason && (
        <p className="text-[10px] text-[#111111]">{listing.unorderableReason}</p>
      )}
    </button>
  );
}
