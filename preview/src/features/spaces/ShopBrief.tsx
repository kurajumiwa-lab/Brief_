// ---------------------------------------------------------------------------
// THE MORNING BRIEF — yesterday, as the rows say it happened.
//
// This panel prints nothing it computed. Every figure arrives from
// /api/shop-brief, which scans the owner's rows at read time (order history for
// the money, expense rows for the outflow, activity rows for who wrote what,
// shelf rows for the stock flag). The client's only arithmetic is the day
// stepper, and it can never step into a day that has not arrived.
//
// The lesson this screen exists to apply: an owner read a "Margin" that was one
// space's figure divided by the same vendor's total, because two reads disagreed
// about whose money it was. So the numbers here are printed as the server
// assembled them, and the labels are the server's words (`basis.*`), not ones a
// component wrote for itself.
//
// What is deliberately NOT here:
//   * no "last 7 days", no monthly run-rate, no comparison with other shops —
//     a brief is one day, and a rolling window on the same screen as the day
//     invites the two to be read as each other;
//   * no zero padded into a quiet day: the day says "nothing was recorded";
//   * no staff names without a user row, no "someone was absent" — nothing in
//     this store holds a rota;
//   * no countdown, no "urgent", no nudge to record an expense beyond the one
//     sentence that asks whether the day truly had no outflow.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Store,
  Users
} from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { ShopBrief, ShopBriefFlag, ShopBriefPrefs } from '../../api/types';
import { soundEngine } from '../../utils/SoundEngine';

const DASH = '—';

const DAY_NAME = new Intl.DateTimeFormat('en-KE', {
  timeZone: 'Africa/Nairobi', weekday: 'short', day: 'numeric', month: 'short'
});

/** The day before/after a calendar key, anchored at noon so no boundary shifts it. */
function shiftDay(day: string, delta: number): string {
  const ms = Date.parse(`${day}T12:00:00Z`);
  if (!Number.isFinite(ms)) return day;
  return new Date(ms + delta * 86_400_000).toISOString().slice(0, 10);
}

/** Named exactly the way the server names a day, so the two cannot disagree. */
function nameDay(day: string): string {
  const ms = Date.parse(`${day}T12:00:00Z`);
  return Number.isFinite(ms) ? DAY_NAME.format(new Date(ms)) : day;
}

const kes = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? `KES ${n.toLocaleString('en-KE')}` : DASH;

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[12px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--brief-muted)' }}>
    {children}
  </p>
);

const Figure: React.FC<{ caption: string; value: string }> = ({ caption, value }) => (
  <div className="min-w-0">
    <Label>{caption}</Label>
    <p className="text-[17px] font-extrabold tabular-nums leading-tight" style={{ color: 'var(--brief-ink)' }}>
      {value}
    </p>
  </div>
);

const FlagRow: React.FC<{
  flag: ShopBriefFlag;
  onOpenSpace?: (id: string) => void;
}> = ({ flag, onOpenSpace }) => {
  const [open, setOpen] = useState(false);
  const rows = flag.evidenceIds.length;
  return (
    <li className="rounded-2xl p-3 space-y-1.5" style={{ background: 'var(--well)' }}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--state-quiet-ink)' }} aria-hidden />
        <p className="text-[13px] font-bold leading-snug flex-1 min-w-0" style={{ color: 'var(--brief-ink)' }}>
          {flag.message}
        </p>
      </div>
      <p className="text-[13px] leading-snug" style={{ color: 'var(--brief-muted)' }}>{flag.detail}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
        {rows > 0 && (
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setOpen((v) => !v); }}
            aria-expanded={open}
            className="text-[13px] font-bold underline cursor-pointer"
            style={{ color: 'var(--brief-ink)' }}
          >
            {rows} row{rows === 1 ? '' : 's'} behind this
          </button>
        )}
        {flag.spaceId && onOpenSpace && (
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); onOpenSpace(flag.spaceId as string); }}
            className="text-[13px] font-bold underline cursor-pointer"
            style={{ color: 'var(--brief-ink)' }}
          >
            {flag.spaceName ?? 'the space'}
          </button>
        )}
      </div>
      {open && (
        <ul className="text-[12px] space-y-0.5 pt-1" style={{ color: 'var(--brief-faint)' }}>
          {flag.evidenceIds.map((id) => (
            <li key={id} className="font-mono break-all">{id}</li>
          ))}
        </ul>
      )}
    </li>
  );
};

/**
 * The one writable thing on this screen: whether the owner wants to be told,
 * and at which hour. Off by default, and the server refuses an enabled brief
 * with no hour, so a suggestion in this control never becomes a stored choice.
 */
const MorningDelivery: React.FC<{
  prefs: ShopBriefPrefs | null;
  onSaved: (prefs: ShopBriefPrefs) => void;
  onError: (message: string) => void;
}> = ({ prefs, onSaved, onError }) => {
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(6);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!prefs) return;
    setEnabled(prefs.enabled);
    setHour(prefs.hour ?? 6);
  }, [prefs]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    const res = await briefApi.setShopBriefPrefs({ enabled, hour });
    setBusy(false);
    if (res.ok) {
      onSaved(res.data);
      setSaved(true);
      soundEngine.play('heavyTap');
    } else if (res.status === 401) {
      onError('Sign in to choose when the brief is sent.');
    } else {
      onError(res.error ?? 'The preference was not saved.');
    }
  };

  return (
    <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--well)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-bold" style={{ color: 'var(--brief-ink)' }}>
            <Bell className="w-4 h-4 inline-block mr-1 -mt-0.5" aria-hidden />
            Tell me each morning
          </p>
          <p className="text-[12px] leading-snug mt-0.5" style={{ color: 'var(--brief-faint)' }}>
            A brief is only sent when a day has rows to report, and never at an hour you have not chosen.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {/* The input and its word are siblings, not nested: a checkbox wrapped
              in its own label toggles on the input AND on the label, which on a
              phone is how a row ends up switching back after a tap. */}
          <input
            id="brief-alerts"
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setSaved(false); }}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="brief-alerts" className="text-[13px] font-bold cursor-pointer" style={{ color: 'var(--brief-ink)' }}>
            {enabled ? 'On' : 'Off'}
          </label>
        </div>
      </div>
      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[13px] font-bold" style={{ color: 'var(--brief-ink)' }} htmlFor="brief-hour">
            at
          </label>
          <select
            id="brief-hour"
            value={hour}
            onChange={(e) => { setHour(Number(e.target.value)); setSaved(false); }}
            className="rounded-xl px-2 py-1.5 text-[13px] font-bold cursor-pointer"
            style={{ background: 'var(--color-paper)', color: 'var(--brief-ink)', border: '1px solid var(--brief-line)' }}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-[12px]" style={{ color: 'var(--brief-faint)' }}>Nairobi time</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="px-3 py-1.5 rounded-full text-[13px] font-black cursor-pointer disabled:opacity-60"
          style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && (
          <span className="text-[12px] font-bold" style={{ color: 'var(--state-live-ink)' }}>
            {enabled ? `Saved — from now, at ${String(hour).padStart(2, '0')}:00` : 'Saved — nothing will be sent'}
          </span>
        )}
        {prefs?.lastBriefDay && (
          <span className="text-[12px]" style={{ color: 'var(--brief-faint)' }}>
            last sent {nameDay(prefs.lastBriefDay)}
          </span>
        )}
      </div>
    </div>
  );
};

export function ShopBrief({
  onOpenSpace,
  className = ''
}: {
  onOpenSpace?: (id: string) => void;
  className?: string;
}) {
  const [day, setDay] = useState<string | null>(null);
  const [brief, setBrief] = useState<ShopBrief | null>(null);
  const [prefs, setPrefs] = useState<ShopBriefPrefs | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setFailed(null);
    void Promise.all([
      briefApi.getShopBrief(day),
      briefApi.getShopBriefPrefs()
    ]).then(([b, p]) => {
      if (!live) return;
      setLoaded(true);
      if (b.ok) {
        setBrief(b.data);
        // A first read with no day asked returns yesterday's: hold onto the key
        // the server answered with, so the stepper moves from a real day rather
        // than from a guess the client made about the clock.
        setDay((current) => current ?? b.data.day);
      } else if (b.status === 401) {
        setBrief(null);
        setFailed(null);
      } else {
        setBrief(null);
        setFailed(b.error ?? 'The brief could not be read.');
      }
      if (p.ok) setPrefs(p.data);
    });
    return () => { live = false; };
  }, [day, attempt]);

  // A signed-out visitor gets nothing from this component: the street below them
  // already says what a space is. An error, though, is always said out loud.
  if (!loaded && !failed) {
    return (
      <section className={`rounded-3xl p-4 ${className}`} style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}>
        <Label>The morning brief</Label>
        <p className="text-[13px] mt-1" style={{ color: 'var(--brief-faint)' }}>Reading yesterday’s rows…</p>
      </section>
    );
  }

  if (failed) {
    return (
      <section className={`rounded-3xl p-4 space-y-2 ${className}`} style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }} aria-label="The morning brief">
        <Label>The morning brief</Label>
        <p className="text-[13px] font-bold" role="status" style={{ color: 'var(--brief-ink)' }}>
          {DASH} <span className="font-normal" style={{ color: 'var(--brief-muted)' }}>{failed}</span>
        </p>
        <button
          type="button"
          onClick={() => { soundEngine.play('tap'); setAttempt((n) => n + 1); }}
          className="inline-flex items-center gap-1.5 text-[13px] font-black underline cursor-pointer"
          style={{ color: 'var(--brief-ink)' }}
        >
          <RefreshCw className="w-4 h-4" aria-hidden /> Try again
        </button>
      </section>
    );
  }

  // A business with no space has no figures to print, and the street already
  // says what is missing. So this panel withdraws rather than echoing it.
  if (!brief || brief.reason === 'no_spaces') return null;

  const quiet = brief.empty;
  const go = (next: string) => { soundEngine.play('tap'); setDay(next); };

  return (
    <section
      className={`rounded-3xl overflow-hidden ${className}`}
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1), inset 0 0 0 1px var(--brief-line)' }}
      aria-label="The morning brief"
    >
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[12px] font-black uppercase tracking-[0.16em] truncate" style={{ color: 'var(--color-primary)' }}>
              {brief.shop.name}
            </p>
            <h2 className="text-[20px] font-extrabold leading-tight flex items-center gap-1.5" style={{ color: 'var(--brief-ink)' }}>
              <CalendarDays className="w-5 h-5 shrink-0" aria-hidden />
              {brief.isToday ? 'Today so far' : 'The morning brief'}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0" role="group" aria-label="Which day">
            <button
              type="button"
              onClick={() => go(shiftDay(brief.day, -1))}
              aria-label="The day before"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--well)', color: 'var(--brief-ink)' }}
            >
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </button>
            <span className="text-[13px] font-bold tabular-nums min-w-[92px] text-center" style={{ color: 'var(--brief-ink)' }}>
              {brief.dayLabel}
            </span>
            <button
              type="button"
              onClick={() => go(shiftDay(brief.day, 1))}
              disabled={brief.isToday}
              aria-label="The day after"
              className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--well)', color: 'var(--brief-ink)' }}
            >
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>

        {quiet ? (
          <p className="text-[14px] leading-snug" style={{ color: 'var(--brief-ink)' }}>
            Nothing was recorded on {brief.dayLabel} — no order marked, no expense typed, no note written.
            <span className="block mt-1 text-[13px]" style={{ color: 'var(--brief-faint)' }}>
              A day with no rows is reported as an empty day. It is not shown as a day of zeroes.
            </span>
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Figure caption="Marked in" value={kes(brief.money?.inKes)} />
              <Figure caption="Recorded out" value={kes(brief.money?.outKes)} />
              <Figure caption="Marked in − recorded out" value={kes(brief.money?.netKes)} />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] tabular-nums" style={{ color: 'var(--brief-ink)' }}>
              <span><span className="font-extrabold">{brief.orders?.placed ?? DASH}</span> placed</span>
              <span><span className="font-extrabold">{brief.orders?.marked ?? DASH}</span> marked in</span>
              <span><span className="font-extrabold">{brief.orders?.open ?? DASH}</span> still open</span>
              {(brief.orders?.cancelled ?? 0) > 0 && (
                <span><span className="font-extrabold">{brief.orders?.cancelled}</span> cancelled</span>
              )}
              {(brief.orders?.disputed ?? 0) > 0 && (
                <span><span className="font-extrabold">{brief.orders?.disputed}</span> disputed</span>
              )}
              {(brief.orders?.unstamped ?? 0) > 0 && (
                <span className="font-bold" style={{ color: 'var(--brief-muted)' }}>
                  {brief.orders?.unstamped} marked with no date on the row
                </span>
              )}
            </div>

            {brief.views && brief.views.count > 0 && (
              <p className="text-[13px] flex items-center gap-1.5" style={{ color: 'var(--brief-muted)' }}>
                <Eye className="w-4 h-4" aria-hidden />
                <span className="font-extrabold tabular-nums" style={{ color: 'var(--brief-ink)' }}>{brief.views.count}</span>
                {' '}open{brief.views.count === 1 ? '' : 's'} of your public pages
                {brief.views.ownOpensExcluded > 0 && <span> · your own {brief.views.ownOpensExcluded} left out</span>}
              </p>
            )}

            {brief.spaces.length > 0 && (
              <ul className="space-y-1.5">
                {brief.spaces.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); onOpenSpace?.(s.id); }}
                      className="w-full text-left rounded-2xl px-3 py-2 flex items-center gap-3 cursor-pointer"
                      style={{ background: 'var(--well)' }}
                    >
                      <Store className="w-4 h-4 shrink-0" style={{ color: 'var(--brief-muted)' }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold truncate" style={{ color: 'var(--brief-ink)' }}>{s.name}</span>
                        <span className="block text-[12px] truncate" style={{ color: 'var(--brief-faint)' }}>
                          {s.scope}
                          {s.orders.placed > 0 && ` · ${s.orders.placed} placed`}
                          {s.orders.open > 0 && ` · ${s.orders.open} open`}
                          {s.views > 0 && ` · ${s.views} viewed`}
                        </span>
                      </span>
                      <span className="text-[14px] font-extrabold tabular-nums shrink-0" style={{ color: 'var(--brief-ink)' }}>
                        {kes(s.money.inKes)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {brief.quietSpaces.length > 0 && (
              <p className="text-[12px] leading-snug" style={{ color: 'var(--brief-faint)' }}>
                Nothing recorded on {brief.quietSpaces.join(', ')}.
              </p>
            )}

            {brief.people.length > 0 && (
              <div className="space-y-1">
                <Label>Recorded by</Label>
                <ul className="space-y-1">
                  {brief.people.map((p) => (
                    <li key={p.actorId ?? 'unattributed'} className="text-[13px] flex items-baseline gap-1.5 flex-wrap" style={{ color: 'var(--brief-ink)' }}>
                      <Users className="w-3.5 h-3.5 shrink-0 translate-y-0.5" aria-hidden />
                      <span className="font-bold">{p.name ?? 'someone with no name on record'}</span>
                      {p.isOwner && <span style={{ color: 'var(--brief-faint)' }}>(you)</span>}
                      <span style={{ color: 'var(--brief-muted)' }}>
                        {p.actions} row{p.actions === 1 ? '' : 's'}
                        {p.lastClock ? ` · last ${p.lastClock}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {brief.unassigned && brief.unassigned.orders > 0 && (
              <p className="text-[13px] font-bold leading-snug" style={{ color: 'var(--brief-ink)' }}>
                {kes(brief.unassigned.inKes)} belongs to no space
                <span className="block text-[12px] font-normal mt-0.5" style={{ color: 'var(--brief-faint)' }}>
                  {brief.unassigned.orders} order{brief.unassigned.orders === 1 ? '' : 's'} on an offer filed under no space. It is in the figures above and in none of the space lines, so the two are meant to differ.
                </span>
              </p>
            )}

            {brief.flags.length > 0 && (
              <div className="space-y-1.5">
                <Label>{brief.flags.length} flag{brief.flags.length === 1 ? '' : 's'}</Label>
                <ul className="space-y-1.5">
                  {brief.flags.map((f) => <FlagRow key={f.id} flag={f} onOpenSpace={onOpenSpace} />)}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-4 pb-4">
        <MorningDelivery
          prefs={prefs}
          onSaved={(next) => setPrefs(next)}
          onError={(message) => setFailed(message)}
        />
      </div>
    </section>
  );
}

export default ShopBrief;
