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

function Notice({ message }: { message: string | null }) {
  return message ? <p className="text-[11px]" style={{ color: T.onSurfaceVariant }}>{message}</p> : null;
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

// --- Creator profile + rate cards --------------------------------------------

export function CreatorProfilePanel() {
  const [profile, setProfile] = React.useState<any | null>(null);
  const [cards, setCards] = React.useState<any[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');
  const [message, setMessage] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ fullName: '', preferredLanguage: 'en', regions: 'KE', nicheTags: '', instagram: '', facebook: '', tiktok: '' });
  const [card, setCard] = React.useState({ serviceType: 'WHATSAPP_STATUS', basePrice: '', currency: 'KES', regions: 'KE' });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [profileResult, cardsResult] = await Promise.all([briefApi.getCreatorProfile(), briefApi.getCreatorRateCards()]);
    if (profileResult.ok) {
      const p = profileResult.data;
      setProfile(p);
      setForm({
        fullName: p.fullName ?? '',
        preferredLanguage: p.preferredLanguage ?? 'en',
        regions: (p.regions ?? []).join(', '),
        nicheTags: (p.nicheTags ?? []).join(', '),
        instagram: p.externalSocialLinks?.instagram ?? '',
        facebook: p.externalSocialLinks?.facebook ?? '',
        tiktok: p.externalSocialLinks?.tiktok ?? ''
      });
    }
    if (cardsResult.ok) setCards(cardsResult.data);
    setState('ready');
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const saveProfile = async () => {
    setBusy(true);
    const links = Object.fromEntries([['instagram', form.instagram], ['facebook', form.facebook], ['tiktok', form.tiktok]].filter(([, value]) => value.trim()));
    const result = await briefApi.updateCreatorProfile({
      fullName: form.fullName,
      preferredLanguage: form.preferredLanguage,
      regions: form.regions.split(',').map((x) => x.trim()).filter(Boolean),
      nicheTags: form.nicheTags.split(',').map((x) => x.trim()).filter(Boolean),
      externalSocialLinks: links,
      status: 'active'
    });
    setBusy(false);
    setMessage(result.ok ? 'Profile saved.' : result.error);
    if (result.ok) await load();
  };

  const createCard = async () => {
    setBusy(true);
    const result = await briefApi.createCreatorRateCard({
      serviceType: card.serviceType,
      basePrice: Number(card.basePrice),
      currency: card.currency,
      regions: card.regions.split(',').map((x) => x.trim()).filter(Boolean)
    });
    setBusy(false);
    setMessage(result.ok ? 'Rate card saved as draft.' : result.error);
    if (result.ok) { setCard((old) => ({ ...old, basePrice: '' })); await load(); }
  };

  const publishCard = async (id: string) => {
    setBusy(true);
    const result = await briefApi.updateCreatorRateCard(id, { status: 'published' });
    setBusy(false);
    setMessage(result.ok ? 'Rate card published.' : result.error);
    await load();
  };

  const input = (label: string, key: keyof typeof form, placeholder = '') => (
    <label className="block space-y-1">
      <span className="text-[10px]" style={{ color: T.onSurfaceVariant }}>{label}</span>
      <input value={form[key]} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))} placeholder={placeholder} className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} />
    </label>
  );

  return (
    <Shell icon={Briefcase} title="Creator profile">
      {state === 'loading' ? <Empty text="Loading…" /> : (
        <>
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
            {input('Name', 'fullName', 'Your public name')}
            <div className="grid grid-cols-2 gap-2">{input('Regions', 'regions', 'KE, NG')}{input('Niches', 'nicheTags', 'events, fashion')}</div>
            <div className="grid gap-2 sm:grid-cols-3">{input('Instagram', 'instagram', 'https://instagram.com/...')}{input('Facebook', 'facebook', 'https://facebook.com/...')}{input('TikTok', 'tiktok', 'https://tiktok.com/@...')}</div>
            <button type="button" disabled={busy || !form.fullName.trim()} onClick={() => void saveProfile()} className="rounded-full px-4 py-2 text-[11px] font-bold cursor-pointer disabled:opacity-40" style={{ background: T.primary, color: '#FFFFFF' }}>Save profile</button>
          </div>

          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: T.primary }}>Rate cards</p>
            <div className="grid gap-2 sm:grid-cols-2"><select value={card.serviceType} onChange={(e) => setCard((old) => ({ ...old, serviceType: e.target.value }))} className="rounded-lg border px-2 py-2 text-[12px]" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }}><option value="WHATSAPP_STATUS">WhatsApp Status</option><option value="FB_POST">Facebook post</option><option value="DEDICATED_CAMPAIGN">Dedicated campaign</option><option value="EVENT_APPEARANCE">Event appearance</option></select><input value={card.basePrice} onChange={(e) => setCard((old) => ({ ...old, basePrice: e.target.value }))} placeholder="Base price" type="number" className="rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} /></div>
            <div className="flex gap-2"><select value={card.currency} onChange={(e) => setCard((old) => ({ ...old, currency: e.target.value }))} className="rounded-lg border px-2 py-2 text-[12px]" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }}><option>KES</option><option>NGN</option><option>ZAR</option><option>USD</option></select><input value={card.regions} onChange={(e) => setCard((old) => ({ ...old, regions: e.target.value }))} placeholder="Regions" className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} /><button type="button" disabled={busy || !card.basePrice} onClick={() => void createCard()} className="rounded-lg px-3 py-2 text-[11px] font-bold cursor-pointer disabled:opacity-40" style={{ background: T.primary, color: '#FFFFFF' }}><Plus className="h-3.5 w-3.5" /></button></div>
            {cards.length === 0 ? <Empty text="No rate cards yet." /> : <div className="space-y-2">{cards.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border p-2" style={{ borderColor: T.outlineVariant }}><div className="min-w-0"><p className="text-[12px] font-semibold truncate" style={{ color: T.onSurface }}>{item.serviceType}</p><p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>{item.currency} {Number(item.basePrice).toLocaleString()} · {item.status}</p></div>{item.status === 'draft' && <button type="button" disabled={busy} onClick={() => void publishCard(item.id)} className="text-[10px] font-bold cursor-pointer" style={{ color: T.primary }}>Publish</button>}</div>)}</div>}
          </div>
        </>
      )}
      <Notice message={message} />
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
                  <button onClick={() => void respond(o.id, 'accept')} className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold cursor-pointer" style={{ background: T.primary, color: '#FFFFFF' }}>
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
//
// TWO HALVES OF ONE LOOP.
//
// A creator could publish a plan and even record a billing cycle for
// themselves, but nobody could ever JOIN one: there was no subscribe call, so
// a supporter reading a plan had nothing to press. This panel now holds both
// sides -- the plans I publish, and the plans I can join -- because a
// membership with only one half is not a membership, it is a form.
//
// Money is never implied: a join records the cycle as a ledger transaction and
// says plainly that nothing has been charged, because no payment provider is
// connected.

export function SubscriptionsPanel() {
  const [mode, setMode] = React.useState<'mine' | 'join'>('mine');

  const [subs, setSubs] = React.useState<any[]>([]);
  const [state, setState] = React.useState<'loading' | 'ready'>('loading');
  const [title, setTitle] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [interval, setInterval] = React.useState('monthly');
  const [busy, setBusy] = React.useState(false);

  // The plans I can join, and the state of each join while it happens.
  const [publicPlans, setPublicPlans] = React.useState<any[]>([]);
  const [publicState, setPublicState] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [publicError, setPublicError] = React.useState<string | null>(null);
  const [joining, setJoining] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const res = await briefApi.getMySubscriptions();
    if (res.ok) setSubs(res.data as any[]);
    setState('ready');
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const browse = React.useCallback(async () => {
    setPublicState('loading');
    setPublicError(null);
    const res = await briefApi.browseSubscriptions();
    if (!res.ok) {
      setPublicState('error');
      setPublicError(res.error ?? 'could not read the plans');
      return;
    }
    setPublicPlans(res.data as any[]);
    setPublicState('ready');
  }, []);

  React.useEffect(() => {
    if (mode === 'join' && publicState === 'idle') void browse();
  }, [mode, publicState, browse]);

  const create = async () => {
    if (!title.trim() || !price) return;
    setBusy(true);
    const res = await briefApi.createSubscription({ title, price: Number(price), interval });
    setBusy(false);
    if (!res.ok) { setNotice(res.error ?? 'could not create this plan'); return; }
    setTitle(''); setPrice('');
    setNotice('Plan published. Supporters can join it from the Join tab.');
    await load();
  };

  const act = async (id: string, action: string) => { await briefApi.subscriptionAction(id, action); await load(); };

  /**
   * Join a plan. The server answers with `charged: false` while no provider is
   * connected, and the panel repeats that rather than congratulating somebody
   * for a payment that did not happen.
   */
  const join = async (id: string) => {
    setJoining(id);
    setNotice(null);
    const res = await briefApi.subscribeToPlan(id);
    setJoining(null);
    if (!res.ok) { setNotice(res.error ?? 'could not join this plan'); return; }
    setNotice(res.data.duplicate ? 'You are already a member of this plan.' : res.data.note);
    await browse();
    await load();
  };

  const leave = async (id: string) => {
    setJoining(id);
    setNotice(null);
    const res = await briefApi.unsubscribeFromPlan(id);
    setJoining(null);
    if (!res.ok) { setNotice(res.error ?? 'could not leave this plan'); return; }
    setNotice(res.data.changed ? 'You have left this plan.' : 'You were not a member of this plan.');
    await browse();
    await load();
  };

  return (
    <Shell icon={Repeat} title="Subscriptions">
      <div className="flex gap-1.5">
        <button
          onClick={() => setMode('mine')}
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer"
          style={{
            background: mode === 'mine' ? T.primary : T.container,
            color: mode === 'mine' ? '#FFFFFF' : T.onSurfaceVariant,
            border: `1px solid ${T.outlineVariant}`
          }}
        >
          Plans I offer
        </button>
        <button
          onClick={() => setMode('join')}
          className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer"
          style={{
            background: mode === 'join' ? T.primary : T.container,
            color: mode === 'join' ? '#FFFFFF' : T.onSurfaceVariant,
            border: `1px solid ${T.outlineVariant}`
          }}
        >
          Plans I can join
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
          <p className="text-[11px]" style={{ color: T.onSurface }}>{notice}</p>
        </div>
      )}

      {mode === 'mine' && (
        <>
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (e.g. Trail Club)" className="flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} />
            <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))} placeholder="KES" className="w-24 rounded-lg border px-3 py-2 text-[12px] outline-none" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }} />
            <select value={interval} onChange={(e) => setInterval(e.target.value)} className="rounded-lg border px-2 py-2 text-[12px]" style={{ borderColor: T.outlineVariant, background: T.container, color: T.onSurface }}>
              <option value="weekly">weekly</option><option value="monthly">monthly</option><option value="yearly">yearly</option>
            </select>
            <button onClick={() => void create()} disabled={busy || !title.trim() || !price} className="rounded-lg px-3 py-2 text-[12px] font-bold cursor-pointer disabled:opacity-40" style={{ background: T.primary, color: '#FFFFFF' }}>
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
                    <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>
                      {s.currency} {s.price} · {s.interval} · {s.status}
                    </p>
                    {/* Derived, not stored: it cannot disagree with the rows. */}
                    <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>
                      {s.subscriberCount} {s.subscriberCount === 1 ? 'member' : 'members'} · {s.settledCycles} settled {s.settledCycles === 1 ? 'cycle' : 'cycles'}
                    </p>
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
        </>
      )}

      {mode === 'join' && (
        <>
          {publicState === 'loading' && <Empty text="Looking for plans…" />}

          {publicState === 'error' && (
            <div className="rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
              <p className="text-[11px]" style={{ color: T.onSurface }}>Could not read public plans. {publicError}</p>
              <button onClick={() => void browse()} className="mt-2 text-[10px] font-bold cursor-pointer" style={{ color: T.primary }}>Try again</button>
            </div>
          )}

          {publicState === 'ready' && publicPlans.length === 0 && (
            <Empty text="No public plans from other creators yet." />
          )}

          <div className="space-y-2">
            {publicPlans.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border p-3" style={{ borderColor: T.outlineVariant, background: T.container }}>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: T.onSurface }}>{s.title}</p>
                  <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>
                    {s.currency} {s.price} · {s.interval} · {s.subscriberCount} {s.subscriberCount === 1 ? 'member' : 'members'}
                  </p>
                </div>
                {s.viewerIsSubscriber ? (
                  <button
                    onClick={() => void leave(s.id)}
                    disabled={joining === s.id}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                    style={{ color: T.onSurfaceVariant, border: `1px solid ${T.outlineVariant}` }}
                  >
                    {joining === s.id ? 'Leaving…' : 'Subscribed — leave'}
                  </button>
                ) : (
                  <button
                    onClick={() => void join(s.id)}
                    disabled={joining === s.id}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                    style={{ background: T.primary, color: '#FFFFFF' }}
                  >
                    {joining === s.id ? 'Joining…' : 'Join'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="text-[10px]" style={{ color: T.onSurfaceVariant }}>
            No payment provider is connected, so joining records the membership and
            the cycle without charging anything. Nothing is owed until a real
            payment exists.
          </p>
        </>
      )}
    </Shell>
  );
}

