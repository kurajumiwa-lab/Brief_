import React, { useEffect, useState } from 'react';
import { ArrowRight, Lock, Plus, Users } from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { Circles } from '../../components/Circles';
import { Vault } from '../../components/vault/Vault';
import { CreateSpaceModal } from './CreateSpaceModal';
import { attentionQueue, splitSpaces } from '../home/spaceSignals';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// COORDINATION — the screen for who you are organised WITH.
//
// This is where circles and vaults landed when they were taken off Discover.
// The reason is a fit test, not a preference: Discover is a public gallery of
// inventory — things anyone can browse and walk up to. A circle is a room with
// a door: membership, a treasurer, a pot, votes. Putting it in the gallery
// meant a private arrangement was being scrolled past like a poster.
//
// Everything on this screen is read from real rows: your spaces (with the
// derived state of their files and their open items), the circles you are in or
// can join, and the vaults you have been granted access to. Empty is reported
// as empty; no seeded circle appears to make the room look used.
// ---------------------------------------------------------------------------

export function CoordinationSurface({
  onOpenSpace,
  className = ''
}: {
  onOpenSpace?: (spaceId: string) => void;
  className?: string;
}) {
  const [spaces, setSpaces] = useState<Space[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);

  const load = () => {
    setSpacesError(null);
    void briefApi.listMySpaces().then((res) => {
      if (res.ok) setSpaces(res.data?.spaces ?? []);
      else {
        setSpaces([]);
        setSpacesError(res.status === 401 ? null : res.error ?? 'Your spaces could not be read.');
      }
    });
  };

  useEffect(load, []);

  const { active } = splitSpaces(spaces ?? []);
  const queue = attentionQueue(active);
  const openItems = active.reduce((n, s) => n + (s.editorialOpen ?? 0), 0);

  return (
    <div className={`space-y-6 max-w-3xl mx-auto ${className}`}>
      <header className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--color-primary)' }}>
          Coordination
        </p>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
          Who you are organised with
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Spaces, circles and vaults. These have doors — membership, a treasurer, a pot — so they live
          away from the public gallery.
        </p>
      </header>

      {/* ── Your spaces, with the state of their files ─────────────────────── */}
      <section className="space-y-2" aria-label="Your spaces">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Your spaces
            {spaces && spaces.length > 0 ? ` · ${active.length} active` : ''}
            {openItems > 0 && (
              <span className="ml-1.5 normal-case font-bold" style={{ color: 'var(--color-primary)' }}>
                {openItems} open item{openItems === 1 ? '' : 's'}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => { soundEngine.play('heavyTap'); setCreateOpen(true); }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black cursor-pointer"
            style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
          >
            <Plus className="w-3.5 h-3.5" /> New space
          </button>
        </div>

        {!spaces ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reading your spaces…</p>
        ) : spacesError ? (
          <p className="text-xs font-bold" role="alert" style={{ color: 'var(--color-danger)' }}>
            {spacesError}{' '}
            <button type="button" onClick={load} className="underline cursor-pointer">Retry</button>
          </p>
        ) : spaces.length === 0 ? (
          <div className="p-6 rounded-3xl bg-white border border-dashed border-gray-300 text-center space-y-2">
            <p className="text-sm font-bold">No space yet.</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              A space is your project — a bakery, a fund, a stall — kept as a file the pipeline can read.
            </p>
            <button
              type="button"
              onClick={() => { soundEngine.play('heavyTap'); setCreateOpen(true); }}
              className="px-4 py-2 rounded-full text-xs font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Create your first space
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onOpenSpace?.(s.id); }}
                  className="w-full text-left p-4 rounded-2xl bg-white border border-black/5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text)' }}>{s.name}</p>
                    <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                      {s.visibility === 'public' ? 'Public — in the directory' : s.visibility === 'unlisted' ? 'Unlisted — by link only' : 'Private — only you'}
                      {(s.editorialOpen ?? 0) > 0 && ` · ${s.editorialOpen} open in the space file`}
                    </p>
                    {s.maintenance?.state && (
                      <p className="text-[10px] font-black uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-primary)' }}>
                        {s.maintenance.state}
                        {s.maintenance.ageHours != null
                          ? ` · ${s.maintenance.ageHours < 24 ? `${s.maintenance.ageHours}h` : `${Math.round(s.maintenance.ageHours / 24)}d`} since any change`
                          : ''}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(36,31,26,0.4)' }} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {queue.length > 0 && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {queue.length} space{queue.length === 1 ? '' : 's'} need a look — replies, drafts or orders to fulfil.
          </p>
        )}
      </section>

      {/* ── Circles ──────────────────────────────────────────────────────── */}
      <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3" aria-label="Circles">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Circles &amp; mutual aid
          </h2>
        </div>
        <p className="text-[11px] -mt-1" style={{ color: 'var(--color-text-muted)' }}>
          A circle is a group with a door: members, blocks of work, votes, and a pot whose progress only
          moves when money actually settles.
        </p>
        <Circles />
      </section>

      {/* ── Vaults ───────────────────────────────────────────────────────── */}
      <section className="p-4 rounded-3xl bg-white border border-black/5 shadow-2xs space-y-3" aria-label="Vaults">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4" style={{ color: 'var(--color-text)' }} />
          <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--color-text)' }}>
            Vaults
          </h2>
        </div>
        <p className="text-[11px] -mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Restricted records and drops. Access is granted per person, and nothing here is browsable from
          the gallery.
        </p>
        <Vault />
      </section>

      {createOpen && (
        <CreateSpaceModal
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onSpaceCreated={(s) => {
            setCreateOpen(false);
            load();
            onOpenSpace?.(s.id);
          }}
        />
      )}
    </div>
  );
}

export default CoordinationSurface;
