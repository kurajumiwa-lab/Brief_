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
  ordered: 'bg-[#10141C] text-[#4FB0C6]',
  fulfilled: 'bg-[#10141C] text-[#43D17A]',
  settled: 'bg-[#10141C] text-[#43D17A]',
  disputed: 'bg-[#10141C] text-[#FF6A4D]',
  cancelled: 'bg-[#232A38] text-[#8A93A6]',
  offered: 'bg-[#232A38] text-[#8A93A6]'
};

export interface OrderStatusProps {
  order: Order;
  /** 'buyer' shows buyer actions, 'vendor' shows seller actions. */
  perspective: 'buyer' | 'vendor';
  busy: boolean;
  onFulfil?: (id: string) => void;
  onDispute?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function OrderStatus({
  order,
  perspective,
  busy,
  onFulfil,
  onDispute,
  onCancel
}: OrderStatusProps) {
  const canFulfil = perspective === 'vendor' && order.status === 'ordered';
  const canDispute =
    perspective === 'buyer' && ['ordered', 'fulfilled', 'settled'].includes(order.status);
  const canCancel = order.status === 'ordered';

  return (
    <div className="bg-[#10141C] border border-[#232A38] rounded-2xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#F3F1E7]">{order.listingTitle}</p>
          <p className="text-[10px] text-[#4B5162]">
            {order.quantity} x {money(order.unitPrice, order.currency)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full ${
            STATUS_STYLE[order.status] ?? 'bg-[#232A38] text-[#8A93A6]'
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* The server's total, not a recomputation. */}
      <p className="text-sm font-extrabold text-[#43D17A]">
        {money(order.total, order.currency)}
      </p>

      {/* Payment stated as its own fact, always. Never inferred from status. */}
      <p className="text-[10px] text-[#4B5162]">
        {order.paid
          ? 'Paid - settled transaction on record'
          : 'Not paid yet - no settled payment is on record for this order'}
      </p>

      {order.dispute && (
        <div className="bg-[#10141C] border border-[#10141C] rounded-xl p-2">
          <p className="text-[10px] font-extrabold text-[#FF6A4D]">Disputed</p>
          <p className="text-[10px] text-[#8A93A6]">{order.dispute.reason}</p>
        </div>
      )}

      {(canFulfil || canDispute || canCancel) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {canFulfil && onFulfil && (
            <button
              onClick={() => onFulfil(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#43D17A] text-[#090B10] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Mark fulfilled
            </button>
          )}
          {canDispute && onDispute && (
            <button
              onClick={() => onDispute(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#10141C] text-[#FF6A4D] border border-[#10141C] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Report a problem
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#10141C] text-[#43D17A] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
