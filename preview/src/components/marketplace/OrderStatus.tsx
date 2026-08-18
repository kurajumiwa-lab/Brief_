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
  ordered: 'bg-[#1A2A3A] text-[#7FB2E5]',
  fulfilled: 'bg-[#172D20] text-[#8DCF74]',
  settled: 'bg-[#172D20] text-[#00FF42]',
  disputed: 'bg-[#3A1A1A] text-[#E57F7F]',
  cancelled: 'bg-[#1E1E1E] text-[#A9BDA0]',
  offered: 'bg-[#1E1E1E] text-[#A9BDA0]'
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
    <div className="bg-[#102117] border border-[#1E3A2A] rounded-2xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#E2ECE5]">{order.listingTitle}</p>
          <p className="text-[10px] text-[#5C6B52]">
            {order.quantity} x {money(order.unitPrice, order.currency)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${
            STATUS_STYLE[order.status] ?? 'bg-[#1E1E1E] text-[#A9BDA0]'
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* The server's total, not a recomputation. */}
      <p className="text-sm font-extrabold text-[#00FF42]">
        {money(order.total, order.currency)}
      </p>

      {/* Payment stated as its own fact, always. Never inferred from status. */}
      <p className="text-[10px] text-[#5C6B52]">
        {order.paid
          ? 'Paid - settled transaction on record'
          : 'Not paid yet - no settled payment is on record for this order'}
      </p>

      {order.dispute && (
        <div className="bg-[#1A1010] border border-[#3A1A1A] rounded-xl p-2">
          <p className="text-[10px] font-extrabold text-[#E57F7F]">Disputed</p>
          <p className="text-[10px] text-[#A9BDA0]">{order.dispute.reason}</p>
        </div>
      )}

      {(canFulfil || canDispute || canCancel) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {canFulfil && onFulfil && (
            <button
              onClick={() => onFulfil(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#00FF42] text-[#09150E] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Mark fulfilled
            </button>
          )}
          {canDispute && onDispute && (
            <button
              onClick={() => onDispute(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#2A1515] text-[#E57F7F] border border-[#3A1A1A] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Report a problem
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#172D20] text-[#8DCF74] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
