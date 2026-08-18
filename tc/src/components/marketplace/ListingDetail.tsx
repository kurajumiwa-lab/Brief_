import React from 'react';
import type { Listing } from '../../api/types';
import { money } from './ListingCard';

/**
 * A single listing, with the order action.
 *
 * THE TOTAL SHOWN HERE IS A PREVIEW, NOT AN AUTHORITY. It is computed for
 * display so the buyer knows roughly what they are committing to, but the
 * server recomputes it from the listing row when the order is placed and the
 * order carries the server's number. If the two ever disagreed, the server
 * would win -- which is why the order confirmation shows the server total
 * rather than echoing this one back.
 */

export interface ListingDetailProps {
  listing: Listing;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onOrder: () => void;
  onBack: () => void;
  onViewVendor: (vendorId: string) => void;
  busy: boolean;
  notice: string | null;
}

export function ListingDetail({
  listing,
  quantity,
  onQuantityChange,
  onOrder,
  onBack,
  onViewVendor,
  busy,
  notice
}: ListingDetailProps) {
  // Stock-tracked listings cap the selector at what actually exists; a
  // service has no cap because there is nothing to run out of.
  const max = listing.quantityAvailable ?? 99;
  const previewTotal = listing.price * quantity;

  return (
    <div className="space-y-3">
      <button
        onClick={onBack}
        className="text-[10px] font-extrabold text-[#8DCF74] cursor-pointer"
      >
        Back to marketplace
      </button>

      <div className="bg-[#102117] border border-[#1E3A2A] rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-extrabold text-[#E2ECE5]">{listing.title}</h3>
        <p className="text-lg font-extrabold text-[#00FF42]">
          {money(listing.price, listing.currency)}
        </p>

        {listing.description && (
          <p className="text-xs text-[#A9BDA0] whitespace-pre-wrap">{listing.description}</p>
        )}

        {listing.locationName && (
          <p className="text-[10px] text-[#5C6B52]">Location: {listing.locationName}</p>
        )}

        {listing.quantityAvailable !== null && (
          <p className="text-[10px] text-[#5C6B52]">
            {listing.quantityAvailable > 0
              ? `${listing.quantityAvailable} available`
              : 'None available'}
          </p>
        )}

        {listing.vendor && (
          <button
            onClick={() => onViewVendor(listing.vendor!.id)}
            className="text-[10px] font-extrabold text-[#8DCF74] cursor-pointer"
          >
            Sold by {listing.vendor.displayName}
          </button>
        )}
      </div>

      {listing.orderable ? (
        <div className="bg-[#102117] border border-[#1E3A2A] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5C6B52]">
              Quantity
            </span>
            <button
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              className="w-7 h-7 rounded-full bg-[#172D20] text-[#8DCF74] font-extrabold cursor-pointer"
            >
              -
            </button>
            <span className="text-xs font-extrabold text-[#E2ECE5] w-6 text-center">{quantity}</span>
            <button
              onClick={() => onQuantityChange(Math.min(max, quantity + 1))}
              className="w-7 h-7 rounded-full bg-[#172D20] text-[#8DCF74] font-extrabold cursor-pointer"
            >
              +
            </button>
          </div>

          <p className="text-[10px] text-[#5C6B52]">
            Estimated total {money(previewTotal, listing.currency)} - confirmed by the server when
            you order
          </p>

          <button
            onClick={onOrder}
            disabled={busy}
            className="w-full py-2 rounded-full bg-[#00FF42] text-[#09150E] text-xs font-extrabold cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Placing order...' : 'Place order'}
          </button>

          <p className="text-[10px] text-[#5C6B52]">
            Placing an order does not pay for it. You arrange payment with the seller directly.
          </p>
        </div>
      ) : (
        <div className="bg-[#102117] border border-[#1E3A2A] rounded-2xl p-4">
          <p className="text-xs text-[#C9A227]">
            {listing.unorderableReason ?? 'This listing is not available.'}
          </p>
        </div>
      )}

      {notice && <p className="text-[10px] text-[#C9A227]">{notice}</p>}
    </div>
  );
}
