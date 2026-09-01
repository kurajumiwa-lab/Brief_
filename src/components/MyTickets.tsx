import React from 'react';
import * as briefApi from '../api/briefApi';
import type { ResaleTicket } from '../api/types';
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// MY TICKETS — My Layer → Kept ("My tickets")
//
// The holder's side of the resale system. Each ticket shows the code that is
// valid RIGHT NOW: ownership changes bump the version, and only the current
// "CODE#version" admits at the gate — an old screenshot of this screen stops
// working the moment the seat changes hands, which is the point.
//
// Nothing here can move money. Selling is filed under Workflows → Sell
// (where the money lives); gifting is a plain ownership change.
// ---------------------------------------------------------------------------

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString()}`;

function TicketQr({ code, size = 176 }: { code: string; size?: number }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let live = true;
    QRCode.toDataURL(code, { width: size, margin: 1, color: { dark: '#F7F7F8', light: '#F7F7F8' } })
      .then((url) => { if (live) setDataUrl(url); })
      .catch(() => { if (live) setDataUrl(null); });
    return () => { live = false; };
  }, [code, size]);
  if (!dataUrl) return <div className="w-44 h-44 bg-[#171A20] border border-[#222630] rounded-xl" />;
  return <img src={dataUrl} alt={`Gate code ${code}`} className="w-44 h-44 rounded-xl" />;
}

const KIND_LABEL: Record<string, string> = {
  purchase: 'Sold / bought',
  gift: 'Gifted',
  refund_revert: 'Returned after a refund'
};

export function MyTickets({ onSell }: { onSell?: () => void }) {
  const [load, setLoad] = React.useState<{
    status: 'loading' | 'ready' | 'error';
    data: ResaleTicket[] | null;
    error: string | null;
  }>({ status: 'loading', data: null, error: null });

  const [giftFor, setGiftFor] = React.useState<string | null>(null);
  const [handle, setHandle] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [giftError, setGiftError] = React.useState<string | null>(null);

  const fetchTickets = React.useCallback(async () => {
    setLoad({ status: 'loading', data: null, error: null });
    const res = await briefApi.getMyTickets();
    if (res.ok) setLoad({ status: 'ready', data: res.data.tickets, error: null });
    else setLoad({ status: 'error', data: null, error: res.error });
  }, []);

  React.useEffect(() => { void fetchTickets(); }, [fetchTickets]);

  const gift = async (ticketId: string) => {
    if (!handle.trim()) return;
    setBusy(true); setGiftError(null); setNotice(null);
    const res = await briefApi.giftTicketToHandle(ticketId, handle.trim());
    setBusy(false);
    if (!res.ok) { setGiftError(res.error); return; }
    setGiftFor(null); setHandle('');
    setNotice(`Seat gifted to @${handle.trim()} — their code is live now, yours is not.`);
    void fetchTickets();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-[#F7F7F8]">My tickets</h2>
        <p className="text-xs text-[#F7F7F8]/60 mt-1">
          Seats you hold, with the code the gate accepts right now. Every transfer issues a
          fresh code — old screenshots stop working, on purpose.
        </p>
      </div>

      {notice && (
        <div className="text-xs bg-[#171A20] border border-[#222630] rounded-xl px-3 py-2.5 text-[#F7F7F8]">
          {notice}
        </div>
      )}

      {load.status === 'loading' && (
        <div className="text-xs text-[#F7F7F8]/70 py-8 text-center">Loading your tickets…</div>
      )}

      {load.status === 'error' && (
        <div className="border border-[#222630] rounded-xl p-4 text-center space-y-2">
          <p className="text-xs text-[#F7F7F8]/70">{load.error}</p>
          <button
            onClick={() => void fetchTickets()}
            className="text-xs font-bold text-[#F7F7F8] cursor-pointer underline"
          >
            Try again
          </button>
        </div>
      )}

      {load.status === 'ready' && load.data?.length === 0 && (
        <div className="border border-[#222630] rounded-xl p-6 text-center space-y-1">
          <p className="text-xs font-bold text-[#F7F7F8]">No tickets yet</p>
          <p className="text-[11px] text-[#F7F7F8]/60">
            Register for an event and confirm your seat — a ticket appears here the moment it
            is yours. Seats from public links belong to whoever holds that code, not to an account.
          </p>
        </div>
      )}

      {load.status === 'ready' && load.data?.map((t) => (
        <div key={t.id} className="border border-[#222630] rounded-2xl p-4 space-y-3 bg-[#12151A]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[#F7F7F8] truncate">{t.eventTitle ?? 'Event'}</p>
              <p className="text-[10px] text-[#F7F7F8]/70 mt-0.5">
                {t.status === 'void' ? 'Voided — this seat cannot be used' : `Code version ${t.codeVersion}`}
              </p>
            </div>
            {t.status === 'void' ? (
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-[#1D2027] text-[#F7F7F8]/60">
                VOID
              </span>
            ) : t.activeListingId ? (
              <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-[#1D2027] text-[#F7F7F8]/70">
                LISTED FOR RESALE
              </span>
            ) : null}
          </div>

          {t.status !== 'void' && (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <TicketQr code={t.scanCode} />
              <div className="min-w-0 space-y-1 text-center sm:text-left">
                <p className="font-mono text-sm font-bold text-[#F7F7F8] tracking-wide break-all">{t.scanCode}</p>
                <p className="text-[10px] text-[#F7F7F8]/70">
                  Show this at the gate. The <span className="font-bold">#{t.codeVersion}</span> is the
                  version — a scan of an older version is refused.
                </p>
              </div>
            </div>
          )}

          {t.transfers.length > 0 && (
            <div className="border-t border-[#222630] pt-2 space-y-1">
              <p className="text-[10px] font-bold text-[#F7F7F8]/60 uppercase tracking-wide">This seat's history</p>
              {t.transfers.map((x, i) => (
                <p key={i} className="text-[10px] text-[#F7F7F8]/60">
                  {new Date(x.at).toLocaleDateString()} · {KIND_LABEL[x.kind] ?? x.kind} · code v{x.codeVersionAfter} issued
                </p>
              ))}
            </div>
          )}

          {t.status !== 'void' && !t.activeListingId && (
            <div className="flex flex-wrap gap-2 border-t border-[#222630] pt-3">
              {onSell && (
                <button
                  onClick={onSell}
                  className="text-xs font-bold px-3 py-2 rounded-xl bg-[#FF5A1F] text-[#0D0F12] cursor-pointer"
                >
                  Sell this seat
                </button>
              )}
              {giftFor === t.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="recipient handle"
                    className="text-xs bg-[#12151A] text-[#F7F7F8] rounded-xl px-3 py-2 border border-[#222630] focus:border-[#22E6E0] focus:outline-none"
                  />
                  <button
                    disabled={busy || !handle.trim()}
                    onClick={() => void gift(t.id)}
                    className="text-xs font-bold px-3 py-2 rounded-xl border border-[#22E6E0] text-[#F7F7F8] cursor-pointer disabled:opacity-40"
                  >
                    Gift
                  </button>
                  <button
                    onClick={() => { setGiftFor(null); setHandle(''); setGiftError(null); }}
                    className="text-xs text-[#F7F7F8]/60 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setGiftFor(t.id); setGiftError(null); }}
                  className="text-xs font-bold px-3 py-2 rounded-xl border border-[#222630] text-[#F7F7F8] cursor-pointer"
                >
                  Gift to someone
                </button>
              )}
            </div>
          )}

          {giftFor === t.id && giftError && (
            <p className="text-[11px] text-[#F7F7F8]">{giftError}</p>
          )}
        </div>
      ))}
    </div>
  );
}
