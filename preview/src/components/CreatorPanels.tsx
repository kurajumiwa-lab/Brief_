import React from 'react';
import { Briefcase, MessageCircle, Repeat, Star, Plus, Check, X } from 'lucide-react';
import * as briefApi from '../api/briefApi';

// ---------------------------------------------------------------------------
// CREATOR PANELS — the Saved screen as a dynamic creator workspace.
//
// These four panels give the already-built backend features a home in the
// EXISTING Saved (MyLayer) screen, in the same card language the rest of the
// screen already uses. Nothing here invents data: every figure comes from the
// real routes built earlier (media kit, partnership, unified inbox,
// subscriptions).
// ---------------------------------------------------------------------------

const T = {
  container: 'var(--m3-surface-container)',
  primary: 'var(--m3-primary)',
  onSurface: 'var(--m3-on-surface)',
  onSurfaceVariant: 'var(--m3-on-surface-variant)',
  outline: 'var(--m3-outline)',
  outlineVariant: 'var(--m3-outline-variant)'
};

function Shell({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" style={{ color: T.primary }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T.primary }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[12px]" style={{ color: T.onSurfaceVariant }}>{text}</p>;
}

// --- Media kit ---------------------------------------------------------------

export function MediaKitPanel() {
  const [kit, setKit] = React.useState<any | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');

  React.useEffect(() => {
    let live = true;
    (async () => {
      const res = await briefApi.getMyMediaKit();
      if (!live) return;
      setKit(res.ok ? res.data : null);
      setState('ready');
    })();
    return () => { live = false; };
  }, []);

  return (
    <Shell icon={Briefcase} title="Media Kit">
      {state === 'loading' ? <Empty text="Loading…" /> : !kit ? (
        <Empty text="No media kit yet — create a vendor profile to generate one." />
      ) : (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: T.outlineVariant, background: T.container }}>
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-bold" style={{ color: T.onSurface }}>{kit.displayName}</p>
            <span className="text-[10px]" style={{ color: T.onSurfaceVariant }}>{kit.contactMethod ?? ''}</span>
          </div>
          {kit.description && <p className="text-[12px]" style={{ color: T.onSurfaceVariant }}>{kit.description}</p>}

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              ['Published', kit.audience.publishedObjects],
              ['Views', kit.audience.views],
              ['Saves', kit.audience.saves]
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-lg border p-2 text-center" style={{ borderColor: T.outlineVariant }}>
                <p className="text-[16px] font-bold" style={{ color: T.onSurface }}>{n}</p>
                <p className="text-[9px]" style={{ color: T.onSurfaceVariant }}>{label}</p>
              </div>
            ))}
          </div>

          {kit.interests.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {kit.interests.map((i: string) => (
                <span key={i} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ borderColor: T.outlineVariant, color: T.onSurfaceVariant }}>{i}</span>
              ))}
            </div>
          )}
          <p className="text-[9px]" style={{ color: T.outline }}>{kit.note}</p>
        </div>
      )}
    </Shell>
  );
}

// --- Opportunities ------------------------------------------------------------

export function OpportunitiesPanel() {
  const [opps, setOpps] = React.useState<any[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');

  const load = React.useCallback(async () => {
    const res = await briefApi.getOpportunities();
    if (res.ok) setOpps(res.data as any[]);
    setState('ready');
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const respond = async (id: string, action: string) => { await briefApi.respondOpportunity(id, action); await load(); };

  return (
    <Shell icon={Star} title="Opportunities">
      {state === 'loading' ? <Empty text="Loading…" /> : opps.length === 0 ? (
        <Empty text="No partnership offers yet. Brands send them from their side." />
      ) : (
        <div className="space-y-2">
          {opps.map((o) => (
            <div key={o.id} className="rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: T.onSurface }}>{o.title}</p>
                  {o.budget && <p className="text-[11px]" style={{ color: T.primary }}>{o.currency} {o.budget.toLocaleString()}</p>}
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: T.onSurfaceVariant, border: `1px solid ${T.outlineVariant}` }}>{o.status}</span>
              </div>
              {o.status === 'pending' && (
                <div className="mt-2 flex gap-1">
                  <button onClick={() => void respond(o.id, 'accept')} className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold cursor-pointer" style={{ background: T.primary, color: '#003824' }}>
                    <Check className="h-3 w-3" /> Accept
                  </button>
                  <button onClick={() => void respond(o.id, 'decline')} className="flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold cursor-pointer" style={{ borderColor: T.outlineVariant, color: T.onSurfaceVariant }}>
                    <X className="h-3 w-3" /> Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// --- Unified inbox -------------------------------------------------------------

export function MessagesPanel() {
  const [contacts, setContacts] = React.useState<any[]>([]);
  const [thread, setThread] = React.useState<{ key: string; messages: any[] } | null>(null);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');

  const load = React.useCallback(async () => {
    const res = await briefApi.getInboxContacts();
    if (res.ok) setContacts(res.data as any[]);
    setState('ready');
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const open = async (c: any) => {
    const res = await briefApi.getInboxThread(c.key);
    setThread({ key: c.key, messages: res.ok ? (res.data as any[]) : [] });
  };

  return (
    <Shell icon={MessageCircle} title="Messages">
      {state === 'loading' ? <Empty text="Loading…" /> : contacts.length === 0 ? (
        <Empty text="No conversations yet. Messages from Telegram/WhatsApp appear here." />
      ) : thread ? (
        <div className="space-y-2">
          <button onClick={() => setThread(null)} className="text-[11px] font-bold cursor-pointer" style={{ color: T.primary }}>← All conversations</button>
          {thread.messages.length === 0 ? <Empty text="No messages in this thread yet." /> : thread.messages.map((m) => (
            <div key={m.id} className="rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase" style={{ color: m.direction === 'inbound' ? T.primary : T.outline }}>{m.direction}</span>
                <span className="text-[9px]" style={{ color: T.outline }}>{m.at ? new Date(m.at).toLocaleString() : ''}</span>
              </div>
              <p className="mt-1 text-[12px]" style={{ color: T.onSurface }}>{m.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {contacts.map((c) => (
            <button key={c.key} onClick={() => void open(c)} className="w-full rounded-xl border p-3 text-left cursor-pointer transition-colors hover:border-[var(--m3-primary)]" style={{ borderColor: T.outlineVariant, background: T.container }}>
              <p className="text-[13px] font-semibold" style={{ color: T.onSurface }}>{c.name}</p>
              <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>{c.inboundCount} inbound · {c.lastAt ? new Date(c.lastAt).toLocaleDateString() : ''}</p>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// --- Subscriptions --------------------------------------------------------------

export function SubscriptionsPanel() {
  const [subs, setSubs] = React.useState<any[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');
  const [title, setTitle] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [interval, setInterval] = React.useState('monthly');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await briefApi.getSubscriptions();
    if (res.ok) setSubs(res.data as any[]);
    setState('ready');
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!title.trim() || !price) return;
    setBusy(true);
    await briefApi.createSubscription({ title, price: Number(price), interval });
    setBusy(false);
    setTitle(''); setPrice('');
    await load();
  };

  const act = async (id: string, action: string) => { await briefApi.subscriptionAction(id, action); await load(); };

  return (
    <Shell icon={Repeat} title="Subscriptions">
      <div className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (e.g. Trail Club)" className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} />
        <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="KES" className="w-24 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} />
        <select value={interval} onChange={(e) => setInterval(e.target.value)} className="rounded-lg border px-2 py-2 text-[12px]" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }}>
          <option value="weekly">weekly</option><option value="monthly">monthly</option><option value="yearly">yearly</option>
        </select>
        <button onClick={() => void create()} disabled={busy || !title.trim() || !price} className="rounded-lg px-3 py-2 text-[12px] font-bold cursor-pointer disabled:opacity-40" style={{ background: T.primary, color: '#003824' }}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {state === 'loading' ? <Empty text="Loading…" /> : subs.length === 0 ? (
        <Empty text="No memberships yet. Create one to offer recurring access." />
      ) : (
        <div className="space-y-2">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: T.onSurface }}>{s.title}</p>
                <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>{s.currency} {s.price} · {s.interval} · {s.status}</p>
              </div>
              <div className="flex gap-1">
                {s.status === 'active' && <button onClick={() => void act(s.id, 'pause')} className="text-[10px] font-bold cursor-pointer" style={{ color: T.primary }}>Pause</button>}
                {s.status === 'paused' && <button onClick={() => void act(s.id, 'resume')} className="text-[10px] font-bold cursor-pointer" style={{ color: T.primary }}>Resume</button>}
                {s.status !== 'cancelled' && <button onClick={() => void act(s.id, 'cancel')} className="text-[10px] font-bold cursor-pointer" style={{ color: T.onSurfaceVariant }}>Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
