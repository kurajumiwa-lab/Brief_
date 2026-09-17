// ---------------------------------------------------------------------------
// PULSE — the world screen, as opposed to the "you" screens.
//
// It is the signal bar expanded: the same derived facts, plus the open demand
// the platform can honestly name, plus the PRECEDENT behind each category —
// how many requests like this actually closed, how long they took, and what the
// accepted offers were priced at. That last part is the point: it turns "should
// I take this?" from a leap into a calculation.
//
// Everything on this screen comes from GET /api/pulse and GET /api/precedent,
// both of which compute counts over real rows at read time. What it will never
// show, because no row in Brief supports it:
//   * a live market price feed (soko/WFP are not wired in, so there is no
//     "+22%" — a listing carries one price, not a history);
//   * a sector, a route, a queue position or a per-run price;
//   * somebody else's budget, identity or private specification.
// ---------------------------------------------------------------------------

import React, { useEffect, useState } from 'react';
import { ChevronDown, Newspaper, TrendingUp } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { MyPosition, Precedent, Pulse } from '../../api/briefApi';
import { requestPath } from '../requests/RequestsWorkspace';
import { soundEngine } from '../../utils/SoundEngine';

const money = (v: { amount: number; currency: string } | null | undefined) =>
  v ? `${v.currency} ${Number(v.amount).toLocaleString('en-KE')}` : null;

const clockOf = (iso: string | null) => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
};

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-3xl bg-[color:var(--color-paper)] border border-black/5 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
          {title}
        </h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function PulseSurface({ className = '' }: { className?: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [position, setPosition] = useState<MyPosition | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [openGap, setOpenGap] = useState<string | null>(null);
  const [precedent, setPrecedent] = useState<Precedent | null>(null);
  const [precedentBusy, setPrecedentBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.all([briefApi.getPulse(), briefApi.getMyPosition()]).then(([p, pos]) => {
      if (!live) return;
      if (!p.ok) {
        setStatus('error');
        return;
      }
      setPulse(p.data);
      setPosition(pos.ok ? pos.data : null);
      setStatus('ready');
    });
    return () => { live = false; };
  }, []);

  const toggleGap = async (category: string | null) => {
    if (openGap === category) {
      setOpenGap(null);
      return;
    }
    setOpenGap(category);
    setPrecedent(null);
    setPrecedentBusy(true);
    const res = await briefApi.getPrecedent(category ?? undefined);
    setPrecedentBusy(false);
    if (res.ok) setPrecedent(res.data);
  };

  if (status === 'loading') {
    return <p className="text-xs brief-skeleton h-4 rounded" style={{ color: 'var(--color-text-muted)' }}>Reading the ledger…</p>;
  }
  if (status === 'error' || !pulse) {
    return (
      <p className="text-xs font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
        Pulse is unavailable — the ledger could not be read. Nothing is shown in its place.
      </p>
    );
  }

  const stamp = clockOf(pulse.asOf);
  const s = pulse.sections;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-sm font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Pulse
          </h2>
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
          {stamp ? `snapshot ${stamp}` : 'no rows yet'}
        </span>
      </div>

      <Card
        title="What's moving"
        right={
          <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {pulse.facts.length} derived fact{pulse.facts.length === 1 ? '' : 's'}
          </span>
        }
      >
        {pulse.empty ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Nothing has moved yet: no open requests, no settled orders, no published events. When a row
            exists it is counted here the same second — nothing is pre-filled to make this look busy.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {pulse.facts.map((f) => (
              <li key={f.id} className="text-[13px] leading-snug" style={{ color: 'var(--color-text)' }}>
                {f.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Open demand you could answer">
        {!position || position.open.total === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No request is waiting for a quote right now.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              {position.open.total} request{position.open.total === 1 ? '' : 's'} on the ledger have no accepted
              quote. Only the demand is shown — no requester, no budget.
            </p>
            {position.open.top.map((g) => (
              <div key={g.requestId} className="rounded-2xl border p-3" style={{ borderColor: 'var(--brief-line)' }}>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); requestPath(g.requestId); }}
                  className="w-full text-left cursor-pointer"
                >
                  <p className="text-sm font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                    {g.title}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {[g.location, g.severityLabel].filter(Boolean).join(' · ')}
                    {g.collective ? ' · collective order' : ''}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void toggleGap(g.category ?? null)}
                  aria-expanded={openGap === (g.category ?? null)}
                  className="mt-2 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <TrendingUp className="w-3 h-3" />
                  Precedent for {g.category ?? 'this category'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openGap === (g.category ?? null) ? 'rotate-180' : ''}`} />
                </button>

                {openGap === (g.category ?? null) && (
                  <div className="mt-2 pt-2 border-t text-[11px] space-y-1" style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}>
                    {precedentBusy || !precedent ? (
                      <p style={{ color: 'var(--color-text-muted)' }}>Reading closed rows…</p>
                    ) : (
                      <>
                        <p>
                          {precedent.fill.closed > 0
                            ? `${precedent.fill.closed} request${precedent.fill.closed === 1 ? '' : 's'} in this category closed in the last ${precedent.fill.windowDays} days`
                            : 'Nothing in this category has closed here yet.'}
                        </p>
                        <p style={{ color: 'var(--color-text-muted)' }}>
                          {typeof precedent.fill.avgHoursToFill === 'number'
                            ? `Took ${precedent.fill.avgHoursToFill}h on average across ${precedent.fill.hoursSampleCount} row${precedent.fill.hoursSampleCount === 1 ? '' : 's'}.`
                            : 'No fill time on record — the closed rows do not carry both timestamps.'}
                        </p>
                        <p style={{ color: 'var(--color-text-muted)' }}>
                          {precedent.fill.avgValue
                            ? `Accepted offers averaged ${money(precedent.fill.avgValue)} (${precedent.fill.avgValue.sampleCount} priced offer${precedent.fill.avgValue.sampleCount === 1 ? '' : 's'}).`
                            : 'No offer price to average — the accepted offers in this category carry no completed price.'}
                        </p>
                        <p style={{ color: 'var(--color-text-muted)' }}>{precedent.note}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Money and work that moved">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: `settled orders · ${s.money.windowDays}d`, value: String(s.money.settledOrders) },
            { label: 'settled value', value: s.money.settledValue !== null ? money({ amount: s.money.settledValue, currency: s.money.settledCurrency ?? 'KES' }) : 'mixed currencies' },
            { label: `work orders completed · ${s.money.windowDays}d`, value: String(s.money.completedWorkOrders) },
            { label: 'pickups delivered', value: String(s.money.deliveredPickups) }
          ].map((m) => (
            <div key={m.label} className="p-3 rounded-2xl" style={{ background: 'var(--color-paper)' }}>
              <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                {m.label}
              </p>
              <p className="text-base font-mono font-extrabold brief-countdown" style={{ color: 'var(--color-text)' }}>
                {m.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Listed prices right now"
        right={
          <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            snapshot · not a trend
          </span>
        }
      >
        {s.listings.snapshot.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            No active listings, so there is no average to report. A zero here would imply &ldquo;free&rdquo;,
            which would be false.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {s.listings.snapshot.map((sig) => (
              <li key={sig.type} className="flex items-baseline justify-between gap-2 text-[12px]">
                <span className="font-bold capitalize" style={{ color: 'var(--color-text)' }}>
                  {sig.type} <span style={{ color: 'var(--color-text-muted)' }}>· {sig.count} listed</span>
                </span>
                <span className="font-mono" style={{ color: 'var(--color-text)' }}>
                  avg {money({ amount: sig.avgPrice, currency: sig.currency })} ·{' '}
                  {money({ amount: sig.minPrice, currency: sig.currency })}–{money({ amount: sig.maxPrice, currency: sig.currency })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-[10px] leading-snug px-1" style={{ color: 'var(--color-text-muted)' }}>
        {pulse.note}
      </p>
    </div>
  );
}

export default PulseSurface;
