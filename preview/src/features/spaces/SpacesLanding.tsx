import React, { useEffect, useState } from 'react';
import { ArrowRight, Plus, Radio, Users } from 'lucide-react';
import type { PublicSpace, Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { CreateSpaceModal } from './CreateSpaceModal';
import { ShopBrief } from './ShopBrief';
import { splitSpaces } from '../home/spaceSignals';
import { StateDot, dotForMaintenance } from '../../ui/StateDot';
import { soundEngine } from '../../utils/SoundEngine';

import { roomSurface, PHOTO_FILTER } from '../city/room';

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
        <p className="text-[12px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>
          Spaces
        </p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--brief-ink)' }}>
          Your shopfronts
        </h1>

      </header>

      {/* The morning read of the WHOLE business, above the list of its parts:
          yesterday's money, the shelf, who wrote what, and the rows no space
          claims. It is a read over the owner's rows, so there is nothing here to
          keep up to date — and nothing to edit either. */}
      <ShopBrief onOpenSpace={onOpenSpace} />

      <section className="space-y-2" aria-label="Your spaces">
        {!mine ? (
          <p className="text-xs" style={{ color: 'var(--brief-muted)' }}>Reading your spaces…</p>
        ) : mineError ? (
          <p className="text-[13px] font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
            {mineError}{' '}
            <button type="button" onClick={load} className="underline cursor-pointer">Retry</button>
          </p>
        ) : active.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[color:var(--color-paper)] border border-dashed text-center space-y-2" style={{ boxShadow: 'var(--room-light), var(--lift-1)' }}>
            <p className="text-sm font-bold" style={{ color: 'var(--brief-ink)' }}>No space yet</p>
            <button
              type="button"
              onClick={() => { soundEngine.play('heavyTap'); setCreateOpen(true); }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-black cursor-pointer"
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
                className="text-left rounded-2xl overflow-hidden bg-[color:var(--color-paper)] cursor-pointer brief-lift-2"
              >
                {/* The cover is the room's plaster with the accent at 7% — a shop
                    with no photograph has a WAITING cover, not somebody else's
                    stock image and not a cold gradient swatch. */}
                <div className="h-[76px]" style={{ background: roomSurface() }}>
                  {s.image ? <img src={s.image} alt="" className="w-full h-full object-cover" style={{ filter: PHOTO_FILTER }} /> : null}
                </div>
                <div className="p-3">
                  <p className="text-[15px] font-bold truncate" style={{ color: 'var(--brief-ink)' }}>{s.name}</p>
                  <p className="text-[12px] truncate mt-0.5" style={{ color: 'var(--brief-muted)' }}>
                    {s.metrics?.offersCount ?? 0} live offer{s.metrics?.offersCount === 1 ? '' : 's'}
                    {s.visibility === 'public' ? ' · public' : ' · private'}
                  </p>
                  <span className="mt-1.5 flex items-center gap-2">
                    {s.maintenance?.state && (
                      <StateDot
                        state={dotForMaintenance(s.maintenance.state)}
                        label={s.maintenance.ageHours != null
                          ? `${s.maintenance.state} · ${s.maintenance.ageHours < 24 ? `${s.maintenance.ageHours}h` : `${Math.round(s.maintenance.ageHours / 24)}d`}`
                          : s.maintenance.state}
                      />
                    )}
                    {(s.editorialOpen ?? 0) > 0 && (
                      <span className="text-[11px] font-bold font-mono" style={{ color: (s.editorialBreakdown?.overdue ?? 0) > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                        {s.editorialOpen} to answer
                      </span>
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
        {active.length > 0 && (
          <button
            type="button"
            onClick={() => { soundEngine.play('tap'); setCreateOpen(true); }}
            className="text-[13px] font-black cursor-pointer"
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
          <h2 className="text-[12px] font-black uppercase tracking-wider" style={{ color: 'var(--brief-ink)' }}>
            Spaces you follow
          </h2>
        </div>
        {!following ? (
          <p className="text-xs" style={{ color: 'var(--brief-muted)' }}>Reading your follows…</p>
        ) : following.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--brief-muted)' }}>
            You follow nobody yet. Follow a shop from its page and its updates land in your notifications.
          </p>
        ) : (
          <ul className="space-y-2">
            {following.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); s.slug && onOpenPublicSpace?.(s.slug); }}
                  className="w-full text-left p-3 rounded-2xl bg-[color:var(--color-paper)] flex items-center gap-3 cursor-pointer brief-lift-1"
                                  >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold truncate" style={{ color: 'var(--brief-ink)' }}>{s.name}</span>
                    <span className="block text-[12px] font-mono truncate" style={{ color: 'var(--brief-muted)' }}>
                      {s.followers ?? 0} follow · {s.activeOfferCount} offer{s.activeOfferCount === 1 ? '' : 's'}
                      {(s.broadcasts?.length ?? 0) > 0 && ' · update up'}
                    </span>
                  </span>
                  {(s.broadcasts?.length ?? 0) > 0 && (
                    <Radio className="w-4 h-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                  )}
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: 'var(--color-quiet)' }} />
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

// The derived maintenance state, in the room's own semantic colours — never a
// neon green / purple / amber borrowed from another theme. State is a label on a
// fact (a count of hours since the last real edit); it carries no privilege, no
// rank and no enforcement, so it gets no costume either.
function stateColor(state?: string | null) {
  if (state === 'fresh') return 'var(--color-success)';
  if (state === 'active') return 'var(--color-primary)';
  if (state === 'stale') return 'var(--color-warning)';
  if (state === 'dormant') return 'var(--color-danger)';
  return 'var(--brief-muted)';
}

export default SpacesLanding;
