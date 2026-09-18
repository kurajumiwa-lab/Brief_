import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, RefreshCw, Store } from 'lucide-react';
import * as briefApi from '../../api/briefApi';
import type { SpaceEditorialItem, SpaceFieldStatus, SpaceMaintenance, SpacePipeline } from '../../api/types';
import { SpaceFieldInputs, type FieldValues } from './SpaceFieldInputs';
import { requestPath } from '../requests/RequestsWorkspace';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// SPACE OPERATING PANEL — the space as a living document, in three sections.
//
//   OVERVIEW   the schema itself: what the space declared, when each answer
//              was last confirmed, and an editor for it.
//   EDITORIAL  the queue. Not a notification feed — a list of real open items
//              derived from real rows: a field past its cadence, a field never
//              answered, a customer message whose last line came from them, a
//              draft offer nobody can buy, a pending order, a demand matched to
//              this space that has no price on it. Each item says what it came
//              from and what answering it actually does.
//   PIPELINE   how the network reads the space: discoverable or not, listed
//              offers, the requests whose matching run included this space,
//              proposals and their outcomes, settled money, work orders.
//
// What this panel will never show: a rank, a tier, a badge, a "priority
// matching" entitlement, or a claim about buyers you missed. State here is
// arithmetic over timestamps; the ladder would be fiction. And a refresh is a
// CONFIRMATION with a timestamp — an item cannot be made to disappear by
// clicking it, because the row underneath it still exists.
// ---------------------------------------------------------------------------

const STATE_TONE: Record<string, { label: string; fg: string; bg: string }> = {
  fresh: { label: 'FRESH', fg: 'var(--color-success)', bg: 'var(--color-surface)' },
  active: { label: 'ACTIVE', fg: 'var(--color-primary)', bg: 'var(--color-primary-subtle)' },
  stale: { label: 'STALE', fg: 'var(--color-warning)', bg: 'var(--color-surface)' },
  dormant: { label: 'DORMANT', fg: 'var(--color-danger)', bg: 'var(--color-surface)' },
  unstarted: { label: 'NOT STARTED', fg: 'var(--color-text-muted)', bg: 'var(--color-surface)' }
};

const money = (n: number, currency: string | null) => `${currency ?? 'KES'} ${Number(n).toLocaleString('en-KE')}`;

const ago = (hours: number | null) => {
  if (hours == null) return 'never';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export function SpaceOperatingPanel({
  spaceId,
  maintenance,
  onSwitchTab,
  onChanged,
  className = ''
}: {
  spaceId: string;
  /** Home already reads this on the space row; passed in when available. */
  maintenance?: SpaceMaintenance | null;
  onSwitchTab?: (tab: 'pipeline' | 'ledger' | 'catalog' | 'operating') => void;
  onChanged?: () => void;
  className?: string;
}) {
  const [fields, setFields] = useState<SpaceFieldStatus[]>([]);
  const [queue, setQueue] = useState<SpaceEditorialItem[]>([]);
  const [derived, setDerived] = useState<SpaceMaintenance | null>(maintenance ?? null);
  const [pipeline, setPipeline] = useState<SpacePipeline | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FieldValues>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await briefApi.getSpaceOperating(spaceId);
    if (!res.ok) {
      setStatus('error');
      setError(res.error ?? 'The space profile could not be read.');
      return;
    }
    setFields(res.data.fields);
    setQueue(res.data.editorial);
    setDerived(res.data.maintenance);
    setPipeline(res.data.pipeline);
    setStatus('ready');
  }, [spaceId]);

  useEffect(() => { void load(); }, [load]);

  // Prefill the editor with the stored shapes so an edit is a real change.
  const startEdit = () => {
    const values: FieldValues = {};
    for (const f of fields) if (f.raw) values[f.key] = f.raw;
    setDraft(values);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await briefApi.updateSpaceProfile(spaceId, draft);
    setBusy(false);
    if (!res.ok) {
      // The server's refusal is the useful part: it names which answer is wrong.
      setError(res.error ?? 'Could not save those answers.');
      return;
    }
    setEditing(false);
    const changed = res.data.changed.length
      ? `Saved ${res.data.changed.join(', ')}.`
      : '';
    const confirmed = res.data.confirmed.length
      ? ` ${res.data.confirmed.length} unchanged answer${res.data.confirmed.length === 1 ? ' was' : 's were'} recorded as a confirmation, not new information.`
      : '';
    setNotice(`${changed}${confirmed}`.trim());
    await load();
    onChanged?.();
  };

  const confirm = async (key: string) => {
    setBusy(true);
    const res = await briefApi.confirmSpaceField(spaceId, key);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not record that confirmation.');
      return;
    }
    setNotice('Confirmed just now. The answer is the same one on record — this is a timestamp, not new data.');
    await load();
    onChanged?.();
  };

  const postNeedAsRequest = async (text: string) => {
    setBusy(true);
    const res = await briefApi.createRequest({
      intent: 'draft',
      title: text.slice(0, 120),
      description: `Declared need from your space profile: “${text}”. Review it, then submit it so the network can answer.`,
      category: (fields.find((f) => f.key === 'what')?.raw as { text?: string } | undefined)?.text?.slice(0, 40) ?? '',
      location: (fields.find((f) => f.key === 'operatingFrom')?.raw as { text?: string } | undefined)?.text?.slice(0, 200) ?? ''
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not draft that request.');
      return;
    }
    soundEngine.play('tap');
    // A DRAFT, owned by the vendor, editable and only live once they submit it.
    requestPath(res.data.id);
  };

  if (status === 'loading') {
    return <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reading the space profile…</p>;
  }
  if (status === 'error' && !derived) {
    return (
      <p className="text-xs font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
        {error}
      </p>
    );
  }

  const tone = STATE_TONE[derived?.state ?? 'unstarted'] ?? STATE_TONE.unstarted;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* ── STATE ─────────────────────────────────────────────────────────── */}
      <section
        className="p-4 rounded-2xl  space-y-2 brief-card"
        style={{ background: 'var(--color-paper)' }}
        aria-label="Space maintenance state"
      >
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-black uppercase tracking-[0.14em] px-2 py-1 rounded-full"
            style={{ color: tone.fg, background: tone.bg, border: '1px solid var(--color-border)' }}
          >
            {tone.label}
          </span>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {derived ? `last touched ${ago(derived.ageHours)}` : 'not read yet'}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            <RefreshCw className="w-3 h-3" /> Re-read
          </button>
        </div>

        {derived && (
          <p className="text-[12px] leading-snug" style={{ color: 'var(--color-text)' }}>
            {derived.answered}/{derived.fields.length} answers on record · {derived.overdue} overdue ·{' '}
            {derived.due} coming due · {derived.unanswered} never answered
          </p>
        )}

        {/* Only consequences a row actually supports, stated as facts. */}
        <ul className="space-y-1">
          {(derived?.facts ?? []).map((f) => (
            <li key={f} className="text-[12px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              · {f}
            </li>
          ))}
        </ul>
        {notice && <p className="text-[12px] font-bold" style={{ color: 'var(--color-success)' }}>{notice}</p>}
        {error && <p className="text-[12px] font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>{derived?.note}</p>
      </section>

      {/* ── OVERVIEW / EDITOR ─────────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Space schema">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Overview
          </h3>
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); editing ? setEditing(false) : startEdit(); }}
            className="text-[12px] font-bold cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            {editing ? 'Cancel' : 'Edit answers'}
          </button>
        </div>

        {!editing && (
          <div className="rounded-2xl border divide-y" style={{ borderColor: 'var(--brief-line)' }}>
            {fields.map((f) => (
              <div key={f.key} className="p-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                    {f.question}
                  </p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: f.answer ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                    {f.answer ?? 'never answered'}
                  </p>
                  <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                    <Clock className="w-3 h-3" />
                    {f.lastConfirmedAt ? `confirmed ${ago(f.ageHours ?? null)}` : 'no timestamp'}
                    {f.confirmations > 0 ? ` · ${f.confirmations} confirmation${f.confirmations === 1 ? '' : 's'}` : ''}
                    {f.state === 'overdue' ? ' · past its refresh window' : f.state === 'due' ? ' · due soon' : ''}
                  </p>
                </div>
                {f.answer && (
                  <button
                    type="button"
                    onClick={() => void confirm(f.key)}
                    disabled={busy}
                    className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-full cursor-pointer border disabled:opacity-50"
                    style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text-muted)', boxShadow: 'var(--room-light-dim)' }}
                    title="Record that this answer still stands"
                  >
                    Still true
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="p-4 rounded-2xl border space-y-4" style={{ borderColor: 'var(--brief-line)' }}>
            <SpaceFieldInputs
              fields={fields}
              values={draft}
              onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
              idPrefix="ops"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="w-full py-2.5 rounded-2xl text-xs font-black cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              {busy ? 'Saving…' : 'Save answers'}
            </button>
            <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
              Only the fields you change are written, and each keeps its own timestamp. Leaving one blank does
              not delete it.
            </p>
          </div>
        )}
      </section>

      {/* ── EDITORIAL QUEUE ───────────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Open items">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Editorial queue
          </h3>
          <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {queue.length} open item{queue.length === 1 ? '' : 's'}
          </span>
        </div>

        {queue.length === 0 ? (
          <div className="p-4 rounded-2xl border flex items-center gap-2" style={{ borderColor: 'var(--brief-line)' }}>
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
            <p className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>
              Nothing open. Every answer is inside its window and no row is waiting on you.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li
                key={item.id}
                className="p-3 rounded-2xl border"
                style={{
                  borderColor: item.urgency === 'overdue' || item.urgency === 'missing' ? 'var(--color-primary)' : 'var(--color-border)',
                  background: 'var(--color-paper)'
                }}
              >
                <p className="text-[14px] font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                  {item.label}
                </p>
                <p className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  {item.detail}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {item.action === 'confirm' && item.field && (
                    <button
                      type="button"
                      onClick={() => void confirm(item.field!)}
                      disabled={busy}
                      className="text-[12px] font-black px-3 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
                      style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                    >
                      Still true
                    </button>
                  )}
                  {item.action === 'edit' && (
                    <button
                      type="button"
                      onClick={() => { startEdit(); }}
                      className="text-[12px] font-black px-3 py-1.5 rounded-full cursor-pointer"
                      style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
                    >
                      Answer it
                    </button>
                  )}
                  {(item.action === 'inbox' || item.action === 'offers') && onSwitchTab && (
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); onSwitchTab(item.action === 'inbox' ? 'pipeline' : 'catalog'); }}
                      className="inline-flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full cursor-pointer border"
                      style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}
                    >
                      {item.action === 'inbox' ? 'Open inbox' : 'Open offers'}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  {item.action === 'request' && item.requestId && (
                    <button
                      type="button"
                      onClick={() => { soundEngine.play('tap'); requestPath(item.requestId!); }}
                      className="inline-flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-full cursor-pointer border"
                      style={{ borderColor: 'var(--brief-line)', color: 'var(--color-text)' }}
                    >
                      Open the request
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                  <span className="ml-auto text-[11px] font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {item.evidence.table}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── PIPELINE ──────────────────────────────────────────────────────── */}
      {pipeline && (
        <section className="space-y-2" aria-label="How the network reads this space">
          <h3 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Pipeline
          </h3>
          <div className="p-3 rounded-2xl border space-y-1.5" style={{ borderColor: 'var(--brief-line)' }}>
            <Row
              icon={<Store className="w-3.5 h-3.5" />}
              label={pipeline.discoverable ? 'In the public directory' : 'Not in the public directory'}
              value={pipeline.directory}
            />
            <Row
              label="Listed offers"
              value={`${pipeline.listings.active} active${pipeline.listings.drafts ? ` · ${pipeline.listings.drafts} still draft` : ''}`}
            />
            <Row
              label="Match queries"
              value={`${pipeline.matchQueries30d.count} ${pipeline.matchQueries30d.wording}`}
            />
            <Row
              label="Your proposals"
              value={`${pipeline.proposals.total} total · ${pipeline.proposals.accepted} accepted · ${pipeline.proposals.declined} declined`}
            />
            <Row
              label="Settled money"
              value={
                pipeline.settled.orders === 0
                  ? 'no settled orders yet'
                  : pipeline.settled.currency === null
                    ? `${pipeline.settled.orders} orders (mixed currencies, so no single total)`
                    : `${pipeline.settled.orders} orders · ${money(pipeline.settled.value, pipeline.settled.currency)}`
              }
            />
            <Row label="Work orders" value={`${pipeline.workOrders} live or completed`} />
            <p className="text-[11px] leading-snug pt-1" style={{ color: 'var(--color-text-muted)' }}>{pipeline.note}</p>
          </div>

          {pipeline.needs.length > 0 && (
            <div className="p-3 rounded-2xl border space-y-2" style={{ borderColor: 'var(--brief-line)' }}>
              <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Your declared needs
              </p>
              {pipeline.needs.map((n) => (
                <div key={n.text} className="flex items-start gap-2">
                  <p className="text-[13px] flex-1 leading-snug" style={{ color: 'var(--color-text)' }}>{n.text}</p>
                  <button
                    type="button"
                    onClick={() => void postNeedAsRequest(n.text)}
                    disabled={busy}
                    className="shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full cursor-pointer border disabled:opacity-50"
                    style={{ borderColor: 'var(--brief-line)', color: 'var(--color-primary)' }}
                    title="Creates a draft request you own — it goes live only when you submit it"
                  >
                    Post as a request
                  </button>
                </div>
              ))}
              <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                A need does not become demand on its own: it becomes a draft you can review, price and submit.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      {icon}
      <span className="text-[11px] font-black uppercase tracking-wider shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <span className="text-[12px] font-semibold flex-1 text-right leading-snug" style={{ color: 'var(--color-text)' }}>
        {value}
      </span>
    </div>
  );
}

export default SpaceOperatingPanel;
