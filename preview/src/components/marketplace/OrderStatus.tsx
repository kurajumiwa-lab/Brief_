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
  ordered: 'bg-[#252C31] text-[#8FAFC4]',
  fulfilled: 'bg-[#1C1C1F] text-[#00E676]',
  settled: 'bg-[#1C1C1F] text-[#00E676]',
  disputed: 'bg-[#382A22] text-[#CE8578]',
  cancelled: 'bg-[#1E1E1E] text-[#A1A1A6]',
  offered: 'bg-[#1E1E1E] text-[#A1A1A6]'
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
    <div className="bg-[#1C1C1F] border border-[#1E1E22] rounded-2xl p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[#FFFFFF]">{order.listingTitle}</p>
          <p className="text-[10px] text-[#48484A]">
            {order.quantity} x {money(order.unitPrice, order.currency)}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] px-2 py-0.5 rounded-full ${
            STATUS_STYLE[order.status] ?? 'bg-[#1E1E1E] text-[#A1A1A6]'
          }`}
        >
          {STATUS_LABEL[order.status] ?? order.status}
        </span>
      </div>

      {/* The server's total, not a recomputation. */}
      <p className="text-sm font-extrabold text-[#00E676]">
        {money(order.total, order.currency)}
      </p>

      {/* Payment stated as its own fact, always. Never inferred from status. */}
      <p className="text-[10px] text-[#48484A]">
        {order.paid
          ? 'Paid - settled transaction on record'
          : 'Not paid yet - no settled payment is on record for this order'}
      </p>

      {order.dispute && (
        <div className="bg-[#2A2018] border border-[#382A22] rounded-xl p-2">
          <p className="text-[10px] font-extrabold text-[#CE8578]">Disputed</p>
          <p className="text-[10px] text-[#A1A1A6]">{order.dispute.reason}</p>
        </div>
      )}

      {(canFulfil || canDispute || canCancel) && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {canFulfil && onFulfil && (
            <button
              onClick={() => onFulfil(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#00E676] text-[#0A0A0B] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Mark fulfilled
            </button>
          )}
          {canDispute && onDispute && (
            <button
              onClick={() => onDispute(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#2E241E] text-[#CE8578] border border-[#382A22] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Report a problem
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(order.id)}
              disabled={busy}
              className="px-3 py-1 rounded-full bg-[#1C1C1F] text-[#00E676] text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
