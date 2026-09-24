import React, { useEffect, useState } from 'react';
import * as api from '../../api/briefApi';
import { ImageField } from '../../components/ImageField';
import { CategoryArt } from '../../ui/CategoryArt';

export function ShopTeam({ spaceId }: { spaceId: string }) {
  const [view, setView] = useState<api.ShopTeamView | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', goal: '', image: null as string | null });
  useEffect(() => {
    let live = true; setView(null); setError('');
    api.getShopTeam(spaceId).then(r => { if (!live) return; if (r.ok) setView(r.data); else setError(r.error); });
    return () => { live = false; };
  }, [spaceId]);
  const finish = (r: Awaited<ReturnType<typeof api.getShopTeam>>) => { setBusy(false); if (r.ok) { setView(r.data); setNotice('Saved.'); setEditing(false); setHandle(''); } else setError(r.error); };
  return <section aria-label="Shop team" className="space-y-4 p-5 bg-white rounded-3xl">
    <div className="flex gap-3 items-center"><CategoryArt kind="groups" className="!w-14 !h-14" /><div><h2 className="text-xl font-extrabold">Shop team</h2><p className="text-sm text-[var(--color-text-muted)]">Clear roles. One shop identity.</p></div></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!view && !error && <p role="status">Reading the team…</p>}
    {view && <>
      <p className="font-bold">{view.shop.name} · You are {view.role}</p>
      <p className="text-sm text-[var(--color-text-muted)]">The owner controls membership and money. Managers can edit the shop’s brand. Staff can read its catalog. Roles apply only to this shop.</p>
      <ul className="space-y-2">{view.roster.map(m => <li className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--color-well)]" key={m.userId}><div><strong className="text-sm">{m.name}</strong><p className="text-xs capitalize">{m.role}{m.handle ? ` · @${m.handle}` : ''}</p></div>{view.role === 'owner' && m.role !== 'owner' && m.handle && <button disabled={busy} className="text-xs font-bold text-red-700" onClick={async () => { setBusy(true); setError(''); finish(await api.setShopTeamMember(spaceId, m.handle!, 'remove')); }}>Remove</button>}</li>)}</ul>
      {view.role === 'owner' && <form className="space-y-2" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); finish(await api.setShopTeamMember(spaceId, handle, role)); }}>
        <label className="block text-sm font-bold">Add or change a team member<input aria-label="Team member handle" required value={handle} onChange={e => setHandle(e.target.value)} placeholder="Their account handle" className="block mt-1 w-full rounded-xl p-3" /></label>
        <div className="flex gap-2"><select aria-label="Shop role" value={role} onChange={e => setRole(e.target.value)} className="rounded-xl px-3"><option value="staff">Staff · catalog read</option><option value="manager">Manager · brand editor</option></select><button disabled={busy || !handle.trim()} className="px-4 py-3 rounded-xl bg-[#111d2b] text-white font-bold text-sm disabled:opacity-40">{busy ? 'Saving…' : 'Save role'}</button></div>
      </form>}
      {(view.permissions?.editBrand ?? view.role === 'manager') && !editing && <button className="px-4 py-3 rounded-xl bg-[#111d2b] text-white text-sm font-bold" onClick={() => { setDraft({ name: view.shop.name, goal: view.shop.goal, image: view.shop.image }); setEditing(true); }}>Edit shop brand</button>}
      {editing && <form className="space-y-3" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); finish(await api.editShopTeamBrand(spaceId, draft)); }}>
        <input aria-label="Shop name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} required className="w-full rounded-xl p-3" />
        <textarea aria-label="Shop description" value={draft.goal} onChange={e => setDraft(d => ({ ...d, goal: e.target.value }))} className="w-full rounded-xl p-3" />
        <ImageField label="Shop brand cover" value={draft.image} onChange={image => setDraft(d => ({ ...d, image }))} />
        <button disabled={busy} className="px-4 py-3 rounded-xl bg-[#111d2b] text-white text-sm font-bold">Save brand</button><button type="button" onClick={() => setEditing(false)} className="ml-3 text-sm">Cancel</button>
      </form>}
      {view.role !== 'owner' && <div className="space-y-2"><h3 className="font-bold">Shop catalog</h3>{view.offers.length ? view.offers.map(o => <div key={o.id} className="p-3 bg-[var(--color-well)] rounded-xl"><p className="font-bold text-sm">{o.title}</p><p className="text-sm">{o.currency} {Number(o.price).toLocaleString('en-KE')} · {o.status}</p></div>) : <p className="text-sm text-[var(--color-text-muted)]">No catalog items in this shop yet.</p>}</div>}
    </>}
  </section>;
}

export function MyTeamShops() {
  const [shops, setShops] = useState<Array<{id: string; name: string; role: string}>>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => { let live = true; setError(''); api.getMyShopTeams().then(r => { if (!live) return; if (r.ok) setShops(r.data.shops); else if (r.status !== 401) setError(r.error); }); return () => { live = false; }; }, [retry]);
  if (error) return <section aria-label="Shops you work with" role="status" className="p-4 rounded-2xl bg-white text-sm">Team shops could not be loaded. <button className="font-bold underline" onClick={() => setRetry(n => n + 1)}>Try again</button></section>;
  if (!shops.length) return null;
  return <section aria-label="Shops you work with" className="space-y-3"><h2 className="text-lg font-extrabold">Shops you work with</h2>{shops.map(s => <button key={s.id} onClick={() => setOpen(open === s.id ? null : s.id)} className="w-full p-4 rounded-2xl bg-white text-left"><strong>{s.name}</strong><span className="ml-2 capitalize text-sm">{s.role}</span></button>)}{open && <ShopTeam spaceId={open} />}</section>;
}
