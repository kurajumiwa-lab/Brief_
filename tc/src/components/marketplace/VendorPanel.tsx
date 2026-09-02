import React from 'react';
import { BoostSheet } from '../BoostSheet';
import type { Listing, Order, Vendor, VendorEarnings } from '../../api/types';
import { money } from './ListingCard';
import { OrderStatus } from './OrderStatus';

/**
 * The seller's side: become a vendor, manage listings, see incoming orders.
 *
 * Deliberately not a dashboard. There are no charts, no revenue headline and
 * no "this week" comparison, because none of those numbers exist honestly --
 * no payment provider is connected, so any revenue figure would be invented.
 * What a seller gets is the list of what they are offering and the list of
 * what people have ordered.
 *
 * Lifecycle actions are offered only where the server would allow them. That
 * is a convenience: the server enforces the transition table regardless.
 */

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-[#E5E8EC] text-[#0D1117]/60',
  active: 'bg-[#FFFFFF] text-[#0D1117]',
  paused: 'bg-[#FFFFFF] text-[#0D1117]',
  sold_out: 'bg-[#FFFFFF] text-[#0D1117]',
  archived: 'bg-[#E5E8EC] text-[#0D1117]/60'
};

// Which moves the UI offers from each state. Mirrors the server's table; the
// server is still the thing that decides.
const NEXT_ACTIONS: Record<string, { status: Listing['status']; label: string }[]> = {
  draft: [{ status: 'active', label: 'Publish' }, { status: 'archived', label: 'Archive' }],
  active: [{ status: 'paused', label: 'Pause' }, { status: 'archived', label: 'Archive' }],
  paused: [{ status: 'active', label: 'Resume' }, { status: 'archived', label: 'Archive' }],
  sold_out: [{ status: 'active', label: 'Relist' }, { status: 'archived', label: 'Archive' }],
  archived: []
};

export interface VendorPanelProps {
  vendor: Vendor | null;
  listings: Listing[];
  orders: Order[];
  /** Derived from settled orders. null when nothing has settled. */
  earnings?: VendorEarnings | null;
  busyId: string | null;
  notice: string | null;
  draft: { displayName: string; description: string; contactMethod: string };
  onDraftChange: (patch: Partial<VendorPanelProps['draft']>) => void;
  onCreateVendor: () => void;
  listingDraft: { title: string; description: string; price: string; type: Listing['type']; quantity: string; location: string };
  onListingDraftChange: (patch: Partial<VendorPanelProps['listingDraft']>) => void;
  onCreateListing: () => void;
  onSetStatus: (id: string, status: Listing['status']) => void;
  onFulfil: (id: string) => void;
  /** Settle a fulfilled order. Refused server-side until money has really settled. */
  onSettle: (id: string) => void;
}

export function VendorPanel({
  vendor,
  listings,
  orders,
  earnings,
  busyId,
  notice,
  draft,
  onDraftChange,
  onCreateVendor,
  listingDraft,
  onListingDraftChange,
  onCreateListing,
  onSetStatus,
  onFulfil,
  onSettle
}: VendorPanelProps) {
  const [promoteFor, setPromoteFor] = React.useState<Listing | null>(null);
  // --- not a seller yet ----------------------------------------------------
  if (!vendor) {
    return (
      <div className="space-y-3">
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-3">
          <h4 className="text-[11px] font-extrabold text-[#0D1117]/60">
            Start selling
          </h4>
          <p className="text-xs text-[#0D1117]/60">
            A seller profile lets you list products, services and experiences.
          </p>
          <input
            value={draft.displayName}
            onChange={(e) => onDraftChange({ displayName: e.target.value })}
            placeholder="Business or trading name"
            className="w-full bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
          <input
            value={draft.description}
            onChange={(e) => onDraftChange({ description: e.target.value })}
            placeholder="What do you offer?"
            className="w-full bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
          <input
            value={draft.contactMethod}
            onChange={(e) => onDraftChange({ contactMethod: e.target.value })}
            placeholder="How should buyers reach you?"
            className="w-full bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
          <button
            onClick={onCreateVendor}
            disabled={busyId === 'vendor'}
            className="w-full py-2 rounded-full bg-[#FF5A1F] text-[#0D1117] text-xs font-extrabold cursor-pointer disabled:opacity-50"
          >
            Create seller profile
          </button>
          {notice && <p className="text-[10px] text-[#0D1117]">{notice}</p>}
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === 'ordered');

  return (
    <div className="space-y-4">
      <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-1">
        <h4 className="text-sm font-extrabold text-[#0D1117]">{vendor.displayName}</h4>
        {vendor.description && <p className="text-xs text-[#0D1117]/60">{vendor.description}</p>}
        {vendor.verification.facts.map((f) => (
          <p key={f.kind} className="text-[10px] text-[#0D1117]/60">
            {f.label}
          </p>
        ))}
      </div>

      {/* --- earnings -------------------------------------------------------
          Shown ONLY when money has genuinely settled. A seller with no
          settled orders sees nothing here rather than "KES 0", which reads
          like a balance they could withdraw. */}
      {earnings && earnings.orderCount > 0 && (
        <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-1">
          <h4 className="text-[11px] font-extrabold text-[#0D1117]/60">
            Settled earnings
          </h4>
          <p className="text-lg font-extrabold text-[#0D1117]">
            {money(earnings.net, earnings.currency)}
          </p>
          <p className="text-[10px] text-[#0D1117]/60">
            From {earnings.orderCount} settled order{earnings.orderCount === 1 ? '' : 's'} -{' '}
            {money(earnings.gross, earnings.currency)} less {money(earnings.commission, earnings.currency)}{' '}
            platform commission
          </p>
          {/* The distinction that matters: earned is not withdrawable. */}
          {!earnings.payoutAvailable && (
            <p className="text-[10px] text-[#0D1117]">{earnings.payoutReason}</p>
          )}
        </div>
      )}

      {/* --- new listing ---------------------------------------------------- */}
      <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-4 space-y-2">
        <h4 className="text-[11px] font-extrabold text-[#0D1117]/60">
          New listing
        </h4>
        <input
          value={listingDraft.title}
          onChange={(e) => onListingDraftChange({ title: e.target.value })}
          placeholder="What are you offering?"
          className="w-full bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
        />
        <input
          value={listingDraft.description}
          onChange={(e) => onListingDraftChange({ description: e.target.value })}
          placeholder="Description"
          className="w-full bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
        />
        <div className="flex gap-2">
          <input
            value={listingDraft.price}
            onChange={(e) => onListingDraftChange({ price: e.target.value })}
            placeholder="Price"
            inputMode="numeric"
            className="flex-1 bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
          <select
            value={listingDraft.type}
            onChange={(e) => onListingDraftChange({ type: e.target.value as Listing['type'] })}
            className="bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          >
            <option value="product">Product</option>
            <option value="service">Service</option>
            <option value="experience">Experience</option>
            <option value="event">Event</option>
          </select>
        </div>
        <div className="flex gap-2">
          <input
            value={listingDraft.quantity}
            onChange={(e) => onListingDraftChange({ quantity: e.target.value })}
            placeholder="Quantity (blank for services)"
            inputMode="numeric"
            className="flex-1 bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
          <input
            value={listingDraft.location}
            onChange={(e) => onListingDraftChange({ location: e.target.value })}
            placeholder="Location (optional)"
            className="flex-1 bg-[#F0F2F5] border border-[#E5E8EC] rounded-xl px-3 py-2 text-xs text-[#0D1117] outline-none"
          />
        </div>
        <button
          onClick={onCreateListing}
          disabled={busyId === 'listing'}
          className="w-full py-2 rounded-full bg-[#FF5A1F] text-[#0D1117] text-xs font-extrabold cursor-pointer disabled:opacity-50"
        >
          Create listing
        </button>
        <p className="text-[10px] text-[#0D1117]/60">
          New listings start as a draft. Publish when you are ready to take orders.
        </p>
        {notice && <p className="text-[10px] text-[#0D1117]">{notice}</p>}
      </div>

      {/* --- my listings ----------------------------------------------------- */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-extrabold text-[#0D1117]/60">
          My listings
        </h4>
        {listings.length === 0 ? (
          <p className="text-xs text-[#0D1117]/60">You have not listed anything yet.</p>
        ) : (
          listings.map((l) => (
            <div key={l.id} className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-2xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[#0D1117]">{l.title}</p>
                  <p className="text-[10px] text-[#0D1117]/60">
                    {money(l.price, l.currency)}
                    {l.quantityAvailable !== null ? ` - ${l.quantityAvailable} left` : ''}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full ${
                    STATUS_STYLE[l.status] ?? 'bg-[#E5E8EC] text-[#0D1117]/60'
                  }`}
                >
                  {l.status}
                </span>
              </div>
              {(NEXT_ACTIONS[l.status] ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {l.status === 'active' && (
                <button
                  type="button"
                  onClick={() => setPromoteFor(l)}
                  className="mr-1.5 cursor-pointer rounded-full border border-[#FF5A1F] px-3 py-1 text-[10px] font-extrabold text-[#FF5A1F] hover:bg-[#F0F2F5]"
                >
                  Promote
                </button>
              )}
              {(NEXT_ACTIONS[l.status] ?? []).map((a) => (
                    <button
                      key={a.status}
                      onClick={() => onSetStatus(l.id, a.status)}
                      disabled={busyId === l.id}
                      className="px-3 py-1 rounded-full bg-[#FFFFFF] text-[#0D1117] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* --- orders received -------------------------------------------------- */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-extrabold text-[#0D1117]/60">
          Orders received{pendingOrders.length > 0 ? ` (${pendingOrders.length} to fulfil)` : ''}
        </h4>
        {orders.length === 0 ? (
          <p className="text-xs text-[#0D1117]/60">No one has ordered from you yet.</p>
        ) : (
          orders.map((o) => (
            <OrderStatus
              key={o.id}
              order={o}
              perspective="vendor"
              busy={busyId === o.id}
              onFulfil={onFulfil}
              onSettle={o.status === 'fulfilled' ? onSettle : undefined}
            />
          ))
        )}
      </div>

      {promoteFor && (
        <BoostSheet
          listingId={promoteFor.id}
          listingTitle={promoteFor.title}
          onClose={() => setPromoteFor(null)}
        />
      )}
    </div>
  );
}
