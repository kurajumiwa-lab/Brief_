import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import * as api from '../api/briefApi';
const Banking = lazy(() => import('../features/you/TableBankingSurface').then(m => ({ default: m.TableBankingSurface })));
const LABELS: Record<string, string> = { table_banking: 'Table banking', group_buy: 'Group buy', events: 'Events' };
const key = () => globalThis.crypto?.randomUUID?.() ?? `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const button = 'px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold disabled:opacity-40';

export function GroupWorkspaces({ groupId }: { groupId: string }) {
  const [data, setData] = useState<{purposes: string[]; canCreate: boolean; workspaces: api.PurposeWorkspace[]} | null>(null);
  const [open, setOpen] = useState<api.PurposeWorkspace | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [admissions, setAdmissions] = useState<Array<{id: string; handle: string}>>([]);
  const [admissionReason, setAdmissionReason] = useState('');
  const [name, setName] = useState('');
  const requestId = useRef(key());
  const load = async () => {
    const r = await api.getGroupWorkspaces(groupId);
    if (r.ok) { setData(r.data); setPurpose(p => p || r.data.purposes[0] || ''); if (r.data.canCreate) { const a = await api.groupAdmissions(groupId); if (a.ok) setAdmissions(a.data); else setError(a.error); } }
    else setError(r.error);
  };
  useEffect(() => { setOpen(null); setData(null); setError(''); void load(); }, [groupId]);
  const show = async (id: string) => { setBusy(true); setError(''); const r = await api.getPurposeWorkspace(id); setBusy(false); if (r.ok) setOpen(r.data); else setError(r.error); };
  if (open) return <PurposeWorkspaceView workspace={open} onUpdate={setOpen} onBack={() => { setOpen(null); void load(); }} />;
  return <section aria-label="Purpose workspaces" className="space-y-4">
    <h3 className="text-xl font-bold">Workspaces</h3>
    <p className="text-sm">Group membership opens this room, not its ledgers or organizer controls. Request participation separately. No money moves through these setup actions.</p>
    {error && <p role="alert">{error} <button onClick={load}>Retry</button></p>}
    {!data && !error && <p role="status">Loading workspaces…</p>}
    {admissions.length > 0 && <section aria-label="Group membership requests" className="p-4 rounded-xl bg-[var(--color-paper)] space-y-3"><h4 className="font-bold">Group membership requests</h4><p className="text-sm">Admission opens the group, not its financial workspaces.</p><input aria-label="Group admission reason" placeholder="Decision reason" value={admissionReason} onChange={e => setAdmissionReason(e.target.value)} className="block p-2 rounded-xl w-full" />{admissions.map(a => <div key={a.id} className="flex gap-2 items-center"><span>@{a.handle}</span>{[true, false].map(approve => <button className={button} key={String(approve)} disabled={busy || !admissionReason.trim()} onClick={async () => { setBusy(true); const result = await api.decideGroupAdmission(groupId, a.id, approve, admissionReason); setBusy(false); if (result.ok) await load(); else setError(result.error); }}>{approve ? 'Admit to group' : 'Decline'}</button>)}</div>)}</section>}
    {data?.workspaces.map(w => <button key={w.id} className="block w-full text-left p-4 rounded-2xl bg-[var(--color-paper)]" disabled={busy} onClick={() => void show(w.id)}><strong>{w.name}</strong><span className="block text-sm">{LABELS[w.purpose]} · {w.state.replace(/_/g, ' ')} · {w.owner ? 'Workspace owner' : w.participation === 'active' ? 'Participant' : 'Separate participation required'}</span></button>)}
    {data && !data.workspaces.length && <p>No workspace yet. Purpose selection enables setup; it does not create accounts or enroll members.</p>}
    {data?.canCreate && data.purposes.length > 0 && <form className="space-y-3 p-4 rounded-2xl bg-[var(--color-paper)]" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      const r = await api.createGroupWorkspace(groupId, { purpose, name, requestId: requestId.current });
      setBusy(false); if (r.ok) { requestId.current = key(); setName(''); setOpen(r.data); } else setError(r.error);
    }}>
      <h4 className="font-bold">Set up a workspace</h4>
      <label className="block">Purpose<select aria-label="Workspace purpose" value={purpose} onChange={e => { setPurpose(e.target.value); requestId.current = key(); }} className="block w-full p-2 rounded-xl">{data.purposes.map(p => <option key={p} value={p}>{LABELS[p]}</option>)}</select></label>
      <label className="block">Workspace name<input required maxLength={120} aria-label="Workspace name" value={name} onChange={e => setName(e.target.value)} className="block w-full p-2 rounded-xl" /></label>
      <p className="text-sm">You will own this workspace. Group coordinators and shop staff do not become treasurers or event organizers automatically.</p>
      <button className={button} disabled={busy || !name.trim()}>Create private setup</button>
    </form>}
    {data && !data.purposes.length && <p>Enable table banking, group buys or events in the coordinator’s purpose settings to set up the corresponding workspace.</p>}
  </section>;
}

function PurposeWorkspaceView({ workspace: w, onUpdate, onBack }: { workspace: api.PurposeWorkspace; onUpdate: (w: api.PurposeWorkspace) => void; onBack: () => void }) {
  const [config, setConfig] = useState<Record<string, string | number>>(w.config ?? {});
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const contributionKey = useRef(key());
  const cmd = async (command: Parameters<typeof api.workspaceCommand>[1], body: Record<string, unknown> = {}) => {
    setBusy(true); setError('');
    const r = await api.workspaceCommand(w.id, command, body);
    setBusy(false);
    if (r.ok) { onUpdate(r.data); if (body.action === 'contribute') { contributionKey.current = key(); setAmount(''); } }
    else setError(r.error);
  };
  const fields = w.purpose === 'table_banking' ? [['contributionAmount', 'Contribution per cycle (KES)', 'number'], ['cycleDays', 'Cycle length (days)', 'number']] : w.purpose === 'group_buy' ? [['targetAmount', 'Recorded contribution target (KES)', 'number']] : [['description', 'Description', 'text'], ['location', 'Location', 'text'], ['startsAt', 'Starts at (your local time)', 'datetime-local'], ['endsAt', 'Ends at (your local time)', 'datetime-local'], ['price', 'Ticket price (KES, 0 is free)', 'number'], ['capacity', 'Capacity (optional)', 'number']];
  const actions = w.state === 'setup' ? [['cancel_setup', 'Cancel setup']] : w.purpose === 'table_banking' ? w.state === 'active' ? [['archive', 'Archive ledger']] : [] : w.purpose === 'group_buy' ? ({ target_met: [['ordered', 'Record order placed']], ordered: [['dispatched', 'Record dispatch']], dispatched: [['delivered', 'Record delivery']], delivered: [['close', 'Close completed buy']] } as Record<string, string[][]>)[w.state] ?? [] : ({ draft: [['publish', 'Publish event publicly'], ['cancel', 'Cancel draft']], published: [['start', 'Start event'], ['close', 'Close registrations'], ['cancel', 'Cancel event']], live: [['close', 'Close event']], ended: [['close', 'Close event record']] } as Record<string, string[][]>)[w.state] ?? [];
  return <section className="space-y-4" aria-label={`${LABELS[w.purpose]} workspace`}>
    <button onClick={onBack} disabled={busy}>← Group workspaces</button>
    <h3 className="text-xl font-bold">{w.name}</h3>
    <p>{LABELS[w.purpose]} · <strong>{w.state.replace(/_/g, ' ')}</strong></p>
    <p className="text-xs">Lifecycle: {w.lifecycle.join(' → ')}</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {w.owner && (w.state === 'setup' || (w.purpose === 'events' && w.state === 'draft')) && <div className="space-y-3">
      {fields.map(([field, label, type]) => <label key={field} className="block text-sm">{label}<input aria-label={label} type={type} min={type === 'number' ? 0 : undefined} value={config[field] ?? ''} onChange={e => setConfig(c => ({ ...c, [field]: e.target.value }))} className="block w-full p-3 rounded-xl" /></label>)}
      <button className={button} disabled={busy} onClick={() => {
        const saved = { ...config };
        for (const f of ['startsAt', 'endsAt']) if (saved[f]) saved[f] = new Date(saved[f]).toISOString();
        void cmd('setup', saved);
      }}>Save setup</button>
      <p className="text-sm">Save your settings first. {w.purpose === 'events' ? 'Create an event draft; publishing is a separate explicit action.' : w.purpose === 'table_banking' ? 'Activation creates a private ledger with you as its first member and owner. Approval of a participation request grants that applicant shared ledger access.' : 'Activation creates contribution and procurement records, not an escrow account. Contributions are not verified settlements.'}</p>
      <button hidden={w.state !== 'setup'} className={button} disabled={busy || !w.config || !Object.keys(w.config).length} onClick={() => void cmd('activate')}>{w.purpose === 'events' ? 'Create event draft' : 'Activate workspace'}</button>
    </div>}
    {!w.owner && !['active', 'requested'].includes(w.participation) && !['setup', 'cancelled', 'archived', 'closed', 'ended', 'delivered', 'draft'].includes(w.state) && <div className="space-y-2">
      <p className="text-sm">{w.purpose === 'table_banking' ? 'Request to join the shared ledger. If approved, you will be a financial member; this is separate from group membership.' : w.purpose === 'events' ? 'Register as an attendee, not an organizer. Paid registrations remain pending until the existing payment flow confirms settlement.' : 'Request buy participation. This does not grant access to other people’s contribution records.'}</p>
      <button className={button} disabled={busy} onClick={() => void cmd('participation')}>{w.purpose === 'events' ? 'Register for this event' : 'Request workspace participation'}</button>
    </div>}
    {w.participation === 'requested' && <p role="status">Participation requested. The workspace owner must approve it; no financial access has been granted.</p>}
    {w.event && <div className="space-y-2"><p>{w.event.description}</p><p>{w.event.location} · {w.event.startsAt ? new Date(w.event.startsAt).toLocaleString() : ''}</p><p>Ticket: KES {w.event.price}</p>{w.event.publicSlug && <a className="underline" target="_blank" rel="noreferrer" href={`/c/${w.event.publicSlug}`}>Public event page (no group data)</a>}</div>}
    {w.registration && <p>Your registration: {w.registration.status}. {w.registration.status !== 'started' && `Ticket: ${w.registration.ticketCode}`}</p>}
    {w.purpose === 'table_banking' && w.resourceId && w.participation === 'active' && <Suspense fallback={<p>Opening the ledger…</p>}><Banking key={`${w.resourceId}:${w.state}`} workspaceId={w.resourceId} workspaceOwner={w.owner} onRequireAuth={() => setError('Sign in again to open the ledger.')} /></Suspense>}
    {w.buy && <div className="space-y-3">
      <p>Target: KES {w.buy.targetAmount}. {w.buy.total !== null && `Recorded: KES ${w.buy.total}.`} No custody or verified settlement is implied.</p>
      <h4 className="font-bold">{w.owner ? 'Contribution records' : 'Your contribution records'}</h4>
      {w.buy.contributions.map(c => <p className="text-sm" key={c.id}>{c.memberRef} · KES {c.amount} · Receipt {c.receiptHash}</p>)}
      {['funding', 'target_met'].includes(w.state) && <label className="block">Amount you are recording (KES)<input aria-label="Contribution amount" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} className="p-3 rounded-xl block w-full" /></label>}
      <h4 className="font-bold">Procurement history</h4>{w.buy.history.map((h, i) => <p className="text-sm" key={i}>{h.stage} · {h.at} · {h.note}</p>)}
    </div>}
    {(w.owner || w.participation === 'active' || w.participation === 'requested') && <label className="block text-sm">Action reason / external reference<input aria-label="Workspace action reason" value={reason} onChange={e => setReason(e.target.value)} className="block w-full p-3 rounded-xl" placeholder="Explain the decision, or record the order/dispatch reference" /></label>}
    {w.buy && ['funding', 'target_met'].includes(w.state) && <button className={button} disabled={busy || !reason.trim() || Number(amount) <= 0} onClick={() => void cmd('actions', { action: 'contribute', amount: Number(amount), source: 'other', reason, requestId: contributionKey.current })}>Record my contribution (no money moved)</button>}
    {w.owner && <>
      {w.requests.map(p => <div className="p-3 rounded-xl bg-[var(--color-paper)] space-x-2" key={p.id}><span>@{p.handle} requested participation</span><button className={button} disabled={busy || !reason.trim()} onClick={() => void cmd('participation/decide', { participantId: p.id, approve: true, reason })}>Approve{w.purpose === 'table_banking' ? ' financial membership' : ''}</button><button disabled={busy || !reason.trim()} onClick={() => void cmd('participation/decide', { participantId: p.id, approve: false, reason })}>Decline</button></div>)}
      <div className="flex flex-wrap gap-2">{actions.map(([action, label]) => <button className={button} key={action} disabled={busy || !reason.trim()} onClick={() => void cmd('actions', { action, reason })}>{label}</button>)}</div>
      {w.purpose === 'events' && w.registrations && <section className="space-y-2"><h4 className="font-bold">Organizer’s registration desk</h4>{w.registrations.map(r => <div key={r.id}>{r.name} · {r.status} {r.status === 'registered' && <button disabled={busy || !reason.trim()} className={button} onClick={() => void cmd('actions', { action: 'checkin', registrationId: r.id, reason })}>Check in</button>}</div>)}</section>}
    </>}
    {!w.owner && ['active', 'requested'].includes(w.participation) && <button disabled={busy || !reason.trim()} onClick={() => void cmd('actions', { action: 'withdraw', reason })}>Withdraw participation / request</button>}
    <p className="text-xs">Closing a workspace does not close the Group or Shop. Historical financial records remain in their native ledger. Refunds, participant transfers and automated payouts are not implied.</p>
  </section>;
}
