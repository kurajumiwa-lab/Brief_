import React from 'react';
import type { Listing, Vendor } from '../../api/types';
import { ListingCard } from './ListingCard';

/**
 * A seller's public presence. Deliberately transactional, not social.
 *
 * TRUST IS EVIDENCE, NEVER A SCORE. This renders two lists:
 *
 *   - verification evidence: checks that actually passed
 *   - facts: things that actually happened, counted from real rows
 *
 * There is no rating, no star row, no review section, no follower count and
 * no "97% positive". A buyer can read "4 fulfilled orders" and argue with it;
 * nobody can argue with 4.7 stars. That is the whole point.
 *
 * A brand-new seller shows no evidence at all rather than a zero or a default
 * rating -- absence is the honest state, and dressing it up as "0.0" invites
 * the reader to treat an unknown as a bad one.
 */

export interface VendorProfileProps {
  vendor: Vendor;
  listings: Listing[];
  onBack: () => void;
  onOpenListing: (id: string) => void;
}

export function VendorProfile({ vendor, listings, onBack, onOpenListing }: VendorProfileProps) {
  const evidence = vendor.verification?.evidence ?? [];
  const facts = vendor.verification?.facts ?? [];

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[10px] font-extrabold text-[#251045] cursor-pointer">
        Back to marketplace
      </button>

      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-extrabold text-[#251045]">{vendor.displayName}</h3>
          {vendor.status !== 'active' && (
            <span className="shrink-0 text-[9px] px-2 py-0.5 rounded-full bg-[#D6CFE4] text-[#251045]">
              {vendor.status}
            </span>
          )}
        </div>

        {vendor.description && (
          <p className="text-xs text-[#251045]/60 whitespace-pre-wrap">{vendor.description}</p>
        )}

        {vendor.contactMethod && (
          <p className="text-[10px] text-[#251045]/40">Contact: {vendor.contactMethod}</p>
        )}
      </div>

      {/* Verification. Shown only when something was genuinely checked. */}
      <div className="bg-[#FBFAFD] border border-[#D6CFE4] rounded-2xl p-4 space-y-2">
        <h4 className="text-[11px] font-extrabold text-[#251045]/40">
          Verification
        </h4>
        {evidence.length === 0 ? (
          <p className="text-xs text-[#251045]/60">
            Nothing has been verified for this seller yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {evidence.map((e) => (
              <li key={e.kind} className="text-xs text-[#251045]">
                {e.label}
              </li>
            ))}
          </ul>
        )}

        {facts.length > 0 && (
          <ul className="space-y-1 pt-1">
            {facts.map((f) => (
              <li key={f.kind} className="text-[10px] text-[#251045]/60">
                {f.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] font-extrabold text-[#251045]/40">
          Listings
        </h4>
        {listings.length === 0 ? (
          <p className="text-xs text-[#251045]/60">This seller has nothing listed right now.</p>
        ) : (
          listings.map((l) => <ListingCard key={l.id} listing={l} onOpen={onOpenListing} />)
        )}
      </div>
    </div>
  );
}
