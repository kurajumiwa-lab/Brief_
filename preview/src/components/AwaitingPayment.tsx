// ---------------------------------------------------------------------------
// AWAITING PAYMENT
//
// The creator-attention layer for paid campaigns.
//
// A paid registration opens as `started`: the spot is HELD but no money has
// arrived. Until this surface existed, that fact was visible only as a raw
// status string, so a creator could not tell who still owed them money.
//
// HONESTY RULES BAKED IN:
//   - A held spot is never described as a registration, a sale or revenue.
//   - Confirming payment does NOT write a status from the client. It calls the
//     server, which creates a real transaction, settles it, and promotes the
//     registration. If that call fails, nothing in the UI moves.
//   - No amount is sent. The server charges the campaign price.
// ---------------------------------------------------------------------------

import React from 'react';
import type { Registration } from '../api/types';

export interface AwaitingPaymentProps {
  registrations: Registration[];
  currency: string;
  price: number;
  busy: boolean;
  /** Calls the server confirm-payment route. Never mutates local state alone. */
  onConfirmPayment: (registrationId: string) => void;
}

/** Held spots on a paid campaign: registered intent, money not yet arrived. */
export function heldRegistrations(registrations: Registration[]): Registration[] {
  return registrations.filter((r) => r.status === 'started');
}

export function AwaitingPayment({
  registrations,
  currency,
  price,
  busy,
  onConfirmPayment
}: AwaitingPaymentProps) {
  const held = heldRegistrations(registrations);

  // If there's nothing there, show nothing. No empty-state theatre.
  if (held.length === 0) return null;

  return (
    <div className="bg-[#FFFFFF] border border-[#E5E8EC] rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold text-[#0D1117]">
          {held.length} awaiting payment
        </p>
        <p className="text-[9px] text-[#0D1117]/60">
          Spot held
        </p>
      </div>
      <p className="text-[10px] text-[#0D1117]/60 leading-snug">
        These spots are held but unpaid. No online payment is connected, so
        confirm here once you have actually received the money.
      </p>

      {held.map((r) => (
        <div
          key={r.id}
          className="bg-[#F0F2F5] border border-[#E5E8EC] rounded-lg p-2.5 flex items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-xs text-[#0D1117] truncate">{r.name || r.attendeeRef}</p>
            {r.contact && (
              <p className="text-[9px] text-[#0D1117]/60 truncate mt-0.5">{r.contact}</p>
            )}
          </div>
          <button
            disabled={busy}
            onClick={() => onConfirmPayment(r.id)}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#FF5A1F] text-[#0D1117] font-extrabold text-[10px] cursor-pointer disabled:opacity-40"
          >
            Confirm {currency} {price.toLocaleString()}
          </button>
        </div>
      ))}
    </div>
  );
}
