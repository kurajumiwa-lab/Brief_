import React, { useEffect, useState } from 'react';
import { Store, Package, Plus } from 'lucide-react';
import type { Space } from '../../api/types';
import * as briefApi from '../../api/briefApi';
import type { FollowsGroups } from '../../api/briefApi';
import { splitSpaces } from '../home/spaceSignals';
import { NoPhotoPlate } from '../city/NoPhotoPlate';
import { GlobysCard } from '../../ui/GlobysCard';
import { Marketplace } from '../../components/Marketplace';
import { soundEngine } from '../../utils/SoundEngine';
import { EscrowRecords } from './EscrowRecords';

// ---------------------------------------------------------------------------
// MINE — the second door: what you kept, the shops you operate, orders.
//
// No page title. The bar already says Mine.
//
// The dual-shelf bug this file exists to close: Home → Shops used to open a
// second street (SpacesLanding, starting with the morning brief) while this
// door opened a third (a gradient “Your shop overview” plus the same shops).
// Both lit the Mine door. There is one shelf now.
// ---------------------------------------------------------------------------

export interface MineSurfaceProps {
  onOpenSpace: (spaceId: string) => void;
  onOpenCreateSpace: () => void;
  onOpenEntity: (entityId: string) => void;
  onRequireAuth: () => void;
  /** Create “Post an offer” lands on Selling here, not on the city’s browse. */
  sellingSignal?: number;
  className?: string;
}

const SectionHeading: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  action?: React.ReactNode;
}> = ({ icon, title, sub, action }) => (
  <div className="flex items-center gap-2.5">
    <span
      className="w-8 h-8 rounded-xl grid place-items-center shrink-0"
      style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
    >
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <h2 className="text-[15px] font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>{title}</h2>
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{sub}</p>
    </div>
    {action}
  </div>
);

function FollowBelt({
  follows,
  onOpenEntity
}: {
  follows: FollowsGroups;
  onOpenEntity: (id: string) => void;
}) {
  const items = Object.values(follows.groups).flat();
  if (items.length === 0) return null;
  return (
    <section aria-label="What you kept" className="space-y-2">
      <p className="text-[11px] font-mono uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
        Kept
      </p>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1" data-testid="follow-belt">
        {items.map((f) => {
          const initial = (f.name || '?').trim().charAt(0).toUpperCase();
          const src = f.imageUrl ? briefApi.mediaFileUrl(f.imageUrl) : null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => { soundEngine.play('tap'); onOpenEntity(f.id); }}
              className="shrink-0 w-14 flex flex-col items-center gap-1 cursor-pointer"
            >
              {src ? (
                <img src={src} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <span
                  className="w-12 h-12 rounded-full grid place-items-center text-[15px] font-black"
                  style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                >
                  {initial}
                </span>
              )}
              <span className="text-[11px] font-bold truncate w-14 text-center" style={{ color: 'var(--color-text)' }}>
                {f.name}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export const MineSurface: React.FC<MineSurfaceProps> = ({
  onOpenSpace,
  onOpenCreateSpace,
  onOpenEntity,
  onRequireAuth,
  sellingSignal = 0,
  className = ''
}) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [shopsFailed, setShopsFailed] = useState(false);
  const [shopsDenied, setShopsDenied] = useState(false);
  const [shopsAttempt, setShopsAttempt] = useState(0);
  const [follows, setFollows] = useState<FollowsGroups | null>(null);
  const [marketSection, setMarketSection] = useState<'orders' | 'selling'>('orders');
  const [marketKey, setMarketKey] = useState(0);

  useEffect(() => {
    if (sellingSignal > 0) {
      setMarketSection('selling');
      setMarketKey((k) => k + 1);
    }
  }, [sellingSignal]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setShopsFailed(false);
    setShopsDenied(false);
    void briefApi.listMySpaces().then((res) => {
      if (!live) return;
      if (res.ok && res.data?.spaces) {
        setSpaces(res.data.spaces);
        setShopsFailed(false);
        setShopsDenied(false);
      } else {
        setSpaces([]);
        setShopsDenied(!res.ok && (res as { status?: number }).status === 401);
        setShopsFailed(!res.ok && (res as { status?: number }).status !== 401);
      }
      setLoading(false);
    }).catch(() => {
      if (!live) return;
      setSpaces([]);
      setShopsFailed(true);
      setLoading(false);
    });
    void briefApi.getMyFollows().then((res) => {
      if (live && res.ok) setFollows(res.data);
    });
    return () => { live = false; };
  }, [shopsAttempt]);

  const { active } = splitSpaces(spaces);
  const lowestOffer = (s: Space): string | null => {
    const prices = (s.offers ?? [])
      .filter((o) => o.status === 'active' && typeof o.price === 'number' && o.price > 0)
      .map((o) => o.price);
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const cur = (s.offers ?? []).find((o) => o.price === min)?.currency ?? 'KES';
    return `from ${cur} ${min.toLocaleString('en-KE')}`;
  };

  const createBtn = (
    <button
      type="button"
      onClick={() => { soundEngine.play('heavyTap'); onOpenCreateSpace(); }}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-black cursor-pointer shrink-0"
      style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
    >
      <Plus className="w-3.5 h-3.5" /> Create space
    </button>
  );

  return (
    <div className={`space-y-6 max-w-2xl mx-auto ${className}`}>
      {follows && <FollowBelt follows={follows} onOpenEntity={onOpenEntity} />}

      <EscrowRecords />

      <section aria-label="Your shops" className="space-y-2.5">
        <SectionHeading
          icon={<Store className="w-4 h-4" />}
          title="Shops"
          sub="The shopfronts you operate"
          action={createBtn}
        />
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Reading your shops…</p>
        ) : shopsDenied ? (
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
            Sign in to see the shops you operate.
          </p>
        ) : shopsFailed ? (
          <div
            className="p-4 rounded-2xl space-y-2"
            style={{ background: 'var(--color-paper)', boxShadow: 'var(--room-light), inset 0 0 0 1px var(--brief-line)' }}
            role="status"
          >
            <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
              Your shops could not be read just now.
            </p>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              Nothing is shown in their place — no empty shop, no invented stall.
            </p>
            <button
              type="button"
              onClick={() => { soundEngine.play('tap'); setShopsAttempt((n) => n + 1); }}
              className="inline-flex items-center px-3.5 py-2 rounded-full text-xs font-black cursor-pointer"
              style={{ background: 'var(--color-primary)', color: 'var(--accent-ink)' }}
            >
              Try again
            </button>
          </div>
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
          <div className="grid grid-cols-2 gap-2.5" data-testid="mine-shop-grid">
            {active.map((s) => (
              <GlobysCard
                key={s.id}
                testId={`shop-${s.id}`}
                image={s.image}
                imageAlt={s.name}
                plate={<NoPhotoPlate mark={s.modeLabel ?? 'shop'} icon={<Store className="w-4 h-4" />} />}
                title={s.name}
                price={lowestOffer(s)}
                seller="You"
                mono={s.profileLabels?.where ?? null}
                actionLabel="View shop →"
                onAction={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
                onOpen={() => { soundEngine.play('tap'); onOpenSpace(s.id); }}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Your orders" className="space-y-2.5">
        <SectionHeading icon={<Package className="w-4 h-4" />} title="Orders" sub="What you bought, what you sell" />
        <Marketplace key={marketKey} initialSection={marketSection} hideBrowse />
      </section>
    </div>
  );
};

export default MineSurface;
