import React, { useCallback, useEffect, useState } from 'react';
import { Globe, Search, Users } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { GuardianLink, GuardianNetwork as Network, PublicSpace } from '../../api/types';
import { StateDot, type DotState } from '../../ui/StateDot';

// ---------------------------------------------------------------------------
// GUARDIAN NETWORK — the shop-side ledger of "I introduced that business".
//
// The model: whoever brought a shop in has a reason to keep caring about it, and
// the shop can refuse the link. So this screen shows a guardian only facts that
// exist as rows, and states the one condition that matters — the shop has to
// confirm, and until it does, nothing accrues.
//
// What is deliberately NOT here, all of it because Brief holds no rows for it:
//   * stars, a rating, "good standing", a complaint RATE — there are no review
//     rows for a shop's orders, so there is nothing to average or divide;
//   * the shop's revenue, customers or order values. A guardian is credited
//     points, not shown the book;
//   * any suggestion of a queue or rank — one guardian per shop, first claim,
//     and a shop that says no is closed to everybody;
//   * "earnings" as a number of money. The credit is points; what they are worth
//     is stated once, with the pool's real balance, because a rate without the
//     pool balance is a promise that may not be payable.
// ---------------------------------------------------------------------------

const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toLocaleString('en-KE'));
const DOTS: Record<GuardianLink['status'], DotState> = {
  active: 'live',
  pending_owner: 'quiet',
  flagged: 'stale',
  suspended: 'stale',
  disputed: 'unknown',
  revoked: 'unknown',
  expired: 'unknown'
};
const WORD: Record<GuardianLink['status'], string> = {
  active: 'live',
  pending_owner: 'awaiting the shop',
  flagged: 'paused',
  suspended: 'frozen',
  disputed: 'disputed',
  revoked: 'ended',
  expired: 'window closed'
};

export function GuardianNetwork({ className = '' }: { className?: string }) {
  const [net, setNet] = useState<Network | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const res = await briefApi.getGuardianNetwork();
    if (res.ok) setNet(res.data.network);
    else setError(res.error ?? 'Brief could not read your network.');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revoke = async (id: string) => {
    setBusy(true);
    const res = await briefApi.answerGuardian(id, 'revoke', reason);
    setBusy(false);
    setRevoking(null);
    setReason('');
    if (!res.ok) { setNotice(res.error ?? 'That did not go through.'); return; }
    setNotice('Ended. The record stays: Brief keeps the claim and its ending, not just the part you liked.');
    void load();
  };

  if (error) {
    return <p className="text-[13px]" style={{ color: 'var(--brief-muted)' }} role="status">{error}</p>;
  }
  if (!net) {
    return <p className="text-[13px]" style={{ color: 'var(--brief-muted)' }}>Reading your network…</p>;
  }

  const rows = net.businesses;
  const c = net.conversion ?? null;

  return (
    <section className={`space-y-3 ${className}`} aria-label="Your network" data-guardian-network="true">
      <header className="flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
        <h2 className="text-[15px] font-extrabold" style={{ color: 'var(--brief-ink)' }}>Your network</h2>
        <p className="ml-auto text-[11px] font-mono" style={{ color: 'var(--color-quiet)' }}>
          {num(rows.length)} {rows.length === 1 ? 'shop' : 'shops'}
        </p>
      </header>

      {rows.length === 0 && (
        <div className="p-4 rounded-2xl text-center" style={{ background: 'var(--color-well)' }}>
          <p className="text-[14px] font-bold" style={{ color: 'var(--brief-ink)' }}>You have not claimed a shop yet</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--brief-muted)' }}>
            If you walked a business through signing up, say so. They confirm or refuse; nothing accrues until they answer.
          </p>
          <button
            type="button"
            onClick={() => setClaiming(true)}
            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            <Globe className="w-4 h-4" /> Claim a shop
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li key={b.attributionId} className="p-3.5 rounded-2xl brief-lift-1" style={{ background: 'var(--brief-card)' }}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[14px] font-bold" style={{ color: 'var(--brief-ink)' }}>
                  {b.spaceName ?? 'A shop'}
                </p>
                <StateDot state={DOTS[b.status] ?? 'unknown'} label={WORD[b.status] ?? b.status} />
              </div>
              {/* Counts only. No star, no rate, no money of theirs. */}
              <p className="mt-1.5 text-[12px] font-mono" style={{ color: 'var(--brief-muted)' }}>
                {num(b.settledOrders)} settled {b.settledOrders === 1 ? 'order' : 'orders'} · {num(b.points)} points
                {b.freshness ? ` · their answers ${b.freshness}` : ''}
                {b.reports > 0 ? ` · ${b.reports} open report${b.reports === 1 ? '' : 's'}` : ''}
              </p>
              {b.statusReason && (
                <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--state-stale-ink)' }}>{b.statusReason}</p>
              )}
              <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--brief-faint)' }}>{b.note}</p>
              {b.status === 'active' && (
                <div className="mt-2">
                  {revoking === b.attributionId ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        aria-label="Reason"
                        value={reason}
                        maxLength={300}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="why is the link ending?"
                        className="w-full px-3 py-2 rounded-xl text-[13px]"
                        style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy || reason.trim().length < 6}
                          onClick={() => void revoke(b.attributionId)}
                          className="px-3 py-1.5 rounded-full text-[12px] font-black cursor-pointer disabled:opacity-40"
                          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                        >
                          End it
                        </button>
                        <button type="button" onClick={() => { setRevoking(null); setReason(''); }} className="px-3 py-1.5 rounded-full text-[12px] font-bold cursor-pointer" style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}>
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setRevoking(b.attributionId)} className="text-[12px] font-bold cursor-pointer" style={{ color: 'var(--color-primary)' }}>
                      End this link
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* What a point is worth, and what the pool can actually pay — side by side,
          so the number is never presented as money already earned. */}
      {c && (
        <div className="p-3 rounded-2xl" style={{ background: 'var(--color-well)' }}>
          <p className="text-[12px] font-mono" style={{ color: 'var(--brief-ink)' }}>
            {num(net.totals.points)} points · {c.ptsToKes > 0 ? `KES ${num(Math.floor(net.totals.points * c.ptsToKes))} at ${c.ptsToKes} each` : 'no cash rate set'}
          </p>
          <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--brief-muted)' }}>
            {num(c.pointsAvailable)} convertible (minimum {num(c.minPoints)}) · the rewards pool holds KES {num(c.poolAvailableKes)} from confirmed service-fee revenue. Above that, a conversion is refused, not advanced.
          </p>
        </div>
      )}

      {notice && <p role="status" className="text-[12px] font-bold" style={{ color: 'var(--brief-muted)' }}>{notice}</p>}

      {claiming && (
        <ClaimSheet
          onDone={(msg) => { setClaiming(false); setNotice(msg); void load(); }}
          onCancel={() => setClaiming(false)}
        />
      )}
    </section>
  );
}

/**
 * Picking the shop to claim. Searched from the PUBLIC directory only — a private
 * space cannot be attributed, so it is not offered. The note is optional; the
 * shop's answer is not.
 */
function ClaimSheet({ onDone, onCancel }: { onDone: (msg: string) => void; onCancel: () => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<PublicSpace[]>([]);
  const [note, setNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const res = await briefApi.discoverPublicSpaces(30);
      if (!live) return;
      const all = res.ok ? res.data : [];
      const needle = q.trim().toLowerCase();
      setRows(needle ? all.filter((s) => s.name.toLowerCase().includes(needle)) : all);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q]);

  const claim = async (space: PublicSpace) => {
    setBusyId(space.id);
    setErr(null);
    const res = await briefApi.claimGuardian(space.id, note.trim() || undefined);
    setBusyId(null);
    if (!res.ok) { setErr(res.error ?? 'That claim was refused.'); return; }
    onDone(`Claimed ${space.name}. They will see it in their space and answer there — nothing accrues until they do.`);
  };

  return (
    <div className="p-3.5 rounded-2xl brief-lift-2" style={{ background: 'var(--brief-card)' }}>
      <label className="block text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-muted)' }} htmlFor="gu-search">
        Which shop did you bring in?
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <Search className="w-4 h-4 shrink-0" style={{ color: 'var(--brief-faint)' }} aria-hidden="true" />
        <input
          id="gu-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search the public directory"
          className="flex-1 px-3 py-2 rounded-xl text-[13px] focus:outline-none"
          style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
        />
      </div>
      <input
        type="text"
        aria-label="Note for the shop"
        value={note}
        maxLength={240}
        onChange={(e) => setNote(e.target.value)}
        placeholder="how you know them (optional)"
        className="mt-2 w-full px-3 py-2 rounded-xl text-[13px] focus:outline-none"
        style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
      />
      <ul className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
        {rows.length === 0 && <li className="text-[12px] py-2" style={{ color: 'var(--brief-muted)' }}>No public shop by that name.</li>}
        {rows.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={busyId === s.id}
              onClick={() => void claim(s)}
              className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}
            >
              {s.name}
              <span className="ml-2 font-mono font-normal" style={{ color: 'var(--brief-muted)' }}>
                {s.activeOfferCount} offer{s.activeOfferCount === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {err && <p role="status" className="mt-2 text-[12px] font-bold" style={{ color: 'var(--brief-danger)' }}>{err}</p>}
      <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--brief-faint)' }}>
        This sends the shop a question, not a bill. Brief does not decide for them, and a refusal is final: a shop that says no cannot be claimed by anyone else.
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onCancel} className="px-3.5 py-2 rounded-full text-[12px] font-bold cursor-pointer" style={{ background: 'var(--color-well)', color: 'var(--brief-ink)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default GuardianNetwork;
