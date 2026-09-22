import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { MyEscrows } from '../../api/briefApi';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// ESCROW-AS-RECORDS — on Mine, only when something is actually held.
//
// The Stitch "Mine & Ledger" invented KES 14,350 locked, 3 smart milestones
// and a "Vault healthy" badge. Brief holds no money. `GET /api/escrows/mine`
// derives held/released from group-buy and frozen ticket rows. This surface
// prints that read, and only when a row is locked: an empty successful read
// is omitted (a zero vault is furniture), a failed read is a dash and a retry,
// and a 401 is silence (nobody's ledger yet).
// ---------------------------------------------------------------------------

const kes = (n: number) => `KES ${Number(n).toLocaleString('en-KE')}`;

const KIND: Record<string, string> = {
  group_buy: 'Group buy',
  ticket: 'Ticket'
};

export function EscrowRecords({ className = '' }: { className?: string }) {
  const [data, setData] = useState<MyEscrows | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void briefApi.getMyEscrows().then((res) => {
      if (!live) return;
      setLoaded(true);
      setDenied(!res.ok && (res as { status?: number }).status === 401);
      setData(res.ok ? res.data : null);
    });
    return () => { live = false; };
  }, [attempt]);

  // Still reading: render nothing. A skeleton here would be a vault-shaped
  // hole on every visit, including the ones that come back empty.
  if (!loaded) return null;

  if (denied) return null;

  if (!data) {
    return (
      <section
        className={`rounded-2xl p-4 ${className}`}
        style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
        role="status"
        aria-label="Held records unavailable"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
          Held on record
        </p>
        <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--color-text)' }}>
          Held records could not be read just now.
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Nothing is shown in their place — no vault, no healthy badge.
        </p>
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setLoaded(false); setAttempt((n) => n + 1); }}
          className="mt-3 inline-flex items-center px-3.5 py-2 rounded-full text-xs font-black cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
        >
          Try again
        </button>
      </section>
    );
  }

  const held = data.rows.filter((r) => r.state === 'locked');
  if (held.length === 0) return null;

  return (
    <section
      className={`rounded-2xl p-4 space-y-2 ${className}`}
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
      aria-label="Held on record"
      data-testid="escrow-records"
    >
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
          Held on record
        </h2>
      </div>
      <p className="text-[22px] font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
        {kes(data.totals.heldKes)}
      </p>
      <p className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
        {held.length} locked {held.length === 1 ? 'row' : 'rows'} — {data.totals.heldCount} counted on the read.
      </p>
      <ul className="space-y-1.5">
        {held.map((r) => (
          <li key={r.id} className="text-[13px] leading-snug" style={{ color: 'var(--color-text)' }}>
            <span className="font-bold">{r.title}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}· {KIND[r.kind] ?? r.kind} · {r.role} · {kes(r.amountKes)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
        {data.note}
      </p>
    </section>
  );
}

export default EscrowRecords;
