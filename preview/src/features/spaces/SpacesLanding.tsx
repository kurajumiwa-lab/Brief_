import React, { useEffect, useState } from 'react';
import { ArrowRight, Plus, Radio, Users } from 'lucide-react';
import type { PublicSpace, Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { CreateSpaceModal } from './CreateSpaceModal';
import { splitSpaces } from '../home/spaceSignals';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// SPACES LANDING — the street your shopfront sits on.
//
// Two lists and nothing else, because "Spaces" is a business noun: the spaces
// you operate, and the shops you follow. Circles (a community) and the vault
// (your filing cabinet) were pulled out of here on purpose — a storefront does
// not belong in a filing cabinet, and a neighbourhood is not a shop.
//
// Every figure on a card is derived: the state word is the maintenance read of
// that space's own file, "open items" counts real rows waiting on the owner, and
// a followed shop's numbers are its public projection. A space that went
// private after you followed it drops off your list rather than showing you a
// stale card — the server decides that, not the client's memory.
// ---------------------------------------------------------------------------

export function SpacesLanding({
  onOpenSpace,
  onOpenPublicSpace,
  className = ''
}: {
  onOpenSpace: (spaceId: string) => void;
  onOpenPublicSpace?: (slug: string) => void;
  className?: string;
}) {
  const [mine, setMine] = useState<Space[] | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);
  const [following, setFollowing] = useState<PublicSpace[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = () => {
    setMineError(null);
    void briefApi.listMySpaces().then((res) => {
      if (res.ok) setMine(res.data?.spaces ?? []);
      else if (res.status === 401) setMine([]);
      else { setMine([]); setMineError(res.error ?? 'Your spaces could not be read.'); }
    });
  };

  useEffect(() => {
    load();
    void briefApi.getFollowedSpaces().then((res) => setFollowing(res.ok ? res.data.spaces : []));
  }, []);

  const { active } = splitSpaces(mine ?? []);
  const openItems = active.reduce((n, s) => n + (s.editorialOpen ?? 0), 0);

  return (
    <div className={`space-y-6 max-w-3xl mx-auto ${className}`}>
      <header className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>
          Spaces
        </p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: '#0A0A0A' }}>
          Your shopfronts
        </h1>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          A space is a business kept as a file: hours, the counter, the inbox, the money. {openItems > 0
            ? `${openItems} item${openItems === 1 ? '' : 's'} in your space files need a look.`
            : 'Nothing is waiting on you.'}
        </p>
      </header>

      <section className="space-y-2" aria-label="Your spaces">
        {!mine ? (
          <p className="text-xs" style={{ color: '#6B7280' }}>Reading your spaces…</p>
        ) : mineError ? (
          <p className="text-[12px] font-bold" role="alert" style={{ color: '#E53935' }}>
            {mineError}{' '}
            <button type="button" onClick={load} className="underline cursor-pointer">Retry</button>
          </p>
        ) : active.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-dashed text-center space-y-2" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-sm font-bold" style={{ color: '#0A0A0A' }}>No space yet.</p>
            <p className="text-[12px]" style={{ color: '#6B7280' }}>
              A space is your project — a bakery, a stall, a fund. It stays a file the pipeline can read, not
              a page you post to.
            </p>
            <button
              type="button"
              onClick={() => { soundEngine.play('heavyTap'); setCreateOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Plus className="w-4 h-4" /> Create your first space
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {active.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                className="text-left rounded-2xl overflow-hidden border bg-white cursor-pointer transition-shadow hover:shadow-md"
                style={{ borderColor: '#E5E7EB' }}
              >
                <div className="h-[76px]" style={{ background: 'linear-gradient(135deg, #4F46E5, #22D3EE)' }}>
                  {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" /> : null}
                </div>
                <div className="p-3">
                  <p className="text-[14px] font-bold truncate" style={{ color: '#0A0A0A' }}>{s.name}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: '#6B7280' }}>
                    {s.metrics?.offersCount ?? 0} live offer{s.metrics?.offersCount === 1 ? '' : 's'}
                    {s.visibility === 'public' ? ' · public' : ' · private'}
                  </p>
                  {s.maintenance?.state && (
                    <p className="text-[10px] font-black uppercase tracking-wider mt-1.5" style={{ color: stateColor(s.maintenance.state) }}>
                      {s.maintenance.state}
                      {s.maintenance.ageHours != null
                        ? ` · ${s.maintenance.ageHours < 24 ? `${s.maintenance.ageHours}h` : `${Math.round(s.maintenance.ageHours / 24)}d`}`
                        : ''}
                      {(s.editorialOpen ?? 0) > 0 ? ` · ${s.editorialOpen} open` : ''}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setCreateOpen(true); }}
            className="text-[12px] font-black cursor-pointer"
            style={{ color: 'var(--color-primary)' }}
          >
            + New space
          </button>
        )}
      </section>

      {/* ── The shops you follow ─────────────────────────────────────────── */}
      <section className="space-y-2" aria-label="Spaces you follow">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-[11px] font-black uppercase tracking-wider" style={{ color: '#0A0A0A' }}>
            Spaces you follow
          </h2>
        </div>
        {!following ? (
          <p className="text-xs" style={{ color: '#6B7280' }}>Reading your follows…</p>
        ) : following.length === 0 ? (
          <p className="text-[12px]" style={{ color: '#6B7280' }}>
            You follow nobody yet. Follow a shop from its page and its updates land in your notifications.
          </p>
        ) : (
          <ul className="space-y-2">
            {following.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); s.slug && onOpenPublicSpace?.(s.slug); }}
                  className="w-full text-left p-3 rounded-2xl border bg-white flex items-center gap-3 cursor-pointer"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate" style={{ color: '#0A0A0A' }}>{s.name}</span>
                    <span className="block text-[11px] font-mono truncate" style={{ color: '#6B7280' }}>
                      {s.followers ?? 0} follow · {s.activeOfferCount} offer{s.activeOfferCount === 1 ? '' : 's'}
                      {(s.broadcasts?.length ?? 0) > 0 && ' · update up'}
                    </span>
                  </span>
                  {(s.broadcasts?.length ?? 0) > 0 && (
                    <Radio className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  )}
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: '#9CA3AF' }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {createOpen && (
        <CreateSpaceModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onSpaceCreated={(s) => { setCreateOpen(false); load(); onOpenSpace(s.id); }}
        />
      )}
    </div>
  );
}

function stateColor(state?: string | null) {
  if (state === 'fresh') return '#00C853';
  if (state === 'active') return '#5B4CFF';
  if (state === 'stale') return '#F59E0B';
  if (state === 'dormant') return '#E53935';
  return '#6B7280';
}

export default SpacesLanding;
