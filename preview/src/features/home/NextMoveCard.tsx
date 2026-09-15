// ---------------------------------------------------------------------------
// NEXT MOVE — the one decision on the home screen.
//
// Not a list, not a comparison: the single move the ledger actually supports,
// chosen server-side in domain/position.js and passed here unchanged. Its
// ranking uses real rows only — demand the matching engine put in front of one
// of your enterprises, or a live proposal you already hold, or the most acute
// open request. Everything on this card traces to a field of that request row
// or to a count over it:
//
//   opened …        the request's own createdAt
//   … matched       the COUNTED live match rows (never a seeded number)
//   needed by …     the requester's own requiredBy date, while it is ahead
//   closed N× …     this category's real closures (domain/precedent.js)
//   your proposal   YOUR OWN offer's derived total, from your quote row
//
// What is deliberately absent, because no row backs it: a run price, a "KES
// 340" figure the requester never stated, a queue position, a sector, a
// "closes in 6h" countdown with no stored deadline. Where the row carries no
// price, the card says the budget is private instead of inventing one.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, EyeOff, Zap } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { MyPosition } from '../../api/briefApi';
import { requestPath } from '../requests/RequestsWorkspace';
import { soundEngine } from '../../utils/SoundEngine';

const HIDE_KEY = 'brief.nextMoveHidden.v1';

const readHidden = (): string | null => {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(HIDE_KEY) : null;
  } catch {
    return null;
  }
};
const writeHidden = (value: string | null) => {
  try {
    if (!window.localStorage) return;
    if (value) window.localStorage.setItem(HIDE_KEY, value);
    else window.localStorage.removeItem(HIDE_KEY);
  } catch {
    /* a blocked store must never break the screen */
  }
};

const money = (v: { amount: number; currency: string } | null | undefined) =>
  v ? `${v.currency} ${Number(v.amount).toLocaleString('en-KE')}` : null;

const age = (hours: number | null) => {
  if (hours == null) return null;
  if (hours < 48) return `opened ${hours}h ago`;
  return `opened ${Math.round(hours / 24)}d ago`;
};

export function NextMoveCard({
  position,
  denied,
  className = ''
}: {
  /** Pass the already-derived position to avoid a second read. */
  position?: MyPosition | null;
  /** True when the parent's read was refused for want of a session (401). */
  denied?: boolean;
  className?: string;
}) {
  const [own, setOwn] = useState<MyPosition | null>(null);
  const [loaded, setLoaded] = useState(position !== undefined);
  const [attempt, setAttempt] = useState(0);
  const [selfDenied, setSelfDenied] = useState(false);
  const [hidden, setHidden] = useState<string | null>(() => readHidden());

  // Standalone use (or a retry after a failed read) fetches here; when the
  // parent already has the read, this card renders it and fetches nothing.
  useEffect(() => {
    if (position !== undefined && attempt === 0) return;
    let live = true;
    void briefApi.getMyPosition().then((res) => {
      if (!live) return;
      setOwn(res.ok ? res.data : null);
      setSelfDenied(!res.ok && res.status === 401);
      setLoaded(true);
    });
    return () => { live = false; };
  }, [position, attempt]);

  const pos = attempt > 0 ? own : position ?? own;

  // Still reading: a skeleton, never a placeholder claim.
  if (!loaded) {
    return (
      <section className={`brief-skeleton h-40 rounded-3xl ${className}`} style={{ background: 'var(--color-surface)' }} aria-busy="true" />
    );
  }

  // No session: this is not an error to report, it is simply nobody's ledger
  // yet — and there is already a sign-in path elsewhere on the screen.
  if (!pos && (denied ?? selfDenied)) return null;

  // The read failed. Say so, offer the retry, and invent nothing in its place.
  if (!pos) {
    return (
      <section
        className={`rounded-3xl border p-4 ${className}`}
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        role="status"
        aria-label="Your next step is unavailable"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
          Your next step
        </p>
        <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--color-text)' }}>
          Your position could not be read just now.
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Nothing is shown in its place — no suggested move, no safe-sounding &ldquo;all clear&rdquo;.
        </p>
        <button
          type="button"
          onClick={() => { setLoaded(false); setAttempt((a) => a + 1); }}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
        >
          Try again
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>
    );
  }

  const move = pos.nextMove;

  if (!move) {
    return (
      <section
        className={`rounded-3xl border p-4 ${className}`}
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        aria-label="Your next step"
      >
        <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)' }}>
          Your next step
        </p>
        <p className="text-sm font-bold mt-1.5" style={{ color: 'var(--color-text)' }}>
          No open demand on the ledger right now.
        </p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Nothing is waiting on a quote, so there is no move to recommend. When a request lands, it appears here.
        </p>
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); requestPath('new'); }}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black cursor-pointer"
          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
        >
          Post what you need
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>
    );
  }

  if (hidden === move.requestId) {
    return (
      <section className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 ${className}`} style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <EyeOff className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
        <p className="text-[11px] flex-1" style={{ color: 'var(--color-text-muted)' }}>
          Next step hidden on this device.
        </p>
        <button
          type="button"
          onClick={() => { writeHidden(null); setHidden(null); }}
          className="text-[11px] font-bold cursor-pointer"
          style={{ color: 'var(--color-primary)' }}
        >
          Show
        </button>
      </section>
    );
  }

  const meta = [
    age(move.ageHours),
    move.matchCount > 0
      ? `${move.matchCount} supplier${move.matchCount === 1 ? '' : 's'} matched`
      : 'nobody matched yet',
    move.collective ? 'a group’s collective order' : null
  ].filter(Boolean) as string[];

  const precedent = [
    move.precedent.closedInWindow > 0
      ? `${move.precedent.closedInWindow}× closed in ${move.precedent.windowDays} days`
      : `nothing in this category has closed here yet`,
    typeof move.precedent.avgHoursToFill === 'number'
      ? `${move.precedent.avgHoursToFill}h to fill on average`
      : null,
    money(move.precedent.avgValue)
      ? `accepted offers averaged ${money(move.precedent.avgValue)}`
      : null
  ].filter(Boolean) as string[];

  const myOffer = money(move.myQuote?.offerValue);
  const priceLine = myOffer
    ? `your proposal: ${myOffer}${move.myQuote?.hoursLeft ? ` · valid ${move.myQuote.hoursLeft}h` : ''}`
    : 'No price stated you can see — the requester’s budget is private until you are matched.';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border-2 ${className}`}
      style={{ borderColor: 'var(--color-primary)', background: '#fff' }}
      aria-label="Your next step"
    >
      <div className="px-4 py-2 flex items-center gap-1.5" style={{ background: 'var(--color-primary-subtle)' }}>
        <Zap className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
        <p className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)' }}>
          Your next step
        </p>
        <span className="ml-auto text-[10px] font-semibold truncate" style={{ color: 'var(--color-text-muted)' }}>
          {move.why}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <h2 className="text-lg font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
          {move.title}
        </h2>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          {move.location && <span>{move.location}</span>}
          {move.location && <span aria-hidden="true">·</span>}
          <span>{meta.join(' · ')}</span>
        </div>

        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>
          {move.severityLabel}
        </p>

        {/* Deadline — only ever the requester's own date, never a fake countdown */}
        {move.requiredBy && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--color-warning)' }}>
            <Clock className="w-3.5 h-3.5" />
            needed by {move.requiredBy}
            {move.hoursUntilRequiredBy ? ` · ${move.hoursUntilRequiredBy}h left` : ''}
          </p>
        )}

        <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          {priceLine}
        </p>

        {/* Precedent — counts of real rows, so the jump is a calculation */}
        <p className="text-[11px] leading-snug font-semibold" style={{ color: 'var(--color-text)' }}>
          Precedent: {precedent.join(' · ')}
        </p>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { soundEngine.play('heavyTap'); requestPath(move.requestId); }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[13px] font-extrabold cursor-pointer active:scale-[0.99] transition"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            {move.myQuote ? 'Open your proposal' : 'Respond to this demand'}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { writeHidden(move.requestId); setHidden(move.requestId); }}
            className="px-3 py-3 rounded-2xl text-[11px] font-bold cursor-pointer border"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            Not now
          </button>
        </div>

        <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
          Derived from request <span className="font-mono">{move.evidence.id}</span> — every figure here is a
          field of that row or a count over it.
        </p>
      </div>
    </section>
  );
}

export default NextMoveCard;
