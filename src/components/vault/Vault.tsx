import React from 'react';
import * as briefApi from '../../api/briefApi';
import type { Vault as VaultType, Footstep, VaultRequest, ResolutionItem } from '../../api/types';

// ---------------------------------------------------------------------------
// THE VAULT — a persistent context layer
//
// A premium, restrained command surface over real-world activity. Not a chat,
// not a CRM, not an inbox: the Vault is the ROOM that people, channels,
// vendors, orders and payments all open into, and the timeline is its memory.
//
// Everything here is real: it calls the Vault API, renders the SERVER's scoped
// `role`, and never invents access, money or activity. If the backend says
// "not configured", this shows it rather than implying otherwise.
// ---------------------------------------------------------------------------

const TONE = {
  text: 'text-[#F2EFE7]',
  dim: 'text-[#9A9278]',
  faint: 'text-[#6F6A58]',
  accent: 'text-[#3E9A66]',
  gold: 'text-[#D9BB7D]',
  warn: 'text-[#C2A24A]',
  danger: 'text-[#BC5A44]'
};

const CATEGORY_TONE: Record<string, string> = {
  people: '#7FA98B',
  messages: '#8FAFC4',
  commerce: '#D9BB7D',
  payments: '#3E9A66',
  vendors: '#C2A24A',
  system: '#9A9278',
  decisions: '#BC5A44'
};

const CATEGORY_LABEL: Record<string, string> = {
  people: 'People', messages: 'Messages', commerce: 'Commerce',
  payments: 'Payments', vendors: 'Vendors', system: 'System', decisions: 'Decisions'
};

const FILTERS = ['All', 'People', 'Messages', 'Commerce', 'Payments', 'Vendors', 'System', 'Decisions'];

const money = (n: number) => `KSh ${n.toLocaleString()}`;

function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dayOf(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return 'TODAY';
  return d.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase();
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold border cursor-pointer transition ${
        active ? 'bg-[#3E9A66] text-[#191714] border-[#3E9A66]' : 'bg-[#28261F] text-[#7FA98B] border-[#3F5544]'
      }`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#211F1A] border border-[#3B372B] rounded-xl ${className}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// TIMELINE
// ---------------------------------------------------------------------------

function Timeline({ vaultId }: { vaultId: string }) {
  const [filter, setFilter] = React.useState('All');
  const [page, setPage] = React.useState<{ footsteps: Footstep[]; nextCursor: number | null }>({ footsteps: [], nextCursor: null });
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (category: string | undefined, cursor?: number) => {
    setStatus('loading');
    const res = await briefApi.getFootsteps(vaultId, category, cursor);
    if (res.ok) {
      setPage((p) => ({ footsteps: cursor ? [...p.footsteps, ...res.data.footsteps] : res.data.footsteps, nextCursor: res.data.nextCursor }));
      setStatus('ready');
    } else {
      setError(res.error); setStatus('error');
    }
  }, [vaultId]);

  React.useEffect(() => {
    void load(filter === 'All' ? undefined : filter.toLowerCase());
  }, [filter, load]);

  // Group by day, oldest first.
  const days: { day: string; items: Footstep[] }[] = [];
  for (const f of page.footsteps) {
    const day = dayOf(f.createdAt);
    const last = days[days.length - 1];
    if (last && last.day === day) last.items.push(f);
    else days.push({ day, items: [f] });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{f}</Chip>
        ))}
      </div>

      {status === 'loading' && page.footsteps.length === 0 && (
        <p className={`text-xs ${TONE.faint}`}>Loading timeline…</p>
      )}
      {status === 'error' && <p className={`text-xs ${TONE.danger}`}>{error}</p>}
      {status === 'ready' && page.footsteps.length === 0 && (
        <p className={`text-xs ${TONE.faint}`}>Nothing recorded yet.</p>
      )}

      {days.map((d) => (
        <div key={d.day} className="space-y-1">
          <p className="text-[9px] font-mono tracking-[0.2em] text-[#6F6A58] mt-3 mb-1">{d.day}</p>
          {d.items.map((f) => (
            <div key={f.id} className="flex items-start gap-2.5 py-1.5 border-b border-[#2A2821] last:border-0">
              <span
                className="mt-1.5 shrink-0 w-2 h-2 rounded-full"
                style={{ background: CATEGORY_TONE[f.category] ?? '#9A9278' }}
              />
              <div className="min-w-0">
                <p className="text-[11px] leading-snug text-[#F2EFE7]">{f.narrative}</p>
                <p className="text-[9px] font-mono text-[#6F6A58] mt-0.5">
                  {timeOf(f.createdAt)}
                  {f.channel && f.channel !== 'web' ? ` · via ${f.channel}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ))}

      {page.nextCursor !== null && (
        <button
          onClick={() => void load(filter === 'All' ? undefined : filter.toLowerCase(), page.nextCursor!)}
          className="w-full py-2 rounded-lg bg-[#28261F] text-[#7FA98B] text-[10px] font-extrabold border border-[#3F5544] cursor-pointer"
        >
          Load earlier
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOST PANEL (add participant, handoff, close)
// ---------------------------------------------------------------------------

function HostPanel({ vault, onChanged }: { vault: VaultType; onChanged: () => void }) {
  const [name, setName] = React.useState('');
  const [role, setRole] = React.useState('guest');
  const [handoff, setHandoff] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState('');

  const addParticipant = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const res = await briefApi.addVaultParticipant(vault.id, { role, name: name.trim() });
    setBusy(false);
    if (res.ok) { setName(''); onChanged(); }
  };

  const makeHandoff = async () => {
    const participant = vault.participants?.find((p) => p.role === 'guest');
    if (!participant) { setNote('Add a guest first.'); return; }
    setBusy(true);
    const res = await briefApi.createHandoff(vault.id, { participantId: participant.id, toChannel: 'web' });
    setBusy(false);
    if (res.ok) {
      const origin = window.location.origin;
      setHandoff(`${origin}/#/vault/${vault.slug}?token=${encodeURIComponent(res.data.token)}`);
    } else setNote(res.error);
  };

  return (
    <Card className="p-3 space-y-2">
      <p className="text-[11px] font-extrabold text-[#D9BB7D]">Host</p>

      <div className="flex gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          className="flex-1 min-w-0 bg-[#191714] border border-[#3F5544] rounded-lg px-2.5 py-1.5 text-xs text-[#F2EFE7] placeholder:text-[#6F6A58] outline-none focus:border-[#3E9A66]" />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          className="bg-[#191714] border border-[#3F5544] rounded-lg px-2 py-1.5 text-xs text-[#F2EFE7] outline-none">
          <option value="guest">Guest</option>
          <option value="vendor">Vendor</option>
          <option value="admin">Admin</option>
        </select>
        <button onClick={addParticipant} disabled={busy || !name.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-[#3E9A66] text-[#191714] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">
          Add
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={makeHandoff} disabled={busy}
          className="px-2.5 py-1.5 rounded-lg bg-[#2B2A22] text-[#7FA98B] text-[10px] font-extrabold border border-[#3F5544] cursor-pointer disabled:opacity-40">
          Continue elsewhere
        </button>
        <button onClick={async () => { await briefApi.closeVault(vault.id); onChanged(); }}
          className="px-2.5 py-1.5 rounded-lg bg-[#2E241E] text-[#CE8578] text-[10px] font-extrabold border border-[#382A22] cursor-pointer">
          Close vault
        </button>
      </div>

      {handoff && (
        <div className="bg-[#191714] border border-[#3B372B] rounded-lg p-2 space-y-1">
          <p className="text-[9px] font-mono text-[#6F6A58]">Handoff link (single-use):</p>
          <p className="text-[10px] text-[#7FA98B] break-all select-all">{handoff}</p>
        </div>
      )}
      {note && <p className="text-[10px] text-[#C2A24A]">{note}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// REQUESTS
// ---------------------------------------------------------------------------

function Requests({ vault, onChanged }: { vault: VaultType; onChanged: () => void }) {
  const requests = vault.requests ?? [];
  if (!requests.length) return null;

  return (
    <Card className="p-3 space-y-2">
      <p className="text-[11px] font-extrabold text-[#D9BB7D]">Requests</p>
      {requests.map((r: VaultRequest) => (
        <div key={r.id} className="bg-[#191714] border border-[#3B372B] rounded-lg p-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-[#F2EFE7] truncate">{r.description}</p>
            <p className="text-[9px] font-mono uppercase text-[#6F6A58] mt-0.5">{r.status}</p>
          </div>
          {vault.role === 'vendor' && (r.status === 'routed' || r.status === 'open') && (
            <button onClick={async () => { await briefApi.acceptVaultRequest(vault.id, r.id); onChanged(); }}
              className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#3E9A66] text-[#191714] text-[10px] font-extrabold cursor-pointer">
              Accept
            </button>
          )}
        </div>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// DETAIL
// ---------------------------------------------------------------------------

function VaultDetail({ vault, onBack, onChanged }: { vault: VaultType; onBack: () => void; onChanged: () => void }) {
  const [ask, setAsk] = React.useState('');
  const [request, setRequest] = React.useState('');

  const askQuestion = async () => {
    if (!ask.trim()) return;
    await briefApi.recordFootstep(vault.id, { kind: 'question_asked', narrative: ask.trim() });
    setAsk(''); onChanged();
  };

  const makeRequest = async () => {
    if (!request.trim()) return;
    await briefApi.createVaultRequest(vault.id, { description: request.trim(), kind: 'service' });
    setRequest(''); onChanged();
  };

  return (
    <div className="space-y-3">
      <button onClick={onBack} className="text-[10px] font-extrabold text-[#7FA98B] cursor-pointer">← Vaults</button>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-[#F2EFE7] leading-tight">{vault.title}</h2>
          <span className="shrink-0 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#2B2A22] text-[#7FA98B]">{vault.status}</span>
        </div>
        <p className={`text-[10px] ${TONE.faint} mt-0.5`}>{vault.type} · {vault.visibility}</p>
        {vault.description && <p className={`text-xs ${TONE.dim} mt-1`}>{vault.description}</p>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Stat label="People" value={String(vault.metrics.participantCount)} />
        <Stat label="Requests" value={String(vault.metrics.requestCount)} />
        <Stat label="Pending" value={vault.metrics.pendingKes > 0 ? money(vault.metrics.pendingKes) : '—'} accent={vault.metrics.pendingKes > 0} />
      </div>

      <Timeline vaultId={vault.id} />

      {vault.role !== 'vendor' && (
        <Card className="p-3 space-y-2">
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask a question…"
            className="w-full bg-[#191714] border border-[#3F5544] rounded-lg px-3 py-2 text-xs text-[#F2EFE7] placeholder:text-[#6F6A58] outline-none focus:border-[#3E9A66]" />
          <button onClick={askQuestion} disabled={!ask.trim()}
            className="w-full py-2 rounded-lg bg-[#2B2A22] text-[#7FA98B] text-[10px] font-extrabold border border-[#3F5544] cursor-pointer disabled:opacity-40">
            Ask
          </button>
        </Card>
      )}

      {vault.role !== 'vendor' && (
        <Card className="p-3 space-y-2">
          <input value={request} onChange={(e) => setRequest(e.target.value)} placeholder="Request something (e.g. extra chairs)…"
            className="w-full bg-[#191714] border border-[#3F5544] rounded-lg px-3 py-2 text-xs text-[#F2EFE7] placeholder:text-[#6F6A58] outline-none focus:border-[#3E9A66]" />
          <button onClick={makeRequest} disabled={!request.trim()}
            className="w-full py-2 rounded-lg bg-[#2B2A22] text-[#7FA98B] text-[10px] font-extrabold border border-[#3F5544] cursor-pointer disabled:opacity-40">
            Request
          </button>
        </Card>
      )}

      <Requests vault={vault} onChanged={onChanged} />

      {(vault.role === 'host' || vault.role === 'admin') && <HostPanel vault={vault} onChanged={onChanged} />}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-[#211F1A] border border-[#3B372B] rounded-lg px-3 py-2">
      <p className="text-[9px] font-mono uppercase tracking-wider text-[#6F6A58]">{label}</p>
      <p className={`text-sm font-extrabold ${accent ? 'text-[#3E9A66]' : 'text-[#F2EFE7]'}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HOME (command surface)
// ---------------------------------------------------------------------------

function VaultHome({ onOpen, refreshKey }: { onOpen: (v: VaultType) => void; refreshKey: number }) {
  const [vaults, setVaults] = React.useState<VaultType[]>([]);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [creating, setCreating] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState('gathering');
  const [visibility, setVisibility] = React.useState('private');
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<{ vaultId: string; title: string; matches: { snippet: string }[] }[]>([]);
  const [resolution, setResolution] = React.useState<ResolutionItem[]>([]);

  const load = React.useCallback(async () => {
    setStatus('loading');
    const [v, r] = await Promise.all([briefApi.listVaults(), briefApi.getResolution()]);
    if (v.ok) { setVaults(v.data); setStatus('ready'); } else setStatus('error');
    if (r.ok) setResolution(r.data);
  }, []);

  React.useEffect(() => { void load(); }, [load, refreshKey]);

  const create = async () => {
    if (!title.trim()) return;
    const res = await briefApi.createVault({ title: title.trim(), type: type as any, visibility: visibility as any });
    if (res.ok) { setTitle(''); setCreating(false); void load(); }
  };

  const search = async (query: string) => {
    setQ(query);
    if (!query.trim()) { setResults([]); return; }
    const res = await briefApi.searchVaults(query);
    if (res.ok) setResults(res.data);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#F2EFE7]">The Vault</h2>
        <button onClick={() => setCreating((c) => !c)}
          className="px-3 py-1.5 rounded-full bg-[#3E9A66] text-[#191714] text-[10px] font-extrabold cursor-pointer">
          + New vault
        </button>
      </div>

      {creating && (
        <Card className="p-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is this activity?"
            className="w-full bg-[#191714] border border-[#3F5544] rounded-lg px-3 py-2 text-xs text-[#F2EFE7] placeholder:text-[#6F6A58] outline-none focus:border-[#3E9A66]" />
          <div className="flex gap-1.5">
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="flex-1 bg-[#191714] border border-[#3F5544] rounded-lg px-2 py-1.5 text-xs text-[#F2EFE7] outline-none">
              <option value="gathering">Gathering</option>
              <option value="event">Event</option>
              <option value="marketplace">Market</option>
              <option value="campaign">Campaign</option>
              <option value="service">Service</option>
              <option value="deal">Deal</option>
            </select>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
              className="flex-1 bg-[#191714] border border-[#3F5544] rounded-lg px-2 py-1.5 text-xs text-[#F2EFE7] outline-none">
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="invite_only">Invite only</option>
              <option value="token_access">Token</option>
            </select>
          </div>
          <button onClick={create} disabled={!title.trim()}
            className="w-full py-2 rounded-lg bg-[#3E9A66] text-[#191714] text-[10px] font-extrabold cursor-pointer disabled:opacity-40">
            Create
          </button>
        </Card>
      )}

      <div className="relative">
        <input value={q} onChange={(e) => void search(e.target.value)} placeholder="Search people, requests, payments…"
          className="w-full bg-[#211F1A] border border-[#3B372B] rounded-xl px-3 py-2.5 text-xs text-[#F2EFE7] placeholder:text-[#6F6A58] outline-none focus:border-[#3E9A66]" />
      </div>
      {results.length > 0 && (
        <Card className="p-3 space-y-1.5">
          {results.map((r) => (
            <button key={r.vaultId} onClick={() => { const v = vaults.find((x) => x.id === r.vaultId); if (v) onOpen(v); }}
              className="w-full text-left bg-[#191714] border border-[#3B372B] rounded-lg p-2.5 cursor-pointer">
              <p className="text-xs font-extrabold text-[#F2EFE7]">{r.title}</p>
              <p className="text-[9px] text-[#6F6A58] truncate">{r.matches.map((m) => m.snippet).join(' · ')}</p>
            </button>
          ))}
        </Card>
      )}

      {resolution.length > 0 && (
        <Card className="p-3 space-y-1.5">
          <p className="text-[11px] font-extrabold text-[#C2A24A]">Needs attention</p>
          {resolution.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-[#F2EFE7] truncate">{r.vaultTitle} · {r.description ?? r.kind}</p>
            </div>
          ))}
        </Card>
      )}

      {status === 'loading' && <p className="text-xs text-[#9A9278]">Loading…</p>}
      {status === 'error' && <p className="text-xs text-[#BC5A44]">Could not load vaults.</p>}
      {status === 'ready' && vaults.length === 0 && (
        <p className="text-xs text-[#9A9278]">No vaults yet. A vault wraps a real activity — a gathering, a market, a deal.</p>
      )}

      {vaults.filter((v) => v.status !== 'closed' && v.status !== 'archived').map((v) => (
        <button key={v.id} onClick={() => onOpen(v)} className="w-full text-left">
          <Card className="p-3 hover:border-[#3F5544] transition">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[#F2EFE7] truncate">{v.title}</p>
                <p className="text-[9px] font-mono uppercase tracking-wider text-[#6F6A58] mt-0.5">{v.type} · {v.role}</p>
              </div>
              <span className={`shrink-0 text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${
                v.status === 'settled' ? 'bg-[#2B2A22] text-[#3E9A66]' : 'bg-[#252C31] text-[#8FAFC4]'
              }`}>{v.status}</span>
            </div>
            <div className="flex gap-3 mt-2 text-[10px] text-[#9A9278]">
              <span>{v.metrics.participantCount} people</span>
              {v.metrics.requestCount > 0 && <span>{v.metrics.requestCount} requests</span>}
              {v.metrics.pendingKes > 0 && <span className="text-[#D9BB7D]">{money(v.metrics.pendingKes)} pending</span>}
            </div>
          </Card>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ROOT
// ---------------------------------------------------------------------------

export function Vault() {
  const [selected, setSelected] = React.useState<VaultType | null>(null);
  const [version, setVersion] = React.useState(0);

  const refresh = React.useCallback(() => setVersion((n) => n + 1), []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-4">
      {selected ? (
        <VaultDetail
          vault={selected}
          onBack={() => setSelected(null)}
          onChanged={() => { setVersion((n) => n + 1); }}
        />
      ) : (
        <VaultHome onOpen={setSelected} refreshKey={version} />
      )}
    </div>
  );
}

export default Vault;
