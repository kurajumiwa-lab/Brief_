import React from 'react';
import * as briefApi from '../api/briefApi';
import type { CommandCentre as CommandCentreType } from '../api/types';
import { MicroBars, Funnel } from './MicroBars';

// ---------------------------------------------------------------------------
// HOST COMMAND CENTRE
//
// The host opens Brief and understands, within seconds, what is happening:
// NOW (attention), MONEY (settled vs pending), PEOPLE (registered/arrived/
// cancelled), DISTRIBUTION (views/shares), ACTION (resolution), NEXT (upcoming).
//
// Every figure is server-derived from real rows. This component computes
// nothing: it renders the server's word. No dashboard decoration, no invented
// numbers, no charts for the sake of charts.
// ---------------------------------------------------------------------------

const money = (n: number, c: string) => `${c} ${n.toLocaleString()}`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#10141C] border border-[#232A38] rounded-xl p-3 space-y-2">
      <p className="text-[9px] text-[#4B5162]">{title}</p>
      {children}
    </div>
  );
}

function Big({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-xl font-extrabold ${accent ? 'text-[#43D17A]' : 'text-[#F3F1E7]'}`}>{value}</p>
      <p className="text-[9px] text-[#4B5162]">{label}</p>
    </div>
  );
}

export function HostCommand() {
  const [state, setState] = React.useState<{
    status: 'idle' | 'loading' | 'ready' | 'error';
    data: CommandCentreType | null;
    error: string | null;
  }>({ status: 'idle', data: null, error: null });

  const load = React.useCallback(async () => {
    setState((p) => ({ ...p, status: 'loading' }));
    const res = await briefApi.getCommandCentre();
    if (res.ok) setState({ status: 'ready', data: res.data, error: null });
    else setState({ status: 'error', data: null, error: res.error });
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const d = state.data;

  if (state.status === 'loading' && !d) {
    return <p className="text-xs text-[#8A93A6]">Loading…</p>;
  }
  if (state.status === 'error') {
    return <p className="text-xs text-[#FF6A4D]">{state.error}</p>;
  }
  if (!d) return null;

  const hasAnything = d.now.length > 0 || d.upcoming.length > 0 || d.campaigns.length > 0 || d.action.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#F3F1E7]">Command</h2>
        <button onClick={() => void load()} className="text-[10px] font-extrabold text-[#43D17A] cursor-pointer">Refresh</button>
      </div>

      {/* NOW — the one thing that matters first */}
      <Section title="Now">
        {d.now.length === 0 && d.upcoming.length === 0 ? (
          <p className="text-xs text-[#8A93A6]">Nothing needs you right now.</p>
        ) : (
          <>
            {d.now.slice(0, 5).map((n, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <p className="text-xs text-[#F3F1E7] truncate">{n.name}</p>
                <span className="shrink-0 text-[9px] text-[#E8A33D]">unpaid spot</span>
              </div>
            ))}
            {d.upcoming.length > 0 && (
              <div className="pt-1 border-t border-[#10141C]">
                <p className="text-[9px] text-[#4B5162] mb-1">Upcoming</p>
                {d.upcoming.map((u) => (
                  <p key={u.id} className="text-xs text-[#43D17A] truncate">
                    {u.title} · {u.startsAt.slice(0, 16).replace('T', ' ')}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      {/* MONEY */}
      <Section title="Money">
        <div className="flex gap-6">
          <Big value={money(d.money.grossSettled, d.money.currency)} label="Settled" accent />
          <Big value={money(d.money.grossPending, d.money.currency)} label="Pending" />
        </div>
        <MicroBars
          items={[
            { label: 'Settled', value: d.money.grossSettled, color: 'var(--signal-live)' },
            { label: 'Pending', value: d.money.grossPending }
          ]}
        />
        {d.money.campaignCount === 0 && (
          <p className="text-[10px] text-[#4B5162]">No campaigns yet.</p>
        )}
      </Section>

      {/* PEOPLE */}
      <Section title="People">
        <div className="flex gap-6">
          <Big value={String(d.people.registered)} label="Registered" />
          <Big value={String(d.people.checkedIn)} label="Checked in" accent={d.people.checkedIn > 0} />
          <Big value={String(d.people.cancelled)} label="Cancelled" />
        </div>
        <MicroBars
          items={[
            { label: 'Registered', value: d.people.registered, color: 'var(--signal-live)' },
            { label: 'Arrived', value: d.people.checkedIn },
            { label: 'Cancelled', value: d.people.cancelled }
          ]}
        />
      </Section>

      {/* DISTRIBUTION */}
      <Section title="Distribution">
        <div className="flex gap-6">
          <Big value={String(d.distribution.views)} label="Views" />
          <Big value={String(d.distribution.shares)} label="Shares" />
        </div>
        <Funnel
          stages={[
            { label: 'Views', value: d.distribution.views },
            { label: 'Registered', value: d.people.registered },
            { label: 'Arrived', value: d.people.checkedIn }
          ]}
        />
        <p className="text-[9px] text-[#4B5162] leading-snug">
          Views are page loads, not people. A refresh counts twice.
        </p>
      </Section>

      {/* ACTION */}
      {d.action.length > 0 && (
        <Section title="Action">
          {d.action.slice(0, 6).map((a, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <p className="text-xs text-[#F3F1E7] truncate">{a.vaultTitle}</p>
              <span className="shrink-0 text-[9px] text-[#E8A33D]">{a.kind}</span>
            </div>
          ))}
        </Section>
      )}

      {/* NEXT — the gathering after this one */}
      {d.upcoming.length > 0 && (
        <Section title="Next">
          {d.upcoming.map((u) => (
            <p key={u.id} className="text-xs text-[#F3F1E7] truncate">
              {u.title}
            </p>
          ))}
        </Section>
      )}

      {!hasAnything && (
        <p className="text-xs text-[#8A93A6] leading-relaxed">
          You have no campaigns or vaults yet. Create a gathering to see it here.
        </p>
      )}
    </div>
  );
}

export default HostCommand;
