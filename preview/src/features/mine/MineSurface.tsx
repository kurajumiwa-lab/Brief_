import React, { useEffect, useState } from 'react';
import { Store, Package, Bookmark, Star, Plus } from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import { splitSpaces, needsAttention } from '../home/spaceSignals';
import { StatusPill, spacePillState } from '../../ui/StatusPill';
import { modeTint } from '../spaces/modeTint';
import { Marketplace } from '../../components/Marketplace';
import { FollowingSurface } from '../../components/FollowingSurface';
import { soundEngine } from '../../utils/SoundEngine';

// ---------------------------------------------------------------------------
// MINE — the second door: your shops, your orders, what you kept.
//
// The reorg that owns this screen: the old bar gave five doors, three of them
// ("Spaces", "Discover", "Activity") were really "somewhere in my own stuff"
// and "somewhere in the world's stuff". Mine is the whole first half in one
// door:
//
//   SHOPS    the shopfronts you operate, as a two-column tile grid: the
//            vendor-portal pattern — a tile tinted by the shop's mode, the
//            name in white, the mode in white/70, and a status pill in the
//            corner saying the state the rows actually hold
//   ORDERS   the marketplace's personal rails — what you bought, what you sell
//   SAVED    the places and people you follow
//   REVIEWS  said as what it is: recorded, not yet a surface
//
// One shelf per thing, in order, with the real rows in each. Nothing here is
// a count that pretends to be a promise.
// ---------------------------------------------------------------------------

export interface MineSurfaceProps {
  onOpenSpace: (spaceId: string) => void;
  onOpenCreateSpace: () => void;
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
  className?: string;
}

const SectionHeading: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div className="flex items-center gap-2.5">
    <span
      className="w-8 h-8 rounded-xl grid place-items-center shrink-0"
      style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
    >
      {icon}
    </span>
    <div className="min-w-0">
      <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
    </div>
  </div>
);

export const MineSurface: React.FC<MineSurfaceProps> = ({
  onOpenSpace,
  onOpenCreateSpace,
  onOpenEntity,
  onRequireAuth,
  className = ''
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let live = true;
    void briefApi.listMySpaces().then((res) => {
      if (!live) return;
      if (res.ok && res.data?.spaces) setSpaces(res.data.spaces);
      setLoading(false);
    }).catch(() => { if (live) setLoading(false); });
    void briefApi.whoAmI().then((res) => { if (live) setAuthed(res.ok); });
    return () => { live = false; };
  }, []);

  const { active } = splitSpaces(spaces);

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--color-text)' }}>
          Mine
        </h1>
        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          Your shops, your orders, what you kept.
        </p>
      </header>

      {/* ── SHOPS ── */}
      <section aria-label="Your shops" className="space-y-2.5">
        <SectionHeading icon={<Store className="w-4 h-4" />} title="Shops" sub="The shopfronts you operate" />
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reading your shops…</p>
        ) : active.length === 0 ? (
          <div
            className="p-5 rounded-3xl border border-dashed text-center space-y-3"
            style={{ borderColor: 'var(--brief-line)', background: 'var(--color-paper)', boxShadow: 'var(--room-light), var(--lift-1)' }}
          >
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              No shop yet.
            </p>
            <button
              type="button"
              onClick={() => { soundEngine.play('heavyTap'); onOpenCreateSpace(); }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              <Plus className="w-4 h-4" /> Create your first space
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5" data-testid="mine-shop-tiles">
            {active.map((s) => {
              const attention = needsAttention(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                  aria-label={`Open ${s.name}`}
                  data-testid={`mine-shop-tile-${s.id}`}
                  className="relative rounded-2xl p-3.5 text-left min-h-[96px] cursor-pointer transition-all active:scale-[0.98]"
                  style={{ background: modeTint(s.mode), boxShadow: 'var(--lift-1)' }}
                >
                  <span className="absolute right-2.5 top-2.5">
                    <StatusPill state={spacePillState(s)} onTint />
                  </span>
                  <span className="block text-[13px] font-bold text-white leading-snug pr-12">
                    {s.name}
                  </span>
                  <span className="block text-[11px] font-medium text-white/70 mt-0.5">
                    {s.modeLabel ?? 'Mode not stated'}
                  </span>
                  {attention.length > 0 && (
                    <span
                      className="block text-[10px] font-semibold text-white/90 mt-1.5 truncate"
                      title={attention.map((a) => a.label).join(' · ')}
                    >
                      {attention.map((a) => a.label).join(' · ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── ORDERS ── */}
      <section aria-label="Your orders" className="space-y-2.5">
        <SectionHeading icon={<Package className="w-4 h-4" />} title="Orders" sub="What you bought, what you sell" />
        <div className="rounded-2xl border p-2" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-surface)' }}>
          <Marketplace initialSection="orders" />
        </div>
      </section>

      {/* ── SAVED ── */}
      <section aria-label="Saved and followed" className="space-y-2.5">
        <SectionHeading icon={<Bookmark className="w-4 h-4" />} title="Saved" sub="Places and people you follow" />
        <div className="rounded-2xl border p-2" style={{ borderColor: 'var(--brief-line)', background: 'var(--color-surface)' }}>
          <FollowingSurface
            authed={authed}
            onClose={() => {}}
            onOpenObject={() => {}}
            onOpenEntity={(id) => { soundEngine.play('tap'); onOpenEntity(id); }}
            onRequireAuth={onRequireAuth}
          />
        </div>
      </section>

      {/* ── REVIEWS — said as what it is ── */}
      <section aria-label="Reviews" className="space-y-2.5">
        <SectionHeading icon={<Star className="w-4 h-4" />} title="Reviews" sub="On your offers" />
        <div
          className="p-4 rounded-2xl"
          style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Reviews are recorded in the series ledger but not yet a surface — so there is nothing to show here,
            and no five-star row that would pretend otherwise.
          </p>
        </div>
      </section>
    </div>
  );
};

export default MineSurface;
