import React, { useState } from 'react';
import type { GroupDirectory as Directory } from '../api/briefApi';
import { CategoryArt } from '../ui/CategoryArt';

export function GroupDirectory({ data, error, onJoin, onOpen, onRetry, busyId }: {
  data: Directory | null; error: boolean; onJoin: (id: string) => void; onOpen: (id: string) => void; onRetry: () => void; busyId: string | null;
}) {
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [purpose, setPurpose] = useState('');
  const same = (a: string, b: string) => !b || a.toLocaleLowerCase() === b.toLocaleLowerCase();
  const rows = data?.groups.filter(g => same(g.location, location) && same(g.industry, industry) && (!purpose || g.purposes.includes(purpose))) ?? [];
  return <section aria-label="Group directory" className="space-y-3">
    <div><h3 className="text-lg font-extrabold">Find your people</h3><p className="text-sm text-[var(--color-text-muted)]">Groups that chose to be found. Their conversations and books stay private.</p></div>
    {error ? <div role="status" className="p-4 bg-white rounded-2xl">The directory could not be loaded. <button onClick={onRetry} className="font-bold underline">Try again</button></div> : !data ? <p role="status" className="text-sm">Reading the directory…</p> : <>
      <div className="group-directory-filters">
        <select aria-label="Filter groups by location" value={location} onChange={e => setLocation(e.target.value)}><option value="">All locations</option>{data.locations.map(x => <option key={x}>{x}</option>)}</select>
        <select aria-label="Filter groups by industry" value={industry} onChange={e => setIndustry(e.target.value)}><option value="">All industries</option>{data.industries.map(x => <option key={x}>{x}</option>)}</select>
        <select aria-label="Filter groups by purpose" value={purpose} onChange={e => setPurpose(e.target.value)}><option value="">All purposes</option>{data.purposes.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
      </div>
      {rows.length === 0 ? <div className="p-5 rounded-2xl bg-white"><p className="font-bold">No listed groups {location ? `in ${location}` : 'here'} yet.</p><p className="text-sm text-[var(--color-text-muted)] mt-1">Try another filter, or start one around what you need to do together.</p></div> : rows.map(g => <article className="group-directory-card" key={g.id}>
        <CategoryArt kind={g.purposes.includes('events') ? 'events' : 'groups'} className="!w-16 !h-16" />
        <div className="min-w-0 flex-1"><h3>{g.name}</h3><p>{[g.location, g.industry].filter(Boolean).join(' · ') || 'Location and industry not stated'}</p>{g.description && <p className="mt-1 line-clamp-2">{g.description}</p>}
          <div className="group-purpose-pills">{g.purposes.map(p => <span key={p}>{data.purposes.find(x => x.id === p)?.label ?? p}</span>)}</div>
          {g.hostName && <p className="mt-2">Hosted by {g.hostName}</p>}
          <button disabled={busyId === g.id || (!g.isMember && !g.canJoin && !g.canRequest)} onClick={() => g.isMember ? onOpen(g.id) : onJoin(g.id)} className="mt-3 px-4 py-2 bg-[#111d2b] text-white rounded-xl font-bold text-sm disabled:opacity-40">{busyId === g.id ? 'Joining…' : g.isMember ? 'Open group' : g.canJoin ? 'Join group' : g.canRequest ? 'Request to join' : 'Invitation required'}</button>
        </div>
      </article>)}
    </>}
  </section>;
}
