import React from 'react';
import * as briefApi from '../api/briefApi';
import type { Notification } from '../api/briefApi';

// ---------------------------------------------------------------------------
// PULSE — the fifth destination (§2, §20), rebuilt CHANGE-FIRST.
//
// Pulse answers exactly one question: what changed that matters?
//   * notifications are the primary input (F3): confirmations, arena
//     challenges, kept-object changes, event reminders, workflow completions,
//     system notes — every row a real server event, read through
//     /api/notifications, marked read through the same surface,
//   * group activity is the second strip: the caller's own signal layer,
//     access-checked server-side, so a group you cannot see never contributes,
//   * the retired town-metrics reading (share-of-fresh dashboards) stays
//     retired: nothing here aggregates a vanity percentage.
// An empty feed says so. Nothing is generated to fill it.
// ---------------------------------------------------------------------------

const KIND_META: Record<string, { label: string; glyph: string }> = {
  confirmed: { label: 'Verified', glyph: '✓' },
  challenge: { label: 'Arena', glyph: '⚔' },
  saved_changed: { label: 'Kept changed', glyph: '★' },
  event_soon: { label: 'Soon', glyph: '⏰' },
  workflow: { label: 'Workflow', glyph: '▸' },
  system: { label: 'Brief', glyph: '•' }
};

const SIGNAL_LABEL: Record<string, string> = {
  source_connected: 'a source was connected',
  item_received: 'a record arrived',
  object_created: 'an entry was created',
  object_updated: 'an entry was updated',
  duplicate_merged: 'a duplicate was merged',
  circle_created: 'a group was created',
  block_added: 'a block was added',
  target_progressed: 'a target moved',
  member_joined: 'someone joined',
  task_assigned: 'a task was assigned',
  task_released: 'a task was released',
  task_completed: 'a task was completed',
  vote_cast: 'a vote was cast',
  vote_closed: 'a vote closed',
  sync_completed: 'a sync completed',
  sync_failed: 'a sync failed'
};

export function PulseScreen() {
  const [feed, setFeed] = React.useState<Notification[] | null>(null);
  const [unread, setUnread] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const [signals, setSignals] = React.useState<{ id: string; type: string; at: string }[] | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    const res = await briefApi.getNotifications();
    if (res.ok) {
      setFeed(res.data.notifications);
      setUnread(res.data.unread);
    } else {
      setFeed([]);
      setError(res.error);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  React.useEffect(() => {
    let live = true;
    void briefApi.getSignals({ limit: 12 }).then((res) => {
      if (live && res.ok) setSignals(res.data.map((s) => ({ id: s.id, type: s.type, at: s.createdAt })));
      else if (live) setSignals([]);
    });
    return () => { live = false; };
  }, []);

  const markOne = async (id: string) => {
    setBusy(true);
    await briefApi.markNotificationsRead(id);
    setBusy(false);
    await load();
  };

  const markAll = async () => {
    setBusy(true);
    await briefApi.markNotificationsRead();
    setBusy(false);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#111111]">Pulse</h2>
          <p className="text-[10px] text-[#111111]/60 leading-snug">
            What changed that matters: confirmations, challenges, kept things,
            events and workflows. Nothing here is a forecast or a vanity
            percentage.
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => void markAll()}
            disabled={busy}
            className="shrink-0 rounded-xl bg-[#111111] px-3 py-2 text-[10px] font-extrabold text-[#FFFFFF] cursor-pointer disabled:opacity-40"
          >
            Mark {unread} read
          </button>
        )}
      </div>

      {error && <p className="text-xs text-[#111111]">{error}</p>}
      {feed === null && <p className="text-xs text-[#111111]/60">Loading…</p>}

      {feed !== null && feed.length === 0 && !error && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-5">
          <p className="text-sm font-extrabold text-[#111111]/60">Nothing has changed yet.</p>
          <p className="mt-1 text-[11px] text-[#111111]/50 leading-snug">
            When something you touched is confirmed, contested or scheduled, it
            lands here. An honest empty is better than a filled screen.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {(feed ?? []).map((n) => {
          const meta = KIND_META[n.kind] ?? { label: n.kind, glyph: '•' };
          return (
            <button
              key={n.id}
              onClick={() => void markOne(n.id)}
              disabled={busy || n.read}
              className={`w-full text-left rounded-2xl border p-3.5 space-y-1 cursor-pointer ${
                n.read ? 'border-[#E5E7EB] bg-[#FFFFFF]' : 'border-[#111111] bg-[#FFFFFF]'
              } ${n.read ? '' : 'disabled:cursor-pointer'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#111111]/40">
                  {meta.label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[9px] text-[#111111]/40">{n.createdAt.slice(0, 10)}</span>
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--signal-live)' }} />}
                </span>
              </div>
              <p className={`text-[13px] ${n.read ? 'font-bold text-[#111111]/70' : 'font-extrabold text-[#111111]'}`}>
                {n.title}
              </p>
              {n.body && <p className="text-[11px] leading-snug text-[#111111]/60">{n.body}</p>}
              {!n.read && <p className="text-[9px] text-[#111111]/40">tap to mark read</p>}
            </button>
          );
        })}
      </div>

      {/* Group activity — the caller's own signal layer, access-checked
          server-side. A group you cannot see never contributes a row. */}
      {signals !== null && signals.length > 0 && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-[#FFFFFF] p-4 space-y-1.5">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111111]/50">
            Around your groups
          </p>
          {signals.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-[#111111]/80">
                {SIGNAL_LABEL[s.type] ?? s.type.replace(/_/g, ' ')}
              </span>
              <span className="shrink-0 text-[9px] text-[#111111]/40">{s.at.slice(0, 10)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PulseScreen;
