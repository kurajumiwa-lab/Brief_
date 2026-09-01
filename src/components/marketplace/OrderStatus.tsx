import React from 'react';
import type { Order } from '../../api/types';
import { money } from './ListingCard';

/**
 * One order, from either side of the transaction.
 *
 * PAYMENT AND FULFILMENT ARE SHOWN AS TWO SEPARATE FACTS, because they are
 * two separate facts. An order can be delivered and unpaid, or paid and
 * undelivered. Collapsing them into one "complete" badge is how a marketplace
 * ends up claiming money arrived when it did not.
 *
 * `paid` is derived server-side from a settled ledger row. This component
 * never infers payment from a status: an order reading 'fulfilled' says
 * nothing at all about money.
 */

const STATUS_LABEL: Record<string, string> = {
  offered: 'Offered',
  ordered: 'Ordered',
  fulfilled: 'Fulfilled',
  settled: 'Settled',
  disputed: 'Disputed',
  cancelled: 'Cancelled'
};

const STATUS_STYLE: Record<string, string> = {
  ordered: 'bg-[#12151A] text-[#F7F7F8]',
  fulfilled: 'bg-[#12151A] text-[#F7F7F8]',
  settled: 'bg-[#12151A] text-[#F7F7F8]',
  disputed: 'bg-[#12151A] text-[#F7F7F8]',
  cancelled: 'bg-[#222630] text-[#F7F7F8]/60',
  offered: 'bg-[#222630] text-[#F7F7F8]/60'
};

export interface OrderStatusProps {
  order: Order;
  /** 'buyer' shows buyer actions, 'vendor' shows seller actions. */
  perspective: 'buyer' | 'vendor';
  busy: boolean;
  onFulfil?: (id: string) => void;
  onDispute?: (id: string) => void;
  onCancel?: (id: string) => void;
  /** Vendor-only: settle a fulfilled order against the real ledger. */
  onSettle?: (id: string) => void;
}

export function OrderStatus({
  order,
  perspective,
  busy,
  onFulfil,
  onDispute,
  onCancel,
  onSettle
}: OrderStatusProps) {
  const canFulfil = perspective === 'vendor' && order.status === 'ordered';
  const canSettle = perspective === 'vendor' && order.status === 'fulfilled';
  const canDispute =
    perspective === 'buyer' && ['ordered', 'fulfilled', 'settled'].includes(order.status);
  const canCancel = order.status === 'ordered';

  return (
    <div className="bg-[#12151A] border border-[#222630] rounded-2xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#F7F7F8]">{order.listingTitle}</p>
          <p className="text-[10px] text-[#F7F7F8]/40">
            {order.quantity} x {money(order.unitPrice, order.currency)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full ${
            STATUS_STYLE[order.status] ?? 'bg-[#222630] text-[#F7F7F8]/60'
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* The server's total, not a recomputation. */}
      <p className="text-sm font-extrabold text-[#F7F7F8]">
        {money(order.total, order.currency)}
      </p>

      {/* Payment stated as its own fact, always. Never inferred from status. */}
      <p className="text-[10px] text-[#F7F7F8]/40">
        {order.paid
          ? 'Paid - settled transaction on record'
          : 'Not paid yet - no settled payment is on record for this order'}
      </p>

      {order.dispute && (
        <div className="bg-[#12151A] border border-[#222630] rounded-xl p-2">
          <p className="text-[10px] font-extrabold text-[#F7F7F8]">Disputed</p>
          <p className="text-[10px] text-[#F7F7F8]/60">{order.dispute.reason}</p>
        </div>
      )}

      {(canFulfil || canDispute || canCancel || canSettle) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {canSettle && onSettle && (
            <button
              onClick={() => onSettle(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#FF5A1F] text-[#0D0F12] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Settle
            </button>
          )}
          {canFulfil && onFulfil && (
            <button
              onClick={() => onFulfil(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#FF5A1F] text-[#0D0F12] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Mark fulfilled
            </button>
          )}
          {canDispute && onDispute && (
            <button
              onClick={() => onDispute(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#12151A] text-[#F7F7F8] border border-[#222630] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Report a problem
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#12151A] text-[#F7F7F8] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
