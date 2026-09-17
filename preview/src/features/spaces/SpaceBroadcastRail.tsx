import React, { useState } from 'react';
import { Clock, Radio, Trash2 } from 'lucide-react';
import type { SpaceBroadcast } from '../../api/types';

// ---------------------------------------------------------------------------
// BROADCAST RAIL — the 24-hour update strip, borrowed from Stories because the
// shape is right: a row of rings at the top, ephemeral, casual, no feed.
//
// What is NOT borrowed: the vanity. There is no viewer count on a broadcast,
// because Brief records that a notification row was created for each follower —
// it has no read receipt and will not pretend otherwise. The rail therefore
// reports who it went to and how long it stays up, both of which are true.
//
// A broadcast with no followers is still posted and says so: "nobody follows
// this space yet, so nothing was sent" is more useful than a fake audience.
// ---------------------------------------------------------------------------

const KINDS: Array<{ id: SpaceBroadcast['kind']; label: string; hint: string }> = [
  { id: 'update', label: 'Update', hint: 'Anything worth knowing today' },
  { id: 'stock', label: 'Stock', hint: 'What is in, what is gone' },
  { id: 'hours', label: 'Hours', hint: 'Open late, closed for a funeral, no deliveries today' },
  { id: 'drop', label: 'Drop', hint: 'A limited thing at a time' }
];

const hoursLeft = (iso: string) => {
  const ms = Date.parse(iso) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 3600000));
};

export interface BroadcastRailProps {
  broadcasts: SpaceBroadcast[];
  pastCount?: number;
  canManage: boolean;
  followers: number;
  onPost?: (text: string, kind: SpaceBroadcast['kind']) => Promise<string | null | undefined> | void;
  onDelete?: (id: string) => void;
  busy?: boolean;
}

export function BroadcastRail({
  broadcasts,
  pastCount = 0,
  canManage,
  followers,
  onPost,
  onDelete,
  busy = false
}: BroadcastRailProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SpaceBroadcast['kind']>('update');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onPost) return;
    setError(null);
    const err = await onPost(text.trim(), kind);
    if (err) { setError(String(err)); return; }
    setText('');
    setOpen(false);
  };

  return (
    <section className="space-y-2" aria-label="Broadcasts to followers">
      <div className="flex items-center gap-2">
        <Radio className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
        <h3 className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
          Updates
        </h3>
        <span className="text-[10px] font-mono" style={{ color: 'var(--brief-muted)' }}>
          {broadcasts.length} live · {pastCount} gone
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto text-[11px] font-black cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            {open ? 'Close' : 'Post an update'}
          </button>
        )}
      </div>

      {broadcasts.length === 0 && !open ? (
        <p className="text-[11px]" style={{ color: 'var(--brief-muted)' }}>
          Nothing is up. An update stays on your front for 24 hours and reaches the {followers} follower
          {followers === 1 ? '' : 's'} who follow this space.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {broadcasts.map((b) => (
            <div
              key={b.id}
              className="shrink-0 w-[184px] rounded-2xl p-3 relative"
              style={{
                background: 'var(--color-paper)',
                border: '2px solid var(--color-primary)',
                boxShadow: 'inset 0 0 0 2px #fff'
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>
                {KINDS.find((k) => k.id === b.kind)?.label ?? 'Update'}
              </p>
              <p className="text-[12px] font-medium leading-snug mt-1" style={{ color: 'var(--brief-ink)' }}>
                {b.text}
              </p>
              <p className="text-[10px] font-mono mt-2 inline-flex items-center gap-1" style={{ color: 'var(--brief-muted)' }}>
                <Clock className="w-3 h-3" /> gone in {hoursLeft(b.expiresAt)}h
              </p>
              {canManage && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(b.id)}
                  aria-label={`Take down this update`}
                  className="absolute top-2 right-2 p-1 rounded-full cursor-pointer"
                  style={{ color: 'var(--color-quiet)', background: 'var(--color-paper)' }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={send} className="p-3 rounded-2xl space-y-2" style={{ background: 'var(--color-well)' }}>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                aria-pressed={kind === k.id}
                onClick={() => setKind(k.id)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer border"
                style={{
                  background: kind === k.id ? 'var(--color-primary)' : 'var(--color-paper)',
                  color: kind === k.id ? 'var(--accent-ink)' : 'var(--brief-muted)',
                  borderColor: kind === k.id ? 'transparent' : 'var(--brief-line)'
                }}
                title={k.hint}
              >
                {k.label}
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            maxLength={280}
            aria-label="Update for your followers"
            placeholder={KINDS.find((k) => k.id === kind)?.hint}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-[13px] border bg-[color:var(--color-paper)] resize-none"
            style={{ borderColor: 'var(--brief-line)', color: 'var(--brief-ink)' }}
          />
          {error && <p className="text-[11px] font-bold" role="alert" style={{ color: '#E53935' }}>{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="px-3.5 py-2 rounded-full text-[12px] font-black cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Send to {followers} follower{followers === 1 ? '' : 's'}
            </button>
            <p className="text-[10px]" style={{ color: 'var(--brief-muted)' }}>
              In-app only — Brief has no SMS or WhatsApp line for updates, and no read receipts, so opened-counts stay unknown.
            </p>
          </div>
        </form>
      )}
    </section>
  );
}

export default BroadcastRail;
